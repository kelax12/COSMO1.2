# Récits sortis des commentaires de `scripts/` (2026-11-19)

> Instantané daté, non maintenu (ADR 0021). Le code fait foi. Sortis pour libérer le budget
> d'outillage (MAI-02) à l'arrivée de `verif:rapide` et `pousser` (ADR 0022) ; texte inchangé.

## `scripts/check-bundle-budget.mjs` · en-tête

```js
// Budget de bundle, le seul budget du dépôt qui n'était mesuré par AUCUNE garde.
//
// Tous les autres ont fini par obtenir un cliquet (taille des fichiers, échelle
// typographique, échelle z-index, mouvement des feuilles, couverture de tests).
// Celui-ci non, et c'est le seul qui ait reculé sans que rien ne le signale :
// +5 ko gzip sur le chunk d'entrée en UNE journée le 2026-08-25, pour une marge
// de 11 ko. Les mesures étaient dans `docs/PERFORMANCE.md`, donc dans un
// Markdown, donc invérifiables, exactement le motif que ce dépôt documente
// depuis des semaines : *une règle qu'aucun script ne mesure recule à chaque
// vague de features.*
//
// Ce script lit le build RÉEL (`dist/`) et compare au cliquet ci-dessous.
//
// Usage :
//   npm run build && npm run check:bundle
//   npm run check:bundle -- --report   (affiche tout, ne fait échouer rien)
//
// 🔴 **Ne jamais remonter un plafond pour faire passer la CI.** La règle est
// celle de `vitest.config.ts` : un plafond ne descend que quand la mesure
// descend. S'il est franchi, c'est le bundle qui doit maigrir, le levier est
// documenté dans `docs/PERFORMANCE.md`.
```

## `scripts/check-bundle-budget.mjs` · historique de `critical`

```js
  // ── LE budget qui compte ──
  //
  // Somme gzip du chunk d'entrée ET de tout ce que `dist/index.html` précharge.
  // C'est ce qu'un visiteur télécharge avant de voir quoi que ce soit, y compris
  // celui qui arrive sur la landing et repart.
  //
  // Mesuré 393 850 o le 2026-08-26. Plafond ~1,5 % au-dessus.
  //
  // ⚠️ Ce budget a REMPLACÉ « taille du chunk d'entrée » comme mesure
  // principale, et le remplacement vient d'une erreur réelle : en sortant les
  // primitives Radix de leur chunk groupé, l'entrée a GROSSI de 19 ko pendant
  // que le chemin critique MAIGRISSAIT de 26 ko. L'ancienne mesure aurait
  // refusé une amélioration. Une garde qui mesure le mauvais nombre est pire
  // qu'une garde absente : elle donne tort à la bonne décision.
  // 2026-08-28 : 393 850 → **373 043 o** (364,3 ko). Deux leviers, tous deux
  // payés par TOUS les visiteurs :
  //   • zod (131,8 ko bruts) sort de l'entrée — garde UX chargée à la première
  //     écriture, pas à l'ouverture (`src/lib/validation/lazy.ts`) ;
  //   • le `<TooltipProvider>` d'`App.tsx` était REDONDANT (le composant
  //     `Tooltip` fournit déjà le sien) et traînait `@radix-ui/react-tooltip`
  //     + tout `floating-ui`, 113 ko bruts, pour un seul consommateur lazy.
  // Plafond reposé ~1,6 % au-dessus du mesuré.
  // 2026-09-02 : 373 043 → **364 500 o**, et le plafond REDESCEND de 379 000 à
  // 370 000. Les dépôts de DÉMONSTRATION du mode entreprise sont sortis du
  // chemin critique (`src/lib/demo-repositories.ts`) : ils pesaient 52 ko bruts
  // que tout visiteur téléchargeait, y compris celui qui repart de la landing
  // sans jamais se connecter. Le reste des dépôts de démo, 72 ko bruts encore
  // dans l'entrée, attend la séparation interface / implémentation locale que
  // six modules n'ont pas.
  // 2026-09-11 : 316 407 → **306 347 o**, et le plafond REDESCEND de 370 000 à
  // 323 000. `sonner` (10,1 ko gzip) sort du chemin critique : le `<Toaster>`
  // d'`App.tsx` est différé et tous les appels passent par la façade
  // `src/lib/toast.ts`, qui fait le SEUL `import('sonner')` du dépôt.
  //
  // 🔴 Le piège, mesuré, parce qu'il se reproduira : nettoyer le SHELL ne
  // suffit pas. Tant qu'une page lazy garde un import statique de `sonner`,
  // Rollup place le module dans l'ancêtre commun des chunks qui le partagent,
  // c'est-à-dire l'ENTRÉE. Et l'en sortir par `manualChunks` fait émettre à
  // Vite un `<link rel="modulepreload">` : l'entrée maigrit de 10 ko, le
  // chemin critique de 162 OCTETS. Le gain n'existe qu'avec zéro import
  // statique dans tout `src/`. Cliquet : `src/lib/toast.guard.test.ts`.
  //
  // ⚠️ Le plafond est posé ~5 % au-dessus du mesuré, et non ~1,5 % comme les
  // précédents : le critère de sortie de C-14 exige 5 % de marge sur les DEUX
  // budgets. Reposer le cliquet à 1,5 % rouvrirait l'item le jour même.
```

