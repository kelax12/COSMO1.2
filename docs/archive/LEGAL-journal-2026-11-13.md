> ⚠️ **ARCHIVE : récits et relevés datés, extraits de `docs/LEGAL.md` le 2026-11-13 (DOC-02), non maintenus.**
> Chaque bloc décrit l'état **à sa date** (certains sont démentis depuis : la chaîne de paiement est ACTIVE depuis le
> 2026-10-20). L'état courant est dans [`docs/LEGAL.md`](../LEGAL.md). Texte repris **sans une coupe** ; le titre de
> chaque bloc dit d'où il vient. Le code et la production font foi contre ce fichier.

# LEGAL · journal (extraits du 2026-11-13)

---
## En-tête · note de repassage du 2026-09-14

> **Vivant.** Établi le 2026-08-26 à partir de l'état réel du code, de la base et des comptes
> Stripe et Supabase. Décrit la situation courante, pas une cible. **Repassé le 2026-09-14** sur
> le seul point de la chaîne de paiement entreprise (§ État au 2026-09-14 et ligne E9) : la
> facturation est désarmée, vérifiée en base. Les autres sections n'ont pas été revérifiées à
> cette date et portent encore le statut du 2026-08-26.

## Où en es-tu · recomptages datés, état de fin de journée du 2026-08-26, familles de lignes rouges

> 🔎 **2026-11-05** : B1, B2 et B5 passent à ✅ (immatriculation RNE du 2026-10-20 et domiciliation, publiées le 2026-10-21) ; E5 réécrite après la refonte rétractation / résiliation du 2026-11-01.
>
> 🔎 **2026-11-01** : E2 remonte à ✅ (phrase précontractuelle remise).
>
> 🔎 **Recompté le 2026-10-31** (`npm run check:legal`) : la garde était rouge en arrivant, 18 / 21 / 16
> contre une synthèse à 19 / 20 / 17, et E2 vient de redescendre à 🟡 (retrait de l'information
> précontractuelle, `9eedd3ca`). ⚠️ **À remesurer depuis l'armement de la facturation (2026-10-20)** :
> E5 dit le portail Stripe vide (mesure du 2026-08-26) quand [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) le dit
> configuré le 2026-09-01, et E9 s'appuie encore sur une facturation dormante.
>
> 🔎 **Recompté par `node scripts/check-legal-table.mjs` le 2026-10-13**, après l'audit du jour :
> quatre lignes nouvelles (A15, E14, F10, F11), A2 remontée à ✅, A9 redescendue à 🟡. La garde
> était ROUGE en arrivant : A3 était passée à 🟡 le 2026-10-10 sans que la synthèse suive.

> 🔎 **Recompté par `node scripts/check-legal-table.mjs` le 2026-09-24**, après l'audit du jour :
> onze lignes nouvelles (A11 à A14, E10 à E13, F7 à F9), A2 redescendue à 🟡, A3 dégradée à ❌, F9 refermée le jour même.
> Le total monte parce que l'audit a **trouvé** des obligations, pas parce que la situation
> s'est dégradée : dix des onze lignes nouvelles sont refermées ou avancées le jour même.

> ⚠️ Seules les lignes E9 (🟡 → ✅) et A5 (❌ → 🟡) ont été revérifiées et recomptées le
> 2026-09-14 (cf. § État au 2026-09-14 et § DPA des sous-traitants). Les 44 autres lignes portent
> encore leur statut du 2026-08-26, **non revérifié** depuis : ne pas les lire comme un état
> courant sans repasser par leur source.

