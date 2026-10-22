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

// `gris` et `noir` (2026-10-12) : le guide monte les vitrines dans le thème de
// l'app du visiteur. Ce sont deux thèmes SOMBRES : même JSX que `dark`, seules
// les surfaces changent (graphite, noir pur), re-teintées par
// `showcase-gris-noir.css` et par les palettes ci-dessous.
export type ShowcaseTheme = 'dark' | 'light' | 'gris' | 'noir';

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

// Teinte `-500` → son `-400`, pour un TEXTE de catégorie sur une carte SOMBRE.
// Mesure Lighthouse/axe du 2026-10-22 sur /guide/ : la teinte brute y rendait
// 3,1:1 (`#3B82F6` sur la pastille « Produit » en gris) à 4,3:1 (noir).
const CRAN_400: Record<string, string> = {
  '#3B82F6': '#60A5FA',
  '#EF4444': '#F87171',
  '#22C55E': '#4ADE80',
  '#10B981': '#34D399',
  '#EAB308': '#FACC15',
  '#F59E0B': '#FBBF24',
  '#F97316': '#FB923C',
  '#8B5CF6': '#A78BFA',
  '#06B6D4': '#22D3EE',
  '#EC4899': '#F472B6',
};
const cran400 = (hex: string) => CRAN_400[hex.toUpperCase()] ?? hex;

/**
 * Aplat d'un ÉVÉNEMENT d'agenda, qui porte un titre en blanc : le cran 700,
 * dans tous les thèmes. En `-500`, le blanc y rendait 2,1:1 (ambre) à 4,2:1
 * (violet), sous les 4,5:1 de WCAG 1.4.3 (Lighthouse, 2026-10-22).
 */
export const eventFill = (hex: string): string => CRAN_700[hex.toUpperCase()] ?? hex;

export const SHOWCASE_PALETTES: Record<ShowcaseTheme, ShowcasePalette> = {
  // ⚠️ Chaque valeur SOMBRE est celle qui était écrite en dur dans les vitrines
  // avant le 2026-09-22. Ne pas les « harmoniser » : ce thème-là ne doit pas
  // changer. Seules exceptions, le contraste (2026-10-22) : `textMuted`,
  // `accentText` et `tintText`, qui rendaient 3,1 à 4,1:1 sur les cartes.
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
    textMuted: '#8A99AE',
    // blue-400 : le blue-500 d'origine rendait 4,1:1 sur la carte (2026-10-22).
    accentText: '#60A5FA',
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
    tintText: cran400,
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
    textMuted: '#5B6B80',
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
  // Gris : les variables `.gris` de src/index.css (graphite GitHub).
  gris: {
    panel: '#24292E',
    card: '#2B3137',
    inset: '#24292E',
    surface: 'rgba(43, 49, 55, 0.85)',
    surfaceAlt: 'rgba(43, 49, 55, 0.92)',
    field: 'rgba(36,41,46,0.6)',
    hairline: 'rgba(255,255,255,0.08)',
    hairlineSoft: 'rgba(255,255,255,0.04)',
    zebra: 'rgba(255,255,255,0.015)',
    textPrimary: '#FAFBFC',
    textSecondary: '#ADBAC7',
    textMuted: '#9AA5B0',
    accentText: '#58A6FF',
    track: 'rgba(255,255,255,0.08)',
    ringTrack: '#373E47',
    dragShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(249,115,22,0.3)',
    selectionShadow: '0 0 0 1px rgba(88,166,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
    gridStroke: '#fff',
    gridOpacity: 0.15,
    chartTick: '#ADBAC7',
    chartCursor: 'rgba(255,255,255,0.04)',
    iconIdle: '#8F99A4',
    iconActive: '#58A6FF',
    tintText: cran400,
  },
  // Noir : les variables `.noir` de src/index.css (OLED, gris sans teinte).
  // Les teintes de catégorie restent en couleur, comme dans l'app.
  noir: {
    panel: '#080808',
    card: '#161616',
    inset: '#080808',
    surface: 'rgba(22, 22, 22, 0.9)',
    surfaceAlt: 'rgba(22, 22, 22, 0.96)',
    field: 'rgba(8,8,8,0.6)',
    hairline: 'rgba(255,255,255,0.08)',
    hairlineSoft: 'rgba(255,255,255,0.04)',
    zebra: 'rgba(255,255,255,0.015)',
    textPrimary: '#F2F2F2',
    textSecondary: '#A8A8A8',
    textMuted: '#8C8C8C',
    accentText: '#F0F0F0',
    track: 'rgba(255,255,255,0.08)',
    ringTrack: '#2E2E2E',
    dragShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(249,115,22,0.3)',
    selectionShadow: '0 0 0 1px rgba(240,240,240,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
    gridStroke: '#fff',
    gridOpacity: 0.12,
    chartTick: '#A8A8A8',
    chartCursor: 'rgba(255,255,255,0.04)',
    iconIdle: '#808080',
    iconActive: '#F0F0F0',
    tintText: cran400,
  },
};

export const useShowcasePalette = (): ShowcasePalette => SHOWCASE_PALETTES[useShowcaseTheme()];
