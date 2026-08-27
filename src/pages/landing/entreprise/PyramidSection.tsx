import React, { useMemo, useRef, useState } from 'react';
import { ListTodo, CalendarDays, TrendingUp } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { PYRAMID_NODES, pyramidTree, subtreeOf, SHOTS, type PyramidNode } from './data';
import AppShot from './AppShot';
import StepSection from './StepSection';

/** Onglets ouvrables depuis la fiche membre — même vocabulaire que `MemberTab`
 *  (`src/components/organization/member-sheet.helpers.ts`), sans importer le
 *  module organisation depuis la landing (chunks séparés). */
type PyramidMemberTab = 'tasks' | 'agenda' | 'contribution';

interface PyramidSectionProps {
  /** Ouvre la démo puis la fiche du membre réel, sur l'onglet demandé. */
  onMemberDemo: (demoUserId: string, tab: PyramidMemberTab) => void;
}

/**
 * Ce que la hiérarchie permet, une fois qu'elle est posée.
 *
 * L'organigramme n'est pas un trombinoscope : c'est depuis lui qu'on manage
 * chaque personne. Les deux premières cartes disent la règle (périmètre,
 * réorganisation), les deux suivantes disent les gestes quotidiens qu'elle
 * autorise — c'est ce qui manquait à la page.
 */
const PYRAMID_BENEFITS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.pyramid.b1t', bodyKey: 'enterprise.pyramid.b1d' },
  { titleKey: 'enterprise.pyramid.b2t', bodyKey: 'enterprise.pyramid.b2d' },
  { titleKey: 'enterprise.pyramid.b3t', bodyKey: 'enterprise.pyramid.b3d' },
  { titleKey: 'enterprise.pyramid.b4t', bodyKey: 'enterprise.pyramid.b4d' },
];

/** Demi-hauteur d'une carte, en % du cadre — sert à accrocher les liens. */
const CARD_HALF_H = 7;

/** Message affiché en attente de confirmation, par onglet demandé. */
const DEMO_PROMPT_KEY: Record<PyramidMemberTab, KeyOf<'landing'>> = {
  tasks: 'enterprise.pyramid.demoPromptTasks',
  agenda: 'enterprise.pyramid.demoPromptAgenda',
  contribution: 'enterprise.pyramid.demoPromptContribution',
};

/**
 * Lien parent → enfant, en coude à angle droit — c'est le tracé qu'utilise
 * l'onglet Pyramide de l'application, pas une courbe.
 */
function linkPath(parent: PyramidNode, child: PyramidNode): string {
  const startY = parent.y + CARD_HALF_H;
  const endY = child.y - CARD_HALF_H;
  const midY = (startY + endY) / 2;
  return `M ${parent.x} ${startY} L ${parent.x} ${midY} L ${child.x} ${midY} L ${child.x} ${endY}`;
}

/**
 * Étape 1 — inviter, rattacher, regrouper.
 *
 * C'est le premier geste réel : sans personne dans l'organisation, aucune des
 * trois étapes suivantes n'existe. La section démontre au passage le seul
 * argument qu'on ne trouve nulle part ailleurs : le périmètre de chacun est
 * DÉDUIT de la hiérarchie, et c'est depuis l'organigramme qu'on suit chaque
 * personne.
 *
 * Les cartes reproduisent celles de l'onglet Pyramide de l'application (mêmes
 * membres que le seed démo « Nova Studio », même mise en forme). C'est une
 * reproduction plutôt qu'une capture parce que la scène doit être INTERACTIVE :
 * survoler un manager éteint tout ce qui sort de son sous-arbre, ce qu'une
 * image ne peut pas montrer. La capture de l'écran réel ferme la section.
 */
