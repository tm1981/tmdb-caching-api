# Tech Context

## Core Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL (Prisma ORM with PrismaPg adapter)
- **Styling**: Tailwind CSS 4
- **UI Library**: Shadcn/UI (Radix Primitives)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Authentication**: next-auth v4 (Credentials Provider)

## Development Environment
- **Runtime**: Node.js
- **Package Manager**: npm
- **Linting**: ESLint

## Key Libraries
- `@prisma/client` & `@prisma/adapter-pg`: Database access with PrismaPg adapter for PostgreSQL.
- `next-auth`: Authentication with Credentials Provider (username/password).
- `bcryptjs`: Password hashing for admin users.
- `sonner`: Toast notifications.
- `react-hook-form`: Form state management.
- `zod`: Schema validation.

## External Services
- **TMDB API**: Source of movie/TV data. Requires `TMDB_API_KEY` env var.

## Configuration
- `.env`: Contains `DATABASE_URL`, `TMDB_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- `prisma/schema.prisma`: Defines the database schema (User, ApiKey, Movie, TvShow, SyncLog).
- `next.config.ts`: Next.js configuration with standalone output.
- `proxy.ts`: Protects `/admin/*` routes and validates API keys on `/api/v1/*` routes.
