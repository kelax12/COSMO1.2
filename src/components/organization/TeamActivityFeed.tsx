import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';

interface TeamActivityFeedProps {
  tasks: TeamTask[];
  projects: TeamProject[];
  members: OrgMember[];
}

interface ActivityItem {
  id: string;
  date: string;
  kind: 'created' | 'completed';
  taskName: string;
  actorName?: string;
  projectName?: string;
}

const firstName = (name: string) => name.split(' ')[0];

/**
 * Flux d'activité d'équipe (reco #11) — DÉRIVÉ des tâches existantes
 * (créations via createdAt/createdBy, complétions via completedAt), sans
 * table dédiée. 8 entrées max, 14 derniers jours.
 */
const TeamActivityFeed = ({ tasks, projects, members }: TeamActivityFeedProps) => {
  const items = useMemo<ActivityItem[]>(() => {
    const memberById = new Map(members.map((m) => [m.userId, m]));
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const out: ActivityItem[] = [];
    for (const t of tasks) {
      const projectName = projectById.get(t.projectId)?.name;
      const created = Date.parse(t.createdAt);
      if (!Number.isNaN(created) && created >= cutoff) {
        const actor = memberById.get(t.createdBy);
        out.push({
          id: `created-${t.id}`,
          date: t.createdAt,
          kind: 'created',
          taskName: t.name,
          actorName: actor ? firstName(actor.displayName) : undefined,
          projectName,
        });
      }
      if (t.completed && t.completedAt) {
        const completed = Date.parse(t.completedAt);
        if (!Number.isNaN(completed) && completed >= cutoff) {
          // Pas d'acteur fiable pour une complétion : on nomme les assignés.
          const names = t.assigneeIds
            .map((id) => memberById.get(id))
            .filter((m): m is OrgMember => !!m)
            .map((m) => firstName(m.displayName));
          out.push({
            id: `completed-${t.id}`,
            date: t.completedAt,
            kind: 'completed',
            taskName: t.name,
            actorName: names.length > 0 ? names.slice(0, 2).join(' et ') : undefined,
            projectName,
          });
        }
      }
    }
    return out.sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 8);
  }, [tasks, projects, members]);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        Activité de l'équipe
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2.5 text-sm">
            {item.kind === 'completed' ? (
              <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <PlusCircle size={15} className="text-[rgb(var(--color-text-muted))] shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <p className="flex-1 min-w-0 text-[rgb(var(--color-text-secondary))]">
              {item.kind === 'completed' ? (
                <>
                  <span className="font-semibold text-[rgb(var(--color-text-primary))]">{item.actorName ?? 'L\'équipe'}</span>
                  {' a terminé '}
                </>
              ) : (
                <>
                  <span className="font-semibold text-[rgb(var(--color-text-primary))]">{item.actorName ?? 'Un membre'}</span>
                  {' a créé '}
                </>
              )}
              <span className="text-[rgb(var(--color-text-primary))]">« {item.taskName} »</span>
              {item.projectName && (
                <span className="text-[rgb(var(--color-text-muted))]"> · {item.projectName}</span>
              )}
            </p>
            <span className="text-[10px] shrink-0 text-[rgb(var(--color-text-muted))] mt-0.5">
              {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: fr })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeamActivityFeed;
