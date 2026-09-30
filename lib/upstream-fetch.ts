const RETRY_DELAY_MS = 250
// Resets and dropped sockets are usually one-off; timeouts and refusals are not worth repeating.
const RETRYABLE_CODES = new Set(['ECONNRESET', 'EPIPE', 'EAI_AGAIN', 'UND_ERR_SOCKET', 'UND_ERR_CLOSED'])
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'])

function errorCode(error: unknown) {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string') return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

export function isTimeoutError(error: unknown) {
  // AbortSignal.timeout() rejects with a DOMException named TimeoutError.
  return (error as { name?: unknown } | null)?.name === 'TimeoutError' || TIMEOUT_CODES.has(errorCode(error) || '')
}

// fetch() reports connection failures as TypeError('fetch failed') and body read
// failures as TypeError('terminated'), with the socket error as the cause.
export function isNetworkError(error: unknown) {
  return isTimeoutError(error)
    || (error instanceof TypeError && (error.message === 'fetch failed' || error.message === 'terminated'))
}

export function isRetryableNetworkError(error: unknown) {
  return isNetworkError(error) && !isTimeoutError(error) && RETRYABLE_CODES.has(errorCode(error) || '')
}

export function describeNetworkError(error: unknown) {
  if (isTimeoutError(error) && !errorCode(error)) return 'timed out'
  const message = error instanceof Error ? error.message : String(error)
  const code = errorCode(error)
  return code ? `${message} (${code})` : message
}

// Status to report to clients when the upstream could not be reached at all.
export function networkErrorStatus(error: unknown) {
  return isTimeoutError(error) ? 504 : 502
}

// Runs the request (including reading the body) and repeats it once after a
// transient connection reset.
export async function withNetworkRetry<T>(attempt: () => Promise<T>) {
  try {
    return await attempt()
  } catch (error) {
    if (!isRetryableNetworkError(error)) throw error
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    return attempt()
  }
}
