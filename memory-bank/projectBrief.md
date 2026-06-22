# Project Brief

TMDB Service is a web application and REST API designed to cache, serve, and manage movie and TV show data from The Movie Database (TMDB). It provides a public API for fetching data with lazy-sync capabilities, and an admin dashboard for managing the cached data.

## Core Features
- **Public API**: REST endpoints for movies, TV shows, and combined search with lazy-sync from TMDB.
- **Admin Dashboard**: Browse, search, and manage cached movie/TV data.
- **API Key Management**: Create, revoke, and manage API keys for accessing the service.
- **Manual Sync**: Bulk sync trending and top-rated content from TMDB.
- **Rate Limiting**: Per-key rate limiting (60 req/min) to protect the service.

## Goals
- Provide a fast, cached layer between consumers and the TMDB API.
- Reduce TMDB API calls by caching data locally with lazy-sync.
- Offer a manageable admin interface for monitoring and maintaining the data.
- Secure API access via API key authentication.