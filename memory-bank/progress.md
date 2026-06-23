# Progress
 
## Completed Features
- [x] **Project Setup**: Next.js 16 initialized with TypeScript, Tailwind CSS 4, and App Router.
- [x] **Database**: Prisma schema defined with User, ApiKey, Movie, TvShow, SyncLog models.
- [x] **Raw TMDB Cache**: Prisma `TmdbCache` model stores mirrored TMDB content responses.
- [x] **Authentication**:
  - [x] next-auth Credentials Provider (username/password) with bcrypt.
  - [x] Login page with React Hook Form + Zod.
  - [x] Middleware route protection for `/admin/*`.
  - [x] Logout button in admin sidebar.
- [x] **API Routes**:
  - [x] Movies list with pagination and search.
  - [x] Movies by ID with lazy-sync.
  - [x] TV shows list with pagination and search.
  - [x] TV shows by ID with lazy-sync.
  - [x] Combined movie/TV search.
  - [x] TMDB-compatible raw content mirror at `/api/v1/tmdb/[...path]`.
  - [x] API key validation via middleware.
  - [x] Rate limiting (60 req/min per key).
- [x] **Admin Dashboard**:
  - [x] Movies table with search, pagination, posters, ratings.
  - [x] TV shows table with search, pagination, posters, ratings.
  - [x] Person detail pages linked from movie/TV cast and crew.
  - [x] People search page backed by TMDB mirror cache.
  - [x] Raw TMDB JSON viewer for admin debugging.
  - [x] Refresh-from-TMDB controls and cache age text on detail pages.
  - [x] Movie/TV admin search falls back to TMDB when local cache has no match.
  - [x] Public search combines local cache results with TMDB multi-search.
  - [x] API key management (create, copy, toggle, delete).
  - [x] Manual sync buttons (trending movies/TV, top-rated movies/TV).
  - [x] Sync logs table.
- [x] **TMDB Integration**:
  - [x] Search movies/TV shows.
  - [x] Get movie/TV details with credits.
  - [x] Trending movies/TV shows.
  - [x] Top-rated movies/TV shows.
  - [x] Lazy-sync on API requests.
  - [x] Manual bulk sync from admin dashboard.
  - [x] TMDB mirror cache stats and paginated warmup controls on the sync page.
- [x] **Deployment**:
  - [x] Standalone output configured in `next.config.ts`.
- [x] **Performance & Stability**:
  - [x] Fixed Prisma client singleton to prevent connection leaks in dev mode.
  - [x] Implemented chunked concurrency for TV season/episode fetching to respect TMDB rate limits.
 
## Known Issues
- None currently.
 
## Future Improvements
- **Automatic Sync**: Scheduled cron job for periodic data refresh.
- **OpenAPI Documentation**: Generate an OpenAPI spec from `docs/api.md` if interactive docs are needed.
- **Activity Logs**: Track API usage per key.
- **Bulk Delete**: Delete multiple movies/TV shows at once from admin.
