import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, RotateCcw } from 'lucide-react';
import {
  ORG_ASSIGN_TARGETS,
  DEFAULT_ASSIGN_TARGETS,
  canGrant,
  effectivePermissions,
  type EffectiveOrgPermissions,
  type OrgAssignTarget,
  type OrgMember,
  type OrgMemberPermissions,
  type OrgPermissionKey,
  type SetOrgPermissionsInput,
} from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import { useT } from '@/i18n/useT';

interface MemberPermissionsSheetProps {
  member: OrgMember;
  members: OrgMember[];
  /** La surcharge déjà posée sur ce membre, s'il y en a une. */
  current: OrgMemberPermissions | null;
  /** Droits effectifs de l'utilisateur courant — c'est son plafond. */
  actorPermissions: EffectiveOrgPermissions;
  actorIsAdmin: boolean;
  /** Cibles d'assignation de l'utilisateur courant — plafond de la portée. */
  actorAssignTargets: OrgAssignTarget[];
  pending: boolean;
  onSave: (input: SetOrgPermissionsInput) => void;
  onClose: () => void;
}

/** Les trois sections de droits booléens, dans l'ordre d'affichage. */
const SECTIONS: {
  titleKey: 'permissions.sectionCreate' | 'permissions.sectionDelete' | 'permissions.sectionOrg';
  keys: OrgPermissionKey[];
}[] = [
  {
    titleKey: 'permissions.sectionCreate',
    keys: ['task.create', 'project.create', 'okr.create', 'category.manage', 'team.create'],
  },
  {
    titleKey: 'permissions.sectionDelete',
    keys: ['task.deleteAny', 'project.delete', 'okr.delete'],
  },
  {
    titleKey: 'permissions.sectionOrg',
    keys: ['member.invite', 'task.editAny'],
  },
];

// `task.create` → `permissions.key.task.create` : le résolveur i18n descend un
// chemin pointé, et le catalogue est imbriqué en conséquence. Les types
// littéraux gardent ces clés vérifiées à la compilation, comme partout ailleurs.
const labelKey = (key: OrgPermissionKey) => `permissions.key.${key}` as const;
const hintKey = (key: OrgPermissionKey) => `permissions.key.${key}Hint` as const;
const targetKey = (target: OrgAssignTarget) => `permissions.target.${target}` as const;
const targetHintKey = (target: OrgAssignTarget) => `permissions.target.${target}Hint` as const;

