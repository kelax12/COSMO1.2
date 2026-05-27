import React, { useState, useEffect, useRef } from 'react';
import PremiumGateModal from './PremiumGateModal';
import { X, Users, AlertCircle, Bookmark, Trash2, Search, UserPlus, List, ChevronDown, ChevronRight, Plus, Minus, Loader2, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import CollaboratorItem from '@/components/CollaboratorItem';
import { DatePicker } from '@/components/ui/date-picker';
import ColorSettingsModal from './ColorSettingsModal';
import AddToListModal from './AddToListModal';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { 
  useCreateTask,
  useUpdateTask, 
  useDeleteTask, 
  Task,
  CreateTaskInput,
  UpdateTaskInput 
} from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories, useCreateCategory } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useAddTaskToList, useRemoveTaskFromList, useCreateList } from '@/modules/lists';

import { useFriends, useSendFriendRequest, useRejectFriendRequest, useShareTask, useSentFriendRequests } from '@/modules/friends';

// ═══════════════════════════════════════════════════════════════════
// BillingContext — vérification premium côté serveur
// ═══════════════════════════════════════════════════════════════════
import { useBilling } from '@/modules/billing/billing.context';

// ─── Mobile cell atoms ────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-4 pb-1 pt-5">
    {children}
  </p>
);

const SectionCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm ${className}`}>
    {children}
  </div>
);

const CellSeparator: React.FC = () => (
  <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />
);

interface CellProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  onTap?: () => void;
  showChevron?: boolean;
  className?: string;
}
const Cell: React.FC<CellProps> = ({ label, value, onTap, showChevron = true, className = '' }) => (
  <button
    type="button"
    onClick={onTap}
    disabled={!onTap}
    className={`w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800 transition-colors disabled:cursor-default ${className}`}
    style={{ WebkitTapHighlightColor: 'transparent' }}
  >
    <span className="text-[15px] text-gray-900 dark:text-gray-100">{label}</span>
    <span className="flex items-center gap-1.5 shrink-0 ml-2">
      {value && <span className="text-[15px]">{value}</span>}
      {showChevron && onTap && <ChevronRight size={16} className="text-gray-400 shrink-0" />}
    </span>
  </button>
);

const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 — Très haute', color: 'text-red-500' },
  { value: 2, label: 'P2 — Haute',      color: 'text-orange-500' },
  { value: 3, label: 'P3 — Moyenne',    color: 'text-blue-500' },
  { value: 4, label: 'P4 — Basse',      color: 'text-blue-500' },
  { value: 5, label: 'P5 — Très basse', color: 'text-gray-400' },
];
function priorityColor(p: number): string {
  return PRIORITY_OPTIONS.find(o => o.value === p)?.color ?? 'text-gray-400';
}

// ─── MobileBodyProps ──────────────────────────────────────────────────────────

interface MobileBodyProps {
  formData: {
    name: string; priority: number; category: string;
    deadline: string; estimatedTime: number | string;
    completed: boolean; bookmarked: boolean; isFromOKR: boolean;
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
  isPremium: () => boolean;
  setShowPremiumGate: React.Dispatch<React.SetStateAction<boolean>>;
  handleSave: () => void;
  handleClose: () => void;
  handleDelete: () => void;
  isCreating: boolean;
  isLoading: boolean;
  isFormValid: () => boolean;
  taskId?: string;
}

// ─── TaskModalMobileBody ──────────────────────────────────────────────────────

const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange,
  categories, lists, selectedListIds, listColorOptions,
  collaborators, pendingInvitesLocal: _pendingInvitesLocal, emailInput, setEmailInput, inputError,
  friends: _friends, filteredFriends, sentRequests: _sentRequests, collabIdOf, displayInfo,
  handleAddEmail, handleRemoveCollaborator, toggleCollaborator,
  createCategoryMutation,
  isPremium, setShowPremiumGate,
  handleSave, handleClose, handleDelete, isCreating, isLoading, isFormValid,
  taskId,
}) => {
  const [showPrioritySheet, setShowPrioritySheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showListsModal, setShowListsModal] = useState(false);
  const [showCollabSheet, setShowCollabSheet] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [cellErrors, setCellErrors] = useState<Record<string, boolean>>({});
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('blue');
  const [stepperDir, setStepperDir] = useState<1 | -1 | 0>(0);
  const { sheetRef, sheetDragProps } = useBottomSheet(handleClose);

  const isValid = isFormValid();

  const handleCreateOrSave = () => {
    const nameOk = formData.name.trim().length >= 1;
    const priorityOk = formData.priority !== 0;
    const categoryOk = !!formData.category;
    setCellErrors({ name: !nameOk, priority: !priorityOk, category: !categoryOk });
    if (nameOk && priorityOk && categoryOk) handleSave();
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
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

          {/* ── Section COLLABORATION ── */}
          <SectionTitle>Collaboration</SectionTitle>
          <SectionCard>
            {!isPremium() ? (
              <button
                type="button"
                onClick={() => setShowPremiumGate(true)}
                className="w-full flex items-center justify-between px-4 min-h-11 active:bg-gray-100 dark:active:bg-gray-800"
              >
                <span className="text-[15px] text-gray-900 dark:text-gray-100">Collaborateurs</span>
                <span className="text-[12px] font-semibold text-white bg-blue-500 rounded-full px-2 py-0.5">Premium</span>
              </button>
            ) : (
              <Cell
                label="Collaborateurs"
                value={
                  collaborators.length > 0
                    ? <span className="text-blue-500">{collaborators.length}</span>
                    : <span className="text-gray-400">0</span>
                }
                onTap={() => setShowCollabSheet(true)}
              />
            )}
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
                      onClick={() => { handleInputChange('category', cat.id); setCellErrors(prev => ({ ...prev, category: false })); setShowCategorySheet(false); }}
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
              </div>
              {collaborators.length > 0 && (
                <div className="px-4 pb-2 shrink-0 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 pb-1">Sélectionnés ({collaborators.length})</p>
                  {collaborators.map((id) => {
                    const info = displayInfo(id);
                    return (
                      <div key={id} className="flex items-center justify-between py-1.5">
                        <span className="text-[14px] text-gray-900 dark:text-gray-100 truncate flex-1">{info.name}</span>
                        <button type="button" onClick={() => handleRemoveCollaborator(id)} className="p-1 text-red-400" aria-label="Retirer"><X size={14} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <div className="h-3 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface TaskModalProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  isCreating?: boolean;
  showCollaborators?: boolean;
  initialData?: Partial<Task> & { isFromOKR?: boolean };
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose, isCreating = false, showCollaborators = false, initialData }) => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();

  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation = useCreateList();

  const { data: friends = [] } = useFriends();
  const { data: sentRequests = [] } = useSentFriendRequests();
  const shareTaskMutation = useShareTask();
  const sendFriendRequestMutation = useSendFriendRequest();
  const cancelFriendRequestMutation = useRejectFriendRequest();

  // Premium — vérification côté serveur
  const { isPremium } = useBilling();
  const [showPremiumGate, setShowPremiumGate] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    priority: 0,
    category: '',
    deadline: '',
    estimatedTime: 0,
    completed: false,
    bookmarked: false,
    isFromOKR: false
  });

  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [okrFields, setOkrFields] = useState<Record<string, boolean>>({});

  // Collaborator state (integrated from AddTaskForm)
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [pendingInvitesLocal, setPendingInvitesLocal] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showCollaboratorSection, setShowCollaboratorSection] = useState(showCollaborators);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { sheetRef: deleteSheetRef, handleBarWidth: deleteHandleBarWidth, sheetDragProps: deleteSheetDragProps } = useBottomSheet(() => setShowDeleteConfirm(false));
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [step, setStep] = useState(1);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');

  const listColorOptions = [
    { value: 'blue', color: '#3B82F6' },
    { value: 'red', color: '#EF4444' },
    { value: 'green', color: '#10B981' },
    { value: 'purple', color: '#8B5CF6' },
    { value: 'orange', color: '#F97316' },
    { value: 'yellow', color: '#F59E0B' },
    { value: 'pink', color: '#EC4899' },
    { value: 'indigo', color: '#6366F1' },
  ];

  const collaboratorRef = useRef<HTMLDivElement>(null);
  const autoPromoteDoneRef = useRef<Set<string>>(new Set());

  // Close collaborator section on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isToggleButton = target.closest('[data-collaborator-toggle="true"]');
      if (showCollaboratorSection && collaboratorRef.current && !collaboratorRef.current.contains(target) && !isToggleButton) {
        setShowCollaboratorSection(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCollaboratorSection]);

  // Reset to step 1 ONLY when the modal opens. Putting `setStep(1)` inside
  // the form-init effect (with `lists`/`task` in its deps) caused the modal
  // to bounce back to step 1 every time a mutation invalidated the React
  // Query cache — typically when sending a friend request from step 2.
  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);

  // Initialize form data when task changes
  useEffect(() => {
    if (!isOpen) return;

    if (isCreating) {
      setFormData({
        name: initialData?.name || '',
        priority: initialData?.priority || 0,
        category: initialData?.category || '',
        deadline: initialData?.deadline ? initialData.deadline.split('T')[0] : '',
        estimatedTime: initialData?.estimatedTime || 0,
        completed: initialData?.completed || false,
        bookmarked: initialData?.bookmarked || false,
        isFromOKR: initialData?.isFromOKR || false
      });
      
      if (initialData?.isFromOKR) {
        setOkrFields({
          name: !!initialData.name,
          category: !!initialData.category,
          estimatedTime: !!initialData.estimatedTime,
        });
      } else {
        setOkrFields({});
      }

        setCollaborators([]);
        setPendingInvitesLocal([]);
        setSelectedListIds([]);
      setHasChanges(false);
      setErrors({});
      setShowCollaboratorSection(showCollaborators);
    } else if (task) {
      setFormData({
        name: task.name || '',
        priority: task.priority || 3,
        category: task.category || '',
        deadline: task.deadline ? task.deadline.split('T')[0] : '',
        estimatedTime: task.estimatedTime || 30,
        completed: task.completed || false,
        bookmarked: task.bookmarked || false,
        isFromOKR: (task as Task & { isFromOKR?: boolean }).isFromOKR || false
      });
      
      const isFromOKR = (task as Task & { isFromOKR?: boolean }).isFromOKR || false;
      if (isFromOKR) {
        setOkrFields({
          name: true,
          category: true,
          estimatedTime: true,
        });
      } else {
        setOkrFields({});
      }

      setCollaborators(task.collaborators || []);
        setPendingInvitesLocal(task.pendingInvites || []);
        
        const taskLists = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);
      setSelectedListIds(taskLists);

      setHasChanges(false);
      setErrors({});
      setShowCollaboratorSection(showCollaborators || (task.collaborators && task.collaborators.length > 0) || false);
    }
    // Use `task?.id` and `lists.length` instead of full-object/full-array
    // references — those churn on every React Query refetch and would
    // wipe in-flight form edits. Also de-tied from `setStep` (see effect
    // above) so a friend-request mutation no longer kicks the user back
    // to step 1 mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, isCreating, showCollaborators, lists.length]);

  // Auto-promote pending invites that have since become friends
  useEffect(() => {
    if (!isOpen || !task || isCreating || !friends.length) return;
    const pending = task.pendingInvites ?? [];
    if (!pending.length) return;

    const toPromote = pending.filter(email => {
      const key = `${task.id}:${email}`;
      if (autoPromoteDoneRef.current.has(key)) return false;
      return friends.some(f => f.email.toLowerCase() === email.toLowerCase());
    });
    if (!toPromote.length) return;

    toPromote.forEach(email => autoPromoteDoneRef.current.add(`${task.id}:${email}`));

    const promotedNames: string[] = [];
    const extraCollaborators: string[] = [];
    toPromote.forEach(email => {
      const friend = friends.find(f => f.email.toLowerCase() === email.toLowerCase());
      if (!friend) return;
      if (!(task.collaborators ?? []).includes(friend.id)) {
        extraCollaborators.push(friend.id);
      }
      promotedNames.push(friend.name);
      if (isPremium()) {
        shareTaskMutation.mutate({
          taskId: task.id,
          friendId: friend.userId ?? friend.id,
          friendEmail: friend.email,
          role: 'editor'
        });
      }
    });

    const newPendingEmails = new Set(toPromote.map(e => e.toLowerCase()));
    const newPendingInvites = pending.filter(e => !newPendingEmails.has(e.toLowerCase()));

    updateTaskMutation.mutate({
      id: task.id,
      updates: {
        pendingInvites: newPendingInvites,
        collaborators: [...(task.collaborators ?? []), ...extraCollaborators],
      }
    });
    toast.success(`🎉 ${promotedNames.join(', ')} ${promotedNames.length > 1 ? 'ont rejoint' : 'a rejoint'} la tâche !`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, friends.length]);

  // Track changes
  useEffect(() => {
    if (!task) return;

    const hasFormChanges =
      formData.name !== task.name ||
      formData.priority !== task.priority ||
      formData.category !== task.category ||
      formData.deadline !== (task.deadline ? task.deadline.split('T')[0] : '') ||
      formData.estimatedTime !== task.estimatedTime ||
      formData.completed !== task.completed ||
      formData.bookmarked !== task.bookmarked ||
      JSON.stringify(collaborators) !== JSON.stringify(task.collaborators || []);

    setHasChanges(hasFormChanges);
  }, [formData, collaborators, task]);

  // Validation rules
  const computeValidationErrors = (): { [key: string]: string } => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom de la tâche est obligatoire';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Le nom doit contenir au moins 3 caractères';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Le nom ne peut pas dépasser 100 caractères';
    }

    if (formData.estimatedTime === '' || formData.estimatedTime === null) {
      newErrors.estimatedTime = 'Le temps estimé est obligatoire';
    } else if (isNaN(Number(formData.estimatedTime))) {
      newErrors.estimatedTime = 'Veuillez entrer un nombre valide';
    } else if (Number(formData.estimatedTime) < 0) {
      newErrors.estimatedTime = 'Le temps estimé ne peut pas être négatif';
    }

    if (formData.priority === 0) {
      newErrors.priority = 'Veuillez choisir une priorité';
    }

    if (!formData.category) {
      newErrors.category = 'Veuillez choisir une catégorie';
    }

    // Vérifie "deadline pas dans le passé" uniquement à la création OU
    // si l'utilisateur a explicitement modifié la deadline (sinon on bloque
    // l'édition de toute tâche dont la deadline est déjà passée).
    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const originalDeadline = task?.deadline ? task.deadline.split('T')[0] : '';
      const deadlineChanged = formData.deadline !== originalDeadline;

      if (deadlineDate < today && (isCreating || deadlineChanged)) {
        newErrors.deadline = 'La date limite ne peut pas être dans le passé';
      }
    }

    return newErrors;
  };

  const validateForm = () => {
    const newErrors = computeValidationErrors();
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    const nameValid = formData.name.length >= 1 && formData.name.length <= 100;
    const timeValid = formData.estimatedTime !== '' && formData.estimatedTime !== null && !isNaN(Number(formData.estimatedTime)) && Number(formData.estimatedTime) >= 0;
    const priorityValid = formData.priority !== 0;
    const categoryValid = !!formData.category;
    
    let deadlineValid = true;
    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineValid = deadlineDate >= today;
    }

    return nameValid && timeValid && priorityValid && categoryValid && deadlineValid;
  };

  const isStep1Valid = () => {
    const nameValid = formData.name.trim().length >= 1 && formData.name.trim().length <= 100;
    const priorityValid = formData.priority !== 0;
    const categoryValid = !!formData.category;
    let deadlineValid = true;
    if (formData.deadline) {
      const d = new Date(formData.deadline);
      const today = new Date(); today.setHours(0,0,0,0);
      deadlineValid = d >= today;
    }
    return nameValid && priorityValid && categoryValid && deadlineValid;
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    if (okrFields[field]) {
      setOkrFields(prev => ({ ...prev, [field]: false }));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    const validationErrors = computeValidationErrors();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      // Affiche le premier message d'erreur en toast — sinon l'utilisateur
      // peut ne pas voir l'erreur inline cachée plus haut dans le modal.
      toast.error(Object.values(validationErrors)[0]);
      return;
    }
    if (!isCreating && !task) return;

    if (isCreating) {
      // Use createTaskMutation for new tasks
      const createData: CreateTaskInput = {
        name: formData.name,
        priority: formData.priority,
        category: formData.category,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : new Date().toISOString(),
        estimatedTime: Number(formData.estimatedTime),
        completed: formData.completed,
        bookmarked: formData.bookmarked,
        isCollaborative: collaborators.length > 0,
        collaborators: collaborators,
        pendingInvites: pendingInvitesLocal,
      };

      createTaskMutation.mutate(createData, {
        onSuccess: () => {
          onClose();
        },
        onError: (err) => {
          console.error('Error creating task:', err);
          setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
        }
      });
    } else if (task) {
      const taskData: UpdateTaskInput = {
        name: formData.name,
        priority: formData.priority,
        category: formData.category,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : task.deadline,
        estimatedTime: Number(formData.estimatedTime),
        completed: formData.completed,
        bookmarked: formData.bookmarked,
        isCollaborative: collaborators.length > 0,
        collaborators: collaborators,
        pendingInvites: pendingInvitesLocal,
      };

      updateTaskMutation.mutate(
        { id: task.id, updates: taskData },
        {
          onSuccess: () => {
            // Sync lists
            const currentListIds = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);
            
            // Add to new lists
            selectedListIds.forEach(listId => {
              if (!currentListIds.includes(listId)) {
                addTaskToListMutation.mutate({ taskId: task.id, listId });
              }
            });
            
            // Remove from deselected lists
            currentListIds.forEach(listId => {
              if (!selectedListIds.includes(listId)) {
                removeTaskFromListMutation.mutate({ taskId: task.id, listId });
              }
            });

            if (isPremium()) {
              collaborators.forEach(userId => {
                if (!task.collaborators?.includes(userId)) {
                  // Find the friend's email so shareTask can resolve the
                  // canonical auth.uid via profiles, even when userId is
                  // actually a friends-table row id (no profile lookup yet).
                  const friend = friends.find(
                    f => (f.userId ?? f.id) === userId || f.id === userId
                  );
                  shareTaskMutation.mutate({
                    taskId: task.id,
                    friendId: userId,
                    friendEmail: friend?.email,
                    role: 'editor'
                  });
                }
              });
            }
            
            onClose();
          },
          onError: (err) => {
            console.error('Error saving task:', err);
            setErrors({ general: 'Erreur lors de la sauvegarde. Veuillez réessayer.' });
          }
        }
      );
    }
  };

  const handleDelete = () => {
    if (task) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (task) {
      deleteTaskMutation.mutate(task.id, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          onClose();
        },
        onError: (err) => {
          console.error('Error deleting task:', err);
          setErrors({ general: 'Erreur lors de la suppression. Veuillez réessayer.' });
          setShowDeleteConfirm(false);
        }
      });
    }
  };

  const handleClose = () => {
    onClose();
  };

  // A friend's canonical "collaborator id" is their auth.users.id (userId),
  // which is what Supabase RLS (auth.uid()::text = ANY(collaborators)) and
  // the shared_tasks.friend_id FK require. Falls back to friend.id in demo
  // mode where there's no auth.
  const collabIdOf = (f: { id: string; userId?: string }) => f.userId ?? f.id;
  const availableFriends = friends || [];
  const filteredFriends = availableFriends.filter((friend) =>
    !collaborators.includes(collabIdOf(friend)) && (
      emailInput === '' ||
      friend.name.toLowerCase().includes(emailInput.toLowerCase()) ||
      friend.email.toLowerCase().includes(emailInput.toLowerCase())
    )
  );

  const displayInfo = (id: string) => {
    const friend = friends?.find((f) => collabIdOf(f) === id || f.id === id || f.name === id);
    if (friend) {
      return { name: friend.name, email: friend.email, avatar: friend.avatar, isPending: false };
    }
    const isPending = pendingInvitesLocal.includes(id);
    if (emailRegex.test(id)) {
      return { name: id, email: id, avatar: undefined, isPending };
    }
    return { name: id, email: undefined, avatar: undefined, isPending };
  };

  const handleAddEmail = () => {
    const value = emailInput.trim().toLowerCase();
    if (!value) return;

    const friend = friends.find(f => f.email.toLowerCase() === value);

    if (friend) {
      // Store the friend's auth.uid (via userId) so RLS / shared_tasks FK
      // accept it. Falls back to friend.id in demo mode.
      const collabId = collabIdOf(friend);
      if (!collaborators.includes(collabId)) {
        setCollaborators([...collaborators, collabId]);
      }
    } else {
      // Reject input that doesn't look like an email — prevents garbage
      // entries in `pendingInvites`. Faille D2.
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) {
        setInputError('Utilisateur introuvable');
        return;
      }
      if (collaborators.includes(value)) {
        setEmailInput('');
        return;
      }
      sendFriendRequestMutation.mutate({ email: value });
      setCollaborators([...collaborators, value]);
      setPendingInvitesLocal([...pendingInvitesLocal, value]);
      // No immediate updateTaskMutation — deferred to handleSave() to avoid
      // cache invalidation that would set hasChanges=false.
    }
    setEmailInput('');
    setInputError(null);
  };

  const handleRemoveCollaborator = (collaboratorName: string) => {
    const newCollaborators = collaborators.filter((c) => c !== collaboratorName);
    setCollaborators(newCollaborators);
    const newPendingInvites = pendingInvitesLocal.filter(e => e !== collaboratorName);
    setPendingInvitesLocal(newPendingInvites);
    // NOTE: no immediate updateTaskMutation here — changes are batched into
    // handleSave() when the user clicks "Sauvegarder", which already includes
    // collaborators and pendingInvites in the payload. Calling the mutation
    // here would invalidate the React Query cache, cause the `task` prop to
    // update, set hasChanges=false, and disable the save button.
  };

  const toggleCollaborator = (collabId: string) => {
    // `collabId` is the friend's auth.users.id (or friend.id in demo).
    if (collaborators.includes(collabId)) {
      handleRemoveCollaborator(collabId);
    } else {
      // Defer to handleSave(), no immediate mutation.
      setCollaborators((prev) => [...prev, collabId]);
    }
  };

  // Loading state derived from mutations
  const isLoading = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  const isMobile = useIsMobile();

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        fullScreenMobile={true}
        className="p-0 border-0 bg-transparent shadow-none top-auto bottom-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[94vh] max-h-[94vh] sm:border sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl 3xl:max-w-[1120px] sm:h-auto sm:max-h-[calc(100vh-2rem)] lg:max-h-[85vh] overflow-visible sm:overflow-hidden flex flex-col"
      >
        <DialogTitle className="sr-only">
          {isCreating ? 'Créer une nouvelle tâche' : 'Modifier la tâche'}
        </DialogTitle>
        {isMobile ? (
          <TaskModalMobileBody
            formData={formData}
            handleInputChange={handleInputChange}
            categories={categories}
            lists={lists}
            selectedListIds={selectedListIds}
            listColorOptions={listColorOptions}
            collaborators={collaborators}
            pendingInvitesLocal={pendingInvitesLocal}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            inputError={inputError}
            friends={friends}
            filteredFriends={filteredFriends}
            sentRequests={sentRequests}
            collabIdOf={collabIdOf}
            displayInfo={displayInfo}
            handleAddEmail={handleAddEmail}
            handleRemoveCollaborator={handleRemoveCollaborator}
            toggleCollaborator={toggleCollaborator}
            createCategoryMutation={createCategoryMutation}
            isPremium={isPremium}
            setShowPremiumGate={setShowPremiumGate}
            handleSave={handleSave}
            handleClose={handleClose}
            handleDelete={handleDelete}
            isCreating={isCreating}
            isLoading={isLoading}
            isFormValid={isFormValid}
            taskId={task?.id}
          />
        ) : (
        <div
          className="flex flex-col h-full w-full rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'hsl(var(--card))' }}
        >
        <div
          className="sm:hidden flex justify-center pt-4 pb-2 shrink-0"
          style={{ backgroundColor: 'hsl(var(--card))' }}
        >
          <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
        </div>
        <div className="md:rounded-2xl md:shadow-2xl w-full transition-colors h-full min-h-inherit flex flex-col" style={{ backgroundColor: 'hsl(var(--card))' }}>
          {/* Header — sticky */}
          <div
            className="sticky top-0 z-10 flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b transition-colors gap-2"
            style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'hsl(var(--card))' }}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {isCreating ? 'Nouvelle tâche' : 'Modifier la tâche'}
              </h2>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
              {hasChanges &&
                <div className="hidden xs:flex items-center gap-1 text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-1 rounded-md shrink-0">
                  <AlertCircle size={12} aria-hidden="true" />
                  <span className="hidden sm:inline">Non sauvegardé</span>
                </div>
              }
            </div>
            <button
              onClick={handleClose}
              aria-label="Fermer le formulaire"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto h-[calc(100%-72px)] md:h-auto">
            {/* Error display */}
            {errors.general &&
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span className="font-medium">{errors.general}</span>
                </div>
              </div>
            }

              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

                {/* ── Step 1 : champs principaux ── */}
                {step === 1 && (
                <div className="space-y-5">

                  {/* Task Name */}
                  <div>
                    <label htmlFor="task-name" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      Nom de la tâche *
                    </label>
                    <input
                      id="task-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base ${
                        errors.name ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-700'
                      } ${okrFields.name ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                      style={{
                        backgroundColor: okrFields.name ? undefined : 'rgb(var(--color-surface))',
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: errors.name ? 'rgb(var(--error))' : (okrFields.name ? undefined : undefined)
                      }}
                      placeholder="Entrez le nom de la tâche"
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      aria-invalid={!!errors.name}
                    />

                    {errors.name &&
                      <div id="name-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.name}
                      </div>
                    }
                  </div>

                  {/* Priority and Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="task-priority" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Priorité
                        </label>
                        <div className="relative">
                          <select
                            id="task-priority"
                            value={formData.priority}
                            onChange={(e) => handleInputChange('priority', Number(e.target.value))}
                            className="w-full px-4 pr-12 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base border-slate-200 dark:border-slate-700 appearance-none cursor-pointer"
                            style={{
                              backgroundColor: 'rgb(var(--color-surface))',
                              color: formData.priority === 0 ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))',
                            }}
                            aria-label="Sélectionner la priorité de la tâche"
                          >
                            <option value="0" disabled hidden>Choisir une priorité</option>
                            <option value="1" style={{ color: 'rgb(var(--color-text-primary))' }}>1 (Très haute)</option>
                            <option value="2" style={{ color: 'rgb(var(--color-text-primary))' }}>2 (Haute)</option>
                            <option value="3" style={{ color: 'rgb(var(--color-text-primary))' }}>3 (Moyenne)</option>
                            <option value="4" style={{ color: 'rgb(var(--color-text-primary))' }}>4 (Basse)</option>
                            <option value="5" style={{ color: 'rgb(var(--color-text-primary))' }}>5 (Très basse)</option>
                          </select>
                          <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
                        </div>
                        {errors.priority &&
                          <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.priority}
                          </div>
                        }
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Catégorie
                      </label>
                      {/* Mobile : select natif système */}
                      <div className="sm:hidden relative">
                        <select
                          value={formData.category || ''}
                          onChange={(e) => handleInputChange('category', e.target.value)}
                          className="w-full h-12 px-4 pr-10 border rounded-lg appearance-none text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            color: formData.category ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
                            borderColor: errors.category ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))',
                          }}
                        >
                          <option value="">Choisir...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500" />
                      </div>
                      {/* Desktop : dropdown custom */}
                      <div className="hidden sm:block">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full flex items-center justify-between px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 data-[state=open]:border-blue-600 data-[state=open]:border-2 transition-all text-base ${
                                    errors.category ? 'border-red-500' : (okrFields.category ? 'border-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700')
                                  } ${okrFields.category ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                  style={{
                                  backgroundColor: okrFields.category ? undefined : 'rgb(var(--color-surface))',
                                  color: formData.category ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
                                  borderColor: errors.category ? 'rgb(var(--color-error))' : (okrFields.category ? undefined : undefined)
                                }}
                              >
                              <span>{categories.find(c => c.id === formData.category)?.name || (formData.category === 'okr' ? 'OKR' : 'Choisir...')}</span>
                              <ChevronDown size={18} className="text-blue-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="start" 
                            className="w-[var(--radix-dropdown-menu-trigger-width)] bg-[#f8fafc] dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 p-1 shadow-xl"
                          >
                              {formData.category === 'okr' && !categories.find(c => c.id === 'okr') && (
                            <DropdownMenuItem asChild>
                              <button
                                type="button"
                                onClick={() => handleInputChange('category', 'okr')}
                                className="w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 bg-blue-600 text-white shadow-sm"
                              >
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                OKR
                              </button>
                            </DropdownMenuItem>
                          )}
                          {categories.map((cat) => (
                            <DropdownMenuItem key={cat.id} asChild>
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleInputChange('category', cat.id)}
                                className={`w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 ${
                                  formData.category === cat.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600'
                                }`}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </button>
                            </DropdownMenuItem>
                          ))}
                          {categories.length > 0 && <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700 my-1" />}
                          <DropdownMenuItem asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                              onClick={() => { setShowNewCategoryInput(true); setNewCategoryName(''); }}
                            >
                              <Plus size={15} />
                              Créer une catégorie
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      </div>

                      {showNewCategoryInput && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = listColorOptions.findIndex(c => c.value === newCategoryColor);
                              setNewCategoryColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' }}
                            title="Changer la couleur"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = newCategoryName.trim();
                                if (name.length < 2) {
                                  toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                                  return;
                                }
                                createCategoryMutation.mutate(
                                  { name, color: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' },
                                  {
                                    onSuccess: (created) => {
                                      handleInputChange('category', created.id);
                                      setShowNewCategoryInput(false);
                                      setNewCategoryName('');
                                      setNewCategoryColor('blue');
                                    }
                                  }
                                );
                              } else if (e.key === 'Escape') {
                                setShowNewCategoryInput(false);
                                setNewCategoryName('');
                                setNewCategoryColor('blue');
                              }
                            }}
                            placeholder="Nom de la catégorie..."
                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                          />
                          <button
                            type="button"
                            disabled={newCategoryName.trim().length < 2 || createCategoryMutation.isPending}
                            onClick={() => {
                              const name = newCategoryName.trim();
                              if (name.length < 2) {
                                toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                                return;
                              }
                              createCategoryMutation.mutate(
                                { name, color: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' },
                                {
                                  onSuccess: (created) => {
                                    handleInputChange('category', created.id);
                                    setShowNewCategoryInput(false);
                                    setNewCategoryName('');
                                    setNewCategoryColor('blue');
                                  }
                                }
                              );
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                          >
                            {createCategoryMutation.isPending ? 'Création...' : 'Créer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); setNewCategoryColor('blue'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            style={{ color: 'rgb(var(--color-text-secondary))' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                        {errors.category &&
                          <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.category}
                          </div>
                        }
                      </div>
                  </div>

                  {/* Deadline and Estimated Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="task-deadline" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Échéance <span className="normal-case font-normal opacity-60">(Facultatif)</span>
                        </label>
                        <DatePicker
                          value={formData.deadline}
                          onChange={(date) => handleInputChange('deadline', date)}
                          placeholder="Sélectionner une date"
                          className={`h-12 w-full ${errors.deadline ? 'border-red-300 dark:border-red-600' : ''}`}
                        />

                        {errors.deadline &&
                          <div id="deadline-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.deadline}
                          </div>
                        }
                      </div>

                      <div>
                        <label htmlFor="task-time" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Temps estimé (min) <span className="normal-case font-normal opacity-60">(Facultatif)</span>
                        </label>
                          <div className="flex items-stretch gap-2">
                            <input
                              id="task-time"
                              type="number"
                              value={formData.estimatedTime === 0 ? '' : formData.estimatedTime}
                              onChange={(e) => handleInputChange('estimatedTime', e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Estimation en minute"
                              className={`flex-1 min-w-0 px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base ${
                                errors.estimatedTime ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-700'
                              } ${okrFields.estimatedTime ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                              style={{
                                backgroundColor: okrFields.estimatedTime ? undefined : 'rgb(var(--color-surface))',
                                color: 'rgb(var(--color-text-primary))',
                                borderColor: errors.estimatedTime ? 'rgb(var(--color-error))' : (okrFields.estimatedTime ? undefined : undefined)
                              }}
                              aria-describedby={errors.estimatedTime ? 'time-error' : undefined}
                              aria-invalid={!!errors.estimatedTime}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => {
                                  const cur = typeof prev.estimatedTime === 'number' ? prev.estimatedTime : 0;
                                  return { ...prev, estimatedTime: Math.max(0, cur - 5) };
                                });
                                if (errors.estimatedTime) setErrors((prev) => ({ ...prev, estimatedTime: '' }));
                              }}
                              className="w-12 h-12 flex items-center justify-center border rounded-lg hover:border-blue-500 transition-colors shrink-0"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' }}
                              aria-label="Diminuer le temps estimé de 5 minutes"
                            >
                              <Minus size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => {
                                  const cur = typeof prev.estimatedTime === 'number' ? prev.estimatedTime : 0;
                                  return { ...prev, estimatedTime: cur + 5 };
                                });
                                if (errors.estimatedTime) setErrors((prev) => ({ ...prev, estimatedTime: '' }));
                              }}
                              className="w-12 h-12 flex items-center justify-center border rounded-lg hover:border-blue-500 transition-colors shrink-0"
                              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' }}
                              aria-label="Augmenter le temps estimé de 5 minutes"
                            >
                              <Plus size={18} />
                            </button>
                          </div>

                      {errors.estimatedTime &&
                        <div id="time-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                          <AlertCircle size={14} aria-hidden="true" />
                          {errors.estimatedTime}
                        </div>
                      }
                    </div>
                  </div>

                  {/* Status toggles */}
                  <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
                      <button
                        type="button"
                        onClick={() => handleInputChange('bookmarked', !formData.bookmarked)}
                        aria-label={formData.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        className={`p-2.5 rounded-lg border transition-all ${
                          formData.bookmarked
                            ? 'bg-yellow-500/15 border-yellow-500/40'
                            : 'border-slate-200 dark:border-slate-700 hover:border-yellow-400/50 hover:bg-yellow-500/10'
                        }`}
                        style={!formData.bookmarked ? { backgroundColor: 'rgb(var(--color-hover))' } : {}}
                      >
                        <Bookmark
                          size={20}
                          className={formData.bookmarked ? 'text-yellow-500' : 'text-yellow-500/60'}
                          fill={formData.bookmarked ? 'currentColor' : 'none'}
                        />
                      </button>

                      {!isCreating && (
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isLoading}
                          aria-label="Supprimer la tâche"
                          className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400/60 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          style={{ backgroundColor: 'rgb(var(--color-hover))' }}
                        >
                          <Trash2 size={20} className="text-red-500" />
                        </button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium border-slate-200 dark:border-slate-700 hover:border-blue-400/50 hover:bg-blue-500/10"
                            style={{
                              backgroundColor: 'rgb(var(--color-hover))',
                              color: 'rgb(var(--color-text-primary))',
                            }}
                          >
                            <List size={16} className="text-blue-500" />
                            Ajouter à une liste
                            <ChevronDown size={14} className="text-blue-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-56 shadow-xl border"
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            borderColor: 'rgb(var(--color-border))',
                            color: 'rgb(var(--color-text-primary))',
                          }}
                        >
                          {lists.map(list => {
                            const listColorHex = listColorOptions.find(c => c.value === list.color)?.color || list.color || '#3B82F6';
                            return (
                            <DropdownMenuCheckboxItem
                              key={list.id}
                              checked={selectedListIds.includes(list.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedListIds([...selectedListIds, list.id]);
                                } else {
                                  setSelectedListIds(selectedListIds.filter(id => id !== list.id));
                                }
                                setHasChanges(true);
                              }}
                              className="focus:bg-blue-500/10"
                              style={{ color: 'rgb(var(--color-text-primary))' }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: listColorHex }} />
                                {list.name}
                              </div>
                            </DropdownMenuCheckboxItem>
                            );
                          })}
                          {lists.length > 0 && (
                            <DropdownMenuSeparator style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                          )}
                          <DropdownMenuItem asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                              onClick={() => { setShowNewListInput(true); setNewListName(''); }}
                            >
                              <Plus size={15} />
                              Créer une liste
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {showNewListInput && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = listColorOptions.findIndex(c => c.value === newListColor);
                              setNewListColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: listColorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' }}
                            title="Changer la couleur"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!newListName.trim()) return;
                                createListMutation.mutate(
                                  { name: newListName.trim(), color: newListColor },
                                  {
                                    onSuccess: (created) => {
                                      setSelectedListIds(prev => [...prev, created.id]);
                                      setHasChanges(true);
                                      setShowNewListInput(false);
                                      setNewListName('');
                                      setNewListColor('blue');
                                    }
                                  }
                                );
                              } else if (e.key === 'Escape') {
                                setShowNewListInput(false);
                                setNewListName('');
                                setNewListColor('blue');
                              }
                            }}
                            placeholder="Nom de la liste..."
                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                          />
                          <button
                            type="button"
                            disabled={!newListName.trim() || createListMutation.isPending}
                            onClick={() => {
                              if (!newListName.trim()) return;
                              createListMutation.mutate(
                                { name: newListName.trim(), color: newListColor },
                                {
                                  onSuccess: (created) => {
                                    setSelectedListIds(prev => [...prev, created.id]);
                                    setHasChanges(true);
                                    setShowNewListInput(false);
                                    setNewListName('');
                                    setNewListColor('blue');
                                  }
                                }
                              );
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                          >
                            {createListMutation.isPending ? 'Création...' : 'Créer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewListInput(false); setNewListName(''); setNewListColor('blue'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            style={{ color: 'rgb(var(--color-text-secondary))' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}



                      <div className="flex flex-wrap gap-2 items-center">
                                {selectedListIds.map(id => {
                                  const list = lists.find(l => l.id === id);
                                  if (!list) return null;
                                  return (
                                    <div 
                                      key={id} 
                                      className="flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20"
                                    >
                                      {list.name}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedListIds(selectedListIds.filter(lid => lid !== id));
                                          setHasChanges(true);
                                        }}
                                        className="text-blue-500 hover:text-blue-400 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                  </div>
                </div>
                )} {/* end step 1 */}

                {/* ── Step 2 : collaborateurs + aperçu ── */}
                {step === 2 && (
                <div className="space-y-5">

                    {/* Collaborators Section */}
                    <div>
                      <div className="flex items-center mb-3">
                        <label className="block text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Collaborateurs
                        </label>
                      </div>

                      <div ref={collaboratorRef}>
                        {!isPremium() ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                              <Users size={24} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-sm mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                              Fonctionnalité Premium requise
                            </p>
                            <Button type="button" size="sm" onClick={() => setShowPremiumGate(true)} className="bg-blue-600 hover:bg-blue-500 text-white border-0">
                              Débloquer Premium
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* Selected collaborators — affiché en premier */}
                            {collaborators.length > 0 && (
                              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Sélectionnés ({collaborators.length})
                                  </h4>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {collaborators.map((userId) => {
                                    const info = displayInfo(userId);
                                    return (
                                      <CollaboratorItem
                                        key={userId}
                                        id={userId}
                                        name={info.name}
                                        email={info.email}
                                        avatar={info.avatar}
                                        isPending={info.isPending}
                                        onAction={() => handleRemoveCollaborator(userId)}
                                        variant="remove"
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Input unique : filtre les amis ET permet d'ajouter par email/identifiant */}
                            <div className="mb-4">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                                  />
                                  <input
                                    type="text"
                                    value={emailInput}
                                    onChange={(e) => { setEmailInput(e.target.value); if (inputError) setInputError(null); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                                    placeholder="Email, nom ou identifiant..."
                                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-2 text-sm transition-colors ${inputError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:border-blue-600'}`}
                                    style={{
                                      backgroundColor: 'rgb(var(--color-surface))',
                                      color: 'rgb(var(--color-text-primary))',
                                    }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  onClick={handleAddEmail}
                                  disabled={!emailInput.trim()}
                                  className={emailInput.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'bg-blue-300 dark:bg-blue-900/50 text-white border-0 !opacity-100'}
                                >
                                  <UserPlus size={16} />
                                </Button>
                              </div>
                              {inputError && (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                  <span>⚠</span> {inputError}
                                </p>
                              )}
                            </div>

                            {/* Friends list — 2 columns */}
                            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                              {filteredFriends.map((friend) => {
                                const collabId = collabIdOf(friend);
                                return (
                                  <CollaboratorItem
                                    key={friend.id}
                                    id={collabId}
                                    name={friend.name}
                                    email={friend.email}
                                    avatar={friend.avatar}
                                    isSelected={collaborators.includes(collabId)}
                                    onAction={() => toggleCollaborator(collabId)}
                                    variant="toggle"
                                    compact
                                  />
                                );
                              })}
                              {filteredFriends.length === 0 && emailInput && (
                                <p className="col-span-2 text-center py-4 text-sm text-slate-500">Aucun contact trouvé</p>
                              )}
                            </div>

                            {/* Pending outgoing friend requests — selectable as future collaborators */}
                            {(() => {
                              const pendingContacts = sentRequests.filter(req =>
                                !collaborators.includes(req.email) &&
                                !pendingInvitesLocal.includes(req.email) &&
                                !friends.some(f => f.email.toLowerCase() === req.email.toLowerCase()) &&
                                (emailInput === '' || req.email.toLowerCase().includes(emailInput.toLowerCase()))
                              );
                              if (!pendingContacts.length) return null;
                              return (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                                    <Clock size={12} />
                                    Demandes d'amis en attente
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {pendingContacts.map(req => (
                                      <div
                                        key={req.id}
                                        className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 text-left"
                                      >
                                        <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                          <Clock size={12} className="text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">{req.email}</p>
                                          <p className="text-[10px] text-amber-600 dark:text-amber-400">En attente</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => cancelFriendRequestMutation.mutate(req.id, {
                                            onSuccess: () => toast.success(`Demande d'ami à ${req.email} annulée`),
                                          })}
                                          className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
                                          aria-label="Annuler la demande"
                                          title="Annuler la demande d'ami"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>

                </div>
                )} {/* end step 2 */}

                {/* ── Action Buttons ── */}
                <div
                  className="sticky bottom-0 -mx-6 px-4 sm:px-6 pt-3 pb-3 sm:pb-4 mt-6 border-t flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 sm:gap-3"
                  style={{
                    borderColor: 'rgb(var(--color-border))',
                    backgroundColor: 'hsl(var(--card))',
                    paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
                  }}
                >
                  {step === 1 ? (
                    <>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:ml-auto sm:w-auto">
                        <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          onClick={(e) => { e.preventDefault(); if (validateForm()) setStep(2); }}
                          disabled={!isStep1Valid()}
                          className={`min-h-11 w-full sm:w-auto ${!isStep1Valid() ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 !text-white !border-0'}`}
                        >
                          Suivant
                          <ChevronRight size={16} data-icon="inline-end" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
                        ← Retour
                      </Button>
                      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isLoading || !isFormValid() || (!hasChanges && !isCreating)}
                          className={`min-h-11 w-full sm:w-auto ${
                            isLoading || !isFormValid() || (!hasChanges && !isCreating)
                              ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 !text-white !border-0'
                          }`}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                              <span>{isCreating ? 'Création...' : 'Sauvegarde...'}</span>
                            </>
                          ) : (
                            isCreating ? 'Créer la tâche' : 'Sauvegarder'
                          )}
                        </Button>
                      </div>
                    </>
                  )}
              </div>
            </form>
          </div>
        </div>
        </div>
        )} {/* end desktop else */}

        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] sm:p-4"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                ref={deleteSheetRef}
                {...deleteSheetDragProps}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 monochrome:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <div className="sm:hidden flex justify-center pt-4 pb-3">
                  <motion.div style={{ width: deleteHandleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 monochrome:bg-neutral-800 flex items-center justify-center mb-4">
                    <Trash2 className="text-red-600 dark:text-red-400 monochrome:text-neutral-300" size={24} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la tâche</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                    Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 monochrome:border-neutral-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={confirmDelete}
                      disabled={isLoading}
                      className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-white monochrome:text-black transition-all shadow-md shadow-red-500/20 monochrome:shadow-white/10 disabled:opacity-50"
                    >
                      {isLoading ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
            </AnimatePresence>
            
            <ColorSettingsModal
              isOpen={showCategoryModal}
              onClose={() => setShowCategoryModal(false)}
              isNested={true}
            />
          </DialogContent>
        </Dialog>

        <PremiumGateModal
          isOpen={showPremiumGate}
          onClose={() => setShowPremiumGate(false)}
          featureName="la collaboration"
        />
    </>
    );
  };

export default TaskModal;

