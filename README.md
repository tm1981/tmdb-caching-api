# TMDB Data Caching Service

A Next.js 16 service that caches TMDB movie and TV show data in PostgreSQL, MySQL, or MariaDB, providing a fast local API with lazy sync and admin dashboard.

## Tech Stack

- **Next.js 16** with App Router
- **PostgreSQL**, **MySQL**, or **MariaDB** for data storage
- **Prisma 7** as ORM
- **next-auth v4** for admin authentication
- **shadcn/ui** + Tailwind CSS 4 for admin UI

## Prerequisites

- Node.js 20+
- PostgreSQL 14+, MySQL 8+, or MariaDB 10.6+
- TMDB API key from [themoviedb.org](https://www.themoviedb.org/settings/api)

## Setup

### 1. Choose and create the database

Choose the database type before setup. The selected type is fixed for that installation; changing it later means setting up a new database or migrating data yourself.

Create an empty database named `tmdb_service` in one of:

```bash
# PostgreSQL
createdb tmdb_service

# MySQL
mysql -u root -p -e "CREATE DATABASE tmdb_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# MariaDB
mariadb -u root -p -e "CREATE DATABASE tmdb_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Clone and install dependencies

```bash
cd tmdb-service
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://user:password@host:3306/tmdb_service
TMDB_API_KEY=your_tmdb_api_key_here
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
MEDIA_PUBLIC_URL=http://localhost:3000
MEDIA_CACHE_MAX_BYTES=5368709120
MEDIA_CACHE_MAX_FILE_BYTES=26214400
RATE_LIMIT_BYPASS_IPS="203.0.113.10,2001:db8::1"
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=your_secure_password
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM="TMDB Service <no-reply@example.com>"
```

Database URL examples:

```env
# PostgreSQL
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:password@host:5432/tmdb_service

# MySQL
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://user:password@host:3306/tmdb_service

# MariaDB
DATABASE_PROVIDER=mariadb
DATABASE_URL=mysql://user:password@host:3306/tmdb_service
```

`DATABASE_PROVIDER` must match `DATABASE_URL` before running Prisma commands or building the app. For MySQL, use `DATABASE_PROVIDER=mysql` and a `mysql://...` URL.

### 4. Set up the database

For a new local/dev database, `db push` is the simplest setup path for any provider:

```bash
# Generate Prisma Client for your selected database
npm run db:generate

# Create/update tables
npm run db:push

# Seed with admin user and default API key
npm run db:seed
```

## Database Migrations

Prisma migration SQL is provider-specific. Do not run PostgreSQL migrations against MySQL/MariaDB, or MySQL migrations against PostgreSQL.

This repository currently has PostgreSQL migration files in `prisma/migrations/`:

```bash
cat prisma/migrations/migration_lock.toml
# provider = "postgresql"
```

### PostgreSQL production

Use the checked-in migrations:

```bash
DATABASE_PROVIDER=postgresql npx prisma migrate deploy
npm run build
pm2 restart tmdb
```

Create a new PostgreSQL migration after schema changes:

```bash
DATABASE_PROVIDER=postgresql npx prisma migrate dev --name describe_change
```

Commit the generated `prisma/migrations/*` files.

### MySQL / MariaDB production

The checked-in migrations are not MySQL-compatible. For the current MySQL/MariaDB install, use:

```bash
DATABASE_PROVIDER=mysql npx prisma db push
npm run build
pm2 restart tmdb
```

Use `DATABASE_PROVIDER=mariadb` for MariaDB if your `.env` uses that provider.

To use real MySQL/MariaDB migrations later, create a separate MySQL/MariaDB migration history from `prisma/schema.mysql.prisma` on a clean database, then commit that provider-specific migration set. Do not mix it with the PostgreSQL migration folder.

### 5. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

TMDB images requested through `/media/t/p/{size}/{file}` are cached on disk in `data/media`. Set
`MEDIA_PUBLIC_URL` to the service's public HTTPS origin in production and mount `data/media` on persistent
storage. The defaults allow 5 GiB total and 25 MiB per image; oldest files are removed after the limit is exceeded.

### 6. Login to admin dashboard

Go to `http://localhost:3000/login` and use the admin credentials you set in `.env`.

## Admin Dashboard

After login, the admin dashboard provides:

- **Movies** - Browse, search, and manage cached movies
- **TV Shows** - Browse, search, and manage cached TV shows
- **Search Fixes** - Resolve captured empty searches by mapping provider text to a TMDB movie or TV ID
- **Sync** - Trigger bulk syncs (trending movies/TV, top rated)
- **API Keys** - Create, manage, and revoke API keys
- **Usage & Logs** - Inspect API traffic, active clients, cache performance, latency, countries, and individual requests; admins can permanently clear request logs after confirmation
- **Cache controls** - Cap disposable TMDB cache rows and clear cached responses, movies, and TV shows before a backup while preserving account data and Search Fixes state

The admin-only `/admin/usage` page records `/api/v1` attempts for 30 days. Sensitive query values are redacted, and raw API keys are never stored. The dashboard reuses hourly aggregates and calculates P95 latency from the latest 5,000 requests in each comparison window so large log tables remain responsive. **Clear logs** permanently truncates the request-log table for the configured database after browser confirmation.

Disposable database cache rows are capped by `TMDB_CACHE_MAX_ROWS` (default `100000`) across `TmdbCache`, `Movie`, and `TvShow`. Old raw mirror rows are evicted first, followed by the oldest normalized movie/TV rows. Cleanup is single-flight, runs outside the request path, and uses sequential 1,000-row batches so normal traffic cannot start overlapping cleanup transactions and exhaust a small MySQL connection pool. Manual corrections and captured/dismissed Search Fixes are preserved and do not count toward the limit. **Admin > Sync > Clear database cache** removes disposable cached rows in the same bounded batches without deleting users, API keys, request logs, sync history, or Search Fixes state.

TMDB media files are not stored in the database. The database keeps TMDB image path strings, while the media proxy stores requested files separately on disk under `data/media` with its own `MEDIA_CACHE_MAX_BYTES` limit. The proxy tracks cache growth in memory, scans files with bounded concurrency only when needed, and trims to 90% of the limit so a full directory scan is not repeated after every new image. Clearing the database cache does not clear this disk media cache; omit `data/media` from a lean backup or clear that directory separately while the app is stopped.

IP and country values come from trusted reverse-proxy headers, so nginx or your CDN must overwrite forwarded headers at the network boundary. When no country header is present, the logger can fall back to a local MaxMind GeoLite2 Country database.

`RATE_LIMIT_BYPASS_IPS` accepts a comma-separated list of exact trusted client IPs. These IPs bypass the local
per-IP and per-key request limits, but not API-key authentication or blocked-IP checks. A local 429 response uses
`x-ratelimit-source: tmdb-service`; an upstream TMDB 429 uses `x-ratelimit-source: tmdb`. Both include `retry-after`.

### GeoIP country fallback

Create a free MaxMind account and license key, copy the `MAXMIND_*` and `GEOIP_DATABASE_PATH` values from `.env.example` into `.env`, restart the app, then click **Update GeoIP** on **Admin > Usage & Logs**. The admin-only action checks freshness, downloads only newer data, validates the MMDB, and replaces the previous database.

The downloaded MMDB is ignored by Git. The application watches it for updates, and trusted proxy country headers still take precedence. Private, loopback, malformed, and MaxMind-unknown addresses remain `Unknown`.

## API Endpoints

All API endpoints require the `x-api-key` header. Rate limit: 60 requests per minute per key.

For TMDB-compatible content mirroring, use `/api/v1/tmdb/{tmdb_path}`. It forwards public TMDB content GET endpoints, caches successful JSON responses, and keeps TMDB's response shape. See [docs/api.md](docs/api.md).

`/api/v1/tmdb/configuration` keeps TMDB's existing response shape but advertises the local disk-backed
`/media/t/p/` URL in `images.base_url` and `images.secure_base_url`. Movie, TV, search, and raw mirror payloads
remain unchanged, including every `poster_path`, `backdrop_path`, `profile_path`, and `still_path` value.

### Movies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/movies` | List all movies with pagination |
| `GET` | `/api/v1/movies/:id` | Get movie details by TMDB ID (lazy syncs if missing) |

**Query parameters for `/api/v1/movies`:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |
| `q` | string | - | Search by title |

### TV Shows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tv` | List all TV shows with pagination |
| `GET` | `/api/v1/tv/:id` | Get TV show details by TMDB ID (lazy syncs if missing) |

**Query parameters for `/api/v1/tv`:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |
| `q` | string | - | Search by name |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/search?q=term` | Search both movies and TV shows |

If TMDB returns no movie or TV result, a dedicated capture appears in **Admin > Search Fixes**. A manual mapping is
validated against TMDB and then placed first for matching normalized searches. Captures with no valid TMDB match can
be dismissed without deleting the raw TMDB response, viewed in a separate list, and restored later. The page tracks
approximate occurrence counts plus first/last-seen times and includes a cached movie/TV result picker for one-click
mapping. The same mapping and capture behavior applies to the TMDB mirror `/search/multi`, `/search/movie`, and
`/search/tv` routes.

## Example Requests

```bash
# Get movies list
curl -H "x-api-key: your_api_key" http://localhost:3000/api/v1/movies

# Get movie by TMDB ID (lazy syncs if not cached)
curl -H "x-api-key: your_api_key" http://localhost:3000/api/v1/movies/278

# Search movies and TV shows
curl -H "x-api-key: your_api_key" "http://localhost:3000/api/v1/search?q=matrix"

# Paginate with search
curl -H "x-api-key: your_api_key" "http://localhost:3000/api/v1/movies?page=2&limit=10&q=action"
```

## Response Format

### List endpoints return:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Detail endpoints return TMDB-compatible JSON:
```json
{
  "id": 278,
  "title": "The Shawshank Redemption",
  "overview": "...",
  "poster_path": "/...",
  "backdrop_path": "/...",
  "credits": { "cast": [], "crew": [] },
  "videos": { "results": [] }
}
```

### Search endpoint returns:
```json
{
  "data": {
    "movies": [...],
    "tvShows": [...]
  }
}
```

## Production Build

```bash
npm run db:generate
npm run build
PORT=3000 npm run start
```

The app uses the normal Next.js production server via `next start`. Set `NEXTAUTH_URL` to the public HTTPS domain in production.

## Lazy Sync

When a client requests a movie or TV show by TMDB ID that isn't in the local database, the service automatically fetches it from TMDB, stores it, and returns it. This eliminates the need for pre-populating the database.
