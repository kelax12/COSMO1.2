import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Building2, Circle, User } from 'lucide-react';
import { useEvents } from '@/modules/events';
import { useTodayItems, useCompleteTodayItem } from '@/modules/today';
import { useT } from '@/i18n/useT';
import TouchTarget from '@/components/mobile/TouchTarget';
import { buildMoments } from './today-moments.helpers';

/**
 * « Matin · après-midi · soir » — maquette 28, l'accueil MOBILE.
 *
 * Remplace la section « Aujourd'hui » sur téléphone. Le fil unifié y était déjà
 * (tâches perso + tâches d'équipe assignées), mais à plat, et sans les
 * rendez-vous : l'écran répondait « voici tes tâches » là où la question posée
 * dans un couloir est « qu'est-ce que je fais maintenant ? ».
 *
 * Trois moments plutôt que des heures : découper en créneaux horaires
 * supposerait que chaque élément en ait un, or seuls les rendez-vous en
 * portent. Cf. `buildMoments` pour la règle de placement — et pourquoi une
 * tâche n'est jamais affichée sous une heure inventée.
 *
 * 🔴 Écriture : la vue LIT deux tables et n'en écrit jamais une à la place de
 * l'autre — `useCompleteTodayItem` porte cet aiguillage, partagé avec
 * `TodayUnified` (desktop). Ouvrir renvoie sur l'écran d'origine.
 *
 * Desktop garde `TodayUnified`, inchangé.
 */
const TodayMoments = () => {
  const { t } = useT('dashboard');
  const navigate = useNavigate();
  const { items, isLoading } = useTodayItems();
  const { data: events = [] } = useEvents();
  const complete = useCompleteTodayItem();

  const groups = useMemo(() => buildMoments({ events, tasks: items }), [events, items]);

  return (
    <section className="card-plain-mobile p-gutter rounded-2xl">
      <h2 className="mb-3 text-headline font-bold text-[rgb(var(--color-text-primary))]">
        {t('sections.today')}
      </h2>

      {isLoading && groups.length === 0 && (
        <p className="text-label text-[rgb(var(--color-text-secondary))]">{t('today.loading')}</p>
      )}
      {!isLoading && groups.length === 0 && (
        <p className="text-label text-[rgb(var(--color-text-secondary))]">{t('today.empty')}</p>
      )}

      {groups.map((group) => (
        <div key={group.moment} className="mt-4 first:mt-0">
          <h3 className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            {t(`moments.${group.moment}`)}
          </h3>
          <ul>
            {group.entries.map((entry) => (
              <li
                key={entry.key}
                // Le filet plutôt que la carte, comme les lignes de tâches
                // (arbitrage du 2026-09-05).
                className="flex items-center gap-2.5 border-b border-[rgb(var(--color-border))] last:border-b-0"
              >
                {entry.task ? (
                  <>
                    {/* L'icône reste à 16 px, c'est la CIBLE qui fait 44
                        (WCAG 2.5.5) — même contrat que `TodayUnified`. */}
                    <TouchTarget
                      onClick={() => complete(entry.task!)}
                      aria-label={t('today.markDone', { name: entry.task.name })}
                      className="-ml-2 hover:text-[rgb(var(--color-success))]"
                    >
                      <Circle size={16} aria-hidden="true" />
                    </TouchTarget>
                    <button
                      type="button"
                      onClick={() => navigate(entry.task!.href)}
                      className="flex-1 min-w-0 min-h-touch flex flex-col justify-center text-left"
                    >
                      <span className="block text-label text-[rgb(var(--color-text-primary))] truncate">
                        {entry.task.name}
                      </span>
                      <span className="flex items-center gap-1.5 text-caption text-[rgb(var(--color-text-muted))]">
                        {entry.task.source === 'team' ? (
                          <Building2 size={11} aria-hidden="true" />
                        ) : (
                          <User size={11} aria-hidden="true" />
                        )}
                        <span className="truncate">
                          {entry.task.contextLabel ??
                            (entry.task.source === 'team'
                              ? t('today.sourceTeam')
                              : t('today.sourcePersonal'))}
                        </span>
                      </span>
                    </button>
                    {entry.task.overdue && (
                      <span className="flex shrink-0 items-center gap-1 text-caption font-semibold text-[rgb(var(--color-error))]">
                        <AlertTriangle size={12} aria-hidden="true" />
                        {entry.task.deadline}
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/agenda')}
                    className="flex-1 min-w-0 min-h-touch flex items-center gap-2.5 text-left"
                  >
                    {/* L'heure est la seule donnée temporelle réelle de
                        l'écran : elle n'apparaît que sur les rendez-vous. */}
                    <span className="w-11 shrink-0 text-label font-semibold tabular-nums text-[rgb(var(--color-text-primary))]">
                      {entry.time}
                    </span>
                    <span
                      className="h-4 w-0.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.event?.color || 'rgb(var(--color-accent))' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-label text-[rgb(var(--color-text-primary))]">
                      {entry.event?.title}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
};

export default TodayMoments;
