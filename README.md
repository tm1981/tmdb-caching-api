# TMDB Data Caching Service

A Next.js 16 service that caches TMDB movie and TV show data in PostgreSQL, providing a fast local API with lazy sync and admin dashboard.

## Tech Stack

- **Next.js 16** with App Router
- **PostgreSQL** for data storage
- **Prisma 7** as ORM
- **next-auth v4** for admin authentication
- **shadcn/ui** + Tailwind CSS 4 for admin UI

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- TMDB API key from [themoviedb.org](https://www.themoviedb.org/settings/api)

## Setup

### 1. Clone and install dependencies

```bash
cd tmdb-service
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```env
DATABASE_URL=postgresql://user:password@host:5432/tmdb_service
TMDB_API_KEY=your_tmdb_api_key_here
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
```

### 3. Set up the database

```bash
# Apply existing migrations
npx prisma migrate dev

# Seed with admin user and default API key
npx prisma db seed
```

### 4. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Login to admin dashboard

Go to `http://localhost:3000/login` and use the admin credentials you set in `.env`.

## Admin Dashboard

After login, the admin dashboard provides:

- **Movies** - Browse, search, and manage cached movies
- **TV Shows** - Browse, search, and manage cached TV shows
- **Sync** - Trigger bulk syncs (trending movies/TV, top rated)
- **API Keys** - Create, manage, and revoke API keys

## API Endpoints

All API endpoints require the `x-api-key` header. Rate limit: 60 requests per minute per key.

For TMDB-compatible content mirroring, use `/api/v1/tmdb/{tmdb_path}`. It forwards public TMDB content GET endpoints, caches successful JSON responses, and keeps TMDB's response shape. See [docs/api.md](docs/api.md).

### Movies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/movies` | List all movies with pagination |
| `GET` | `/api/v1/movies/:id` | Get movie details by TMDB ID (lazy syncs if missing) |

**Query parameters for `/api/v1/movies`:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |
| `q` | string | - | Search by title |

### TV Shows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tv` | List all TV shows with pagination |
| `GET` | `/api/v1/tv/:id` | Get TV show details by TMDB ID (lazy syncs if missing) |

**Query parameters for `/api/v1/tv`:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |
| `q` | string | - | Search by name |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/search?q=term` | Search both movies and TV shows |

## Example Requests

```bash
# Get movies list
curl -H "x-api-key: your_api_key" http://localhost:3000/api/v1/movies

# Get movie by TMDB ID (lazy syncs if not cached)
curl -H "x-api-key: your_api_key" http://localhost:3000/api/v1/movies/278

# Search movies and TV shows
curl -H "x-api-key: your_api_key" "http://localhost:3000/api/v1/search?q=matrix"

# Paginate with search
curl -H "x-api-key: your_api_key" "http://localhost:3000/api/v1/movies?page=2&limit=10&q=action"
```

## Response Format

### List endpoints return:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Detail endpoints return TMDB-compatible JSON:
```json
{
  "id": 278,
  "title": "The Shawshank Redemption",
  "overview": "...",
  "poster_path": "/...",
  "backdrop_path": "/...",
  "credits": { "cast": [], "crew": [] },
  "videos": { "results": [] }
}
```

### Search endpoint returns:
```json
{
  "data": {
    "movies": [...],
    "tvShows": [...]
  }
}
```

## Production Build

```bash
npm run build
npm start
```

The app is configured for standalone output. The build output is in `.next/standalone/`.

## Lazy Sync

When a client requests a movie or TV show by TMDB ID that isn't in the local database, the service automatically fetches it from TMDB, stores it, and returns it. This eliminates the need for pre-populating the database.
