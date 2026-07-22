// Barre d'accès rapide aux listes de TasksPage (chips + drag-reorder + édition
// inline + smart lists + sélection de tâches) — extraite verbatim, prop-driven.
import React from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Sparkles, Pin, PinOff, Share2 } from 'lucide-react';
import SmartListMenu from '../../components/SmartListMenu';
import { useCreateList, useDeleteList, type SmartRulePreset, type TaskList } from '@/modules/lists';
import { VIRTUAL_TODAY_ID } from './task-page-filter';

interface ColorOption { value: string; color: string; name: string }

interface TaskListsBarProps {
  lists: TaskList[];
  orderedLists: TaskList[];
  tasksCountByListId: Map<string, number>;
  isMobile: boolean;
  colorOptions: ColorOption[];
  resolveListColor: (color: string) => string;
  chipLongPressFired: React.MutableRefObject<boolean>;
  selectedListId: string | null;
  setSelectedListId: React.Dispatch<React.SetStateAction<string | null>>;
  hoveredListId: string | null;
  setHoveredListId: React.Dispatch<React.SetStateAction<string | null>>;
  todayHidden: boolean;
  setTodayHidden: (hidden: boolean) => void;
  showCreateList: boolean;
  setShowCreateList: React.Dispatch<React.SetStateAction<boolean>>;
  newListName: string;
  setNewListName: React.Dispatch<React.SetStateAction<string>>;
  newListColor: string;
  setNewListColor: React.Dispatch<React.SetStateAction<string>>;
  editingListId: string | null;
  editListName: string;
  setEditListName: React.Dispatch<React.SetStateAction<string>>;
  editListColor: string;
  setEditListColor: React.Dispatch<React.SetStateAction<string>>;
  selectingTasksForListId: string | null;
  selectedTasksForList: string[];
  /** Déclenche la suppression (directe + toast « Annuler ») de la liste. */
  setListToDeleteId: (listId: string) => void;
  createListMutation: ReturnType<typeof useCreateList>;
  deleteListMutation: ReturnType<typeof useDeleteList>;
  clearListFilter: () => void;
  handleListSelect: (listId: string) => void;
  startSelectingTasks: (listId: string) => void;
  confirmAddTasksToList: () => void;
  cancelSelectingTasks: () => void;
  startEditList: (list: { id: string; name: string; color: string }) => void;
  cancelEditList: () => void;
  submitEditList: () => void;
  handleToggleDefault: (list: TaskList) => void;
  handleReorderLists: (newOrder: TaskList[]) => void;
  /** Persiste l'ordre courant côté backend — appelé une seule fois au drag-end. */
  commitReorderLists: () => void;
  handleCreateSmartList: (presetKey: SmartRulePreset) => void;
  startChipLongPress: (listId: string) => void;
  cancelChipLongPress: () => void;
  /** Ouvre le partage de la liste (bottom-sheet ShareListSheet). */
  onShareList: (list: TaskList) => void;
}

