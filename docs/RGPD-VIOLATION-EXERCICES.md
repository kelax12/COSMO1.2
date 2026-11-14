# Exercices à blanc de la violation

**Quand lire** : avant de dater un exercice ou de toucher `check-exercice-violation`. **Fait foi** : `scripts/check-exercice-violation.mjs`.

La procédure de violation (art. 33-34, 72 h) est `RGPD-VIOLATION.md`, hors dépôt (`prive/`, checkout principal). Ce fichier ne garde que la date de chaque exercice, lue par la CI.

- 🔴 Fichier PUBLIC : ❌ jamais un trou trouvé par un exercice, un chemin d'accès, un délai de conservation ou un fait de violation réelle. Ils vont dans la procédure et le registre, hors dépôt.
- ❌ Ne jamais dater un exercice qui n'a pas eu lieu pour faire passer la garde.
- ✅ `npm run check:exercice-violation` (quotidien, `gardes-calendrier.yml`) échoue si le dernier exercice a plus de 12 mois ou est daté dans le futur.
- ✅ Elle vérifie aussi les gabarits par titre dans [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md), l'existence de `verify_payment_chain` dans une migration, et les liens et commandes `npm run` de ce fichier.
- ⚠️ Elle ne lit plus la procédure elle-même : relire à la main ses liens, ses commandes et ses trous à chaque exercice.

## Exercice à blanc

| Date | Mode | Compte rendu |
|---|---|---|
| 2026-10-24 | Mode table, scénario fictif, six étapes parcourues | `RGPD-VIOLATION.md` (hors dépôt), § « Exercice à blanc » et § « Trous trouvés par l'exercice » |

Voir : [`RGPD.md`](./RGPD.md) (droits, effacement), [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) (art. 30).
