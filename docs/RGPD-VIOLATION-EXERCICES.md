# Exercices à blanc de la procédure de violation

La procédure de violation de données (art. 33-34, 72 h) vit **hors dépôt** depuis le 2026-11-06 :
`RGPD-VIOLATION.md`, dans `prive/` du checkout principal. Le dépôt est public, et la procédure
décrit les trous de la réponse à incident (constat `SEC-02` de l'audit externe du 2026-11-06).

Ce fichier n'en garde que ce qui se publie sans risque et que la CI doit pouvoir lire : la **date**
de chaque exercice. `npm run check:exercice-violation` (quotidien, `gardes-calendrier.yml`) échoue
quand le dernier a plus de 12 mois, ou qu'il est daté dans le futur.

> 🔴 **Ce fichier est PUBLIC.** ❌ Ne jamais y écrire un trou trouvé par un exercice, un chemin
> d'accès, un délai de conservation ou un fait d'une violation réelle : ils vont dans la
> procédure et dans le registre, hors dépôt.
> ❌ Ne jamais dater un exercice qui n'a pas eu lieu pour faire passer la garde.

## Exercice à blanc

| Date | Mode | Compte rendu |
|---|---|---|
| 2026-10-24 | Mode table, scénario fictif, six étapes parcourues | `RGPD-VIOLATION.md` (hors dépôt), § « Exercice à blanc » et § « Trous trouvés par l'exercice » |

## Ce que la garde vérifie encore dans le dépôt

- la date ci-dessus : moins de 12 mois, pas dans le futur ;
- les gabarits que la procédure appelle, par titre, dans
  [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md) ;
- que `verify_payment_chain`, appelée à l'étape « Qualifier », existe dans une migration ;
- les liens et les commandes `npm run` de ce fichier.

⚠️ Ce qu'elle ne vérifie plus depuis que la procédure est sortie du dépôt : les liens, les
commandes et l'état des trous **de la procédure elle-même**. Ils se relisent à la main, à chaque
exercice.

Voir aussi : [`RGPD.md`](./RGPD.md) (droits, effacement) et
[`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) (registre art. 30).
