import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export type AddToListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
};

export const COLOR_PALETTE: { key: string; hex: string; label: string }[] = [
  { key: 'blue',   hex: '#3B82F6', label: 'Bleu' },
  { key: 'red',    hex: '#EF4444', label: 'Rouge' },
  { key: 'green',  hex: '#10B981', label: 'Vert' },
  { key: 'purple', hex: '#8B5CF6', label: 'Violet' },
  { key: 'orange', hex: '#F97316', label: 'Orange' },
  { key: 'yellow', hex: '#F59E0B', label: 'Jaune' },
  { key: 'pink',   hex: '#EC4899', label: 'Rose' },
  { key: 'indigo', hex: '#6366F1', label: 'Indigo' },
];

const colorMap: Record<string, string> = Object.fromEntries(
  COLOR_PALETTE.map((c) => [c.key, c.hex])
);
export const resolveColor = (color: string) => colorMap[color] || color;

/* ─── Colour picker row ─────────────────────────────────────────────────── */
export const ColorRow: React.FC<{
  selected: string;
  onChange: (key: string) => void;
}> = ({ selected, onChange }) => (
  <div className="flex items-center gap-2 flex-wrap">
    {COLOR_PALETTE.map((c) => (
      <button
        key={c.key}
        type="button"
        onClick={() => onChange(c.key)}
        aria-label={`Couleur ${c.label}`}
        aria-pressed={selected === c.key}
        className="w-6 h-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          backgroundColor: c.hex,
          transform: selected === c.key ? 'scale(1.25)' : 'scale(1)',
          outline: selected === c.key ? `2px solid ${c.hex}` : 'none',
          outlineOffset: 2,
        }}
      />
    ))}
  </div>
);

/* ─── Inline form (create / edit) ────────────────────────────────────────── */
export const InlineForm: React.FC<{
  initialName?: string;
  initialColor?: string;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  saveLabel?: string;
}> = ({ initialName = '', initialColor = 'blue', onSave, onCancel, saveLabel = 'Créer' }) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl bg-[rgb(var(--color-surface))] p-4 space-y-3"
    >
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onSave(name.trim(), color);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Nom de la liste"
        className="w-full h-11 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-slate-50 dark:bg-slate-800/50 text-sm font-medium focus:outline-none focus:border-[rgb(var(--color-accent-solid))] focus:ring-2 focus:ring-blue-500/20 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] transition-all"
      />
      <ColorRow selected={color} onChange={setColor} />
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-9 rounded-lg border border-[rgb(var(--color-border))] text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => { if (name.trim()) onSave(name.trim(), color); }}
          disabled={!name.trim()}
          className="flex-1 min-h-9 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
        >
          {saveLabel}
        </button>
      </div>
    </motion.div>
  );
};
