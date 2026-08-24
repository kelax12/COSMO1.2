// ═══════════════════════════════════════════════════════════════════
// Profil de la session DÉMO — lecture, filtrage, construction
//
// FAILLE B7, DEUXIÈME OCCURRENCE (trouvée le 2026-08-24)
// En démo, la page Réglages écrivait le nom / l'email / l'avatar dans
// `cosmo_user` via `useUpdateUserSettings` — une clé que RIEN ne relisait
// depuis que `useAuth` est devenu la source de vérité unique du type `User`.
// L'écran affichait « Profil mis à jour » et ne changeait rien, ni tout de
// suite, ni après rechargement. Le commentaire du code affirmait pourtant
// « persist to the same source the UI reads from » : la phrase était vraie
// quand elle a été écrite, et fausse depuis.
//
// La correction remet la mutation là où vit la vérité (AuthContext) plutôt
// que d'ajouter un second lecteur de localStorage. Ce fichier n'en porte que
// la partie PURE, pour qu'elle soit testable sans monter un provider — et
// pour ne pas faire grossir un AuthContext déjà au-dessus de 600 lignes.
//
// La clé est balayée par `clearDemoStorage()` (sweep générique sur `cosmo_`) :
// relancer la démo repart d'un profil neuf, ce qui est voulu.
// ═══════════════════════════════════════════════════════════════════

import type { User } from './AuthContext';

/**
 * Email sentinelle réservé à la session démo locale. Bloqué à l'inscription
 * pour qu'un attaquant ne puisse pas enregistrer un vrai compte Supabase avec
 * cette adresse (faille B0).
 */
export const DEMO_SENTINEL_EMAIL = 'demo@cosmo.app';

export const DEMO_PROFILE_KEY = 'cosmo_demo_profile';

/** Champs qu'un visiteur de la démo peut modifier sur son propre profil. */
export type DemoProfilePatch = Partial<
  Pick<User, 'name' | 'email' | 'avatar' | 'autoValidation'>
>;

export const DEMO_PROFILE_FIELDS = ['name', 'email', 'avatar', 'autoValidation'] as const;

/**
 * Ne garde d'un objet que les champs modifiables.
 *
 * Utilise `in` et non un test de véracité : retirer sa photo se dit
 * `{ avatar: undefined }`, qu'un `if (patch[field])` écarterait — l'avatar
 * resterait alors affiché après une suppression confirmée.
 */
export function pickDemoProfileFields(source: Record<string, unknown>): DemoProfilePatch {
  const safe: DemoProfilePatch = {};
  for (const field of DEMO_PROFILE_FIELDS) {
    if (field in source) (safe as Record<string, unknown>)[field] = source[field];
  }
  return safe;
}

/**
 * Lit le patch de profil démo persisté.
 *
 * Le filtrage est refait à la LECTURE, pas seulement à l'écriture : la valeur
 * vient de localStorage, donc d'une source que l'utilisateur peut éditer. Sans
 * ce filtre, un `{"id":"..."}` posé à la main dans les devtools écraserait
 * l'identité démo — or `demo-user` est la clé sous laquelle les seeds sont
 * rangés. Renvoie `{}` sur JSON corrompu (faille B14).
 */
export function readDemoProfile(): DemoProfilePatch {
  try {
    const raw = localStorage.getItem(DEMO_PROFILE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return pickDemoProfileFields(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** L'utilisateur démo canonique, augmenté du patch local s'il existe. */
export function buildDemoUser(): User {
  return {
    id: 'demo-user',
    name: 'Utilisateur Démo',
    email: DEMO_SENTINEL_EMAIL,
    ...readDemoProfile(),
  };
}

/**
 * Fusionne un patch dans le profil démo persisté et renvoie la partie
 * réellement appliquée (`null` si le patch ne portait aucun champ modifiable,
 * auquel cas l'appelant n'a pas à toucher à l'état React).
 */
export function persistDemoProfile(patch: DemoProfilePatch): DemoProfilePatch | null {
  const safe = pickDemoProfileFields(patch as Record<string, unknown>);
  if (Object.keys(safe).length === 0) return null;

  try {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ ...readDemoProfile(), ...safe }));
  } catch {
    // Quota dépassé ou stockage refusé (navigation privée). On n'empêche pas
    // la mise à jour d'écran pour autant : elle vaut au moins pour la session.
  }
  return safe;
}
