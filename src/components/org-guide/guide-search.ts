export const normalizeGuideText = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Chaque mot de la requête doit apparaître dans le libellé ou les synonymes. */
export const matchesGuideQuery = (query: string, label: string, synonyms: string): boolean => {
  const words = normalizeGuideText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeGuideText(`${label} ${synonyms}`);
  return words.every((w) => haystack.includes(w));
};
