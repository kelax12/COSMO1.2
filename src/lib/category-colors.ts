// ═══════════════════════════════════════════════════════════════════
// La palette des catégories, et rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// Ce fichier est ce qui reste de l'ancien `CategoryManager`, supprimé comme code
// mort : câblé sur `useModalA11y` sans être monté, il gonflait l'inventaire des
// surfaces modales à auditer (`docs/AUDIT-VOICEOVER-IOS.md`).
//
// ❌ **Ne jamais réintroduire une palette ailleurs.** Ces huit teintes sont
//    celles que le produit sait afficher : une seconde table quelque part
//    ferait deux définitions de « la couleur bleue », et le jour où l'une
//    bouge, deux écrans s'écartent sans que rien ne le dise.

/** Les huit teintes que le produit sait rendre, nom canonique → hex. */
export const CATEGORY_COLORS = [
  { name: 'blue', hex: '#3b82f6' },
  { name: 'red', hex: '#ef4444' },
  { name: 'green', hex: '#10b981' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'orange', hex: '#f59e0b' },
  { name: 'pink', hex: '#ec4899' },
  { name: 'indigo', hex: '#6366f1' },
  { name: 'cyan', hex: '#06b6d4' },
] as const;

/**
 * Résout un NOM de couleur en hex.
 *
 * ⚠️ Le repli sur le bleu est délibéré et ne doit pas devenir une exception :
 * un nom inconnu vient d'une donnée ancienne ou d'un autre compte, et une
 * catégorie sans couleur vaut mieux qu'un écran cassé. Le mode ENTREPRISE, lui,
 * stocke parfois un hex directement — ses appelants testent `startsWith('#')`
 * AVANT d'appeler ceci.
 */
export const getColorHex = (colorName: string): string =>
  CATEGORY_COLORS.find((c) => c.name === colorName)?.hex ?? '#3b82f6';

/**
 * Couleur de tout élément SANS catégorie (tâche, événement, habitude, OKR) :
 * gris clair, partout le même. Sur ce fond, le texte se
 * pose en sombre : `textOnCategoryColor`.
 */
export const NO_CATEGORY_COLOR = '#CBD5E1';

/** Couleurs de catégories normalisées (hex MAJUSCULE, un nom comme `blue` résolu). */
export const categoryColorSet = (categories: ReadonlyArray<{ color: string }>): ReadonlySet<string> =>
  new Set(categories.map((c) => (c.color.startsWith('#') ? c.color : getColorHex(c.color)).toUpperCase()));

/**
 * Couleur d'AFFICHAGE d'un élément qui ne porte qu'une couleur (événement) :
 * la sienne si elle correspond encore à une catégorie, sinon le gris clair.
 * La donnée n'est pas réécrite : une catégorie recréée dans la même couleur
 * retrouve ses événements.
 */
export const displayCategoryColor = (
  color: string | null | undefined,
  categoryColors: ReadonlySet<string>,
): string => (color && categoryColors.has(color.toUpperCase()) ? color : NO_CATEGORY_COLOR);

const luminance = (hex: string): number | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};

/**
 * Texte lisible (WCAG 1.4.3, 4,5:1) sur un aplat de couleur : blanc s'il
 * tient, sinon gris très sombre, sinon noir.
 *
 * Le blanc ne tient sur AUCUNE des huit teintes de catégorie (2,15:1 sur
 * l'orange, 4,47:1 sur l'indigo). Un hex non lisible (`rgb(var(...))`) garde le
 * blanc.
 */
export const textOnColor = (color: string): string => {
  const lum = luminance(color);
  if (lum === null) return '#ffffff';
  if (1.05 / (lum + 0.05) >= 4.5) return '#ffffff';
  // #111827 : luminance 0,0103 ; le noir pur ne sert qu'aux teintes moyennes
  // (violet, indigo) où le gris sombre plafonne sous 4,5.
  return (lum + 0.05) / 0.0603 >= 4.5 ? '#111827' : '#000000';
};

/** Couleur de texte lisible sur un fond de catégorie (cf. `textOnColor`). */
export const textOnCategoryColor = (color: string | null | undefined): string =>
  textOnColor(color || NO_CATEGORY_COLOR);
