import React, { useRef } from 'react';
import { Check, Lock } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

const BULLETS: KeyOf<'landing'>[] = ['enterprise.okr.b1', 'enterprise.okr.b2', 'enterprise.okr.b3'];

/** Résultats clés de démonstration — des chiffres illustratifs, pas des mesures. */
const KEY_RESULTS = [
  { progress: 100, done: true },
  { progress: 74, done: false },
  { progress: 45, done: false },
];

/**
 * Section « alignement » — la cascade objectif d'organisation → OKR d'équipe →
 * résultats clés, et le journal inaltérable qui en fait une preuve.
 *
 * Les barres de progression se remplissent au scroll via `scaleX` sur une
 * couche dédiée, la largeur finale restant définie en CSS : si l'animation ne
 * joue pas (reduced-motion), les barres sont simplement déjà pleines.
 */
const OkrSection: React.FC = () => {
  const { t } = useT('landing');
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: '.okr-cascade', start: 'top 76%', once: true },
        });
        tl.from('.okr-level', { opacity: 0, y: 26, duration: 0.6, ease: 'power3.out', stagger: 0.14 })
          .from('.okr-connector', { scaleY: 0, transformOrigin: 'top center', duration: 0.4, ease: 'power2.out', stagger: 0.14 }, 0.15)
          .from('.okr-fill', { scaleX: 0, transformOrigin: 'left center', duration: 1.1, ease: 'power3.out', stagger: 0.1 }, '-=0.3');
      });
    },
    { scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      id="okr"
      className="relative scroll-mt-40 border-t border-white/[0.06] py-24 lg:py-32"
      aria-labelledby="okr-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-16">
          {/* ── Le discours ── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2
              id="okr-title"
              className="mb-5 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem]"
            >
              {t('enterprise.okr.title')}
            </h2>
            <p className="mb-8 text-base leading-relaxed text-slate-400 lg:text-lg">
              {t('enterprise.okr.subtitle')}
            </p>

            <ul className="mb-10 space-y-3.5">
              {BULLETS.map((key) => (
                <li key={key} className="flex gap-3 text-sm leading-relaxed text-slate-400">
                  <Check size={16} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" />
                  {t(key)}
                </li>
              ))}
            </ul>

            <div className="flex gap-4 rounded-xl border border-[#F5B942]/20 bg-[#F5B942]/[0.05] p-5">
              <Lock size={18} className="mt-0.5 shrink-0 text-[#F5B942]" aria-hidden="true" />
              <div>
                <h3 className="mb-1.5 text-sm font-semibold text-[#F5B942]">
                  {t('enterprise.okr.journalTitle')}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">{t('enterprise.okr.journalBody')}</p>
              </div>
            </div>
          </div>

          {/* ── La cascade ── */}
          <div className="okr-cascade flex flex-col items-stretch">
            {/* Niveau 1 : l'objectif d'organisation */}
            <div className="okr-level rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/[0.08] to-transparent p-6">
              <span className="mb-3 block font-mono text-caption uppercase tracking-[0.22em] text-cyan-400">
                {t('enterprise.okr.orgLabel')}
              </span>
              <div className="space-y-2">
                <div className="h-2 w-3/4 rounded-full bg-white/25" />
                <div className="h-2 w-1/2 rounded-full bg-white/10" />
              </div>
            </div>

            <Connector />

            {/* Niveau 2 : deux OKR d'équipe */}
            <div className="okr-level grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-white/[0.08] bg-[#0A0C11] p-5">
                  <span className="mb-3 block font-mono text-caption uppercase tracking-[0.22em] text-slate-500">
                    {t('enterprise.okr.teamLabel')}
                  </span>
                  <div className="space-y-2">
                    <div className="h-1.5 w-full rounded-full bg-white/20" />
                    <div className="h-1.5 w-2/3 rounded-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>

            <Connector />

            {/* Niveau 3 : les résultats clés chiffrés */}
            <div className="okr-level rounded-xl border border-white/[0.08] bg-[#0A0C11] p-6">
              <span className="mb-5 block font-mono text-caption uppercase tracking-[0.22em] text-slate-500">
                {t('enterprise.okr.krLabel')}
              </span>
              <div className="space-y-5">
                {KEY_RESULTS.map(({ progress, done }, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`h-1.5 rounded-full ${done ? 'bg-white/30' : 'bg-white/15'}`} style={{ width: `${58 - i * 8}%` }} />
                      <span
                        className={`font-mono text-caption tabular-nums ${done ? 'text-[#F5B942]' : 'text-slate-500'}`}
                      >
                        {progress}%
                      </span>
                    </div>
                    {/* Piste + remplissage : la largeur est en CSS, l'animation
                        ne fait que révéler le remplissage par `scaleX`. */}
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className={`okr-fill h-full rounded-full ${done ? 'bg-[#F5B942]' : 'bg-cyan-400/80'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/** Trait vertical entre deux niveaux de la cascade. */
const Connector: React.FC = () => (
  <div className="flex h-10 items-stretch justify-center" aria-hidden="true">
    <span className="okr-connector w-px bg-gradient-to-b from-cyan-400/50 to-cyan-400/10" />
  </div>
);

export default OkrSection;
