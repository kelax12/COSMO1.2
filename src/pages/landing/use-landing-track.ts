import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { localizePath, routeSlug, stripLocalePrefix } from '@/i18n/routes';
import { useLocale } from '@/i18n/store';

/** Les deux parcours de la landing. Ils sont mutuellement exclusifs. */
export type LandingTrack = 'perso' | 'entreprise';

/**
 * Parcours affiché, dérivé de l'URL.
 *
 * `/` sert le track perso (le SEO historique de la home est intact),
 * `/entreprise-presentation` (slug localisé) sert le track entreprise. Les deux
 * chemins rendent le MÊME composant à la même profondeur de l'arbre : React
 * réconcilie par type, donc basculer d'un parcours à l'autre ne remonte pas la
 * page et le voile de transition peut jouer sans coupure.
 *
 * Dériver le parcours de l'URL plutôt que de le tenir en état local donne le
 * bouton retour gratuitement : revenir en arrière change le chemin, donc le
 * parcours, sans code de synchronisation.
 */
export function useLandingTrack() {
  const navigate = useNavigate();
  const locale = useLocale();
  const { pathname } = useLocation();

  const track: LandingTrack = useMemo(() => {
    const { path } = stripLocalePrefix(pathname);
    return path === `/${routeSlug('enterprisePresentation', locale)}` ? 'entreprise' : 'perso';
  }, [pathname, locale]);

  // Compteur de bascules : sert de `key` au voile de transition, qui doit
  // rejouer à chaque changement, y compris au retour vers le parcours
  // précédent. Il ne s'incrémente pas au premier rendu — arriver directement
  // sur `/entreprise-presentation` n'est pas une bascule.
  const [transitionKey, setTransitionKey] = useState(0);
  const previousTrack = useRef(track);
  useEffect(() => {
    if (previousTrack.current === track) return;
    previousTrack.current = track;
    setTransitionKey((n) => n + 1);
  }, [track]);

  const selectTrack = useCallback(
    (next: LandingTrack) => {
      if (next === track) return;
      navigate(
        localizePath(next === 'entreprise' ? `/${routeSlug('enterprisePresentation', 'fr')}` : '/', locale),
      );
    },
    [track, navigate, locale],
  );

  return { track, selectTrack, transitionKey };
}
