# ADR 0021 · La documentation est écrite pour un agent, et sa convention est gardée

- **Statut** : acceptée
- **Date** : 2026-11-13, décision d'Axel
- **Complète** : [ADR 0014](./0014-docs-d-etat-journaux-en-archive-sans-notes.md) (docs d'état, journaux en archive)

## Contexte

Le lecteur de la documentation de COSMO est un agent de code qui la charge dans son contexte. Chaque
ligne d'un `CLAUDE.md` se paie à chaque session où sa zone est touchée ; chaque ligne d'un doc de
`docs/` se paie à chaque lecture. L'audit externe relevait encore une documentation-journal (DOC-02) et
des chiffres recopiés qui divergent d'un fichier à l'autre (DOC-03). L'ADR 0014 avait posé le principe
(état courant, journaux en archive) sans le rendre vérifiable : rien ne refusait une date, un fichier
trop long ou un doc qu'il faut lire en entier pour savoir s'il concerne la tâche.

## Décision

- **Une convention commune**, écrite une fois dans `docs/README.md` § Convention, s'applique à tout doc
  vivant : `docs/*.md`, les `CLAUDE.md`, `a-faire-code.md`. `docs/archive/**` et `docs/adr/**` en sont
  exclus (instantanés et décisions, datés par nature).
- **Un en-tête de trois lignes au plus** sous le titre : « Quand lire » (les chemins touchés) et « Fait
  foi » (le code ou le fichier source). Un agent décide sur ces lignes s'il lit la suite.
- **`npm run check:docs` la garde** (`scripts/check-docs-budget.mjs`, règle 8) : il refuse une date
  AAAA-MM-JJ isolée, un numéro de ligne cité d'un `.md`, l'absence d'en-tête, et un fichier au-delà de
  150 lignes (`CLAUDE.md`) ou 300 lignes (doc de `docs/`).
- **Cliquet** : un fichier qui ne tient pas une règle à la pose entre dans
  `docs/convention-exceptions.json` avec sa mesure. La mesure ne peut que baisser, une exception
  devenue inutile doit être retirée. On n'y ajoute jamais une entrée.
- **Un chiffre qui se compte se génère** dans `docs/FAITS.md` ; un chiffre qui bouge à chaque commit
  (tests, lignes) n'y est pas écrit : `docs/FAITS.md` donne la commande qui le mesure.
- **Le `README.md` humain reste minimal** (DOC-01 classé par décision) : la documentation de travail est
  celle de l'agent.

## Conséquences

- Le `CLAUDE.md` racine, chargé à chaque session, est réduit à ses règles : une par ligne, sans récit.
- Les sessions qui réécrivent un doc retirent ses entrées d'exception dans la même livraison.
- Une date reste permise collée à un identifiant (nom de fichier d'archive, branche) : c'est un nom,
  pas un récit.
- Une date qui est une donnée lue par une garde (journal légal, échéance, exercice) reste permise : dans
  un marqueur `<!-- … -->`, ou dans un doc déclaré sous `datesLues` de `docs/convention-exceptions.json`
  avec le script lecteur, que `check:docs` vérifie.
