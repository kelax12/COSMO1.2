// ═══════════════════════════════════════════════════════════════════
// TaskModalDesktopBody — corps desktop (wizard 2 étapes) de TaskModal
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de TaskModal.tsx (god component) — pendant desktop du
// TaskModalMobileBody. Découplé du parent via l'interface explicite
// `DesktopBodyProps` : tout l'état/handlers vient des props (déplacement
// verbatim). Étape 1 (détails) extraite dans DesktopDetailsStep ; étape 2
// (collaborateurs) dans DesktopCollaboratorsStep. Ce fichier = chrome
// (header, footer wizard) + aiguillage des deux étapes.
import React from 'react';
import { X, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DesktopCollaboratorsStep from './DesktopCollaboratorsStep';
import DesktopDetailsStep from './DesktopDetailsStep';
import { useCreateCategory } from '@/modules/categories';
import { useCreateList } from '@/modules/lists';
import { useRejectFriendRequest } from '@/modules/friends';
import type { Task } from '@/modules/tasks';

type TaskFormState = {
  name: string;
  description: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  completed: boolean;
  bookmarked: boolean;
  isFromOKR: boolean;
  krId: string;
  recurrence: import('@/modules/tasks').TaskRecurrence;
  subtasks: import('@/modules/tasks').Subtask[];
};

export interface DesktopBodyProps {
  formData: TaskFormState;
  setFormData: React.Dispatch<React.SetStateAction<TaskFormState>>;
  handleInputChange: (field: string, value: string | number | boolean) => void;
  errors: { [key: string]: string };
  setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  okrFields: Record<string, boolean>;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  dRegister: (name: string) => (el: HTMLElement | null) => void;
  dTrigger: (missing: string[]) => void;
  dClear: (name: string) => void;
  dInvalid: (name: string) => boolean;
  collaboratorRef: React.RefObject<HTMLDivElement>;
  validateForm: () => boolean;
  isStep1Valid: () => boolean;
  isFormValid: () => boolean;
  missingStep1Fields: () => string[];
  categories: Array<{ id: string; name: string; color: string }>;
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  listColorOptions: { value: string; color: string }[];
  lists: Array<{ id: string; name: string; color: string; taskIds: string[]; type?: string; smartRule?: string; isDefault?: boolean; position?: number }>;
  selectedListIds: string[];
  setSelectedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  createListMutation: ReturnType<typeof useCreateList>;
  isLoading: boolean;
  isCreating: boolean;
  /** Ouverture ciblée « Partager » (menu ⋯ → Collaborateur) : n'affiche QUE la
   *  section collaboration, sans les champs de la tâche. */
  collaboratorsOnly?: boolean;
  handleClose: () => void;
  handleSave: () => void;
  handleDelete: () => void;
  isTaskOwner: boolean;
  task?: Task;
  /** Section Description masquée par défaut — même système que EventModal. */
  showDescription: boolean;
  setShowDescription: React.Dispatch<React.SetStateAction<boolean>>;
  /** Crée la tâche à la volée (création) pour générer le lien d'invitation. */
  onGenerateShareLink: () => Promise<string | null>;
  collaborators: string[];
  displayInfo: (id: string) => { name: string; email?: string; avatar?: string; isPending: boolean };
  pendingShareIds: Set<string>;
  handleRemoveCollaborator: (id: string) => void;
  emailInput: string;
  setEmailInput: React.Dispatch<React.SetStateAction<string>>;
  inputError: string | null;
  setInputError: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddEmail: () => void;
  filteredFriends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  collabIdOf: (f: { id: string; userId?: string }) => string;
  toggleCollaborator: (id: string) => void;
  sentRequests: Array<{ id: string; email: string; receiverId?: string }>;
  pendingInvitesLocal: string[];
  friends: Array<{ id: string; userId?: string; name: string; email: string; avatar?: string }>;
  cancelFriendRequestMutation: ReturnType<typeof useRejectFriendRequest>;
}

const TaskModalDesktopBody: React.FC<DesktopBodyProps> = ({
  formData, setFormData, handleInputChange,
  errors, setErrors, okrFields,
  hasChanges, setHasChanges,
  step, setStep,
  dRegister, dTrigger, dClear, dInvalid,
  collaboratorRef,
  validateForm, isFormValid, missingStep1Fields,
  categories, createCategoryMutation,
  listColorOptions,
  lists, selectedListIds, setSelectedListIds, createListMutation,
  isLoading, isCreating, collaboratorsOnly = false,
  handleClose, handleSave, handleDelete,
  isTaskOwner, task, showDescription, setShowDescription, onGenerateShareLink,
  collaborators, displayInfo, pendingShareIds, handleRemoveCollaborator,
  emailInput, setEmailInput, inputError, setInputError, handleAddEmail,
  filteredFriends, collabIdOf, toggleCollaborator,
  sentRequests, pendingInvitesLocal, friends, cancelFriendRequestMutation,
}) => {
  // Enregistrement principal (bouton + touche Entrée dans un champ) : les
  // boutons vivent hors du <form> (footer sticky), donc on partage cette
  // logique entre onSubmit du form et onClick du bouton pour préserver la
  // soumission au clavier. Champs manquants → shake + focus, sinon save.
  const handlePrimarySubmit = () => {
    const missing = missingStep1Fields();
    if (missing.length > 0) {
      validateForm();
      dTrigger(missing);
      return;
    }
    handleSave();
  };
  return (
        <div
          className="flex flex-col flex-1 min-h-0 w-full rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl overflow-hidden"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        >
        <div
          className="sm:hidden flex justify-center pt-4 pb-2 shrink-0"
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        >
          <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
        </div>
        <div className="md:rounded-2xl md:shadow-2xl w-full transition-colors flex-1 min-h-0 flex flex-col" style={{ backgroundColor: 'rgb(var(--color-surface))' }}>
          {/* Header — sticky */}
          <div
            className="sticky top-0 z-10 flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b transition-colors gap-2"
            style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {collaboratorsOnly ? 'Partager la tâche' : isCreating ? 'Nouvelle tâche' : 'Modifier la tâche'}
              </h2>
              {hasChanges && !collaboratorsOnly &&
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

          <div className="p-6 overflow-y-auto flex-1 min-h-0" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
            {/* Error display */}
            {errors.general &&
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span className="font-medium">{errors.general}</span>
                </div>
              </div>
            }

              <form onSubmit={(e) => { e.preventDefault(); if (collaboratorsOnly) { if (isTaskOwner && hasChanges) handleSave(); } else { handlePrimarySubmit(); } }}>

                {collaboratorsOnly ? (
                  /* Ouverture ciblée « Partager » (menu ⋯ → Collaborateur) :
                     UNIQUEMENT la section collaboration, sans les champs tâche. */
                  <DesktopCollaboratorsStep
                    collaboratorRef={collaboratorRef}
                    isTaskOwner={isTaskOwner}
                    task={task}
                    onGenerateShareLink={onGenerateShareLink}
                    collaborators={collaborators}
                    displayInfo={displayInfo}
                    pendingShareIds={pendingShareIds}
                    handleRemoveCollaborator={handleRemoveCollaborator}
                    emailInput={emailInput}
                    setEmailInput={setEmailInput}
                    inputError={inputError}
                    setInputError={setInputError}
                    handleAddEmail={handleAddEmail}
                    filteredFriends={filteredFriends}
                    collabIdOf={collabIdOf}
                    toggleCollaborator={toggleCollaborator}
                    sentRequests={sentRequests}
                    pendingInvitesLocal={pendingInvitesLocal}
                    friends={friends}
                    cancelFriendRequestMutation={cancelFriendRequestMutation}
                  />
                ) : (
                  <>
                {/* ── Vue unique (#29) : le wizard 2 étapes est remplacé par une
                    seule vue — les collaborateurs (minorité des tâches) passent
                    en progressive disclosure via la section « Partager ». ── */}
                <DesktopDetailsStep
                    formData={formData}
                    setFormData={setFormData}
                    handleInputChange={handleInputChange}
                    errors={errors}
                    setErrors={setErrors}
                    okrFields={okrFields}
                    setHasChanges={setHasChanges}
                    dRegister={dRegister}
                    dClear={dClear}
                    dInvalid={dInvalid}
                    categories={categories}
                    createCategoryMutation={createCategoryMutation}
                    listColorOptions={listColorOptions}
                    lists={lists}
                    selectedListIds={selectedListIds}
                    setSelectedListIds={setSelectedListIds}
                    createListMutation={createListMutation}
                    isCreating={isCreating}
                    isLoading={isLoading}
                    handleDelete={handleDelete}
                    task={task}
                    showDescription={showDescription}
                    setShowDescription={setShowDescription}
                  />

                {/* ── Collaborateurs en disclosure (#29) — repliés par défaut,
                    dépliés via « Partager » ou l'ouverture ciblée (step===2). ── */}
                <div className="mt-6 border-t pt-4" style={{ borderColor: 'rgb(var(--color-border))' }}>
                  <button
                    type="button"
                    onClick={() => setStep(step === 2 ? 1 : 2)}
                    aria-expanded={step === 2}
                    className="flex items-center gap-2 text-sm font-semibold hover:text-blue-500 transition-colors"
                    style={{ color: 'rgb(var(--color-text-secondary))' }}
                  >
                    <ChevronRight
                      size={16}
                      aria-hidden="true"
                      className={`transition-transform ${step === 2 ? 'rotate-90' : ''}`}
                    />
                    Partager la tâche
                    {collaborators.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs bg-[rgb(var(--color-accent-solid))]/10 text-blue-500">
                        {collaborators.length}
                      </span>
                    )}
                  </button>
                  {step === 2 && (
                    <div className="mt-4">
                      <DesktopCollaboratorsStep
                        collaboratorRef={collaboratorRef}
                        isTaskOwner={isTaskOwner}
                        task={task}
                        onGenerateShareLink={onGenerateShareLink}
                        collaborators={collaborators}
                        displayInfo={displayInfo}
                        pendingShareIds={pendingShareIds}
                        handleRemoveCollaborator={handleRemoveCollaborator}
                        emailInput={emailInput}
                        setEmailInput={setEmailInput}
                        inputError={inputError}
                        setInputError={setInputError}
                        handleAddEmail={handleAddEmail}
                        filteredFriends={filteredFriends}
                        collabIdOf={collabIdOf}
                        toggleCollaborator={toggleCollaborator}
                        sentRequests={sentRequests}
                        pendingInvitesLocal={pendingInvitesLocal}
                        friends={friends}
                        cancelFriendRequestMutation={cancelFriendRequestMutation}
                      />
                    </div>
                  )}
                </div>
                  </>
                )}
            </form>
          </div>

          {/* ── Action Buttons — sticky, hors zone de scroll ── */}
          <div
            className="px-4 sm:px-6 pt-3 pb-3 sm:pb-4 border-t flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 sm:gap-3 shrink-0"
            style={{
              borderColor: 'rgb(var(--color-border))',
              backgroundColor: 'rgb(var(--color-surface))',
              paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
            }}
          >
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 w-full sm:ml-auto sm:w-auto">
              {collaboratorsOnly ? (
                /* Vue « Partager » : destinataire → simple « Fermer » ;
                   propriétaire → « Enregistrer » les partages modifiés. */
                !isTaskOwner ? (
                  <Button type="button" size="lg" onClick={handleClose} className="min-h-11 w-full sm:w-auto bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-white !border-0">
                    Fermer
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleSave}
                      disabled={isLoading || !hasChanges}
                      className={`min-h-11 w-full sm:w-auto ${
                        isLoading || !hasChanges
                          ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100'
                          : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-white !border-0'
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                          <span>Enregistrement...</span>
                        </>
                      ) : (
                        'Enregistrer'
                      )}
                    </Button>
                  </>
                )
              ) : (
                <>
              <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={isLoading} className="min-h-11 w-full sm:w-auto">
                Annuler
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={handlePrimarySubmit}
                disabled={isLoading || (!hasChanges && !isCreating)}
                className={`min-h-11 w-full sm:w-auto ${
                  isLoading || !isFormValid() || (!hasChanges && !isCreating)
                    ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100'
                    : 'bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-white !border-0'
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
                </>
              )}
            </div>
          </div>
        </div>
        </div>
  );
};

export default TaskModalDesktopBody;
