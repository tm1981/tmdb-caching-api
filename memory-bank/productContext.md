# Product Context

## Problem Statement
Consumers of TMDB data need a fast, reliable way to fetch movie and TV show information without making repeated calls to the TMDB API. Additionally, managing and monitoring this cached data requires an admin interface.

## Solution
A decoupled caching system consisting of:
1. **Public API**: REST endpoints that serve cached TMDB data with lazy-sync. When data is requested but not found, it's fetched from TMDB, cached, and returned.
2. **Admin Dashboard**: A password-protected interface for browsing cached data, managing API keys, and triggering manual syncs.

## User Experience
- **Landing Page**: Redirects to `/login`.
- **Login Page**: Simple username/password form with next-auth Credentials Provider.
- **Admin Dashboard**:
  - **Movies**: Searchable table of cached movies with posters, ratings, and TMDB IDs.
  - **TV Shows**: Searchable table of cached TV shows with posters, ratings, and TMDB IDs.
  - **API Keys**: Create, copy, toggle, and delete API keys for accessing the service.
  - **Sync**: Manual bulk sync buttons for trending/top-rated content with sync logs.
- **Public API**: JSON responses with pagination, lazy-sync, and rate limiting.

## Constraints
- **API Key Required**: All public API endpoints require an `x-api-key` header.
- **Rate Limiting**: 60 requests per minute per API key.
- **TMDB API Limits**: Outbound calls to TMDB are subject to their rate limits.
- **Lazy Sync**: When data isn't cached, the service fetches from TMDB, caches it, and returns it (may be slower on first request).
- **Admin Authentication**: next-auth Credentials Provider with bcrypt password hashing.