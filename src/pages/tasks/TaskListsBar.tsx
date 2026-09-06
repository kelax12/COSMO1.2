// Barre d'accès rapide aux listes de TasksPage (chips + drag-reorder + édition
// inline + smart lists + sélection de tâches) — extraite verbatim, prop-driven.
import React from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Sparkles, Pin, PinOff, Share2 } from 'lucide-react';
import SmartListMenu from '@/components/SmartListMenu';
import CreateListForm from './CreateListForm';
import { useCreateList, useDeleteList, type SmartRulePreset, type TaskList } from '@/modules/lists';
import { VIRTUAL_TODAY_ID } from './task-page-filter';
import { useT } from '@/i18n/useT';

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
}) => {
  const { t, tp } = useT('tasks');

  // Une seule création, deux emplacements (desktop inline, mobile empilé) :
  // les deux formulaires partagent ces gestes plutôt que d'en recopier un.
  const submitNewList = () => {
    createListMutation.mutate({ name: newListName.trim(), color: newListColor }, {
      onSuccess: () => {
        setNewListName('');
        setNewListColor('blue');
        setShowCreateList(false);
      },
    });
  };
  const cancelNewList = () => { setShowCreateList(false); setNewListName(''); };

  return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-2 sm:mb-8"
                  data-tutorial-id="tasks-lists"
                >
                  <div className="mb-2 sm:mb-4">
                    <div className="flex items-center justify-between mb-1 sm:mb-4">
                      <h2 className="text-label sm:text-sm font-semibold text-slate-700 dark:text-slate-300">{t('lists.sectionTitle')}</h2>
                      {!showCreateList && (
                        <button
                          onClick={() => setShowCreateList(true)}
                          aria-label={t('lists.newList')}
                          className="sm:hidden flex items-center justify-center min-w-touch min-h-touch rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/40 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      )}
                    </div>

                    {/* `pt-8` sur desktop réserve l'espace du survol (boutons
                        +/corbeille de la chip « Aujourd'hui », en -top-8). Ce
                        survol n'existe pas au tactile → `pt-2` sur mobile,
                        ~24px d'espace vide en moins. */}
                    <div className="flex sm:flex-wrap gap-3 pt-2 sm:pt-8 overflow-x-auto sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent)] sm:[mask-image:none]">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          clearListFilter();
                        }}
                        // Chip Spotify (docs/MOBILE.md § Chips de filtre) :
                        // pilule pleine, sans bordure — au repos comme active.
                        className={`shrink-0 whitespace-nowrap inline-flex items-center justify-center px-3.5 h-11 sm:h-auto sm:py-2 rounded-full text-label sm:text-sm font-medium transition-all ${
                          !selectedListId
                            ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                            : 'bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                        }`}
                      >
                        <span className="hidden sm:inline">{t('filters.allTasks')}</span>
                        <span className="sm:hidden">{t('filters.all')}</span>
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
                                title={t('lists.todayAddTitle')}
                                aria-label={t('lists.todayAddAria')}
                              >
                                <Plus size={15} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setTodayHidden(true); }}
                                className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm transition-colors"
                                title={t('lists.todayHideTitle')}
                                aria-label={t('lists.todayHideAria')}
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
                          // Chip Spotify : même pilule pleine sans bordure que
                          // les autres chips de filtre — l'ancien traitement
                          // vert dédié (bordure + fond teinté) est retiré,
                          // « Aujourd'hui » ne porte pas de pastille colorée
                          // (c'est une smart list, pas une liste), donc rien
                          // à conserver de l'exception « pastille avant le nom ».
                          className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 h-11 sm:h-auto sm:py-2 rounded-full text-label sm:text-sm font-medium transition-all ${
                            selectedListId === VIRTUAL_TODAY_ID
                              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                              : 'bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                          }`}
                          title={t('lists.todayChipTitle')}
                        >
                          <Sparkles size={13} />
                          <span>{t('filters.today')}</span>
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
                                    title={list.isDefault ? t('lists.defaultOnTitle') : t('lists.defaultOffTitle')}
                                    aria-label={list.isDefault ? t('lists.defaultOnAria') : t('lists.defaultOffAria')}
                                  >
                                    {list.isDefault ? <Pin size={15} fill="currentColor" /> : <PinOff size={15} />}
                                  </button>
                                  {/* Ajouter des tâches — désactivé pour les smart lists (auto-générées) */}
                                  {list.type !== 'smart' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startSelectingTasks(list.id); }}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                                      title={t('lists.addTasks')}
                                      aria-label={t('lists.addTasks')}
                                    >
                                      <Plus size={15} />
                                    </button>
                                  )}
                                  {/* Modifier — désactivé pour smart (la règle est fixe) */}
                                  {list.type !== 'smart' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startEditList(list); }}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                                      title={t('lists.edit')}
                                      aria-label={t('lists.edit')}
                                    >
                                      <Pencil size={15} />
                                    </button>
                                  )}
                                  {/* Partager — listes manuelles uniquement (les smart sont des filtres) */}
                                  {list.type !== 'smart' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onShareList(list); }}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 shadow-sm transition-colors"
                                      title={t('lists.share')}
                                      aria-label={t('lists.share')}
                                    >
                                      <Share2 size={15} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setListToDeleteId(list.id); }}
                                    className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-[rgb(var(--color-border))] text-slate-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-colors"
                                    title={t('lists.delete')}
                                    aria-label={t('lists.delete')}
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
                                  title={t('lists.colorCycleTitle')}
                                />
                                <input
                                  type="color"
                                  value={resolveListColor(editListColor)}
                                  onChange={(e) => setEditListColor(e.target.value)}
                                  className="sr-only"
                                  aria-label={t('lists.customColorAria')}
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
                                  className="px-2 py-1 text-xs rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all"
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
                                // Chip Spotify : pilule pleine sans bordure.
                                // La pastille de couleur de la liste (juste
                                // en dessous) reste — seule exception au
                                // remplacement, demandée explicitement.
                                className={`flex items-center gap-2 px-3.5 h-11 sm:h-auto sm:py-2 rounded-full text-label sm:text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                                    : 'bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
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
                              title={t('lists.manualListTitle')}
                            >
                              <Plus size={16} /> {t('lists.chipLabel')}
                            </motion.button>
                          ) : (
                            <CreateListForm
                              key="add-form"
                              variant="inline"
                              name={newListName}
                              onNameChange={setNewListName}
                              color={newListColor}
                              onColorChange={setNewListColor}
                              colorOptions={colorOptions}
                              resolveColor={resolveListColor}
                              onSubmit={submitNewList}
                              onCancel={cancelNewList}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Formulaire nouvelle liste — mobile (déclenché par l'icône + dans l'en-tête) */}
                    <div className="sm:hidden mt-2">
                      <AnimatePresence mode="wait">
                        {showCreateList && (
                          <CreateListForm
                            key="add-form-mobile"
                            variant="stacked"
                            name={newListName}
                            onNameChange={setNewListName}
                            color={newListColor}
                            onColorChange={setNewListColor}
                            colorOptions={colorOptions}
                            resolveColor={resolveListColor}
                            onSubmit={submitNewList}
                            onCancel={cancelNewList}
                          />
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
                                ? t('lists.selectPromptToday')
                                : t('lists.selectPromptList', { list: lists.find(l => l.id === selectingTasksForListId)?.name ?? '' })
                              : tp('lists.selected', selectedTasksForList.length)}
                          </span>
                          <button
                            onClick={confirmAddTasksToList}
                            disabled={selectedTasksForList.length === 0}
                            className="px-5 py-2.5 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-semibold disabled:opacity-40 transition-all"
                          >
                            {t('lists.validate')}
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
};

export default TaskListsBar;
