import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, FolderKanban, LayoutDashboard, ListTodo, UsersRound, type LucideIcon } from 'lucide-react';
import { OkrIcon } from '@/components/icons/cosmo-icons';
import { useT } from '@/i18n/useT';
import { ENTERPRISE_FREE_OFFER } from './free-offer';

interface EnterpriseCtaProps {
  onDemo: () => void;
  onRegister: () => void;
}

/**
 * Les cinq tuiles : les icônes de la barre latérale entreprise (`org-sections.ts`),
 * dans l'ordre de l'app, toutes en bleu COSMO (seule couleur du mode
 * entreprise), le centre un ton plus clair.
 */
const TUILES: { cle: string; Icone: LucideIcon; fond: string }[] = [
  { cle: 'overview', Icone: LayoutDashboard, fond: 'bg-cosmo-500 ring-white/10' },
  { cle: 'tasks', Icone: ListTodo, fond: 'bg-cosmo-500 ring-white/10' },
  { cle: 'okr', Icone: OkrIcon, fond: 'bg-cosmo-400 ring-cosmo-300/40' },
  { cle: 'projects', Icone: FolderKanban, fond: 'bg-cosmo-500 ring-white/10' },
  { cle: 'teams', Icone: UsersRound, fond: 'bg-cosmo-500 ring-white/10' },
];

/**
 * CTA finale du parcours entreprise, sur le modèle de celle du parcours perso
 * (`PersoBelowFold` → `PersoCta`) : une rangée de tuiles inclinées qui entrent
 * puis flottent (`.hero-tile-idle`), le titre sur deux lignes, et deux boutons
 * arrondis. Démo en bleu plein, inscription en contour avec la seule flèche.
 */
const EnterpriseCta: React.FC<EnterpriseCtaProps> = ({ onDemo, onRegister }) => {
  const { t } = useT('landingEnterprise');
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-t border-white/[0.06] py-[75px]">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="mb-10 flex justify-center gap-3" aria-hidden="true">
          {TUILES.map(({ cle, Icone, fond }, i) => {
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
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${fond}`}>
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
          <h2 className="mb-5 text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-white lg:text-5xl">
            {t('enterprise.cta.line1')}
            <br />
            {t('enterprise.cta.line2')}
          </h2>
          <p className="mx-auto mb-9 max-w-xl text-lg leading-[1.55] text-slate-400">
            {t('enterprise.cta.subtitle').replace(/<\/?hl>/g, '')}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={onDemo}
              className="flex items-center justify-center rounded-full bg-cosmo-400 px-7 py-3.5 text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors duration-300 hover:bg-[#388BFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161719]"
            >
              {t('enterprise.cta.secondary')}
            </button>
            <button
              onClick={onRegister}
              className="group flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-7 py-3.5 text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors duration-300 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmo-300"
            >
              {t('enterprise.cta.primary')}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            {t(ENTERPRISE_FREE_OFFER ? 'enterprise.cta.noteFree' : 'enterprise.cta.note')}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default EnterpriseCta;