**Point de départ le matin du 2026-08-26 : 0 vert.** Sont passées au vert dans la journée :
A1, A2, A4, A7, A8, A9, C9, C10, E2, E3, E7, F3. **E9 les a rejointes le 2026-09-14** (A5 reste
🟡 : le DPA Supabase est acquis sans action, mais Sentry et Vercel dépendent encore d'Axel).

**Les 16 lignes rouges se répartissent en trois familles**, et une seule dépend encore de moi :

| Famille | Lignes | Qui agit |
|---|---|---|
| Actes juridiques ou administratifs | A5, B3, B4, B6, C2, C3, C12, D2, E4, F2 | **Axel seul.** Immatriculer, ouvrir un compte, adhérer, signer, déposer. Aucun code n'y change rien. |
| Réglages hors dépôt | C4, C5, C6, E5 | **Axel**, depuis le Dashboard Stripe. Deux minutes chacun, mais C4 à C6 supposent d'être immatriculé pour ne pas afficher une mention fausse. |
| Développement restant | C7 | Facturation électronique, qui suppose une plateforme agréée. **E6 est sortie de cette colonne** : construite et déployée le 2026-08-26, elle n'attend plus que trois secrets. |

**Les 11 lignes jaunes n'attendent aucun développement** : quatre sont des décisions déjà prises
qui attendent leur exécution (C1, C11, D1), et les autres un réglage de console, un contrat
signé ou un déploiement.

## État au 2026-09-14 : la chaîne de paiement est DÉSARMÉE (remplacé par l'armement live du 2026-10-20)

## 🟢 État au 2026-09-14 : la chaîne de paiement est DÉSARMÉE, mode entreprise gratuit sans plafond

> Remplace la section « État d'alerte au 2026-08-26 » ci-dessous, conservée pour l'historique.
> Reverifié le 2026-09-14 par lecture du code (`src/modules/billing/premium-config.ts`) **et**
> requête SQL en lecture seule sur la base de prod (`SELECT key, enabled FROM billing_flags`) —
> pas déduit d'une note plus ancienne.

| Vérification | Valeur réelle |
|---|---|
| `ENTERPRISE_BILLING_ENFORCED` (client) | **`false`** |
| `billing_flags.enterprise_seat_limit` (serveur) | **`false`** |
| Quota de sièges appliqué | **Aucun** — `org_seats_allowed()` ne bloque plus personne |
| Landing entreprise (`ENTERPRISE_FREE_OFFER`) | Affiche « Gratuit » partout, offre de lancement en cours |
| CTA de paiement (Stripe Checkout) | **Non monté** — personne ne peut arriver sur un Stripe Checkout |
| Abonnements souscrits | 0 |

**Conséquence directe sur ce document.** Tant que ce couple de drapeaux reste à `false`, tout le
bloc « premier euro encaissé » et le droit de la consommation lié au **paiement** (§3, E1, E4 à
E8) sont **dormants, pas résolus** : rien ne les déclenche parce qu'aucune transaction ne peut
avoir lieu. Ce n'est pas une mise en conformité, c'est l'absence du fait générateur — le jour où
`ENTERPRISE_BILLING_ENFORCED` repasse à `true`, la liste de réserves ci-dessous (E5 portail de
résiliation non configuré, STRIPE_SECRET_KEY de test, etc.) redevient intégralement valable.

- ✅ **E9 (garantie de conformité) n'est plus en défaut pour les deux phrases citées** :
  `enterprise.hero.reassuranceFree` et `enterprise.pricing.i5` (« résiliable/réversible à tout
  moment ») sont désormais **vraies par construction** — il n'y a pas d'abonnement à quitter,
  donc pas besoin d'un portail Stripe pour ça. La fonctionnalité de sortie (quitter/supprimer une
  organisation) existe indépendamment de la facturation (`src/modules/organizations/`).
- ⚠️ **Ne pas en conclure que E5/E6/E8 sont corrigées** : elles sont sans objet **aujourd'hui**
  parce qu'il n'y a rien à vendre, pas parce que le portail Stripe a été configuré ou que le
  webhook annuel a été câblé. Rien n'a changé côté Stripe depuis le 2026-08-26.
- ❌ **Ne jamais réarmer `ENTERPRISE_BILLING_ENFORCED` sans repasser par ce document.** Le
  réarmer sans avoir réglé E5 (portail) reproduit exactement l'impasse du 2026-08-26 : un client
  qui grandit se voit proposer de payer, tombe sur une clé Stripe de TEST, et ne peut pas non
  plus résilier.

