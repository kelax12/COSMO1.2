import React, { useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { LayoutList, SquareKanban, CalendarRange } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import AppShot from './AppShot';
import StepSection from './StepSection';
import { SHOTS, type AppShotRef } from './data';

/** Ce qu'on peut faire d'un projet une fois l'organisation en place. */
const POINTS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.projects.p1t', bodyKey: 'enterprise.projects.p1d' },
  { titleKey: 'enterprise.projects.p2t', bodyKey: 'enterprise.projects.p2d' },
  { titleKey: 'enterprise.projects.p3t', bodyKey: 'enterprise.projects.p3d' },
];

/** Les trois lectures d'un même projet, dans l'ordre où le scroll les montre. */
const VIEWS: { shot: AppShotRef; labelKey: KeyOf<'landing'>; Icon: typeof LayoutList }[] = [
  { shot: SHOTS.projects, labelKey: 'enterprise.projects.viewList', Icon: LayoutList },
  { shot: SHOTS.projectsKanban, labelKey: 'enterprise.projects.viewKanban', Icon: SquareKanban },
  { shot: SHOTS.projectsPlanning, labelKey: 'enterprise.projects.viewPlanning', Icon: CalendarRange },
];

/** Unités de timeline : 1 maintien par vue, un fondu à cheval sur chaque frontière. */
const HOLD = 1;
const FADE = 0.5;

/**
 * Étape 2 — les projets, et surtout l'échelle à laquelle on les attribue.
 *
 * Le point que la page ne disait pas : une tâche de projet s'assigne à qui on
 * veut dans son périmètre, d'une personne à toute une équipe, et la personne
 * assignée la retrouve dans son propre Cosmo. C'est ce qui distingue le mode
 * entreprise d'un tableau partagé de plus.
 *
 * La scène est un DECK ÉPINGLÉ : le scroll est capturé le temps de dérouler les
 * trois lectures d'un même projet — Liste, Tableau, Planning — puis rendu au
 * défilement normal une fois la 3ᵉ atteinte. Même mécanique que
 * `landing/FeaturesSection`, dont ce composant reprend le schéma de timeline.
 *
 * ⚠️ ÉCART ASSUMÉ vis-à-vis de `FeaturesSection` / `SolutionsSection` : ces deux
 * sections désactivent complètement leur pin sous `prefers-reduced-motion`. Ici
 * le pin s'arme quand même, parce que le défilement des trois vues EST le
 * contenu de l'étape — le désarmer laisse une capture fixe qui ne démontre plus
 * rien. Ce qu'on retire en reduced-motion, c'est le mouvement continu : le
 * fondu scrubbé devient une coupe franche (cf. `buildSequence`). Le scroll reste
 * capturé, l'image ne bouge plus.
 *
 * ⚠️ Propriété de l'opacité — ne JAMAIS la partager entre React et GSAP :
 *   • épinglé  → GSAP possède `autoAlpha` des captures ; l'état React ne sert
 *     qu'à surligner l'onglet actif, et le style inline reste constant d'un
 *     rendu à l'autre (sinon un re-render écraserait le scrub en cours).
 *   • non épinglé (mobile) → aucun ScrollTrigger, React possède l'opacité.
 */
