// Le bas du parcours perso : tout ce qui suit le bandeau, dans son propre chunk.
//
// Pourquoi un chunk : `BelowFold` ne monte cette partie qu'au premier geste, mais
// `PersoTrack` l'importait en statique : ses modules (cinq vitrines, solutions,
// FAQ, CTA) étaient ÉVALUÉS au chargement avec le chunk de la landing, pour un
// rendu qui n'arrivait qu'au geste (une tâche de 130 à 210 ms à CPU ×4).
//
// Le prix : au premier geste, le chunk doit arriver avant de se peindre.
// L'emplacement de `BelowFold` (200vh) reste en place pendant ce temps, donc rien
// ne saute. ⚠️ Une ancre du sommaire cliquée avant l'arrivée du chunk ne trouve
// pas sa cible : `useSuivreAncre` défile vers elle au montage.
import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TUILES } from './hero-tuiles';
import { gsap, ScrollTrigger } from '@/lib/gsap';
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
 * La CTA finale. Composant à part : elle est montée avec
 * `BelowFold`, au premier geste, et ses tweens doivent naître avec elle. Créés
 * au montage du parcours, ils ne trouvaient pas encore leurs cibles.
 */
const PersoCta: React.FC<{ onDemo: () => void; onRegister: () => void }> = ({ onDemo, onRegister }) => {
  const { t } = useT('landing');
  // Maquette 20 : la page se referme sur son ouverture. Les cinq tuiles du hero
  // reviennent en rangée, chacune avec son inclinaison, puis flottent comme au
  // hero (`.hero-tile-idle`). Plus de carte teintée, de filets ni de compteurs
  // (les « 100 / 150 » étaient faux, cf. le test des promesses).
  const reduceMotion = useReducedMotion();
  return (
    <section className="py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center gap-3 mb-10" aria-hidden="true">
          {TUILES.map(({ cle, Icone, degrade }, i) => {
            const r = (i - 2) * 4;
            return (
              <motion.div
                key={cle}
                initial={reduceMotion ? false : { opacity: 0, y: 28, rotate: 0, scale: 0.7 }}
                whileInView={{ opacity: 1, y: 0, rotate: r, scale: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: i * 0.09 }}
              >
                <div
                  className="hero-tile-idle"
                  style={{ ['--r' as string]: '0deg', ['--dur' as string]: `${7 + i * 0.9}s`, ['--di' as string]: `${1200 + i * 90}ms` }}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${degrade} ring-1 ring-slate-900/10`}>
                    <Icone className="h-7 w-7 text-white" strokeWidth={1.75} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
        >
          <h2 className="text-4xl lg:text-5xl font-bold tracking-[-0.04em] leading-[1.02] text-slate-900 mb-5">
            {t('cta.line1')}
            <br />
            {t('cta.line2')}
          </h2>
          <p className="text-lg text-slate-500 mb-9 max-w-xl mx-auto leading-[1.55]">
            {t('cta.subtitle')}
          </p>
          {/* Même hiérarchie que le hero : la démo en bleu plein, l'inscription
              en blanc avec la seule flèche. */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onDemo}
              className="bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 rounded-full font-semibold text-[15px] tracking-[-0.01em] transition-colors duration-300 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {t('cta.tryDemo')}
            </button>
            <button
              onClick={onRegister}
              className="group bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-7 py-3.5 rounded-full font-semibold text-[15px] tracking-[-0.01em] transition-colors duration-300 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {t('cta.startNow')}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PersoBelowFold;
