const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
// Keeps OFFSET (page * limit) well inside safe integers and away from pathological table scans.
export const MAX_PAGE = 10_000
// TMDB rejects search pages above 500.
export const MAX_TMDB_PAGE = 500

function toPositiveInt(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function pageOutOfRangeResponse(max: number) {
  return Response.json({ error: `page must be between 1 and ${max}` }, { status: 400 })
}

export function paginationParams(page?: string | number, limit?: string | number) {
  const safePage = toPositiveInt(page, DEFAULT_PAGE)
  const safeLimit = Math.min(toPositiveInt(limit, DEFAULT_LIMIT), MAX_LIMIT)

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  }
}
