// ═══════════════════════════════════════════════════════════════════
// CONSENTEMENT AUX TRACEURS — source de vérité unique
//
// Avant ce module, `CookieBanner` écrivait `cosmo_cookie_consent` dans le
// localStorage et PERSONNE ne le lisait. Le bandeau proposait donc un choix
// qu'aucune ligne de code n'appliquait : refuser ne changeait rien, la mesure
// d'audience et Vercel Analytics se chargeaient dans les deux cas.
//
// C'est plus grave que de ne pas avoir de bandeau du tout. Un bandeau qui
// n'applique rien est une information trompeuse sur le traitement, en plus du
// manquement à l'article 82 de la loi Informatique et Libertés.
//
// ── POURQUOI UN STORE ET PAS UN `localStorage.getItem` PAR APPELANT ──
//
// Trois surfaces distinctes doivent réagir au MÊME état, dont deux montées
// avant que l'utilisateur ne réponde :
//   1. le script de mesure d'audience, injecté hors React (`src/main.tsx`) ;
//   2. `<Analytics />` de Vercel, monté dans l'arbre React (`src/App.tsx`) ;
//   3. le bandeau lui-même, qui doit disparaître une fois la réponse donnée.
//
// Une lecture ponctuelle du localStorage suffirait pour (1) au démarrage, mais
// pas au moment où l'utilisateur ACCEPTE : il faut alors monter ce qui ne
// l'avait pas été, sans rechargement. D'où `subscribe` + `useSyncExternalStore`,
// le même patron que `appModeStore`.
//
// ❌ Ne jamais lire `cosmo_cookie_consent` directement ailleurs : c'est
//    exactement la dispersion qui a permis au bandeau de mentir.
// ❌ Ne jamais traiter `null` comme un refus implicite POUR L'AFFICHAGE du
//    bandeau, ni comme une acceptation implicite POUR LE CHARGEMENT. Tant que
//    la réponse n'est pas donnée : on demande, et on ne charge rien.
// ═══════════════════════════════════════════════════════════════════

/** `null` = l'utilisateur n'a pas encore répondu. */
export type CookieConsent = 'accepted' | 'refused' | null;

export const COOKIE_CONSENT_KEY = 'cosmo_cookie_consent';

/**
 * Date (ms epoch) de la réponse. Un choix ne vaut pas pour toujours : la CNIL
 * recommande de redemander au bout de six mois (lignes directrices 2020).
 *
 * ⚠️ Une réponse SANS date (enregistrée avant 2026-09-24, ou posée par un test
 * e2e) reste valable : `stampLegacyConsent` lui donne une date au prochain
 * passage du bandeau, ce qui démarre son horloge de six mois.
 */
export const COOKIE_CONSENT_AT_KEY = 'cosmo_cookie_consent_at';
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;

type Listener = () => void;
const listeners = new Set<Listener>();
const reviewListeners = new Set<Listener>();

/**
 * Lecture brute, tolérante à un localStorage inaccessible.
 *
 * En navigation privée stricte, l'accès jette. On renvoie alors `null`, ce qui
 * signifie « pas de réponse » : le bandeau s'affiche et rien ne se charge.
 * Se tromper dans ce sens coûte une mesure manquante, jamais un traceur posé
 * sans consentement.
 */
export function readConsent(
  storage?: Pick<Storage, 'getItem'>,
  now: number = Date.now(),
): CookieConsent {
  try {
    const store = storage ?? window.localStorage;
    const raw = store.getItem(COOKIE_CONSENT_KEY);
    if (raw !== 'accepted' && raw !== 'refused') return null;
    const at = Number(store.getItem(COOKIE_CONSENT_AT_KEY));
    // Réponse expirée : on redemande, et rien ne se charge d'ici là.
    if (Number.isFinite(at) && at > 0 && now - at > CONSENT_MAX_AGE_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Date une réponse enregistrée avant l'expiration (cf. `COOKIE_CONSENT_AT_KEY`). */
export function stampLegacyConsent(now: number = Date.now()): void {
  try {
    if (readConsent() !== null && !window.localStorage.getItem(COOKIE_CONSENT_AT_KEY)) {
      window.localStorage.setItem(COOKIE_CONSENT_AT_KEY, String(now));
    }
  } catch { /* stockage indisponible : rien à dater */ }
}

/**
 * Rouvre le bandeau pour revenir sur un choix déjà fait.
 *
 * 🔴 RGPD art. 7.3 : retirer son consentement doit être aussi simple que le
 * donner. Avant ce point d'entrée, la seule façon de revenir sur « Accepter »
 * était d'effacer les données du site, ce que la politique osait écrire.
 * Appelé par le lien « Gérer les cookies » (footer, Paramètres, politique).
 */
export function requestConsentReview(): void {
  for (const listener of reviewListeners) listener();
}

export function subscribeConsentReview(listener: Listener): () => void {
  reviewListeners.add(listener);
  return () => {
    reviewListeners.delete(listener);
  };
}

/** `true` seulement si l'utilisateur a explicitement accepté. */
export function hasConsented(storage?: Pick<Storage, 'getItem'>): boolean {
  return readConsent(storage) === 'accepted';
}

/** Enregistre la réponse et réveille les trois surfaces. */
export function setConsent(value: Exclude<CookieConsent, null>): void {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
    window.localStorage.setItem(COOKIE_CONSENT_AT_KEY, String(Date.now()));
  } catch {
    // Stockage indisponible : la décision ne survivra pas au rechargement,
    // mais elle doit valoir pour la session en cours. On notifie quand même.
  }
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): CookieConsent {
  return readConsent();
}
