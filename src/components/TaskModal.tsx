import React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ColorSettingsModal from './ColorSettingsModal';

// Corps mobile full-screen extrait (cf. task-modal/TaskModalMobileBody.tsx).
import TaskModalMobileBody from './task-modal/TaskModalMobileBody';
// Corps desktop (wizard 2 étapes) extrait (cf. task-modal/TaskModalDesktopBody.tsx).
import TaskModalDesktopBody from './task-modal/TaskModalDesktopBody';
// Feuille de confirmation de suppression extraite (cf. task-modal/DeleteTaskConfirm.tsx).
import DeleteTaskConfirm from './task-modal/DeleteTaskConfirm';
// Helper d'identité des collaborateurs (cf. task-modal/collaborators.ts).
import { collabIdOf } from './task-modal/collaborators';
// Toute la logique (état, effets, handlers) vit dans le hook contrôleur.
import { useTaskModal, type TaskModalProps } from './task-modal/useTaskModal';

// ─────────────────────────────────────────────────────────────────────────────

const TaskModal: React.FC<TaskModalProps> = (props) => {
  const { isOpen, showCollaborators = false } = props;
  const {
    task, isCreating, onGenerateShareLink,
    formData, setFormData, handleInputChange,
    errors, setErrors, okrFields, hasChanges, setHasChanges, step, setStep,
    categories, createCategoryMutation,
    lists, selectedListIds, setSelectedListIds, createListMutation, listColorOptions,
    collaborators, pendingInvitesLocal, emailInput, setEmailInput, inputError, setInputError,
    friends, filteredFriends, sentRequests, displayInfo,
    handleAddEmail, handleRemoveCollaborator, toggleCollaborator,
    cancelFriendRequestMutation,
    isTaskOwner, pendingShareIds,
    validateForm, isFormValid, isStep1Valid, missingStep1Fields,
    dRegister, dTrigger, dClear, dInvalid, collaboratorRef,
    handleSave, handleDelete, confirmDelete, handleClose,
    showDeleteConfirm, setShowDeleteConfirm,
    showCategoryModal, setShowCategoryModal,
    isLoading, isMobile,
  } = useTaskModal(props);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        variant={isMobile ? 'bottom-sheet' : 'default'}
        className="p-0 border-0 bg-transparent shadow-none top-auto bottom-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[94dvh] max-h-[94dvh] sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:max-w-xl sm:h-auto sm:max-h-[calc(100vh-2rem)] lg:max-h-[85vh] overflow-visible sm:overflow-hidden flex flex-col"
      >
        <DialogTitle className="sr-only">
          {isCreating ? 'Créer une nouvelle tâche' : 'Modifier la tâche'}
        </DialogTitle>
        {isMobile ? (
          <TaskModalMobileBody
            formData={formData}
            handleInputChange={handleInputChange}
            onSubtasksChange={(subtasks) => setFormData(prev => ({ ...prev, subtasks }))}
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
            handleSave={handleSave}
            handleClose={handleClose}
            handleDelete={handleDelete}
            isCreating={isCreating}
            isLoading={isLoading}
            isFormValid={isFormValid}
            taskId={task?.id}
            autoOpenCollaborators={showCollaborators}
            isTaskOwner={isTaskOwner}
            ownerId={task?.userId}
            pendingShareIds={pendingShareIds}
            onGenerateShareLink={onGenerateShareLink}
          />
        ) : (
          <TaskModalDesktopBody
            formData={formData}
            setFormData={setFormData}
            handleInputChange={handleInputChange}
            errors={errors}
            setErrors={setErrors}
            okrFields={okrFields}
            hasChanges={hasChanges}
            setHasChanges={setHasChanges}
            step={step}
            setStep={setStep}
            dRegister={dRegister}
            dTrigger={dTrigger}
            dClear={dClear}
            dInvalid={dInvalid}
            collaboratorRef={collaboratorRef}
            validateForm={validateForm}
            isStep1Valid={isStep1Valid}
            isFormValid={isFormValid}
            missingStep1Fields={missingStep1Fields}
            categories={categories}
            createCategoryMutation={createCategoryMutation}
            listColorOptions={listColorOptions}
            lists={lists}
            selectedListIds={selectedListIds}
            setSelectedListIds={setSelectedListIds}
            createListMutation={createListMutation}
            isLoading={isLoading}
            isCreating={isCreating}
            collaboratorsOnly={showCollaborators}
            handleClose={handleClose}
            handleSave={handleSave}
            handleDelete={handleDelete}
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
        )} {/* end desktop else */}

        <DeleteTaskConfirm
          isOpen={showDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          isLoading={isLoading}
        />

            <ColorSettingsModal
              isOpen={showCategoryModal}
              onClose={() => setShowCategoryModal(false)}
              isNested={true}
            />
          </DialogContent>
        </Dialog>
    </>
    );
  };

export default TaskModal;
