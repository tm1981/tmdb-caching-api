# TMDB Mirror API

This service exposes two API styles:

- **Normalized local endpoints** for the admin-friendly cached movie/TV tables.
- **TMDB mirror endpoints** for public TMDB content routes, cached by exact path and query.

All public endpoints require:

```http
x-api-key: your_api_key
```

The service rate-limits each API key to 60 requests per minute.

## TMDB Mirror

Use:

```http
GET /api/v1/tmdb/{tmdb_path}
```

This maps directly to:

```http
GET https://api.themoviedb.org/3/{tmdb_path}
```

Examples:

```bash
curl -H "x-api-key: your_api_key" \
  "http://localhost:3000/api/v1/tmdb/movie/278?append_to_response=credits,videos,images,release_dates"

curl -H "x-api-key: your_api_key" \
  "http://localhost:3000/api/v1/tmdb/search/multi?query=matrix&page=1"

curl -H "x-api-key: your_api_key" \
  "http://localhost:3000/api/v1/tmdb/tv/1399/season/1/episode/1?append_to_response=credits,images,videos"
```

Responses keep TMDB's JSON shape. Cache status is returned in:

```http
x-tmdb-cache: hit | miss | bypass
```

The normalized movie, TV, and search endpoints use the same values whenever cache state is known. `bypass` means the request did not use a reusable cache result.

Use `refresh=true` to bypass the local cache and replace it on a successful TMDB response:

```http
GET /api/v1/tmdb/movie/278?append_to_response=credits,videos&refresh=true
```

`refresh` is not forwarded to TMDB and is not part of the cache key.

## Cached Content Paths

The mirror accepts public content GET endpoints under these TMDB namespaces:

- `/movie/*`
- `/tv/*`
- `/person/*`
- `/collection/*`
- `/company/*`
- `/network/*`
- `/keyword/*`
- `/search/movie`, `/search/tv`, `/search/person`, `/search/multi`, `/search/collection`, `/search/company`, `/search/keyword`
- `/discover/movie`, `/discover/tv`
- `/trending/all/*`, `/trending/movie/*`, `/trending/tv/*`, `/trending/person/*`
- `/genre/*`
- `/certification/*`
- `/watch/providers/*`
- `/configuration/*`
- `/find/*`

That covers movie details, TV details, seasons, episodes, credits, images, videos, external IDs, watch providers, recommendations, reviews, similar content, translations, release dates, content ratings, discover, search, trending, people, collections, companies, networks, keywords, genres, certifications, and TMDB configuration/reference data.

## Skipped Paths

User-specific or mutation endpoints are intentionally not mirrored:

- `/account/*`
- `/authentication/*`
- `/guest_session/*`
- `/list/*`
- rating/favorite/watchlist/session flows

These require TMDB user/session state and do not fit a shared content cache.

## Normalized Local Endpoints

These endpoints use the local `Movie` and `TvShow` tables:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/v1/movies` | Cached movie list with `page`, `limit`, and `q` |
| `GET` | `/api/v1/movies/:id` | Cached movie details by TMDB ID, lazy-syncs if missing |
| `GET` | `/api/v1/tv` | Cached TV list with `page`, `limit`, and `q` |
| `GET` | `/api/v1/tv/:id` | Cached TV details by TMDB ID, lazy-syncs if missing |
| `GET` | `/api/v1/search?q=term` | Local cached movie/TV search |

For broad TMDB compatibility, prefer `/api/v1/tmdb/*`.

`/api/v1/search` also queries TMDB `/search/multi` through the mirror cache. The response keeps the legacy local buckets and adds `data.tmdb`:

```json
{
  "data": {
    "movies": [{ "source": "local" }],
    "tvShows": [{ "source": "local" }],
    "tmdb": {
      "cache": "hit",
      "movies": [{ "source": "tmdb" }],
      "tvShows": [{ "source": "tmdb" }],
      "people": [{ "source": "tmdb" }]
    }
  }
}
```

## Database

Mirrored TMDB responses are stored in `TmdbCache`:

- `cacheKey`: TMDB path plus sorted query string.
- `path`: TMDB path.
- `query`: sorted query string.
- `payload`: raw TMDB JSON.
- `status`: upstream status, cached only for successful responses.
- `createdAt`, `updatedAt`: cache timestamps.

After adding this model to an existing database, use the deployment path for your database provider.

PostgreSQL with the checked-in migration history:

```bash
DATABASE_PROVIDER=postgresql npx prisma migrate deploy
```

MySQL/MariaDB with the current schema-based install:

```bash
DATABASE_PROVIDER=mysql npx prisma db push
```

The checked-in migrations are PostgreSQL-specific. Do not run them against MySQL/MariaDB.

## Admin Usage & Logs

`/admin/usage` is available only to authenticated administrators. It shows request volume, distinct API-key/IP clients active in the last five minutes, success and cache hit rates, latency, rate limits, endpoints, countries, API keys, and a filterable request log.

All `/api/v1` attempts are recorded, including authentication failures, rate limits, application errors, and successful responses. Raw API keys are never stored; sensitive query values are redacted. Exact IP addresses and logs are retained for 30 days and pruned from the background logging path.

IP and ISO country values are read from forwarded headers. Configure nginx or your CDN to overwrite those headers at the trusted boundary rather than accepting client-provided values. If the proxy supplies no country code, `@maxmind/geoip2-node` checks the local GeoLite2 Country database in the background logging path. Administrators update and validate that database from the Usage & Logs page.

## Admin Sync Page

`/admin/sync` includes TMDB mirror cache controls:

- Cache stats: total cached responses, last cache write, and recent top root paths.
- Core Metadata warmup: configuration, genres, watch provider regions, and watch provider lists.
- Trending warmup: all, movie, TV, and person trending day lists for the selected page count.
- Popular Lists warmup: popular and top-rated movie/TV lists for the selected page count.

Warmups write to `TmdbCache` and add a `tmdb-cache` sync log row.

## Admin Person Pages

Movie and TV detail pages link cast and crew members to:

```http
/admin/people/{person_id}
```

The page uses the TMDB mirror cache for `/person/{id}?append_to_response=combined_credits,images,external_ids`, then renders biography, profile metadata, known-for credits, and profile images.

`/admin/people` searches TMDB people through the mirror cache and links results to `/admin/people/{person_id}`.

Movie, TV, and person detail pages include:

- Refresh From TMDB: re-fetches the current item and refreshes the page.
- View Raw TMDB: opens `/admin/tmdb/{tmdb_path}` with pretty-printed cached/upstream JSON.
- Cache age text for normalized rows and/or raw TMDB cache entries.

Movie and TV list searches fall back to TMDB search when no local rows match. Clicking a fallback result lazy-syncs the normalized detail page.
