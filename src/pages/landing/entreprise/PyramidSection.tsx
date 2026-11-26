import React from 'react';
import { useT } from '@/i18n/useT';
import StepSection from './StepSection';

/**
 * Étape 1 : inviter, donner un rôle, regrouper en équipes.
 *
 * L'organigramme a été retiré du produit (mig. 229) : la section ne parle plus
 * de hiérarchie. Elle dit deux règles, et les montre au lieu de les décrire :
 *   · les RÔLES personnalisés décident de ce qu'on peut FAIRE (l'éditeur de
 *     rôle, à droite, reprend l'écran réel : un rôle, ses droits cochés) ;
 *   · les ÉQUIPES décident de ce qu'on VOIT (règle unique de visibilité, mig. 243) :
 *     la comparaison « ce qu'Emma voit / ce qu'elle ne voit pas » en bas.
 *
 * ❌ Pas de grille de cartes à icônes : c'était le gabarit des landings
 * générées. Le récit est une liste à filets, la preuve est un objet produit.
 */
const STEPS = ['g1', 'g2', 'g3'] as const;
const PERMS = [
  { key: 'perm1', on: true },
  { key: 'perm2', on: true },
  { key: 'perm3', on: false },
  { key: 'perm4', on: false },
] as const;
const SEES = ['sees1', 'sees2', 'sees3'] as const;
const HIDDEN = ['hidden1', 'hidden2', 'hidden3'] as const;

/** Rend les segments `<hl>…</hl>` surlignés en bleu COSMO. */
const avecAppui = (texte: string) =>
  texte.split(/(<hl>.*?<\/hl>)/g).map((part, i) => {
    const m = part.match(/^<hl>(.*)<\/hl>$/);
    return m ? (
      <span key={i} className="bg-cosmo-400/55 text-white [box-decoration-break:clone]">
        {m[1]}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    );
  });

const PyramidSection: React.FC = () => {
  const { t } = useT('landingEnterprise');
  const k = (suffix: string) => t(`enterprise.pyramid.${suffix}` as 'enterprise.pyramid.title');

  return (
    <StepSection
      id="equipes"
      step={1}
      titleKey="enterprise.pyramid.title"
      subtitleKey="enterprise.pyramid.subtitle"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* ── Le récit : trois gestes, en lignes à filets ── */}
        <ol className="divide-y divide-white/[0.08]">
          {STEPS.map((key, index) => (
            <li key={key} className="py-5 first:pt-0 last:pb-0">
              <h3 className="flex items-baseline gap-4 text-base font-medium text-white">
                <span className="font-mono text-caption tabular-nums text-cosmo-300">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {k(`${key}t`)}
              </h3>
              <p className="mt-2 pl-9 text-sm leading-relaxed text-slate-400">{avecAppui(k(`${key}d`))}</p>
            </li>
          ))}
        </ol>

        {/* ── L'éditeur de rôle, tel qu'il est dans l'app ── */}
        <figure
          className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#1C1D20] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
          aria-label={k('roleAria')}
        >
          <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#14b8a6]" aria-hidden="true" />
            <span className="text-sm text-white">{k('roleName')}</span>
            <span className="ml-auto text-xs text-slate-500">{k('roleTag')}</span>
          </div>
          <ul className="px-5 py-1.5">
            {PERMS.map(({ key, on }) => (
              <li
                key={key}
                className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-3 text-sm text-slate-300 last:border-b-0"
              >
                {k(key)}
                <span
                  className={`relative h-4 w-7 shrink-0 rounded-full ${on ? 'bg-cosmo-400' : 'bg-[#3A3C41]'}`}
                  role="img"
                  aria-label={k(on ? 'permOn' : 'permOff')}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full ${on ? 'right-0.5 bg-white' : 'left-0.5 bg-slate-400'}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </div>

      {/* ── La preuve du périmètre : ce que voit une personne, et le reste ── */}
      <div className="mt-14 grid border-t border-white/[0.08] sm:grid-cols-2">
        <div className="pt-6 sm:pr-8">
          <p className="text-xs font-medium text-cosmo-300">{k('seesTitle')}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {SEES.map((key) => (
              <li key={key}>{k(key)}</li>
            ))}
          </ul>
        </div>
        <div className="pt-6 sm:border-l sm:border-white/[0.08] sm:pl-8">
          <p className="text-xs font-medium text-slate-500">{k('hiddenTitle')}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-500 line-through decoration-slate-600">
            {HIDDEN.map((key) => (
              <li key={key}>{k(key)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-slate-400">{k('note')}</p>
    </StepSection>
  );
};

export default PyramidSection;
