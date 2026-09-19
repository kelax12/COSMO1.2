import React, { useState } from 'react';
import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Repeat,
  Building2,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { prefetchRoute } from '@/lib/route-prefetch';
import { usePendingRequestCount } from '@/modules/friends';
import { useTasks } from '@/modules/tasks';
import { useActiveOrganization } from '@/modules/organizations';
import { useOrgBadges } from '@/lib/hooks/use-org-notifications';
import MobileMoreSheet from './MobileMoreSheet';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { isDueToday } from '@/lib/deadline';

interface TabConfig {
  to?: string;
  /**
   * Clé de catalogue, pas du texte : `TABS` est une constante de module,
   * évaluée à l'import. Y appeler `t()` figerait la langue au premier
   * chargement du chunk.
   */
  labelKey: KeyOf<'common'>;
  icon: LucideIcon;
  end?: boolean;
}

const TABS: TabConfig[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks',     labelKey: 'nav.tasks',     icon: CheckSquare },
  { to: '/agenda',    labelKey: 'nav.agenda',    icon: Calendar },
  { to: '/habits',    labelKey: 'nav.habits',    icon: Repeat },
];

/**
 * Entreprise n'entre dans la barre que pour un membre d'une organisation, et
 * remplace alors « Habitudes » plutôt que de s'ajouter en 6e position.
 *
 * Pourquoi un REMPLACEMENT : à 375 px, la barre fait 5 éléments de 75 px. Un
 * 6e les ramène à 62,5 px, sous la cible tactile de 44 px une fois les marges
 * internes retirées, et « Habitudes » comme « Entreprise » se tronquent.
 * Mesuré, pas supposé.
 *
 * Pourquoi « Habitudes » : l'espace entreprise est la seule zone
 * collaborative du produit, et il était jusqu'ici au 3e niveau de navigation
 * sur mobile (Plus → feuille → Entreprise).
 *
 * 🔴 Ce paragraphe affirmait « Habitudes reste atteignable dans Plus, qui la
 * liste déjà » — FAUX, elle n'y a jamais été : un membre d'organisation
 * n'avait plus AUCUN chemin mobile vers /habits. Ajoutée dans
 * `MobileMoreSheet` (2026-09-06), conditionnelle au même déclencheur
 * (`myOrg`) que ce remplacement, pour ne pas dupliquer l'onglet chez qui
 * l'a déjà en barre du bas.
 */
const ENTERPRISE_TAB: TabConfig = { to: '/entreprise', labelKey: 'nav.enterprise', icon: Building2 };

// `min-h-touch` sur toute la surface de l'onglet (et pas seulement sur le lien) :
// la zone tactile d'un onglet doit couvrir la hauteur entière de la barre.
// Libellé en `text-caption` (11px) — le `text-[10px]` d'avant passait sous le
// plancher lisible de l'échelle mobile.
const tabBaseClasses =
  'flex flex-col items-center justify-center gap-0.5 flex-1 min-h-touch text-caption font-medium transition-colors active:scale-95 transform-gpu';

/**
 * ── Maquette 84 : la barre dit QUOI, pas COMBIEN ──────────────────────────
 *
 * Deux niveaux de signal, et un seul par onglet :
 *
 * - **Nombre en rouge** — quelque chose T'ATTEND et ne se résoudra pas sans
 *   toi : une demande d'ami, une demande d'adhésion qu'un admin doit trancher.
 *   Le nombre a un sens parce qu'on peut le faire tomber en agissant.
 * - **Point discret** — il y a du NOUVEAU, rien à trancher : une tâche qu'on
 *   t'a assignée, une notification d'équipe non lue. Le compte n'apprend rien
 *   de plus que l'existence, et le point s'éteint à l'ouverture de l'onglet.
 *
 * 🔴 Ce qui a motivé la règle (mesuré le 2026-09-19) : « Accueil » portait un
 * « 2 » rouge et « Entreprise » un « 4 » rouge, en permanence, dans la couleur
 * de l'ERREUR, sans qu'aucun des deux ne dise ce qu'il comptait. Le rouge
 * devient un décor dès qu'il est toujours allumé, et il n'en reste plus pour
 * ce qui est réellement bloquant.
 *
 * ❌ Ne jamais mettre en rouge un compteur qui ne peut pas tomber par une
 * action de l'utilisateur dans cet onglet.
 */
const BADGE_POSITION = 'absolute -top-1.5 -right-1.5';

/** Nombre en rouge — pour ce qui attend une décision (cf. maquette 84). */
const BlockingBadge: React.FC<{ count: number; label: string }> = ({ count, label }) => (
  <span
    aria-label={label}
    className={cn(
      BADGE_POSITION,
      'bg-red-600 text-white text-caption leading-none rounded-full min-w-4 h-4 px-1 flex items-center justify-center',
    )}
  >
    {count}
  </span>
);

/** Point discret — pour ce qui est seulement nouveau (cf. maquette 84). */
const NewsDot: React.FC<{ label: string }> = ({ label }) => (
  <span
    aria-label={label}
    // Le liseré à la couleur de la barre détache le point de l'icône quand
    // les deux se superposent ; sans lui il se lit comme une partie du dessin.
    className={cn(
      BADGE_POSITION,
      'size-2.5 rounded-full bg-[rgb(var(--color-accent))] ring-2 ring-[rgb(var(--color-surface))]',
    )}
  />
);

