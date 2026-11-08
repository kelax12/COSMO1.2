# ADR 0013 · Validation d'usage avant toute fonctionnalité de plus d'une semaine

- **Statut** : acceptée
- **Date** : 2026-11-08, décision d'Axel (vague 20.4 du plan de reprise)

## Contexte

L'audit externe du 2026-11-06 a relevé, sous le constat **PRD-02**, des fonctionnalités construites
puis abandonnées : du travail livré sans qu'on ait établi, avant de l'écrire, que quelqu'un s'en
servirait. Le dépôt en garde des traces visibles, par exemple le Premium perso, construit puis coupé
(`PREMIUM_ENFORCED = false`, voir l'[ADR 0004](./0004-stripe-redirection-serveur-facturation-entreprise-seule.md)).

Le coût d'une fonctionnalité n'est pas son écriture : ce sont les tests, les traductions, la
documentation, la surface à protéger par la RLS, les gardes, puis le retrait. Une personne seule,
aidée d'agents qui écrivent vite, a toutes les raisons de construire plus que ce que l'usage
justifie.

## Décision

- **Toute fonctionnalité estimée à plus d'une semaine de travail passe par une proposition écrite
  avant le premier commit**, sur le gabarit
  [`docs/propositions/GABARIT.md`](../propositions/GABARIT.md) (le même, sous forme d'issue, dans
  `.github/ISSUE_TEMPLATE/`). Une semaine se compte en jours de travail d'une personne, agents
  compris : dans le doute, on écrit la proposition.
- **Six rubriques, toutes remplies** : le problème, la preuve d'usage, la maquette, le test auprès de
  N utilisateurs, la mesure d'activation, le critère d'abandon.
  - *Preuve d'usage* : ce qui existe déjà (demandes, abandons observés, contournements), pas ce
    qu'on suppose.
  - *Maquette* : un écran visible, pas une description. Elle se rend dans la conversation ou se lie.
  - *Test* : au moins **5 utilisateurs** (N est écrit, avec la tâche donnée et combien l'ont
    réussie sans aide). Sans résultat de test, la fonctionnalité n'est pas validée, elle est
    seulement proposée.
  - *Mesure d'activation* : la part des utilisateurs exposés qui font l'action clé, sa valeur
    visée, et la date de lecture, fixées **avant** le code.
  - *Critère d'abandon* : le seuil et la date en dessous desquels la fonctionnalité est retirée, et ce
    que le retrait emporte (code, tables, traductions, docs).
- **Hors périmètre** : correctifs de bug, sécurité, obligations légales (RGPD, droit de la
  consommation), outillage et CI, dette technique. Ils ne demandent aucune validation d'usage.
- **Une fonctionnalité sous le seuil de la semaine** n'a pas besoin de proposition, mais rien
  n'interdit d'en écrire une.
- **À la date de lecture, on lit la mesure.** Sous le critère d'abandon, on retire, et on le dit
  dans la proposition, qui reste.

## Conséquences

- **Positives.** Le coût d'une idée est payé avant le code : un « non » arrive en une heure, pas en
  une semaine. Chaque fonctionnalité longue porte sa mesure et son critère de sortie.
- **Négatives.** Une étape de plus avant de construire, et un test à cinq utilisateurs demande de les
  trouver : la base d'utilisateurs est petite, donc le test est qualitatif, pas statistique. Un
  critère d'abandon écrit se tient, ce qui demande de retirer ce qu'on a construit.
- Ce n'est pas une garde de CI : rien n'empêche techniquement un commit sans proposition. La règle
  vit dans [`CONTRIBUTING.md`](../../CONTRIBUTING.md) et se contrôle à la relecture du plan, comme la
  poussée directe sur `main` (ADR 0002) se contrôle par ses gardes et non par une revue.