const Switch = ({
  checked, disabled, label, onToggle,
}: { checked: boolean; disabled: boolean; label: string; onToggle: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className={`relative shrink-0 w-[44px] h-[26px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
      checked ? 'bg-[rgb(var(--color-accent-solid))]' : 'bg-gray-200 dark:bg-gray-700'
    }`}
  >
    <span
      className="absolute top-[2px] w-[22px] h-[22px] rounded-full bg-white shadow-md transition-all duration-200"
      style={{ left: checked ? 'calc(100% - 24px)' : '2px' }}
    />
  </button>
);

/**
 * Fiche « Modifier les permissions » d'un membre (mig. 115).
 *
 * Trois principes tenus par cet écran :
 *
 *  • Une ligne non touchée reste sur « Par défaut » et n'écrit rien : la
 *    surcharge est une DÉCISION, pas un instantané des droits actuels. Sans
 *    ça, ouvrir la fiche d'un manager puis enregistrer figerait ses droits et
 *    le sortir de la pyramide ne les lui retirerait plus jamais.
 *  • Ce qu'on ne peut pas accorder est désactivé, pas masqué — miroir exact du
 *    plafond serveur (`enforce_org_permission_ceiling`).
 *  • Aucune position ne dépend d'une animation de transform : chez un
 *    utilisateur en `prefers-reduced-motion`, la valeur `initial` reste
 *    appliquée et la feuille s'ouvrirait hors écran (CLAUDE.md § animations).
 */
const MemberPermissionsSheet = ({
  member, members, current, actorPermissions, actorIsAdmin,
  actorAssignTargets, pending, onSave, onClose,
}: MemberPermissionsSheetProps) => {
  const { t } = useT('org');

  const [overrides, setOverrides] = useState<Partial<Record<OrgPermissionKey, boolean | null>>>(
    () => ({ ...(current?.overrides ?? {}) }),
  );
  const [targets, setTargets] = useState<OrgAssignTarget[] | null>(
    () => current?.assignTargets ?? null,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Ce que vaut chaque droit AUJOURD'HUI pour ce membre, surcharges comprises :
  // c'est l'état affiché par les interrupteurs.
  const effective = useMemo(
    () => effectivePermissions({ member, members, overrides: { orgId: member.orgId, userId: member.userId, overrides, assignTargets: targets } }),
    [member, members, overrides, targets],
  );

  // Le défaut dérivé seul (sans aucune surcharge) — sert à libeller « Par
  // défaut : autorisé / refusé » et à savoir si une ligne a été décidée.
  const inherited = useMemo(
    () => effectivePermissions({ member, members, overrides: null }),
    [member, members],
  );

  const effectiveTargets = targets ?? [...DEFAULT_ASSIGN_TARGETS];
  const targetsDecided = targets !== null;

  const toggle = (key: OrgPermissionKey) => {
    setOverrides((prev) => ({ ...prev, [key]: !effective[key] }));
  };

  const reset = (key: OrgPermissionKey) => {
    setOverrides((prev) => ({ ...prev, [key]: null }));
  };

  const toggleTarget = (target: OrgAssignTarget) => {
    const next = effectiveTargets.includes(target)
      ? effectiveTargets.filter((x) => x !== target)
      : [...effectiveTargets, target];
    setTargets(next);
  };

  const save = () => {
    if (pending) return;
    onSave({ overrides, assignTargets: targets });
  };

  const renderRow = (key: OrgPermissionKey) => {
    const allowed = canGrant(actorPermissions, actorIsAdmin, key);
    const decided = overrides[key] !== undefined && overrides[key] !== null;
    // Un droit qu'on ne peut pas accorder reste réglable vers le BAS : refuser
    // n'est jamais une escalade. Seul l'octroi est plafonné.
    const disabled = pending || (!allowed && !effective[key]);
    return (
      <div key={key} className="flex items-start gap-3 py-3 border-b border-[rgb(var(--color-border))] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
            {t(labelKey(key))}
          </p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t(hintKey(key))}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-caption text-[rgb(var(--color-text-muted))]">
              {inherited[key] ? t('permissions.inheritedOn') : t('permissions.inheritedOff')}
            </span>
            {decided && (
              <button
                type="button"
                onClick={() => reset(key)}
                disabled={pending}
                className="inline-flex items-center gap-1 text-caption font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                <RotateCcw size={11} aria-hidden="true" /> {t('permissions.reset')}
              </button>
            )}
            {!allowed && !effective[key] && (
              <span className="text-caption text-amber-600 dark:text-amber-400">
                {t('permissions.ceiling')}
              </span>
            )}
          </div>
        </div>
        <Switch
          checked={effective[key]}
          disabled={disabled}
          label={t(labelKey(key))}
          onToggle={() => toggle(key)}
        />
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] w-full sm:max-w-lg max-h-[88vh] shadow-2xl flex flex-col rounded-t-[24px] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('permissions.aria', { name: member.displayName })}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <MemberAvatar avatar={member.avatar} name={member.displayName} size={40} />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate flex items-center gap-1.5">
                <ShieldCheck size={16} aria-hidden="true" /> {t('permissions.title', { name: member.displayName })}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
          <p className="text-xs text-[rgb(var(--color-text-muted))] mb-4">{t('permissions.intro')}</p>

          {SECTIONS.map(({ titleKey, keys }) => (
            <section key={titleKey} className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
                {t(titleKey)}
              </h3>
              {keys.map(renderRow)}
            </section>
          ))}

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">
              {t('permissions.sectionAssign')}
            </h3>
            {ORG_ASSIGN_TARGETS.map((target) => {
              const checked = effectiveTargets.includes(target);
              // Même plafond que les droits : on ne donne pas une portée qu'on
              // n'a pas, mais on peut toujours restreindre.
              const allowed = actorIsAdmin
                || actorAssignTargets.includes('everyone')
                || actorAssignTargets.includes(target);
              return (
                <label
                  key={target}
                  className={`flex items-start gap-3 py-2.5 border-b border-[rgb(var(--color-border))] last:border-0 ${
                    allowed || checked ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pending || (!allowed && !checked)}
                    onChange={() => toggleTarget(target)}
                    className="mt-0.5 w-4 h-4 rounded accent-[rgb(var(--color-accent-solid))]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                      {t(targetKey(target))}
                    </span>
                    <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                      {t(targetHintKey(target))}
                    </span>
                  </span>
                </label>
              );
            })}
            {targetsDecided && effectiveTargets.length === 0 && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-2">
                {t('permissions.assignNobody')}
              </p>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[rgb(var(--color-border))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold rounded-xl text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
          >
            {t('permissions.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[rgb(var(--color-accent-solid))] text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? t('permissions.saving') : t('permissions.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MemberPermissionsSheet;
