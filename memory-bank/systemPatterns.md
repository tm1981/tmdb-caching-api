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
2. **Admin Pages (`app/admin/`)**:
   - **Server Components**: Fetch data directly from DB via server actions.
   - **Client Components**: Handle user interactions (forms, buttons) and call server actions.
3. **Database**:
   - **PostgreSQL**: Stores Users, API Keys, Movies, TV Shows, and Sync Logs.
   - **Prisma**: ORM for type-safe database access via PrismaPg adapter.

## Key Design Patterns
- **"Use Server" for Actions**: All data mutations and sensitive API calls happen on the server.
- **Lazy Sync**: API routes check DB first. If not found, fetch from TMDB, cache, and return.
- **Rate Limiting**: In-memory sliding window (60 req/min per API key).
- **API Key Auth**: Middleware validates `x-api-key` header against DB.
- **next-auth Auth**: Credentials Provider for admin login with bcrypt password hashing.
- **Type Safety**: Zod schemas for forms, TypeScript for all logic.
- **Tailwind + Shadcn/UI**: Consistent, accessible design system.

## Authentication Pattern
- **Admin Auth**: next-auth Credentials Provider with username/password.
- **Session Management**: JWT-based sessions via next-auth.
- **Route Protection**: Middleware checks for `next-auth.session-token` cookie on `/admin/*`. Redirects to `/login` if missing.
- **Login Page**: Client component using React Hook Form + Zod. Calls `signIn('credentials')` from next-auth.
- **Logout**: `signOut()` from next-auth in the admin sidebar.

## API Pattern
- **Key Validation**: Middleware checks `x-api-key` header against `ApiKey` table.
- **Rate Limiting**: In-memory Map with sliding window cleanup.
- **Lazy Sync**: If data not in DB, fetch from TMDB, upsert to DB, log sync, return data.
- **Pagination**: All list endpoints support `page`, `limit`, and `q` query params.

## Data Model
**`User` Model**: Admin users with hashed passwords.
**`ApiKey` Model**: API keys linked to users with active/inactive status.
**`Movie` Model**: Cached movie data from TMDB (tmdbId, title, overview, poster, ratings, genres, etc.).
**`TvShow` Model**: Cached TV show data from TMDB (tmdbId, name, overview, poster, ratings, seasons, etc.).
**`SyncLog` Model**: Log of sync operations (type, status, detail, timestamp).