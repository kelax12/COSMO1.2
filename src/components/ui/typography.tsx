import React from 'react';

/**
 * Tokens typographiques — source unique de vérité (AM9 audit UX).
 *
 * Trois variantes de PageHeading documentées dans CLAUDE.md :
 *  - hero     : Dashboard (salutation) — très grand
 *  - standard : Habits, OKR, Stats, Premium, Settings — grand
 *  - compact  : Tasks (titre côtoie une icône) — medium
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

const VARIANT_CLASSES: Record<NonNullable<PageHeadingProps['variant']>, string> = {
  // text-2xl mobile → text-4xl sm → text-5xl lg
  hero:     'text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight',
  // text-2xl mobile → text-3xl sm
  standard: 'text-2xl sm:text-3xl font-bold',
  // text-lg mobile → text-3xl sm  (côtoie une icône)
  compact:  'text-lg sm:text-3xl font-bold',
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
