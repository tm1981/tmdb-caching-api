# System Patterns

## Architecture
The application is built on **Next.js 16 (App Router)** using React Server Components (RSC) and Server Actions.

### Data Flow
1. **API Routes (`app/api/v1/`)**:
   - Public REST endpoints protected by middleware API key validation.
   - `movies/route.ts`: Paginated movie list with search.
   - `movies/[id]/route.ts`: Get movie by TMDB ID with lazy-sync.
   - `tv/route.ts`: Paginated TV show list with search.
   - `tv/[id]/route.ts`: Get TV show by TMDB ID with lazy-sync.
   - `search/route.ts`: Combined movie/TV search.
   - `tmdb/[...path]/route.ts`: Raw TMDB-compatible public content mirror with DB cache.
2. **Admin Pages (`app/admin/`)**:
   - **Server Components**: Fetch data directly from DB via server actions.
   - **Client Components**: Handle user interactions (forms, buttons) and call server actions.
   - `/admin/usage`: Server-only aggregations with URL-backed client controls; no public analytics endpoint.
3. **Database**:
   - **PostgreSQL/MySQL/MariaDB**: Stores Users, API Keys, Movies, TV Shows, Sync Logs, and raw TMDB mirror cache entries.
- **Prisma**: ORM for type-safe database access via provider-aware adapter selection.
- **Migrations**: The checked-in Prisma migrations are PostgreSQL-specific. MySQL/MariaDB installs currently use `prisma db push` unless a separate provider-specific migration history is created.

## Key Design Patterns
- **"Use Server" for Actions**: All data mutations and sensitive API calls happen on the server.
- **Lazy Sync**: API routes check DB first. If not found, fetch from TMDB, cache, and return.
- **TMDB Mirror Cache**: `/api/v1/tmdb/[...path]` mirrors public TMDB content GET endpoints and caches successful raw JSON responses in `TmdbCache`.
- **TMDB Media Cache**: `/media/t/p/{size}/{path}` lazily stores image CDN responses in `data/media`; the mirrored `/configuration` response substitutes only its existing image base URL values, leaving all content payload structures and relative paths unchanged. The process tracks bytes added after an initial bounded scan, trims with 16 stat workers to a 90% low-water mark, and suppresses repeated scans for five minutes unless usage exceeds 110% of the configured limit.
- **Cache Capacity**: Disposable rows across `TmdbCache` (excluding `/search/manual` and `/search/captured`), `Movie`, and `TvShow` are capped by `TMDB_CACHE_MAX_ROWS` (default 100,000). Writes schedule a process-local single-flight maintainer at most once per minute; it counts sequentially and evicts the oldest raw responses first, then the oldest normalized rows, in 1,000-row batches with controlled follow-up runs.
- **Cache Clearing**: The authenticated Sync-page action serializes concurrent clear requests and removes disposable raw/movie/TV cache data in sequential 1,000-row batches for lean backups while preserving manual mappings, search captures, accounts, API keys, request logs, and sync history.
- **Separate Media Storage**: Database rows store TMDB image path strings, while requested posters, backdrops, profiles, logos, and still images are cached independently under `data/media`; database-cache cleanup does not remove disk media files.
- **Usage Aggregate Cache**: Heavy `/admin/usage` metric/chart queries use a three-key (`24h`, `7d`, `30d`) process-local single-flight cache with one-minute freshness and stale-while-refresh behavior. The protected admin layout warms `24h` after sending a response; live log rows, pagination, filters, and blocked-IP state bypass the aggregate cache.
- **Manual Search Mapping**: Empty cached title searches are surfaced to admins; mappings reuse `TmdbCache` under `/search/manual` and are applied at response time without changing the raw upstream cache entry.
- **Search Capture Markers**: Unresolved searches reuse `TmdbCache` under `/search/captured`; dismissed markers suppress known no-match queries while leaving raw upstream cache entries intact.
- **Rate Limiting**: In-memory sliding-window abuse guard (120 req/min per client IP); API keys have no individual request limits.
- **Trusted Rate-Limit Bypass**: Comma-separated exact IPs can bypass the local per-IP limit; API authentication and blocked-IP enforcement still run. Local and upstream 429 responses are distinguished by `x-ratelimit-source`.
- **Request Logging**: `proxy.ts` logs proxy-generated failures and shared route wrappers log final handler responses through Next.js `after()` so analytics does not delay responses.
- **Rate-Limit Attribution**: Request logs persist `tmdb` versus `tmdb-service`; lazy movie/TV cache misses preserve upstream TMDB 429 responses and retry timing instead of converting them to generic 502 responses.
- **Usage Retention**: Exact request logs are retained for 30 days and pruned once daily from the background write path; admins can also clear the table manually through a confirmed provider-native truncate action.
- **Large-Log Analytics**: Current totals reuse hourly status/cache groupings, while P95 latency is calculated from the latest 5,000 requests in each comparison window instead of sorting the full range.
- **API Key Auth**: Middleware validates `x-api-key` against the database. Keys have no per-key request limit; middleware retains a 120 requests-per-minute per-IP abuse guard.
- **next-auth Auth**: Credentials Provider for admin login with bcrypt password hashing.
- **Type Safety**: Zod schemas for forms, TypeScript for all logic.
- **Tailwind + Shadcn/UI**: Consistent, accessible design system.

## Authentication Pattern
- **Admin Auth**: next-auth Credentials Provider with username/password.
- **Session Management**: JWT-based sessions via next-auth.
- **Route Protection**: `proxy.ts` checks for `next-auth.session-token` cookie on `/admin/*`. Redirects to `/login` if missing.
- **Login Page**: Client component using React Hook Form + Zod. Calls `signIn('credentials')` from next-auth.
- **Logout**: `signOut()` from next-auth in the admin sidebar.

## API Pattern
- **Key Validation**: Middleware checks `x-api-key` header against `ApiKey` table.
- **Rate Limiting**: Per-IP in-memory Map with sliding-window cleanup.
- **Lazy Sync**: If data not in DB, fetch from TMDB, upsert to DB, log sync, return data.
- **Raw Mirror Cache**: If a TMDB mirror response is cached, return it unchanged; otherwise fetch TMDB, cache successful JSON, and return it.
- **Pagination**: All list endpoints support `page`, `limit`, and `q` query params.
- **Usage Identity**: Active clients are distinct authenticated API-key/IP pairs seen during the last five minutes.
- **Proxy Metadata**: IP/country analytics trust forwarded headers only after nginx/CDN overwrites them at the deployment boundary.

## Data Model
**`User` Model**: Admin users with hashed passwords.
**`ApiKey` Model**: API keys linked to users with active/inactive status.
**`Movie` Model**: Cached movie data from TMDB (tmdbId, title, overview, poster, ratings, genres, etc.).
**`TvShow` Model**: Cached TV show data from TMDB (tmdbId, name, overview, poster, ratings, seasons, etc.).
**`SyncLog` Model**: Log of sync operations (type, status, detail, timestamp).
**`TmdbCache` Model**: Raw TMDB mirror response cache keyed by path and sorted query.
**`ApiRequestLog` Model**: Request method/path, redacted query, status, latency, IP/country, cache status, UTC hour bucket, timestamp, and optional API-key relation plus immutable label/prefix snapshot.
