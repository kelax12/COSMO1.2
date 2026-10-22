// ═══════════════════════════════════════════════════════════════════
// UN RETOUR OAUTH QUI N'ARRIVE PAS OÙ ON L'AVAIT ENVOYÉ (C-45)
// ═══════════════════════════════════════════════════════════════════
//
// `loginWithGoogle` demande à GoTrue un `redirectTo` complet : préfixe de
// locale + destination validée par `postAuthRoute` (le `?redirect=` d'une
// invitation d'entreprise, garde R-04).
//
// 🔴 GoTrue n'honore cette valeur QUE si elle est couverte par la « Redirect
//    URL allow list » du projet Supabase. Sinon il ne refuse pas : il
//    **substitue silencieusement le Site URL**. La connexion Google réussit,
//    l'utilisateur atterrit sur `/dashboard` en français, son jeton
//    d'invitation à usage unique n'est jamais consommé, et RIEN, ni côté
//    client ni côté console, ne dit que la destination a été perdue. C'est
//    exactement le symptôme d'AVANT le correctif, avec le correctif en place.
//
// On ne peut pas lire l'allow list depuis le client. Ce qu'on peut faire,
// c'est mémoriser la destination demandée avant de partir chez Google, puis
// la comparer à l'atterrissage réel. Un écart = le réglage n'est pas posé.
//
// ❌ Ne jamais « rattraper » l'écart en renavigant vers la destination
//    demandée. Ça remettrait exactement la panne dans le silence d'où on
//    vient de la sortir : le réglage resterait faux, et le premier chemin qui
//    ne passe pas par ce rattrapage (un lien d'email, un autre fournisseur)
//    reperdrait la destination sans que personne ne le sache. La panne est
//    dans la console Supabase, elle se corrige là-bas.

import * as monitoring from '@/lib/monitoring';

/** Clé de `sessionStorage` : l'intention ne survit ni à l'onglet ni au partage. */
export const OAUTH_INTENT_KEY = 'cosmo_oauth_redirect_intent';

/**
 * Au-delà de ce délai, une intention en attente ne décrit plus le retour
 * qu'on observe : quelqu'un a pu abandonner l'écran Google, revenir en
 * arrière, puis se connecter autrement une demi-heure plus tard. On préfère
 * ne rien dire à dire quelque chose de faux.
 */
export const OAUTH_INTENT_TTL_MS = 10 * 60 * 1000;

export type OAuthRedirectIntent = {
  /** URL absolue passée à `signInWithOAuth` comme `redirectTo`. */
  url: string;
  /** Horodatage d'émission (ms epoch). */
  at: number;
};

export type OAuthLandingMismatch = {
  /** Destination demandée, chemin caviardé. */
  expected: string;
  /** Destination réellement servie, chemin caviardé. */
  actual: string;
};

/**
 * Caviarde les segments qui ressemblent à un secret.
 *
 * Le chemin qu'on compare porte précisément le jeton d'invitation à usage
 * unique (`/org-invite/<token>`) : il ne part ni dans Sentry ni dans un log.
 */
export function redactOAuthPath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (/^[A-Za-z0-9_-]{16,}$/.test(segment) ? ':token' : segment))
    .join('/');
}

/** `origin + pathname` sans slash final, ou `null` si l'URL est inanalysable. */
function normalize(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${path}`;
  } catch {
    return null;
  }
}

/** Mémorise la destination demandée, juste avant de partir chez le fournisseur. */
export function recordOAuthRedirectIntent(url: string, now: number = Date.now()): void {
  try {
    sessionStorage.setItem(OAUTH_INTENT_KEY, JSON.stringify({ url, at: now } satisfies OAuthRedirectIntent));
  } catch {
    /* stockage indisponible (navigation privée, webview) : on perd la sonde,
       jamais la connexion. */
  }
}

/** Oublie l'intention en attente (départ OAuth avorté, ou intention consommée). */
export function clearOAuthRedirectIntent(): void {
  try {
    sessionStorage.removeItem(OAUTH_INTENT_KEY);
  } catch {
    /* idem */
  }
}

/** Lit l'intention en attente. `null` si absente, illisible ou malformée. */
export function readOAuthRedirectIntent(): OAuthRedirectIntent | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(OAUTH_INTENT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { url, at } = parsed as Partial<OAuthRedirectIntent>;
    if (typeof url !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return null;
    return { url, at };
  } catch {
    return null;
  }
}

/**
 * Fonction PURE : compare une intention à l'URL d'atterrissage.
 *
 * Rend `null` quand il n'y a rien à dire (pas d'intention, intention périmée,
 * URL inanalysable, atterrissage conforme), et l'écart sinon. La query string
 * et le fragment sont ignorés : GoTrue y ajoute ses propres paramètres
 * (`?code=`, `#access_token=`), ils ne décrivent pas la destination.
 */
export function compareOAuthLanding(
  intent: OAuthRedirectIntent | null,
  href: string,
  now: number = Date.now(),
): OAuthLandingMismatch | null {
  if (!intent) return null;
  if (now - intent.at > OAUTH_INTENT_TTL_MS) return null;
  const expected = normalize(intent.url);
  const actual = normalize(href);
  if (!expected || !actual) return null;
  if (expected === actual) return null;
  return {
    expected: redactOAuthPath(expected),
    actual: redactOAuthPath(actual),
  };
}

/**
 * Consomme l'intention en attente et rend l'écart s'il y en a un.
 *
 * Consomme dans TOUS les cas : la sonde ne vaut que pour le retour qui suit
 * immédiatement le départ, et une intention qui traîne finirait par accuser
 * une navigation qui n'a rien à voir.
 */
export function consumeOAuthLandingMismatch(
  href: string,
  now: number = Date.now(),
): OAuthLandingMismatch | null {
  const intent = readOAuthRedirectIntent();
  if (!intent) return null;
  clearOAuthRedirectIntent();
  return compareOAuthLanding(intent, href, now);
}

/**
 * Consomme l'intention, et si l'atterrissage ne correspond pas, le DIT :
 * console (dropée en build prod) et Sentry (le seul signal qui survit en
 * production). L'appelant décide de ce qu'il montre à l'utilisateur.
 */
export function reportOAuthLandingMismatch(
  href: string,
  now: number = Date.now(),
): OAuthLandingMismatch | null {
  const mismatch = consumeOAuthLandingMismatch(href, now);
  if (!mismatch) return null;
  console.error(
    '[auth] retour OAuth servi ailleurs que sur le redirectTo demande.',
    `demande=${mismatch.expected}`,
    `servi=${mismatch.actual}`,
    'Cause la plus probable : la Redirect URL allow list du projet Supabase ne couvre pas cette destination.',
  );
  monitoring.captureMessage('OAuth landing does not match requested redirectTo', {
    level: 'warning',
    tags: { context: 'oauth-redirect-allowlist' },
    extra: { expected: mismatch.expected, actual: mismatch.actual },
  });
  return mismatch;
}
