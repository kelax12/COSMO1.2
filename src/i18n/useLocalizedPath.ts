// ═══════════════════════════════════════════════════════════════════
// LIEN INTERNE VERS UNE PAGE À SLUG LOCALISÉ
// ═══════════════════════════════════════════════════════════════════
//
// Le préfixe de locale est porté par le `basename` du routeur : un
// `<Link to="/politique-confidentialite">` devient `/en/politique-confidentialite`
// pour un visiteur anglophone. Or une seule URL canonique existe par langue
// (`/en/privacy-policy`) et le slug de l'autre langue rend une **404**, voulu et
// documenté : les liens internes vers les pages légales doivent donc passer par
// le slug de la locale active.
//
// ❌ Ne JAMAIS écrire un slug localisé en dur dans un `to=`. Passer par ce
//    hook, qui lit la locale active et rend le slug correspondant.
// ⚠️ Aucun autre composant n'appelait `routeSlug` : cette famille de liens est
//    la seule concernée aujourd'hui, mais toute nouvelle page à slug localisé
//    la rejoindra.

import { useCallback } from 'react';
import { useLocale } from './store';
import { routeSlug, type RouteId } from './routes';

/**
 * Rend un chemin ABSOLU côté routeur (sans le préfixe de locale, que le
 * `basename` ajoute) pour une page à slug localisé.
 *
 *     const path = useLocalizedPath();
 *     <Link to={path('privacy')}>…</Link>   // → /privacy-policy en anglais
 */
export function useLocalizedPath(): (routeId: RouteId) => string {
  const locale = useLocale();
  return useCallback((routeId: RouteId) => `/${routeSlug(routeId, locale)}`, [locale]);
}