### Historique — État d'alerte au 2026-08-26 (chaîne de paiement ARMÉE, depuis corrigé)

Vérifié en base et dans le code le même jour, pas déduit :

| Vérification | Valeur réelle au 2026-08-26 |
|---|---|
| `ENTERPRISE_BILLING_ENFORCED` (client) | `true` |
| `billing_flags.enterprise_seat_limit` (serveur) | `true` |
| `STRIPE_SECRET_KEY` en prod | clé de TEST |
| Configuration du portail de résiliation | absente, sur les deux comptes |
| Organisations | 4, dont 1 déjà au plafond |
| Abonnements souscrits | 0 |

**Le parcours réel d'un client à cette date :** son organisation atteint cinq membres, l'invitation
suivante est refusée par `org_seats_allowed`, l'écran lui propose de payer, il clique, arrive sur
un Stripe Checkout en **mode test**, et sa vraie carte est refusée. Il ne peut ni grandir, ni
payer. Et s'il voulait partir, la résiliation échouerait aussi.

**Issue retenue** : l'option 1 des trois proposées alors (« repasser `ENTERPRISE_BILLING_ENFORCED`
à `false` et le drapeau serveur à `false` ») a été appliquée — c'est l'état décrit dans la section
du dessus, vérifié à nouveau le 2026-09-14.

> ⚠️ Cet épisode n'a jamais présenté de risque juridique au sens strict : **aucun euro n'a été
> encaissé**, donc ni travail dissimulé ni TVA due. Le problème était une impasse produit pour le
> client qui essayait de payer, et une promesse de résiliation non tenue.

## § 1 · fin de paragraphe : tableau de départ du 2026-08-26

tableau de départ du 2026-08-26 qui figurait ici (registre « absent », procédure 72 h « à écrire »)
était démenti par ce tableau ; il se relit dans l'historique git.

## § 5 · Marque « COSMO », relevé d'antériorité du 2026-08-28 (repris et maintenu dans `docs/MARQUE-COSMO.md`)

### Marque « COSMO » — recherche d'antériorité faite le 2026-08-28

> ⚠️ **Ce n'est pas un avis juridique, et la source le dit elle-même.** TMview précise que ses
> données « ne constituent pas des registres officiels » et **n'ont aucun effet juridique**. Ce
> qui suit est un relevé factuel, destiné à ce qu'un conseil en propriété industrielle parte d'un
> dossier au lieu d'une page blanche.

**Méthode.** Interrogation de **TMview** (portail de l'EUIPO qui agrège 142 millions de marques,
INPI-France **et** EUIPO compris — c'est-à-dire exactement les deux registres que cette ligne
exigeait, en une seule requête). Périmètre : nom de marque contenant `COSMO`, offices **FR** et
**EM**, **classes 9** (logiciel téléchargeable) **et 42** (logiciel en tant que service). 536
résultats balayés, dont **21 portent le nom exactement `COSMO`**.

**Résultat : 11 marques `COSMO` exactes et ACTIVES** (enregistrées ou déposées).

| Classe | Titulaire | Office | Dépôt | Classes couvertes |
|---|---|---|---|---|
| **42** | Cosmo Technologies Limited | EM | 2022 | 5, 10, 42 |
| **42** | Cosmo Technologies Limited | EM | 2022 | 5, 10, 42 |
| **42** | ISTITUTO VENETO DI TERAPIA FAMIGLIARE SRL | EM | 2024 | 9, 16, 35, 41, **42**, 44 |
| **42** | COSMO PHARMACEUTICALS SPA | EM | 2012 | 5, 10, 42 |
| **9** | TANAZA S.p.A. | EM | 2020 | 9 |
| **9** | Cosmo Beheer B.V. | EM | 2016 | 9, 16, 35, 41 |
| **9** | Hearst Communications, Inc. | EM | 2006 | 9, 16, 41 |
| **9** | Halfords Limited | EM | 2010 | 9, 12, 28 |
| **9** | ten Haaft GmbH | EM | 2006 | 9 |
| **9** | GC Großhandels Contor GmbH | EM | 2008 | 6, 7, 9, 11, 17, 19, 37 |
| **9** | PIP GLOBAL SAFETY FRANCE SAS | **FR** | 1988 | 9 |

