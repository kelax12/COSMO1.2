// Constantes & helpers purs de TaskModal — extraits pour être partagés entre
// le corps mobile et le corps desktop, et testables indépendamment.

export const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 — Très haute', color: 'text-red-500' },
  { value: 2, label: 'P2 — Haute',      color: 'text-orange-500' },
  { value: 3, label: 'P3 — Moyenne',    color: 'text-blue-500' },
  { value: 4, label: 'P4 — Basse',      color: 'text-blue-500' },
  { value: 5, label: 'P5 — Très basse', color: 'text-gray-400' },
];

export function priorityColor(p: number): string {
  return PRIORITY_OPTIONS.find(o => o.value === p)?.color ?? 'text-gray-400';
}
