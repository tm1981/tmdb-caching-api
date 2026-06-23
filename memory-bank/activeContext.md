# Active Context

## Current Focus
Project now mirrors public TMDB content endpoints through a cached catch-all API and expanded admin dashboard. Build and lint pass.

## Recent Changes
- **Project Creation**: Built complete TMDB Service from scratch with Next.js 16, Prisma, next-auth, and shadcn/ui.
- **Authentication**: Implemented next-auth Credentials Provider with username/password, bcrypt hashing, and middleware route protection.
- **API Routes**: Built public API with movies, TV shows, and search endpoints. Added lazy-sync, pagination, rate limiting, and API key validation.
- **TMDB Mirror**: Added `/api/v1/tmdb/[...path]` raw content mirror with DB caching and public-content allowlist.
- **Search**: Public search now combines local cache results with cached TMDB multi-search. Admin movie/TV search always shows extra TMDB results.
- **Admin Dashboard**: Added people search/detail pages, raw TMDB JSON viewer, refresh-from-TMDB controls, cache age display, cache stats, and warmup controls.
- **TMDB Integration**: Implemented TMDB API client with search, details, trending, top-rated, raw mirror requests, lazy-sync, manual sync, and mirror warmups.
- **Database**: Defined Prisma schema with User, ApiKey, Movie, TvShow, SyncLog, and TmdbCache models.

## Next Steps
- Optional: add scheduled refresh using TMDB daily ID exports and changes endpoints.
- Optional: generate OpenAPI docs if interactive API docs are needed.