## `scripts/check-bundle-budget.mjs` · historique de `entry`

```js
  // Mesure secondaire, conservée pour attraper le cas inverse : une entrée qui
  // enfle sans que le nombre de préchargements bouge. Le plafond est passé de
  // 92 à 112 ko le 2026-08-26, et c'est la SEULE fois où remonter un plafond
  // est la bonne réponse : l'entrée a absorbé du code qui était préchargé à
  // côté, donc le total a baissé. Vérifier `critical` avant de toucher à
  // celui-ci.
  // 2026-08-28 : 106,9 → **77 312 o** (75,5 ko), et le plafond REDESCEND de
  // 112 000 à 79 000. C'est le remboursement de la seule fois où ce dépôt a
  // relevé un plafond pour absorber une dérive — le cliquet joue dans les deux
  // sens, il attrape la dette PUIS enregistre son remboursement.
  //
  // 🔴 Toujours vérifier `critical` avant de toucher à celui-ci : sortir un
  // module de l'entrée sans le sortir du chemin critique ne gagne rien.
  // 2026-09-03 : 77 312 → **77 379 o**, plafond de 79 000 à 78 000. Même coupe
  // que ci-dessus (les dépôts de démo entreprise sortent du chemin critique).
  //
  // ⚠️ Le cliquet a failli être RELEVÉ la veille pour absorber les 2,5 ko d'un
  // lot de correctifs. Les deux mesures montaient, donc ce n'était pas le cas
  // d'absorption qui l'autorise : couper d'abord était la bonne réponse, et la
  // coupe a rendu 5,1 ko, deux fois ce qu'il fallait.
  //
  // 🔴 Le chiffre ci-dessus n'est PAS celui qu'annonçait la première version de
  // ce commentaire (75 798). Il datait d'un arbre de la veille au soir ; le lot
  // a continué de grossir de 1,6 ko pendant la nuit. Un plafond posé sur une
  // mesure périmée est un plafond faux, même quand il est plus bas — celui-ci
  // aurait fait échouer la CI sur une valeur que plus rien ne mesurait.
  // 2026-09-11 : 76 954 → **66 896 o**, plafond de 78 000 à 71 000. Même coupe
  // que ci-dessus, et `critique` a baissé d'autant (−10 060 o des deux côtés) :
  // c'est ce qui la distingue d'un déplacement.
  //
  // ⚠️ La mesure du 2026-09-04 annonçait 74 903 o (3,97 % de marge). Elle
  // n'avait pas été refaite depuis, et l'entrée avait REPRIS 2 051 o entre
  // temps — marge réelle au 2026-09-11 avant coupe : **1,34 %**. Un budget
  // qu'on ne remesure pas dérive dans le sens qui arrange.
  // 2026-10-01 : 73 159 → **67 141 o**, plafond de 71 000 à 70 500. Cause de
  // la dérive : les barils `tasks`, `habits`, `organizations`, `team-projects`,
  // `team-okrs` et `org-teams` RÉEXPORTAIENT leur dépôt de démo ; importés par
  // le shell, ils le ramenaient dans l'entrée alors que la fabrique le charge à
  // la demande. Réexportations retirées, tâches et habitudes passées par
  // `demo-repositories.ts`. `critique` a baissé d'autant (315,3 → 309,3 ko) :
  // une coupe, pas un déplacement.
```

## `scripts/check-tooling-coverage.mjs` · en-tête (C-82)

