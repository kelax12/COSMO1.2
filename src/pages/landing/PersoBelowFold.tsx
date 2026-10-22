// Le bas du parcours perso : tout ce qui suit le bandeau, dans son propre chunk.
//
// 🔴 POURQUOI UN CHUNK (2026-10-22, TBT mobile de `/`). `BelowFold` ne monte
// cette partie qu'au premier geste depuis le 2026-10-16, mais `PersoTrack`
// l'importait en statique : ses modules (les cinq vitrines et `ShowcaseTheme`,
// les solutions, la FAQ, la CTA) étaient ÉVALUÉS au chargement avec le chunk de
// la landing, pour un rendu qui n'arrivait qu'au geste. Mesuré à CPU ×4, 412 px :
// l'évaluation du chunk `LandingPage` pesait une tâche de 130 à 210 ms, dont le
// premier `toLocaleDateString` de la page (initialisation ICU, appelée au niveau
// module par une vitrine). Lighthouse ne fait aucun geste : ce code ne lui
// coûte plus rien.
//
// Le prix : au premier geste, le chunk doit arriver avant de se peindre.
// L'emplacement de `BelowFold` (200vh) reste en place pendant ce temps, donc rien
// ne saute. ⚠️ Une ancre du sommaire cliquée avant l'arrivée du chunk ne trouve
// pas sa cible : le navigateur pose le hash sans défiler. `useSuivreAncre` défile
// vers elle au montage.
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import FeaturesSection from './FeaturesSection';
import SolutionsSection from './SolutionsSection';
import WhySection from './WhySection';
import FaqSection from './FaqSection';

interface PersoBelowFoldProps {
  isMobile: boolean;
  onDemo: () => void;
  onRegister: () => void;
  onFeatureClick: (path: string) => void;
}

/**
 * Au montage : les ScrollTrigger posés avant (hero, barre de progression, pied
 * de page) ont mesuré une page sans cette partie, et une ancre visée pendant le
 * chargement du chunk n'a pas été suivie. On recale les uns, on rejoint l'autre.
 */
function useSuivreAncre(): void {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const cible = id ? document.getElementById(id) : null;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cible?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
    const appel = gsap.delayedCall(0.15, () => ScrollTrigger.refresh());
    return () => {
      appel.kill();
    };
    // Une seule fois, au montage : c'est l'arrivée du chunk qu'on rattrape.
  }, []);
}

const PersoBelowFold: React.FC<PersoBelowFoldProps> = ({ isMobile, onDemo, onRegister, onFeatureClick }) => {
  useSuivreAncre();
  return (
    <>
      <FeaturesSection isMobile={isMobile} handleFeatureClick={onFeatureClick} />

      <SolutionsSection handleFeatureClick={onFeatureClick} />

      <WhySection />

      {/* ── Section FAQ ── */}
      <FaqSection />

      <PersoCta onDemo={onDemo} onRegister={onRegister} />
    </>
  );
};

/**
 * La CTA finale. Composant à part depuis le 2026-10-16 : elle est montée avec
 * `BelowFold`, au premier geste, et ses tweens doivent naître avec elle. Créés
 * au montage du parcours, ils ne trouvaient pas encore leurs cibles.
 */
