# ADR 0015 · TypeScript 6, en attendant l'API de TypeScript 7

- **Statut** : acceptée
- **Date** : 2026-11-08 (vague 18.2 du plan de reprise, constat DEP-01)

## Contexte

L'audit externe du 2026-11-06 relève TypeScript 5.9 avec une majeure de retard. TypeScript 7.0
(compilateur natif, stable depuis le 2026-07-08) prend en charge `tsc -b` et les références de
projet, mais **ne livre aucune API de programmation** : l'éditeur annonce une nouvelle API pour la
7.1, différente de l'actuelle, en bêta au 2026-11-08.

Trois outils du dépôt chargent le paquet `typescript` comme bibliothèque :

- **typescript-eslint** (8.72), qui parse chaque fichier `.ts` / `.tsx` du lint. Il accepte
  `typescript >=4.8.4 <6.1.0`.
- **`scripts/check-commentaires.mjs`**, garde du `CI noyau` (V17.1), qui lit les commentaires par
  l'analyseur de TypeScript.
- **`src/lib/db-contract.guard.test.ts`**, témoin du contrat de données.

## Décision

1. Le dépôt monte en **TypeScript 6.0** : dernière version qui livre l'API actuelle, acceptée par
   typescript-eslint. Elle refuse déjà ce que la 7 supprimera ; deux réglages sont corrigés en
   conséquence : `baseUrl` est retiré de `tsconfig.app.json` (les `paths` se résolvent par rapport
   au fichier) et `types: ["node"]` devient explicite dans `tsconfig.app.json` et
   `tsconfig.node.json` (la 6 ne charge plus tous les `@types` par défaut).
2. **TypeScript 7 est écarté pour l'instant.** La seule voie aujourd'hui serait de faire cohabiter
   deux compilateurs : la 7 pour `tsc` (paquet `typescript@7` sous un alias npm) et la 6 sous le nom
   `typescript` pour les trois outils ci-dessus (`@typescript/typescript6`). Le dépôt aurait alors
   deux vérificateurs de types aux règles différentes, dont un qui ne contrôlerait que le lint.

## Conséquences

- **Positives.** Les tsconfig sont déjà conformes à la 7 : le jour venu, la montée se réduira au
  paquet et aux trois outils.
- **Négatives.** Le dépôt garde une majeure de retard sur TypeScript, et ne profite pas encore de la
  vitesse du compilateur natif.
- **Ce qui rouvre la décision.** Une version stable de TypeScript 7 avec API (7.1 annoncée), plus une
  version de typescript-eslint qui l'accepte. Alors : monter, adapter `check-commentaires.mjs` et
  `db-contract.guard.test.ts` à la nouvelle API, et écrire l'ADR qui remplace celle-ci.
- **À ne pas faire.** Ne pas installer `typescript@7` sous le nom `typescript` : le lint, la garde
  des commentaires et le témoin du contrat de données cassent.
