// ═══════════════════════════════════════════════════════════════════
// La pile de captures du hero ENTREPRISE (maquette 124, 2026-09-23)
// ═══════════════════════════════════════════════════════════════════
//
// POURQUOI UN COMPOSANT MAISON, et plus `reactbits/CardSwap`. CardSwap étalait
// la pile VERS LA DROITE (la carte du fond sortait de l'écran à 1440 px), ne
// savait pas s'arrêter, et n'exposait aucun moyen de choisir une vue. Ici :
//   - la pile REMONTE vers l'origine du faisceau (`LightRays`, top-center) :
//     c'est ce qui fait que la lumière éclaire enfin le produit ;
//   - la fenêtre de devant ACCROCHE la lumière sur son arête (liseré + reflet),
//     c'est la signature de la page, et la seule ;
//   - la légende dit quelle vue est affichée et quand la suivante arrive, et
//     un clic l'affiche ET met la rotation en pause.
//
// ⚠️ ELLE DOIT POUVOIR S'ARRÊTER (C-69, WCAG 2.2.2, niveau A) : états
// `auto` / `pause` / `lecture` du module partagé `rotation-state.ts`,
// suspension au survol et au focus, arrêt hors écran, et AUCUN démarrage
// automatique sous `prefers-reduced-motion`. La pile qu'elle remplace tournait
// indéfiniment sans aucun de ces quatre garde-fous.
//
// Sur téléphone, une seule fenêtre, fixe (maquette 125) : la pile était
// jusque-là `hidden lg:block`, et un décideur sur mobile ne voyait AUCUNE
// capture produit.
import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { etatApresAppui, rotationDemandee, type EtatRotation } from '@/components/showcase/rotation-state';
import type { AppShotRef } from './data';

/** Cadence de la rotation. La jauge de la légende la rend visible. */
const ROTATION_MS = 3800;
/** Décalage vertical entre deux fenêtres de la pile, en px. */
const PAS_Y = 46;
const PAS_ECHELLE = 0.06;
const LUMINOSITE = [1, 0.62, 0.4];
/** Place réservée au-dessus de la fenêtre de devant pour les deux du fond. */
const RESERVE_HAUT = PAS_Y * 2;

/** `/screenshots/entreprise/projets.webp` → `cosmo.app/entreprise/projets`. */
const adresse = (image: string) => `cosmo.app/entreprise/${image.split('/').pop()?.replace('.webp', '') ?? ''}`;

interface FenetreProps {
  shot: AppShotRef;
  label: string;
  alt: string;
  devant: boolean;
  eager: boolean;
}

/** Une fenêtre produit : barre en casse de phrase (plus de capitales espacées). */
const Fenetre: React.FC<FenetreProps> = ({ shot, label, alt, devant, eager }) => (
  <figure className="relative overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#0d1015] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
    <div className="flex h-10 items-center gap-2 border-b border-white/[0.06] bg-ent-acier px-3.5 text-label text-ent-brume">
      <span className="flex gap-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[#3a414c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3a414c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3a414c]" />
      </span>
      <figcaption className="ml-2 font-medium text-ent-lune">{label}</figcaption>
      <span className="ml-auto hidden truncate font-data text-caption text-[#5d6778] sm:block" aria-hidden="true">
        {adresse(shot.image)}
      </span>
    </div>
    <img
      src={shot.image}
      alt={devant ? alt : ''}
      width={2102}
      height={1208}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="block aspect-[2102/1208] w-full object-cover object-top"
    />
    {/* LA SIGNATURE : l'arête accroche la lumière, et un reflet léger tombe sur
        la vitre. Seulement sur la fenêtre de devant — celles du fond sont dans
        l'ombre, c'est ce qui les fait lire comme « derrière ». */}
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[8%] top-0 h-px"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(190,245,255,0.95), transparent)' }}
      initial={false}
      animate={{ opacity: devant ? 1 : 0 }}
      transition={{ duration: 0.5 }}
    />
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ background: 'linear-gradient(180deg, rgba(34,211,238,0.10), transparent 28%)' }}
      initial={false}
      animate={{ opacity: devant ? 1 : 0 }}
      transition={{ duration: 0.5 }}
    />
  </figure>
);

interface HeroStackProps {
  shots: AppShotRef[];
  /** Téléphone : une seule fenêtre, sans rotation (maquette 125). */
  simple?: boolean;
}