const PersoCta: React.FC<{ onDemo: () => void; onRegister: () => void }> = ({ onDemo, onRegister }) => {
  const { t } = useT('landing');
  const ctaRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Reveal des 2 lignes de la CTA finale (masquées, montée décalée).
        gsap.from('.cta-line', {
          yPercent: 110,
          duration: 0.8,
          ease: 'power3.out',
          stagger: 0.14,
          scrollTrigger: { trigger: '.cta-card', start: 'top 80%', once: true },
        });

        // Deux filets d'encre encadrent le titre de la CTA. Ils se
        // dessinent UNE FOIS, à l'arrivée de la carte, puis ne coûtent plus
        // rien — c'est la règle déjà écrite pour le hero (« le hero ne doit
        // rien coûter une fois l'entrée finie »), enfin appliquée ici.
        //
        // 🔴 Ils remplacent un `conic-gradient` en `filter: blur(60px)` mis en
        // ROTATION INFINIE. C'est exactement le motif que l'audit A-8 du
        // 2026-09-03 a fait retirer du hero, où neutraliser les seuls
        // `filter: blur` ramenait la page de 2 856 ms bloquées sur 4 000 à
        // 259. Il avait survécu dans cette carte, et la DA blanche l'a rendu
        // presque invisible : il ne restait que la facture. Ne jamais le
        // remettre, ici pas plus qu'ailleurs.
        gsap.from('.cta-rule', {
          scaleX: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: '.cta-card', start: 'top 80%', once: true },
        });
      });
    },
    { scope: ctaRef },
  );

  // W6 — Count-ups de la CTA finale : les chiffres montent de 0 à leur
  // valeur (déjà présente dans le markup = fallback reduced-motion).
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<HTMLElement>('[data-countup]').forEach((el) => {
          const end = Number(el.dataset.countup);
          if (!Number.isFinite(end)) return;
          const counter = { v: 0 };
          gsap.to(counter, {
            v: end,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = String(Math.round(counter.v));
            },
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          });
        });
      });
    },
    { scope: ctaRef },
  );

  return (
    <section ref={ctaRef} className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="cta-card bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 shadow-[0_24px_60px_-30px_rgba(37,99,235,0.45)] rounded-3xl p-12 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/[0.04] to-violet-500/[0.04] z-0"></div>
          {/* Filets d'encre : ils se dessinent avec la carte, une fois.
              ⚠️ Le centrage passe par `inset-x-0 mx-auto`, jamais par
              `-translate-x-1/2` : GSAP anime `scaleX` sur ces éléments, et
              il fige alors le centrage en pixels — la ligne se décalerait au
              premier redimensionnement. */}
          <span
            className="cta-rule pointer-events-none absolute inset-x-0 top-6 mx-auto h-px w-2/3 origin-center bg-gradient-to-r from-transparent via-blue-600/45 to-transparent"
            aria-hidden="true"
          />
          <span
            className="cta-rule pointer-events-none absolute inset-x-0 bottom-6 mx-auto h-px w-2/3 origin-center bg-gradient-to-r from-transparent via-violet-600/40 to-transparent"
            aria-hidden="true"
          />

          <div className="relative z-10">
            {/* Lignes masquées : révélées par montée décalée (GSAP) */}
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              <span className="block overflow-hidden">
                <span className="cta-line block bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  {t('cta.line1')}
                </span>
              </span>
              <span className="block overflow-hidden">
                <span className="cta-line block bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  {t('cta.line2')}
                </span>
              </span>
            </h2>
            <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
              {t('cta.subtitle')}
            </p>
            {/*
              Count-ups : la démo est pré-remplie, chiffres animés (GSAP).

              🔴 `role="img"` n'est pas décoratif : les enfants sont
              `aria-hidden` (ils sont animés), donc le sens ne tient qu'à
              l'`aria-label`. Sans rôle, `aria-label` est INTERDIT sur un
              `div` (axe `aria-prohibited-attr`, `serious`) : le bloc était
              entièrement muet pour un lecteur d'écran. Mesuré le 2026-09-04.
            */}
            <div
              role="img"
              className="flex items-center justify-center gap-8 mb-10 text-slate-600"
              aria-label={t('cta.statsAria')}
            >
              {[
                { value: 100, label: t('cta.tasks') },
                { value: 100, label: t('cta.habits') },
                { value: 150, label: t('cta.events') },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <span data-countup={value} className="text-3xl lg:text-4xl font-bold tabular-nums bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent" aria-hidden="true">
                    {value}
                  </span>
                  <span className="text-xs uppercase tracking-widest text-slate-500" aria-hidden="true">{label}</span>
                </div>
              ))}
            </div>
            {/* Même hiérarchie que le hero : la démo en bleu plein, l'inscription
                en blanc avec la seule flèche. Cette carte l'inversait, et un
                `hover:scale-105` sur les deux faisait bouger le texte au survol. */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onDemo}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-semibold text-base tracking-[-0.01em] transition-[box-shadow,background-color] duration-300 shadow-[0_8px_30px_-8px_rgba(37,99,235,0.55)] hover:shadow-[0_12px_38px_-8px_rgba(37,99,235,0.7)] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {t('cta.tryDemo')}
              </button>
              <button
                onClick={onRegister}
                className="group bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-8 py-4 rounded-full font-semibold text-base tracking-[-0.01em] shadow-sm transition-[box-shadow,background-color] duration-300 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t('cta.startNow')}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PersoBelowFold;
