import React, { useRef } from 'react';
import { Check } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS } from './data';

const BULLETS: KeyOf<'landing'>[] = ['enterprise.okr.b1', 'enterprise.okr.b2', 'enterprise.okr.b3'];

/**
 * Trois OKR d'équipe de démonstration, chacun avec ses propres résultats
 * clés — plutôt qu'un seul tas de barres dont on ne sait plus quel objectif
 * elles mesurent. Les chiffres restent illustratifs, et l'exemple reprend
 * l'organisation « Nova Studio » du mode démo.
 */
const TEAM_OKRS: {
  dotClassName: string;
  teamKey: KeyOf<'landing'>;
  objectiveKey: KeyOf<'landing'>;
  keyResults: { progress: number; done: boolean; labelKey: KeyOf<'landing'> }[];
}[] = [
  {
    dotClassName: 'bg-fuchsia-500',
    teamKey: 'enterprise.okr.team1Team',
    objectiveKey: 'enterprise.okr.team1Objective',
    keyResults: [
      { progress: 100, done: true, labelKey: 'enterprise.okr.team1Kr1' },
      { progress: 82, done: false, labelKey: 'enterprise.okr.team1Kr2' },
    ],
  },
  {
    dotClassName: 'bg-blue-500',
    teamKey: 'enterprise.okr.team2Team',
    objectiveKey: 'enterprise.okr.team2Objective',
    keyResults: [
      { progress: 74, done: false, labelKey: 'enterprise.okr.team2Kr1' },
      { progress: 45, done: false, labelKey: 'enterprise.okr.team2Kr2' },
    ],
  },
  {
    dotClassName: 'bg-emerald-500',
    teamKey: 'enterprise.okr.team3Team',
    objectiveKey: 'enterprise.okr.team3Objective',
    keyResults: [
      { progress: 88, done: false, labelKey: 'enterprise.okr.team3Kr1' },
      { progress: 60, done: false, labelKey: 'enterprise.okr.team3Kr2' },
    ],
  },
];

/**
 * Étape 3 — poser les objectifs, à toutes les échelles.
 *
 * La cascade objectif d'organisation → OKR d'équipe → résultats clés. Le
 * point à faire passer est que le mécanisme est le MÊME à chaque niveau :
 * une organisation, une équipe, un résultat chiffré.
 *
 * Les barres de progression se remplissent au scroll via `scaleX` sur une
 * couche dédiée, la largeur finale restant définie en CSS : si l'animation ne
 * joue pas (reduced-motion), les barres sont simplement déjà pleines.
 */
const OkrSection: React.FC = () => {
  const { t } = useT('landing');
  const rootRef = useRef<HTMLDivElement>(null);

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
    <StepSection
      id="okr"
      step={4}
      titleKey="enterprise.okr.title"
      subtitleKey="enterprise.okr.subtitle"
    >
      <div ref={rootRef}>
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-16">
          {/* ── Le discours ── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ul className="mb-10 space-y-3.5">
              {BULLETS.map((key) => (
                <li key={key} className="flex gap-3 text-sm leading-relaxed text-slate-400">
                  <Check size={16} className="mt-0.5 shrink-0 text-cyan-400" aria-hidden="true" />
                  {t(key)}
                </li>
              ))}
            </ul>

            <div className="aspect-[16/10]">
              <AppShot
                src={SHOTS.okr.image}
                alt={t(SHOTS.okr.altKey)}
                label={t(SHOTS.okr.labelKey)}
              />
            </div>
          </div>

          {/* ── La cascade ── */}
          <div className="okr-cascade flex flex-col items-stretch">
            {/* Niveau 1 : l'objectif d'organisation */}
            <div className="okr-level rounded-xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/[0.08] to-transparent p-6">
              <span className="mb-3 block font-mono text-caption uppercase tracking-[0.22em] text-cyan-400">
                {t('enterprise.okr.orgLabel')}
              </span>
              <p className="text-base font-semibold leading-snug text-white">
                {t('enterprise.okr.orgExample')}
              </p>
            </div>

            <Connector />

            {/* Niveau 2 : trois OKR d'équipe, chacun avec ses propres résultats clés */}
            <div className="okr-level space-y-3">
              {TEAM_OKRS.map(({ dotClassName, teamKey, objectiveKey, keyResults }) => (
                <div key={teamKey} className="rounded-xl border border-white/[0.08] bg-[#0A0C11] p-5">
                  <span className="mb-2.5 flex items-center gap-2 font-mono text-caption uppercase tracking-[0.22em] text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} aria-hidden="true" />
                    {t(teamKey)}
                  </span>
                  <p className="mb-4 text-sm font-medium leading-snug text-slate-200">{t(objectiveKey)}</p>

                  <span className="mb-3 block font-mono text-[0.65rem] uppercase tracking-[0.22em] text-slate-600">
                    {t('enterprise.okr.krLabel')}
                  </span>
                  <div className="space-y-3">
                    {keyResults.map(({ progress, done, labelKey }) => (
                      <div key={labelKey} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm leading-snug text-slate-300">{t(labelKey)}</span>
                          <span
                            className={`shrink-0 font-mono text-caption tabular-nums ${done ? 'text-[#F5B942]' : 'text-slate-500'}`}
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </StepSection>
  );
};

/** Trait vertical entre deux niveaux de la cascade. */
const Connector: React.FC = () => (
  <div className="flex h-10 items-stretch justify-center" aria-hidden="true">
    <span className="okr-connector w-px bg-gradient-to-b from-cyan-400/50 to-cyan-400/10" />
  </div>
);

export default OkrSection;
