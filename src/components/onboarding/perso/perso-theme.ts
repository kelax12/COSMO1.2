import type React from 'react';
import type { Planet } from './orrery-geometry';

// ═══════════════════════════════════════════════════════════════════
// Palette de l'accueil perso, en variables CSS, claire OU sombre.
//
// La première version imposait le blanc de la landing perso à tout le monde :
// sur téléphone, où le thème par défaut est Noir, l'accueil arrivait en éclair
// blanc plein écran (relevé le 2026-10-04). L'accueil suit désormais le thème
// de l'app, lu UNE fois à l'ouverture (`.dark` est posé pour Sombre, Gris et
// Noir, cf. `src/lib/theme.ts`).
//
// Les composants n'écrivent plus aucune couleur de surface en dur : ils lisent
// `--onb-*`. Les teintes des planètes, elles, restent fixes (`PLANET_COLOR`,
// en -600) pour les fonds pleins et les boutons, où le blanc tient 4,5:1 ;
// un TEXTE coloré passe par `PLANET_TEXT`, éclairci en thème sombre.
// ═══════════════════════════════════════════════════════════════════

export type PersoTheme = 'light' | 'dark';

export const readAppTheme = (): PersoTheme => {
  try {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const LIGHT = {
  '--onb-bg': '#FFFFFF',
  '--onb-stage': '#F6F7FB',
  '--onb-card': '#FFFFFF',
  '--onb-row': '#FBFCFE',
  '--onb-ink': '#0F172A',
  '--onb-body': '#475569',
  '--onb-strong': '#334155',
  '--onb-muted': '#64748B',
  '--onb-faint': '#94A3B8',
  '--onb-line': '#E2E8F0',
  '--onb-line-soft': '#EEF2F7',
  '--onb-hair': '#CBD5E1',
  '--onb-chip': '#F1F5F9',
  '--onb-dot': 'rgba(15,23,42,0.07)',
  '--onb-solid': '#0F172A',
  '--onb-solid-text': '#FFFFFF',
  '--onb-tint-tasks': '#EFF6FF',
  '--onb-tint-tasks-ink': '#1E3A8A',
  '--onb-tint-agenda': '#EEF2FF',
  '--onb-tint-agenda-ink': '#312E81',
  '--onb-tint-okr': '#FDF8FE',
  '--onb-tint-okr-line': '#F5E8FA',
  '--onb-track-okr': '#F3E8FF',
  '--onb-shadow': 'rgba(15,23,42,0.35)',
};

const DARK: typeof LIGHT = {
  '--onb-bg': '#0F1115',
  '--onb-stage': '#151922',
  '--onb-card': '#1A1F29',
  '--onb-row': '#1F2531',
  '--onb-ink': '#F1F5F9',
  '--onb-body': '#A6B0BF',
  '--onb-strong': '#C9D2DE',
  '--onb-muted': '#8D97A7',
  '--onb-faint': '#636D7D',
  '--onb-line': '#2A313D',
  '--onb-line-soft': '#232934',
  '--onb-hair': '#3A4250',
  '--onb-chip': '#1F2531',
  '--onb-dot': 'rgba(241,245,249,0.08)',
  '--onb-solid': '#F1F5F9',
  '--onb-solid-text': '#0F1115',
  '--onb-tint-tasks': 'rgba(59,130,246,0.16)',
  '--onb-tint-tasks-ink': '#BFDBFE',
  '--onb-tint-agenda': 'rgba(99,102,241,0.18)',
  '--onb-tint-agenda-ink': '#C7D2FE',
  '--onb-tint-okr': 'rgba(192,38,211,0.10)',
  '--onb-tint-okr-line': 'rgba(192,38,211,0.25)',
  '--onb-track-okr': 'rgba(192,38,211,0.18)',
  '--onb-shadow': 'rgba(0,0,0,0.7)',
};

/**
 * Variables posées sur le conteneur. On redéclare aussi les jetons de thème
 * de l'app lus par les styles globaux des champs (`index.css`) : sans eux, un
 * champ suivrait le thème de l'app et non celui de l'accueil.
 */
export const persoScope = (theme: PersoTheme): React.CSSProperties =>
  ({
    colorScheme: theme,
    ...(theme === 'dark' ? DARK : LIGHT),
    '--color-border': theme === 'dark' ? '42 49 61' : '226 232 240',
    '--color-border-strong': theme === 'dark' ? '86 98 116' : '148 163 184',
    '--color-accent': '37 99 235',
    '--color-surface': theme === 'dark' ? '26 31 41' : '255 255 255',
    '--color-background': theme === 'dark' ? '15 17 21' : '255 255 255',
    '--color-hover': theme === 'dark' ? '31 37 49' : '241 245 249',
    '--color-text-primary': theme === 'dark' ? '241 245 249' : '15 23 42',
    '--color-text-secondary': theme === 'dark' ? '166 176 191' : '71 85 105',
    '--color-text-muted': theme === 'dark' ? '141 151 167' : '100 116 139',
  }) as React.CSSProperties;

/** Teinte d'un TEXTE ou d'un trait fin aux couleurs d'une planète. */
export const PLANET_TEXT: Record<PersoTheme, Record<Planet, string>> = {
  light: { tasks: '#2563EB', agenda: '#4F46E5', habits: '#7C3AED', okr: '#C026D3' },
  dark: { tasks: '#60A5FA', agenda: '#818CF8', habits: '#A78BFA', okr: '#E879F9' },
};
