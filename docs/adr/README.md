# Décisions d'architecture (ADR)

Un ADR (Architecture Decision Record) écrit **une décision structurante déjà prise** : son contexte,
ce qui a été décidé, ce que ça coûte. Il répond à « pourquoi est-ce ainsi ? », pas à « comment ça
marche » (c'est le rôle des `CLAUDE.md` et de [`../MODULES.md`](../MODULES.md)).

Format MADR léger : **Statut**, **Date**, **Contexte**, **Décision**, **Conséquences**.

## Règles

- Un ADR décrit une décision **déjà prise**, vérifiée dans le code et les docs vivantes avant d'être
  écrite. On n'invente pas un historique de délibération.
- Un ADR **ne se réécrit pas** quand la décision change : on en écrit un nouveau, qui dit lequel il
  remplace, et on passe l'ancien en statut « remplacée par 00NN ». Un ADR corrigé en silence ne dit
  plus ce qui était vrai à sa date.
- Statuts : `proposée`, `acceptée`, `remplacée par 00NN`, `abandonnée`.
- Numérotation à quatre chiffres, nom de fichier `NNNN-sujet-en-minuscules.md`. Le suivant est le
  **0015**, après avoir relu ce dossier.
- ❌ Aucune liste de faiblesses ni de findings de sécurité ouverts : le dépôt est public (voir l'ADR 0008).

## Index

| # | Décision | Statut | Date |
|---|---|---|---|
| [0001](./0001-supabase-assume-rls-frontiere.md) | Supabase est assumé, la RLS est la frontière de sécurité | acceptée | 2026-11-07 (décision d'origine) |
| [0002](./0002-poussee-directe-sur-main-derriere-ci-noyau.md) | Poussée directe sur `main`, derrière le `CI noyau` | acceptée | 2026-10-29 |
| [0003](./0003-i18n-maison-catalogues-json.md) | i18n maison, en catalogues JSON | acceptée | 2026-07-30 |
| [0004](./0004-stripe-redirection-serveur-facturation-entreprise-seule.md) | Stripe par redirection serveur, facturation entreprise seule, Premium perso coupé | acceptée | 2026-10-20 |
| [0005](./0005-modules-entreprise-separes-des-modules-perso.md) | Les modules entreprise sont séparés des modules perso | acceptée | 2026-11-07 (décision d'origine) |
| [0006](./0006-migrations-sql-numerotees-appliquees-a-la-main.md) | Migrations SQL numérotées, appliquées à la main, avec preuve | acceptée | 2026-11-07 (pratique d'origine) |
| [0007](./0007-audience-mesuree-maison-sans-script-tiers.md) | Audience mesurée par un collecteur maison, sans script tiers | acceptée | 2026-10-18 |
| [0008](./0008-depot-public-dossier-prive-local.md) | Dépôt public, dossier privé local | acceptée | 2026-11-06 |
| [0009](./0009-supabase-free-puis-pro-au-premier-client-payant.md) | Supabase Free, puis Pro au premier client payant | acceptée | 2026-11-07 |
| [0010](./0010-un-particulier-peut-acheter-l-offre-entreprise.md) | Un particulier peut acheter l'offre entreprise | acceptée | 2026-08-26 |
| [0011](./0011-charger-a-la-demande-ce-qui-ne-sert-pas-au-premier-ecran.md) | Charger à la demande tout ce qui ne sert pas au premier écran | acceptée | 2026-11-08 |
| [0012](./0012-indicateurs-mesures-a-la-place-des-notes.md) | Des indicateurs mesurés à la place des notes sur 100, avec un audit externe semestriel | acceptée | 2026-11-08 |
| [0013](./0013-validation-d-usage-avant-toute-fonctionnalite-longue.md) | Validation d'usage avant toute fonctionnalité de plus d'une semaine | acceptée | 2026-11-08 |
| [0014](./0014-docs-d-etat-journaux-en-archive-sans-notes.md) | Des docs d'état courtes, les journaux en archive, plus de notes sur 100 | acceptée | 2026-11-08 |

Le double backend de démonstration (`localStorage`) et sa parité avec Supabase n'ont pas encore leur
ADR : il est en cours d'écriture dans un chantier à part.
