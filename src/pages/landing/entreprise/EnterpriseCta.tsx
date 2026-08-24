import React, { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import ScrollHighlight from './ScrollHighlight';
import { pauseWhenOffscreen } from '../pause-offscreen';

interface EnterpriseCtaProps {
  onDemo: () => void;
  onRegister: () => void;
}

/**
 * Clôture du track entreprise.
 *
 * Deux lignes qui montent depuis leur masque, un halo conique qui tourne, et
 * les deux seules sorties possibles : créer l'organisation, ou voir la démo.
 */
const EnterpriseCta: React.FC<EnterpriseCtaProps> = ({ onDemo, onRegister }) => {
  const { t } = useT('landing');
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.ent-cta-line', {
          yPercent: 112,
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.13,
          scrollTrigger: { trigger: '.ent-cta-card', start: 'top 82%', once: true },
        });

        // Le halo est flouté à 60px : le laisser tourner hors écran coûte du
        // GPU pour rien (même garde-fou que la CTA du track perso).
        const halo = rootRef.current?.querySelector('.ent-cta-halo');
        if (halo) {
          const loop = gsap.to(halo, { rotation: 360, ease: 'none', duration: 18, repeat: -1 });
          pauseWhenOffscreen(halo, [loop]);
        }
      });
    },
    { scope: rootRef },
  );

  return (
    <section ref={rootRef} className="border-t border-white/[0.06] py-24 lg:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="ent-cta-card relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.07] to-transparent p-10 text-center sm:p-14">
          <div
            className="ent-cta-halo pointer-events-none absolute -inset-[45%] opacity-30"
            aria-hidden="true"
            style={{
              background:
                'conic-gradient(from 0deg, rgba(34,211,238,0.4), transparent 30%, rgba(245,185,66,0.22) 55%, transparent 75%, rgba(34,211,238,0.4))',
              filter: 'blur(60px)',
            }}
          />

          <div className="relative z-10">
            <h2 className="mb-6 text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl lg:text-5xl">
              <span className="block overflow-hidden">
                <span className="ent-cta-line block text-white">{t('enterprise.cta.line1')}</span>
              </span>
              <span className="block overflow-hidden">
                <span className="ent-cta-line block bg-gradient-to-r from-cyan-200 to-teal-200 bg-clip-text text-transparent">
                  {t('enterprise.cta.line2')}
                </span>
              </span>
            </h2>

            <p className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-slate-400">
              <ScrollHighlight text={t('enterprise.cta.subtitle')} />
            </p>

            <div className="flex flex-col justify-center gap-3.5 sm:flex-row">
              <button
                onClick={onRegister}
                className="group flex items-center justify-center gap-2.5 rounded-xl bg-cyan-400 px-7 py-4 text-base font-bold text-[#04141A] shadow-[0_10px_40px_-10px_rgba(34,211,238,0.85)] transition-[background-color,box-shadow] duration-300 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090C]"
              >
                {t('enterprise.cta.primary')}
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>
              <button
                onClick={onDemo}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-7 py-4 text-base font-semibold text-white backdrop-blur-md transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {t('enterprise.cta.secondary')}
              </button>
            </div>

            <p className="mt-5 text-xs text-slate-600">{t('enterprise.cta.note')}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseCta;
