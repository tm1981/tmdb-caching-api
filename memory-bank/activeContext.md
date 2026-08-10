# Active Context

## Current Focus
Project now includes a public, disk-backed lazy TMDB image cache advertised through the existing mirrored `/configuration` response without changing movie, TV, search, or raw response structures. The admin-only usage dashboard and non-blocking logging cover every `/api/v1` attempt. Build and lint pass. Deployment uses normal `next start` behind PM2/nginx.

## Recent Changes
- **Project Creation**: Built complete TMDB Service from scratch with Next.js 16, Prisma, next-auth, and shadcn/ui.
- **Authentication**: Implemented next-auth Credentials Provider with username/password, bcrypt hashing, and middleware route protection.
- **API Routes**: Built public API with movies, TV shows, and search endpoints. Added lazy-sync, pagination, rate limiting, and API key validation.
- **TMDB Mirror**: Added `/api/v1/tmdb/[...path]` raw content mirror with DB caching and public-content allowlist.
- **Search**: Public search now combines local cache results with cached TMDB multi-search. Admin movie/TV search always shows extra TMDB results.
- **Search Fixes**: Empty cached movie/TV searches are surfaced at `/admin/search`; admins can map provider text to a validated TMDB ID, and mappings apply to normalized and raw mirror search routes.
- **Admin Dashboard**: Added people search/detail pages, raw TMDB JSON viewer, refresh-from-TMDB controls, cache age display, cache stats, and warmup controls.
- **TMDB Integration**: Implemented TMDB API client with search, details, trending, top-rated, raw mirror requests, lazy-sync, manual sync, and mirror warmups.
- **Database**: Defined Prisma schema with User, ApiKey, Movie, TvShow, SyncLog, and TmdbCache models.
- **Multi-DB Startup**: `proxy.ts` now uses the shared provider-aware Prisma adapter, and docs/env examples default to MySQL install.
- **Cleanup**: Removed stale tracked `app/generated/prisma` output, ignored future `app/generated/`, and unignored `prisma/migrations/`.
- **Usage Logging**: Added `ApiRequestLog`, API-key snapshots, query redaction, cache state, IP/country metadata, UTC buckets, and once-daily 30-day pruning through `after()`.
- **Usage Dashboard**: Added `/admin/usage` with 24h/7d/30d comparisons, active clients, success/cache rates, request charts, endpoints, countries, statuses, keys, P95 latency, rate limits, filters, and pagination.
- **Large Log Performance**: Current status/cache totals reuse hourly groupings, and P95 latency uses the latest 5,000 rows per comparison window instead of sorting the full range.
- **Manual Log Cleanup**: Added a confirmed admin-only **Clear logs** action using native PostgreSQL/MySQL/MariaDB table truncation.
- **GeoIP Fallback**: Missing proxy country headers fall back to a watched local GeoLite2 Country MMDB; the admin-only Usage page can freshness-check, download, validate, and replace it.
- **Media Cache**: `/media/t/p/{size}/{path}` validates and lazily caches TMDB images in `data/media`; `/api/v1/tmdb/configuration` advertises the local base URL using its existing fields. Cache size limits and oldest-file eviction prevent unbounded disk use.
- **Concurrent Cache Writes**: Shared `TmdbCache` writes retry a Prisma `P2002` insert race as an update, preventing simultaneous cache misses across PM2 workers from returning 500 errors.
- **Responsive Admin Shell**: Added the teal selected navigation state, compact mobile menu, horizontally safe charts, and expandable mobile request rows.

## Next Steps
- Optional: add scheduled refresh using TMDB daily ID exports and changes endpoints.
- Optional: generate OpenAPI docs if interactive API docs are needed.
- Configure nginx/CDN to overwrite forwarded IP and country headers at the trusted boundary.
- Configure MaxMind credentials and update GeoLite2 from Admin > Usage & Logs when local country fallback is required.
- PostgreSQL can use checked-in migrations with `npx prisma migrate deploy`; current MySQL/MariaDB installs use `npx prisma db push` unless a separate MySQL/MariaDB migration history is created.
