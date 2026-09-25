import type { ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Shield, UserCog, UserRound, MoreVertical, ShieldCheck,
  ListTodo, CalendarDays, TrendingUp, ClipboardList,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import type { MemberLastActivity, OrgMember, OrgRole } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import RoleTerm from './RoleTerm';
import MemberAvatar from './MemberAvatar';
import MemberAccessBadge from './MemberAccessBadge';
import type { MemberTab } from './member-sheet.helpers';
import type { DirectoryRole } from './member-directory.filters';

// « Manager » n'est pas un rôle stocké : il est dérivé de la pyramide (a ≥ 1
// subordonné). Le badge est purement informatif — la position ne se modifie
// QUE depuis la pyramide (#1 : plus de changement de rôle depuis l'annuaire).
const BADGE_META = {
  admin: { labelKey: 'roles.adminShort', Icon: Shield, className: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  manager: { labelKey: 'roles.manager', Icon: UserCog, className: 'text-blue-600 dark:text-blue-400 bg-[rgb(var(--color-accent-solid))]/10' },
  member: { labelKey: 'roles.member', Icon: UserRound, className: 'text-slate-600 dark:text-slate-400 bg-slate-500/10' },
} as const;

const RoleBadge = ({ kind }: { kind: DirectoryRole }) => {
  const { t } = useT('org');
  const { labelKey, Icon, className } = BADGE_META[kind];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}>
      <Icon size={11} aria-hidden="true" /> <RoleTerm term={kind}>{t(labelKey)}</RoleTerm>
    </span>
  );
};

export interface MemberRowRights {
  isSelf: boolean;
  /** Admin et pas soi : le badge devient le menu de rôle. */
  canChangeRole: boolean;
  /** Supérieur hiérarchique : menu « … ». */
  isAbove: boolean;
  canAssign: boolean;
  canEditPermissions: boolean;
}

interface MemberDirectoryRowProps {
  member: OrgMember;
  role: DirectoryRole;
  rights: MemberRowRights;
  /** `undefined` : hors périmètre (rien affiché) ; `null` d'activité : aucune trace. */
  lastActivity?: MemberLastActivity;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: (tab: MemberTab) => void;
  onSetRole: (role: OrgRole) => void;
  onAssign: () => void;
  onEditPermissions: () => void;
  /**
   * Gestes de cycle de vie (`useMemberLifecycle`, mig. 161) : accès et départ.
   * `null` quand l'appelant n'y a pas droit. Ils REMPLACENT l'ancien retrait
   * nu, qui ne transmettait rien (M10).
   */
  lifecycleItems?: ReactNode;
}

/**
 * Une ligne de l'annuaire. Clic → fiche profil ; en mode sélection, clic →
 * coche. Le menu « … » reste réservé aux supérieurs hiérarchiques (#4).
 *
 * La pastille d'accès (`MemberAccessBadge`, suspendu ou accès borné) se
 * monte à côté du nom ; les gestes de cycle de vie ferment le menu « … ».
 */
const MemberDirectoryRow = ({
  member: m, role, rights, lastActivity, selectMode, selected,
  onToggleSelect, onOpen, onSetRole, onAssign, onEditPermissions, lifecycleItems,
}: MemberDirectoryRowProps) => {
  const { t } = useT('org');
  const primary = () => (selectMode ? onToggleSelect() : onOpen('profile'));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button,[role="menu"],input')) return;
        primary();
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          primary();
        }
      }}
      aria-label={selectMode ? t('directory.select.rowAria', { name: m.displayName }) : t('common.seeProfileOf', { name: m.displayName })}
      aria-pressed={selectMode ? selected : undefined}
      className={`flex items-center gap-3 p-3 rounded-xl border bg-[rgb(var(--color-surface))] cursor-pointer hover:border-indigo-400/60 hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected ? 'border-indigo-500' : 'border-[rgb(var(--color-border))]'
      }`}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={t('directory.select.rowAria', { name: m.displayName })}
          className="w-4 h-4 shrink-0 accent-indigo-600"
        />
      )}
      <MemberAvatar avatar={m.avatar} name={m.displayName} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">{m.displayName}</p>
          {rights.isSelf && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))]">
              {t('common.youBadge')}
            </span>
          )}
          <MemberAccessBadge member={m} />
        </div>
        {m.email && <p className="text-xs text-[rgb(var(--color-text-muted))] truncate">{m.email}</p>}
        {lastActivity && (
          <p className="text-[11px] text-[rgb(var(--color-text-muted))] truncate">
            {lastActivity.lastActivityAt
              ? t('directory.activity.rowAgo', {
                  when: formatDistanceToNow(new Date(lastActivity.lastActivityAt), { addSuffix: true, locale: getDateLocale() }),
                })
              : t('directory.activity.none')}
          </p>
        )}
      </div>

      {rights.canChangeRole && !selectMode ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={t('directory.changeRoleAria', { name: m.displayName })}
          >
            <RoleBadge kind={role} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuRadioGroup
              value={m.role}
              onValueChange={(value) => {
                if (value !== m.role) onSetRole(value as OrgRole);
              }}
            >
              <DropdownMenuRadioItem value="admin">{t('roles.admin')}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="member">{t('roles.member')}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {rights.canEditPermissions && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEditPermissions}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  {t('directory.customizeRole')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <RoleBadge kind={role} />
      )}

      {rights.isAbove && !selectMode && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={t('common.actionsFor', { name: m.displayName })}
          >
            <MoreVertical size={16} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Icônes SANS classe de couleur : DropdownMenuItem applique déjà
                `text-muted-foreground` à tout svg qui n'en porte pas. Seul
                l'item destructeur reste coloré. Attribuer : seulement dans la
                portée d'assignation de l'appelant (mig. 115). */}
            {rights.canAssign && (
              <>
                <DropdownMenuItem onClick={onAssign}>
                  <ClipboardList size={14} aria-hidden="true" />
                  {t('directory.assignTask')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onOpen('tasks')}>
              <ListTodo size={14} aria-hidden="true" />
              {t('directory.seeTasks')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpen('agenda')}>
              <CalendarDays size={14} aria-hidden="true" />
              {t('directory.seeAgenda')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpen('contribution')}>
              <TrendingUp size={14} aria-hidden="true" />
              {t('directory.seeContribution')}
            </DropdownMenuItem>
            {rights.canEditPermissions && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEditPermissions}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  {t('permissions.menuItem')}
                </DropdownMenuItem>
              </>
            )}
            {lifecycleItems && (
              <>
                <DropdownMenuSeparator />
                {lifecycleItems}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default MemberDirectoryRow;
