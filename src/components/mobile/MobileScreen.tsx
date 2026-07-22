import React from 'react';
import { cn } from '@/lib/utils';

interface MobileScreenProps {
  children: React.ReactNode;
  /**
   * `true` si la page affiche un FAB : réserve 88px de plus en bas pour que le
   * dernier élément ne passe jamais sous le bouton. Pages concernées :
   * Tâches, Habitudes, OKR (cf. docs/MOBILE.md).
   */
  hasFab?: boolean;
  /**
   * `false` supprime la gouttière horizontale : à utiliser quand le contenu doit
   * aller bord à bord (listes, calendrier). Les lignes gèrent alors leur propre
   * padding interne. C'est le réglage qui donne l'impression « native ».
   */
  gutter?: boolean;
  className?: string;
}

/**
 * Enveloppe unique de toute page mobile.
 *
 * Elle existe parce que les 8 pages calculaient chacune leur padding à la main
 * (`p-3`, `p-4`, `p-3 sm:p-6`, `p-4 md:p-8`) et recopiaient une expression
 * `pb-[calc(...)]` de 50 caractères — une page qui l'oubliait voyait son dernier
 * élément disparaître derrière la tab bar.
 *
 * Contrat :
 * - `min-h-[100dvh]` et jamais `100vh` (Safari iOS rogne sinon le contenu)
 * - gouttière unique `--gutter`
 * - réserve pour la tab bar (64px) + `env(safe-area-inset-bottom)` + FAB
 * - au-delà de `md`, le padding desktop d'origine reprend la main
 */
const MobileScreen: React.FC<MobileScreenProps> = ({
  children,
  hasFab = false,
  gutter = true,
  className,
}) => (
  <div
    className={cn(
      'min-h-[100dvh] bg-[rgb(var(--color-background))]',
      gutter ? 'px-gutter py-gutter md:p-8' : 'py-gutter md:p-8',
      hasFab
        ? 'pb-[calc(64px+env(safe-area-inset-bottom)+88px)] md:pb-8'
        : 'pb-[calc(64px+env(safe-area-inset-bottom)+24px)] md:pb-8',
      className,
    )}
  >
    {children}
  </div>
);

export default MobileScreen;
