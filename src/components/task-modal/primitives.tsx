// Atomes de présentation (style « cellule iOS ») du corps mobile de TaskModal.
// Purement présentationnels, sans état ni dépendance au reste du modal →
// extraits pour alléger TaskModal.tsx et permettre la réutilisation.
import React from 'react';
import { ChevronRight } from 'lucide-react';

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
    {children}
  </p>
);

export const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-[rgb(var(--color-surface))] rounded-2xl overflow-hidden shadow-sm ${className}`}>
    {children}
  </div>
);

export const CellSeparator: React.FC = () => (
  <div className="h-px bg-[rgb(var(--color-border))] ml-4" />
);

export interface CellProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  onTap?: () => void;
  showChevron?: boolean;
  className?: string;
}

export const Cell: React.FC<CellProps> = ({ label, value, onTap, showChevron = true, className = '' }) => (
  <button
    type="button"
    onClick={onTap}
    disabled={!onTap}
    className={`w-full flex items-center justify-between px-4 min-h-11 active:bg-[rgb(var(--color-hover))] transition-colors disabled:cursor-default ${className}`}
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{label}</span>
    <span className="flex items-center gap-1.5 shrink-0 ml-2">
      {value && <span className="text-[15px]">{value}</span>}
      {showChevron && onTap && <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />}
    </span>
  </button>
);
