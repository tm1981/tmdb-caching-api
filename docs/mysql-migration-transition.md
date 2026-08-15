# One-time MySQL migration transition

Use this procedure once for an existing MySQL installation that predates `prisma/migrations-mysql`.
It preserves the `User` and `ApiKey` rows required for admin login and existing API keys. All request logs,
blocked IPs, sync history, search fixes, normalized titles, and raw TMDB cache rows are discarded. The disk
media cache under `data/media` is not changed.

The commands below match the current production names: container `mysql_lts_container` and database `tm81`.
Run them from the application repository. Do not execute the database drop until both dumps and the saved row
counts have been verified.

## 1. Pull the release and stop writes

```bash
git pull --ff-only
sudo systemctl stop tmdb
```

## 2. Create two backups

```bash
TMDB_BACKUP_DIR="$PWD/../tmdb-db-transition-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$TMDB_BACKUP_DIR"
chmod 700 "$TMDB_BACKUP_DIR"
echo "$TMDB_BACKUP_DIR"
read -rsp "MySQL root password: " TMDB_MYSQL_ROOT_PASSWORD
echo

docker exec -e MYSQL_PWD="$TMDB_MYSQL_ROOT_PASSWORD" mysql_lts_container \
  mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF tm81 \
  > "$TMDB_BACKUP_DIR/tm81-full.sql"

docker exec -e MYSQL_PWD="$TMDB_MYSQL_ROOT_PASSWORD" mysql_lts_container \
  mysqldump -uroot --single-transaction --no-create-info --skip-triggers --complete-insert --set-gtid-purged=OFF tm81 User ApiKey \
  > "$TMDB_BACKUP_DIR/users-api-keys.sql"

docker exec -e MYSQL_PWD="$TMDB_MYSQL_ROOT_PASSWORD" mysql_lts_container \
  mysql -uroot -N tm81 -e "SELECT COUNT(*) AS UserCount FROM User; SELECT COUNT(*) AS ApiKeyCount FROM ApiKey;" \
  | tee "$TMDB_BACKUP_DIR/counts-before.txt"

test -s "$TMDB_BACKUP_DIR/tm81-full.sql"
test -s "$TMDB_BACKUP_DIR/users-api-keys.sql"
cat "$TMDB_BACKUP_DIR/counts-before.txt"
```

Keep the displayed `TMDB_BACKUP_DIR` path available in the same shell. Confirm that both SQL files are nonempty
and that the expected `User` and `ApiKey` counts are shown before continuing.

## 3. Recreate only the application database

This command irreversibly removes the current `tm81` database. It is intentional only after step 2 succeeds.

```bash
docker exec -e MYSQL_PWD="$TMDB_MYSQL_ROOT_PASSWORD" mysql_lts_container \
  mysql -uroot -e 'DROP DATABASE `tm81`; CREATE DATABASE `tm81` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
```

## 4. Apply the clean MySQL migration history

```bash
npm run db:migrate:deploy
```

This applies `prisma/migrations-mysql/0_init` and creates Prisma's `_prisma_migrations` tracking table.

## 5. Restore users and API keys

```bash
docker exec -i -e MYSQL_PWD="$TMDB_MYSQL_ROOT_PASSWORD" mysql_lts_container \
  mysql -uroot tm81 \
  < "$TMDB_BACKUP_DIR/users-api-keys.sql"

docker exec -e MYSQL_PWD="$TMDB_MYSQL_ROOT_PASSWORD" mysql_lts_container \
  mysql -uroot -N tm81 -e "SELECT COUNT(*) AS UserCount FROM User; SELECT COUNT(*) AS ApiKeyCount FROM ApiKey; SELECT COUNT(*) AS MigrationCount FROM _prisma_migrations;"
```

The restored `User` and `ApiKey` counts must match `counts-before.txt`, and the migration count must be at least 1.

```bash
unset TMDB_MYSQL_ROOT_PASSWORD
```

## 6. Build and start the app

```bash
npm run build
sudo systemctl start tmdb
sudo systemctl status tmdb --no-pager
```

Verify login and make one authenticated API request using an existing key. The Usage dashboard starts empty and
will record new requests. No application-side request limiter remains; only upstream TMDB 429 responses appear
as rate-limit events.

## Future production releases

After this one-time transition, never use `prisma db push` against production. Each feature release should commit
a reviewed migration under `prisma/migrations-mysql`, then deploy in this order:

```bash
git pull --ff-only
npm run db:migrate:status
npm run db:migrate:deploy
npm run build
sudo systemctl restart tmdb
```

Create migrations against a disposable MySQL development database with:

```bash
npm run db:migrate:dev -- --name describe_change
```

Review the generated SQL and test it on a staging copy before production deployment.
