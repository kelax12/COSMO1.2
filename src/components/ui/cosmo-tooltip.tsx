import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface CosmoTooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Infobulle native COSMO : jetons de thème, ouverture rapide, au survol ET au
 * focus clavier (Radix). L'enfant doit accepter une ref (un élément DOM).
 */
const CosmoTooltip = ({ label, children, side = 'top' }: CosmoTooltipProps) => (
  <Tooltip delayDuration={150}>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent
      side={side}
      sideOffset={6}
      className="z-[60] rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-text-primary))] shadow-md [&>svg]:hidden"
    >
      {label}
    </TooltipContent>
  </Tooltip>
);

export default CosmoTooltip;
