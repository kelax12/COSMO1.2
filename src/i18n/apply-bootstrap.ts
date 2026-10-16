// Amorçage i18n APPLIQUÉ au document : `<html lang>`, canonicalisation d'URL,
// `basename` du routeur. La décision vit dans `bootstrap.ts` (pure, testée) ;
// ce module ne fait que l'appliquer.
//
// 🔴 APPELÉ DEUX FOIS, ET C'EST VOULU (2026-10-16). `src/boot.ts` l'appelle en
// premier, de façon synchrone : depuis que l'application n'est chargée qu'après
// la première peinture du prérendu, l'appel de `main.tsx` tombait APRÈS
// l'événement `load`, donc après le premier rendu — `lang` et l'URL canonique
// arrivaient en retard (`e2e/i18n-routing.spec.ts`, 4 cas rouges sur `c8591450`).
// Le second appel, dans `main.tsx`, part de l'URL déjà canonique : il rend la
// même locale et le même `basename`, et ne réécrit rien.
//
// ❌ N'importer ici que la logique de locale : ce module est sur le chemin du
// LCP, via `boot.ts`.
import { resolveRouterBootstrap } from './bootstrap';
import { DEFAULT_LOCALE, applyLocale, resolveInitialLocale, type Locale } from './locale';

export interface LocaleAppliquee {
  basename: string;
  locale: Locale;
}

export function applyRouterBootstrap(): LocaleAppliquee {
  try {
    const bootstrap = resolveRouterBootstrap({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
    applyLocale(document.documentElement, bootstrap.locale);
    if (bootstrap.replaceUrl && bootstrap.replaceUrl !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', bootstrap.replaceUrl);
    }
    return { basename: bootstrap.basename, locale: bootstrap.locale };
  } catch {
    /* localStorage/navigator inaccessibles (navigation privée stricte) — on reste
       sur la locale par défaut à la racine, ce qui est toujours servable. */
    try {
      applyLocale(document.documentElement, resolveInitialLocale());
    } catch { /* rien de plus à tenter */ }
    return { basename: '/', locale: DEFAULT_LOCALE };
  }
}
