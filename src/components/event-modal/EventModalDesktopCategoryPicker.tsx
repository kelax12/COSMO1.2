// ════════════════════════════════════════════════════════════════
// EventModalDesktopCategoryPicker — colonne droite du corps desktop
// ════════════════════════════════════════════════════════════════
//
// Extrait de `EventModalFormDesktop.tsx` le 2026-09-14 (C-75) : le fichier avait
// franchi les 600 lignes du cliquet `architecture.guard`. La frontière est celle
// des deux colonnes du formulaire — à gauche ce que l'événement EST (titre,
// dates, récurrence, description), à droite comment on le CLASSE (catégorie,
// sous-catégorie, légende). Aucune logique n'a changé.
//
// Les deux états qui ne servent qu'ici vivent ici : la bulle de sous-catégories
// ouverte pour AU PLUS une racine, et le repli de la légende.
import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AddCategoryButton from '@/components/AddCategoryButton';
import { useT } from '@/i18n/useT';

interface EventModalDesktopCategoryPickerProps {
  /** Même forme structurelle que `EventModalFormBodyProps.categories` : le
   *  modal peut recevoir deux jeux de catégories (compte ou surcharge), donc on
   *  ne dépend pas du type complet de `@/modules/categories`. */
  categories: Array<{ id: string; name: string; color: string; parentId: string | null }>;
  /** Couleur courante de l'événement — c'est elle qui dit quelle (sous-)catégorie
   *  est sélectionnée : l'événement porte une couleur, pas un identifiant. */
  color: string;
  setColor: (value: string) => void;
  /** Marque le champ comme touché (mode pré-rempli) et applique la valeur. */
  handleFieldChange: (field: string, setter: (value: string) => void, value: string) => void;
  setIsColorSettingsOpen: (open: boolean) => void;
}

