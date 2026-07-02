// ═══════════════════════════════════════════════════════════════════
// TaskModalMobileBody — corps full-screen iOS de TaskModal sur mobile
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de TaskModal.tsx (god component 2350 lignes). Découplé du parent
// via l'interface explicite `MobileBodyProps` : il ne lit aucun état du
// parent par closure, tout passe par les props → déplacement sûr.

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bookmark, Check, Loader2, Minus, Plus, Search, UserPlus, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useCreateCategory } from '@/modules/categories';
import { useOkrs } from '@/modules/okrs';
import AddToListModal from '../AddToListModal';
import ShareLinkField from '@/components/ShareLinkField';
import { SectionTitle, SectionCard, CellSeparator, Cell } from './primitives';
import SubtaskChecklist from './SubtaskChecklist';
import { PRIORITY_OPTIONS, priorityColor } from './constants';

export interface MobileBodyProps {
  formData: {
    name: string; priority: number; category: string;
    deadline: string; estimatedTime: number | string;
    completed: boolean; bookmarked: boolean; isFromOKR: boolean;
    krId: string;
  };
  handleInputChange: (field: string, value: string | number | boolean) => void;
  categories: Array<{ id: string; name: string; color: string }>;
  lists: Array<{ id: string; name: string; color: string; taskIds: string[]; type?: string; smartRule?: string; isDefault?: boolean; position?: number }>;
  selectedListIds: string[];
  listColorOptions: { value: string; color: string }[];
  collaborators: string[];
  pendingInvitesLocal: string[];
  emailInput: string;
  setEmailInput: React.Dispatch<React.SetStateAction<string>>;
  inputError: string | null;
  friends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  filteredFriends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  sentRequests: Array<{ id: string; email: string }>;
  collabIdOf: (f: { id: string; userId?: string }) => string;
  displayInfo: (id: string) => { name: string; email?: string; avatar?: string; isPending: boolean };
  handleAddEmail: () => void;
  handleRemoveCollaborator: (id: string) => void;
  toggleCollaborator: (id: string) => void;
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  handleSave: () => void;
  handleClose: () => void;
  handleDelete: () => void;
  isCreating: boolean;
  isLoading: boolean;
  isFormValid: () => boolean;
  taskId?: string;
  autoOpenCollaborators?: boolean;
  /** L'utilisateur courant est-il propriétaire de la tâche ? (sinon vue
   *  destinataire en lecture seule pour les collaborateurs) */
  isTaskOwner: boolean;
  /** auth.uid du propriétaire (pour badge « Propriétaire »). */
  ownerId?: string;
  /** friend_ids des collaborateurs en attente d'acceptation (badge « Envoyé »). */
  pendingShareIds: Set<string>;
  /** Crée la tâche à la volée (création) pour générer le lien d'invitation. */
  onGenerateShareLink: () => Promise<string | null>;
}

