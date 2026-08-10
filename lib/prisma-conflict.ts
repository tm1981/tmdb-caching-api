export function isPrismaUniqueConflict(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002'
}

export async function retryPrismaUniqueConflict<T>(
  write: () => Promise<T>,
  retry: () => Promise<T>,
) {
  try {
    return await write()
  } catch (error) {
    if (!isPrismaUniqueConflict(error)) throw error
    return retry()
  }
}
