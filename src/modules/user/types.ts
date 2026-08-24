// Re-export du type User depuis la source de vérité (AuthContext).
// Ne JAMAIS le redéfinir ici : deux définitions divergent au premier champ
// ajouté d'un seul côté.
export type { User } from '@/modules/auth/AuthContext';
