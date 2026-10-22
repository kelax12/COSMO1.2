import React from 'react';

/**
 * Tokens typographiques — source unique de vérité (AM9 audit UX).
 *
 * Trois variantes de PageHeading documentées dans CLAUDE.md :
 *  - hero     : Dashboard (salutation) — très grand sur desktop
 *  - standard : Habits, OKR, Stats, Premium, Settings
 *  - compact  : /entreprise (le titre côtoie une icône et des badges)
 *
 * `hero` et `standard` ne se distinguent plus QUE sur desktop : sur mobile,
 * les deux sont le titre de page canonique (28 px). Cf. VARIANT_CLASSES.
 *
 * Usage :
 *   <PageHeading variant="standard">Habitudes</PageHeading>
 *   <SectionHeading>Aujourd'hui</SectionHeading>
 */

interface PageHeadingProps {
  variant?: 'hero' | 'standard' | 'compact';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'h1' | 'h2';
}

/**
 * ⚠️ Les tailles MOBILE sont prises dans l'échelle fermée
 * (`display 28 / title 22 / headline 17 / body 15 / label 13 / caption 11`),
 * pas dans l'échelle Tailwind brute. Les tailles DESKTOP (`sm:` / `lg:`) sont
 * inchangées : la refonte de l'échelle est mobile, la toucher côté desktop
 * changerait un rendu qui n'a jamais été audité.
 *
 * POURQUOI (audit UI 2026-08-14, corrigé le 2026-08-24). Le `h1` d'une page
 * avait QUATRE tailles différentes sur mobile — 28 px sur /tasks (MobileHeader),
 * 24 px sur /habits /okr /statistics /settings (`standard`), 22 px sur
 * /dashboard (`hero`), 18 px sur /entreprise (`compact`) — pour des pages qu'on
 * enchaîne en trois taps. `MobileHeader` avait été créé pour supprimer cette
 * incohérence et n'avait qu'UN consommateur : il avait donc ajouté une
 * quatrième échelle au lieu d'en retirer trois.
 *
 * Il en reste DEUX, et chacune se justifie :
 *   • `text-display` (28 px) — le titre de page, celui de /tasks. C'est la
 *     taille canonique de l'échelle (« titre de page » dans `src/index.css`).
 *   • `text-headline` (17 px) — `compact`, le seul cas où le titre COHABITE
 *     avec une icône et des badges sur une seule ligne (/entreprise, où le
 *     titre est un nom d'organisation `truncate`). L'agrandir y augmenterait
 *     la troncature, qui est déjà un finding ouvert.
 *
 * Ce fichier n'est PAS géré par la CLI shadcn malgré son dossier : c'est du
 * code du projet (tokens typographiques, audit UX AM9). Il échappe en revanche
 * au scan de `src/design-system.guard.test.ts`, qui exclut `ui/` — c'est
 * précisément pour ça que ces tailles hors échelle ont survécu à la migration.
 */
const VARIANT_CLASSES: Record<NonNullable<PageHeadingProps['variant']>, string> = {
  // 28px mobile (échelle fermée) → text-4xl sm → text-5xl lg
  hero:     'text-display sm:text-4xl lg:text-5xl font-bold tracking-tight',
  // 28px mobile (échelle fermée) → text-3xl sm
  standard: 'text-display sm:text-3xl font-bold',
  // 17px mobile (échelle fermée) → text-3xl sm  (côtoie une icône, truncate)
  compact:  'text-headline sm:text-3xl font-bold',
};

export const PageHeading: React.FC<PageHeadingProps> = ({
  variant = 'standard',
  children,
  className = '',
  style,
  as: Tag = 'h1',
}) => (
  <Tag
    className={`${VARIANT_CLASSES[variant]} ${className}`}
    style={{ color: 'rgb(var(--color-text-primary))', ...style }}
  >
    {children}
  </Tag>
);

interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** Titre de section dans une card (h2) — text-lg, semi-bold. */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  children,
  className = '',
  style,
}) => (
  <h2
    className={`text-lg font-semibold ${className}`}
    style={{ color: 'rgb(var(--color-text-primary))', ...style }}
  >
    {children}
  </h2>
);

/** Sous-titre discret sous un PageHeading. */
export const PageSubtitle: React.FC<SectionHeadingProps> = ({
  children,
  className = '',
  style,
}) => (
  <p
    className={`text-sm sm:text-base font-medium mt-1 ${className}`}
    style={{ color: 'rgb(var(--color-text-secondary))', ...style }}
  >
    {children}
  </p>
);
