// La tuile produit du hero perso : une « icône d'application » posée au-dessus
// du titre, qui change de module toutes les 2,6 s.
//
// POURQUOI ELLE REMPLACE LA FENÊTRE. Le hero perso montrait `AppWindowShowcase`
// en colonne de droite, une fenêtre de 540 px de haut. La refonte du 2026-09-22
// centre le premier écran autour du titre : il n'y a plus de colonne de droite,
// et une fenêtre de 540 px posée au-dessus du H1 repousserait la promesse sous
// la ligne de flottaison. La fenêtre n'est pas perdue pour autant — les quatre
// vitrines qu'elle faisait tourner sont montrées en grand, une par une, dès la
// section suivante (`FeaturesSection`). Ce qui reste ici est ce que le premier
// écran doit dire : une seule application, quatre modules.
//
// 🔴 ELLE GARDE LE MÉCANISME DE PAUSE DE C-69 (WCAG 2.2.2, niveau A). Une
// information qui change seule, toutes les 2,6 s, indéfiniment, doit pouvoir
// être arrêtée — la règle ne dépend pas de la taille de la chose qui bouge, et
// la déplacer d'un composant à l'autre ne l'annule pas. La tuile EST le bouton
// (96 px de côté, très au-dessus des 44 px mesurés par
// `e2e/touch-targets.spec.ts`), elle suspend au survol et au focus, et les
// trois états viennent du module déjà éprouvé `showcase/rotation-state.ts`.
// ⚠️ Le troisième état (`lecture`) reste indispensable : sans lui, une personne
// en mouvement réduit verrait la tuile figée sur « Tâches » pour toujours, et la
// phrase « quatre modules, une seule app » ne tiendrait plus pour elle.
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useT } from '@/i18n/useT';
import {
  etatApresAppui,
  rotationDemandee,
  type EtatRotation,
} from '@/components/showcase/rotation-state';
import { MODULES_HERO } from './hero-modules';

/** Un cran plus lent que la fenêtre d'avant (2 500 ms) : la tuile est petite,
 *  l'œil la lit plus vite, et un changement trop serré se lit comme un clignotement. */
const ROTATION_MS = 2600;

interface Props {
  /** Signale le module affiché : la puce correspondante s'allume en même temps. */
  onModuleChange?: (cle: string) => void;
  /** Retard d'entrée CSS, en ms. */
  delaiEntree?: number;
}

export const HeroAppIcon: React.FC<Props> = ({ onModuleChange, delaiEntree = 0 }) => {
  const { t } = useT('landing');
  const conteneurRef = useRef<HTMLDivElement>(null);
  const inView = useInView(conteneurRef, { amount: 0.4 });
  const mouvementReduit = useReducedMotion();

  const [etat, setEtat] = useState<EtatRotation>('auto');
  const [suspendu, setSuspendu] = useState(false);
  const [index, setIndex] = useState(0);

  const tourneraitSansSuspension = rotationDemandee(etat, !!mouvementReduit);
  const enRotation = inView && !suspendu && tourneraitSansSuspension;

  useEffect(() => {
    if (!enRotation) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MODULES_HERO.length);
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [enRotation]);

  const actif = MODULES_HERO[index];

  // Notifie APRÈS le rendu, jamais pendant : prévenir un parent en cours de
  // rendu déclencherait un rendu imbriqué à chaque rotation.
  useEffect(() => {
    onModuleChange?.(actif.cle);
  }, [actif.cle, onModuleChange]);

  const Icone = actif.Icone;

  return (
    <div
      ref={conteneurRef}
      className="hero-rise relative mb-8 sm:mb-10"
      style={{ ['--d' as string]: `${delaiEntree}ms` }}
      // Le survol et le focus SUSPENDENT, sans changer l'état demandé.
      onPointerEnter={() => setSuspendu(true)}
      onPointerLeave={() => setSuspendu(false)}
      onFocusCapture={() => setSuspendu(true)}
      onBlurCapture={() => setSuspendu(false)}
    >
      {/* Les deux feuilles qui dépassent derrière la tuile : c'est ce qui la
          fait lire comme une PILE d'applications réunies, et non comme un
          logo. Purement décoratif, et fixe — aucune boucle. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 -top-[14px] h-10 w-[4.25rem] -translate-x-1/2 rounded-[1.1rem] bg-slate-900/[0.05]"
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 -top-[7px] h-10 w-[5.25rem] -translate-x-1/2 rounded-[1.3rem] bg-slate-900/[0.09]"
      />

      <button
        type="button"
        onClick={() => setEtat((e) => etatApresAppui(e, !!mouvementReduit))}
        aria-pressed={!tourneraitSansSuspension}
        aria-label={tourneraitSansSuspension ? t('hero.showcasePause') : t('hero.showcasePlay')}
        className="relative block h-24 w-24 overflow-hidden rounded-[1.7rem] shadow-[0_18px_44px_-14px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/10 transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {/* Une seule face à l'écran, jamais deux (`mode="wait"`) : la sortie se
            termine avant que l'entrée commence. Même garantie que la fenêtre
            qu'elle remplace, pour la même raison — deux modules superposés
            diraient l'inverse du message. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={actif.cle}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${actif.tuile}`}
          >
            <Icone size={40} strokeWidth={1.75} className="text-white" aria-hidden="true" />
          </motion.span>
        </AnimatePresence>

        {/* L'état, visible. `aria-pressed` le dit aux technologies
            d'assistance ; ce glyphe le dit à tout le monde, sans ajouter de
            commande concurrente. */}
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/35 text-white/90 backdrop-blur-sm"
        >
          {tourneraitSansSuspension ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
        </span>
      </button>
    </div>
  );
};

export default HeroAppIcon;
