// ═══════════════════════════════════════════════════════════════════
// Qui travaille sur cette tâche
//
// FRONTIÈRE : ce hook ne connaît ni le formulaire de la tâche, ni ses listes,
// ni ses OKR, ni ses étapes. Il porte une seule question — qui d'autre voit
// cette tâche — et tout ce qui va avec : les amis, les partages déjà
// accordés, les invitations envoyées par email, et les quatre gestes qui les
// modifient.
//
// 🔴 Trois règles vivent ici, et se perdraient si on les séparait :
//
//   • `shared_tasks` est la SOURCE DE VÉRITÉ du partage. La colonne
//     `tasks.collaborators` n'existe plus (mig. 028) : l'état affiché est
//     dérivé des grants, jamais d'un champ de la tâche.
//   • Tant que `collaboratorsDirty` est faux, la liste se resynchronise
//     depuis les grants — et la sauvegarde NE TOUCHE À AUCUN partage. Sans
//     ça, une course entre le chargement asynchrone des grants et une
//     édition d'un autre champ désassignait des collaborateurs.
//   • Aucun geste n'écrit tout de suite. Tout est différé à la sauvegarde :
//     une mutation immédiate invaliderait le cache, ferait revenir la prop
//     `task`, remettrait `hasChanges` à faux, et désactiverait le bouton
//     « Sauvegarder » sous les doigts de la personne.
//
// La seule EXCEPTION est la promotion automatique : une invitation par email
// devient un vrai partage dès que la personne accepte l'amitié. Elle écrit
// tout de suite parce qu'elle ne répond à aucune saisie en cours — c'est un
// rattrapage, pas une édition.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Task } from '@/modules/tasks';
import {
  useFriends,
  useSentFriendRequests,
  useShareTask,
  useUnshareTask,
  useSendFriendRequest,
  useCancelFriendRequest,
  useTaskShares,
} from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';
import { collabIdOf, filterFriendsForCollab, resolveCollaboratorDisplay } from './collaborators';

interface Params {
  /** Tâche en cours d'édition (ou créée à la volée) — `undefined` en création. */
  effectiveTask: Task | undefined;
  /** Prop d'origine : `undefined` tant que la tâche n'est pas persistée. */
  task?: Task;
  isOpen: boolean;
  isCreating: boolean;
  showCollaborators: boolean;
  /** Persiste `pendingInvites` après une promotion automatique. */
  updateTask: (id: string, updates: { pendingInvites: string[] }) => void;
}

