# ADR 0012 · Des indicateurs mesurés à la place des notes sur 100

- **Statut** : acceptée
- **Date** : 2026-11-08, décision d'Axel (vague 20.2 du plan de reprise)

## Contexte

Le tableau de bord de [`docs/README.md`](../README.md) attribuait à chaque domaine une note sur 100,
fixée par la session qui venait de travailler dessus : 964 sur 1100 au 2026-11-06. Dans le même
temps, `main` était rouge 56 runs sur 75 depuis le 2026-10-26. L'audit externe du 2026-11-06 en a
fait le constat **PRO-05** : une note qu'on s'attribue à soi-même ne mesure rien, elle se négocie, et
elle a pu rester haute pendant que l'instrument principal (la CI) était rouge. Chaque baisse du
tableau portait d'ailleurs la même cause : un instrument qui avait parlé sans que personne ne le
reprenne.

## Décision

- **Les notes sur 100 cessent de faire foi.** À leur place, **six indicateurs mesurés**, chacun avec sa
  **date de mesure** et sa **source**, générés dans [`docs/INDICATEURS.md`](../INDICATEURS.md) :
  1. le **taux de vert de `main`** (les 50 derniers runs conclus du `CI noyau`) ;
  2. le **délai de restauration éprouvé** (durée du dernier `drill-auto` vert, et sa date) ;
  3. la **couverture des parcours critiques** (liste déclarée dans `scripts/indicateurs.config.json`,
     chaque parcours devant avoir une spec `e2e/`) ;
  4. l'**âge maximal des secrets** (journal du dernier run de `Secrets age`, registre
     `.github/secrets-registry.json` en recours) ;
  5. la **dérive de la production** (`Deploy SHA drift`, `Edge deploy drift`, `Migration coverage`,
     c'est-à-dire le ledger des migrations) ;
  6. les **incidents ouverts** (issues ouvertes `ci-red` et `incident`).
- **Une valeur introuvable s'écrit « non mesuré »**, avec la raison, jamais un chiffre de repli. Un
  indicateur illisible compte comme une alerte : échec fermé.
- **Le calcul est un script sans dépendance** (`scripts/indicateurs.mjs`, `npm run indicateurs`), joué
  chaque lundi par `.github/workflows/indicateurs.yml`, qui pousse `docs/INDICATEURS.md` sur `main`
  avec des permissions minimales (le job qui mesure ne peut pas écrire, le job qui pousse ne
  mesure pas) et, sinon, sort le résultat dans le résumé du job et en artefact.
- **Seuils d'alerte**, qui passent par l'issue `ci-red` existante (`ci-alert.yml`) et ne se relèvent
  pas pour faire taire : `main` sous 80 % de vert ; aucun drill vert depuis 35 jours ; un secret
  au-delà de son échéance ou sans date de rotation connue ; une sonde de dérive de production rouge ;
  un audit externe en retard.
- **Un audit externe a lieu tous les six mois**, mené par quelqu'un qui n'a pas écrit le code. Le
  premier est celui du 2026-11-06, le prochain au plus tard le 2027-05-06. La date du dernier est
  une déclaration de `scripts/indicateurs.config.json`, recalée par Axel après chaque rapport.
  Les constats d'un audit ne s'écrivent pas dans le dépôt, qui est public (ADR 0008) : seules la date
  et les décisions qui en découlent y figurent.
- **Retrait des notes** : les notes restent écrites dans les docs jusqu'à la vague 19.4, qui les
  retire. Aucune nouvelle note ne s'écrit à compter de cette décision.

## Conséquences

- **Positives.** Un état de santé lisible sans jugement : les six valeurs se recalculent par une
  commande, se datent, et franchissent un seuil sans qu'on ait à le décider. Une dégradation de `main`
  ou de la restauration sonne par l'alerte existante, au lieu d'attendre la prochaine notation.
- **Négatives, à ne pas oublier en lisant le tableau.**
  - Six indicateurs ne couvrent pas tout : sécurité, accessibilité, SEO, RGPD gardent chacun leur
    doc et leurs gardes. L'absence d'indicateur n'est pas un bon état.
  - La couverture des parcours est une **couverture de présence** (une spec existe), pas un verdict
    d'exécution : les e2e sont joués par `CI etendue`, qui ne bloque pas. La liste des parcours est une
    décision humaine.
  - Le délai de restauration est celui d'un Postgres jetable du runner, pas d'un sinistre sur la
    plateforme Supabase.
  - L'âge d'un secret dépend de `Secrets age` : si ce workflow est illisible, l'âge retombe sur le
    registre, souvent sans date, ce qui sonne.
  - Le commit hebdomadaire du bot ne déclenche pas `CI noyau` (jeton du run) : même situation que
    le commit quotidien de `posture.yml`.
- Les premières mesures et leurs alertes se lisent dans [`docs/INDICATEURS.md`](../INDICATEURS.md),
  pas ici : un chiffre recopié dans un ADR est déjà périmé.
