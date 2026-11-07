// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import { Friend, PendingFriendRequest, SharedListGrant } from './types';
import { isEnglishSeed } from '@/lib/seed-i18n';

/** Id de l'utilisateur démo — utilisé pour distinguer partages entrants/sortants. */
export const DEMO_USER_ID = 'demo-user';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

export const DEMO_FRIENDS: Friend[] = [
  { id: 'friend-1', name: 'Marie Dupont', email: 'marie.dupont@email.com' },
  { id: 'friend-2', name: 'Jean Martin', email: 'jean.martin@email.com' },
  { id: 'friend-3', name: 'Sophie Bernard', email: 'sophie.bernard@email.com' },
];

export const DEMO_INCOMING_REQUESTS: PendingFriendRequest[] = [
  {
    id: 'req-demo-1',
    email: 'demo@cosmo.app',
    status: 'pending',
    sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    senderId: 'user-lucas',
    senderEmail: 'lucas.moreau@email.com',
    senderName: 'Lucas Moreau',
  },
  {
    id: 'req-demo-2',
    email: 'demo@cosmo.app',
    status: 'pending',
    sentAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    senderId: 'user-camille',
    senderEmail: 'camille.richard@email.com',
    senderName: 'Camille Richard',
  },
];

// Listes partagées entrantes seedées pour la démo — le destinataire est
// l'utilisateur démo (friendId = DEMO_USER_ID), non encore acceptées.
export const DEMO_INCOMING_SHARED_LISTS: SharedListGrant[] = [
  {
    id: 'shared-list-demo-1',
    listId: 'list-marie-courses',
    name: 'Courses du week-end',
    color: 'green',
    sharedBy: 'friend-1',
    sharedByName: 'Marie Dupont',
    friendId: DEMO_USER_ID,
    accepted: false,
    tasks: [
      { name: 'Fruits & légumes', priority: 3, category: 'Personnel', deadline: '', estimatedTime: 15, bookmarked: false, completed: false },
      { name: 'Pain & viennoiseries', priority: 3, category: 'Personnel', deadline: '', estimatedTime: 10, bookmarked: false, completed: false },
      { name: 'Produits ménagers', priority: 4, category: 'Personnel', deadline: '', estimatedTime: 10, bookmarked: false, completed: false },
    ],
  },
];

/**
 * Overlay anglais de la liste partagée entrante — cf. src/lib/seed-i18n.ts.
 * Les noms de personnes (`sharedByName`) ne sont PAS traduits : un nom propre
 * n'est pas une langue.
 */
export function localizeIncomingSharedLists(lists: SharedListGrant[]): SharedListGrant[] {
  if (!isEnglishSeed()) return lists;
  return lists.map((list) => {
    if (list.id !== 'shared-list-demo-1') return list;
    return {
      ...list,
      name: 'Weekend groceries',
      tasks: [
        { ...list.tasks[0], name: 'Fruits & vegetables', category: 'Personal' },
        { ...list.tasks[1], name: 'Bread & pastries', category: 'Personal' },
        { ...list.tasks[2], name: 'Household supplies', category: 'Personal' },
      ],
    };
  });
}
