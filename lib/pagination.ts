const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function toPositiveInt(value: string | number | undefined, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
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
