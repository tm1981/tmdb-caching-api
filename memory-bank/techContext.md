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

## Key Libraries
- `@prisma/client`, `@prisma/adapter-pg`, `@prisma/adapter-mariadb`, `mariadb`: Database access for PostgreSQL, MySQL, and MariaDB.
- `next-auth`: Authentication with Credentials Provider (username/password).
- `bcryptjs`: Password hashing for admin users.
- `sonner`: Toast notifications.
- `react-hook-form`: Form state management.
- `zod`: Schema validation.

## External Services
- **TMDB API**: Source of movie/TV data. Requires `TMDB_API_KEY` env var.

## Configuration
- `.env`: Contains `DATABASE_PROVIDER`, `DATABASE_URL`, `TMDB_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- `prisma/schema.prisma` / `prisma/schema.mysql.prisma`: Defines the provider-specific database schema.
- `prisma/migrations/`: Tracked PostgreSQL migration history for production deploys.
- `next.config.ts`: Next.js configuration for normal `next start` self-hosting.
- `proxy.ts`: Protects `/admin/*` routes and validates API keys on `/api/v1/*` routes.
- Reverse proxy/CDN: Must overwrite `x-forwarded-for`/`x-real-ip` and supported ISO country headers before requests reach the app.
