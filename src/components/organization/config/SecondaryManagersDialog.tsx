import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSecondaryManagers, useToggleSecondaryManager } from '@/modules/org-config';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import MemberAvatar from '../MemberAvatar';
import { filterMembersByQuery } from '../member-search.helpers';

interface Props {
  orgId: string;
  members: OrgMember[];
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_LINKS = 3;

/**
 * Liens hiérarchiques SECONDAIRES (mig. 196, audit du 2026-09-24, Pyramide :
 * « un seul manager »). Un lien en pointillé ne donne aucun droit : la
 * visibilité suit le responsable principal, et l'écran le dit.
 */
const SecondaryManagersDialog = ({ orgId, members, isAdmin, open, onOpenChange }: Props) => {
  const { t } = useT('orgConfig');
  const org = useT('org');
  const { data: links = [], isSuccess: linksLoaded } = useSecondaryManagers(orgId);
  const toggle = useToggleSecondaryManager(orgId);
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const shown = filterMembersByQuery(members, query).slice(0, 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('secondary.title')}</DialogTitle>
          <DialogDescription>{t('secondary.hint')}</DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <span className="sr-only">{org.t('assign.memberSearch')}</span>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={org.t('assign.memberSearch')}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm" />
        </label>
        <ul className="flex-1 overflow-y-auto divide-y divide-[rgb(var(--color-border))] -mx-1">
          {shown.map((m) => {
            const mine = links.filter((l) => l.userId === m.userId);
            const candidates = members.filter((x) => x.userId !== m.userId && x.userId !== m.managerId && !mine.some((l) => l.managerId === x.userId));
            return (
              <li key={m.userId} className="px-1 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={24} />
                  <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{m.displayName}</span>
                  {isAdmin && mine.length < MAX_LINKS && (
                    <select
                      className="h-8 max-w-[45%] px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs"
                      aria-label={t('secondary.add', { name: m.displayName })}
                      value=""
                      disabled={toggle.isPending}
                      onChange={(e) => e.target.value && toggle.mutate({ userId: m.userId, managerId: e.target.value, linked: false })}
                    >
                      <option value="">+</option>
                      {candidates.map((c) => <option key={c.userId} value={c.userId}>{c.displayName}</option>)}
                    </select>
                  )}
                </div>
                {mine.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-8">
                    {mine.map((l) => {
                      const mgr = byId.get(l.managerId);
                      return (
                        <span key={l.managerId} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full border border-dashed border-[rgb(var(--color-border-strong))] text-xs text-[rgb(var(--color-text-secondary))]">
                          {mgr?.displayName ?? '?'}
                          {isAdmin && (
                            <button type="button" aria-label={t('secondary.remove', { name: mgr?.displayName ?? '' })}
                              disabled={toggle.isPending}
                              onClick={() => toggle.mutate({ userId: m.userId, managerId: l.managerId, linked: true })}
                              className="w-4 h-4 rounded-full inline-flex items-center justify-center hover:bg-[rgb(var(--color-hover))]">
                              <X size={10} aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {linksLoaded && links.length === 0 && <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('secondary.none')}</p>}
      </DialogContent>
    </Dialog>
  );
};

export default SecondaryManagersDialog;