const ProjectsSection: React.FC = () => {
  const { t } = useT('landing');
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  // L'INSTANCE ScrollTrigger, pour qu'un clic sur un onglet aille au bon endroit.
  //
  // ⚠️ On garde l'instance, pas un instantané `{ start, end }` : ces bornes sont
  // recalculées à chaque `ScrollTrigger.refresh()` — `LandingPage` en déclenche
  // un au changement de parcours, et le chargement des captures change la
  // hauteur du document. Les copier au montage les fige sur des valeurs
  // périmées, et les onglets scrollent alors à côté du pin.
  const triggerRef = useRef<{ start: number; end: number } | null>(null);
  const [viewIndex, setViewIndex] = useState(0);

  // Le pin ne dépend QUE de la largeur : détourner le scroll tactile est
  // hostile, et une scène épinglée ne tient pas dans un viewport de téléphone.
  const pinned = !isMobile;

  useGSAP(
    () => {
      if (!pinned || !deckRef.current) return;

      const shots = gsap.utils.toArray<HTMLElement>('.projects-shot');
      if (shots.length < 2) return;

      gsap.set(shots[0], { autoAlpha: 1 });
      gsap.set(shots.slice(1), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: deckRef.current,
          start: 'top top',
          // Le trigger fait exactement une hauteur de viewport (`min-h-[100svh]`),
          // donc ce pourcentage vaut un viewport par transition quelle que soit
          // la référence retenue par ScrollTrigger.
          end: `+=${(shots.length - 1) * 100}%`,
          pin: true,
          anticipatePin: 1,
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: (self) =>
            setViewIndex(Math.min(shots.length - 1, Math.round(self.progress * (shots.length - 1)))),
        },
      });

      // Rail de durée : `shots.length` unités, une par vue. Les fondus sont
      // posés à cheval sur les frontières, ce qui laisse un maintien franc au
      // début et à la fin — la 3ᵉ vue reste lisible avant que le pin ne lâche.
      tl.to({}, { duration: shots.length * HOLD }, 0);

      shots.forEach((shot, index) => {
        if (index === 0) return;
        const previous = shots[index - 1];
        const at = index * HOLD - FADE / 2;

        if (reduceMotion) {
          // Coupe franche : toujours pilotée par le scroll (donc réversible),
          // mais sans mouvement continu.
          tl.set(previous, { autoAlpha: 0 }, at + FADE / 2).set(shot, { autoAlpha: 1 }, at + FADE / 2);
        } else {
          tl.to(previous, { autoAlpha: 0, duration: FADE }, at).fromTo(
            shot,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: FADE },
            at,
          );
        }
      });

      triggerRef.current = tl.scrollTrigger ?? null;

      return () => {
        triggerRef.current = null;
      };
    },
    { scope: sectionRef, dependencies: [pinned, reduceMotion], revertOnUpdate: true },
  );

  /**
   * Clic sur un onglet. Épinglé, on ne touche pas à l'opacité (elle appartient à
   * GSAP) : on scrolle jusqu'à l'offset de la vue et le scrub fait le reste.
   */
  const goToView = (index: number) => {
    const trigger = triggerRef.current;
    if (!pinned || !trigger) {
      setViewIndex(index);
      return;
    }
    // Bornes lues À L'INSTANT DU CLIC (cf. `triggerRef`). On vise le milieu du
    // palier de la vue plutôt que sa frontière : au ratio exact, le scrub peut
    // retomber sur le fondu voisin.
    const ratio = (index + 0.5) / VIEWS.length;
    window.scrollTo({
      top: trigger.start + (trigger.end - trigger.start) * ratio,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <StepSection
      id="projets"
      step={2}
      titleKey="enterprise.projects.title"
      subtitleKey="enterprise.projects.subtitle"
    >
      <div ref={sectionRef}>
        <div
          ref={deckRef}
          className={pinned ? 'flex min-h-[100svh] flex-col justify-center' : undefined}
        >
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
            <ul className="space-y-6">
              {POINTS.map(({ titleKey, bodyKey }) => (
                <li key={titleKey} className="border-l border-white/[0.12] pl-5">
                  <h3 className="mb-1.5 text-base font-semibold text-white">{t(titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{t(bodyKey)}</p>
                </li>
              ))}
            </ul>

            <div>
              <div className="relative aspect-[16/10]">
                {VIEWS.map(({ shot, labelKey }, index) => (
                  <div
                    key={shot.id}
                    className="projects-shot absolute inset-0"
                    aria-hidden={index === viewIndex ? undefined : true}
                    // Épinglé : valeurs CONSTANTES d'un rendu à l'autre, donc
                    // React ne réécrit jamais l'opacité que GSAP est en train
                    // d'animer. Non épinglé : c'est React qui pilote.
                    style={
                      pinned
                        ? { opacity: index === 0 ? 1 : 0 }
                        : { opacity: index === viewIndex ? 1 : 0, transition: 'opacity 400ms ease-out' }
                    }
                  >
                    <AppShot src={shot.image} alt={t(shot.altKey)} label={t(labelKey)} />
                  </div>
                ))}
              </div>

              {/* Onglets de vue — même grammaire que la vraie barre d'outils
                  Projets (`ProjectsToolbar`, `ViewTab`) : un bouton `aria-pressed`,
                  pas un contrat ARIA « tabs » qu'on ne tiendrait qu'à moitié.
                  Le scroll fait défiler les vues, mais rien n'oblige à scroller
                  pour les atteindre (clavier, lecteur d'écran, mobile). */}
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {VIEWS.map(({ shot, labelKey, Icon }, index) => (
                  <button
                    key={shot.id}
                    type="button"
                    aria-pressed={index === viewIndex}
                    onClick={() => goToView(index)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-caption uppercase tracking-[0.16em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                      index === viewIndex
                        ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-200'
                        : 'border-white/[0.08] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon size={12} aria-hidden="true" />
                    {t(labelKey)}
                  </button>
                ))}
              </div>

              {/* L'invite ne s'affiche que là où le scroll fait réellement
                  quelque chose — donc conditionnée au pin, pas à la motion. */}
              {pinned && (
                <p className="mt-2 text-center font-mono text-caption uppercase tracking-[0.2em] text-slate-600">
                  {t('enterprise.projects.scrollHint')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </StepSection>
  );
};

export default ProjectsSection;
