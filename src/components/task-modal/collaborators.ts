// Helpers purs d'identité/affichage des collaborateurs de TaskModal — extraits
// pour être testables indépendamment du composant. Comportement déplacé verbatim
// depuis TaskModal.tsx (aucun durcissement).

export interface FriendLike {
  id: string;
  userId?: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export interface SentRequestLike {
  id: string;
  email: string;
  receiverId?: string;
}

export interface CollaboratorDisplay {
  name: string;
  email?: string;
  avatar?: string;
  isPending: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A friend's canonical "collaborator id" is their auth.users.id (userId),
// which is what Supabase RLS (auth.uid()::text = ANY(collaborators)) and
// the shared_tasks.friend_id FK require. Falls back to friend.id in demo
// mode where there's no auth.
export const collabIdOf = (f: { id: string; userId?: string }): string => f.userId ?? f.id;

// Un ami est « déjà collaborateur » si l'une de ses identités (auth.uid,
// id de ligne friends, ou email) figure dans `collaborators`. Robuste aux
// partages historiques stockés sous l'id de ligne plutôt que l'auth.uid, et
// aux cas où l'enrichissement `userId` n'a pas (encore) résolu l'auth.uid.
export const isAlreadyCollaborator = (
  f: { id: string; userId?: string; email?: string },
  collaborators: string[]
): boolean =>
  collaborators.includes(collabIdOf(f)) ||
  collaborators.includes(f.id) ||
  (!!f.userId && collaborators.includes(f.userId)) ||
  (!!f.email && collaborators.includes(f.email));

// Liste des amis sélectionnables : pas déjà collaborateurs et matchant la
// recherche (nom ou email).
export function filterFriendsForCollab<T extends FriendLike>(
  friends: T[] | undefined,
  collaborators: string[],
  emailInput: string
): T[] {
  const availableFriends = friends || [];
  const q = emailInput.toLowerCase();
  return availableFriends.filter(
    (friend) =>
      !isAlreadyCollaborator(friend, collaborators) &&
      (emailInput === '' ||
        (friend.name?.toLowerCase().includes(q) ?? false) ||
        (friend.email?.toLowerCase().includes(q) ?? false))
  );
}

// Résout les infos d'affichage d'un collaborateur depuis son id (auth.uid,
// id de ligne friends, email d'invitation, ou nom).
export function resolveCollaboratorDisplay(
  id: string,
  deps: {
    friends?: FriendLike[];
    sentRequests: SentRequestLike[];
    pendingInvitesLocal: string[];
  }
): CollaboratorDisplay {
  const { friends, sentRequests, pendingInvitesLocal } = deps;
  const friend = friends?.find((f) => collabIdOf(f) === id || f.id === id || f.name === id);
  if (friend) {
    return { name: friend.name ?? id, email: friend.email, avatar: friend.avatar, isPending: false };
  }
  // Collaborateur sélectionné via une demande d'ami en attente (id = receiverId
  // / auth.uid) : retrouver son email pour ne pas afficher un UUID brut.
  const sent = sentRequests.find((r) => r.receiverId === id);
  if (sent) {
    return { name: sent.email, email: sent.email, avatar: undefined, isPending: true };
  }
  const isPending = pendingInvitesLocal.includes(id);
  if (EMAIL_REGEX.test(id)) {
    return { name: id, email: id, avatar: undefined, isPending };
  }
  // Garde-fou : un id non résolu qui ressemble à un UUID (auth.users.id) ne
  // doit JAMAIS s'afficher brut à la place d'un pseudo. Cela arrive si la
  // résolution friend_id → ami échoue (ex. ami non enrichi, ou partage dont
  // le destinataire ouvre la tâche). On affiche un libellé générique.
  if (UUID_REGEX.test(id)) {
    return { name: 'Collaborateur', email: undefined, avatar: undefined, isPending };
  }
  return { name: id, email: undefined, avatar: undefined, isPending };
}
