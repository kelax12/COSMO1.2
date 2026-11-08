# ADR 0014 · Des docs d'état courtes, les journaux en archive, plus de notes sur 100

- **Statut** : acceptée
- **Date** : 2026-11-08, décision d'Axel (vagues 19.4 et 20.2 du plan de reprise)

## Contexte

L'audit externe du 2026-11-06 a relevé, sous le constat **DOC-02**, une documentation devenue un
journal : environ 128 fichiers Markdown et 69 000 lignes, dont `TESTING.md` et `PERFORMANCE.md` à
environ 1 600 lignes chacun, presque entièrement occupés par l'historique de leurs propres notes.
Le même audit (**PRO-05**) a établi qu'une note sur 100 qu'on s'attribue ne mesure rien. L'[ADR 0012](./0012-indicateurs-mesures-a-la-place-des-notes.md)
a remplacé les notes par six indicateurs mesurés et annoncé que la vague 19.4 les retirerait des docs.

## Décision

- **Un doc vivant décrit l'état courant** : règles, procédures, invariants. Il ne porte ni récit
  d'incident daté, ni mesure ancienne, ni chronologie.
- **L'historique est déplacé, jamais supprimé**, dans `docs/archive/<DOC>-journal-<dates>.md`, sous
  le bandeau ⚠️ d'archive. Le doc d'origine garde un paragraphe qui renvoie vers ce fichier : une
  règle encore vivante dont le récit a été déplacé se retrouve par son lien.
- **Une décision structurante devient un ADR**, pas une section de doc.
- **Un chiffre qui se compte se génère** : il renvoie vers `docs/FAITS.md` au lieu d'être recopié.
- **Les notes sur 100 sont retirées** des docs : marqueurs `note-audit`, phrases « Note d'audit »,
  en-têtes `Note de … : 80 → 94 / 100`, tableau de bord de `docs/README.md`. L'état de santé se lit
  dans `docs/INDICATEURS.md`.
- **`check:docs-scored` (C-109) est retirée.** Elle exigeait que chaque doc déclare son rapport à
  une note : sans notes, elle ne garde plus rien. Son rôle est repris par une règle de
  `npm run check:docs` (`scripts/check-docs-budget.mjs`, règle 6) qui **refuse le retour** du
  marqueur, de la phrase et de l'en-tête de note dans `docs/*.md`, avec trois témoins dans
  `scripts/check-docs-budget.guard.test.mjs`. Les trois sabotages de son catalogue et son bloc
  de témoins sont retirés avec elle ; le cliquet du catalogue (au moins 220) tient sans eux.

## Conséquences

- **Positives.** Les docs d'état se lisent en une séance ; l'historique reste intact et daté dans
  `docs/archive/`, où il se lit pour le *pourquoi* ; plus aucune note à négocier ni à tenir à jour.
- **Négatives.** Un lien vers une ancre déplacée ne résout plus (la garde ne vérifie que les
  fichiers) : les archives le disent dans leur bandeau. Le retrait de `check:docs-scored` supprime
  la contrainte « chaque doc déclare son rapport à une note » : la fraîcheur d'un doc ne dépend plus
  que de sa relecture et des gardes de son domaine.
- Les lignes avant et après de chaque doc se lisent dans l'historique git de la vague 19.4, pas ici.
