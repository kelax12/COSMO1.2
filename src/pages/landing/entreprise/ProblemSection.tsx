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
 * Trois objections qu'un décideur a déjà formulées lui-même, puis la bascule.
 * Les cartes montent en décalé au scroll ; la phrase de bascule est révélée mot
 * à mot pour marquer le changement de rythme.
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

        // Bascule : les mots s'allument un à un (opacité seule — le texte est
        // déjà à sa place, aucun transform ne le porte).
        gsap.fromTo(
          '.pivot-word',
          { opacity: 0.14 },
          {
            opacity: 1,
            duration: 0.05,
            ease: 'none',
            stagger: 0.05,
            scrollTrigger: { trigger: '.pivot-line', start: 'top 78%', end: 'bottom 55%', scrub: 0.5 },
          },
        );
      });
    },
    { scope: rootRef },
  );

  const pivot = t('enterprise.problem.pivot');

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

        <p className="pivot-line mx-auto mt-16 max-w-3xl text-balance text-center text-xl font-medium leading-snug text-white sm:text-2xl lg:text-3xl">
          {pivot.split(' ').map((word, index) => (
            <span key={`${word}-${index}`} className="pivot-word">
              {word}{' '}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
};

export default ProblemSection;
