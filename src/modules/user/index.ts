// ═══════════════════════════════════════════════════════════════════
// USER MODULE - Public API
// ═══════════════════════════════════════════════════════════════════
//
// Ce module a fondu le 2026-08-24. Il exposait `useUser`, `useMessages`,
// `useWatchAd` et `useUpdateUserSettings` : les trois premiers n'avaient
// AUCUN consommateur, et le quatrième écrivait dans `cosmo_user`, une clé que
// plus rien ne relisait depuis que `useAuth` est devenu la source de vérité du
// type `User`. Détail : docs/ARCHITECTURE.md §4 et faille.md (finding N6).
//
// Ce qui reste est ce qui sert :
//   • le type `User`, ré-exporté depuis sa source de vérité ;
//   • l'écriture-miroir de l'avatar dans `profiles`.
//
// L'identité de l'utilisateur se lit UNIQUEMENT via `useAuth()`.
// Le profil de la session démo se modifie via `useAuth().updateDemoProfile()`.

export type { User } from './types';

export { mirrorAvatarToProfile } from './profile.repository';
