import React, { useState } from 'react';
import { ArrowUpDown, ArrowDown, ArrowUp, Check } from 'lucide-react';
import BottomSheet from '@/components/mobile/BottomSheet';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

/**
 * Le tri de la page Tâches, sur mobile : une pilule dans la barre ancrée.
 *
 * Il vivait dans un `<select>` en haut de page (`TaskFilter`), seul rescapé
 * d'une rangée dont la recherche et « + d'options » étaient déjà partis. Un
 * menu déroulant natif en haut d'écran pour un réglage qu'on change souvent,
 * c'était la dernière commande hors de portée du pouce.
 *
 * ⚠️ La pilule AFFICHE le critère courant. Le menu déroulant le faisait, et le
 * remplacer par une icône seule aurait retiré l'information en même temps que
 * la commande : on ne saurait plus dans quel ordre on lit sa liste sans ouvrir
 * la feuille.
 *
 * Desktop : `TaskFilter` garde son `<select>`, ce composant est `md:hidden`.
 */

interface Props {
  /** Critère courant : 'priority' | 'deadline' | 'createdAt' | 'name' | 'category'. */
  field: string;
  direction: 'asc' | 'desc';
  onFieldChange: (value: string) => void;
  onToggleDirection: () => void;
}

/** Les cinq critères, avec leur libellé long (feuille) et court (pilule). */
const FIELDS: Array<{ value: string; longKey: KeyOf<'tasks'>; shortKey: KeyOf<'tasks'> }> = [
  { value: 'priority', longKey: 'sort.priority', shortKey: 'sort.shortPriority' },
  { value: 'deadline', longKey: 'sort.deadline', shortKey: 'sort.shortDeadline' },
  { value: 'createdAt', longKey: 'sort.createdAt', shortKey: 'sort.shortCreatedAt' },
  { value: 'name', longKey: 'sort.name', shortKey: 'sort.shortName' },
  { value: 'category', longKey: 'sort.category', shortKey: 'sort.shortCategory' },
];

const MobileSortButton: React.FC<Props> = ({ field, direction, onFieldChange, onToggleDirection }) => {
  const { t } = useT('tasks');
  const [open, setOpen] = useState(false);
  const current = FIELDS.find((f) => f.value === field);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('sort.label')}
        aria-haspopup="dialog"
        className="md:hidden shrink-0 flex items-center gap-1.5 h-12 max-w-[45%] rounded-full bg-[rgb(var(--color-chip-bg))] px-4 text-[rgb(var(--color-text-secondary))]"
      >
        <ArrowUpDown size={16} aria-hidden="true" className="shrink-0" />
        <span className="truncate text-label font-medium">
          {current ? t(current.shortKey) : t('sort.label')}
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={t('sort.label')}>
        <div className="px-gutter pb-4">
          <h2 className="text-title font-bold py-3 text-[rgb(var(--color-text-primary))]">
            {t('sort.label')}
          </h2>

          <ul>
            {FIELDS.map((f, index) => (
              <li key={f.value}>
                <button
                  type="button"
                  onClick={() => onFieldChange(f.value)}
                  aria-pressed={f.value === field}
                  className="flex w-full items-center gap-3 text-left active:bg-[rgb(var(--color-hover))]"
                >
                  <span
                    className={`flex flex-1 items-center gap-3 min-h-touch py-3 ${
                      index < FIELDS.length - 1 ? 'border-b border-[rgb(var(--color-border))]' : ''
                    }`}
                  >
                    <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">
                      {t(f.longKey)}
                    </span>
                    {f.value === field && (
                      <Check size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* ⚠️ Ni le critère ni le sens ne referment la feuille : trier est un
              choix EN DEUX TEMPS, et changer de critère remet le sens en
              croissant (`handleFilterChange`). Refermer au premier appui
              obligerait à rouvrir pour la moitié du réglage. */}
          <button
            type="button"
            onClick={onToggleDirection}
            className="mt-4 flex w-full items-center gap-3 min-h-touch px-4 rounded-xl bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-primary))] active:bg-[rgb(var(--color-hover))]"
          >
            {direction === 'asc'
              ? <ArrowUp size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />
              : <ArrowDown size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />}
            <span className="flex-1 text-left text-body">
              {direction === 'asc' ? t('sort.ascTitle') : t('sort.descTitle')}
            </span>
          </button>
        </div>
      </BottomSheet>
    </>
  );
};

export default MobileSortButton;
