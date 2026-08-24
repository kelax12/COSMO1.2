// ═══════════════════════════════════════════════════════════════════
// MESURE D'AUDIENCE — chargement borné aux visiteurs non connectés
//
// Le script de mesure (Vesk, sans cookie) était chargé par une balise statique
// dans `index.html`, donc sur TOUTE la SPA, session ouverte comprise. C'est le
// seul script tiers de l'origine, et `supabase.ts` monte le client en
// `persistSession: true` : le jeton de session vit dans le localStorage, où
// n'importe quel script de l'origine peut le lire. Si le fournisseur est
// compromis, c'est la prise de contrôle des comptes connectés — ni la RLS
// (l'attaquant agit AVEC le jeton de l'utilisateur) ni la CSP (l'origine est
// autorisée en script-src ET connect-src) n'y changent quoi que ce soit.
//
// Ce module ne charge donc le script QUE lorsqu'il n'y a rien à voler :
//   1. aucune session Supabase persistée, ET
//   2. on est sur une page publique.
//
// La valeur de la mesure est intacte : elle porte sur l'audience des pages
// publiques (landing, blog, guide, cas d'usage), pas sur l'usage authentifié,
// qui est déjà mesuré côté base par `get_admin_stats`.
//
// ⚠️ LIMITE ASSUMÉE : un visiteur qui se connecte SANS recharger la page garde
// le script déjà exécuté pour la durée de cet onglet. On ne peut pas décharger
// du JavaScript déjà évalué. Cette fenêtre est étroite (elle exclut tous les
// retours directs sur /dashboard, soit l'essentiel de l'usage connecté) mais
// elle existe : ne pas la présenter comme fermée.
// ═══════════════════════════════════════════════════════════════════

import { ALL_LOCALES } from '@/i18n/locale';

export const AUDIENCE_SCRIPT_SRC = 'https://www.vesk.dev/a.js';
export const AUDIENCE_SITE_KEY = '676bad26713b4578aa3e002fd59ebba7';

/**
 * Premiers segments des routes exigeant une session (cf. le bloc
 * `<Route element={<ProtectedRoute />}>` de `src/App.tsx`).
 *
 * Ce n'est PAS la frontière de sécurité — `ProtectedRoute` et la RLS le sont.
 * C'est une garde de défense en profondeur : même si la détection de session
 * échouait, le script ne serait pas monté sur un écran authentifié.
 */
export const AUTHENTICATED_SEGMENTS: readonly string[] = [
  'dashboard', 'tasks', 'agenda', 'habits', 'okr',
  'statistics', 'settings', 'entreprise', 'admin', 'premium',
];

/** Retire un éventuel préfixe de locale (`/en/tasks` → `/tasks`). */
export function stripLocale(pathname: string): string {
  const [, first = '', ...rest] = pathname.split('/');
  if ((ALL_LOCALES as readonly string[]).includes(first)) {
    return `/${rest.join('/')}`;
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

/** `true` si le chemin ne fait PAS partie de l'app authentifiée. */
export function isPublicPath(pathname: string): boolean {
  const segment = stripLocale(pathname).split('/')[1] ?? '';
  return !AUTHENTICATED_SEGMENTS.includes(segment);
}

/**
 * `true` si une session Supabase est persistée.
 *
 * Lecture SYNCHRONE des clés du localStorage plutôt que `getSession()`, qui
 * est asynchrone : la décision doit être prise avant le premier rendu, sinon
 * le script serait injecté puis « regretté ». La clé par défaut d'auth-js est
 * `sb-<ref>-auth-token` ; on ne lit jamais la VALEUR, seulement le nom.
 */
export function hasPersistedSession(storage: Pick<Storage, 'key' | 'length'>): boolean {
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && /^sb-.+-auth-token$/.test(key)) return true;
    }
  } catch {
    // Navigation privée stricte : on ne peut pas savoir → on suppose une
    // session, donc on ne charge pas. Se tromper dans ce sens coûte une
    // mesure manquante, pas une fuite.
    return true;
  }
  return false;
}

/** Décision complète : charge-t-on le script de mesure ? */
export function shouldLoadAudienceScript(input: {
  pathname: string;
  storage: Pick<Storage, 'key' | 'length'>;
}): boolean {
  return isPublicPath(input.pathname) && !hasPersistedSession(input.storage);
}

/**
 * Injecte le script si les conditions sont réunies. Retourne `true` s'il a été
 * monté. Idempotent : un second appel ne duplique pas la balise.
 */
export function mountAudienceScript(
  doc: Document,
  input: { pathname: string; storage: Pick<Storage, 'key' | 'length'> },
): boolean {
  if (!shouldLoadAudienceScript(input)) return false;
  if (doc.querySelector(`script[src="${AUDIENCE_SCRIPT_SRC}"]`)) return false;

  const script = doc.createElement('script');
  script.src = AUDIENCE_SCRIPT_SRC;
  script.async = true;
  script.dataset.key = AUDIENCE_SITE_KEY;
  doc.head.appendChild(script);
  return true;
}
