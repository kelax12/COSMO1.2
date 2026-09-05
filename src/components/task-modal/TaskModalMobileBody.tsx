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
import { getDateLocale } from '@/i18n/format';
import { Bookmark, Check, ChevronRight, Loader2, Minus, Plus, Search, UserPlus, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useCreateCategory } from '@/modules/categories';
import AddToListModal from '@/components/AddToListModal';
import ShareLinkField from '@/components/ShareLinkField';
import { SectionTitle, SectionCard, CellSeparator, Cell } from './primitives';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';
import { buildDatePresets } from '@/lib/date-presets';
import SubtaskChecklist from './SubtaskChecklist';
import TaskDependenciesSection from './TaskDependenciesSection';
import DescriptionField from '@/components/DescriptionField';
import { PRIORITY_OPTIONS, priorityColor } from './constants';
import { useT } from '@/i18n/useT';

export interface MobileBodyProps {
  formData: {
    name: string; priority: number; category: string;
    deadline: string; estimatedTime: number | string;
    completed: boolean; bookmarked: boolean; isFromOKR: boolean;
    krId: string;
    recurrence: import('@/modules/tasks').TaskRecurrence;
    subtasks?: import('@/modules/tasks').Subtask[];
    description?: string;
  };
  handleInputChange: (field: string, value: string | number | boolean) => void;
  /** Section Description masquée par défaut — même système que le corps
   *  desktop et EventModal (cf. task-modal/DesktopDetailsStep.tsx). */
  showDescription: boolean;
  setShowDescription: React.Dispatch<React.SetStateAction<boolean>>;
  /** Création : remonte les sous-tâches saisies vers le formData parent (#12). */
  onSubtasksChange?: (subtasks: import('@/modules/tasks').Subtask[]) => void;
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

/** Petit avatar rond (photo, emoji ou initiales) — devant un nom de
 *  collaborateur/ami dans les listes de la feuille Collaborateurs. */
const MiniAvatar: React.FC<{ name: string; avatar?: string }> = ({ name, avatar }) => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return (
    <Avatar className="size-7 shrink-0">
      {isImageAvatar(avatar) ? <AvatarImage src={avatar} alt="" /> : null}
      <AvatarFallback className="bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] text-caption font-bold">
        {isEmojiAvatar(avatar) ? <span className="text-xs">{avatar}</span> : initials}
      </AvatarFallback>
    </Avatar>
  );
};

