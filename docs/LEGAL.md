# LEGAL.md — obligations légales de COSMO

> **Vivant.** Établi le 2026-08-26 à partir de l'état réel du code, de la base et des comptes
> Stripe et Supabase. Décrit la situation courante, pas une cible.

> 🔴 **Ce document n'est pas un avis juridique.** Il est rédigé par un assistant, pas par un
> avocat ni un expert-comptable. Il sert à ne rien oublier et à savoir quoi demander. Aucune
> phrase ici ne protège en cas de contrôle. Les points marqués ⚠️ portaient, à cette date, sur
> des textes déjà modifiés au moins une fois : ils se revérifient à la source.

**Plan** : [État des lieux](#état-des-lieux-au-2026-08-26) · [La décision structurante](#-la-décision-structurante--tout-client-est-un-consommateur)
· [Actif aujourd'hui](#1-actif-aujourdhui-sans-structure) · [À la création](#2-à-la-création-de-la-structure)
· [Au premier euro](#3-au-premier-euro-encaissé) · [Droit de la consommation](#4-droit-de-la-consommation)
· [Produit et marque](#5-produit-marque-et-dépendances) · [Sous-traitants](#6-sous-traitants-et-transferts)
· [Garde-fous](#-garde-fous-techniques) · [Décisions ouvertes](#décisions-encore-ouvertes)

---

## État des lieux au 2026-08-26

| Sujet | État vérifié |
|---|---|
| Structure juridique | **Aucune.** Ni micro-entreprise, ni société. |
| Encaissement réel | **Aucun.** La prod tourne sur une clé Stripe de TEST. |
| Compte Stripe live | Équipé de 8 prix le 2026-08-26, `tax_behavior: inclusive`. Aucun client. Voir [`STRIPE-LIVE.md`](./STRIPE-LIVE.md). |
| Enregistrements fiscaux Stripe Tax | **Zéro**, dans aucun pays. Stripe ne collecte donc aucune taxe. |
| Base de données | Supabase, région `eu-west-1` (Irlande). **Données dans l'Union.** |
| Hébergement front | Vercel, projet `cosmo1`. Région non vérifiée (accès refusé au compte connecté). |
| Utilisateurs réels | ~27 comptes lifetime, avec adresse email. **Le RGPD s'applique déjà.** |
| Marché visé | France uniquement à court terme. |
| Chiffre d'affaires visé | Non déterminé. Les trois scénarios sont traités plus bas. |
| Expert-comptable | Aucun, et Axel envisage de s'en passer. Voir l'encadré dédié. |
| Domiciliation | **Pas au domicile personnel.** Modalité exacte non arrêtée. |

### ⚠️ Se passer d'expert-comptable

C'est possible en micro-entreprise, et beaucoup le font. Trois points, factuels, où ce choix
fait porter un risque réel et non évident :

1. **Le choix de forme juridique** engage les cotisations pour des années. L'écart entre micro,
   EURL et SASU se chiffre en milliers d'euros par an, dans un sens qui dépend des charges
   réelles. C'est un arbitrage difficile à faire seul, et coûteux à corriger.
2. **L'autoliquidation de la TVA sur les achats étrangers** (voir §3) est la règle la plus
   souvent ignorée des micro-entrepreneurs. Elle s'applique même en franchise en base.
3. **Le franchissement du seuil de TVA** est immédiat et rétroactif au mois en cours, pas
   différé à l'année suivante. Le rater se paie en régularisation.

Un rendez-vous ponctuel de cadrage, sans mission de suivi, couvre ces trois points pour un coût
limité. Ce n'est pas la même dépense qu'une mission annuelle.

---

## 🔴 La décision structurante : tout client est un consommateur

Axel a tranché le 2026-08-26 : **un particulier doit pouvoir acheter l'offre entreprise**, et
COSMO n'exigera jamais la preuve d'une qualité professionnelle. Vérifié dans le code : aucun
contrôle de SIRET, de raison sociale ou de numéro de TVA n'existe dans le parcours.

**Conséquence juridique.** Le droit regarde qui achète, pas le nom du plan. Un plan appelé
« entreprise » vendu sans vérification à qui le demande est, pour partie, une vente à des
consommateurs. Tout le §4 s'applique donc, à toute l'offre.

- ❌ **Ne jamais raisonner « c'est une offre entreprise, donc c'est du B2B ».** C'est
  exactement le raccourci que cette décision interdit.
- La question du premium particulier (`PREMIUM_ENFORCED`) est **sans objet** pour ce document :
  qu'il soit activé ou non, la clientèle est déjà en partie composée de consommateurs.
- Le correctif retenu n'est pas de fermer la porte mais de **qualifier** : `tax_id_collection`
  natif de Stripe, plus un champ SIRET **facultatif**. Personne n'est bloqué ; ceux qui se
  déclarent professionnels sortent du droit de la consommation et alimentent la TVA. **Décidé
  le 2026-08-26, pas encore implémenté.**

---

## 1. Actif aujourd'hui, sans structure

Ces obligations ne dépendent ni d'une société ni d'un chiffre d'affaires. Elles se déclenchent
parce qu'un service en ligne traite les données de personnes réelles. **Elles sont en défaut
partiel aujourd'hui.**

| Obligation | Référence | État |
|---|---|---|
| Registre des activités de traitement | RGPD art. 30 | ❌ absent (`docs/RGPD.md` est technique, ce n'est pas un registre) |
| Politique de confidentialité complète | RGPD art. 12 à 14 | ⚠️ à auditer contre les 12 mentions |
| Mentions légales | LCEN art. 6-III | ⚠️ à compléter, et à reprendre après immatriculation |
| Consentement aux traceurs | Loi I&L art. 82 | ⚠️ statut de l'analytics à trancher |
| Contrats de sous-traitance | RGPD art. 28 | ❌ à collecter et archiver, voir §6 |
| Encadrement des transferts hors UE | RGPD chap. V | ⚠️ voir §6 |
| Procédure de violation sous 72 h | RGPD art. 33 | ❌ à écrire, à froid |
| Exercice des droits | RGPD art. 15 à 22 | ⚠️ vérifier que l'export et la suppression couvrent toutes les tables |

> Le risque de contrôle CNIL sur 27 utilisateurs est proche de zéro. La raison de traiter ce
> bloc n'est pas la peur : ces documents sont **réclamés par les acheteurs B2B** dans leurs
> questionnaires d'achat. Les produire coûte une journée aujourd'hui.

---

## 2. À la création de la structure

- **Forme juridique** : micro, EI au réel, EURL ou SASU. Détermine cotisations, déductions,
  protection patrimoniale et coût comptable. Voir l'encadré sur l'expert-comptable.
- **Immatriculation** au guichet unique de l'INPI, qui déclenche SIREN et SIRET.
- **Compte bancaire dédié** : obligatoire pour une société ; en micro, seulement au-delà de
  10 000 € de chiffre d'affaires deux années consécutives.
- **Déclaration CFE initiale** avant le 31 décembre de l'année de création. Exonération la
  première année, mais **la déclaration reste due**. Échéance très souvent manquée.
- **Domiciliation** : Axel a exclu son domicile personnel. Reste à arbitrer entre société de
  domiciliation, pépinière ou coworking. L'adresse retenue devient publique au registre des
  entreprises et dans les mentions légales, **de façon durable dans les archives**.
- **Assurance RC pro** : pas obligatoire pour l'édition de logiciel, mais exigée
  contractuellement par la plupart des acheteurs entreprise.

---

## 3. Au premier euro encaissé

> 🔴 **Encaisser avant l'immatriculation est du travail dissimulé.** C'est le seul point de ce
> document qui relève du pénal, et non d'une amende administrative. Aucun bouton de paiement
> réel ne doit être ouvert avant l'obtention du SIREN.

### TVA : trois scénarios, puisque le chiffre d'affaires n'est pas déterminé

| Scénario | Conséquence |
|---|---|
| Moins de 10 000 € | Franchise en base. Mention obligatoire « TVA non applicable, art. 293 B du CGI » sur chaque facture. Aucun guichet européen. |
| 10 000 à 37 500 € | Toujours en franchise côté français. Le seuil européen de 10 000 € de ventes numériques à des consommateurs peut être franchi, ce qui ouvre le guichet OSS. Sans objet tant que le marché reste français. |
| Au-delà de 37 500 € | ⚠️ Sortie de la franchise. Seuils services : 37 500 € en base, 41 250 € en seuil majoré. Une réforme du seuil unique a été votée puis suspendue, **à revérifier à la date de création**. |

**Le franchissement est immédiat.** Au-delà du seuil majoré, la TVA est due dès le premier jour
du mois de dépassement, sur les ventes déjà encaissées ce mois-là.

### 🔴 L'effet TTC sur la marge

Les 8 prix live sont en `tax_behavior: inclusive`, réglage **définitif** chez Stripe. C'est le
bon choix : l'affichage TTC est obligatoire pour des consommateurs, et tous les clients en sont
potentiellement. Mais la conséquence économique doit être intégrée au modèle **maintenant** :

> Le jour de l'assujettissement, un abonnement affiché **20 € TTC** ne rapporte plus que
> **16,67 €**. Soit **17 % de marge en moins**, sans qu'aucun prix affiché ne bouge, et sans
> possibilité d'augmenter les prix des abonnés existants sans les prévenir.

### L'autoliquidation sur les achats, due même en franchise

Toute la stack est étrangère : Supabase, Vercel, Sentry, les frais Stripe. L'achat de services
à un prestataire établi hors de France oblige à **autoliquider la TVA française**, c'est à dire
la déclarer et la payer, **y compris en franchise en base**. Cela suppose de demander un numéro
de TVA intracommunautaire.

- ❌ **Ne pas confondre avec les ventes.** Stripe Tax ne connaît que ce que tu vends. Tes achats
  lui sont totalement invisibles. Aucun réglage Stripe ne couvre ce point.
- C'est la règle la plus fréquemment ignorée, et la première à poser à un professionnel.

### Facturation

- Mentions obligatoires et **numérotation chronologique continue, sans trou**
  (Code de commerce art. L441-9, CGI ann. II art. 242 nonies A). À vérifier sur le modèle de
  facture Stripe, qui n'est pas configuré pour la France par défaut.
- ⚠️ **Facturation électronique** : réception obligatoire pour tous, puis émission par vagues
  via une plateforme agréée. Calendrier décalé plusieurs fois, à revérifier. Chantier plus
  lourd que la conformité du logiciel d'encaissement.

### Conformité du logiciel d'encaissement (dite « NF525 »)

L'obligation vise les assujettis à la TVA qui enregistrent les règlements de clients
**particuliers** dans un logiciel. Le système doit être inaltérable, sécurisé, conservé et
archivé, justifié par une certification payante ou par une **attestation individuelle gratuite**
signée par l'éditeur, donc par Axel lui-même.

État constaté : `org_subscriptions` est un instantané **muté en place** par le webhook Stripe, et
`processed_stripe_events` n'est qu'une table de déduplication technique. **Aucun journal
d'encaissement inaltérable n'existe.**

- ❌ **Ne pas signer l'attestation sans avoir construit le journal.** Une attestation mensongère
  est pire que pas d'attestation.
- ⚠️ **Ne pas construire le journal avant d'avoir tranché un point** : une entreprise en
  franchise en base est-elle visée ? La réponse détermine 2 à 4 jours de développement.

### Conservation

Dix ans pour les pièces comptables, six ans de présentation à l'administration fiscale. Aucune
purge, y compris motivée par le RGPD, ne doit atteindre les données de facturation.

---

## 4. Droit de la consommation

S'applique **à toute l'offre**, par l'effet de la décision structurante.

| Obligation | Référence | Notes |
|---|---|---|
| CGV communiquées avant le contrat | Conso. art. L111-1, L221-5 | À faire rédiger. Un modèle générique est un risque, pas une protection. |
| Droit de rétractation de 14 jours | Conso. art. L221-18, L221-28 | Écartable pour un contenu numérique **seulement** avec accord exprès à l'exécution immédiate **et** renonciation explicite. **Les deux cases, pas une.** |
| Médiateur de la consommation | Conso. art. L612-1, L616-1 | **Adhésion payante et obligatoire**, coordonnées à publier. Oubli classique, sanctionné par la DGCCRF. |
| Résiliation en ligne | Conso. art. L215-1-1 | ✅ probablement satisfait par `stripe-org-portal`, **à tester réellement**. |
| Information de reconduction tacite | Conso. art. L215-1 | 🔴 Déclenchée par la facturation **annuelle** livrée le 2026-08-25. À automatiser. |
| Prix TTC affichés | Conso. art. L112-1 | ✅ cohérent avec `tax_behavior: inclusive`. Reste à afficher la mention. |
| Bouton de commande explicite | Conso. art. L221-14 | « Commande avec obligation de paiement ». Un simple « Valider » rend le contrat inopposable. |
| Garantie de conformité du service numérique | Conso. art. L224-25-1 s. | ⚠️ Une fonctionnalité promise sur la landing et non livrée devient un défaut opposable. |

---

## 5. Produit, marque et dépendances

- 🔴 **Marque « COSMO » : aucune recherche d'antériorité n'a jamais été faite.** Nom court et
  très générique, donc risque d'antériorité élevé. Se voir opposer une marque après le lancement
  oblige à renommer le produit, le domaine et toute la communication. **À faire avant d'investir
  davantage en acquisition**, c'est le meilleur rapport coût sur risque de tout ce document.
- **Licences open source** des dépendances : inventaire à produire, attribution à publier, et
  vérification qu'aucune licence à réciprocité forte n'est embarquée dans un produit
  propriétaire.
- ⚠️ **Accessibilité** : la législation européenne vise les services numériques marchands, avec
  une exemption pour les microentreprises appréciée sur l'effectif et le chiffre d'affaires.
  Vérifier l'exemption, et surveiller le seuil. Utile commercialement en B2B de toute façon.
- ⚠️ **Intelligence artificielle** : si la direction produit vers des agents IA se concrétise,
  obligation d'informer clairement l'utilisateur qu'il interagit avec une IA. À prévoir dès la
  conception.
- **Partage entre utilisateurs** : la législation européenne sur les services numériques exempte
  largement les micro et petites entreprises, mais pas de tout. Qualification à faire.

---

## 6. Sous-traitants et transferts

| Prestataire | Rôle | Localisation | À faire |
|---|---|---|---|
| Supabase | base de données, auth | **`eu-west-1`, Irlande** | DPA à archiver. Données dans l'UE, c'est le point le plus confortable du dossier. |
| Vercel | hébergement front | société américaine, région du projet non vérifiée | DPA + mécanisme de transfert. Traite au minimum les adresses IP et les logs, qui sont des données personnelles. |
| Stripe | paiement | Irlande et États-Unis | DPA. Devient responsable de traitement pour ses propres finalités antifraude. |
| Sentry | monitoring | société américaine | DPA + transfert. `beforeSend` retire déjà emails et UUID, à documenter comme mesure de minimisation. |
| Analytics | mesure d'audience | à qualifier | Déterminer si l'exemption CNIL de consentement s'applique, sinon passer derrière le bandeau. |

- ❌ **Ne jamais ajouter un prestataire traitant des données sans archiver son DPA.** C'est la
  pièce que réclame un acheteur entreprise, et elle ne se reconstitue pas après coup.

---

## 🚫 Garde-fous techniques

- ❌ **Ne pas ouvrir de bouton de paiement réel avant l'obtention du SIREN.**
- ❌ **Ne jamais créer un prix Stripe sans `tax_behavior` explicite.** Le réglage est définitif ;
  les 8 prix du compte de TEST sont sur `unspecified`, valeur à ne pas reproduire.
- ❌ **Ne pas activer la collecte Stripe Tax tant que la franchise en base s'applique.** Aucun
  enregistrement fiscal n'existe, il n'y a rien à collecter.
- ❌ **Ne pas raisonner « offre entreprise donc B2B ».** Voir la décision structurante.
- ❌ **Ne pas laisser une purge RGPD atteindre les données de facturation** (10 ans).
- ❌ **Ne pas signer l'attestation de conformité d'encaissement** avant d'avoir construit le
  journal inaltérable.
- ❌ **Ne pas promettre sur la landing une fonctionnalité non livrée** : c'est un défaut de
  conformité opposable par un consommateur.

---

## Décisions encore ouvertes

1. **Modalité de domiciliation** : le domicile personnel est écarté, le remplaçant reste à
   choisir.
2. **Forme juridique** : non arbitrée, et c'est la décision la plus lourde.
3. **Chiffre d'affaires visé** : non déterminé, donc le calendrier TVA reste théorique.
4. **Franchise en base et conformité d'encaissement** : point technique à faire trancher, il
   vaut 2 à 4 jours de développement.
5. **`tax_code` des produits Stripe** : non renseigné. Détermine le taux appliqué par pays le
   jour où Stripe Tax est activé.
6. **Champ SIRET facultatif et `tax_id_collection`** : décidé, non implémenté.

---

## Ordre de traitement recommandé

1. Recherche d'antériorité sur le nom. Le moins cher, le plus coûteux à reporter.
2. Bloc RGPD du §1, environ une journée, gratuit.
3. Implémenter `tax_id_collection` et le champ SIRET facultatif.
4. Rendez-vous de cadrage ponctuel avec un expert-comptable, en portant ce document.
5. Création de la structure.
6. Bloc consommation du §4, avant tout paiement réel.
7. Bascule Stripe en live, selon [`STRIPE-LIVE.md`](./STRIPE-LIVE.md).