const MobileTabBar: React.FC = () => {
  const { t, tp } = useT('common');
  const [moreOpen, setMoreOpen] = useState(false);
  const pendingRequestCount = usePendingRequestCount();
  // Badge neutre « tâches restantes aujourd'hui » sur l'onglet Tâches (#49).
  const { data: allTasks = [] } = useTasks();
  const { activeOrg, isLoading: orgLoading, wasOrgMember } = useActiveOrganization();
  // Maquette 84 : la pastille entreprise se lit VENTILÉE, pas en total.
  // `members` (demandes d'adhésion) attend une décision → nombre rouge ;
  // `projects` (assignations, notifications non lues) est du nouveau → point.
  const orgBadges = useOrgBadges();
  // `wasOrgMember` : la barre du bas ne doit pas changer d'identité sous le
  // doigt. Sans l'indice, elle affichait « Habitudes » le temps de la requête,
  // puis la remplaçait par « Entreprise » — un onglet qui bouge pendant qu'on
  // le vise est pire qu'un onglet qui manque.
  const showOrgTab = !!activeOrg || (orgLoading && wasOrgMember);
  const tabs = showOrgTab
    ? [...TABS.filter((tab) => tab.to !== '/habits'), ENTERPRISE_TAB]
    : TABS;
  const tasksDueTodayCount = allTasks.filter(
    (t) => !t.completed && isDueToday(t.deadline)
  ).length;

  return (
    <>
      <nav
        aria-label={t('nav.mobileNavLabel')}
        className="fixed bottom-0 inset-x-0 z-40 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] pb-safe"
        // `translateZ(0)` + `will-change` : force son propre calque de
        // composition. Aucun ancêtre à transform n'a été trouvé dans
        // Layout.tsx/index.css (la barre est déjà `position: fixed` correcte
        // en théorie) — ceci est le correctif standard contre le bug WebKit
        // connu où un `position: fixed` "glisse" brièvement pendant le
        // scroll/momentum sur iOS Safari, faute de calque dédié.
        style={{
          boxShadow: '0 -1px 3px rgba(0,0,0,0.04)',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      >
        <ul className="flex items-stretch h-16">
          {tabs.map(({ to, labelKey, icon: Icon, end }) => (
            <li key={to} className="flex-1 flex">
              <NavLink
                to={to!}
                end={end}
                // `pointerdown` se declenche des la pose du doigt, ~100 ms avant
                // que le tap ne se termine : le chunk de la page a une longueur
                // d'avance. Sans ca, le comportement startTransition de React
                // Router (defaut depuis la v7) fige visuellement la tab bar
                // pendant le telechargement : l'onglet actif ne bouge qu'une
                // fois le chunk arrive, car `useLocation` est mis a jour dans
                // la transition.
                onPointerDown={() => prefetchRoute(to!)}
                className={({ isActive }) =>
                  cn(
                    tabBaseClasses,
                    // Un seul accent pour l'onglet actif. Les 4 couleurs
                    // d'onglet précédentes (bleu/rouge/jaune/gris) faisaient
                    // de la barre l'élément le plus bruyant de l'écran, alors
                    // que c'est du mobilier : elle doit s'effacer.
                    isActive
                      ? 'text-[rgb(var(--color-accent))]'
                      : 'text-[rgb(var(--color-text-muted))]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon
                        size={24}
                        className={cn('transition-transform', isActive && 'scale-110')}
                      />
                      {/* Accueil — une demande d'ami attend une réponse. */}
                      {end && pendingRequestCount > 0 && (
                        <BlockingBadge
                          count={pendingRequestCount}
                          label={tp('nav.badge.pendingRequest', pendingRequestCount)}
                        />
                      )}
                      {/* Entreprise — la décision d'abord, la nouveauté sinon.
                          Jamais les deux : deux marques sur une icône de 24 px
                          se chevauchent, et la plus urgente perdrait. */}
                      {to === '/entreprise' && orgBadges.members > 0 && (
                        <BlockingBadge
                          count={orgBadges.members}
                          label={tp('nav.badge.orgJoinRequest', orgBadges.members)}
                        />
                      )}
                      {to === '/entreprise' && orgBadges.members === 0 && orgBadges.projects > 0 && (
                        <NewsDot label={t('nav.badge.orgNews')} />
                      )}
                      {to === '/tasks' && tasksDueTodayCount > 0 && (
                        <span
                          aria-label={tp('nav.badge.taskDueToday', tasksDueTodayCount)}
                          className="absolute -top-1.5 -right-1.5 bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))] text-caption leading-none rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
                        >
                          {tasksDueTodayCount}
                        </span>
                      )}
                    </span>
                    <span className="leading-tight">{t(labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          <li className="flex-1 flex">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label={t('nav.moreOptions')}
              className={cn(
                tabBaseClasses,
                moreOpen
                  ? 'text-[rgb(var(--color-accent))]'
                  : 'text-[rgb(var(--color-text-muted))]'
              )}
            >
              <MoreHorizontal size={24} />
              <span className="leading-tight">{t('nav.more')}</span>
            </button>
          </li>
        </ul>
      </nav>

      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
};

export default MobileTabBar;
