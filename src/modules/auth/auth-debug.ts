// Journal de diagnostic de la session, actif seulement avec `?debug` dans
// l'URL. Partagé par `AuthContext` et les unités abonnées à ses événements,
// pour qu'une trace `?debug` reste lisible d'un seul tenant après la coupe
// d'ARC-03.
//
// `import.meta.env.DEV` : le build prod retire déjà `console.*`
// (`vite.config.ts → esbuild.pure`), donc `dlog` n'y affichait rien. Mais
// chaque appel y gardait son message, évalué pour rien, dans le chunk `main`.
// Avec la garde, Rollup élimine appels et messages ; en dev, `?debug` marche
// comme avant. Même motif que le chargement d'eruda dans `src/main.tsx`.

const DEBUG =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

// L'annotation dit à Rollup qu'un appel dont le résultat n'est pas lu peut
// disparaître : vrai en prod, où le corps est vide. Sans elle, les appels
// restaient, messages compris, alors que la fonction ne faisait plus rien.
/*#__NO_SIDE_EFFECTS__*/
export function dlog(msg: string): void {
  if (DEBUG) console.warn(`[AUTH] @${Math.round(performance.now())}ms ${msg}`);
}
