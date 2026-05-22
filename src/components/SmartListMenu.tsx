import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Pin, X as XIcon } from 'lucide-react';
import { SMART_PRESETS, type SmartRulePreset, type TaskList } from '@/modules/lists';

interface SmartListMenuProps {
  /** Presets déjà créés (affichés grisés / cochés) */
  existingPresets: SmartRulePreset[];
  /** Callback à l'activation d'un preset */
  onSelect: (preset: SmartRulePreset) => void;
  /** Liste actuellement épinglée par défaut, si elle existe */
  defaultList?: TaskList | null;
  /** Callback pour révoquer la liste par défaut (passe l'id au handler parent) */
  onRevokeDefault?: (list: TaskList) => void;
}

const COLOR_HEX: Record<string, string> = {
  red:    '#EF4444',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  orange: '#F97316',
  yellow: '#F59E0B',
};

/**
 * Petit menu qui regroupe les filtres dynamiques :
 *   - L'entrée "Liste par défaut" en tête (active par défaut quand une
 *     liste est épinglée — révocable en un clic ici)
 *   - Les 3 presets de listes intelligentes (En retard / Cette semaine /
 *     Priorité haute), opt-in : inactifs jusqu'à activation
 */
const SmartListMenu: React.FC<SmartListMenuProps> = ({
  existingPresets,
  onSelect,
  defaultList,
  onRevokeDefault,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ferme au clic en dehors
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const existingSet = new Set(existingPresets);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-lg border-2 border-dashed border-violet-300 dark:border-violet-600 text-violet-500 dark:text-violet-400 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        title="Créer une liste intelligente"
        aria-label="Créer une liste intelligente"
        aria-expanded={open}
      >
        <Sparkles size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            role="menu"
          >
            {/* Header — sans icône, titre seul + sous-titre */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/20">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Listes intelligentes</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Filtres dynamiques. Le contenu se met à jour automatiquement.
              </p>
            </div>

            <ul className="py-1 max-h-80 overflow-y-auto">
              {/* ───── Entrée "Liste par défaut" — active dès qu'une liste est épinglée.
                  Contrairement aux smart presets (opt-in), celle-ci est active par défaut
                  quand le seed pose une liste isDefault. Clic = révoque (unpin). ───── */}
              {defaultList && (
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onRevokeDefault?.(defaultList);
                      setOpen(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700 border-b border-slate-100 dark:border-slate-800"
                  >
                    <Pin
                      size={12}
                      fill="currentColor"
                      className="text-amber-500 mt-1.5 shrink-0"
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          Liste par défaut
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Check size={10} /> Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>« {defaultList.name} » s'ouvre automatiquement.</span>
                      </p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
                        <XIcon size={10} /> Cliquez pour révoquer
                      </p>
                    </div>
                  </button>
                </li>
              )}

              {/* ───── Smart presets ───── */}
              {SMART_PRESETS.map(preset => {
                const exists = existingSet.has(preset.preset);
                return (
                  <li key={preset.preset}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelect(preset.preset);
                        setOpen(false);
                      }}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left focus-visible:outline-none focus-visible:bg-slate-100 dark:focus-visible:bg-slate-700"
                    >
                      <div
                        className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: COLOR_HEX[preset.color] || '#64748B' }}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">
                            {preset.label}
                          </span>
                          {exists && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <Check size={10} /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartListMenu;
