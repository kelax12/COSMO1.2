// Cycles d'OKR de l'organisation (mig. 160) — T1, S2, « 2027 »… Un objectif
// se rattache à un cycle, et la revue trimestrielle se fait cycle par cycle.
// Filtrer par cycle est la lecture par défaut d'une direction : « où en
// sommes-nous CE trimestre ».

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarRange, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useCreateOkrCycle, useDeleteOkrCycle, type OkrCycle } from '@/modules/team-okrs';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { CycleFilter } from './okr-execution.helpers';

interface OkrCyclesBarProps {
  orgId: string;
  cycles: OkrCycle[];
  value: CycleFilter;
  onChange: (next: CycleFilter) => void;
  /** `okr.create` : créer ou supprimer un cycle. */
  canManage: boolean;
}

const OkrCyclesBar = ({ orgId, cycles, value, onChange, canManage }: OkrCyclesBarProps) => {
  const { t } = useT('portfolio');
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const create = useCreateOkrCycle(orgId);
  const remove = useDeleteOkrCycle(orgId);
  const shortDate = (d: string) => format(parseISO(d), 'd MMM yyyy', { locale: getDateLocale() });
  const valid = name.trim().length > 0 && name.trim().length <= 60 && !!start && !!end && start <= end;

  const add = () => {
    if (!valid) return;
    create.mutate({ name: name.trim(), startDate: start, endDate: end }, {
      onSuccess: () => { setName(''); setStart(''); setEnd(''); },
    });
  };

  if (cycles.length === 0 && !canManage) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarRange size={15} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
      <label className="sr-only" htmlFor={`okr-cycle-${orgId}`}>{t('okrCycles.filterLabel')}</label>
      <select
        id={`okr-cycle-${orgId}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2.5 text-sm text-[rgb(var(--color-text-primary))]"
      >
        <option value="">{t('okrCycles.all')}</option>
        {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        <option value="none">{t('okrCycles.none')}</option>
      </select>
      {canManage && (
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="h-9 px-3 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
        >
          {t('okrCycles.manage')}
        </button>
      )}

      <Dialog open={managing} onOpenChange={setManaging}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('okrCycles.title')}</DialogTitle>
            <DialogDescription>{t('okrCycles.description')}</DialogDescription>
          </DialogHeader>
          {cycles.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('okrCycles.empty')}</p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
              {cycles.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-[rgb(var(--color-text-primary))]">{c.name}</p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">{shortDate(c.startDate)} → {shortDate(c.endDate)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(t('okrCycles.deleteConfirm', { name: c.name }))) remove.mutate(c.id); }}
                    aria-label={t('okrCycles.deleteAria', { name: c.name })}
                    className="p-1.5 rounded-lg text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))]"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t border-[rgb(var(--color-border))] pt-3">
            <label className="block">
              <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{t('okrCycles.nameLabel')}</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('okrCycles.namePlaceholder')}
                className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{t('okrCycles.start')}</span>
                <DatePicker value={start} onChange={setStart} className="w-full" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{t('okrCycles.end')}</span>
                <DatePicker value={end} onChange={setEnd} className="w-full" />
              </div>
            </div>
            {start && end && start > end && (
              <p className="text-xs text-red-500">{t('okrCycles.datesOrder')}</p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={add}
                disabled={!valid || create.isPending}
                className="h-9 px-3 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('okrCycles.add')}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OkrCyclesBar;
