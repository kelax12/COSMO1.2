import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Folder, Info, Target, X, type LucideIcon } from 'lucide-react';
import {
  ORG_ASSIGN_TARGETS,
  ROLE_COLORS,
  ROLE_NAME_MAX,
  type OrgAssignTarget,
  type OrgPermissionKey,
  type SaveCustomRoleInput,
} from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import PermissionSwitch from './PermissionSwitch';

interface RoleEditorSheetProps {
  /** Contenu de départ : un rôle existant, une copie, ou rien (nouveau rôle). */
  initial: SaveCustomRoleInput | null;
  /** `true` = on modifie un rôle existant (le titre change). */
  editing: boolean;
  pending: boolean;
  onSave: (input: SaveCustomRoleInput) => void;
  onClose: () => void;
}

/** Les trois colonnes de la maquette 2 : Tâches · Projets · OKR et autres. */
const GROUPS = [
  { titleKey: 'customRoles.editor.groupTasks', Icon: CheckSquare, keys: ['task.create', 'task.editAny', 'task.deleteAny'] },
  { titleKey: 'customRoles.editor.groupProjects', Icon: Folder, keys: ['project.create', 'project.edit', 'project.delete'] },
  {
    titleKey: 'customRoles.editor.groupOther',
    Icon: Target,
    keys: ['okr.create', 'okr.delete', 'category.manage', 'team.create', 'member.invite', 'report.org', 'report.allTeams', 'role.manage'],
  },
] as const satisfies readonly { titleKey: string; Icon: LucideIcon; keys: readonly OrgPermissionKey[] }[];

const COLOR_LABEL: Record<(typeof ROLE_COLORS)[number], 'colors.indigo' | 'colors.blue' | 'colors.teal' | 'colors.emerald' | 'colors.amber' | 'colors.red' | 'colors.pink' | 'colors.violet'> = {
  '#6366f1': 'colors.indigo',
  '#3b82f6': 'colors.blue',
  '#14b8a6': 'colors.teal',
  '#10b981': 'colors.emerald',
  '#f59e0b': 'colors.amber',
  '#ef4444': 'colors.red',
  '#ec4899': 'colors.pink',
  '#8b5cf6': 'colors.violet',
};

const labelKey = (key: OrgPermissionKey) => `permissions.key.${key}` as const;
const targetKey = (target: OrgAssignTarget) => `permissions.target.${target}` as const;

/**
 * Éditeur d'un rôle personnalisé (mig. 219, maquette 2 validée le 2026-10-12).
 *
 * Interrupteurs à DEUX positions : le rôle définit tout. Désactivé = refusé,
 * même un droit qu'un membre a par défaut. Un nouveau rôle part tout
 * désactivé, portée « lui-même ». Pas de plafond : « Gérer les rôles » est un
 * droit de confiance (décision du 2026-10-12).
 */
const RoleEditorSheet = ({ initial, editing, pending, onSave, onClose }: RoleEditorSheetProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');

  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string>(initial?.color ?? ROLE_COLORS[0]);
  const [granted, setGranted] = useState<ReadonlySet<OrgPermissionKey>>(() => new Set(initial?.grantedKeys ?? []));
  const [targets, setTargets] = useState<OrgAssignTarget[]>(() => initial?.assignTargets ?? ['self']);
  const [nameError, setNameError] = useState(false);

  const toggleKey = (key: OrgPermissionKey) => {
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTarget = (target: OrgAssignTarget) => {
    setTargets((prev) => (prev.includes(target) ? prev.filter((x) => x !== target) : [...prev, target]));
  };

  const save = () => {
    if (pending) return;
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    onSave({ name: name.trim(), color, grantedKeys: [...granted], assignTargets: targets });
  };

  const title = editing ? ta('customRoles.editor.titleEdit') : ta('customRoles.editor.titleNew');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!pending) onClose(); },
    label: ta('customRoles.editor.aria', { name: name.trim() || title }),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-6 bg-black/40 backdrop-blur-sm"
      onClick={() => { if (!pending) onClose(); }}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] shadow-2xl flex flex-col rounded-t-[24px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        {...dialogProps}
      >
        <div className="flex items-center justify-between gap-3 p-5 pb-3 shrink-0">
          <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-4 space-y-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
            <div className="min-w-0" data-guide-id="role-editor-name">
              <label htmlFor="role-editor-name" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
                {ta('customRoles.editor.nameLabel')}
              </label>
              <input
                id="role-editor-name"
                type="text"
                value={name}
                maxLength={ROLE_NAME_MAX}
                autoFocus
                placeholder={ta('customRoles.editor.namePlaceholder')}
                aria-invalid={nameError || undefined}
                aria-describedby={nameError ? 'role-editor-name-error' : undefined}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                className="w-full h-10 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              {nameError && (
                <p id="role-editor-name-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {ta('customRoles.editor.nameRequired')}
                </p>
              )}
            </div>
            <div role="radiogroup" aria-label={ta('customRoles.editor.colorLabel')} data-guide-id="role-editor-color" className="flex flex-wrap gap-1.5 pb-1.5 max-w-[11rem]">
              {ROLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={ta(COLOR_LABEL[c])}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-surface))] ring-[rgb(var(--color-accent))]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div data-guide-id="role-editor-matrix" className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {GROUPS.map(({ titleKey, Icon, keys }) => (
              <section key={titleKey} className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-1">
                  <Icon size={15} aria-hidden="true" /> {ta(titleKey)}
                </h3>
                {keys.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-[rgb(var(--color-text-secondary))] min-w-0">{ta(labelKey(key))}</span>
                    <PermissionSwitch
                      checked={granted.has(key)}
                      disabled={pending}
                      label={ta(labelKey(key))}
                      onToggle={() => toggleKey(key)}
                    />
                  </div>
                ))}
              </section>
            ))}
          </div>

          <section>
            <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-2">{ta('customRoles.editor.assignLabel')}</h3>
            <div className="flex flex-wrap gap-2">
              {ORG_ASSIGN_TARGETS.map((target) => {
                const on = targets.includes(target);
                return (
                  <button
                    key={target}
                    type="button"
                    aria-pressed={on}
                    disabled={pending}
                    onClick={() => toggleTarget(target)}
                    className={`px-3 min-h-9 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
                      on
                        ? 'bg-[rgb(var(--color-accent))]/10 border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))] font-semibold'
                        : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                    }`}
                  >
                    {ta(targetKey(target))}
                  </button>
                );
              })}
            </div>
            {targets.length === 0 && (
              <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">{ta('customRoles.editor.assignNobody')}</p>
            )}
          </section>

          <p data-guide-id="role-editor-hint" className="flex items-start gap-2 rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2.5 text-xs text-[rgb(var(--color-text-secondary))]">
            <Info size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
            {ta('customRoles.editor.hint')}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[rgb(var(--color-border))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold rounded-xl text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
          >
            {ta('customRoles.editor.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[rgb(var(--color-accent-solid))] text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? ta('customRoles.editor.saving') : ta('customRoles.editor.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RoleEditorSheet;
