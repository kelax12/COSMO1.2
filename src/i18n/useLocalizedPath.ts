// ═══════════════════════════════════════════════════════════════════
// LIEN INTERNE VERS UNE PAGE À SLUG LOCALISÉ
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02, découvert en vérifiant la traduction des
// pages contractuelles).
//
// Le préfixe de locale est porté par le `basename` du routeur : un
// `<Link to="/politique-confidentialite">` devient donc `/en/politique-
// confidentialite` pour un visiteur anglophone. Or une seule URL canonique
// existe par langue (`/en/privacy-policy`), et le slug de l'autre langue rend
// une **404** — comportement voulu et documenté, pas un bug de routage.
//
// Résultat mesuré dans le navigateur : les quatre liens internes vers les pages
// légales (bandeau cookies + trois liens de pied de landing) tombaient sur une
// 404 en anglais. Traduire la politique de confidentialité sans corriger ça
// n'aurait servi à rien : le seul chemin vers elle était cassé.
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
