import React, { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

// Pas de pictogramme décoratif : une icône générique posée en tête de carte ne
// dit rien que le titre ne dise déjà, et c'est le tic visuel qui fait lire une
// page comme générée. Le titre porte seul.
const PROBLEMS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.problem.p1t', bodyKey: 'enterprise.problem.p1d' },
  { titleKey: 'enterprise.problem.p2t', bodyKey: 'enterprise.problem.p2d' },
  { titleKey: 'enterprise.problem.p3t', bodyKey: 'enterprise.problem.p3d' },
];

/**
 * Le constat, avant la promesse.
 *
 * Trois objections qu'un décideur a déjà formulées lui-même. Les cartes
 * montent en décalé au scroll.
 */
const ProblemSection: React.FC = () => {
  const { t } = useT('landing');
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.problem-card', {
          y: 40,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: '.problem-grid', start: 'top 82%', once: true },
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} className="relative border-t border-white/[0.06] py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-12 max-w-3xl">
          <h2 className="text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl">
            {t('enterprise.problem.title')}
          </h2>
        </header>

        <div className="problem-grid grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] md:grid-cols-3">
          {PROBLEMS.map(({ titleKey, bodyKey }) => (
            <article key={titleKey} className="problem-card bg-[#0A0C11] p-7 lg:p-9">
              <h3 className="mb-3 text-lg font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{t(bodyKey)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
