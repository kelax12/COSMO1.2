// ═══════════════════════════════════════════════════════════════════
// Filtres d'ATTRIBUTS des tâches d'équipe : priorité, plage d'échéance,
// catégorie, étiquette (audit 2026-09-24, onglet Tâches et M8).
//
// La barre commune (`OrgTaskFilterBar`) dit QUI et QUEL ÉTAT ; cette rangée
// dit QUELLES tâches par leurs champs. Même état, dans l'URL (`task-filters`),
// donc une vue enregistrée et un lien partagé les emportent aussi.
//
// Composant présentationnel : il affiche et modifie `filters`, il ne filtre rien.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { addDays, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { CalendarRange, Flag, FolderTree, Tag, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useTeamLabels } from '@/modules/team-projects';
import { useTeamCategories, categoryPath, formatPath } from '@/modules/team-categories';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { PRIORITY_META, priorityLabelOf } from './team-projects.helpers';
import type { OrgTaskFilters } from './task-filters';

interface TaskAttributeFiltersProps {
  orgId: string;
  filters: OrgTaskFilters;
  setFilters: (patch: Partial<OrgTaskFilters>) => void;
}

const trigger = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
const on = 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent)/0.1)] text-[rgb(var(--color-text-primary))]';
const off = 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]';
const presetBtn = 'w-full text-left px-2 py-1.5 rounded-md text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const short = (day: string) => format(parseISO(day), 'd MMM', { locale: getDateLocale() });

