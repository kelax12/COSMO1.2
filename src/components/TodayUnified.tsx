import { useNavigate } from 'react-router';
import { Circle, AlertTriangle, Building2, User } from 'lucide-react';
import { useTodayItems, type TodayItem } from '@/modules/today';
import { useToggleTaskComplete } from '@/modules/tasks';
import { useUpdateTeamTask } from '@/modules/team-projects';
import { useActiveOrganization } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

/**
 * Vue « Aujourd'hui » unifiée (item #29) — section du tableau de bord.
 *
 * Un collaborateur avait deux listes de tâches sans jonction : `tasks` (perso)
 * et `team_tasks` (équipe), sur deux écrans, avec deux modèles. Aucun endroit
 * ne répondait à « qu'est-ce que je dois faire aujourd'hui ? ».
 *
 * 🔴 Cette vue LIT et ROUTE. Elle ne persiste rien qui lui soit propre : cocher
 * appelle la mutation du MODULE D'ORIGINE (`useToggleTaskComplete` ou
 * `useUpdateTeamTask`), et ouvrir renvoie sur l'écran d'origine. C'est là que
 * les deux modèles divergent — récurrence serveur côté perso, triggers de
 * statut côté équipe — et un chemin d'écriture unifié les casserait tous deux.
 *
 * Elle n'est rendue que pour les membres d'une organisation : sans deuxième
 * source, elle ferait doublon avec « Tâches prioritaires ».
 */
const TodayUnified = () => {
  const { t, tp } = useT('dashboard');
  const navigate = useNavigate();
  const { items, isLoading, hasOrg } = useTodayItems();
  const { activeOrg } = useActiveOrganization();
  const togglePersonal = useToggleTaskComplete();
  const updateTeamTask = useUpdateTeamTask(activeOrg?.id ?? '');

  if (!hasOrg) return null;

  // Chaque source garde SON chemin d'écriture — c'est la règle non négociable
  // de cette vue.
  const complete = (item: TodayItem) => {
    if (item.source === 'personal') togglePersonal.mutate(item.id);
    else updateTeamTask.mutate({ taskId: item.id, input: { completed: true } });
  };

  const overdueCount = items.filter((i) => i.overdue).length;

  // Une carte avec son propre en-tete, comme ses voisines : sur desktop
  // `MobileCollapsible` ne rend que ses enfants (le titre n'apparait que sur
  // mobile), donc une section sans en-tete propre flotterait sans contexte.
  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">
          {t('sections.today')}
        </h2>
        <p className="text-[rgb(var(--color-text-secondary))] text-label sm:text-sm">
          {isLoading ? (
            t('today.loading')
          ) : items.length === 0 ? (
            t('today.empty')
          ) : (
            <>
              {tp('today.summary', items.length)}
              {overdueCount > 0 && (
                <span className="text-[rgb(var(--color-error))] font-semibold">
                  {' · '}{tp('today.overdue', overdueCount)}
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <ul className="space-y-1.5">
        {/* Cle `(source, id)` : les deux tables ont leurs propres ids, et les
            confondre cocherait la mauvaise ligne dans la mauvaise table. */}
        {items.map((item) => (
          <li key={`${item.source}-${item.id}`}>
            <div
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                item.overdue
                  ? 'border-red-300/60 bg-red-50/40 dark:bg-red-900/10'
                  : 'border-[rgb(var(--color-border))]'
              }`}
            >
              <button
                type="button"
                onClick={() => complete(item)}
                aria-label={t('today.markDone', { name: item.name })}
                className="shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-success))] transition-colors"
              >
                <Circle size={16} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate(item.href)}
                className="flex-1 min-w-0 text-left"
              >
                <span className="block text-label text-[rgb(var(--color-text-primary))] truncate">
                  {item.name}
                </span>
                <span className="flex items-center gap-1.5 text-caption text-[rgb(var(--color-text-muted))]">
                  {item.source === 'team' ? (
                    <Building2 size={11} aria-hidden="true" />
                  ) : (
                    <User size={11} aria-hidden="true" />
                  )}
                  <span className="truncate">
                    {item.contextLabel ?? (item.source === 'team' ? t('today.sourceTeam') : t('today.sourcePersonal'))}
                  </span>
                </span>
              </button>

              {item.overdue && (
                <span className="flex items-center gap-1 shrink-0 text-caption font-semibold text-[rgb(var(--color-error))]">
                  <AlertTriangle size={12} aria-hidden="true" />
                  {item.deadline}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodayUnified;