const TaskModalMobileBody: React.FC<MobileBodyProps> = ({
  formData, handleInputChange, onSubtasksChange,
  showDescription, setShowDescription,
  categories, lists, selectedListIds, listColorOptions,
  collaborators, pendingInvitesLocal: _pendingInvitesLocal, emailInput, setEmailInput, inputError,
  friends: _friends, filteredFriends, sentRequests: _sentRequests, collabIdOf, displayInfo,
  handleAddEmail, handleRemoveCollaborator, toggleCollaborator,
  createCategoryMutation,
  handleSave, handleClose, handleDelete, isCreating, isLoading, isFormValid,
  taskId, autoOpenCollaborators, isTaskOwner, ownerId, pendingShareIds, onGenerateShareLink,
}) => {
  const sheetMotion = useSheetMotion();
  const { t } = useT('taskModal');
  const { t: tCommon } = useT('common');
  const { t: tOv } = useT('overlays');
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
    <motion.div ref={sheetRef} {...sheetDragProps} className="flex flex-col h-full w-full rounded-t-3xl bg-[rgb(var(--color-background))] overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 bg-[rgb(var(--color-background))]/95 backdrop-blur-sm border-b border-[rgb(var(--color-border))]" style={{ paddingTop: '10px' }}>
        <div className="flex justify-center pb-2">
          <div className="w-9 h-1 rounded-full bg-[rgb(var(--color-border-strong))]" />
        </div>
        <div className="flex items-center justify-between px-4 h-11">
          <button type="button" onClick={handleClose} className="text-blue-500 text-[15px] min-w-[64px] text-left">
            {tCommon('actions.cancel')}
          </button>
          <span className="text-[17px] font-semibold text-[rgb(var(--color-text-primary))]">
            {isCreating ? t('form.headingCreate') : t('form.headingEditShort')}
          </span>
          <button
            type="button"
            onClick={handleCreateOrSave}
            disabled={isLoading}
            className={`text-[15px] font-semibold min-w-[64px] text-right transition-colors ${isValid ? 'text-blue-500' : 'text-blue-300 dark:text-blue-700'}`}
          >
            {isLoading ? '…' : isCreating ? t('common.create') : t('common.ok')}
          </button>
        </div>
      </div>

      {/* ── Scroll area ── */}
      <div className="flex-1 overflow-y-auto" data-scroll-area>
        <div className="px-4 py-4 flex flex-col gap-0">

          {/* ── Groupe 1 : Nom ── */}
          <div
            ref={register('name')}
            className={`bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm transition-[box-shadow] ${
              isInvalid('name') ? 'ring-2 ring-red-500' : ''
            }`}
          >
            <input
              type="text"
              value={formData.name}
              onChange={(e) => { handleInputChange('name', e.target.value); clear('name'); }}
              placeholder={t('form.namePlaceholder')}
              autoFocus={isCreating}
              className={`w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 ${
                cellErrors.name
                  ? 'text-red-500 placeholder-red-300'
                  : 'text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]'
              }`}
            />
          </div>

          {/* ── Section DÉTAILS ── */}
          <SectionTitle>{t('sections.details')}</SectionTitle>
          <div ref={register('details')} className={`rounded-2xl transition-[box-shadow] ${isInvalid('details') ? 'ring-2 ring-red-500' : ''}`}>
          <SectionCard>
            {/* Priorité */}
            <Cell
              label={<span className={cellErrors.priority ? 'text-red-500' : ''}>{t('fields.priority')}</span>}
              value={
                formData.priority !== 0
                  ? <span className={priorityColor(formData.priority)}>P{formData.priority}</span>
                  : <span className="text-[rgb(var(--color-text-muted))]">{t('common.choose')}</span>
              }
              onTap={() => setShowPrioritySheet(true)}
            />
            <CellSeparator />
            {/* Catégorie */}
            <Cell
              label={<span className={cellErrors.category ? 'text-red-500' : ''}>{t('fields.category')}</span>}
              value={(() => {
                const cat = categories.find(c => c.id === formData.category);
                if (!cat) return <span className="text-[rgb(var(--color-text-muted))]">{t('common.choose')}</span>;
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
              label={t('fields.deadline')}
              value={
                formData.deadline
                  ? <span className="text-blue-500">{format(new Date(formData.deadline + 'T12:00:00'), 'd MMM', { locale: getDateLocale() })}</span>
                  : <span className="text-[rgb(var(--color-text-muted))]">{t('common.none')}</span>
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
                    {/* Presets (#25) : un tap au lieu de trois */}
                    <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                      {buildDatePresets().map((preset) => (
                        <button
                          key={preset.labelKey}
                          type="button"
                          onClick={() => { handleInputChange('deadline', preset.value); setShowDeadlinePicker(false); }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]"
                        >
                          {tOv(preset.labelKey)}
                        </button>
                      ))}
                    </div>
                    <div className="overflow-hidden">
                      <Calendar
                        mode="single"
                        selected={formData.deadline ? new Date(formData.deadline + 'T12:00:00') : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          handleInputChange('deadline', format(date, 'yyyy-MM-dd'));
                          setShowDeadlinePicker(false);
                        }}
                        locale={getDateLocale()}
                        disabled={{ before: new Date() }}
                        initialFocus
                        className="w-full [--cell-size:2.25rem]"
                      />
                    </div>
                    {formData.deadline && (
                      <button
                        type="button"
                        onClick={() => { handleInputChange('deadline', ''); setShowDeadlinePicker(false); }}
                        className="w-full text-center text-[14px] text-red-500 py-3 border-t border-[rgb(var(--color-border))]"
                      >
                        {t('form.clearDate')}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Récurrence (#26) — visible dès qu'une échéance est posée */}
            {formData.deadline && (
              <>
                <CellSeparator />
                <div className="flex items-center justify-between px-4 min-h-11 gap-3">
                  <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{t('fields.repeat')}</span>
                  {/* `appearance-none` + bordure/fond retirés : Safari iOS
                      dessine sinon sa capsule native autour d'un `<select>`,
                      seul champ de cette carte à ne pas suivre le style des
                      autres lignes (texte bleu aligné à droite + chevron). */}
                  <span className="flex items-center gap-1.5 shrink-0 ml-2">
                    <select
                      value={formData.recurrence}
                      onChange={(e) => handleInputChange('recurrence', e.target.value)}
                      aria-label={t('fields.recurrenceAria')}
                      className="appearance-none border-none bg-transparent text-[15px] text-right text-blue-500 focus:outline-none"
                    >
                      <option value="none">{t('fields.recurrenceNever')}</option>
                      <option value="daily">{t('fields.recurrenceDaily')}</option>
                      <option value="weekly">{t('fields.recurrenceWeekly')}</option>
                      <option value="monthly">{t('fields.recurrenceMonthly')}</option>
                    </select>
                    <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                  </span>
                </div>
              </>
            )}
            <CellSeparator />
            {/* Durée */}
            <div className="flex items-center justify-between px-4 min-h-11">
              <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{t('fields.duration')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = typeof formData.estimatedTime === 'number' ? formData.estimatedTime : 0;
                    handleInputChange('estimatedTime', Math.max(0, cur - 5));
                    setStepperDir(-1); setTimeout(() => setStepperDir(0), 80);
                  }}
                  className="w-7 h-7 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center text-[rgb(var(--color-text-secondary))]"
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
                  {formData.estimatedTime ? `${formData.estimatedTime} min` : '·'}
                </motion.span>
                <button
                  type="button"
                  onClick={() => {
                    const cur = typeof formData.estimatedTime === 'number' ? formData.estimatedTime : 0;
                    handleInputChange('estimatedTime', cur + 5);
                    setStepperDir(1); setTimeout(() => setStepperDir(0), 80);
                  }}
                  className="w-7 h-7 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center text-[rgb(var(--color-text-secondary))]"
                  aria-label="Augmenter de 5 minutes"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </SectionCard>
          </div>

          {/* ── Section DESCRIPTION ── masquée par défaut, même système que
              le corps desktop et EventModal (bouton « + Ajouter » tant que
              vide, textarea auto-affiché si la tâche en a déjà une — cf.
              useTaskModal.ts, effet de sync sur `fullTask`). */}
          <SectionTitle>{t('sections.description')}</SectionTitle>
          <SectionCard>
            {showDescription ? (
              <div className="px-4 py-3">
                <DescriptionField
                  value={formData.description ?? ''}
                  onChange={(value) => handleInputChange('description', value)}
                  rows={4}
                  autoFocus={!formData.description}
                  placeholder={t('form.descriptionPlaceholder')}
                  className="w-full text-[15px] bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] resize-none"
                  style={{ border: 'none' }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="flex items-center px-4 min-h-11 w-full"
              >
                <span className="text-[15px] text-blue-600 dark:text-blue-400">
                  {t('form.addDescription')}
                </span>
              </button>
            )}
          </SectionCard>

          {/* ── Section ORGANISATION ── */}
          <SectionTitle>{t('sections.organisation')}</SectionTitle>
          <SectionCard>
            {/* Listes */}
            <Cell
              label="Listes"
              value={(() => {
                const inLists = taskId ? lists.filter(l => l.taskIds.includes(taskId)) : lists.filter(l => selectedListIds.includes(l.id));
                if (inLists.length === 0) return <span className="text-[rgb(var(--color-text-muted))]">{t('common.none')}</span>;
                if (inLists.length === 1) return <span className="text-blue-500">{inLists[0].name}</span>;
                return <span className="text-blue-500">{inLists.length} listes</span>;
              })()}
              onTap={() => setShowListsModal(true)}
              showChevron={!!taskId}
            />
            {/* Sélecteur « Résultat clé » retiré à la demande utilisateur —
                lien tâche↔KR géré via l'auto-liaison depuis la page OKR. */}
            <CellSeparator />
            {/* Favori — toggle iOS */}
            <div className="flex items-center justify-between px-4 min-h-11">
              <span className="flex items-center gap-2 text-[15px] text-[rgb(var(--color-text-primary))]">
                <Bookmark size={16} className="text-[rgb(var(--color-text-muted))]" />
                Favori
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={formData.bookmarked}
                aria-label={formData.bookmarked ? t('form.bookmarkRemove') : t('form.bookmarkAdd')}
                onClick={() => handleInputChange('bookmarked', !formData.bookmarked)}
                className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  formData.bookmarked ? 'bg-[rgb(var(--color-accent-solid))]' : 'bg-[rgb(var(--color-hover))]'
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

          {/* ── Section SOUS-TÂCHES (#12) + DÉPENDANCES (mig. 132) ── Une
                seule carte, comme sur desktop (DesktopDetailsStep) :
                `TaskDependenciesSection` porte déjà son propre `border-t`
                pour se séparer de ce qui précède — lui donner SA PROPRE
                carte empilait deux `rounded-2xl` à espacement nul (le
                conteneur parent est en `gap-0`), et les deux bordures
                arrondies se heurtaient en un bug d'affichage visible à
                l'écran (coins qui se chevauchent au lieu de s'espacer). ── */}
          {((!isCreating && taskId) || (isCreating && onSubtasksChange)) && (
            <>
              <SectionTitle>{t('sections.subtasks')}</SectionTitle>
              <SectionCard>
                <div className="px-4 py-3">
                  {!isCreating && taskId ? (
                    <SubtaskChecklist taskId={taskId} hideLabel />
                  ) : (
                    <SubtaskChecklist hideLabel value={formData.subtasks ?? []} onChange={onSubtasksChange} />
                  )}
                  {/* Dépendances (édition seulement : une arête référence deux
                      tâches, la seconde n'existe pas encore en création). */}
                  {!isCreating && taskId && <TaskDependenciesSection taskId={taskId} />}
                </div>
              </SectionCard>
            </>
          )}

          {/* ── Section COLLABORATION ── */}
          <SectionTitle>{t('sections.collaboration')}</SectionTitle>
          <SectionCard>
            <Cell
              label="Collaborateurs"
              value={
                collaborators.length > 0
                  ? <span className="text-blue-500">{collaborators.length}</span>
                  : <span className="text-[rgb(var(--color-text-muted))]">0</span>
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
                  className="w-full flex items-center justify-center min-h-11 text-red-500 text-[15px] active:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors"
                >
                  {t('form.deleteTask')}
                </button>
              </SectionCard>
            </>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* ── Footer CTA ── */}
      <div
        className="shrink-0 px-4 pt-3 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))]/95 backdrop-blur-sm"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <button
          type="button"
          onClick={handleCreateOrSave}
          disabled={isLoading}
          className={`w-full h-[50px] rounded-2xl text-[17px] font-semibold transition-colors ${
            isValid && !isLoading ? 'bg-[rgb(var(--color-accent-solid))] active:bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] opacity-40'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              {isCreating ? t('common.creatingEllipsis') : t('common.saving')}
            </span>
          ) : (
            isCreating ? t('mobile.createTask') : t('common.save')
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
              {...sheetMotion}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[rgb(var(--color-surface))] rounded-t-2xl overflow-hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2"><div className="w-9 h-1 rounded-full bg-[rgb(var(--color-border-strong))]" /></div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-2">{t('fields.priority')}</p>
              {PRIORITY_OPTIONS.map((opt, i) => (
                <React.Fragment key={opt.value}>
                  {i > 0 && <CellSeparator />}
                  <button
                    type="button"
                    onClick={() => { handleInputChange('priority', opt.value); setCellErrors(prev => ({ ...prev, priority: false })); setShowPrioritySheet(false); }}
                    className="w-full flex items-center justify-between px-4 min-h-11 active:bg-[rgb(var(--color-hover))]"
                  >
                    <span className={`text-[15px] ${opt.color}`}>{tCommon(opt.labelKey)}</span>
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
              {...sheetMotion}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[rgb(var(--color-surface))] rounded-t-2xl overflow-hidden max-h-[70vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0"><div className="w-9 h-1 rounded-full bg-[rgb(var(--color-border-strong))]" /></div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-2 shrink-0">{t('fields.category')}</p>
              <div className="flex-1 overflow-y-auto">
                {categories.map((cat, i) => (
                  <React.Fragment key={cat.id}>
                    {i > 0 && <CellSeparator />}
                    <button
                      type="button"
                      onClick={() => { handleInputChange('category', formData.category === cat.id ? '' : cat.id); setShowCategorySheet(false); }}
                      className="w-full flex items-center justify-between px-4 min-h-11 active:bg-[rgb(var(--color-hover))]"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{cat.name}</span>
                      </span>
                      {formData.category === cat.id && <Check size={16} className="text-blue-500" />}
                    </button>
                  </React.Fragment>
                ))}
                {categories.length > 0 && <CellSeparator />}
                {!showNewCatInput ? (
                  <button type="button" onClick={() => setShowNewCatInput(true)} className="w-full flex items-center gap-2 px-4 min-h-11 text-blue-500">
                    <Plus size={16} /><span className="text-[15px]">{t('fields.createCategory')}</span>
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
                      placeholder={t('fields.categoryNamePlaceholder')}
                      className="flex-1 text-[15px] bg-transparent focus:outline-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
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
                      {createCategoryMutation.isPending ? '…' : t('common.create')}
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
              {...sheetMotion}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[rgb(var(--color-surface))] rounded-t-2xl overflow-hidden max-h-[80vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0"><div className="w-9 h-1 rounded-full bg-[rgb(var(--color-border-strong))]" /></div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-2 shrink-0">{t('mobile.collaborators')}</p>
              {!isTaskOwner && (
                <p className="px-4 pb-2 text-[13px] text-[rgb(var(--color-text-muted))] shrink-0">
                  {t('mobile.notOwner')}
                </p>
              )}
              {isTaskOwner && (
                <div className="px-4 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[calc(100%-44px)]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" />
                      <input
                        type="text" value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
                        placeholder={t('form.collaboratorPlaceholder')}
                        className="w-full h-9 pl-9 pr-3 text-[15px] bg-[rgb(var(--color-hover))] rounded-xl focus:outline-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
                      />
                    </div>
                    {/* `disabled:opacity-40` plutôt qu'un bleu Tailwind en
                        dur (`bg-blue-300`) : ce dernier ignore le thème et
                        rendait un carré bleu pâle décalé du reste de l'UI. */}
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      disabled={!emailInput.trim()}
                      aria-label={t('form.addCollaborator')}
                      className="shrink-0 size-9 flex items-center justify-center bg-[rgb(var(--color-accent-solid))] disabled:opacity-40 text-[rgb(var(--color-accent-solid-foreground))] rounded-xl transition-opacity"
                    >
                      <UserPlus size={16} />
                    </button>
                  </div>
                  {inputError && <p className="mt-1 text-[13px] text-red-500">{inputError}</p>}
                  {/* Lien d'invitation copiable (Supabase only) */}
                  <ShareLinkField taskId={taskId} ownerCanShare={isTaskOwner} onGenerate={onGenerateShareLink} className="pt-3" />
                </div>
              )}
              {collaborators.length > 0 && (
                <div className="px-4 pb-2 shrink-0 border-b border-[rgb(var(--color-border))]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] pb-1">{isTaskOwner ? t('mobile.selected', { count: collaborators.length }) : t('mobile.participants')}</p>
                  {collaborators.map((id) => {
                    const info = displayInfo(id);
                    const isSent = isTaskOwner && !info.isPending && pendingShareIds.has(id);
                    return (
                      <div key={id} className="flex items-center justify-between py-1.5 gap-2">
                        <span className="flex items-center gap-2 min-w-0 flex-1">
                          <MiniAvatar name={info.name} avatar={info.avatar} />
                          <span className="text-[14px] text-[rgb(var(--color-text-primary))] truncate">
                            {info.name}{!isTaskOwner && id === ownerId ? t('mobile.owner') : ''}
                          </span>
                        </span>
                        {isSent && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-caption font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{t('mobile.sent')}</span>
                        )}
                        {isTaskOwner && (
                          <button type="button" onClick={() => handleRemoveCollaborator(id)} className="p-1 text-red-400" aria-label={tCommon('actions.remove')}><X size={14} /></button>
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
                        className="w-full flex items-center justify-between gap-2 py-2.5 border-b border-[rgb(var(--color-border))] last:border-0"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <MiniAvatar name={friend.name} avatar={friend.avatar} />
                          <span className="text-[15px] text-[rgb(var(--color-text-primary))] truncate">{friend.name}</span>
                        </span>
                        {isSelected ? <Check size={16} className="shrink-0 text-blue-500" /> : <Plus size={16} className="shrink-0 text-[rgb(var(--color-text-muted))]" />}
                      </button>
                    );
                  })}
                  {filteredFriends.length === 0 && (
                    <p className="text-center py-6 text-[14px] text-[rgb(var(--color-text-muted))]">{t('mobile.noFriend')}</p>
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
