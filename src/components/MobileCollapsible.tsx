import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileCollapsibleProps {
  title: string;
  badge?: number | string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const MobileCollapsible: React.FC<MobileCollapsibleProps> = ({
  title,
  badge,
  defaultOpen = false,
  children,
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 min-h-11 text-left',
          'bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]',
          'hover:bg-[rgb(var(--color-hover))] transition-colors',
          open ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'
        )}
      >
        <span className="flex items-center gap-2 font-bold text-[rgb(var(--color-text-primary))]">
          {title}
          {badge !== undefined && badge !== 0 && badge !== '0' && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent))] text-white">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={cn(
            'text-[rgb(var(--color-text-muted))] transition-transform duration-200 shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="mobile-collapsible-body [&>div]:rounded-t-none [&>div]:border-t-0">{children}</div>
      )}
    </div>
  );
};

export default MobileCollapsible;
