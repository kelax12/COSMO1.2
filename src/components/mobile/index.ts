// Design system mobile — primitives partagées.
//
// Règle : toute nouvelle page ou liste mobile compose ces briques plutôt que
// de redessiner un en-tête / une ligne / un contrôle. Cf. docs/MOBILE.md.
//
// 🗑️ `MobileScreen` et `ListRow` ont été SUPPRIMÉS le 2026-09-05 (C-10). Ils
// étaient exportés ici depuis le 2026-07-22 sans qu'un seul écran ne les monte :
// livrés, documentés, testés — jamais éprouvés. Une primitive qu'aucun écran
// réel n'a contrainte ne décrit pas un besoin, elle décrit une supposition.
//
// ❌ Ne pas les recréer « au cas où ». Si le besoin revient, ils se réécriront
// CONTRE un écran, seule façon de savoir ce qu'ils doivent porter — c'est
// exactement ce qui manquait à `MobileHeader`, qui n'a jamais fonctionné en un
// mois d'existence sur la seule page qui l'utilisait.
export { default as MobileHeader } from './MobileHeader';
export { default as SectionHeader } from './SectionHeader';
export { default as Segmented } from './Segmented';
export { default as TouchTarget } from './TouchTarget';
export { default as BottomSheet } from './BottomSheet';
export type { SegmentedOption } from './Segmented';
export {
  SHEET_SPRING,
  ITEM_TRANSITION,
  CONTROL_TRANSITION,
  FADE_TRANSITION,
  haptic,
  prefersReducedMotion,
} from './mobile-motion';
