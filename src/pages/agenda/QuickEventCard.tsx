import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AddCategoryButton from '@/components/AddCategoryButton';
import CategoryTreeSelect from '@/components/category/CategoryTreeSelect';
import type { Category } from '@/modules/categories';
import { formatTimeInTz, toDisplayISO, getTimezonePref, type TimezonePref } from '@/lib/timezone';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

// ── Petite popup de création rapide depuis une plage horaire ────────────────
interface QuickEventCardProps {
  slot: { start: string; end: string; x: number; y: number };
  categories: Category[];
  /** Fuseau d'affichage choisi (heure locale par défaut). */
  tzPref?: TimezonePref;
  onCreate: (title: string, color?: string) => void;
  onClose: () => void;
  /** Ouvre le gestionnaire de catégories (bouton « + Ajouter »). */
  onAddCategory?: () => void;
}

const QuickEventCard: React.FC<QuickEventCardProps> = ({ slot, categories, tzPref, onCreate, onClose, onAddCategory }) => {
  const { t } = useT('agenda');
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState(categories[0]?.id ?? '');
  const pref = tzPref ?? getTimezonePref();
  // slot.start/end sont des instants « vrais » : on affiche date + heure dans le
  // fuseau choisi (heure locale en mode défaut).
  const start = new Date(toDisplayISO(slot.start, pref));
  const fmt = (iso: string) => formatTimeInTz(iso, pref);
  const color = categories.find((c) => c.id === cat)?.color;

  // Recolore l'aperçu de sélection FullCalendar (.fc-event-mirror) selon la
  // catégorie choisie. La classe body.fc-quick-preview scope la règle CSS à la
  // création rapide uniquement (sinon le mirror de drag&drop perdrait sa
  // couleur réelle). Tout est nettoyé à la fermeture de la popup.
  useEffect(() => {
    const root = document.documentElement;
    document.body.classList.add('fc-quick-preview');
    if (color) root.style.setProperty('--fc-mirror-color', color);
    else root.style.removeProperty('--fc-mirror-color');
    return () => {
      document.body.classList.remove('fc-quick-preview');
      root.style.removeProperty('--fc-mirror-color');
    };
  }, [color]);
  const submit = () => { if (title.trim()) onCreate(title.trim(), color); };
  const left = Math.max(8, Math.min(slot.x, window.innerWidth - 272));
  const top = Math.max(8, Math.min(slot.y, window.innerHeight - 240));
  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Cette surface n'en portait aucune.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: onClose,
    label: t('quickCreate.aria'),
  });
  return (
    <div ref={modalA11yRef} {...modalA11yProps} className="fixed inset-0 z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-popover text-popover-foreground border-border absolute w-64 rounded-lg border p-3 shadow-xl"
        style={{ left, top }}
      >
        <div className="text-muted-foreground mb-2 text-xs">
          {formatDate(start, { weekday: 'short', day: 'numeric' })} · {fmt(slot.start)} – {fmt(slot.end)}
        </div>
        <Input
          autoFocus
          value={title}
          placeholder={t('quickCreate.titlePlaceholder')}
          className="mb-2 h-8"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
        />
        {(categories.length > 0 || onAddCategory) && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">
                {t('quickCreate.categoryPlaceholder')}
              </span>
              {onAddCategory && (
                <AddCategoryButton onClick={onAddCategory} ariaLabel={t('quickCreate.addCategory')} />
              )}
            </div>
            {/* z-[70] : le panneau se porte en PORTAIL (Radix), donc hors de
                cette popup ; son z-50 par défaut passerait sous l'overlay
                z-[60] de QuickEventCard. */}
            <CategoryTreeSelect value={cat} onChange={setCat} categories={categories} panelClassName="z-[70]" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{t('quickCreate.cancel')}</Button>
          <Button
            type="button"
            size="sm"
            disabled={!title.trim()}
            onClick={submit}
            className={`!border-0 ${
              !title.trim()
                ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))] !opacity-40'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))]'
            }`}
          >
            {t('quickCreate.create')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickEventCard;
