// Édition EN LIGNE d'une cellule de tableau : un petit panneau dédié à UNE
// donnée (nom, durée, liste de choix), partagé par les tableaux perso et
// entreprise. La grande fiche reste au clic sur le reste de la ligne.

import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const cellBtn = 'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 max-w-full text-left transition-colors hover:bg-[rgb(var(--color-hover))] disabled:cursor-not-allowed disabled:hover:bg-transparent';
const panel = 'w-64 p-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg';
const optionCls = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]';
const inputCls = 'w-full rounded-md border border-[rgb(var(--color-border))] bg-transparent px-2 py-1.5 text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]';
const submitCls = 'rounded-md px-3 py-1 text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]';

interface InlineShellProps {
  label: string;
  disabledReason?: string;
  trigger: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}

/** Déclencheur + panneau : un seul gabarit pour toutes les cellules. */
export const InlineShell = ({ label, disabledReason, trigger, triggerClassName = '', panelClassName = panel, children }: InlineShellProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={!!disabledReason} title={disabledReason} aria-label={label} className={`${cellBtn} ${triggerClassName}`}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className={panelClassName} onClick={(e) => e.stopPropagation()}>
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
};

export interface InlineOption<T extends string | number | null> { id: T; label: string; dot?: string; color?: string }

export const OptionList = <T extends string | number | null>({ options, current, onPick }: {
  options: readonly InlineOption<T>[]; current: T; onPick: (id: T) => void;
}) => (
  <div className="max-h-72 overflow-y-auto" role="listbox">
    {options.map((o) => (
      <button key={String(o.id)} type="button" role="option" aria-selected={o.id === current} className={optionCls} onClick={() => onPick(o.id)}>
        {(o.dot || o.color) && <span className={`w-2 h-2 rounded-full shrink-0 ${o.dot ?? ''}`} style={o.color ? { backgroundColor: o.color } : undefined} aria-hidden="true" />}
        <span className="truncate">{o.label}</span>
        {o.id === current && <Check size={14} className="ml-auto shrink-0" aria-hidden="true" />}
      </button>
    ))}
  </div>
);

/** Champ texte (renommer) : Entrée ou « Enregistrer » valide, vide ou inchangé n'écrit rien. */
export const TextEditor = ({ value, label, saveLabel, onSave, close }: {
  value: string; label: string; saveLabel: string; onSave: (v: string) => void; close: () => void;
}) => {
  const [draft, setDraft] = useState(value);
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => {
      e.preventDefault();
      const v = draft.trim();
      if (v && v !== value) onSave(v);
      close();
    }}>
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} className={inputCls} aria-label={label} />
      <button type="submit" className={`self-end ${submitCls}`}>{saveLabel}</button>
    </form>
  );
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

/** Durée en minutes : préréglages + saisie libre (0 à une semaine). */
export const DurationEditor = ({ value, label, format, onPick, close }: {
  value: number; label: string; format: (m: number) => string; onPick: (m: number) => void; close: () => void;
}) => {
  const [draft, setDraft] = useState(String(value || ''));
  const pick = (m: number) => { close(); if (m !== value) onPick(m); };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1">
        {DURATION_PRESETS.map((m) => (
          <button key={m} type="button" onClick={() => pick(m)}
            className={`rounded-md px-1 py-1.5 text-xs font-semibold transition-colors ${m === value ? 'bg-[rgb(var(--color-accent)/0.15)] text-[rgb(var(--color-accent))]' : 'hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'}`}>
            {format(m)}
          </button>
        ))}
      </div>
      <form className="flex items-center gap-2" onSubmit={(e) => {
        e.preventDefault();
        const m = Math.round(Number(draft));
        if (Number.isFinite(m) && m >= 0 && m <= 10080) pick(m);
      }}>
        <input type="number" min={0} max={10080} step={5} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputCls} aria-label={label} />
        <span className="text-xs text-[rgb(var(--color-text-muted))] shrink-0">min</span>
        <button type="submit" className={submitCls}>OK</button>
      </form>
    </div>
  );
};
