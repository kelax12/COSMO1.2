// Thème des vitrines animées : SOMBRE par défaut, CLAIR sur demande.
//
// POURQUOI DEUX THÈMES. Les vitrines ont été dessinées pour la landing sombre.
// Le parcours perso est passé au BLANC le 2026-09-22 : des captures noires y
// faisaient des trous dans la page. Le sombre reste la valeur par défaut, à
// l'identique au pixel près, parce que `/guide` les monte sans rien demander.
//
// COMMENT. Deux canaux, parce que les couleurs arrivent par deux chemins :
//   - les CLASSES Tailwind (`text-slate-400`, `bg-slate-900`, `border-white/10`…)
//     sont re-teintées par `showcase-light.css`, scopée sous
//     `[data-sc-theme="light"]`. Le JSX garde ses classes sombres : c'est ce qui
//     garantit que le thème sombre ne bouge pas d'un pixel ;
//   - les valeurs passées en JS (`style={{ … }}`, props Recharts, tableaux de
//     couleurs animés par Framer) ne voient pas le CSS : elles lisent
//     `useShowcasePalette()`. Framer ne sait pas interpoler une `var(--…)`, d'où
//     une palette de VALEURS et pas de variables CSS.
//
// ⚠️ `text-white` est le seul cas ambigu : blanc sur une carte neutre (encre, à
// inverser) ou blanc sur un aplat coloré (événement, pastille d'accent, à
// garder). Il n'est donc JAMAIS re-teint globalement : l'encre porte en plus la
// classe `sc-ink`, et c'est elle seule que la feuille claire inverse.
import { createContext, useContext } from 'react';

export type ShowcaseTheme = 'dark' | 'light';

export const ShowcaseThemeContext = createContext<ShowcaseTheme>('dark');

export const useShowcaseTheme = (): ShowcaseTheme => useContext(ShowcaseThemeContext);

export interface ShowcasePalette {
  /** Fond de panneau (sidebar et en-tête de l'agenda). */
  panel: string;
  /** Carte posée sur un panneau. */
  card: string;
  /** Champ ou pastille en creux. */
  inset: string;
  /** Surface principale d'une carte (OKR, habitudes). */
  surface: string;
  /** Surface d'une ligne paire, légèrement décalée. */
  surfaceAlt: string;
  /** Fond d'un champ de saisie simulé. */
  field: string;
  hairline: string;
  hairlineSoft: string;
  zebra: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Accent d'un TEXTE (jour courant) : plus foncé en clair, pour tenir 4,5:1. */
  accentText: string;
  /** Rail vide d'une barre ou d'un anneau de progression. */
  track: string;
  ringTrack: string;
  dragShadow: string;
  selectionShadow: string;
  gridStroke: string;
  gridOpacity: number;
  chartTick: string;
  chartCursor: string;
  /** Les deux bornes d'une icône qui « appelle » (animée par Framer). */
  iconIdle: string;
  iconActive: string;
  /**
   * Couleur de TEXTE pour une teinte de catégorie. En sombre, la teinte
   * elle-même ; en clair, son cran 700, parce qu'un `-500` posé sur du blanc ne
   * tient pas 4,5:1 (un `#EAB308` y rend 2,1:1).
   */
  tintText: (hex: string) => string;
}

// Teinte `-500` de Tailwind → son `-700`. Toutes les teintes des vitrines y
// figurent ; une teinte absente retombe sur elle-même.
const CRAN_700: Record<string, string> = {
  '#3B82F6': '#1D4ED8', // blue
  '#EF4444': '#B91C1C', // red
  '#22C55E': '#15803D', // green
  '#10B981': '#047857', // emerald
  '#EAB308': '#A16207', // yellow
  '#F59E0B': '#B45309', // amber
  '#F97316': '#C2410C', // orange
  '#8B5CF6': '#6D28D9', // violet
  '#06B6D4': '#0E7490', // cyan
  '#EC4899': '#BE185D', // pink
};

export const SHOWCASE_PALETTES: Record<ShowcaseTheme, ShowcasePalette> = {
  // ⚠️ Chaque valeur SOMBRE est celle qui était écrite en dur dans les vitrines
  // avant le 2026-09-22. Ne pas les « harmoniser » : ce thème-là ne doit pas
  // changer.
  dark: {
    panel: '#132237',
    card: '#1E293B',
    inset: '#0F172A',
    surface: 'rgba(30, 41, 59, 0.85)',
    surfaceAlt: 'rgba(30, 41, 59, 0.92)',
    field: 'rgba(15,23,42,0.6)',
    hairline: 'rgba(255,255,255,0.08)',
    hairlineSoft: 'rgba(255,255,255,0.04)',
    zebra: 'rgba(255,255,255,0.015)',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentText: '#3B82F6',
    track: 'rgba(255,255,255,0.08)',
    ringTrack: '#334155',
    dragShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.3)',
    selectionShadow: '0 0 0 1px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
    gridStroke: '#fff',
    gridOpacity: 0.15,
    chartTick: '#94A3B8',
    chartCursor: 'rgba(255,255,255,0.04)',
    iconIdle: '#94a3b8',
    iconActive: '#3b82f6',
    tintText: (hex) => hex,
  },
  // Clair : papier blanc, encre slate-900, filets slate-900 à ~10 %. Les
  // teintes de catégorie ne changent PAS quand elles colorent un aplat ; elles
  // ne descendent au cran 700 que quand elles colorent un texte.
  light: {
    panel: '#F8FAFC',
    card: '#FFFFFF',
    inset: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    field: '#FFFFFF',
    hairline: 'rgba(15,23,42,0.10)',
    hairlineSoft: 'rgba(15,23,42,0.035)',
    zebra: 'rgba(15,23,42,0.02)',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    accentText: '#1D4ED8',
    track: '#E2E8F0',
    ringTrack: '#E2E8F0',
    dragShadow: '0 18px 40px rgba(15,23,42,0.18), 0 0 0 1px rgba(249,115,22,0.35)',
    selectionShadow: '0 0 0 1px rgba(37,99,235,0.35)',
    gridStroke: '#0F172A',
    gridOpacity: 0.08,
    chartTick: '#64748B',
    chartCursor: 'rgba(15,23,42,0.04)',
    iconIdle: '#64748B',
    iconActive: '#2563EB',
    tintText: (hex) => CRAN_700[hex.toUpperCase()] ?? hex,
  },
};

export const useShowcasePalette = (): ShowcasePalette => SHOWCASE_PALETTES[useShowcaseTheme()];
