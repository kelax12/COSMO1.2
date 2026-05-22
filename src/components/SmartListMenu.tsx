import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Pin, Trash2 } from 'lucide-react';
import { SMART_PRESETS, type SmartRulePreset, type TaskList } from '@/modules/lists';

interface SmartListMenuProps {
  /** Liste complète des listes smart existantes (pour pouvoir les supprimer par id) */
  existingSmartLists: TaskList[];
  /** Callback : active un preset (le crée s'il n'existe pas, le sélectionne sinon) */
  onSelect: (preset: SmartRulePreset) => void;
  /** Callback : révoque (supprime définitivement) une liste smart */
  onRevokeSmart: (list: TaskList) => void;
  /** Liste actuellement épinglée par défaut, si elle existe */
  defaultList?: TaskList | null;
  /** Callback : révoque le statut "liste par défaut" (unpin, ne supprime pas la liste) */
  onRevokeDefault?: (list: TaskList) => void;
  /** État courant de la chip "Aujourd'hui" : true = masquée, false = visible */
  todayHidden?: boolean;
  /** Callback : toggle de la visibilité de la chip "Aujourd'hui" */
  onToggleToday?: () => void;
  /** Compteur de tâches du jour (pour affichage dans la popup) */
  todayCount?: number;
}

const COLOR_HEX: Record<string, string> = {
  red:    '#EF4444',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  orange: '#F97316',
  yellow: '#F59E0B',
};

/**
 * Menu déroulant des filtres dynamiques :
 *   - "Liste par défaut" en tête, active par défaut quand une liste est
 *     épinglée. Révocable via la corbeille à droite (= unpin).
 *   - 3 presets de listes intelligentes (En retard / Cette semaine /
 *     Priorité haute) : opt-in, créés au clic. Quand actifs, une corbeille
 *     rouge à droite permet de les supprimer (= disparition de la chip
 *     correspondante sur la TasksPage).
 */
const SmartListMenu: React.FC<SmartListMenuProps> = ({
  existingSmartLists,
  onSelect,
  onRevokeSmart,
  defaultList,
  onRevokeDefault,
  todayHidden = false,
  onToggleToday,
  todayCount = 0,
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

  // Index des smart lists existantes par preset key pour lookup rapide
  const smartByPreset = new Map<SmartRulePreset, TaskList>();
  for (const list of existingSmartLists) {
    if (list.smartRule) smartByPreset.set(list.smartRule, list);
  }

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
            className="absolute right-0 top-full mt-2 z-50 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            role="menu"
          >
            {/* Header — titre seul, pas d'icône */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/20">
              <span className="font-bold text-sm text-slate-900 dark:text-white">Listes intelligentes</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Filtres dynamiques. Le contenu se met à jour automatiquement.
              </p>
            </div>

            <ul className="py-1 max-h-80 overflow-y-auto">
              {/* ───── Entrée "Aujourd'hui" — chip virtuelle, visible par défaut.
                  Toggle show/hide : si visible (todayHidden=false), corbeille rouge
                  pour masquer ; si masquée, clic sur la ligne pour la ré-afficher. ───── */}
              {onToggleToday && (
                <li>
                  <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800">
                    {/* Zone cliquable : si masquée, click = ré-afficher.
                        Si visible, click ne fait rien (la corbeille gère le masquage). */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (todayHidden) {
                          onToggleToday();
                          setOpen(false);
                        }
                      }}
                      disabled={!todayHidden}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left focus-visible:outline-none disabled:cursor-default"
                    >
                      <div
                        className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: '#10B981' }}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">
                            Aujourd'hui
                          </span>
                          {!todayHidden ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <Check size={10} /> Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Masquée
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Tâches dont l'échéance est aujourd'hui ({todayCount}).
                          {todayHidden && <span className="ml-1 text-emerald-600 dark:text-emerald-400">Cliquez pour ré-afficher.</span>}
                        </p>
                      </div>
                    </button>
                    {/* Corbeille — visible uniquement quand la chip est active.
                        Cliquer = masquer la chip Aujourd'hui (réversible via cette même popup). */}
                    {!todayHidden && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleToday();
                          setOpen(false);
                        }}
                        className="shrink-0 mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        title="Masquer la chip Aujourd'hui"
                        aria-label="Masquer la chip Aujourd'hui"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              )}

              {/* ───── Entrée "Liste par défaut" — active par défaut quand une
                  liste est épinglée. La corbeille révoque le statut (unpin),
                  elle ne supprime PAS la liste elle-même. ───── */}
              {defaultList && (
                <li>
                  <div className="flex items-start gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        « {defaultList.name} » s'ouvre automatiquement.
                      </p>
                    </div>
                    {/* Corbeille rouge — révoque le statut isDefault (la liste reste) */}
                    <button
                      type="button"
                      onClick={() => {
                        onRevokeDefault?.(defaultList);
                        setOpen(false);
                      }}
                      className="shrink-0 mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      title="Désépingler — la liste reste mais ne s'ouvrira plus automatiquement"
                      aria-label="Désépingler la liste par défaut"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              )}

              {/* ───── Smart presets (toujours listés, qu'ils soient actifs ou non) ───── */}
              {SMART_PRESETS.map(preset => {
                const existing = smartByPreset.get(preset.preset);
                const isActive = !!existing;
                return (
                  <li key={preset.preset}>
                    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {/* Zone cliquable principale (création/activation si pas encore active) */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSelect(preset.preset);
                          setOpen(false);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left focus-visible:outline-none"
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
                            {isActive && (
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

                      {/* Corbeille rouge — visible uniquement si Active.
                          Révoque = supprime la liste smart → disparaît des chips TasksPage. */}
                      {isActive && existing && (
                        <button
                          type="button"
                          onClick={() => {
                            onRevokeSmart(existing);
                            setOpen(false);
                          }}
                          className="shrink-0 mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          title={`Révoquer "${preset.label}" — la chip disparaît des listes`}
                          aria-label={`Révoquer la liste intelligente ${preset.label}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
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
