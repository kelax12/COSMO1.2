// ═══════════════════════════════════════════════════════════════════
// DescriptionField — textarea de description + mode plein écran
// ═══════════════════════════════════════════════════════════════════
// Un bouton d'agrandissement est posé DANS le champ (coin bas-droit). Au clic,
// une popup imbriquée (Radix Dialog, donc focus-trap correct par-dessus le
// TaskModal) affiche la seule description en beaucoup plus grand, avec une
// croix pour revenir au modal. La valeur reste contrôlée par le formulaire :
// tout ce qui est tapé en plein écran est déjà dans `formData.description`.
import React, { useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export interface DescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  autoFocus?: boolean;
  /** Classes du textarea inline (le mode plein écran a les siennes). */
  className?: string;
  style?: React.CSSProperties;
  /** Titre affiché en haut de la vue plein écran. */
  expandedTitle?: string;
}

const DescriptionField: React.FC<DescriptionFieldProps> = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  id,
  autoFocus,
  className = '',
  style,
  expandedTitle = 'Description',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          autoFocus={autoFocus}
          placeholder={placeholder}
          // pb-10 : réserve la place du bouton pour que le texte ne passe
          // jamais dessous en fin de champ.
          className={`${className} pb-10`}
          style={style}
        />
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-label="Agrandir la description"
          title="Agrandir la description"
          className="absolute bottom-2 right-2 p-1.5 rounded-md transition-colors hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
          style={{ color: 'rgb(var(--color-text-secondary))', backgroundColor: 'rgb(var(--color-surface))' }}
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent
          showCloseButton={false}
          // Sans ça, Radix pose le focus sur la croix : on veut le curseur
          // directement dans le texte, à la fin de ce qui est déjà écrit.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const el = expandedRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }}
          className="max-w-[calc(100%-1.5rem)] sm:max-w-3xl w-full h-[85vh] p-0 gap-0 flex flex-col overflow-hidden border-[rgb(var(--color-border))]"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--color-border))' }}>
            <DialogTitle className="text-base font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {expandedTitle}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="Fermer et revenir au formulaire"
              className="p-2 rounded-lg transition-colors hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
              style={{ color: 'rgb(var(--color-text-secondary))' }}
            >
              <X size={20} />
            </button>
          </div>
          <textarea
            ref={expandedRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 w-full px-5 py-4 text-base leading-relaxed bg-transparent resize-none focus:outline-none"
            style={{ color: 'rgb(var(--color-text-primary))' }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DescriptionField;
