import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { isPast, isToday, parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  X,
  ListTodo,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from 'lucide-react';
import { useTeamTasks, type TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

export type InsightsTab = 'tasks' | 'agenda' | 'contribution';

interface MemberInsightsSheetProps {
  orgId: string;
  member: OrgMember;
  initialTab: InsightsTab;
  onClose: () => void;
}

const TABS: { id: InsightsTab; label: string; Icon: typeof ListTodo }[] = [
  { id: 'tasks', label: 'Tâches', Icon: ListTodo },
  { id: 'agenda', label: 'Agenda', Icon: CalendarDays },
  { id: 'contribution', label: 'Contribution', Icon: TrendingUp },
];

const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};

/**
 * Infos d'un subordonné dans le contexte entreprise (menu ⋯ de la pyramide,
 * réservé aux supérieurs hiérarchiques). Onglets :
 *  - Tâches : les tâches d'équipe assignées au membre.
 *  - Agenda : ses échéances de tâches d'équipe (le calendrier personnel n'est
 *    pas partagé entre membres — hors périmètre RLS actuel).
 *  - Contribution : synthèse de son activité (complétées, taux, retards).
 */
const MemberInsightsSheet = ({ orgId, member, initialTab, onClose }: MemberInsightsSheetProps) => {
  const [tab, setTab] = useState<InsightsTab>(initialTab);
  const { data: allTasks = [], isLoading } = useTeamTasks(orgId);

  const myTasks = useMemo(
    () => allTasks.filter((t) => t.assigneeId === member.userId),
    [allTasks, member.userId],
  );

  const open = myTasks.filter((t) => !t.completed);
  const done = myTasks.filter((t) => t.completed);
  const overdue = open.filter(isOverdue);
  const completionRate = myTasks.length ? Math.round((done.length / myTasks.length) * 100) : 0;

  // Agenda : échéances à venir/passées des tâches ouvertes, triées par date.
  const scheduled = useMemo(
    () =>
      open
        .filter((t) => !!t.deadline)
        .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [open],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Infos de ${member.displayName}`}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 p-5 pb-3 border-b border-[rgb(var(--color-border))]">
          <MemberAvatar avatar={member.avatar} name={member.displayName} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">
              {member.displayName}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">Activité dans l'entreprise</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-3 pt-2 border-b border-[rgb(var(--color-border))]">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === id
                  ? 'border-indigo-500 text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">Chargement…</p>
          ) : tab === 'tasks' ? (
            <TasksView open={open} done={done} />
          ) : tab === 'agenda' ? (
            <AgendaView scheduled={scheduled} />
          ) : (
            <ContributionView
              total={myTasks.length}
              done={done.length}
              open={open.length}
              overdue={overdue.length}
              completionRate={completionRate}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const priorityLabel = (p: number) => `P${Math.min(5, Math.max(1, Math.round(p)))}`;

const TaskRow = ({ t }: { t: TeamTask }) => (
  <li className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))]">
    {t.completed ? (
      <CheckCircle2 size={16} className="text-green-500 shrink-0" aria-hidden="true" />
    ) : (
      <Circle size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
    )}
    <span className={`text-sm flex-1 truncate ${t.completed ? 'text-[rgb(var(--color-text-muted))] line-through' : 'text-[rgb(var(--color-text-primary))]'}`}>
      {t.name}
    </span>
    {!t.completed && isOverdue(t) && (
      <span className="text-[10px] font-semibold text-red-500 shrink-0">En retard</span>
    )}
    <span className="text-[10px] font-semibold text-[rgb(var(--color-text-muted))] shrink-0">
      {priorityLabel(t.priority)}
    </span>
  </li>
);

const TasksView = ({ open, done }: { open: TeamTask[]; done: TeamTask[] }) => {
  if (open.length === 0 && done.length === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">Aucune tâche d'équipe assignée.</p>;
  }
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
          En cours ({open.length})
        </h3>
        {open.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Aucune tâche en cours.</p>
        ) : (
          <ul className="space-y-1.5">
            {open.map((t) => <TaskRow key={t.id} t={t} />)}
          </ul>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
            Terminées ({done.length})
          </h3>
          <ul className="space-y-1.5">
            {done.slice(0, 20).map((t) => <TaskRow key={t.id} t={t} />)}
          </ul>
        </section>
      )}
    </div>
  );
};

const AgendaView = ({ scheduled }: { scheduled: TeamTask[] }) => {
  if (scheduled.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-[rgb(var(--color-text-muted))]">Aucune échéance à venir.</p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2">
          Seules les échéances des tâches d'équipe sont visibles (le calendrier personnel reste privé).
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {scheduled.map((t) => {
        const late = isOverdue(t);
        const d = parseISO(t.deadline!);
        const today = isToday(d);
        return (
          <li
            key={t.id}
            className={`flex items-center gap-3 p-2.5 rounded-xl border ${
              late ? 'border-red-300/60 bg-red-50/40 dark:bg-red-900/10' : 'border-[rgb(var(--color-border))]'
            }`}
          >
            <div className={`flex flex-col items-center justify-center w-11 shrink-0 ${late ? 'text-red-500' : today ? 'text-indigo-500' : 'text-[rgb(var(--color-text-secondary))]'}`}>
              <span className="text-sm font-bold leading-none">{format(d, 'd', { locale: fr })}</span>
              <span className="text-[10px] uppercase">{format(d, 'MMM', { locale: fr })}</span>
            </div>
            <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{t.name}</span>
            {late && <AlertTriangle size={14} className="text-red-500 shrink-0" aria-hidden="true" />}
          </li>
        );
      })}
    </ul>
  );
};

const StatBlock = ({ value, label, tone }: { value: string; label: string; tone: string }) => (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4 text-center">
    <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{label}</p>
  </div>
);

const ContributionView = ({ total, done, open, overdue, completionRate }: {
  total: number; done: number; open: number; overdue: number; completionRate: number;
}) => {
  if (total === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">Aucune contribution à afficher.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatBlock value={`${completionRate}%`} label="Taux de complétion" tone="text-emerald-500" />
        <StatBlock value={String(done)} label="Tâches terminées" tone="text-[rgb(var(--color-text-primary))]" />
        <StatBlock value={String(open)} label="En cours" tone="text-indigo-500" />
        <StatBlock value={String(overdue)} label="En retard" tone={overdue > 0 ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'} />
      </div>
      {/* Barre de progression complétées / total */}
      <div>
        <div className="flex items-center justify-between text-xs text-[rgb(var(--color-text-muted))] mb-1.5">
          <span>Progression</span>
          <span>{done} / {total}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
        </div>
      </div>
    </div>
  );
};

export default MemberInsightsSheet;
