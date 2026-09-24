import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ArrowUpFromLine } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { normalize } from './pyramid.helpers';
import MemberAvatar from './MemberAvatar';

export interface BulkPickerOption {
  /** `null` : « détacher » (changement de manager, admins seulement). */
  id: string | null;
  label: string;
  /** Pastille de couleur (équipe) ou avatar (manager). */
  color?: string;
  avatar?: string;
  /** Membres sélectionnés sur qui le geste s'appliquerait vraiment. */
  eligible: number;
}

interface MemberBulkPickerProps {
  mode: 'team' | 'manager';
  selectedCount: number;
  options: BulkPickerOption[];
  pending: boolean;
  onPick: (id: string | null) => void;
  onClose: () => void;
}

/**
 * Choisir la cible d'une action groupée : une équipe, ou un manager. Chaque
 * option annonce combien de membres sélectionnés sont RÉELLEMENT concernés
 * (miroir de la RLS, cf. `member-bulk.helpers.ts`) ; une option à zéro est
 * désactivée plutôt que de promettre un geste que le serveur refuserait.
 */
const MemberBulkPicker = ({ mode, selectedCount, options, pending, onPick, onClose }: MemberBulkPickerProps) => {
  const { t, tp } = useT('org');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return q ? options.filter((o) => o.id === null || normalize(o.label).includes(q)) : options;
  }, [options, query]);

  const title = mode === 'team'
    ? tp('directory.bulk.pickTeamTitle', selectedCount)
    : tp('directory.bulk.pickManagerTitle', selectedCount);

  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    // Même règle que le voile et la croix : rien ne ferme pendant l'envoi.
    onClose: () => { if (!pending) onClose(); },
    label: title,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        {...dialogProps}
      >
        <div className="flex items-start justify-between gap-2 p-5 pb-3 border-b border-[rgb(var(--color-border))]">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={t('common.cancel')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="relative px-3 pt-3">
          <Search size={15} className="absolute left-6 top-1/2 translate-y-[-10%] text-[rgb(var(--color-text-muted))] pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'team' ? t('directory.bulk.searchTeam') : t('directory.bulk.searchManager')}
            aria-label={mode === 'team' ? t('directory.bulk.searchTeam') : t('directory.bulk.searchManager')}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-indigo-400"
          />
        </div>

        <div className="overflow-y-auto p-3 space-y-1">
          {shown.length === 0 && (
            <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">
              {mode === 'team' ? t('directory.bulk.noTeam') : t('directory.bulk.noManager')}
            </p>
          )}
          {shown.map((o) => (
            <button
              key={o.id ?? '__detach__'}
              type="button"
              disabled={pending || o.eligible === 0}
              onClick={() => onPick(o.id)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgb(var(--color-hover))] border ${
                o.id === null ? 'border-dashed border-[rgb(var(--color-border))]' : 'border-transparent hover:border-indigo-400'
              }`}
            >
              {o.id === null ? (
                <span className="w-7 h-7 rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
                  <ArrowUpFromLine size={14} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                </span>
              ) : mode === 'team' ? (
                <span className="w-3 h-3 rounded-full shrink-0 ml-2 mr-2" style={{ backgroundColor: o.color }} aria-hidden="true" />
              ) : (
                <MemberAvatar avatar={o.avatar} name={o.label} size={28} />
              )}
              <span className="min-w-0 flex-1 text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">{o.label}</span>
              <span className="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap tabular-nums">
                {tp('directory.bulk.eligible', o.eligible)}
              </span>
            </button>
          ))}
        </div>

        {pending && (
          <div className="px-5 py-3 border-t border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-muted))] inline-flex items-center gap-2">
            <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-indigo-500" />
            {t('directory.bulk.applying')}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default MemberBulkPicker;
