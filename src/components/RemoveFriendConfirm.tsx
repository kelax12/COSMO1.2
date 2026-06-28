import React from 'react';

interface RemoveFriendConfirmProps {
  open: boolean;
  friendName: string | undefined;
  /** Tâches dont je suis propriétaire et partagées avec cet ami : il perdra l'accès. */
  ownedSharedTasks?: string[];
  /** Tâches que cet ami m'a partagées : je perdrai l'accès. */
  receivedSharedTasks?: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

const MAX_PREVIEW = 5;

const TaskPreviewList: React.FC<{ title: string; tasks: string[] }> = ({ title, tasks }) => {
  if (tasks.length === 0) return null;
  const shown = tasks.slice(0, MAX_PREVIEW);
  const overflow = tasks.length - shown.length;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        {title} ({tasks.length})
      </p>
      <ul className="space-y-1">
        {shown.map((name, i) => (
          <li
            key={i}
            className="text-sm truncate px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-primary))' }}
            title={name}
          >
            {name}
          </li>
        ))}
        {overflow > 0 && (
          <li className="text-xs px-2.5 py-1" style={{ color: 'rgb(var(--color-text-muted))' }}>
            +{overflow} autre{overflow > 1 ? 's' : ''}…
          </li>
        )}
      </ul>
    </div>
  );
};

// Dialog (bottom-sheet mobile) de confirmation de suppression d'un ami.
// Rendu conditionnel en CSS pur (pas de framer-motion) : garantit un montage
// en place et un démontage immédiat — l'overlay plein écran ne doit jamais
// rester invisible et bloquer les clics.
const RemoveFriendConfirm: React.FC<RemoveFriendConfirmProps> = ({
  open,
  friendName,
  ownedSharedTasks = [],
  receivedSharedTasks = [],
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[10000] sm:p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        style={{
          backgroundColor: 'rgb(var(--color-surface))',
          borderColor: 'rgb(var(--color-border))',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        role="alertdialog"
        aria-label="Confirmer la suppression de l'ami"
      >
        <div className="sm:hidden flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3" style={{ color: 'rgb(var(--color-text-primary))' }}>
            Retirer cet ami
          </h3>
          <p className="text-sm leading-relaxed mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Êtes-vous sûr de vouloir retirer{' '}
            <strong style={{ color: 'rgb(var(--color-text-primary))' }}>
              {friendName}
            </strong>
            {' de vos amis ?'}
          </p>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgb(var(--color-text-secondary))' }}>
            Cette personne sera retirée de <strong style={{ color: 'rgb(var(--color-text-primary))' }}>toutes vos tâches</strong>,
            et vous serez retiré de <strong style={{ color: 'rgb(var(--color-text-primary))' }}>toutes les siennes</strong>.
          </p>

          {(ownedSharedTasks.length > 0 || receivedSharedTasks.length > 0) && (
            <div className="mb-5 sm:mb-6 max-h-52 overflow-y-auto">
              <TaskPreviewList
                title="Tâches dont il perdra l'accès"
                tasks={ownedSharedTasks}
              />
              <TaskPreviewList
                title="Tâches partagées auxquelles vous perdrez l'accès"
                tasks={receivedSharedTasks}
              />
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onCancel}
              className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all"
              style={{
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-primary))',
              }}
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all"
            >
              Retirer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveFriendConfirm;
