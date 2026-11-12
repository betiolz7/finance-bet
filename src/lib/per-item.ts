/**
 * Roda uma busca por conexão sem que uma conexão com problema (removida,
 * autorização vencida) derrube as outras.
 */
export async function perItem<T>(
  itemIds: string[],
  fetcher: (itemId: string) => Promise<T>,
): Promise<{ results: { itemId: string; value: T }[]; failed: string[] }> {
  const settled = await Promise.allSettled(itemIds.map(fetcher));
  const results: { itemId: string; value: T }[] = [];
  const failed: string[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      results.push({ itemId: itemIds[index], value: outcome.value });
    } else {
      failed.push(itemIds[index]);
    }
  });
  return { results, failed };
}
