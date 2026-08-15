# Active Context

## Current Focus
Project caps disposable TMDB database cache data at 100,000 rows by default across raw mirror responses, movies, and TV shows. Limit enforcement is a process-local single-flight background maintainer with sequential 1,000-row eviction batches. The independent `data/media` cache tracks growth, uses bounded file-stat concurrency, and trims to a 90% low-water mark. Usage-dashboard aggregates are warmed after authenticated admin renders and use a one-minute stale-while-refresh cache, while the request list remains live. Deployment uses normal `next start` behind PM2/nginx.

## Recent Changes
- **Project Creation**: Built complete TMDB Service from scratch with Next.js 16, Prisma, next-auth, and shadcn/ui.
- **Authentication**: Implemented next-auth Credentials Provider with username/password, bcrypt hashing, and middleware route protection.
- **API Routes**: Built public API with movies, TV shows, and search endpoints. Added lazy-sync, pagination, API key validation without per-key throttling, and a 120 req/min per-IP abuse guard.
- **TMDB Mirror**: Added `/api/v1/tmdb/[...path]` raw content mirror with DB caching and public-content allowlist.
- **Search**: Public search now combines local cache results with cached TMDB multi-search. Admin movie/TV search always shows extra TMDB results.
- **Search Fixes**: Empty movie/TV searches create durable markers with approximate frequency and first/last-seen statistics. Admins can preview and select cached TMDB movie/TV candidates, dismiss no-match captures, view dismissed items separately, and restore them later.
- **Admin Dashboard**: Added people search/detail pages, raw TMDB JSON viewer, refresh-from-TMDB controls, cache age display, cache stats, and warmup controls.
- **TMDB Integration**: Implemented TMDB API client with search, details, trending, top-rated, raw mirror requests, lazy-sync, manual sync, and mirror warmups.
- **Database**: Defined Prisma schema with User, ApiKey, Movie, TvShow, SyncLog, and TmdbCache models.
- **Multi-DB Startup**: `proxy.ts` now uses the shared provider-aware Prisma adapter, and docs/env examples default to MySQL install.
- **Cleanup**: Removed stale tracked `app/generated/prisma` output, ignored future `app/generated/`, and unignored `prisma/migrations/`.
- **Usage Logging**: Added `ApiRequestLog`, API-key snapshots, query redaction, cache state, IP/country metadata, UTC buckets, and once-daily 30-day pruning through `after()`.
- **Usage Dashboard**: Added `/admin/usage` with 24h/7d/30d comparisons, active clients, success/cache rates, request charts, endpoints, countries, statuses, keys, P95 latency, source-aware TMDB/app rate-limit reporting, filters, and pagination.
- **Large Log Performance**: Current status/cache totals reuse hourly groupings, and P95 latency uses the latest 5,000 rows per comparison window instead of sorting the full range.
- **Manual Log Cleanup**: Added a confirmed admin-only **Clear logs** action using native PostgreSQL/MySQL/MariaDB table truncation.
- **GeoIP Fallback**: Missing proxy country headers fall back to a watched local GeoLite2 Country MMDB; the admin-only Usage page can freshness-check, download, validate, and replace it.
- **Media Cache**: `/media/t/p/{size}/{path}` validates and lazily caches TMDB images in `data/media`; `/api/v1/tmdb/configuration` advertises the local base URL using its existing fields. Cache size limits and oldest-file eviction prevent unbounded disk use.
- **Concurrent Cache Writes**: Shared `TmdbCache` writes retry a Prisma `P2002` insert race as an update, preventing simultaneous cache misses across PM2 workers from returning 500 errors.
- **Trusted Rate-Limit Bypass**: Exact IPs in `RATE_LIMIT_BYPASS_IPS` skip both local limit layers while retaining authentication and blocking; 429 responses identify `tmdb-service` versus upstream `tmdb` and include `Retry-After`.
- **Responsive Admin Shell**: Added the teal selected navigation state, compact mobile menu, horizontally safe charts, and expandable mobile request rows.
- **Cache Capacity**: Added `TMDB_CACHE_MAX_ROWS` (default 100,000) across disposable `TmdbCache`, `Movie`, and `TvShow` rows; writes schedule one non-blocking, process-local cleanup at a time, with sequential counts and 1,000-row eviction batches.
- **Backup-Friendly Cache Clear**: Added a confirmed admin action under **Sync** that clears raw TMDB responses and normalized movie/TV rows while preserving manual mappings, captured/dismissed Search Fixes, and non-cache application data.
- **Media Storage Separation**: TMDB image paths are stored in database JSON/columns, while image files are cached independently on disk under `data/media`; clearing database cache rows does not clear the bounded media cache.
- **Media Trim Performance**: Replaced per-miss unbounded `Promise.all(stat)` scans with tracked cache bytes, 16-worker filesystem scans, a five-minute trim guard, a 10% emergency overage, and a 90% low-water target.
- **Usage Dashboard Performance**: Expensive 24-hour aggregates warm after authenticated admin responses; all range aggregates are single-flight, fresh for one minute, and served stale during background refresh. Logs and filters still query current data, and clearing logs invalidates cached metrics.

## Next Steps
- Optional: add scheduled refresh using TMDB daily ID exports and changes endpoints.
- Optional: generate OpenAPI docs if interactive API docs are needed.
- Configure nginx/CDN to overwrite forwarded IP and country headers at the trusted boundary.
- Configure MaxMind credentials and update GeoLite2 from Admin > Usage & Logs when local country fallback is required.
- PostgreSQL can use checked-in migrations with `npx prisma migrate deploy`; current MySQL/MariaDB installs use `npx prisma db push` unless a separate MySQL/MariaDB migration history is created.
- No migration is required for the cache-cap feature because it does not change either Prisma schema.
