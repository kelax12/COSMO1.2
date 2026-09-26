import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { parseISO } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { useCreateOkrCycle, useDeleteOkrCycle, useOkrCycles } from '@/modules/team-okrs/execution.hooks';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface OkrCyclesDialogProps {
  orgId: string;
  canManage: boolean;
  onClose: () => void;
}

/**
 * Cycles d'OKR de l'organisation (mig. 160, M9) : T1, S2… Un objectif s'y
 * range pour la revue de fin de période. Supprimer un cycle ne supprime
 * aucun objectif : ils sortent simplement du cycle (`ON DELETE SET NULL`).
 */
const OkrCyclesDialog = ({ orgId, canManage, onClose }: OkrCyclesDialogProps) => {
  const { t } = useT('org');
  const { data: cycles = [], isLoading } = useOkrCycles(orgId);
  const create = useCreateOkrCycle(orgId);
  const remove = useDeleteOkrCycle(orgId);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, label: t('okrExec.cyclesTitle') });
  const valid = name.trim().length > 0 && !!start && !!end && end >= start;
  const fmt = (d: string) => formatDate(parseISO(d), { day: 'numeric', month: 'short', year: 'numeric' });

  const submit = () =>
    create.mutate(
      { name: name.trim(), startDate: start, endDate: end },
      { onSuccess: () => { setName(''); setStart(''); setEnd(''); } },
    );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('okrExec.cyclesTitle')}</h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">{t('okrExec.cyclesIntro')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('okrExec.cyclesLoading')}</p>
        ) : cycles.length === 0 ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('okrExec.cyclesEmpty')}</p>
        ) : (
          <ul className="divide-y divide-[rgb(var(--color-border))] rounded-2xl border border-[rgb(var(--color-border))]">
            {cycles.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">{c.name}</span>
                  <span className="block text-xs text-[rgb(var(--color-text-muted))]">{fmt(c.startDate)} → {fmt(c.endDate)}</span>
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    disabled={remove.isPending}
                    aria-label={t('okrExec.cycleDelete', { name: c.name })}
                    className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <section aria-labelledby="okr-cycle-new" className="space-y-2">
            <h3 id="okr-cycle-new" className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
              {t('okrExec.cycleNew')}
            </h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t('okrExec.cycleNamePlaceholder')}
              aria-label={t('okrExec.cycleName')}
              className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
            />
            <div className="grid grid-cols-2 gap-2">
              <DatePicker value={start} onChange={(v) => setStart(v ?? '')} placeholder={t('okrExec.cycleStart')} />
              <DatePicker value={end} onChange={(v) => setEnd(v ?? '')} placeholder={t('okrExec.cycleEnd')} minDate={start || undefined} />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!valid || create.isPending}
              className="w-full min-h-11 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-50"
            >
              {t('okrExec.cycleCreate')}
            </button>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default OkrCyclesDialog;
