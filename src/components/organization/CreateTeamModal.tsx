import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { subtreeOf, type OrgMember } from '@/modules/organizations';
import MemberPickList from './MemberPickList';
import MemberSelectField from './MemberSelectField';
import type { CreateTeamFullInput } from './use-create-team-full';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { useModalA11y } from '@/hooks/use-modal-a11y';

/** Palette d'équipes — valeurs CSS directes (pastilles `backgroundColor`). */
// Noms de couleur = CLÉS du catalogue : cette constante est évaluée au premier
// import, y écrire « Bleu » figerait les libellés en français pour la session.
export const TEAM_COLORS = [
  { value: '#6366f1', labelKey: 'colors.indigo' },
  { value: '#3b82f6', labelKey: 'colors.blue' },
  { value: '#14b8a6', labelKey: 'colors.teal' },
  { value: '#10b981', labelKey: 'colors.emerald' },
  { value: '#f59e0b', labelKey: 'colors.amber' },
  { value: '#ef4444', labelKey: 'colors.red' },
  { value: '#ec4899', labelKey: 'colors.pink' },
  { value: '#8b5cf6', labelKey: 'colors.violet' },
] as const satisfies readonly { value: string; labelKey: KeyOf<'org'> }[];

interface CreateTeamModalProps {
  members: OrgMember[];
  currentUserId?: string;
  /** Admin : peut ajouter n'importe qui ; manager : soi + son sous-arbre (miroir RLS). */
  isAdmin: boolean;
  /** Crée l'équipe, y ajoute les membres, nomme le responsable. Rejette en cas d'échec. */
  onSubmit: (input: CreateTeamFullInput) => Promise<void>;
  onClose: () => void;
}

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };

/**
 * Formulaire de création d'équipe (#2) : nom, couleur, responsable, membres,
 * même langage visuel que NewTeamProjectModal (bottom-sheet mobile / modal
 * desktop).
 *
 * Audit des popups du 2026-09-25 : le responsable se choisit ICI (il ne se
 * nommait qu'après coup, depuis la section Équipes), et la liste des membres
 * passe par `MemberPickList` : recherche et affichage par tranches, là où
 * elle rendait mille lignes d'un bloc.
 */
const CreateTeamModal = ({ members, currentUserId, isAdmin, onSubmit, onClose }: CreateTeamModalProps) => {
  const { t } = useT('org');
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TEAM_COLORS[0].value);
  const [selected, setSelected] = useState<string[]>(currentUserId ? [currentUserId] : []);
  // Par défaut, celui qui crée l'équipe en répond : c'est le cas courant.
  const [leadId, setLeadId] = useState(currentUserId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Membres proposables : admin → tout le monde ; manager → soi + sous-arbre.
  const addable = useMemo(() => {
    if (isAdmin) return members;
    const mine = currentUserId ? subtreeOf(members, currentUserId) : new Set<string>();
    return members.filter((m) => m.userId === currentUserId || mine.has(m.userId));
  }, [members, currentUserId, isAdmin]);

  // Choisir un responsable l'ajoute aux membres (il le serait de toute façon).
  const pickLead = (userId: string) => {
    setLeadId(userId);
    if (userId && !selected.includes(userId)) setSelected((prev) => [...prev, userId]);
  };

  const handleSubmit = async () => {
    if (pending) return;
    const n = name.trim();
    if (!n) { setError(t('team.nameRequired')); return; }
    setPending(true);
    setError(null);
    try {
      await onSubmit({ name: n, color, memberIds: selected, leadId: leadId || null });
      onClose();
    } catch {
      setPending(false); // erreur déjà notifiée par les hooks (toast)
    }
  };

  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Le nom accessible est celui que la surface portait deja.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: onClose,
    label: t('team.newTeam'),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={pending ? undefined : onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        {/* Poignée de glissement RETIRÉE, pas oubliée : elle ne faisait rien, et le geste n'a pas sa place sur un formulaire (docs/MOBILE.md §3). */}
        <div className="sm:hidden pt-3 shrink-0" aria-hidden="true" />

        {/* Header */}
        <div
          className="flex justify-between items-center px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b gap-2 shrink-0"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {t('team.newTeam')}
          </h2>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label={t('team.closeForm')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 font-medium" role="alert">
              {error}
            </div>
          )}

          {/* Nom */}
          <div>
            <label htmlFor="new-team-name" className={labelClass} style={labelStyle}>{t('team.name')}</label>
            <input
              id="new-team-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
              placeholder={t('team.namePlaceholder')}
              autoFocus
              maxLength={80}
              className="w-full px-[0.875425rem] h-[2.626275rem] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none hover:border-[rgb(var(--color-accent-solid-hover))] focus:border-[rgb(var(--color-accent-solid))] focus:border-2 transition-all text-[0.875425rem]"
              style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
            />
          </div>

          {/* Couleur */}
          <div>
            <span className={labelClass} style={labelStyle}>{t('team.color')}</span>
            <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={t('team.colorAria')}>
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  aria-label={t('team.colorNamed', { name: t(c.labelKey) })}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${color === c.value ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-background))] ring-blue-500' : ''}`}
                >
                  <span className="w-5 h-5 rounded-full" style={{ backgroundColor: c.value }} />
                </button>
              ))}
            </div>
          </div>

          {/* Responsable : gère les membres et les projets de l'équipe (mig. 107). */}
          <MemberSelectField
            label={t('popups.team.lead')}
            members={addable}
            value={leadId}
            onChange={pickLead}
            emptyLabel={t('popups.team.noLead')}
            hint={t('popups.team.leadHint')}
          />

          {/* Membres */}
          <div>
            <span className={labelClass} style={labelStyle}>
              {t('team.membersCount', { count: selected.length })}
            </span>
            {addable.length === 0 ? (
              <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                {t('team.noMember')}
              </p>
            ) : (
              <div className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] max-h-72 overflow-y-auto">
                <MemberPickList
                  members={addable}
                  value={selected}
                  onChange={setSelected}
                  currentUserId={currentUserId}
                  label={t('team.membersCount', { count: selected.length })}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[0.874rem] border-t flex flex-col-reverse sm:flex-row sm:justify-end items-stretch sm:items-center gap-2 sm:gap-3 shrink-0"
          style={{
            borderColor: 'rgb(var(--color-border))',
            backgroundColor: 'rgb(var(--color-surface))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 0.6555rem)',
          }}
        >
          <Button type="button" variant="outline" size="lg" onClick={onClose} disabled={pending} className="min-h-11 w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleSubmit}
            disabled={pending || !name.trim()}
            className={`min-h-11 w-full sm:w-auto ${
              pending || !name.trim()
                ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40 !border-0'
                : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0'
            }`}
          >
            {pending ? (
              <>
                <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                <span>{t('team.creating')}</span>
              </>
            ) : (
              t('team.create')
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CreateTeamModal;
