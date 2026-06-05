export function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function findBestNameMatch<T extends { name: string }>(
  query: string,
  items: T[]
): T | null {
  const q = normalizeSearchQuery(query);
  if (!q) return null;

  const exact = items.find(item => item.name.toLowerCase() === q);
  if (exact) return exact;

  const startsWith = items.find(item => item.name.toLowerCase().startsWith(q));
  if (startsWith) return startsWith;

  return items.find(item => item.name.toLowerCase().includes(q)) ?? null;
}
