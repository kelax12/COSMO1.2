// Constantes & helpers purs de TaskModal — extraits pour être partagés entre
// le corps mobile et le corps desktop, et testables indépendamment.

// ⚠️ `labelKey`, pas `label` : une constante de module qui porte du texte
// traduit fige la langue au premier import. La traduction a lieu au rendu.
export const PRIORITY_OPTIONS = [
  { value: 1, labelKey: 'priority.p1' as const, color: 'text-red-500' },
  { value: 2, labelKey: 'priority.p2' as const, color: 'text-orange-500' },
  { value: 3, labelKey: 'priority.p3' as const, color: 'text-blue-500' },
  { value: 4, labelKey: 'priority.p4' as const, color: 'text-blue-500' },
  { value: 5, labelKey: 'priority.p5' as const, color: 'text-gray-400' },
];

export function priorityColor(p: number): string {
  return PRIORITY_OPTIONS.find(o => o.value === p)?.color ?? 'text-gray-400';
}
