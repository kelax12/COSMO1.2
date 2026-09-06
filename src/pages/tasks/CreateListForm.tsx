// ═══════════════════════════════════════════════════════════════════
// Créer une liste — un formulaire, deux emplacements
//
// FRONTIÈRE : ce composant ne connaît ni les listes existantes, ni les
// tâches, ni la barre qui l'accueille. Un nom, une couleur, deux rappels.
//
// Il existait en DEUX exemplaires dans `TaskListsBar` : la variante `inline`
// (desktop, dans le fil des chips) et la variante `stacked` (mobile, sous
// l'en-tête). Mêmes champs, même soumission, deux mises en page — et deux
// occasions de diverger, ce qui était déjà arrivé (cf. ci-dessous).
//
// ⚠️ La pastille résout sa couleur par `resolveListColor` dans les DEUX
// variantes. La version mobile cherchait la teinte dans `colorOptions` et
// retombait sur le bleu : une couleur hex personnalisée — que seul le
// sélecteur desktop permet de poser, sur un état partagé — s'affichait donc
// en bleu sur mobile. Le sélecteur hex, lui, reste desktop : il s'ouvre par
// Maj+clic, un geste qui n'existe pas au doigt.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useT } from '@/i18n/useT';

interface ColorOption {
  value: string;
  color: string;
}

interface CreateListFormProps {
  name: string;
  onNameChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  colorOptions: ColorOption[];
  /** Résout une valeur de couleur (nom de palette OU hex) en teinte affichable. */
  resolveColor: (value: string) => string;
  onSubmit: () => void;
  onCancel: () => void;
  /** `inline` : desktop, dans le fil des chips. `stacked` : mobile, pleine largeur. */
  variant: 'inline' | 'stacked';
}

const CreateListForm = ({
  name,
  onNameChange,
  color,
  onColorChange,
  colorOptions,
  resolveColor,
  onSubmit,
  onCancel,
  variant,
}: CreateListFormProps) => {
  const { t } = useT('tasks');
  const isInline = variant === 'inline';

  const cycleColor = () => {
    const idx = colorOptions.findIndex((c) => c.value === color);
    onColorChange(colorOptions[(idx + 1) % colorOptions.length].value);
  };

  return (
    <motion.form
      key={isInline ? 'add-form' : 'add-form-mobile'}
      initial={isInline ? { opacity: 0, width: 0 } : { opacity: 0 }}
      animate={isInline ? { opacity: 1, width: 'auto' } : { opacity: 1 }}
      exit={isInline ? { opacity: 0, width: 0 } : { opacity: 0 }}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit();
      }}
    >
      {/* Pastille cyclique : un clic passe à la couleur suivante.
          Maj+clic (desktop) ouvre le sélecteur hex natif caché juste après. */}
      <button
        type="button"
        onClick={(e) => {
          if (isInline && e.shiftKey) {
            e.currentTarget.nextElementSibling?.dispatchEvent(new MouseEvent('click'));
            return;
          }
          cycleColor();
        }}
        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
        style={{ backgroundColor: resolveColor(color) }}
        title={isInline ? t('lists.colorCycleTitle') : t('lists.changeColor')}
      />
      {isInline && (
        <input
          type="color"
          value={resolveColor(color)}
          onChange={(e) => onColorChange(e.target.value)}
          className="sr-only"
          aria-label={t('lists.customColorAria')}
          tabIndex={-1}
        />
      )}
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t('lists.namePlaceholder')}
        {...(isInline ? { size: Math.max(name.length + 2, 14) } : {})}
        className={
          isInline
            ? 'px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0'
            : 'flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500'
        }
        style={{
          backgroundColor: 'rgb(var(--color-surface))',
          borderColor: 'rgb(var(--color-border))',
          color: 'rgb(var(--color-text-primary))',
          ...(isInline ? { fieldSizing: 'content' } : {}),
        } as React.CSSProperties}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className={`${isInline ? 'px-3 py-1.5' : 'px-3 py-2'} text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all`}
      >
        {t('lists.create')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <X size={14} />
      </button>
    </motion.form>
  );
};

export default CreateListForm;
