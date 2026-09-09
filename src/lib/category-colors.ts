// ═══════════════════════════════════════════════════════════════════
// Palette de catégories, par NOM
//
// Vit dans `lib/` et non dans `modules/categories/` parce que ses deux
// consommateurs sont de deux zones différentes (OKR perso et OKR d'équipe) :
// la règle d'import par zone de CLAUDE.md interdit à un écran entreprise de
// tirer sur le module `categories`.
//
// Une catégorie personnelle stocke sa couleur sous forme de NOM ('blue'),
// là où une catégorie d'équipe stocke directement l'hex. Les deux surfaces
// OKR (perso et entreprise) résolvent donc un nom en hex avant de peindre.
//
// Ce helper vivait dans `components/CategoryManager.tsx`, un modal qui n'a
// jamais été monté (supprimé le 2026-09-09) : deux pages importaient un
// composant d'interface pour une table de correspondance.
// ═══════════════════════════════════════════════════════════════════

export const CATEGORY_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'blue', hex: '#3b82f6' },
  { name: 'red', hex: '#ef4444' },
  { name: 'green', hex: '#10b981' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'orange', hex: '#f59e0b' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'indigo', hex: '#6366f1' },
  { name: 'cyan', hex: '#06b6d4' },
];

/**
 * Nom de couleur → hex. Retombe sur le bleu pour un nom inconnu : la valeur
 * vient de la base et n'est contrainte par aucun CHECK.
 */
export const getColorHex = (colorName: string): string =>
  CATEGORY_COLORS.find((c) => c.name === colorName)?.hex ?? '#3b82f6';
