import { createLucideIcon } from 'lucide-react';

/*
 * Icônes hors lucide, figées (sans animation), servies par la même fabrique
 * que lucide : mêmes props (size, strokeWidth, className), type `LucideIcon`.
 * Tracés : Hugeicons free set (MIT, (c) 2025 Hugeicons), via @animateicons/react.
 */

/** OKR, objectifs (Hugeicons « target-01 »). */
export const OkrIcon = createLucideIcon('okr', [
  ['path', { d: 'M15.1312 2.5C14.1462 2.17555 13.0936 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 10.9548 21.8396 9.94704 21.5422 9', key: 'okr-1' }],
  ['path', { d: 'M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7', key: 'okr-2' }],
  ['path', { d: 'M19.5 4.5L12 12M19.5 4.5V2M19.5 4.5H22', key: 'okr-3' }],
]);

/** Habitudes (Hugeicons « check-list »). */
export const HabitIcon = createLucideIcon('habit', [
  ['path', { d: 'M11 6L21 6', key: 'habit-1' }],
  ['path', { d: 'M11 12L21 12', key: 'habit-2' }],
  ['path', { d: 'M11 18L21 18', key: 'habit-3' }],
  ['path', { d: 'M3 7.39286C3 7.39286 4 8.04466 4.5 9C4.5 9 6 5.25 8 4', key: 'habit-4' }],
  ['path', { d: 'M3 18.3929C3 18.3929 4 19.0447 4.5 20C4.5 20 6 16.25 8 15', key: 'habit-5' }],
]);
