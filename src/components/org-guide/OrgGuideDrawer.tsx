// src/components/org-guide/OrgGuideDrawer.tsx
import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, Folder, Lock, Play, Shield, Target, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/useT';
import { deniedRightKey, guideAccess } from './guide-access';
import { matchesGuideQuery } from './guide-search';
import { GUIDE_ACTIONS, GUIDE_CATEGORIES } from './scenarios';
import type { GuideAction, GuideCategory, GuideViewer } from './guide-types';

const ICONS: Record<GuideCategory, typeof Folder> = { work: Folder, people: Users, roles: Shield, steer: Target };

interface Props {
  open: boolean;
  viewer: GuideViewer;
  onClose: () => void;
  onStart: (action: GuideAction) => void;
  onSeeAdmins: () => void;
}

const badgeKey = (a: GuideAction) =>
  a.requires === 'admin' || a.requires === 'role.manage' ? 'drawer.badgeAdmin'
    : a.requires === 'owner' ? 'drawer.badgeOwner' : 'drawer.badgeManager';

export function OrgGuideDrawer({ open, viewer, onClose, onStart, onSeeAdmins }: Props) {
  const { t } = useT('orgGuide');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<GuideCategory>>(new Set());
  const [denied, setDenied] = useState<GuideAction | null>(null);

  // Le catalogue est typé depuis le JSON ; les clés d'action sont construites,
  // d'où ce passage unique par une fonction de lecture tolérante.
  const tx = useCallback((key: string) => t(key as Parameters<typeof t>[0]), [t]);

  const groups = useMemo(() => GUIDE_CATEGORIES.map((cat) => ({
    cat,
    items: GUIDE_ACTIONS
      .filter((a) => a.category === cat)
      .map((a) => ({ action: a, access: guideAccess(a, viewer) }))
      .filter(({ access }) => access !== 'hidden')
      .filter(({ action }) => matchesGuideQuery(query, tx(`actions.${action.id}.label`), tx(`actions.${action.id}.synonyms`))),
  })).filter((g) => g.items.length > 0), [query, viewer, tx]);

  const toggle = (cat: GuideCategory) => setCollapsed((s) => {
    const n = new Set(s);
    if (n.has(cat)) n.delete(cat); else n.add(cat);
    return n;
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setDenied(null); onClose(); } }}>
      <SheetContent side="right" className="flex w-[320px] flex-col gap-0 p-0 sm:max-w-[320px]">
        <SheetHeader className="px-4 pb-2 pt-4">
          <SheetTitle>{t('drawer.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('drawer.searchPlaceholder')}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-2">
          <Input
            type="search"
            value={query}
            aria-label={t('drawer.searchPlaceholder')}
            placeholder={t('drawer.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.length === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">{t('drawer.noResult')}</p>}
          {groups.map(({ cat, items }) => {
            const Icon = ICONS[cat];
            const isOpen = query !== '' || !collapsed.has(cat);
            return (
              <section key={cat}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-3 pb-1 pt-3 text-xs text-muted-foreground"
                  onClick={() => toggle(cat)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />{t(`categories.${cat}`)}
                  <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
                </button>
                {isOpen && items.map(({ action, access }) => (
                  <button
                    key={action.id}
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${access === 'denied' ? 'text-muted-foreground' : ''}`}
                    onClick={() => (access === 'allowed' ? onStart(action) : setDenied(action))}
                  >
                    {access === 'allowed'
                      ? <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      : <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <span>{tx(`actions.${action.id}.label`)}</span>
                    {access === 'denied' && (
                      <span className="ml-auto shrink-0 rounded border border-[rgb(var(--color-warning)/0.5)] bg-[rgb(var(--color-warning)/0.15)] px-1.5 text-[11px] text-foreground">
                        {tx(badgeKey(action))}
                      </span>
                    )}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
        {denied && (
          <div
            role="alertdialog"
            aria-labelledby="org-guide-denied"
            aria-describedby="org-guide-denied-body"
            className="m-3 rounded-xl border border-border bg-card p-3 text-card-foreground"
          >
            <p id="org-guide-denied" className="mb-1 text-sm font-medium">
              {t('denied.title')} · {tx(`actions.${denied.id}.label`)}
            </p>
            <p id="org-guide-denied-body" className="mb-3 text-sm text-muted-foreground">
              {t('denied.body', { right: tx(deniedRightKey(denied)) })}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => { setDenied(null); onSeeAdmins(); }}>
                {t('denied.seeAdmins')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDenied(null)}>{t('drawer.close')}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
