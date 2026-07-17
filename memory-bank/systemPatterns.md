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
- **Manual Search Mapping**: Empty cached title searches are surfaced to admins; mappings reuse `TmdbCache` under `/search/manual` and are applied at response time without changing the raw upstream cache entry.
- **Rate Limiting**: In-memory sliding window (60 req/min per API key).
- **Request Logging**: `proxy.ts` logs proxy-generated failures and shared route wrappers log final handler responses through Next.js `after()` so analytics does not delay responses.
- **Usage Retention**: Exact request logs are retained for 30 days and pruned once daily from the background write path; no cron or permanent aggregate tables.
- **API Key Auth**: Middleware validates `x-api-key` header against DB.
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
- **Rate Limiting**: In-memory Map with sliding window cleanup.
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
