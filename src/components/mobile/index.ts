// Design system mobile — primitives partagées.
//
// Règle : toute nouvelle page ou liste mobile compose ces briques plutôt que
// de redessiner un en-tête / une ligne / un contrôle. Cf. docs/MOBILE.md.
export { default as MobileScreen } from './MobileScreen';
export { default as MobileHeader } from './MobileHeader';
export { default as ListRow } from './ListRow';
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
