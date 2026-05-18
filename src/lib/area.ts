/** Firebase path key for prices / truth_feed filtering — same rules as backend normalizeAreaKey */
export function normalizeAreaKey(area?: string | null): string {
  if (!area) return 'surjani';
  const key = area
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2013\u2014\u2212\-–—]/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_town$/, '')
    .replace(/^surjani_town$/, 'surjani');

  return key || 'surjani';
}

export function formatAreaLabel(areaKey: string): string {
  if (!areaKey) return '';
  return areaKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
