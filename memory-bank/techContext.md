# Tech Context

## Core Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL, MySQL, or MariaDB (Prisma ORM with provider-aware adapter)
- **Styling**: Tailwind CSS 4
- **UI Library**: Shadcn/UI (Radix Primitives)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Authentication**: next-auth v4 (Credentials Provider)
- **Background Work**: Next.js `after()` for non-blocking request analytics and retention cleanup

## Development Environment
- **Runtime**: Node.js
- **Package Manager**: npm
- **Linting**: ESLint
- **Build**: `npm run build` generates the provider-selected Prisma Client before running `next build`.

## Key Libraries
- `@prisma/client`, `@prisma/adapter-pg`, `@prisma/adapter-mariadb`, `mariadb`: Database access for PostgreSQL, MySQL, and MariaDB.
- `next-auth`: Authentication with Credentials Provider (username/password).
- `bcryptjs`: Password hashing for admin users.
- `sonner`: Toast notifications.
- `react-hook-form`: Form state management.
- `zod`: Schema validation.
- `@maxmind/geoip2-node`: Local GeoLite2 Country lookup when trusted proxy country metadata is absent.

## External Services
- **TMDB API**: Source of movie/TV data. Requires `TMDB_API_KEY` env var.
- **MaxMind GeoLite2**: Optional local IP-country database. Updates require `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY`.

## Configuration
- `.env`: Contains database, TMDB, authentication, and optional MaxMind GeoLite2 configuration.
- `prisma/schema.prisma` / `prisma/schema.mysql.prisma`: Defines the provider-specific database schema.
- `prisma/migrations/`: Tracked PostgreSQL migration history for production deploys.
- `next.config.ts`: Next.js configuration for normal `next start` self-hosting.
- `proxy.ts`: Protects `/admin/*` routes and validates API keys on `/api/v1/*` routes.
- Reverse proxy/CDN: Must overwrite `x-forwarded-for`/`x-real-ip` and supported ISO country headers before requests reach the app.
