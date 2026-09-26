import { useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import MemberAvatar from './MemberAvatar';
import MemberPickList from './MemberPickList';

/** Plafond du schéma (`team-okr.schema.ts`, `contributorIds.max(20)`). */
export const KR_MAX_CONTRIBUTORS = 20;

interface KRContributorsFieldProps {
  orgId: string;
  members: OrgMember[];
  value: string[];
  onChange: (next: string[]) => void;
  currentUserId?: string;
}

/**
 * Contributeurs d'un résultat clé (colonne `contributor_ids`, mig. 160, sans
 * écran jusqu'à l'audit du 2026-09-24). La base refuse un non-membre
 * (`contributor_not_in_org`) ; la liste ne propose donc que les membres.
 *
 * Replié par défaut : un KR se lit d'abord par sa cible, les personnes se
 * règlent au besoin. Les avatars restent visibles, repliés ou non.
 */
const KRContributorsField = ({ orgId, members, value, onChange, currentUserId }: KRContributorsFieldProps) => {
  const { t, tp } = useT('portfolio');
  const [open, setOpen] = useState(false);
  const chosen = value.map((id) => members.find((m) => m.userId === id)).filter((m): m is OrgMember => !!m);

  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] text-left"
      >
        <Users size={13} aria-hidden="true" />
        <span className="font-medium">{t('krContrib.label')}</span>
        {chosen.length > 0 ? (
          <span className="flex -space-x-1.5" title={chosen.map((m) => m.displayName).join(', ')}>
            {chosen.slice(0, 5).map((m) => (
              <span key={m.userId} className="rounded-full ring-2 ring-[rgb(var(--color-surface))]">
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={18} />
              </span>
            ))}
          </span>
        ) : (
          <span>{t('krContrib.none')}</span>
        )}
        {chosen.length > 5 && <span className="tabular-nums">+{chosen.length - 5}</span>}
        <span className="ml-auto">{open ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}</span>
      </button>
      {open && (
        <div className="rounded-lg border border-[rgb(var(--color-border))] max-h-56 overflow-y-auto">
          <MemberPickList
            members={members}
            value={value}
            onChange={(next) => onChange(next.slice(0, KR_MAX_CONTRIBUTORS))}
            currentUserId={currentUserId}
            teamGroupsOrgId={orgId}
            label={t('krContrib.aria')}
          />
          {value.length >= KR_MAX_CONTRIBUTORS && (
            <p className="px-3 py-2 text-caption text-amber-600 dark:text-amber-400" role="status">
              {tp('krContrib.max', KR_MAX_CONTRIBUTORS)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default KRContributorsField;
