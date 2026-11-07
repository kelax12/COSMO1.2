# ADR 0008 · Dépôt public, dossier privé local

- **Statut** : acceptée
- **Date** : 2026-11-06

## Contexte

Le dépôt GitHub est public. Certains documents de travail ne doivent pas l'être : le suivi des
failles de sécurité ouvertes, la liste des gestes manuels à faire, la procédure de violation de
données, la prospection, les business plans, les audits. L'audit externe du 2026-11-06 a conclu que ces documents n'ont
pas leur place dans un dépôt public. Passer le dépôt en privé avait déjà été
essayé et posait des problèmes de tests et de CI.

## Décision

- **Le dépôt reste public.**
- Les documents sensibles vivent **hors du dépôt**, dans `prive/`, un dossier local à la racine du
  checkout principal, ignoré par git (`.gitignore`).
- Aucun fichier suivi ne **lie** vers ces documents ni n'en **copie** le contenu : `docs/` n'y renvoie
  que par leur nom, en précisant « hors dépôt ».
- **Une liste unique** de ce qui n'a rien à faire dans un dépôt public (`prive/**`, documents bureautiques,
  csv, exports, dumps, `.env*` hors gabarits, fichiers de plus de 1 Mo…) vit dans
  `scripts/check-fichiers-sensibles.mjs`. Elle est lue par trois consommateurs : le hook `pre-commit`,
  le job `fichiers-sensibles` du `CI noyau` (arbre **et** chaque version poussée), et une garde Vitest sur
  `git ls-files`.

## Conséquences

- **Positives.** Le code, les gardes et les décisions sont lisibles par tous (c'est aussi ce qui permet
  d'ouvrir ce dépôt à un lecteur humain, voir [`README.md`](../../README.md)), et la CI reste gratuite
  et complète.
- **Négatives.** Retirer un fichier du suivi **n'efface pas l'historique** : ce qui a été poussé reste
  lisible dans les anciens commits, et ne se corrige que par une rotation du secret ou de la donnée,
  jamais par un simple retrait. Le dossier `prive/` n'existe que sur une machine : il n'est ni
  partagé, ni sauvegardé par le dépôt, et les worktrees ne le voient pas.
- **Règle d'écriture.** Une doc publique ne dit pas ce qui est faible : elle dit ce qui est fait et ce
  qui est gardé. Les sujets sensibles se tiennent dans `prive/`.
- Le hook `pre-commit` saute avec `--no-verify`, ce qui est interdit, et la CI rattrape le fichier suivi.
