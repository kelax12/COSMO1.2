import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Sun } from 'lucide-react';
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
 * Menu déroulant des filtres dynamiques. Rendu via React Portal vers
 * document.body pour échapper aux overflow:hidden des parents (la barre
 * de chips a overflow-x-auto qui clippait le popover avant ce refactor).
 *
 * Disposition reprise de la version test : en-tête + ligne « Aujourd'hui »
 * (toggle show/hide) + presets smart (✓ quand actif). La révocation d'une
 * smart list et l'épinglage par défaut restent accessibles via les actions
 * au survol de chaque chip (TaskListsBar).
 */
const SmartListMenu: React.FC<SmartListMenuProps> = ({
  existingSmartLists,
  onSelect,
  todayHidden = false,
  onToggleToday,
  todayCount = 0,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

  // Mesure la position viewport du trigger → place le popover en position:fixed.
  // Re-mesure au resize / scroll pour suivre les changements de layout.
  useLayoutEffect(() => {
    if (!open) { setPopoverPos(null); return; }
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPopoverPos({
        top: r.bottom + 8,
        right: window.innerWidth - r.right,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Ferme au clic en dehors (du trigger ET du popover)
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideTrigger = triggerRef.current?.contains(t);
      const insidePopover = popoverRef.current?.contains(t);
      if (!insideTrigger && !insidePopover) setOpen(false);
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

  // Contenu interne du popover — disposition épurée (version test)
  const popoverInner = (
    <>
      {/* En-tête */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-violet-50 dark:bg-violet-900/20">
        <span className="font-bold text-sm text-slate-900 dark:text-white">Listes intelligentes</span>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Le contenu se met à jour automatiquement.
        </p>
      </div>

      <ul className="py-1 max-h-80 overflow-y-auto">
        {/* "Aujourd'hui" — toggle show/hide */}
        {onToggleToday && (
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => { onToggleToday(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 focus-visible:outline-none"
            >
              <Sun size={15} className="shrink-0 text-emerald-500" aria-hidden />
              <span className="flex-1 font-medium text-sm text-slate-900 dark:text-white">
                {todayHidden ? "Afficher « Aujourd'hui »" : "Masquer « Aujourd'hui »"}
              </span>
              {!todayHidden && <span className="text-xs text-slate-400">({todayCount})</span>}
            </button>
          </li>
        )}

        {/* Smart presets */}
        {SMART_PRESETS.map(preset => {
          const isActive = smartByPreset.has(preset.preset);
          return (
            <li key={preset.preset}>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onSelect(preset.preset); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLOR_HEX[preset.color] || '#64748B' }}
                  aria-hidden
                />
                <span className="flex-1 font-medium text-sm text-slate-900 dark:text-white">
                  {preset.label}
                </span>
                {isActive && <Check size={15} className="shrink-0 text-emerald-500" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  // Popover en portal — échappe aux overflow:hidden parents (chips bar, sidebar…)
  const popoverContent = (
    <AnimatePresence>
      {open && popoverPos && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.12 }}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            right: popoverPos.right,
            zIndex: 9999,
          }}
          className="w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          role="menu"
        >
          {popoverInner}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex shrink-0 items-center gap-1.5 h-9 px-3 rounded-lg border-2 border-dashed border-violet-300 dark:border-violet-600 bg-transparent text-sm font-medium text-violet-500 dark:text-violet-400 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        title="Créer une liste intelligente"
        aria-label="Créer une liste intelligente"
        aria-expanded={open}
      >
        <Sparkles size={16} /> Smart
      </button>
      {typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  );
};

export default SmartListMenu;