```js
// ═══════════════════════════════════════════════════════════════════
// C-82 — la couverture de `scripts/`, et la garde qui l'empêche de mentir
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER N'EST PAS UNE SIMPLE LIGNE `thresholds` DANS
// `vitest.tooling.config.ts`.
//
// Mesuré le 2026-09-20 en posant la config : le provider v8 a écrit
//
//     Failed to parse .../scripts/apply-migrations.mjs. Excluding it from coverage.
//     Failed to parse .../scripts/check-rls-advisors.mjs. Excluding it from coverage.
//     Failed to parse .../scripts/i18n-check.mjs. Excluding it from coverage.
//
// …puis a rendu un rapport et un pourcentage, sans échouer. Trois fichiers,
// dont DEUX GARDES DE CI, étaient sortis du périmètre en silence, et le
// chiffre affiché décrivait un périmètre dont personne n'avait annoncé la
// réduction. C'est mot pour mot la classe de défaut de `scripts/CLAUDE.md` :
// « ne jamais laisser une garde sauter silencieusement une moitié de son
// travail ».
//
// LA CAUSE, ISOLÉE PAR EXPÉRIENCE ET NON PAR LECTURE : le SHEBANG. Retirer la
// ligne `#!/usr/bin/env node` de ces trois fichiers fait passer le nombre de
// « Failed to parse » de 3 à 0, toutes choses égales par ailleurs. Node retire
// le shebang ; la chaîne Rollup qui ré-analyse le fichier pour remapper la
// couverture, elle, ne le retire pas.
//
// ⚠️ DOUZE AUTRES SCRIPTS portaient un shebang sans échouer, ce qui a d'abord
// fait croire la théorie fausse : ils sont IMPORTÉS par un témoin, donc ils
// passent par le pipeline d'import de Vite (qui retire le shebang) et non par
// le chemin « fichier non couvert ». Le piège était donc latent sur tous, et
// se serait déclenché le jour où l'un d'eux perdrait son témoin.
//
// ✅ CORRIGÉ À LA SOURCE le 2026-09-20 : les quinze shebangs de `scripts/**`
// ont été retirés. Ils étaient DÉCORATIFS — vérifié, chaque script est lancé
// par `node scripts/x.mjs` depuis `package.json` ou un workflow, jamais en
// exécutable. La règle ci-dessous interdit leur retour.
//
// CE QUE CETTE GARDE FAIT, dans cet ordre :
//   1. elle recalcule la liste des fichiers ATTENDUS dans le rapport ;
//   2. elle échoue si l'un d'eux en est absent — un fichier ne peut plus
//      sortir du périmètre sans que quelqu'un le décide ;
//   3. elle échoue si un fichier du périmètre porte un shebang, sans aucune
//      dispense possible : le défaut du 2026-09-20 ne peut donc pas se
//      reproduire par un fichier NEUF ;
//   4. elle applique les seuils, qui sont un CLIQUET.
//
// ❌ NE JAMAIS BAISSER UN SEUIL POUR FAIRE PASSER LA CI. Un dépassement dit
//    qu'un script manque de tests, pas que la borne est trop haute.
// ❌ NE JAMAIS REMETTRE UN SHEBANG pour faire taire cette garde, ni ajouter
//    le fichier à `coverage.exclude` : la bonne correction est de retirer le
//    shebang, qui ne sert à rien tant que le script est lancé par `node`.
// ═══════════════════════════════════════════════════════════════════
```

## `scripts/check-tooling-coverage.mjs` · pose et remontée des seuils

```js
/**
 * Les seuils, posés AU RÉEL MESURÉ le 2026-09-20, ~1 point en dessous — la
 * convention de `vitest.config.ts`. Ils sont un CLIQUET : ils ne peuvent que
 * monter.
 *
 * Mesure de la pose, périmètre COMPLET (29 fichiers sur 29) :
 *   statements 23,12 · branches 25,37 · functions 35,35 · lines 23,33
 *
 * ⚠️ Ces chiffres étaient PLUS BAS que ceux du premier essai
 * (27,60 / 29,46 / 40,07 / 27,75), et ce n'était pas une régression : le
 * premier essai mesurait 26 fichiers sur 29, les trois plus gros non couverts
 * étant précisément ceux qui échouaient à l'analyse. Un périmètre qui
 * rétrécit fait MONTER un pourcentage — c'est ce qui rend ce mode de
 * défaillance si confortable, et c'est pour ça que le contrôle de complétude
 * passe AVANT les seuils.
 *
 * ── REMONTÉE DU 2026-09-20 au soir ──────────────────────────────────
 *
 * Le périmètre est passé de 29 à 47 fichiers (les treize gardes du § 12
 * d'`a-faire-code.md`), et la couverture a d'abord CHUTÉ à 20,30 % — les
 * nouveaux scripts arrivant sans témoin.
 *
 * 🔴 Le seuil n'a PAS été baissé. `scripts/gardes-posture.guard.test.mjs` a
 * été écrit : 39 cas sur les fonctions PURES des sept gardes qui
 * interrogent la production (SQL construit, plan extrait, référence
 * comparée, `fetch` injecté). Mesure après :
 *   statements 26,73 · branches 27,18 · functions 42,47 · lines 26,70
 * soit PLUS HAUT qu'avant l'élargissement, sur un périmètre une fois et
 * demie plus grand.
 *
 * ⚠️ CE QUE CE POURCENTAGE SOUS-ESTIME, et il faut le savoir avant de le
 * lire : plusieurs scripts affichent 0 % alors qu'ils ONT un témoin
 * (`i18n-scan`, `i18n-identical`, `check-docs-budget`, `check-bundle-budget`).
 * Leur témoin les lance en SOUS-PROCESSUS — la seule façon de tester un
 * script qui lit `dist/` et sort en `process.exit` —, et le provider v8
 * n'instrumente pas un sous-processus. Le chiffre mesure donc ce qui est
 * testé EN PROCESSUS, pas ce qui est testé.
 * ❌ Ne pas « corriger » ça en réécrivant ces témoins : ils mesurent le
 *    comportement réel du script, ce qui vaut mieux qu'un pourcentage.
 */
```
