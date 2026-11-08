# ADR 0011 · Charger à la demande tout ce qui ne sert pas au premier écran

- **Statut** : acceptée
- **Date** : 2026-11-08 (regroupe des décisions prises et mesurées entre le 2026-08-25 et le 2026-10-22)

## Contexte

Le chunk d'entrée et le chemin critique sont payés par **tous** les visiteurs, y compris celui qui
arrive sur la landing et repart sans se connecter. Un import statique est retenu dans l'entrée même
quand sa branche est morte à l'exécution : retirer l'import du seul shell ne sert à rien tant qu'un
module lazy le garde. Plusieurs modules ont été mesurés trop lourds pour ce chemin.

## Décision

Ce qui ne sert pas au premier écran sort de l'entrée, derrière **une porte unique** par sujet :

- **Dépôts de démonstration du mode entreprise** : `src/lib/demo-repositories.ts`, chargé par
  `import()` depuis `src/lib/repository.factory.ts` (123,9 ko bruts de dépôts de démo dans l'entrée
  avant la coupe, dont 52 ko pour les quatre du mode entreprise). Invariant : leurs interfaces
  n'exposent que des méthodes asynchrones, le mandataire reste synchrone à la construction.
- **Sentry** : `src/lib/monitoring.ts` est la seule porte, elle tamponne les appels avant le
  chargement du SDK ; `src/lib/sentry-client.ts` réexporte nommément six fonctions (un accès par
  namespace fait passer le chunk de 49,3 à 155,9 ko gzip). Garde : `src/monitoring.guard.test.ts`.
- **Validation zod** : `src/lib/validation/lazy.ts`, chargée à la première écriture (131,8 ko bruts).
  Un import statique de `validate` depuis un hook ramène zod dans l'entrée.
- **Toasts** : façade `@/lib/toast`, `sonner` en `import()` dynamique seulement. Garde :
  `src/lib/toast.guard.test.ts`.
- **Catalogues i18n** : seuls `common` et `errors` sont dans l'entrée, les autres voyagent avec leur
  page (`lazyWithRetry`), et les namespaces rares ont leur catalogue à part (`src/i18n/catalog.ts`).
- **Bas de parcours de la landing** : monté au premier geste (`BelowFold`), dans son propre chunk.

## Conséquences

- **Positives.** Un visiteur de la landing ne télécharge ni dépôts de démo, ni zod, ni le SDK Sentry
  entier, ni les catalogues d'écrans qu'il n'ouvre pas ; le TBT mobile baisse.
- **Négatives.** Chaque porte est une règle à tenir (un import direct la défait sans bruit, seul le
  budget de bundle le voit), et le premier usage attend un chunk : le premier geste d'écriture, la
  première ouverture d'un écran entreprise en démo.
- **À ne pas faire.** Ne jamais importer `@sentry/react`, `sonner` ou `validate` en statique hors de
  leur porte ; ne jamais donner un membre synchrone à une interface de dépôt différé ; ne jamais
  relever un plafond de `check:bundle` pour faire passer la CI.
- Règles de détail : [`src/lib/CLAUDE.md`](../../src/lib/CLAUDE.md),
  [`src/i18n/CLAUDE.md`](../../src/i18n/CLAUDE.md) et [`docs/PERFORMANCE.md`](../PERFORMANCE.md).