const PyramidSection: React.FC<PyramidSectionProps> = ({ onMemberDemo }) => {
  const { t } = useT('landing');
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Confirmation à friction avant d'ouvrir la démo : un clic sur une option du
  // menu ne navigue plus tout seul, il pose une demande que ce dialogue seul
  // peut valider ou annuler.
  const [pendingDemo, setPendingDemo] = useState<{
    name: string;
    demoUserId: string;
    tab: PyramidMemberTab;
  } | null>(null);

  const links = useMemo(
    () =>
      PYRAMID_NODES.filter((node) => node.parent).map((child) => {
        const parent = PYRAMID_NODES.find((n) => n.id === child.parent)!;
        return { id: `${parent.id}-${child.id}`, childId: child.id, d: linkPath(parent, child) };
      }),
    [],
  );

  // Périmètre éclairé : le sous-arbre du nœud pointé. `null` = tout est actif.
  const scope = useMemo(() => (focusedId ? subtreeOf(focusedId) : null), [focusedId]);
  const inScope = (id: string) => scope === null || scope.has(id);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: '.pyramid-stage', start: 'top 78%', once: true },
        });

        // 1. Les liens se tracent depuis la racine.
        tl.from('.pyramid-link', {
          strokeDashoffset: (_i: number, target: SVGPathElement) => target.getTotalLength(),
          duration: 0.9,
          ease: 'power2.inOut',
          stagger: 0.08,
        });

        // 2. Les cartes éclosent niveau par niveau. `opacity` + `scale` sur des
        //    éléments dont la position vient du CSS : si l'animation ne joue
        //    pas, elles sont simplement déjà en place.
        tl.from(
          '.pyramid-card',
          {
            opacity: 0,
            scale: 0.86,
            duration: 0.55,
            ease: 'back.out(1.9)',
            stagger: 0.07,
          },
          '-=0.7',
        );

        // 3. Une impulsion descend le long des liens tant que la section est à
        //    l'écran — la hiérarchie « circule ».
        gsap.to('.pyramid-pulse', {
          strokeDashoffset: -120,
          duration: 2.4,
          ease: 'none',
          repeat: -1,
          stagger: { each: 0.3, repeat: -1 },
          scrollTrigger: {
            trigger: '.pyramid-stage',
            start: 'top bottom',
            end: 'bottom top',
            toggleActions: 'play pause resume pause',
          },
        });
      });
    },
    { scope: rootRef },
  );

  return (
    <StepSection
      id="equipes"
      step={1}
      titleKey="enterprise.pyramid.title"
      subtitleKey="enterprise.pyramid.subtitle"
    >
      <div ref={rootRef}>
        {/* Comment on démarre, avant de montrer le résultat : on invite, on
            rattache, on regroupe. Trois gestes, pas une configuration. */}
        <ol className="mb-8 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3">
          {(['g1', 'g2', 'g3'] as const).map((key, index) => (
            <li key={key} className="bg-[#0A0C11] p-6">
              <span className="mb-3 block font-mono text-caption tabular-nums text-slate-600">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mb-2 text-sm font-semibold text-white">
                {t(`enterprise.pyramid.${key}t` as 'enterprise.pyramid.g1t')}
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                {t(`enterprise.pyramid.${key}d` as 'enterprise.pyramid.g1d')}
              </p>
            </li>
          ))}
        </ol>

        {/* ── La scène : l'organigramme interactif ── */}
        <div className="pyramid-stage relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0C11] p-4 sm:p-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Sous 768 px, les cartes positionnées en pourcentage se
              chevauchent et l'une sort du cadre (mesuré à 390 px) : la
              pyramide s'y déplie en arbre indenté. Même contenu, même règle. */}
          {isMobile ? (
            <ol className="flex flex-col gap-2 py-2">
              {pyramidTree().map(({ node, depth }) => (
                <li key={node.id} style={{ paddingLeft: `${depth * 18}px` }} className="flex items-center gap-2">
                  {depth > 0 && (
                    <span className="h-px w-3 shrink-0 bg-cyan-400/30" aria-hidden="true" />
                  )}
                  <PyramidCard
                    node={node}
                    layout="flow"
                    lit={inScope(node.id)}
                    pointed={focusedId === node.id}
                    roleLabel={t(node.roleKey)}
                    onEnter={() => setFocusedId(node.id)}
                    onLeave={() => setFocusedId(null)}
                    onRequestDemo={(tab) => setPendingDemo({ name: node.name, demoUserId: node.demoUserId, tab })}
                  />
                </li>
              ))}
            </ol>
          ) : (
            /* Cadre à ratio fixe : les cartes sont positionnées en %, donc la
               mise en page tient à toutes les largeurs sans recalcul JS. */
            <div className="relative aspect-[16/8] w-full">
              {/* Liens, sous les cartes. `preserveAspectRatio="none"` : le
                  viewBox est en pourcentages, il doit s'étirer avec le cadre. */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {links.map(({ id, childId, d }) => {
                  const lit = inScope(childId);
                  return (
                    <g key={id}>
                      <path
                        d={d}
                        className="pyramid-link"
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                        stroke={lit ? 'rgba(34,211,238,0.5)' : 'rgba(148,163,184,0.14)'}
                        strokeWidth={1.25}
                        style={{ transition: 'stroke 350ms ease' }}
                      />
                      <path
                        d={d}
                        className="pyramid-pulse"
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                        stroke={lit ? 'rgba(34,211,238,0.95)' : 'transparent'}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeDasharray="8 112"
                        style={{ transition: 'stroke 350ms ease' }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Cartes membres — reproduction de celles de l'onglet Pyramide. */}
              {PYRAMID_NODES.map((node) => (
                <PyramidCard
                  key={node.id}
                  node={node}
                  layout="absolute"
                  lit={inScope(node.id)}
                  pointed={focusedId === node.id}
                  roleLabel={t(node.roleKey)}
                  onEnter={() => setFocusedId(node.id)}
                  onLeave={() => setFocusedId(null)}
                  onRequestDemo={(tab) => setPendingDemo({ name: node.name, demoUserId: node.demoUserId, tab })}
                />
              ))}
            </div>
          )}

          {/* Légende + invite au survol */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <p className="font-mono text-caption uppercase tracking-[0.2em] text-slate-500">
              {t('enterprise.pyramid.hint')}
            </p>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400" aria-hidden="true" />
                {t('enterprise.pyramid.legendScope')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-700" aria-hidden="true" />
                {t('enterprise.pyramid.legendOut')}
              </span>
            </div>
          </div>
        </div>

        {/* ── Ce que l'organigramme vous permet de faire, concrètement ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {PYRAMID_BENEFITS.map(({ titleKey, bodyKey }) => (
            <div
              key={titleKey}
              className="rounded-xl border border-white/[0.08] bg-[#0A0C11] p-6 transition-colors duration-300 hover:border-cyan-300/25"
            >
              <h3 className="mb-2 text-sm font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{t(bodyKey)}</p>
            </div>
          ))}
        </div>

        {/* La capture de l'onglet réel, à la fin de l'étape : la scène
            au-dessus démontre la RÈGLE, l'écran montre le produit livré. */}
        <div className="mt-8 aspect-[16/10] max-w-4xl">
          <AppShot
            src={SHOTS.members.image}
            alt={t(SHOTS.members.altKey)}
            label={t(SHOTS.members.labelKey)}
          />
        </div>
      </div>

      {/* Confirmation à friction : un clic sur une option du menu carte ne
          navigue plus tout seul (l'ancien comportement faisait quitter la
          landing sans prévenir). Le visiteur doit choisir explicitement. */}
      <AlertDialog open={pendingDemo !== null} onOpenChange={(open) => !open && setPendingDemo(null)}>
        <AlertDialogContent className="border-white/[0.1] bg-[#12161D] text-white sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {t('enterprise.pyramid.demoPromptTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pendingDemo && t(DEMO_PROMPT_KEY[pendingDemo.tab], { name: pendingDemo.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/[0.12] bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white">
              {t('enterprise.pyramid.demoPromptCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-cyan-400 text-[#08090C] hover:bg-cyan-300"
              onClick={() => {
                if (pendingDemo) onMemberDemo(pendingDemo.demoUserId, pendingDemo.tab);
                setPendingDemo(null);
              }}
            >
              {t('enterprise.pyramid.demoPromptConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StepSection>
  );
};

interface PyramidCardProps {
  node: PyramidNode;
  /** `absolute` = cadre positionné en % (desktop) ; `flow` = arbre indenté (mobile). */
  layout: 'absolute' | 'flow';
  lit: boolean;
  pointed: boolean;
  roleLabel: string;
  onEnter: () => void;
  onLeave: () => void;
  /** Demande confirmation avant d'ouvrir la démo sur la fiche de CE membre. */
  onRequestDemo: (tab: PyramidMemberTab) => void;
}

/**
 * Une carte membre, calquée sur celle de l'onglet Pyramide : avatar à
 * initiales, nom, puis rôle en petites capitales suivi de la pastille d'équipe.
 *
 * C'est un `<button>` réel : le périmètre s'éclaire aussi au clavier, pas
 * seulement à la souris. Le clic ouvre les MÊMES options que le menu « ⋯ » de
 * l'onglet Pyramide réel (tâches / agenda / contribution) : la pyramide de la
 * landing ne se contente pas de ressembler à l'organigramme, elle donne accès
 * aux mêmes gestes.
 */
const PyramidCard: React.FC<PyramidCardProps> = ({
  node,
  layout,
  lit,
  pointed,
  roleLabel,
  onEnter,
  onLeave,
  onRequestDemo,
}) => {
  const { t } = useT('landing');

  const button = (
    <button
      type="button"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      aria-label={t('enterprise.pyramid.menuAria', { name: node.name })}
      // `-translate-x-1/2 -translate-y-1/2` est un centrage STATIQUE en CSS, pas
      // une animation : il n'est donc pas concerné par le garde-fou
      // reduced-motion (aucune valeur `initial` de Framer ne peut le figer).
      className={`pyramid-card flex items-center gap-3 whitespace-nowrap rounded-xl border px-3 py-2.5 text-left transition-[opacity,border-color,box-shadow] duration-300 focus-visible:outline-none sm:px-4 sm:py-3 ${
        layout === 'absolute' ? 'absolute -translate-x-1/2 -translate-y-1/2' : ''
      } ${
        pointed
          ? 'border-cyan-300/70 bg-[#12161D] shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_32px_-8px_rgba(34,211,238,0.7)]'
          : 'border-white/[0.1] bg-[#111318]'
      }`}
      style={
        layout === 'absolute'
          ? { left: `${node.x}%`, top: `${node.y}%`, opacity: lit ? 1 : 0.2 }
          : { opacity: lit ? 1 : 0.2 }
      }
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-bold text-white sm:h-9 sm:w-9 ${node.avatarClass}`}
        aria-hidden="true"
      >
        {node.initials}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold leading-none text-white sm:text-sm">{node.name}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-caption uppercase tracking-[0.14em] text-slate-500">
            {roleLabel}
          </span>
          <span className={`h-1.5 w-1.5 rounded-full ${node.teamClass}`} aria-hidden="true" />
        </span>
      </span>
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-64 border-white/[0.1] bg-[#12161D] text-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7)]"
      >
        <DropdownMenuLabel className="text-slate-500">
          {t('enterprise.pyramid.menuLabel', { name: node.name })}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onRequestDemo('tasks')}
          className="text-slate-200 focus:bg-cyan-400/10 focus:text-cyan-100"
        >
          <ListTodo size={14} className="text-cyan-300" aria-hidden="true" />
          {t('enterprise.pyramid.menuTasks')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onRequestDemo('agenda')}
          className="text-slate-200 focus:bg-cyan-400/10 focus:text-cyan-100"
        >
          <CalendarDays size={14} className="text-cyan-300" aria-hidden="true" />
          {t('enterprise.pyramid.menuAgenda')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onRequestDemo('contribution')}
          className="text-slate-200 focus:bg-cyan-400/10 focus:text-cyan-100"
        >
          <TrendingUp size={14} className="text-cyan-300" aria-hidden="true" />
          {t('enterprise.pyramid.menuContribution')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PyramidSection;
