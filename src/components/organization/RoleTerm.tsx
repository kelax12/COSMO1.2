import { useEffect, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useT } from '@/i18n/useT';
import { claimFirstSight, openOrgGlossary, termDefKey, termNameKey, type OrgTerm } from './org-glossary';

/**
 * Un rôle (ou un objet) nommé à l'écran, avec sa définition à portée de clic.
 *
 * Au PREMIER affichage de ce terme sur l'appareil, la définition s'ouvre
 * d'elle-même, une fois (cf. `claimFirstSight`). Ensuite, le « ? » suffit.
 */
const RoleTerm = ({ term, children, className = '' }: { term: OrgTerm; children: ReactNode; className?: string }) => {
  const { t } = useT('org');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (claimFirstSight(term)) setOpen(true);
  }, [term]);
  const name = t(termNameKey(term));

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {children}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('glossary.termHelp', { term: name })}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-current opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
          >
            <HelpCircle size={11} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[10001] w-72 text-xs normal-case tracking-normal font-normal bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-1">{name}</p>
          <p className="leading-relaxed">{t(termDefKey(term))}</p>
          <button
            type="button"
            onClick={() => { setOpen(false); openOrgGlossary(term); }}
            className="mt-2 text-xs font-semibold text-[rgb(var(--color-accent))] hover:underline"
          >
            {t('glossary.seeAll')}
          </button>
        </PopoverContent>
      </Popover>
    </span>
  );
};

export default RoleTerm;
