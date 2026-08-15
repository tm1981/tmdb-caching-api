# Progress
 
## Completed Features
- [x] **Project Setup**: Next.js 16 initialized with TypeScript, Tailwind CSS 4, and App Router.
- [x] **Database**: Prisma schemas defined for PostgreSQL and MySQL/MariaDB with User, ApiKey, Movie, TvShow, SyncLog models.
- [x] **API Request Logs**: `ApiRequestLog` model and PostgreSQL migration with API-key snapshots and activity/time indexes.
- [x] **Raw TMDB Cache**: Prisma `TmdbCache` model stores mirrored TMDB content responses.
- [x] **TMDB Media Cache**: Public lazy image proxy stores validated TMDB images on disk with atomic writes, request coalescing, size limits, and compatibility-preserving `/configuration` discovery.
- [x] **Concurrent TMDB Cache Writes**: All `TmdbCache` upserts recover from the insert-side `P2002` race by retrying the intended update.
- [x] **Rate-Limit Source Contract**: Trusted server IP allowlist plus machine-readable local/upstream 429 source and retry headers.
- [x] **Authentication**:
  - [x] next-auth Credentials Provider (username/password) with bcrypt.
  - [x] Login page with React Hook Form + Zod.
  - [x] Middleware route protection for `/admin/*`.
  - [x] Logout button in admin sidebar.
- [x] **API Routes**:
  - [x] Movies list with pagination and search.
  - [x] Movies by ID with lazy-sync.
  - [x] TV shows list with pagination and search.
  - [x] TV shows by ID with lazy-sync.
  - [x] Combined movie/TV search.
  - [x] TMDB-compatible raw content mirror at `/api/v1/tmdb/[...path]`.
  - [x] API key validation via middleware.
  - [x] Rate limiting (60 req/min per key).
- [x] **Admin Dashboard**:
  - [x] Movies table with search, pagination, posters, ratings.
  - [x] TV shows table with search, pagination, posters, ratings.
  - [x] Person detail pages linked from movie/TV cast and crew.
  - [x] People search page backed by TMDB mirror cache.
  - [x] Raw TMDB JSON viewer for admin debugging.
  - [x] Refresh-from-TMDB controls and cache age text on detail pages.
  - [x] Movie/TV admin search falls back to TMDB when local cache has no match.
  - [x] Public search combines local cache results with TMDB multi-search.
  - [x] Search Fixes uses durable markers with occurrence statistics, a cached TMDB result picker, dismiss/restore workflow, and validated manual mappings.
  - [x] API key management (create, copy, toggle, delete).
  - [x] Usage & Logs dashboard with range comparisons, analytics panels, URL filters, pagination, refresh, responsive request details, and confirmed manual log clearing.
  - [x] Manual sync buttons (trending movies/TV, top-rated movies/TV).
  - [x] Sync logs table.
- [x] **TMDB Integration**:
  - [x] Search movies/TV shows.
  - [x] Get movie/TV details with credits.
  - [x] Trending movies/TV shows.
  - [x] Top-rated movies/TV shows.
  - [x] Lazy-sync on API requests.
  - [x] Manual bulk sync from admin dashboard.
  - [x] TMDB mirror cache stats and paginated warmup controls on the sync page.
  - [x] Combined cache-cap stats and confirmed database-cache clearing on the sync page.
- [x] **Deployment**:
  - [x] Normal `next start` deployment configured for PM2/nginx.
  - [x] PostgreSQL migrations are tracked; MySQL/MariaDB deployment uses `prisma db push` unless a separate provider-specific migration history is created.
- [x] **Performance & Stability**:
  - [x] Fixed Prisma client singleton to prevent connection leaks in dev mode.
  - [x] Fixed MySQL startup by removing the hardcoded PostgreSQL adapter from `proxy.ts`.
  - [x] Implemented chunked concurrency for TV season/episode fetching to respect TMDB rate limits.
  - [x] Removed stale tracked `app/generated/prisma` output.
  - [x] Non-blocking `/api/v1` logging with sensitive-query redaction and once-daily 30-day retention pruning.
  - [x] Standardized known `x-tmdb-cache` values to `hit`, `miss`, or `bypass`.
  - [x] Reduced large-log dashboard work by reusing hourly status/cache groupings and sampling the newest 5,000 latency rows for P95.
  - [x] Capped disposable raw/movie/TV cache rows at 100,000 by default with oldest-first eviction and preserved Search Fixes state; enforcement is throttled, single-flight, non-blocking, sequential, and batched to protect the MySQL pool.
  - [x] Documented that TMDB media files are separate from the database and live in the bounded `data/media` disk cache.
  - [x] Prevented media-cache saturation from monopolizing Node CPU and memory by replacing per-miss 80K-file promise floods with tracked size, bounded scans, trim hysteresis, and an emergency overage guard.
 
## Known Issues
- None currently.
 
## Future Improvements
- **Automatic Sync**: Scheduled cron job for periodic data refresh.
- **OpenAPI Documentation**: Generate an OpenAPI spec from `docs/api.md` if interactive docs are needed.
- **Bulk Delete**: Delete multiple movies/TV shows at once from admin.
