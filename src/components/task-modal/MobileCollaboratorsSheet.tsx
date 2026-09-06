// ═══════════════════════════════════════════════════════════════════
// Qui travaille sur cette tâche — la feuille MOBILE
//
// FRONTIÈRE : ce composant ne connaît ni le formulaire de la tâche, ni ses
// autres sections. Il reçoit la liste des collaborateurs, celle des amis
// filtrés, et quatre rappels. Toute la logique — qui peut partager, ce qu'un
// ajout écrit, quand — vit dans `useTaskCollaborators`.
//
// ⚠️ Deux points de vue dans un seul écran, et ils ne se ressemblent pas :
// le PROPRIÉTAIRE peut chercher, inviter et retirer ; un DESTINATAIRE ne
// fait que lire la liste des participants, propriétaire compris et lui-même
// exclu. C'est `isTaskOwner` qui tranche, et il gouverne trois blocs.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { Check, Plus, Search, UserPlus, X } from 'lucide-react';
import ShareLinkField from '@/components/ShareLinkField';
import { MobileActionSheet } from './MobileActionSheet';
import { useT } from '@/i18n/useT';

interface Friend {
  id: string;
  userId?: string;
  name: string;
  email: string;
  avatar?: string;
}

interface MobileCollaboratorsSheetProps {
  open: boolean;
  onClose: () => void;
  /** Le compte courant possède-t-il la tâche ? Gouverne trois blocs. */
  isTaskOwner: boolean;
  /** auth.uid du propriétaire — badge « Propriétaire » en vue destinataire. */
  ownerId?: string;
  collaborators: string[];
  displayInfo: (id: string) => { name: string; email?: string; avatar?: string; isPending: boolean };
  /** friend_ids en attente d'acceptation → badge « Envoyé ». */
  pendingShareIds: Set<string>;
  filteredFriends: Friend[];
  collabIdOf: (f: { id: string; userId?: string }) => string;
  emailInput: string;
  setEmailInput: (value: string) => void;
  inputError: string | null;
  onAddEmail: () => void;
  onRemoveCollaborator: (id: string) => void;
  onToggleCollaborator: (id: string) => void;
  taskId?: string;
  onGenerateShareLink: () => Promise<string | null>;
  /** Petit avatar rond, fourni par l'appelant (photo, emoji ou initiales). */
  renderAvatar: (name: string, avatar?: string) => React.ReactNode;
}

const MobileCollaboratorsSheet = ({
  open,
  onClose,
  isTaskOwner,
  ownerId,
  collaborators,
  displayInfo,
  pendingShareIds,
  filteredFriends,
  collabIdOf,
  emailInput,
  setEmailInput,
  inputError,
  onAddEmail,
  onRemoveCollaborator,
  onToggleCollaborator,
  taskId,
  onGenerateShareLink,
  renderAvatar,
}: MobileCollaboratorsSheetProps) => {
  const { t } = useT('taskModal');
  const { t: tCommon } = useT('common');

  return (
    <MobileActionSheet open={open} title={t('mobile.collaborators')} onClose={onClose} scrollable maxHeightClass="max-h-[80vh]">
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddEmail(); } }}
                placeholder={t('form.collaboratorPlaceholder')}
                className="w-full h-9 pl-9 pr-3 text-[15px] bg-[rgb(var(--color-hover))] rounded-xl focus:outline-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
              />
            </div>
            {/* `disabled:opacity-40` plutôt qu'un bleu Tailwind en
                dur (`bg-blue-300`) : ce dernier ignore le thème et
                rendait un carré bleu pâle décalé du reste de l'UI. */}
            <button
              type="button"
              onClick={onAddEmail}
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] pb-1">
            {isTaskOwner ? t('mobile.selected', { count: collaborators.length }) : t('mobile.participants')}
          </p>
          {collaborators.map((id) => {
            const info = displayInfo(id);
            const isSent = isTaskOwner && !info.isPending && pendingShareIds.has(id);
            return (
              <div key={id} className="flex items-center justify-between py-1.5 gap-2">
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  {renderAvatar(info.name, info.avatar)}
                  <span className="text-[14px] text-[rgb(var(--color-text-primary))] truncate">
                    {info.name}{!isTaskOwner && id === ownerId ? t('mobile.owner') : ''}
                  </span>
                </span>
                {isSent && (
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-caption font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{t('mobile.sent')}</span>
                )}
                {isTaskOwner && (
                  <button type="button" onClick={() => onRemoveCollaborator(id)} className="p-1 text-red-400" aria-label={tCommon('actions.remove')}><X size={14} /></button>
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
                key={friend.id} type="button" onClick={() => onToggleCollaborator(cId)}
                className="w-full flex items-center justify-between gap-2 py-2.5 border-b border-[rgb(var(--color-border))] last:border-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {renderAvatar(friend.name, friend.avatar)}
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
    </MobileActionSheet>
  );
};

export default MobileCollaboratorsSheet;
