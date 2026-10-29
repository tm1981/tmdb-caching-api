// Runs `task` over `items` with at most `limit` in flight, preserving result order.
export async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  task: (item: Item, index: number) => Promise<Result>,
) {
  const results = new Array<Result>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await task(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
