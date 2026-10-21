// src/components/perso-guide/PersoGuideDrawer.tsx
import { useMemo, useState } from 'react';
import { Calendar, CheckSquare, ChevronDown, Play, Repeat, Target } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { matchesGuideQuery } from '@/components/org-guide/guide-search';
import type { GuideT } from '@/components/org-guide/use-guide-demo';
import { PERSO_GUIDE_ACTIONS, PERSO_GUIDE_CATEGORIES, type PersoGuideAction, type PersoGuideCategory } from './scenarios';

const ICONS: Record<PersoGuideCategory, typeof CheckSquare> = { tasks: CheckSquare, agenda: Calendar, habits: Repeat, okr: Target };

interface Props {
  open: boolean;
  t: GuideT;
  onClose: () => void;
  onStart: (action: PersoGuideAction) => void;
}

/**
 * Tiroir du guide perso. Même gabarit que `OrgGuideDrawer`, sans droits :
 * en espace perso, toute action est permise à son propriétaire.
 */
export function PersoGuideDrawer({ open, t, onClose, onStart }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<PersoGuideCategory>>(() => new Set(PERSO_GUIDE_CATEGORIES));

  const groups = useMemo(() => PERSO_GUIDE_CATEGORIES.map((cat) => ({
    cat,
    items: PERSO_GUIDE_ACTIONS
      .filter((a) => a.category === cat)
      .filter((a) => matchesGuideQuery(query, t(`actions.${a.id}.label`), t(`actions.${a.id}.synonyms`))),
  })).filter((g) => g.items.length > 0), [query, t]);

  const toggle = (cat: PersoGuideCategory) => setCollapsed((s) => {
    const n = new Set(s);
    if (n.has(cat)) n.delete(cat); else n.add(cat);
    return n;
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
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
                {isOpen && items.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => onStart(action)}
                  >
                    <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{t(`actions.${action.id}.label`)}</span>
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