const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange,
  categories, lists, selectedListIds, listColorOptions,
  collaborators, pendingInvitesLocal: _pendingInvitesLocal, emailInput, setEmailInput, inputError,
  friends: _friends, filteredFriends, sentRequests: _sentRequests, collabIdOf, displayInfo,
  handleAddEmail, handleRemoveCollaborator, toggleCollaborator,
  createCategoryMutation,
  handleSave, handleClose, handleDelete, isCreating, isLoading, isFormValid,
  taskId, autoOpenCollaborators, isTaskOwner, ownerId, pendingShareIds, onGenerateShareLink,
}) => {
  const [showPrioritySheet, setShowPrioritySheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showListsModal, setShowListsModal] = useState(false);
  const [showCollabSheet, setShowCollabSheet] = useState(false);
  // Ouvre directement la feuille Collaborateurs quand le modal est demandé
  // pour le partage (bouton « ajouter un collaborateur » d'une tâche).
  useEffect(() => {
    if (autoOpenCollaborators) setShowCollabSheet(true);
  }, [autoOpenCollaborators]);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [cellErrors, setCellErrors] = useState<Record<string, boolean>>({});
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [stepperDir, setStepperDir] = useState<1 | -1 | 0>(0);
  const { sheetRef, sheetDragProps } = useBottomSheet(handleClose);
  const { register, trigger, clear, isInvalid } = useInvalidShake();
  // OKRs actifs — sélecteur « Résultat clé » (#28), parité avec le desktop.
  const { data: okrs = [] } = useOkrs();
  const activeOkrs = okrs.filter(o => !o.completed && o.keyResults.length > 0);

  const isValid = isFormValid();

  const handleCreateOrSave = () => {
    const nameOk = formData.name.trim().length >= 1;
    // Priorité + catégorie facultatives : seul le nom bloque.
    setCellErrors({ name: !nameOk });
    if (nameOk) {
      handleSave();
      return;
    }
    trigger(['name']);
  };

  return (
    <motion.div ref={sheetRef} {...sheetDragProps} className="flex flex-col h-full w-full rounded-t-3xl bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm border-b border-gray-200/80 dark:border-gray-800" style={{ paddingTop: '10px' }}>
        <div className="flex justify-center pb-2">
          <div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
        </div>
        <div className="flex items-center justify-between px-4 h-11">
          <button type="button" onClick={handleClose} className="text-blue-500 text-[15px] min-w-[64px] text-left">
            Annuler
          </button>
          <span className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">
            {isCreating ? 'Nouvelle tâche' : 'Modifier'}
          </span>
          <button
            type="button"
            onClick={handleCreateOrSave}
            disabled={isLoading}
            className={`text-[15px] font-semibold min-w-[64px] text-right transition-colors ${isValid ? 'text-blue-500' : 'text-blue-300 dark:text-blue-700'}`}
          >
            {isLoading ? '…' : isCreating ? 'Créer' : 'OK'}
          </button>
        </div>
      </div>

      {/* ── Scroll area ── */}
      <div className="flex-1 overflow-y-auto" data-scroll-area>
        <div className="px-4 py-4 flex flex-col gap-0">

          {/* ── Groupe 1 : Nom ── */}
          <div
            ref={register('name')}
            className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm transition-[box-shadow] ${
              isInvalid('name') ? 'ring-2 ring-red-500' : ''
            }`}
          >
            <input
              type="text"
              value={formData.name}
              onChange={(e) => { handleInputChange('name', e.target.value); clear('name'); }}
              placeholder="Nom de la tâche"
              autoFocus={isCreating}
              className={`w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 ${
                cellErrors.name
                  ? 'text-red-500 placeholder-red-300'
                  : 'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600'
              }`}
            />
          </div>

          {/* ── Section DÉTAILS ── */}
          <SectionTitle>Détails</SectionTitle>
          <div ref={register('details')} className={`rounded-2xl transition-[box-shadow] ${isInvalid('details') ? 'ring-2 ring-red-500' : ''}`}>
          <SectionCard>
            {/* Priorité */}
            <Cell
              label={<span className={cellErrors.priority ? 'text-red-500' : ''}>Priorité</span>}
              value={
                formData.priority !== 0
                  ? <span className={priorityColor(formData.priority)}>P{formData.priority}</span>
                  : <span className="text-gray-400">Choisir</span>
              }
              onTap={() => setShowPrioritySheet(true)}
            />
            <CellSeparator />
            {/* Catégorie */}
            <Cell
              label={<span className={cellErrors.category ? 'text-red-500' : ''}>Catégorie</span>}
              value={(() => {
                const cat = categories.find(c => c.id === formData.category);
                if (!cat) return <span className="text-gray-400">Choisir</span>;
                return (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
                    <span className="text-blue-500">{cat.name}</span>
                  </span>
                );
              })()}
              onTap={() => setShowCategorySheet(true)}
            />
            <CellSeparator />
            {/* Échéance */}
            <Cell
              label="Échéance"
              value={
                formData.deadline
                  ? <span className="text-blue-500">{format(new Date(formData.deadline + 'T12:00:00'), 'd MMM', { locale: fr })}</span>
                  : <span className="text-gray-400">Aucune</span>
              }
              onTap={() => setShowDeadlinePicker(prev => !prev)}
            />
            <AnimatePresence>
              {showDeadlinePicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col">
                    <div className="overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={formData.deadline ? new Date(formData.deadline + 'T12:00:00') : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          handleInputChange('deadline', format(date, 'yyyy-MM-dd'));
                          setShowDeadlinePicker(false);
                        }}
                        locale={fr}
                        disabled={{ before: new Date() }}
                        initialFocus
                        className="w-full [--cell-size:2.25rem]"
                      />
                    </div>
                    {formData.deadline && (
                      <button
                        type="button"
                        onClick={() => { handleInputChange('deadline', ''); setShowDeadlinePicker(false); }}
                        className="w-full text-center text-[14px] text-red-500 py-3 border-t border-gray-100 dark:border-gray-800"
                      >
                        Effacer la date
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <CellSeparator />
            {/* Durée */}
            <div className="flex items-center justify-between px-4 min-h-11">
              <span className="text-[15px] text-gray-900 dark:text-gray-100">Durée</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = typeof formData.estimatedTime === 'number' ? formData.estimatedTime : 0;
                    handleInputChange('estimatedTime', Math.max(0, cur - 5));
                    setStepperDir(-1); setTimeout(() => setStepperDir(0), 80);
                  }}
                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
                  aria-label="Diminuer de 5 minutes"
                >
                  <Minus size={14} />
                </button>
                <motion.span
                  key={String(formData.estimatedTime)}
                  initial={{ y: stepperDir * -4, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.08 }}
                  className="text-[15px] text-blue-500 w-16 text-center"
                >
                  {formData.estimatedTime ? `${formData.estimatedTime} min` : '—'}
                </motion.span>
                <button
                  type="button"
                  onClick={() => {
                    const cur = typeof formData.estimatedTime === 'number' ? formData.estimatedTime : 0;
                    handleInputChange('estimatedTime', cur + 5);
                    setStepperDir(1); setTimeout(() => setStepperDir(0), 80);
                  }}
                  className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
                  aria-label="Augmenter de 5 minutes"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </SectionCard>
          </div>

          {/* ── Section ORGANISATION ── */}
          <SectionTitle>Organisation</SectionTitle>
          <SectionCard>
            {/* Listes */}
            <Cell
              label="Listes"
              value={(() => {
                const inLists = taskId ? lists.filter(l => l.taskIds.includes(taskId)) : lists.filter(l => selectedListIds.includes(l.id));
                if (inLists.length === 0) return <span className="text-gray-400">Aucune</span>;
                if (inLists.length === 1) return <span className="text-blue-500">{inLists[0].name}</span>;
                return <span className="text-blue-500">{inLists.length} listes</span>;
              })()}
              onTap={() => setShowListsModal(true)}
              showChevron={!!taskId}
            />
            {/* Résultat clé OKR (#28) — select natif iOS */}
            {activeOkrs.length > 0 && (
              <>
                <CellSeparator />
                <div className="flex items-center justify-between px-4 min-h-11 gap-3">
                  <span className="text-[15px] text-gray-900 dark:text-gray-100 shrink-0">Résultat clé</span>
                  <select
                    value={formData.krId}
                    onChange={(e) => handleInputChange('krId', e.target.value)}
                    aria-label="Contribue à un résultat clé"
                    className="flex-1 min-w-0 text-right text-[15px] bg-transparent text-blue-500 focus:outline-none truncate"
                  >
                    <option value="">Aucun</option>
                    {activeOkrs.map((okr) => (
                      <optgroup key={okr.id} label={okr.title}>
                        {okr.keyResults.map((kr) => (
                          <option key={kr.id} value={kr.id}>{kr.title}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </>
            )}
            <CellSeparator />
            {/* Favori — toggle iOS */}
            <div className="flex items-center justify-between px-4 min-h-11">
              <span className="flex items-center gap-2 text-[15px] text-gray-900 dark:text-gray-100">
                <Bookmark size={16} className="text-gray-500" />
                Favori
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={formData.bookmarked}
                aria-label={formData.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                onClick={() => handleInputChange('bookmarked', !formData.bookmarked)}
                className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  formData.bookmarked ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 700, damping: 35 }}
                  className="absolute top-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md"
                  style={{ left: formData.bookmarked ? 'calc(100% - 29px)' : '2px' }}
                />
              </button>
            </div>
          </SectionCard>

          {/* ── Section SOUS-TÂCHES (#12) — édition uniquement ── */}
          {!isCreating && taskId && (
            <>
              <SectionTitle>Sous-tâches</SectionTitle>
              <SectionCard>
                <div className="px-4 py-3">
                  <SubtaskChecklist taskId={taskId} hideLabel />
                </div>
              </SectionCard>
            </>
          )}

          {/* ── Section COLLABORATION ── */}
          <SectionTitle>Collaboration</SectionTitle>
          <SectionCard>
            <Cell
              label="Collaborateurs"
              value={
                collaborators.length > 0
                  ? <span className="text-blue-500">{collaborators.length}</span>
                  : <span className="text-gray-400">0</span>
              }
              onTap={() => setShowCollabSheet(true)}
            />
          </SectionCard>

          {/* ── Supprimer (édition uniquement) ── */}
          {!isCreating && (
            <>
              <div className="h-2" />
              <SectionCard>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center min-h-11 text-red-500 text-[15px] active:bg-gray-100 dark:active:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  Supprimer la tâche
                </button>
              </SectionCard>
            </>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* ── Footer CTA ── */}
      <div
        className="shrink-0 px-4 pt-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <button
          type="button"
          onClick={handleCreateOrSave}
          disabled={isLoading}
          className={`w-full h-[50px] rounded-2xl text-white text-[17px] font-semibold transition-colors ${
            isValid && !isLoading ? 'bg-blue-600 active:bg-blue-700' : 'bg-blue-200 dark:bg-blue-900/40'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              {isCreating ? 'Création…' : 'Sauvegarde…'}
            </span>
          ) : (
            isCreating ? 'Créer la tâche' : 'Sauvegarder'
          )}
        </button>
      </div>

      {/* ── Action sheet : Priorité ── */}
      <AnimatePresence>
        {showPrioritySheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => setShowPrioritySheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" /></div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2">Priorité</p>
              {PRIORITY_OPTIONS.map((opt, i) => (
                <React.Fragment key={opt.value}>
                  {i > 0 && <CellSeparator />}
                  <button
                    type="button"
                    onClick={() => { handleInputChange('priority', opt.value); setCellErrors(prev => ({ ...prev, priority: false })); setShowPrioritySheet(false); }}
                    className="w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <span className={`text-[15px] ${opt.color}`}>{opt.label}</span>
                    {formData.priority === opt.value && <Check size={16} className="text-blue-500" />}
                  </button>
                </React.Fragment>
              ))}
              <div className="h-3" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action sheet : Catégorie ── */}
      <AnimatePresence>
        {showCategorySheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => { setShowCategorySheet(false); setShowNewCatInput(false); }}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden max-h-[70vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0"><div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" /></div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2 shrink-0">Catégorie</p>
              <div className="flex-1 overflow-y-auto">
                {categories.map((cat, i) => (
                  <React.Fragment key={cat.id}>
                    {i > 0 && <CellSeparator />}
                    <button
                      type="button"
                      onClick={() => { handleInputChange('category', formData.category === cat.id ? '' : cat.id); setShowCategorySheet(false); }}
                      className="w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[15px] text-gray-900 dark:text-gray-100">{cat.name}</span>
                      </span>
                      {formData.category === cat.id && <Check size={16} className="text-blue-500" />}
                    </button>
                  </React.Fragment>
                ))}
                {categories.length > 0 && <CellSeparator />}
                {!showNewCatInput ? (
                  <button type="button" onClick={() => setShowNewCatInput(true)} className="w-full flex items-center gap-2 px-4 min-h-11 text-blue-500">
                    <Plus size={16} /><span className="text-[15px]">Créer une catégorie</span>
                  </button>
                ) : (
                  <div className="px-4 py-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { const idx = listColorOptions.findIndex(c => c.value === newCatColor); setNewCatColor(listColorOptions[(idx + 1) % listColorOptions.length].value); }}
                      className="w-6 h-6 rounded-full shrink-0"
                      style={{ backgroundColor: listColorOptions.find(c => c.value === newCatColor)?.color ?? '#3B82F6' }}
                    />
                    <input
                      autoFocus type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Nom de la catégorie…"
                      className="flex-1 text-[15px] bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                    />
                    <button
                      type="button"
                      disabled={newCatName.trim().length < 2 || createCategoryMutation.isPending}
                      onClick={() => {
                        const name = newCatName.trim();
                        if (name.length < 2) return;
                        createCategoryMutation.mutate(
                          { name, color: listColorOptions.find(c => c.value === newCatColor)?.color ?? '#3B82F6' },
                          { onSuccess: (created) => { handleInputChange('category', created.id); setCellErrors(prev => ({ ...prev, category: false })); setShowNewCatInput(false); setNewCatName(''); setNewCatColor('blue'); setShowCategorySheet(false); } }
                        );
                      }}
                      className="text-[15px] text-blue-500 font-semibold disabled:text-blue-300"
                    >
                      {createCategoryMutation.isPending ? '…' : 'Créer'}
                    </button>
                  </div>
                )}
              </div>
              <div className="h-3 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Listes (composant existant) ── */}
      {taskId && (
        <AddToListModal
          isOpen={showListsModal}
          onClose={() => setShowListsModal(false)}
          taskId={taskId}
        />
      )}

      {/* ── Action sheet : Collaborateurs ── */}
      <AnimatePresence>
        {showCollabSheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-end"
            onClick={() => setShowCollabSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden max-h-[80vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0"><div className="w-9 h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" /></div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-2 shrink-0">Collaborateurs</p>
              {!isTaskOwner && (
                <p className="px-4 pb-2 text-[13px] text-gray-500 dark:text-gray-400 shrink-0">
                  Cette tâche t'a été partagée. Seul le propriétaire peut gérer les collaborateurs.
                </p>
              )}
              {isTaskOwner && (
                <div className="px-4 pb-3 shrink-0">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text" value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                        placeholder="Email ou nom…"
                        className="w-full pl-9 pr-3 py-2 text-[15px] bg-gray-100 dark:bg-gray-800 rounded-xl focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
                      />
                    </div>
                    <button type="button" onClick={handleAddEmail} disabled={!emailInput.trim()} className="px-3 py-2 bg-blue-500 disabled:bg-blue-300 text-white rounded-xl">
                      <UserPlus size={16} />
                    </button>
                  </div>
                  {inputError && <p className="mt-1 text-[13px] text-red-500">{inputError}</p>}
                  {/* Lien d'invitation copiable (Supabase only) */}
                  <ShareLinkField taskId={taskId} ownerCanShare={isTaskOwner} onGenerate={onGenerateShareLink} className="pt-3" />
                </div>
              )}
              {collaborators.length > 0 && (
                <div className="px-4 pb-2 shrink-0 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 pb-1">{isTaskOwner ? `Sélectionnés (${collaborators.length})` : 'Participants'}</p>
                  {collaborators.map((id) => {
                    const info = displayInfo(id);
                    const isSent = isTaskOwner && !info.isPending && pendingShareIds.has(id);
                    return (
                      <div key={id} className="flex items-center justify-between py-1.5 gap-2">
                        <span className="text-[14px] text-gray-900 dark:text-gray-100 truncate flex-1">
                          {info.name}{!isTaskOwner && id === ownerId ? ' · Propriétaire' : ''}
                        </span>
                        {isSent && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Envoyé</span>
                        )}
                        {isTaskOwner && (
                          <button type="button" onClick={() => handleRemoveCollaborator(id)} className="p-1 text-red-400" aria-label="Retirer"><X size={14} /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isTaskOwner && (
                <div className="flex-1 overflow-y-auto px-4">
                  {filteredFriends.map((friend) => {
                    const cId = collabIdOf(friend);
                    const isSelected = collaborators.includes(cId);
                    return (
                      <button
                        key={friend.id} type="button" onClick={() => toggleCollaborator(cId)}
                        className="w-full flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <span className="text-[15px] text-gray-900 dark:text-gray-100">{friend.name}</span>
                        {isSelected ? <Check size={16} className="text-blue-500" /> : <Plus size={16} className="text-gray-400" />}
                      </button>
                    );
                  })}
                  {filteredFriends.length === 0 && (
                    <p className="text-center py-6 text-[14px] text-gray-400">Aucun ami à ajouter</p>
                  )}
                </div>
              )}
              <div className="h-3 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default TaskModalMobileBody;
