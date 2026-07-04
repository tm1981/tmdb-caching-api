# Project Files

This is a list of the core application files, excluding configuration files and external libraries.

## App Router
- `app/layout.tsx`: Root application layout with fonts and Toaster provider.
- `app/page.tsx`: Redirects to `/admin/movies` when a session cookie exists, otherwise `/login`.
- `app/globals.css`: Global CSS styles with Tailwind CSS 4 directives.
- `app/login/page.tsx`: Client component login page with React Hook Form + Zod. Calls next-auth `signIn('credentials')`.

## API Routes
- `app/api/auth/[...nextauth]/route.ts`: next-auth route handler with Credentials Provider (username/password, bcrypt).
- `app/api/v1/movies/route.ts`: GET paginated movie list with search.
- `app/api/v1/movies/[id]/route.ts`: GET movie by TMDB ID with lazy-sync from TMDB.
- `app/api/v1/tv/route.ts`: GET paginated TV show list with search.
- `app/api/v1/tv/[id]/route.ts`: GET TV show by TMDB ID with lazy-sync from TMDB.
- `app/api/v1/search/route.ts`: GET combined movie/TV search results.
- `app/api/v1/tmdb/[...path]/route.ts`: GET raw TMDB-compatible content mirror with DB cache.

## Admin Pages
- `app/admin/layout.tsx`: Admin layout with sidebar navigation and logout button.
- `app/admin/movies/page.tsx`: Searchable table of cached movies with posters, ratings, pagination.
- `app/admin/tv/page.tsx`: Searchable table of cached TV shows with posters, ratings, pagination.
- `app/admin/people/[id]/page.tsx`: Person detail page backed by the raw TMDB mirror cache.
- `app/admin/people/page.tsx`: TMDB-backed people search page.
- `app/admin/tmdb/[...path]/page.tsx`: Raw TMDB JSON viewer backed by the mirror cache.
- `app/admin/keys/page.tsx`: API key management with create, copy, toggle, delete actions.
- `app/admin/sync/page.tsx`: Manual bulk sync buttons and sync logs table.
- `components/admin/sync-buttons.tsx`: Client buttons for normalized syncs and TMDB mirror cache warmups.
- `components/admin/refresh-button.tsx`: Client refresh button for movie, TV, and person detail pages.
- `components/admin/back-button.tsx`: Client back button for person detail pages.

## Server Actions
- `app/actions/db.ts`: Server actions for all DB operations (CRUD for movies, TV, API keys, sync logs, sync operations).

## Components
- `components/ui/`: Standard Shadcn UI components (Button, Input, Table, Badge, Card, Dialog, etc.).
- `components/admin/key-form.tsx`: Client component for creating API keys with dialog.
- `components/admin/key-actions.tsx`: Client component for copy, toggle, delete actions on API keys.
- `components/admin/sync-buttons.tsx`: Client component for triggering sync operations with loading states.
- `components/admin/sign-out.tsx`: Client component for next-auth sign out.

## Lib & Utilities
- `lib/prisma.ts`: Singleton PrismaClient instance with provider-aware adapter.
- `lib/tmdb.ts`: TMDB API client with functions for search, details, trending, top-rated.
- `lib/ratelimit.ts`: In-memory rate limiter with sliding window cleanup.
- `lib/utils.ts`: Utility functions (cn, formatDate, formatRating).

## Database
- `prisma/schema.prisma`: Schema definition for PostgreSQL database (User, ApiKey, Movie, TvShow, SyncLog, TmdbCache).
- `prisma/schema.mysql.prisma`: Schema definition for MySQL/MariaDB database with the same models.
- `prisma/seed.ts`: Seed script to create admin user and default API key.

## Proxy
- `proxy.ts`: Protects `/admin/*` routes (session cookie check) and validates API keys on `/api/v1/*` routes.
