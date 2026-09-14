// ═══════════════════════════════════════════════════════════════════
// La palette des catégories, et rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE FICHIER EST CE QUI RESTE DE `src/components/CategoryManager.tsx`.
//
// Ce composant-là était une modale de gestion de catégories de **452 lignes**,
// câblée sur `useModalA11y`, et **montée nulle part** : `git grep` ne rendait
// que trois imports, tous pour le seul `getColorHex`. Il a été trouvé « en
// passant » par l'audit d'accessibilité C-24, qui l'a classé « à traiter
// ailleurs » — et personne ne l'a traité, parce qu'un défaut sans item n'a pas
// de propriétaire.
//
// ⚠️ **Le coût n'était pas le poids, il était la lecture.** Un composant mort
// mais CÂBLÉ sur `useModalA11y` compte comme une surface modale : il gonflait
// l'inventaire des surfaces à auditer (C-53, `docs/AUDIT-VOICEOVER-IOS.md`),
// et quelqu'un aurait fini par chercher au doigt, sur un iPhone, une modale
// qu'aucun écran n'ouvre. Du code mort ne coûte pas des octets, il coûte du
// temps à qui le prend pour vivant.
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