const TaskListsBar: React.FC<TaskListsBarProps> = ({
  lists, orderedLists, tasksCountByListId, isMobile, colorOptions, resolveListColor,
  chipLongPressFired,
  selectedListId, setSelectedListId, hoveredListId, setHoveredListId,
  todayHidden, setTodayHidden,
  showCreateList, setShowCreateList, newListName, setNewListName, newListColor, setNewListColor,
  editingListId, editListName, setEditListName, editListColor, setEditListColor,
  selectingTasksForListId, selectedTasksForList, setListToDeleteId,
  createListMutation, deleteListMutation,
  clearListFilter, handleListSelect, startSelectingTasks, confirmAddTasksToList, cancelSelectingTasks,
  startEditList, cancelEditList, submitEditList, handleToggleDefault, handleReorderLists, commitReorderLists,
  handleCreateSmartList, startChipLongPress, cancelChipLongPress,
  onShareList,
}) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-4 sm:mb-8"
                  data-tutorial-id="tasks-lists"
                >
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-label sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Accès rapide aux listes</h3>
                      {!showCreateList && (
                        <button
                          onClick={() => setShowCreateList(true)}
                          aria-label="Nouvelle liste"
                          className="sm:hidden flex items-center justify-center min-w-touch min-h-touch rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/40 transition-colors"
                        >
                          <Plus size={20} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>

                    <div className="flex sm:flex-wrap gap-3 pt-8 overflow-x-auto sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent)] sm:[mask-image:none]">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          clearListFilter();
                        }}
                        // `min-h-touch` sous 640px : les chips faisaient 38px de
                        // haut, sous la cible tactile de 44px (WCAG 2.5.5).
                        className={`shrink-0 whitespace-nowrap inline-flex items-center justify-center px-4 min-h-touch sm:min-h-0 sm:py-2 rounded-lg text-label sm:text-sm font-medium transition-all shadow-sm border ${
                          !selectedListId
                            ? 'bg-[rgb(var(--color-accent-solid))] text-white border-[rgb(var(--color-accent-solid))] dark:bg-[rgb(var(--color-accent-solid))] dark:border-[rgb(var(--color-accent-solid))] shadow-md'
                            : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]'
                        }`}
                      >
                        <span className="hidden sm:inline">Toutes les tâches</span>
                        <span className="sm:hidden">Tout</span>
                      </motion.button>

                      {/* Chip virtuelle "Aujourd'hui" — visible par défaut, masquable.
                          Quand masquée (todayHidden === true), elle disparaît de l'accès
                          rapide. On peut la réactiver depuis la popup SmartListMenu.
                          Filtre dynamique : tâches dont deadline === today AND !completed.
                          Hover révèle 2 mini boutons : "+" pour ajouter des tâches,
                          "🗑️" pour masquer la chip. */}
                      {!todayHidden && (
                      <div
                        className="relative shrink-0"
                        onMouseEnter={() => setHoveredListId(VIRTUAL_TODAY_ID)}
                        onMouseLeave={() => setHoveredListId(null)}
                      >
                        <AnimatePresence>
                          {(hoveredListId === VIRTUAL_TODAY_ID || selectedListId === VIRTUAL_TODAY_ID) && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute -top-8 inset-x-0 flex justify-center gap-2.5 z-10"
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); startSelectingTasks(VIRTUAL_TODAY_ID); }}
                                className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-600 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shadow-sm transition-colors"
                                title="Ajouter des tâches à aujourd'hui (pose leur échéance à aujourd'hui)"
                                aria-label="Ajouter des tâches à aujourd'hui"
                              >
                                <Plus size={15} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setTodayHidden(true); }}
                                className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-colors"
                                title="Masquer la chip Aujourd'hui (réactivable depuis ✨)"
                                aria-label="Masquer la chip Aujourd'hui"
                              >
                                <Trash2 size={15} />
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedListId(selectedListId === VIRTUAL_TODAY_ID ? null : VIRTUAL_TODAY_ID)}
                          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-4 min-h-touch sm:min-h-0 sm:py-2 rounded-lg text-label sm:text-sm font-medium transition-all shadow-sm border ${
                            selectedListId === VIRTUAL_TODAY_ID
                              ? 'bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-500 shadow-md'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:border-emerald-800'
                          }`}
                          title="Tâches dont l'échéance est aujourd'hui"
                        >
                          <Sparkles size={13} />
                          <span>Aujourd'hui</span>
                          <span className="text-caption sm:text-xs opacity-70 ml-0.5">{tasksCountByListId.get(VIRTUAL_TODAY_ID) ?? 0}</span>
                        </motion.button>
                      </div>
                      )}

                      {/* Drag-to-reorder : Reorder.Group rend un div inline (className="contents")
                          pour ne pas casser la layout flex parente.
                          IMPORTANT : on passe `orderedLists` (state local) au lieu de `lists`
                          (React Query). Sans ça, après onReorder() Reorder voit toujours
                          l'ancien ordre et l'item snap-back à sa position d'origine. */}
                      <Reorder.Group
                        as="div"
                        axis="x"
                        values={orderedLists}
                        onReorder={handleReorderLists}
                        className="contents"
                      >
                      {orderedLists.map((list) => {
                        const isSelected = selectedListId === list.id;
                        const isEditing = editingListId === list.id;
                        const isHovered = hoveredListId === list.id;
                        // Boutons flottants = desktop uniquement (hover). Sur mobile,
                        // l'appui long ouvre ListActionsSheet (cibles ≥ 44 px).
                        const showActions = (isHovered || isSelected) && !isEditing && !isMobile;

                        return (
                          <Reorder.Item
                            as="div"
                            value={list}
                            key={list.id}
                            // Drag désactivé :
                            //   - pendant l'édition (sinon les inputs reçoivent les pointer events),
                            //   - sur mobile (la barre de chips a overflow-x-auto, donc swipe horizontal
                            //     = scroll attendu ; drag-to-reorder rentrerait en conflit avec le scroll).
                            // En usage desktop, framer-motion distingue click (mouvement < 4px) du drag.
                            drag={isEditing || isMobile ? false : 'x'}
                            onDragEnd={commitReorderLists}
                            whileDrag={{ scale: 1.05, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
                            className={`relative shrink-0 ${isMobile ? '' : 'cursor-grab active:cursor-grabbing'}`}
                            onMouseEnter={() => setHoveredListId(list.id)}
                            onMouseLeave={() => setHoveredListId(null)}
                          >
                            <AnimatePresence>
                              {showActions && (
                                <motion.div
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 4 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute -top-8 inset-x-0 flex justify-center gap-2.5 z-10"
                                >
                                  {/* Bouton "épingler par défaut" — seul un peut être actif */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleDefault(list); }}
                                    className={`p-2 rounded-lg border shadow-sm transition-colors ${
                                      list.isDefault
                                        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300'
                                        : 'bg-white dark:bg-slate-700 border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400'
                                    }`}
                                    title={list.isDefault ? 'Liste par défaut (cliquez pour désépingler)' : 'Définir comme liste par défaut'}
                                    aria-label={list.isDefault ? 'Liste par défaut' : 'Épingler comme liste par défaut'}
                                  >
                                    {list.isDefault ? <Pin size={15} fill="currentColor" /> : <PinOff size={15} />}
                                  </button>
                                  {/* Ajouter des tâches — désactivé pour les smart lists (auto-générées) */}
                                  {list.type !== 'smart' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startSelectingTasks(list.id); }}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                                      title="Ajouter des tâches"
                                      aria-label="Ajouter des tâches"
                                    >
                                      <Plus size={15} />
                                    </button>
                                  )}
                                  {/* Modifier — désactivé pour smart (la règle est fixe) */}
                                  {list.type !== 'smart' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startEditList(list); }}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                                      title="Modifier la liste"
                                      aria-label="Modifier la liste"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                  )}
                                  {/* Partager — listes manuelles uniquement (les smart sont des filtres) */}
                                  {list.type !== 'smart' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onShareList(list); }}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 shadow-sm transition-colors"
                                      title="Partager la liste"
                                      aria-label="Partager la liste"
                                    >
                                      <Share2 size={15} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setListToDeleteId(list.id); }}
                                    className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-colors"
                                    title="Supprimer la liste"
                                    aria-label="Supprimer la liste"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {isEditing ? (
                              <form
                                onSubmit={(e) => { e.preventDefault(); submitEditList(); }}
                                className="flex items-center gap-2"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    if (e.shiftKey) {
                                      e.currentTarget.nextElementSibling?.dispatchEvent(new MouseEvent('click'));
                                      return;
                                    }
                                    const idx = colorOptions.findIndex(c => c.value === editListColor);
                                    setEditListColor(colorOptions[(idx + 1) % colorOptions.length].value);
                                  }}
                                  className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                                  style={{ backgroundColor: resolveListColor(editListColor) }}
                                  title="Clic : cycle couleurs · Shift+clic : palette hex"
                                />
                                <input
                                  type="color"
                                  value={resolveListColor(editListColor)}
                                  onChange={(e) => setEditListColor(e.target.value)}
                                  className="sr-only"
                                  aria-label="Choisir une couleur personnalisée"
                                  tabIndex={-1}
                                />
                                <input
                                  autoFocus
                                  type="text"
                                  value={editListName}
                                  onChange={(e) => setEditListName(e.target.value)}
                                  /* size adapte la largeur au contenu (en caractères) :
                                     +2 pour un peu de marge, min 6 pour les noms courts.
                                     field-sizing:content (Chrome 123+) fait la même chose
                                     nativement sans JS ; size sert de fallback universel. */
                                  size={Math.max(editListName.length + 2, 6)}
                                  className="px-2 py-1 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                                  style={{
                                    backgroundColor: 'rgb(var(--color-surface))',
                                    borderColor: 'rgb(var(--color-border))',
                                    color: 'rgb(var(--color-text-primary))',
                                    fieldSizing: 'content',
                                  } as React.CSSProperties}
                                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEditList(); }}
                                />
                                <button
                                  type="submit"
                                  disabled={!editListName.trim()}
                                  className="px-2 py-1 text-xs rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-white font-medium disabled:opacity-40 transition-all"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditList}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </form>
                            ) : (
                              <button
                                onClick={() => {
                                  // Si un appui long vient d'ouvrir le menu d'actions,
                                  // on n'enchaîne pas sur la sélection de la liste.
                                  if (chipLongPressFired.current) { chipLongPressFired.current = false; return; }
                                  handleListSelect(list.id);
                                }}
                                onPointerDown={() => startChipLongPress(list.id)}
                                onPointerUp={cancelChipLongPress}
                                onPointerCancel={cancelChipLongPress}
                                onPointerLeave={cancelChipLongPress}
                                onContextMenu={(e) => { if (isMobile) e.preventDefault(); }}
                                className={`flex items-center gap-2 px-4 min-h-touch sm:min-h-0 sm:py-2 rounded-lg text-label sm:text-sm font-medium transition-all border shadow-sm ${
                                  isSelected
                                    ? 'bg-[rgb(var(--color-accent-solid))] text-white border-[rgb(var(--color-accent-solid))] dark:bg-[rgb(var(--color-accent-solid))] dark:border-[rgb(var(--color-accent-solid))] shadow-md'
                                    : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))]'
                                }`}
                              >
                                {/* Indicateur visuel : pastille couleur, ou icône Sparkles si smart */}
                                {list.type === 'smart' ? (
                                  <Sparkles size={13} style={{ color: isSelected ? 'currentColor' : resolveListColor(list.color) }} />
                                ) : (
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: resolveListColor(list.color) }} />
                                )}
                                <span>{list.name}</span>
                                {/* Icône Pin si liste par défaut */}
                                {list.isDefault && (
                                  <Pin
                                    size={11}
                                    fill="currentColor"
                                    className={isSelected ? 'opacity-80' : 'text-amber-500'}
                                  />
                                )}
                                <span className="text-caption sm:text-xs opacity-60 ml-1">
                                  {tasksCountByListId.get(list.id) ?? 0}
                                </span>
                                {isSelected && (
                                  <div className="text-white">
                                    <X size={14} className="ml-1 hover:text-red-200" />
                                  </div>
                                )}
                              </button>
                            )}
                          </Reorder.Item>
                        );
                      })}
                      </Reorder.Group>

                      {/* Bouton "ajouter une smart list" — toujours visible quand pas en édition.
                          Le menu affiche : (1) la chip "Aujourd'hui" (toggle show/hide),
                          (2) la liste épinglée par défaut (révocable = unpin),
                          (3) les smart presets (révocables = suppression définitive). */}
                      {!showCreateList && (
                        <SmartListMenu
                          existingSmartLists={lists.filter(l => l.type === 'smart')}
                          onSelect={handleCreateSmartList}
                          onRevokeSmart={(list) => {
                            // Désélectionne si on supprime la liste actuellement filtrée
                            if (selectedListId === list.id) setSelectedListId(null);
                            deleteListMutation.mutate(list.id);
                          }}
                          defaultList={lists.find(l => l.isDefault) ?? null}
                          onRevokeDefault={(list) => handleToggleDefault(list)}
                          todayHidden={todayHidden}
                          onToggleToday={() => setTodayHidden(!todayHidden)}
                          todayCount={tasksCountByListId.get(VIRTUAL_TODAY_ID) ?? 0}
                        />
                      )}

                      {/* Bouton + nouvelle liste — desktop uniquement inline dans le scroll */}
                      <div className="hidden sm:contents">
                        <AnimatePresence mode="wait">
                          {!showCreateList ? (
                            <motion.button
                              key="add-btn"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              onClick={() => setShowCreateList(true)}
                              className="inline-flex shrink-0 items-center gap-1.5 min-h-touch sm:min-h-0 sm:h-9 px-3 rounded-lg border-2 border-dashed border-[rgb(var(--color-border))] bg-transparent text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-[rgb(var(--color-border-strong))] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                              title="Nouvelle liste manuelle"
                            >
                              <Plus size={16} /> Liste
                            </motion.button>
                          ) : (
                            <motion.form
                              key="add-form"
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              exit={{ opacity: 0, width: 0 }}
                              className="flex items-center gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!newListName.trim()) return;
                                createListMutation.mutate({ name: newListName.trim(), color: newListColor }, {
                                  onSuccess: () => {
                                    setNewListName('');
                                    setNewListColor('blue');
                                    setShowCreateList(false);
                                  }
                                });
                              }}
                            >
                              {/* Pastille cyclique : click rapide passe à la couleur suivante.
                                  Long-press / Shift-click ouvre le color picker hex natif via le input HTML5. */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  // Shift+clic ou clic droit → ouvre le color picker natif
                                  if (e.shiftKey) {
                                    e.currentTarget.nextElementSibling?.dispatchEvent(new MouseEvent('click'));
                                    return;
                                  }
                                  const idx = colorOptions.findIndex(c => c.value === newListColor);
                                  setNewListColor(colorOptions[(idx + 1) % colorOptions.length].value);
                                }}
                                className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                                style={{ backgroundColor: resolveListColor(newListColor) }}
                                title="Clic : cycle couleurs · Shift+clic : palette hex"
                              />
                              {/* Color picker hex caché — déclenché par Shift+clic sur la pastille */}
                              <input
                                type="color"
                                value={resolveListColor(newListColor)}
                                onChange={(e) => setNewListColor(e.target.value)}
                                className="sr-only"
                                aria-label="Choisir une couleur personnalisée"
                                tabIndex={-1}
                              />
                              <input
                                autoFocus
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                placeholder="Nom de la liste…"
                                size={Math.max(newListName.length + 2, 14)}
                                className="px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                                style={{
                                  backgroundColor: 'rgb(var(--color-surface))',
                                  borderColor: 'rgb(var(--color-border))',
                                  color: 'rgb(var(--color-text-primary))',
                                  fieldSizing: 'content',
                                } as React.CSSProperties}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setShowCreateList(false); setNewListName(''); } }}
                              />
                              <button
                                type="submit"
                                disabled={!newListName.trim()}
                                className="px-3 py-1.5 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-white font-medium disabled:opacity-40 transition-all"
                              >
                                Créer
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowCreateList(false); setNewListName(''); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </motion.form>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Formulaire nouvelle liste — mobile (déclenché par l'icône + dans l'en-tête) */}
                    <div className="sm:hidden mt-2">
                      <AnimatePresence mode="wait">
                        {showCreateList && (
                          <motion.form
                            key="add-form-mobile"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!newListName.trim()) return;
                              createListMutation.mutate({ name: newListName.trim(), color: newListColor }, {
                                onSuccess: () => {
                                  setNewListName('');
                                  setNewListColor('blue');
                                  setShowCreateList(false);
                                }
                              });
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const idx = colorOptions.findIndex(c => c.value === newListColor);
                                setNewListColor(colorOptions[(idx + 1) % colorOptions.length].value);
                              }}
                              className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                              style={{ backgroundColor: colorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' }}
                              title="Changer la couleur"
                            />
                            <input
                              autoFocus
                              type="text"
                              value={newListName}
                              onChange={(e) => setNewListName(e.target.value)}
                              placeholder="Nom de la liste…"
                              className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                              style={{
                                backgroundColor: 'rgb(var(--color-surface))',
                                borderColor: 'rgb(var(--color-border))',
                                color: 'rgb(var(--color-text-primary))'
                              }}
                              onKeyDown={(e) => { if (e.key === 'Escape') { setShowCreateList(false); setNewListName(''); } }}
                            />
                            <button
                              type="submit"
                              disabled={!newListName.trim()}
                              className="px-3 py-2 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-white font-medium disabled:opacity-40 transition-all"
                            >
                              Créer
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCreateList(false); setNewListName(''); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {selectingTasksForListId && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="mt-3 flex items-center gap-3 px-6 py-5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-[rgb(var(--color-accent-solid))]"
                        >
                          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium flex-1">
                            {selectedTasksForList.length === 0
                              ? selectingTasksForListId === VIRTUAL_TODAY_ID
                                ? `Sélectionnez des tâches : leur échéance sera fixée à aujourd'hui`
                                : `Sélectionnez des tâches à ajouter dans "${lists.find(l => l.id === selectingTasksForListId)?.name}"`
                              : `${selectedTasksForList.length} tâche${selectedTasksForList.length > 1 ? 's' : ''} sélectionnée${selectedTasksForList.length > 1 ? 's' : ''}`}
                          </span>
                          <button
                            onClick={confirmAddTasksToList}
                            disabled={selectedTasksForList.length === 0}
                            className="px-5 py-2.5 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-white font-semibold disabled:opacity-40 transition-all"
                          >
                            Valider
                          </button>
                          <button
                            onClick={cancelSelectingTasks}
                            className="p-2 rounded text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          >
                            <X size={20} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </motion.div>
);

export default TaskListsBar;