export function useTaskCollaborators({
  effectiveTask,
  task,
  isOpen,
  isCreating,
  showCollaborators,
  updateTask,
}: Params) {
  const { user } = useAuth();
  const { data: friends = [] } = useFriends();
  const { data: sentRequests = [] } = useSentFriendRequests();
  const shareTaskMutation = useShareTask();
  const unshareTaskMutation = useUnshareTask();
  const sendFriendRequestMutation = useSendFriendRequest();
  // ANNULATION par l expediteur : useCancelFriendRequest (status cancelled).
  // useRejectFriendRequest ecrit rejected, reserve au destinataire par la RLS.
  const cancelFriendRequestMutation = useCancelFriendRequest();

  // Propriétaire de la tâche : seul lui peut gérer les collaborateurs (la policy
  // RLS shared_tasks_insert exige auth.uid() = shared_by + propriété de la tâche).
  // Pour une nouvelle tâche, l'utilisateur courant est forcément propriétaire.
  // Pour une tâche reçue, `task.userId` = auth.uid du partageur ≠ moi.
  const isTaskOwner = !effectiveTask?.userId || effectiveTask.userId === user?.id;

  // shared_tasks est la source de vérité du partage (colonne `tasks.collaborators`
  // supprimée — migration 028). On dérive l'état « assignés » des grants.
  const { data: shares = [] } = useTaskShares(effectiveTask?.id);
  const existingShareIds = useMemo(() => shares.map((s) => s.friendId), [shares]);
  // friend_ids des collaborateurs n'ayant pas encore accepté → badge « Envoyé ».
  const pendingShareIds = useMemo(
    () => new Set(shares.filter((s) => !s.accepted).map((s) => s.friendId)),
    [shares]
  );
  const existingCollaboratorIds = useMemo(
    () => [...existingShareIds, ...(effectiveTask?.pendingInvites || [])],
    [existingShareIds, effectiveTask?.pendingInvites]
  );

  // Liste des collaborateurs à afficher selon le point de vue :
  //  - propriétaire → les destinataires (existingCollaboratorIds)
  //  - destinataire → le propriétaire (task.userId) + co-destinataires lisibles,
  //    en s'excluant soi-même (lecture seule).
  const seedCollaboratorIds = useMemo(() => {
    if (isTaskOwner) return existingCollaboratorIds;
    const ids = new Set<string>();
    if (effectiveTask?.userId && effectiveTask.userId !== user?.id) ids.add(effectiveTask.userId);
    existingShareIds.forEach((id) => { if (id !== user?.id) ids.add(id); });
    return [...ids];
  }, [isTaskOwner, existingCollaboratorIds, existingShareIds, effectiveTask?.userId, user?.id]);

  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collaboratorsDirty, setCollaboratorsDirty] = useState(false);
  const [pendingInvitesLocal, setPendingInvitesLocal] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showCollaboratorSection, setShowCollaboratorSection] = useState(showCollaborators);
  const autoPromoteDoneRef = useRef<Set<string>>(new Set());

  // Re-synchronisation depuis les grants tant que l'utilisateur n'a rien touché.
  useEffect(() => {
    if (!isOpen || !task || isCreating || collaboratorsDirty) return;
    setCollaborators(seedCollaboratorIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, isCreating, collaboratorsDirty, seedCollaboratorIds.join(',')]);

  // Auto-promote pending invites that have since become friends
  useEffect(() => {
    if (!isOpen || !task || isCreating || !friends.length) return;
    const pending = task.pendingInvites ?? [];
    if (!pending.length) return;

    const toPromote = pending.filter((email) => {
      const key = `${task.id}:${email}`;
      if (autoPromoteDoneRef.current.has(key)) return false;
      return friends.some((f) => f.email.toLowerCase() === email.toLowerCase());
    });
    if (!toPromote.length) return;

    toPromote.forEach((email) => autoPromoteDoneRef.current.add(`${task.id}:${email}`));

    const promotedNames: string[] = [];
    toPromote.forEach((email) => {
      const friend = friends.find((f) => f.email.toLowerCase() === email.toLowerCase());
      if (!friend) return;
      promotedNames.push(friend.name);
      // Le partage réel = ligne shared_tasks. Plus de colonne `collaborators`.
      shareTaskMutation.mutate({
        taskId: task.id,
        friendId: friend.userId ?? friend.id,
        friendEmail: friend.email,
        role: 'editor',
      });
    });

    const newPendingEmails = new Set(toPromote.map((e) => e.toLowerCase()));
    updateTask(task.id, { pendingInvites: pending.filter((e) => !newPendingEmails.has(e.toLowerCase())) });
    toast.success(`🎉 ${promotedNames.join(', ')} ${promotedNames.length > 1 ? 'ont rejoint' : 'a rejoint'} la tâche !`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, friends.length]);

  // Helpers d'identité/affichage des collaborateurs — logique pure extraite
  // dans task-modal/collaborators.ts (testée). On lie ici les dépendances d'état.
  const filteredFriends = filterFriendsForCollab(friends, collaborators, emailInput);
  const displayInfo = (id: string) =>
    resolveCollaboratorDisplay(id, {
      friends, sentRequests, pendingInvitesLocal,
      // Vue destinataire : afficher le nom du propriétaire (task.sharedBy) au
      // lieu du libellé générique « Collaborateur ».
      ownerId: effectiveTask?.userId,
      ownerName: effectiveTask?.sharedBy,
    });

  const handleAddEmail = () => {
    const value = emailInput.trim().toLowerCase();
    if (!value) return;

    const friend = friends.find((f) => f.email.toLowerCase() === value);

    if (friend) {
      // Store the friend's auth.uid (via userId) so RLS / shared_tasks FK
      // accept it. Falls back to friend.id in demo mode.
      const collabId = collabIdOf(friend);
      if (!collaborators.includes(collabId)) {
        setCollaborators([...collaborators, collabId]);
        setCollaboratorsDirty(true);
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
      setCollaboratorsDirty(true);
      setPendingInvitesLocal([...pendingInvitesLocal, value]);
      // Aucune écriture immédiate — différée à la sauvegarde (cf. en-tête).
    }
    setEmailInput('');
    setInputError(null);
  };

  const handleRemoveCollaborator = (collaboratorName: string) => {
    setCollaborators((prev) => prev.filter((c) => c !== collaboratorName));
    setCollaboratorsDirty(true);
    setPendingInvitesLocal((prev) => prev.filter((e) => e !== collaboratorName));
    // Aucune écriture immédiate — différée à la sauvegarde (cf. en-tête).
  };

  const toggleCollaborator = (collabId: string) => {
    // `collabId` is the friend's auth.users.id (or friend.id in demo).
    if (collaborators.includes(collabId)) {
      handleRemoveCollaborator(collabId);
    } else {
      setCollaborators((prev) => [...prev, collabId]);
      setCollaboratorsDirty(true);
    }
  };

  /**
   * Remet la section à zéro : à l'ouverture en CRÉATION, et après une création
   * enchaînée (le modal reste ouvert pour la tâche suivante).
   */
  const resetCollaborators = () => {
    setCollaborators([]);
    setCollaboratorsDirty(false);
    setPendingInvitesLocal([]);
    setShowCollaboratorSection(showCollaborators);
  };

  /**
   * Amorce la section à l'ouverture d'une tâche EXISTANTE. La section
   * s'ouvre d'office si la tâche a déjà des collaborateurs : la refermer
   * masquerait une information que la personne n'a pas demandé à cacher.
   */
  const seedCollaboratorsForTask = (openedTask: Task) => {
    setCollaborators(existingCollaboratorIds);
    setCollaboratorsDirty(false);
    setPendingInvitesLocal(openedTask.pendingInvites || []);
    setShowCollaboratorSection(showCollaborators || existingCollaboratorIds.length > 0);
  };

  return {
    friends,
    sentRequests,
    isTaskOwner,
    existingShareIds,
    pendingShareIds,
    seedCollaboratorIds,
    collaborators,
    setCollaborators,
    collaboratorsDirty,
    pendingInvitesLocal,
    emailInput,
    setEmailInput,
    inputError,
    setInputError,
    showCollaboratorSection,
    setShowCollaboratorSection,
    filteredFriends,
    displayInfo,
    handleAddEmail,
    handleRemoveCollaborator,
    toggleCollaborator,
    resetCollaborators,
    seedCollaboratorsForTask,
    shareTaskMutation,
    unshareTaskMutation,
    cancelFriendRequestMutation,
  };
}
