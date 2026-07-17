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
- `app/admin/search/page.tsx`: Captured empty searches and manual query-to-TMDB-ID mapping controls.
- `app/admin/tmdb/[...path]/page.tsx`: Raw TMDB JSON viewer backed by the mirror cache.
- `app/admin/keys/page.tsx`: API key management with create, copy, toggle, delete actions.
- `app/admin/sync/page.tsx`: Manual bulk sync buttons and sync logs table.
- `app/admin/usage/page.tsx`: Admin-only usage and request-log dashboard.
- `components/admin/admin-navigation.tsx`: Responsive desktop sidebar and mobile admin menu.
- `components/admin/usage-dashboard.tsx`: Metrics, inline SVG charts, analytics panels, request table, and mobile details.
- `components/admin/usage-controls.tsx`: URL-backed range, search, status, country, refresh, and mobile filter controls.
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
- `lib/search-mappings.ts`: Query normalization, mapping validation, and mapped-result insertion helpers.
- `lib/ratelimit.ts`: In-memory rate limiter with sliding window cleanup.
- `lib/api-usage.ts`: Shared `after()` request logging, API-key snapshots, and retention cleanup.
- `lib/geoip.ts`: Lazy watched GeoLite2 Country reader used when proxy country metadata is absent.
- `lib/usage-dashboard.ts`: Prisma aggregations, comparisons, filters, P95 latency, and pagination.
- `lib/usage.ts`: Usage types, UTC buckets, redaction, forwarded metadata parsing, percentages, and chart helpers.
- `lib/usage.test.mjs`: Node assertion checks for usage helpers and empty-data behavior.
- `lib/utils.ts`: Utility functions (cn, formatDate, formatRating).

## Operations
- `scripts/update-geoip.mjs`: Server-only updater used by the authenticated admin action to freshness-check, validate, and replace GeoLite2 Country data.

## Database
- `prisma/schema.prisma`: PostgreSQL schema including `ApiRequestLog`.
- `prisma/schema.mysql.prisma`: Schema definition for MySQL/MariaDB database with the same models.
- `prisma/migrations/`: Tracked PostgreSQL Prisma migrations for production `npx prisma migrate deploy`.
- `prisma/migrations/20260714120000_add_api_request_logs/migration.sql`: PostgreSQL request-log migration.
- `prisma/seed.ts`: Seed script to create admin user and default API key.

## Proxy
- `proxy.ts`: Protects `/admin/*` routes (session cookie check) and validates API keys on `/api/v1/*` routes.
