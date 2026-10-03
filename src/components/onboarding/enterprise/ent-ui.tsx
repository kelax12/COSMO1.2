import type React from 'react';
import { withEmphasis } from '../onboarding-text';

// ═══════════════════════════════════════════════════════════════════
// Primitives visuelles de l'accueil entreprise (DA nuit de la landing).
//
// Le cyan n'a que deux rôles ici comme sur la landing : la lumière (la
// constellation) et l'ACTION (le bouton principal, le focus). Un titre ne se
// colore jamais : son mot appuyé passe en sérif italique, en lune.
// ═══════════════════════════════════════════════════════════════════

export const ENT_PRIMARY =
  'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#22D3EE] px-6 text-body font-semibold text-[#08090C] transition-colors hover:bg-[#67E8F9] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#22D3EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]';
export const ENT_SECONDARY =
  'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-[#EDF2F7]/20 px-6 text-body font-medium text-[#EDF2F7] transition-colors hover:border-[#EDF2F7]/40 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]';
export const ENT_LINK =
  'rounded-full px-2 py-2 text-sm font-medium text-[#8B96A8] underline-offset-4 transition-colors hover:text-[#EDF2F7] hover:underline disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]';
export const ENT_FIELD =
  'flex items-center gap-2 rounded-2xl border border-[#2D3542] bg-[#11151B] px-4 transition-shadow focus-within:border-[#22D3EE] focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.14)]';
export const ENT_INPUT =
  'no-input-chrome h-12 min-w-0 flex-1 bg-transparent text-base text-[#EDF2F7] placeholder:text-[#5E6878] focus:outline-none';
export const ENT_LABEL = 'block font-data text-caption uppercase tracking-[0.14em] text-[#8B96A8]';
export const ENT_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-[#2D3542] px-3 py-1.5 text-label text-[#C9D2DE] transition-colors hover:border-[#22D3EE]/60 hover:text-[#EDF2F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]';
export const ENT_CARD = 'rounded-[20px] border border-[#1F2530] bg-[#0E1116]';

const EM = 'font-display font-normal italic tracking-[-0.01em]';

export const EntTitle = ({ text, size = 'md' }: { text: string; size?: 'lg' | 'md' }) => (
  <h2
    className={`mt-3 font-semibold leading-[1.04] tracking-[-0.035em] text-[#EDF2F7] ${
      size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
    }`}
  >
    {withEmphasis(text, EM)}
  </h2>
);

export const EntBody = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-4 text-base leading-[1.6] text-[#8B96A8]">{children}</p>
);

export const EntKicker = ({ children }: { children: React.ReactNode }) => (
  <p className="flex items-center gap-2 font-data text-caption uppercase tracking-[0.16em] text-[#8B96A8]">
    <span className="h-1.5 w-1.5 rounded-full bg-[#22D3EE]" aria-hidden="true" />
    {children}
  </p>
);

/**
 * Rangée d'actions : collée en bas d'écran sur téléphone (le bouton reste à
 * portée de pouce quand le clavier est fermé), dans le flux au-delà.
 */
export const EntActions = ({ children }: { children: React.ReactNode }) => (
  <>
    <div className="h-8 shrink-0" aria-hidden="true" />
    {/* Téléphone : bouton principal pleine largeur, « Passer » dessous (les
        libellés d'action sont longs : côte à côte, « Passer cette étape »
        tombait sur trois lignes). `mt-auto` pousse la rangée en bas d'un
        contenu court. */}
    <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col-reverse items-stretch gap-1 border-t border-[#1F2530] bg-[#08090C] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 [&>span:empty]:hidden sm:[&>span:empty]:block">
      {children}
    </div>
  </>
);
