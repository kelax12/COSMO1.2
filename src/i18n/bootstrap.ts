// Amorçage du routeur localisé — calculé UNE fois, avant le premier rendu.
//
// ─── Pourquoi `basename` et pas `<Route path=":lang">` ───
//
// L'app compte 162 usages de `Link` / `useNavigate` / `Navigate` répartis sur
// 47 fichiers, tous en chemins ABSOLUS (`to="/tasks"`). Avec un segment de
// route `:lang`, chacun de ces appels aurait dû être réécrit pour reporter le
// préfixe — 47 fichiers à migrer à la main, et un seul oubli fait retomber
// silencieusement l'utilisateur en français.
//
// `basename` est le mécanisme prévu par React Router pour exactement ça :
//   - `<Link to="/tasks">` résout vers `/en/tasks` sans modification ;
//   - `useLocation().pathname` renvoie le chemin SANS le préfixe, donc
//     `RESUMABLE_PAGES` (src/App.tsx) continue de fonctionner tel quel ;
//   - zéro fichier de navigation à toucher, donc zéro régression possible.
//
// Contrepartie assumée : `basename` est figé au montage, donc changer de langue
// exige un rechargement complet (cf. `switchLocale`). C'est préférable — un
// rechargement garantit que `<html lang>`, les catalogues et les locales
// `date-fns` sont tous cohérents, là où une bascule à chaud laisserait des
// composants montés avec l'ancienne langue.
//
// ─── Invariant central ───
//
// **La locale est une fonction pure de l'URL finale.** Pas de préfixe ⇒ locale
// par défaut, toujours. La préférence enregistrée ne sert qu'à REDIRIGER depuis
// la racine ; elle ne repeint jamais une URL non préfixée. Sans cet invariant,
// un lien français partagé s'afficherait en anglais chez un utilisateur
// anglophone, et l'URL ne décrirait plus son propre contenu.

import {
  DEFAULT_LOCALE,
  detectLocale,
  isSupportedLocale,
  localeFromPathname,
  readStoredLocale,
  type Locale,
} from './locale';
import { localizePath } from './routes';

export interface RouterBootstrap {
  /** Locale à servir, déduite de l'URL finale. */
  locale: Locale;
  /** `basename` à passer à `<BrowserRouter>` — `'/'` ou `'/en'`. */
  basename: string;
  /**
   * URL à substituer via `history.replaceState` AVANT le rendu, ou `null`.
   *
   * `replaceState` et non `assign` : on est encore en phase d'amorçage, donc
   * aucun rendu à jeter, et pas d'entrée parasite dans l'historique — le bouton
   * Retour doit ramener au site précédent, pas à une URL qu'on vient de
   * réécrire.
   */
  replaceUrl: string | null;
}

export interface BootstrapInput {
  pathname: string;
  search?: string;
  hash?: string;
  /** Préférence enregistrée. Injectable pour les tests. */
  storedLocale?: Locale | null;
  /** Locale déduite du navigateur. Injectable pour les tests. */
  navigatorLocale?: Locale;
}

export function resolveRouterBootstrap(input: BootstrapInput): RouterBootstrap {
  const { pathname, search = '', hash = '' } = input;
  const stored = input.storedLocale !== undefined ? input.storedLocale : readStoredLocale();
  const navigatorLocale = input.navigatorLocale ?? detectLocale();
  const suffix = `${search}${hash}`;

  const prefix = localeFromPathname(pathname);

  // ── Préfixe explicite de la locale par défaut : `/fr/tasks` → `/tasks`.
  // Canonicalisation obligatoire : deux URLs pour un même contenu, c'est du
  // duplicate content, et `hreflang` ne peut désigner qu'une seule version.
  if (prefix === DEFAULT_LOCALE) {
    const stripped = stripFirstSegment(pathname);
    return {
      locale: DEFAULT_LOCALE,
      basename: '/',
      replaceUrl: `${stripped}${suffix}`,
    };
  }

  // ── Préfixe d'une locale servie : elle fait loi.
  if (prefix && isSupportedLocale(prefix)) {
    return { locale: prefix, basename: `/${prefix}`, replaceUrl: null };
  }

  // ── Préfixe d'une locale connue mais pas encore ouverte (`/es/…` avant la
  // phase 6) : on ne prétend pas la servir. `basename` reste à la racine, donc
  // aucune route ne matche `es/...` et le fallback `*` répond 404 — ce qui est
  // le comportement voulu, et non un accident.
  //
  // ── Aucun préfixe : la racine est le SEUL endroit où l'on redirige.
  if (!prefix && isRoot(pathname)) {
    // Priorité à la préférence explicite ; sinon détection automatique de la
    // langue du navigateur — c'est ici, et nulle part ailleurs, que
    // « traduction automatique selon la langue de l'utilisateur » se produit.
    const preferred = stored ?? navigatorLocale;
    if (isSupportedLocale(preferred) && preferred !== DEFAULT_LOCALE) {
      return {
        locale: preferred,
        basename: `/${preferred}`,
        replaceUrl: `${localizePath('/', preferred)}${suffix}`,
      };
    }
  }

  return { locale: DEFAULT_LOCALE, basename: '/', replaceUrl: null };
}

/** `/fr/tasks` → `/tasks` · `/fr` → `/` */
function stripFirstSegment(pathname: string): string {
  const rest = pathname.replace(/^\/[^/]+/, '');
  return rest === '' ? '/' : rest;
}

function isRoot(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

/**
 * Change la langue en rechargeant la page sur l'équivalent localisé du chemin
 * courant.
 *
 * Rechargement complet et non navigation SPA : `basename` est figé au montage
 * du routeur (cf. l'en-tête de ce fichier). C'est aussi ce qui garantit qu'un
 * composant déjà monté ne conserve pas l'ancienne locale `date-fns`.
 *
 * `href` est injectable pour les tests ; en usage réel on lit `window.location`.
 */
export function localeSwitchTarget(locale: Locale, currentUrl?: { pathname: string; search: string; hash: string }): string {
  const url = currentUrl ?? {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
  // `window.location.pathname` inclut le préfixe : c'est bien le chemin COMPLET
  // qu'il faut donner à `localizePath`, qui sait retirer l'ancien préfixe et
  // traduire le slug public au passage.
  return `${localizePath(url.pathname, locale)}${url.search}${url.hash}`;
}
