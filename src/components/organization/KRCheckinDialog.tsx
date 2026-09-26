import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { TeamKeyResult } from '@/modules/team-okrs';
import type { ProjectHealth } from '@/modules/team-okrs/execution.types';
import { useKRCheckins, usePostKRCheckin } from '@/modules/team-okrs/execution.hooks';
import type { OrgMember } from '@/modules/organizations';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { getDateLocale } from '@/i18n/format';
import { HEALTH_META } from './okr-health';
import { useT } from '@/i18n/useT';

interface KRCheckinDialogProps {
  orgId: string;
  kr: TeamKeyResult;
  members: OrgMember[];
  onClose: () => void;
}

const STATES: ProjectHealth[] = ['on_track', 'at_risk', 'off_track'];

/**
 * Point d'étape d'un KR (mig. 160, M9) : la valeur, l'état déclaré et une
 * note, datés. Un KR n'était jusqu'ici qu'un chiffre qu'on écrasait, sans
 * trace de sa trajectoire ni de ce qu'en pensait son équipe.
 *
 * Un KR calculé (mode `tasks`) n'a pas de valeur à saisir : son point d'étape
 * ne porte que l'état et la note.
 */
const KRCheckinDialog = ({ orgId, kr, members, onClose }: KRCheckinDialogProps) => {
  const { t } = useT('org');
  const post = usePostKRCheckin(orgId);
  const { data: history = [], isLoading } = useKRCheckins(kr.id);
  const computed = kr.progressMode === 'tasks';
  const [value, setValue] = useState(String(kr.currentValue));
  const [status, setStatus] = useState<ProjectHealth>(kr.health ?? 'on_track');
  const [note, setNote] = useState('');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!post.isPending) onClose(); },
    label: t('okrExec.checkinTitle', { title: kr.title }),
  });
  const nameOf = (id: string | null) => (id ? members.find((m) => m.userId === id)?.displayName : null) ?? t('okrExec.someone');
  const numeric = Number(value);
  const valid = computed || (value.trim() !== '' && Number.isFinite(numeric));

  const submit = () =>
    post.mutate(
      { krId: kr.id, value: computed ? kr.currentValue : numeric, status, note },
      { onSuccess: onClose },
    );

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={() => { if (!post.isPending) onClose(); }}
    >
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{t('okrExec.checkinHeading')}</h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5 truncate">{kr.title}</p>
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

        {computed ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('okrExec.computedNoValue')}</p>
        ) : (
          <div>
            <label htmlFor="kr-checkin-value" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
              {t('okrExec.checkinValue', { target: kr.targetValue, unit: kr.unit ?? '' })}
            </label>
            <input
              id="kr-checkin-value"
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
            />
          </div>
        )}

        <fieldset>
          <legend className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{t('okrExec.checkinState')}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {STATES.map((s) => {
              const meta = HEALTH_META[s];
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={`min-h-11 px-2 rounded-xl border text-xs font-semibold transition-colors ${
                    status === s ? meta.active : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                  }`}
                >
                  {t(meta.labelKey)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="kr-checkin-note" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
            {t('okrExec.checkinNote')}
          </label>
          <textarea
            id="kr-checkin-note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('okrExec.checkinNotePlaceholder')}
            className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!valid || post.isPending}
          className="w-full min-h-11 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-50"
        >
          {post.isPending ? t('okrExec.checkinSaving') : t('okrExec.checkinSave')}
        </button>

        <section aria-labelledby="kr-checkin-history">
          <h3 id="kr-checkin-history" className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
            {t('okrExec.historyTitle')}
          </h3>
          {isLoading ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('okrExec.historyLoading')}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('okrExec.historyEmpty')}</p>
          ) : (
            <ol className="space-y-2">
              {history.map((c) => (
                <li key={c.id} className="rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full ${HEALTH_META[c.status].dot}`} aria-hidden="true" />
                    <span className="font-semibold text-[rgb(var(--color-text-primary))]">{t(HEALTH_META[c.status].labelKey)}</span>
                    {!computed && <span className="text-[rgb(var(--color-text-secondary))]">{c.value}{kr.unit ? ` ${kr.unit}` : ''}</span>}
                    <span className="ml-auto text-[rgb(var(--color-text-muted))]">
                      {nameOf(c.authorId)} · {formatDistanceToNow(parseISO(c.createdAt), { addSuffix: true, locale: getDateLocale() })}
                    </span>
                  </div>
                  {c.note && <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))] whitespace-pre-wrap">{c.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
};

export default KRCheckinDialog;
