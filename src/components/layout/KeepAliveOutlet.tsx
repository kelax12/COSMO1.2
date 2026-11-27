import { Activity, useContext, useLayoutEffect, useRef, useState, type ContextType, type ReactNode } from 'react';
import { useOutlet, UNSAFE_LocationContext } from 'react-router';
import { MAIN_CONTENT_ID } from '@/components/SkipLink';

/**
 * Onglets principaux gardés montés : quitter `/tasks` pour `/agenda` masque
 * la page (`<Activity mode="hidden">`, soit `display: none`) au lieu de la
 * détruire. Au retour, état, filtres et défilement sont là, sans recalcul du
 * rendu. Liste fixe et courte : chaque page gardée coûte de la mémoire
 * (guide `faster-spa-view-transitions` de modern-web-guidance, 3 à 5 vues).
 *
 * Une page masquée garde son état React mais perd ses effets : écouteurs,
 * abonnements React Query et minuteries sont nettoyés, puis relancés quand
 * elle redevient visible. Un composant de classe (FullCalendar) repasse par
 * `componentWillUnmount` puis `componentDidMount`.
 */
const KEPT_ALIVE_PATHS: readonly string[] = ['/dashboard', '/tasks', '/agenda', '/habits', '/okr', '/statistics'];

type LocationContextValue = ContextType<typeof UNSAFE_LocationContext>;

interface KeptPage {
  element: ReactNode;
  /** L'URL que la page voyait en dernier quand elle était visible. */
  locationContext: LocationContextValue;
}

export function KeepAliveOutlet() {
  const outlet = useOutlet();
  // `UNSAFE_LocationContext` : seul moyen de figer l'URL d'une page masquée.
  // Sans lui, `/tasks` masquée relirait les `?param` de `/habits` à chaque
  // navigation et ouvrirait ce qu'ils désignent.
  const locationContext = useContext(UNSAFE_LocationContext);
  const { pathname, key } = locationContext.location;
  const isKept = KEPT_ALIVE_PATHS.includes(pathname);

  const [pages, setPages] = useState<ReadonlyMap<string, KeptPage>>(() => new Map());
  // Mise à jour pendant le rendu (motif React « état dérivé ») : une seule
  // fois par URL, comparée par `location.key`.
  if (isKept && pages.get(pathname)?.locationContext.location.key !== key) {
    setPages((prev) => new Map(prev).set(pathname, { element: outlet, locationContext }));
  }

  // `<main>` est le conteneur qui défile, partagé par toutes les pages :
  // chaque page retrouve sa position, une page non gardée repart en haut.
  const scrollByPath = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (!main) return;
    main.scrollTop = scrollByPath.current.get(pathname) ?? 0;
    const remember = () => { scrollByPath.current.set(pathname, main.scrollTop); };
    main.addEventListener('scroll', remember, { passive: true });
    return () => main.removeEventListener('scroll', remember);
  }, [pathname]);

  return (
    <>
      {KEPT_ALIVE_PATHS.map((path) => {
        const visible = path === pathname;
        const page = visible ? { element: outlet, locationContext } : pages.get(path);
        if (!page) return null;
        return (
          <Activity key={path} mode={visible ? 'visible' : 'hidden'}>
            <UNSAFE_LocationContext.Provider value={page.locationContext}>
              {page.element}
            </UNSAFE_LocationContext.Provider>
          </Activity>
        );
      })}
      {!isKept && outlet}
    </>
  );
}