**Ce que ça répond.** La question posée par ce document était : *« l'enjeu réel n'est pas
"existe-t-il une marque COSMO" mais "une marque COSMO couvre-t-elle le logiciel" »*. La réponse
est **oui, plusieurs, et en vigueur dans l'Union**.

**Les deux lignes à regarder en premier**, parce qu'elles sont les plus proches de l'activité :

- **TANAZA S.p.A.** (EM, 2020, **classe 9 seule**) : éditeur de logiciel en nuage. C'est
  l'antériorité la plus proche du produit.
- **ISTITUTO VENETO DI TERAPIA FAMIGLIARE** (EM, 2024, **9 et 42**) : dépôt récent et très large,
  qui couvre les deux classes visées d'un coup.

Les trois marques pharmaceutiques (Cosmo Technologies, COSMO PHARMACEUTICALS) occupent la
classe 42 mais dans un secteur éloigné — c'est précisément le genre de nuance qu'un conseil
tranche, et pas ce document.

**Ce que ça ne dit pas, et qu'il ne faut pas déduire.** Rien ici ne dit que COSMO ne peut pas être
utilisé : l'appréciation d'un risque de confusion dépend des produits réellement visés, de la
notoriété et de la similarité d'ensemble. Ce relevé dit seulement que **le terrain est occupé
dans les deux classes**, donc qu'un dépôt à l'identique se heurterait très probablement à un
refus ou à une opposition, et qu'un usage n'est pas à l'abri d'une contestation.

**Suite à donner** : une consultation de conseil en PI, dossier en main. **Avant d'investir
davantage en acquisition** — se voir opposer une marque après le lancement oblige à renommer le
produit, le domaine et toute la communication.

**Reproduire ce relevé** : `https://www.tmdn.org/tmview/`, recherche `COSMO`, filtres Offices
`FR` + `EM` et Produits/Services `9` + `42`, puis ne retenir que les noms exactement `COSMO` dont
le statut est « Enregistrée » ou « Déposée ».

## Annexe art. 32 · limites 1 à 3 d'origine

1. ~~**Fenêtre du script de mesure d'audience.**~~ **Levée le 2026-10-18** : le script tiers est
   retiré (`faille.md` V-1). La mesure maison (`src/lib/traffic.ts`) ne charge aucun code tiers et
   revérifie l'absence de session avant chaque envoi.
2. **`style-src 'unsafe-inline'`** reste nécessaire à la chaîne de styles. C'est un
   assouplissement conscient de la CSP.
3. ~~**La CSP autorise les domaines publicitaires Google.**~~ **Refermé le 2026-09-04** (C-04) :
   le système de jetons et le mur-pub ont été supprimés, AdSense n'est plus chargé nulle part, et
   les origines publicitaires ont été **retirées de la CSP** de `vercel.json`. La réserve portait
   sur ce qui se serait passé le jour où `PREMIUM_ENFORCED` serait passé à `true` ; il n'y a plus
   de publicité à charger. ❌ Réintroduire un script publicitaire rouvrirait la question du
   consentement (ligne A4) : la publicité n'en est JAMAIS exemptée.

## Engagements envers les clients · bandeau « sans objet aujourd'hui » du 2026-09-14

> ⚠️ **Sans objet aujourd'hui** : `ENTERPRISE_BILLING_ENFORCED = false` (vérifié le 2026-09-14),
> aucun paiement n'est possible, donc aucun de ces engagements n'est actuellement dû. Ce tableau
> redevient actif le jour où la facturation est réarmée — voir § État au 2026-09-14.

