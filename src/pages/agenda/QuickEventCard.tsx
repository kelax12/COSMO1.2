import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatTimeInTz, toDisplayISO, getTimezonePref, type TimezonePref } from '@/lib/timezone';

// Valeur factice interceptée par onValueChange pour ouvrir le gestionnaire de
// catégories au lieu de sélectionner une catégorie (#option "+ Ajouter").
const ADD_CATEGORY_VALUE = '__add_category__';

// ── Petite popup de création rapide depuis une plage horaire ────────────────
interface QuickEventCardProps {
  slot: { start: string; end: string; x: number; y: number };
  categories: { id: string; name: string; color: string }[];
  /** Fuseau d'affichage choisi (heure locale par défaut). */
  tzPref?: TimezonePref;
  onCreate: (title: string, color?: string) => void;
  onClose: () => void;
  /** Ouvre le gestionnaire de catégories (option « + Ajouter une catégorie »). */
  onAddCategory?: () => void;
}

const QuickEventCard: React.FC<QuickEventCardProps> = ({ slot, categories, tzPref, onCreate, onClose, onAddCategory }) => {
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
  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-popover text-popover-foreground border-border absolute w-64 rounded-lg border p-3 shadow-xl"
        style={{ left, top }}
      >
        <div className="text-muted-foreground mb-2 text-xs">
          {start.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })} · {fmt(slot.start)} – {fmt(slot.end)}
        </div>
        <Input
          autoFocus
          value={title}
          placeholder="Titre de l'événement"
          className="mb-2 h-8"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
        />
        {(categories.length > 0 || onAddCategory) && (
          <Select
            value={cat}
            onValueChange={(value) => {
              if (value === ADD_CATEGORY_VALUE) { onAddCategory?.(); return; }
              setCat(value);
            }}
          >
            <SelectTrigger className="mb-2 h-8 w-full"><SelectValue placeholder="Catégorie" /></SelectTrigger>
            <SelectContent className="z-[70]">
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
              {onAddCategory && (
                <>
                  {categories.length > 0 && <SelectSeparator />}
                  <SelectItem value={ADD_CATEGORY_VALUE} className="group">
                    <span className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 group-focus:text-inherit font-medium">
                      <Plus size={12} aria-hidden="true" />
                      Ajouter une catégorie
                    </span>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            size="sm"
            disabled={!title.trim()}
            onClick={submit}
            className={`!text-white !border-0 ${
              !title.trim()
                ? '!bg-blue-300 dark:!bg-blue-900/60 !opacity-100'
                : '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))]'
            }`}
          >
            Créer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickEventCard;
