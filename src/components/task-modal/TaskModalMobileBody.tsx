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
import { Bookmark, Loader2, Plus } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useCreateCategory } from '@/modules/categories';
import AddToListModal from '@/components/AddToListModal';
import { SectionTitle, SectionCard, CellSeparator, Cell } from './primitives';
import { MobileChoiceSheet } from './MobileActionSheet';
import DurationStepper from './DurationStepper';
import MobileCollaboratorsSheet from './MobileCollaboratorsSheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';
import { buildDatePresets } from '@/lib/date-presets';
import SubtaskChecklist from './SubtaskChecklist';
import TaskDependenciesSection from './TaskDependenciesSection';
import DescriptionField from '@/components/DescriptionField';
import { PRIORITY_OPTIONS, priorityColor, RECURRENCE_OPTIONS } from './constants';
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
  const { t } = useT('taskModal');
  const { t: tCommon } = useT('common');
  const { t: tOv } = useT('overlays');
  const [showPrioritySheet, setShowPrioritySheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showRecurrenceSheet, setShowRecurrenceSheet] = useState(false);
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
  const { sheetRef, sheetDragProps } = useBottomSheet(handleClose);
  const { register, trigger, clear, isInvalid } = useInvalidShake();

  const isValid = isFormValid();

  // Création de catégorie depuis la feuille : sélectionne la catégorie créée,
  // efface l'erreur du champ, referme la saisie ET la feuille.
  const submitNewCategory = () => {
    const name = newCatName.trim();
    if (name.length < 2) return;
    createCategoryMutation.mutate(
      { name, color: listColorOptions.find((c) => c.value === newCatColor)?.color ?? '#3B82F6' },
      {
        onSuccess: (created) => {
          handleInputChange('category', created.id);
          setCellErrors((prev) => ({ ...prev, category: false }));
          setShowNewCatInput(false);
          setNewCatName('');
          setNewCatColor('blue');
          setShowCategorySheet(false);
        },
      },
    );
  };

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
            {/* Récurrence (#26) — visible dès qu'une échéance est posée.
                🔴 Un `<select>` natif ne s'aligne pas de façon fiable sur les
                autres lignes malgré `appearance-none` : l'UA stylesheet garde
                un padding/line-height propre à `<select>` que rien ne
                garantit identique à celui d'un `<span>` — vérifié « pas
                aligné » sur un vrai iPhone alors que la capture avait l'air
                bonne. Un `Cell` + feuille d'options, comme Priorité et
                Catégorie juste au-dessus, RÉUTILISE le même composant :
                l'alignement ne peut pas diverger, c'est le même code qui le
                rend. */}
            {formData.deadline && (
              <>
                <CellSeparator />
                <Cell
                  label={t('fields.repeat')}
                  value={
                    <span className="text-blue-500">
                      {t(RECURRENCE_OPTIONS.find(o => o.value === formData.recurrence)?.labelKey ?? 'fields.recurrenceNever')}
                    </span>
                  }
                  onTap={() => setShowRecurrenceSheet(true)}
                />
              </>
            )}
            <CellSeparator />
            {/* Durée */}
            <DurationStepper
              value={formData.estimatedTime}
              onChange={(minutes) => handleInputChange('estimatedTime', minutes)}
              label={t('fields.duration')}
            />
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
      <MobileChoiceSheet
        open={showPrioritySheet}
        title={t('fields.priority')}
        onClose={() => setShowPrioritySheet(false)}
        options={PRIORITY_OPTIONS.map((opt) => ({ value: opt.value, label: tCommon(opt.labelKey), labelClassName: opt.color }))}
        selected={formData.priority}
        onSelect={(value) => { handleInputChange('priority', value); setCellErrors((prev) => ({ ...prev, priority: false })); setShowPrioritySheet(false); }}
      />

      {/* ── Action sheet : Répéter ── */}
      <MobileChoiceSheet
        open={showRecurrenceSheet}
        title={t('fields.repeat')}
        onClose={() => setShowRecurrenceSheet(false)}
        options={RECURRENCE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
        selected={formData.recurrence}
        onSelect={(value) => { handleInputChange('recurrence', value); setShowRecurrenceSheet(false); }}
      />

      {/* ── Action sheet : Catégorie ── */}
      <MobileChoiceSheet
        open={showCategorySheet}
        title={t('fields.category')}
        onClose={() => { setShowCategorySheet(false); setShowNewCatInput(false); }}
        scrollable
        options={categories.map((cat) => ({ value: cat.id, label: cat.name, dotColor: cat.color }))}
        selected={formData.category}
        onSelect={(id) => { handleInputChange('category', formData.category === id ? '' : id); setShowCategorySheet(false); }}
        footer={
          !showNewCatInput ? (
            <button type="button" onClick={() => setShowNewCatInput(true)} className="w-full flex items-center gap-2 px-4 min-h-11 text-blue-500">
              <Plus size={16} /><span className="text-[15px]">{t('fields.createCategory')}</span>
            </button>
          ) : (
            <div className="px-4 py-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { const idx = listColorOptions.findIndex((c) => c.value === newCatColor); setNewCatColor(listColorOptions[(idx + 1) % listColorOptions.length].value); }}
                className="w-6 h-6 rounded-full shrink-0"
                style={{ backgroundColor: listColorOptions.find((c) => c.value === newCatColor)?.color ?? '#3B82F6' }}
              />
              <input
                autoFocus type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                placeholder={t('fields.categoryNamePlaceholder')}
                className="flex-1 text-[15px] bg-transparent focus:outline-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
              />
              <button
                type="button"
                disabled={newCatName.trim().length < 2 || createCategoryMutation.isPending}
                onClick={submitNewCategory}
                className="text-[15px] text-blue-500 font-semibold disabled:text-blue-300"
              >
                {createCategoryMutation.isPending ? '…' : t('common.create')}
              </button>
            </div>
          )
        }
      />

      {/* ── Modal Listes (composant existant) ── */}
      {taskId && (
        <AddToListModal
          isOpen={showListsModal}
          onClose={() => setShowListsModal(false)}
          taskId={taskId}
        />
      )}

      {/* ── Action sheet : Collaborateurs ── */}
      <MobileCollaboratorsSheet
        open={showCollabSheet}
        onClose={() => setShowCollabSheet(false)}
        isTaskOwner={isTaskOwner}
        ownerId={ownerId}
        collaborators={collaborators}
        displayInfo={displayInfo}
        pendingShareIds={pendingShareIds}
        filteredFriends={filteredFriends}
        collabIdOf={collabIdOf}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        inputError={inputError}
        onAddEmail={handleAddEmail}
        onRemoveCollaborator={handleRemoveCollaborator}
        onToggleCollaborator={toggleCollaborator}
        taskId={taskId}
        onGenerateShareLink={onGenerateShareLink}
        renderAvatar={(name, avatar) => <MiniAvatar name={name} avatar={avatar} />}
      />

    </motion.div>
  );
};

export default TaskModalMobileBody;
