// Point d'entrée d'`index.html`. Il ne fait qu'une chose : décider QUAND
// charger l'application (`main.tsx`).
//
// 🔴 POURQUOI UN POINT D'ENTRÉE SÉPARÉ (2026-10-15, LCP mobile).
// Depuis C-116, l'élément LCP des pages prérendues est le texte du prérendu,
// peint avant React. Mais Lighthouse mobile (simulation Lantern) le mesurait
// toujours à 3,26-3,40 s sur les 8 URLs, avec 2,9 s de « Render Delay » pour un
// HTML reçu à 0,47 s. Lantern range dans le chemin du LCP toute requête TERMINÉE
// avant la peinture observée : avec `main.tsx` en entrée, ses ~300 ko gzip de
// JS (`modulepreload`) et ses ~40 ko de CSS bloquante l'étaient tous, alors que
// le prérendu n'en a pas besoin pour s'afficher. Sur un vrai réseau lent, c'est
// la même chose en vrai : ce JS se disputait la bande passante avec la CSS.
//
// Ici, sur une page PRÉRENDUE, l'application n'est demandée qu'APRÈS la
// première peinture : ni son JS ni sa CSS ne sont plus sur le chemin du LCP.
// Sa CSS n'est plus bloquante non plus : Vite la charge avec le chunk, et
// React ne monte qu'une fois qu'elle est là, donc aucun flash sans style.
// La coquille `app.html` (routes de l'app) n'a rien à peindre : elle charge
// tout de suite.
//
// ❌ Ne rien importer STATIQUEMENT ici d'autre que `after-first-paint` : tout
// import statique repasse sur le chemin du LCP. `check:bundle` compte le chunk
// de `main.tsx` et ses dépendances dans le chemin critique (il lit la liste de
// préchargement de ce point d'entrée), le budget ne perd donc rien de vue.
import { afterFirstPaint } from './lib/after-first-paint';

const charger = () => {
  void import('./main');
};

if (document.documentElement.hasAttribute('data-prerendered')) afterFirstPaint(charger);
else charger();
