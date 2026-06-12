// ═══════════════════════════════════════════════════════════════════
// DesktopCollaboratorsStep — Step 2 (collaborateurs) du wizard desktop
// ═══════════════════════════════════════════════════════════════════
//
// Extrait de TaskModalDesktopBody.tsx (split god component, track #6).
// Déplacement VERBATIM — props = Pick<DesktopBodyProps, …> : le type reste
// défini une seule fois côté parent, toute divergence casse tsc.
// Sections : gate premium → vue destinataire lecture seule → sélectionnés →
// input recherche/ajout → grille d'amis → demandes d'amis pending (mig. 036).
import React from 'react';
import { X, Search, UserPlus, Clock, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import CollaboratorItem from '@/components/CollaboratorItem';
import ShareLinkField from '@/components/ShareLinkField';
import type { DesktopBodyProps } from './TaskModalDesktopBody';

export type DesktopCollaboratorsStepProps = Pick<DesktopBodyProps,
  | 'collaboratorRef' | 'isTaskOwner' | 'task'
  | 'collaborators' | 'displayInfo' | 'pendingShareIds' | 'handleRemoveCollaborator'
  | 'emailInput' | 'setEmailInput' | 'inputError' | 'setInputError' | 'handleAddEmail'
  | 'filteredFriends' | 'collabIdOf' | 'toggleCollaborator'
  | 'sentRequests' | 'pendingInvitesLocal' | 'friends' | 'cancelFriendRequestMutation'
>;

const DesktopCollaboratorsStep: React.FC<DesktopCollaboratorsStepProps> = ({
  collaboratorRef, isTaskOwner, task,
  collaborators, displayInfo, pendingShareIds, handleRemoveCollaborator,
  emailInput, setEmailInput, inputError, setInputError, handleAddEmail,
  filteredFriends, collabIdOf, toggleCollaborator,
  sentRequests, pendingInvitesLocal, friends, cancelFriendRequestMutation,
}) => {
  return (
                <div className="space-y-5">

                    {/* Collaborators Section */}
                    <div>
                      <div className="flex items-center mb-3">
                        <label className="block text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Collaborateurs
                        </label>
                      </div>

                      <div ref={collaboratorRef}>
                        {!isTaskOwner ? (
                          /* Vue destinataire : participants en lecture seule.
                             Seul le propriétaire gère les collaborateurs. */
                          <div className="space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Cette tâche t'a été partagée. Seul le propriétaire peut gérer les collaborateurs.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {collaborators.map((id) => {
                                const info = displayInfo(id);
                                return (
                                  <CollaboratorItem
                                    key={id}
                                    id={id}
                                    name={info.name}
                                    email={info.email}
                                    avatar={info.avatar}
                                    onAction={() => {}}
                                    variant="remove"
                                    readOnly
                                    badge={id === task?.userId ? 'Propriétaire' : undefined}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Lien d'invitation copiable (Supabase only) */}
                            <ShareLinkField
                              taskId={task?.id}
                              ownerCanShare={isTaskOwner}
                              className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700"
                            />

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
                                        sentBadge={!info.isPending && pendingShareIds.has(userId)}
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
                              const seenEmails = new Set<string>();
                              const pendingContacts = sentRequests.filter(req => {
                                const email = req.email.toLowerCase();
                                // Dédoublonnage par email : la table friend_requests peut
                                // contenir plusieurs lignes pending pour le même destinataire
                                // (double-clic / retries). On n'affiche qu'une carte par email.
                                if (seenEmails.has(email)) return false;
                                const keep =
                                  !collaborators.includes(req.email) &&
                                  !pendingInvitesLocal.includes(req.email) &&
                                  !friends.some(f => f.email.toLowerCase() === email) &&
                                  (emailInput === '' || email.includes(emailInput.toLowerCase()));
                                if (keep) seenEmails.add(email);
                                return keep;
                              });
                              if (!pendingContacts.length) return null;
                              return (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                                    <Clock size={12} />
                                    Demandes d'amis en attente
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {pendingContacts.map(req => {
                                      // Partage possible avant acceptation (migration 036) dès que
                                      // le destinataire est inscrit (receiverId = son auth.uid).
                                      const canSelect = !!req.receiverId;
                                      const selected = canSelect && collaborators.includes(req.receiverId as string);
                                      return (
                                      <div
                                        key={req.id}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-colors ${selected ? 'border-blue-400/50 bg-blue-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}
                                      >
                                        <button
                                          type="button"
                                          disabled={!canSelect}
                                          onClick={() => canSelect && toggleCollaborator(req.receiverId as string)}
                                          className="flex items-center gap-2 flex-1 min-w-0 text-left disabled:cursor-default"
                                          aria-label={canSelect ? (selected ? `Retirer ${req.email}` : `Ajouter ${req.email} comme collaborateur`) : undefined}
                                          title={canSelect ? undefined : "Ce contact doit d'abord se connecter à Cosmo"}
                                        >
                                          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                                            <Clock size={12} className="text-amber-600 dark:text-amber-400" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">{req.email}</p>
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400">{selected ? 'Sera ajouté' : 'En attente'}</p>
                                          </div>
                                          {canSelect && (selected
                                            ? <Check size={15} className="text-blue-500 shrink-0" />
                                            : <Plus size={15} className="text-gray-400 shrink-0" />)}
                                        </button>
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
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>

                </div>
  );
};

export default DesktopCollaboratorsStep;