const TaskAttributeFilters = ({ orgId, filters, setFilters }: TaskAttributeFiltersProps) => {
  const { t } = useT('portfolio');
  const { data: labels = [] } = useTeamLabels(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const { priorities, dueFrom, dueTo, noDue, category, label } = filters;

  const categoryOptions = useMemo(
    () => categories
      .map((c) => ({ id: c.id, color: c.color, path: formatPath(categoryPath(c.id, categories)) }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    [categories],
  );
  const categoryName = categoryOptions.find((c) => c.id === category)?.path;
  const labelObj = labels.find((l) => l.id === label);

  const togglePriority = (p: number) =>
    setFilters({ priorities: priorities.includes(p) ? priorities.filter((x) => x !== p) : [...priorities, p] });

  const dueActive = noDue || !!dueFrom || !!dueTo;
  const dueRange = noDue
    ? t('attrFilters.noDue')
    : dueFrom && dueTo
      ? t('attrFilters.rangeBoth', { from: short(dueFrom), to: short(dueTo) })
      : dueFrom
        ? t('attrFilters.rangeFrom', { date: short(dueFrom) })
        : dueTo ? t('attrFilters.rangeTo', { date: short(dueTo) }) : '';

  const today = new Date();
  const weekOpts = { weekStartsOn: 1 as const };

  const chips: { key: string; label: string; clear: Partial<OrgTaskFilters> }[] = [];
  if (priorities.length) {
    chips.push({ key: 'prio', label: t('attrFilters.chipPriority', { list: priorities.map((p) => `P${p}`).join(', ') }), clear: { priorities: [] } });
  }
  if (dueActive) chips.push({ key: 'due', label: t('attrFilters.chipDue', { range: dueRange }), clear: { dueFrom: '', dueTo: '', noDue: false } });
  if (category && categoryName) chips.push({ key: 'cat', label: t('attrFilters.chipCategory', { name: categoryName }), clear: { category: null } });
  if (label && labelObj) chips.push({ key: 'label', label: t('attrFilters.chipLabel', { name: labelObj.name }), clear: { label: null } });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Priorité : plusieurs cases, la liste reste ouverte */}
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={t('attrFilters.priorityAria')} className={`${trigger} ${priorities.length ? on : off}`}>
            <Flag size={13} aria-hidden="true" />
            {t('attrFilters.priority')}
            {priorities.length > 0 && <span className="tabular-nums opacity-80">{priorities.length}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {[1, 2, 3, 4, 5].map((p) => (
              <DropdownMenuCheckboxItem
                key={p}
                checked={priorities.includes(p)}
                onCheckedChange={() => togglePriority(p)}
                onSelect={(e) => e.preventDefault()}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                {priorityLabelOf(p)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Plage d'échéance : raccourcis, puis bornes libres. Un Popover et
            non un menu : le calendrier COSMO s'ouvre DANS la couche, et un menu
            se refermerait au premier clic sur ce calendrier (portail). */}
        <Popover>
          <PopoverTrigger aria-label={t('attrFilters.dueAria')} className={`${trigger} ${dueActive ? on : off}`}>
            <CalendarRange size={13} aria-hidden="true" />
            {dueActive ? dueRange : t('attrFilters.due')}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2 space-y-1">
            <button type="button" className={presetBtn}
              onClick={() => setFilters({ noDue: false, dueFrom: iso(startOfWeek(today, weekOpts)), dueTo: iso(endOfWeek(today, weekOpts)) })}>
              {t('attrFilters.dueThisWeek')}
            </button>
            <button type="button" className={presetBtn}
              onClick={() => setFilters({ noDue: false, dueFrom: iso(today), dueTo: iso(addDays(today, 30)) })}>
              {t('attrFilters.dueNext30')}
            </button>
            <button type="button" aria-pressed={noDue} className={`${presetBtn} ${noDue ? 'font-semibold' : ''}`}
              onClick={() => setFilters({ noDue: !noDue, dueFrom: '', dueTo: '' })}>
              {t('attrFilters.noDue')}
            </button>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[rgb(var(--color-border))]">
              <div className="text-caption text-[rgb(var(--color-text-muted))] space-y-1">
                <span>{t('attrFilters.dueFrom')}</span>
                <DatePicker value={dueFrom} onChange={(d) => setFilters({ noDue: false, dueFrom: d })} displayFormat="dd/MM" />
              </div>
              <div className="text-caption text-[rgb(var(--color-text-muted))] space-y-1">
                <span>{t('attrFilters.dueTo')}</span>
                <DatePicker value={dueTo} minDate={dueFrom || undefined} onChange={(d) => setFilters({ noDue: false, dueTo: d })} displayFormat="dd/MM" />
              </div>
            </div>
            {dueActive && (
              <button type="button" className={presetBtn} onClick={() => setFilters({ dueFrom: '', dueTo: '', noDue: false })}>
                {t('attrFilters.clearDue')}
              </button>
            )}
          </PopoverContent>
        </Popover>

        {/* Catégorie (sous-catégories comprises) */}
        {categoryOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t('attrFilters.categoryAria')} className={`${trigger} ${category ? on : off}`}>
              <FolderTree size={13} aria-hidden="true" />
              <span className="max-w-[140px] truncate">{categoryName ?? t('attrFilters.category')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto">
              <DropdownMenuItem onClick={() => setFilters({ category: null })}>{t('attrFilters.anyCategory')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {categoryOptions.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => setFilters({ category: c.id })}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                  <span className="truncate">{c.path}</span>
                  {c.id === category && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Étiquette */}
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={t('attrFilters.labelAria')} className={`${trigger} ${label ? on : off}`}>
            <Tag size={13} aria-hidden="true" />
            <span className="max-w-[120px] truncate">{labelObj?.name ?? t('attrFilters.label')}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
            {labels.length === 0 ? (
              <DropdownMenuLabel className="font-normal text-[rgb(var(--color-text-muted))]">{t('attrFilters.noLabels')}</DropdownMenuLabel>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setFilters({ label: null })}>{t('attrFilters.anyLabel')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                {labels.map((l) => (
                  <DropdownMenuItem key={l.id} onClick={() => setFilters({ label: l.id })}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} aria-hidden="true" />
                    <span className="truncate">{l.name}</span>
                    {l.id === label && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips.map((chip) => (
            <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 text-xs font-medium">
              {chip.label}
              <button
                type="button"
                onClick={() => setFilters(chip.clear)}
                aria-label={t('filters.removeFilter', { name: chip.label })}
                className="w-4 h-4 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskAttributeFilters;