const HeroStack: React.FC<HeroStackProps> = ({ shots, simple = false }) => {
  const { t } = useT('landing');
  const { t: tCommon } = useT('common');

  const racineRef = useRef<HTMLDivElement>(null);
  const inView = useInView(racineRef, { amount: 0.25 });
  const mouvementReduit = !!useReducedMotion();
  const [etat, setEtat] = useState<EtatRotation>('auto');
  const [suspendu, setSuspendu] = useState(false);
  const demandee = rotationDemandee(etat, mouvementReduit);
  const enMarche = !simple && demandee && inView && !suspendu;

  // `ordre[0]` est la fenêtre de devant ; `sortant` celle qui vient de passer
  // au fond, pour lui jouer sa descente au lieu d'une téléportation.
  const [ordre, setOrdre] = useState(() => shots.map((_, i) => i));
  const [sortant, setSortant] = useState<number | null>(null);

  // L'effet dépend de `ordre` : le minuteur lit toujours l'ordre courant, et
  // repart à plein à chaque rotation comme à chaque reprise.
  useEffect(() => {
    if (!enMarche) return;
    const id = setTimeout(() => {
      setSortant(ordre[0]);
      setOrdre([...ordre.slice(1), ordre[0]]);
    }, ROTATION_MS);
    return () => clearTimeout(id);
  }, [enMarche, ordre]);

  const montrer = (i: number) => {
    setSortant(null);
    setOrdre((o) => [i, ...o.filter((x) => x !== i)]);
    setEtat('pause');
  };

  if (simple) {
    const shot = shots[0];
    return (
      <div className="mx-auto w-full max-w-md">
        <Fenetre shot={shot} label={t(shot.labelKey)} alt={t(shot.altKey)} devant eager />
      </div>
    );
  }

  const devant = ordre[0];

  return (
    <div
      ref={racineRef}
      // Le survol et le focus SUSPENDENT, sans changer l'état demandé.
      onPointerEnter={() => setSuspendu(true)}
      onPointerLeave={() => setSuspendu(false)}
      onFocusCapture={() => setSuspendu(true)}
      onBlurCapture={() => setSuspendu(false)}
    >
      <div className="relative" style={{ paddingTop: RESERVE_HAUT }}>
        {/* Gabarit invisible : il donne sa hauteur à la pile, quelle que soit la
            fenêtre au premier plan (toutes les fenêtres absolues). */}
        <div className="invisible" aria-hidden="true">
          <div className="h-10" />
          <div className="aspect-[2102/1208]" />
        </div>

        {shots.map((shot, i) => {
          const pos = ordre.indexOf(i);
          const descend = sortant === i && pos === shots.length - 1;
          const cible = {
            y: -pos * PAS_Y,
            scale: 1 - pos * PAS_ECHELLE,
            filter: `brightness(${LUMINOSITE[pos] ?? 0.4})`,
          };
          return (
            <motion.div
              key={shot.id}
              className="absolute inset-x-0"
              style={{ top: RESERVE_HAUT, zIndex: 10 - pos, transformOrigin: 'top center' }}
              aria-hidden={pos !== 0}
              initial={false}
              animate={
                descend
                  ? {
                      // La fenêtre de devant DESCEND et s'efface, puis réapparaît
                      // au fond — la chorégraphie de CardSwap, conservée.
                      y: [0, 70, cible.y],
                      opacity: [1, 0, 1],
                      scale: [1, 1, cible.scale],
                      filter: ['brightness(1)', 'brightness(1)', cible.filter],
                    }
                  : { ...cible, opacity: 1 }
              }
              transition={
                descend
                  ? { duration: 1.1, times: [0, 0.45, 1], ease: [0.22, 1, 0.36, 1] }
                  : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
              }
            >
              <Fenetre shot={shot} label={t(shot.labelKey)} alt={t(shot.altKey)} devant={pos === 0} eager={i === 0} />
            </motion.div>
          );
        })}
      </div>

      {/* ── Légende : la vue affichée, la suivante, et la pause ── */}
      <div className="mt-5 flex items-center justify-center gap-2 sm:gap-6" role="group" aria-label={t('enterprise.hero.stackLabel')}>
        {shots.map((shot, i) => {
          const actif = i === devant;
          const nom = t(shot.labelKey);
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => montrer(i)}
              aria-pressed={actif}
              aria-label={t('enterprise.hero.showView', { name: nom })}
              className={`relative inline-flex min-h-11 items-center px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ent-faisceau/70 rounded-md ${
                actif ? 'text-ent-lune' : 'text-ent-brume hover:text-ent-lune'
              }`}
            >
              {nom}
              <span className="absolute inset-x-2 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-ent-brume/20" aria-hidden="true">
                {actif && (
                  <span
                    key={`${devant}-${enMarche}`}
                    className="ent-jauge block h-full origin-left bg-ent-faisceau"
                    style={{
                      animationDuration: `${ROTATION_MS}ms`,
                      // Figée tant que la pile ne tourne pas ; pleine si elle est
                      // arrêtée par choix, pour ne pas mimer un compte à rebours.
                      animationPlayState: enMarche ? 'running' : 'paused',
                      transform: demandee ? undefined : 'scaleX(1)',
                      animationName: demandee ? undefined : 'none',
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setEtat((e) => etatApresAppui(e, mouvementReduit))}
          aria-pressed={!demandee}
          aria-label={demandee ? tCommon('showcase.pause') : tCommon('showcase.play')}
          className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-ent-brume transition-colors hover:bg-white/[0.06] hover:text-ent-lune focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ent-faisceau/70"
        >
          {demandee ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

export default HeroStack;
