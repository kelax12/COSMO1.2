import { useState } from 'react';
import { CalendarDays, ChevronDown, CircleCheck, UserRound } from 'lucide-react';
import type { PersonActivity } from '@/modules/org-reports';
import { useT } from '@/i18n/useT';
import MenuSelect from '@/components/organization/MenuSelect';

export type PeopleSort = 'tasks' | 'agenda' | 'name';
export type ReportPerson = PersonActivity & { minutes: number };
export interface ReportPersonItem { key: string; kind: 'task' | 'event'; text: string; when: string }

interface ReportPeopleListProps {
  people: ReportPerson[];
  sort: PeopleSort;
  onSortChange: (sort: PeopleSort) => void;
  /** Nom affiché (figé dans le rapport, sinon celui du membre). */
  nameOf: (p: ReportPerson) => string;
  /** « 3 tâches · 2 h d'agenda » : la même ligne que le PDF. */
  metaOf: (p: ReportPerson) => string;
  /** Tâches puis événements, avec leur moment : la même liste que le PDF. */
  itemsOf: (p: ReportPerson) => ReportPersonItem[];
  inputClassName: string;
}

const muted = 'text-[rgb(var(--color-text-muted))]';
const primary = 'text-[rgb(var(--color-text-primary))]';

const initials = (name: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

/**
 * « Qui a fait quoi » du rapport d'activité : une ligne compacte par personne,
 * barre relative au plus actif, détail ouvert au clic. Remplace les fiches
 * toujours dépliées, illisibles à quinze personnes sur un mois.
 */
const ReportPeopleList = ({ people, sort, onSortChange, nameOf, metaOf, itemsOf, inputClassName }: ReportPeopleListProps) => {
  const { t } = useT('orgAdmin');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const valueOf = (p: ReportPerson) => (sort === 'agenda' ? p.minutes : p.tasks.length);
  const max = Math.max(1, ...people.map(valueOf));

  return (
    <section className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 md:p-5" aria-labelledby="report-people-title">
      <div className="flex items-center gap-2 mb-2">
        <h3 id="report-people-title" className={`flex items-center gap-2 text-sm font-bold ${primary}`}>
          <UserRound size={16} aria-hidden="true" className={muted} />
          {t('reports.peopleTitle')}
        </h3>
        <MenuSelect
          aria-label={t('reports.peopleSort')}
          className={`ml-auto ${inputClassName} py-1 text-xs`}
          value={sort}
          onChange={(e) => onSortChange(e.target.value as PeopleSort)}
        >
          <option value="tasks">{t('reports.sortTasks')}</option>
          <option value="agenda">{t('reports.sortAgenda')}</option>
          <option value="name">{t('reports.sortName')}</option>
        </MenuSelect>
      </div>
      <ul className="divide-y divide-[rgb(var(--color-border))]">
        {people.map((person) => {
          const who = nameOf(person);
          const key = person.userId ?? '';
          const isOpen = open.has(key);
          const detailId = `report-person-${key || 'unknown'}`;
          return (
            <li key={key}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={detailId}
                aria-label={t('reports.personToggle', { name: who })}
                onClick={() => toggle(key)}
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[rgb(var(--color-hover))] rounded-lg px-1 -mx-1"
              >
                <span
                  aria-hidden="true"
                  className="w-8 h-8 shrink-0 rounded-full bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))] text-caption font-semibold flex items-center justify-center"
                >
                  {initials(who)}
                </span>
                <span className={`w-28 md:w-40 truncate text-sm font-medium ${primary}`}>{who}</span>
                <span className="hidden sm:block flex-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(valueOf(person) / max) * 100}%` }} />
                </span>
                <span className={`ml-auto sm:ml-0 text-xs tabular-nums shrink-0 text-right ${muted}`}>{metaOf(person)}</span>
                <ChevronDown size={16} aria-hidden="true" className={`shrink-0 transition-transform ${muted} ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <ul id={detailId} className="pb-3 pl-11 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                  {itemsOf(person).map((item) => (
                    <li key={item.key} className="flex items-start gap-2 text-sm min-w-0">
                      {item.kind === 'task'
                        ? <CircleCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-500" />
                        : <CalendarDays size={15} aria-hidden="true" className={`mt-0.5 shrink-0 ${muted}`} />}
                      <span className={`flex-1 min-w-0 break-words ${primary}`}>{item.text}</span>
                      <span className={`text-xs shrink-0 mt-0.5 tabular-nums ${muted}`}>{item.when}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ReportPeopleList;