const EventModalDesktopCategoryPicker: React.FC<EventModalDesktopCategoryPickerProps> = ({
  categories, color, setColor, handleFieldChange, setIsColorSettingsOpen,
}) => {
  const { t } = useT('eventModal');
  // Légende des catégories masquée par défaut (épure l'UI) — révélée à la demande.
  const [showCategoryLegend, setShowCategoryLegend] = useState(false);
  // Bulle de sous-catégories : ouverte pour AU PLUS une racine à la fois,
  // sur sélection (pas au survol).
  const [openSubcategoriesFor, setOpenSubcategoriesFor] = useState<string | null>(null);
  // Grille RACINES seules : une sous-catégorie ne doit jamais s'y afficher,
  // elle ne vit que dans la bulle ouverte depuis sa racine.
  const rootCategories = categories.filter((cat) => !cat.parentId);
  const subcategoriesOf = (parentId: string) => categories.filter((cat) => cat.parentId === parentId);

  return (
    <div className="md:col-span-5 space-y-3">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgb(var(--color-text-secondary))" }}
          >
            {t('color')}
          </label>
          {/* Pattern unifié (audit UI §5) — remplace l'icône Plus nue
              non focusable qui vivait dans le <label>. */}
          <AddCategoryButton onClick={() => setIsColorSettingsOpen(true)} />
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-6 pb-1 pr-1">
          {rootCategories.map((cat) => {
            const subs = subcategoriesOf(cat.id);
            const hasSubs = subs.length > 0;
            // Sélectionnée si elle porte la couleur courante, OU si
            // l'une de ses sous-catégories la porte (la racine reste le
            // repère visuel de la « famille » choisie).
            const isSelected = color === cat.color || subs.some((s) => s.color === color);
            return (
              <Popover
                key={cat.id}
                open={openSubcategoriesFor === cat.id}
                onOpenChange={(next) => setOpenSubcategoriesFor(next ? cat.id : null)}
              >
                <PopoverTrigger asChild>
                  <div className="relative group" style={{ zIndex: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange("color", setColor, cat.color);
                        // Racine sans enfants : choix immédiat, pas de bulle.
                        setOpenSubcategoriesFor(hasSubs ? cat.id : null);
                      }}
                      className="relative w-full h-10 rounded-lg border-2 transition-all hover:scale-105 shrink-0"
                      style={{
                        backgroundColor: cat.color,
                        borderColor: isSelected
                          ? "rgb(var(--color-text-primary))"
                          : "rgb(var(--color-border))",
                        boxShadow: isSelected
                          ? "0 4px 10px rgba(0,0,0,0.15)"
                          : "none",
                      }}
                      title={cat.name}
                    >
                      {color === cat.color && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div
                            className="w-3.5 h-3.5 rounded-full"
                            style={{
                              backgroundColor: "rgb(var(--color-surface))",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                            }}
                          />
                        </div>
                      )}
                      {/* Repère « a des sous-catégories » — même bleu que le
                          chevron d'expansion partout ailleurs dans l'app. */}
                      {hasSubs && (
                        <span
                          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2"
                          style={{
                            backgroundColor: 'rgb(59 130 246)',
                            borderColor: 'rgb(var(--color-surface))',
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                    <span
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-caption font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                      style={{ color: "rgb(var(--color-text-muted))", zIndex: 9999 }}
                    >
                      {cat.name}
                    </span>
                  </div>
                </PopoverTrigger>
                {hasSubs && (
                  <PopoverContent
                    align="start"
                    className="w-auto p-2 z-[100]"
                    aria-label={t('subcategoriesOf', { name: cat.name })}
                  >
                    <p
                      className="text-caption font-bold uppercase tracking-widest mb-1.5 px-0.5"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                    >
                      {cat.name}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {/* « Aucune » — reste sur la couleur simple de la racine,
                          sans se raffiner vers une sous-catégorie. Toujours en
                          premier : c'est le choix le moins engageant. */}
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange("color", setColor, cat.color);
                          setOpenSubcategoriesFor(null);
                        }}
                        className="relative w-9 h-9 rounded-lg border-2 transition-all hover:scale-105 shrink-0 flex items-center justify-center"
                        style={{
                          backgroundColor: "rgb(var(--color-hover))",
                          borderColor: color === cat.color
                            ? "rgb(var(--color-text-primary))"
                            : "rgb(var(--color-border))",
                        }}
                        title={t('subcategoryNone')}
                        aria-label={t('subcategoryNoneAria', { name: cat.name })}
                      >
                        <Ban size={16} style={{ color: "rgb(var(--color-text-muted))" }} aria-hidden="true" />
                      </button>
                      {subs.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            handleFieldChange("color", setColor, sub.color);
                            setOpenSubcategoriesFor(null);
                          }}
                          className="relative w-9 h-9 rounded-lg border-2 transition-all hover:scale-105 shrink-0"
                          style={{
                            backgroundColor: sub.color,
                            borderColor: color === sub.color
                              ? "rgb(var(--color-text-primary))"
                              : "rgb(var(--color-border))",
                          }}
                          title={sub.name}
                        >
                          {color === sub.color && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: "rgb(var(--color-surface))",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                                }}
                              />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>

        {categories.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowCategoryLegend((v) => !v)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 -mx-1"
            >
              {showCategoryLegend ? t('hideLegend') : t('showLegend')}
            </button>
            {showCategoryLegend && (
              <div
                className="mt-2 p-2.5 rounded-xl border transition-colors overflow-hidden"
                style={{
                  borderColor: "rgb(var(--color-border))",
                  backgroundColor: "rgb(var(--color-surface))",
                }}
              >
                <h4
                  className="text-[12px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: "rgb(var(--color-text-muted))" }}
                >
                  {t('legend')}
                </h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-2 h-2 rounded-full shadow-sm shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span
                        className="text-[13px] font-medium truncate"
                        style={{ color: "rgb(var(--color-text-primary))" }}
                      >
                        {cat.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Section "Aperçu" retirée — l'UI est suffisamment claire
          sans : titre + couleur déjà visibles, durée affichée
          ailleurs si besoin. */}
    </div>
  );
};

export default EventModalDesktopCategoryPicker;
