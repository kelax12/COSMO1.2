# LEGAL.md — obligations légales de COSMO

> **Vivant.** Établi le 2026-08-26 à partir de l'état réel du code, de la base et des comptes
> Stripe et Supabase. Décrit la situation courante, pas une cible.

> 🔴 **Ce document n'est pas un avis juridique.** Il est rédigé par un assistant, pas par un
> avocat ni un expert-comptable. Il sert à ne rien oublier et à savoir quoi demander. Aucune
> phrase ici ne protège en cas de contrôle. Les points marqués ⚠️ portaient, à cette date, sur
> des textes déjà modifiés au moins une fois : ils se revérifient à la source.

**Plan** : [État des lieux](#état-des-lieux-au-2026-08-26) · [**Tableau de conformité**](#-tableau-de-conformité) · [État d'alerte](#-état-dalerte-au-2026-08-26--la-chaîne-de-paiement-est-armée) · [La décision structurante](#-la-décision-structurante--tout-client-est-un-consommateur)
· [Actif aujourd'hui](#1-actif-aujourdhui-sans-structure) · [À la création](#2-à-la-création-de-la-structure)
· [Au premier euro](#3-au-premier-euro-encaissé) · [Droit de la consommation](#4-droit-de-la-consommation)
· [Produit et marque](#5-produit-marque-et-dépendances) · [Sous-traitants](#6-sous-traitants-et-transferts)
· [Garde-fous](#-garde-fous-techniques) · [Annexe art. 32](#annexe--mesures-techniques-et-organisationnelles-art-32) · [Décisions ouvertes](#décisions-encore-ouvertes)

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

## 📋 Tableau de conformité

**Légende** : ✅ bon · 🟡 partiellement bon · ❌ à faire · ⬜ sans objet aujourd'hui

> ⚠️ **Ce tableau au vert ne vaut pas conformité.** Il est établi par un assistant, contre
> l'état du code à une date. Trois raisons pour lesquelles « tout vert » ne veut pas dire
> « en règle » : certaines lignes exigent un jugement professionnel que je ne peux pas rendre
> (§ franchise en base et logiciel d'encaissement), les textes bougent, et un contrôleur
> apprécie la situation réelle. Le tableau sert à ne rien oublier et à mesurer l'avancement,
> pas à délivrer un quitus.

### A. Données personnelles — **actif dès aujourd'hui**, sans structure

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| A1 | Registre des activités de traitement (art. 30) | ❌ | Aucun document au format attendu. `docs/RGPD.md` est un doc technique, pas un registre. |
| A2 | Politique de confidentialité (art. 12 à 14) | ✅ | Complétée le 2026-08-26. Trois trous comblés : **Sentry et Vercel Analytics** étaient absents de la liste des sous-traitants, une section **7 bis sur les transferts hors UE** manquait entièrement (art. 13.1.f), et la section Cookies affirmait que Vesk ne requiert pas de consentement, phrase devenue **fausse** depuis A4. Délai de réponse aligné sur « un mois » (art. 12) au lieu de 30 jours. |
| A3 | Mentions légales (LCEN art. 6-III) | 🟡 | `MentionsLegalesPage.tsx` existe, avec email éditeur et les deux hébergeurs. Manque l'identité complète, à ajouter **après immatriculation** (dénomination, SIREN, RCS, TVA, directeur de publication). |
| A4 | Consentement aux traceurs (art. 82) | ✅ | Corrigé le 2026-08-26. Un store unique (`src/lib/cookie-consent.ts`) conditionne les **trois** surfaces : le script Vesk (`audience.ts`), `<Analytics />` de Vercel (`App.tsx`) et le bandeau. Rien ne se charge tant que la réponse n'est pas donnée, `null` n'étant pas une acceptation tacite ; accepter monte la mesure sans rechargement ; refuser ne la monte jamais. 5 tests dédiés. |
| A5 | Contrats de sous-traitance (art. 28) | ❌ | Aucun DPA collecté ni archivé. Voir §6 pour la liste. |
| A6 | Transferts hors UE (chap. V) | 🟡 | ✅ Supabase en `eu-west-1`, donc dans l'Union, et l'**information** due à la personne est faite (section 7 bis de la politique, art. 13.1.f). ❌ Reste la **preuve contractuelle** : les clauses types vivent dans les DPA de Vercel et Sentry, qu'il faut accepter et archiver en tant qu'entreprise. Dépend donc de A5, donc de l'immatriculation. |
| A7 | Notification de violation sous 72 h (art. 33) | ❌ | Aucune procédure écrite. À rédiger à froid, le délai ne permet pas d'improviser. |
| A8 | Droits des personnes (art. 15 à 22) | ✅ | Complété le 2026-08-26. L'export ne couvrait que tâches, habitudes, événements et OKR : **profil, catégories et listes manquaient**, alors que le nom et l'adresse sont les données les plus évidemment « fournies par la personne ». Sept fichiers désormais, et le périmètre exact est annoncé dans la politique. Effacement par `delete-account`. Délai d'un mois documenté, prolongation de deux mois prévue. |
| A9 | Sécurité du traitement (art. 32) | ✅ | Mesures formalisées en [annexe](#annexe--mesures-techniques-et-organisationnelles-art-32), limites comprises. Vérifiées dans `vercel.json`, `src/main.tsx` et les migrations. Formalisé le 2026-08-26. |
| A10 | Analyse d'impact (art. 35) | ⬜ | Probablement non requise pour ce traitement. À confirmer, et à réexaminer si des agents IA traitent du contenu utilisateur. |

### B. Structure juridique — **se déclenche à la création**

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| B1 | Choix de la forme juridique | ❌ | Non arbitré. Décision la plus lourde du document. |
| B2 | Immatriculation au guichet unique INPI | ❌ | Aucun SIREN. **Bloquant absolu de tout encaissement.** |
| B3 | Compte bancaire dédié | ❌ | Obligatoire pour une société ; en micro, au-delà de 10 000 € deux années de suite. |
| B4 | Déclaration CFE initiale | ❌ | À déposer avant le 31 décembre de l'année de création. Exonération la 1re année mais **la déclaration reste due**. |
| B5 | Domiciliation | ❌ | Le domicile personnel est écarté. Modalité de remplacement non choisie. |
| B6 | Assurance RC professionnelle | ❌ | Pas obligatoire légalement, mais exigée contractuellement par les acheteurs entreprise. |

### C. Fiscal et facturation — **se déclenche au premier euro**

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| C1 | Régime de TVA à déterminer | ❌ | ⚠️ Seuils services 37 500 € et 41 250 €, réforme du seuil unique votée puis suspendue. À revérifier à la date de création. |
| C2 | Numéro de TVA intracommunautaire | ❌ | Nécessaire **même en franchise en base**, à cause de C3. |
| C3 | Autoliquidation de la TVA sur les achats étrangers | ❌ | 🔴 Due dès aujourd'hui si la structure existait : Supabase, Vercel, Sentry et les frais Stripe sont tous étrangers. **Stripe Tax ne couvre pas ce point**, il ne connaît que les ventes. Règle la plus souvent ignorée. |
| C4 | Mention « TVA non applicable, art. 293 B du CGI » | ❌ | À configurer dans les factures Stripe tant que la franchise s'applique. Pas posé par défaut. |
| C5 | Mentions obligatoires des factures | ❌ | Le modèle Stripe n'est pas configuré pour la France. À auditer contre L441-9 et 242 nonies A. |
| C6 | Numérotation chronologique continue | ❌ | À vérifier côté Stripe : aucune rupture de séquence ne doit être possible. |
| C7 | Facturation électronique | ❌ | ⚠️ Calendrier décalé plusieurs fois. Chantier plus lourd que C9. |
| C8 | Guichet OSS (ventes B2C dans l'UE) | ⬜ | Sans objet tant que le marché reste français. Se déclenche au-delà de 10 000 € de ventes numériques à des consommateurs européens. |
| C9 | Conformité du logiciel d'encaissement | ❌ | Aucun journal inaltérable : `org_subscriptions` est **muté en place** par le webhook, `processed_stripe_events` n'est qu'une déduplication technique. ⚠️ Trancher d'abord si la franchise en base est visée : la réponse vaut 2 à 4 jours de développement. |
| C10 | Conservation des pièces | ❌ | 10 ans comptable, 6 ans fiscal. Aucune purge, RGPD comprise, ne doit les atteindre. |
| C11 | Comptabilité (livre des recettes ou complète) | ❌ | Selon la forme retenue en B1. |
| C12 | Déclarations fiscales annuelles | ❌ | Selon la forme retenue en B1. |

### D. Social — **se déclenche à la création, puis à l'embauche**

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| D1 | Affiliation sociale du dirigeant | ❌ | Indépendant ou assimilé salarié selon B1. Écart de plusieurs milliers d'euros par an. |
| D2 | Déclarations et cotisations URSSAF | ❌ | Dues même sans rémunération dans certains cas. |
| D3 | Obligations d'employeur | ⬜ | Aucun salarié. Se déclenche au premier : DPAE, convention collective, DUERP, mutuelle, santé au travail, DSN, registre du personnel. |

### E. Droit de la consommation — **s'applique à TOUTE l'offre**

Par l'effet de la décision structurante ci-dessous : aucun client n'est vérifié comme professionnel.

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| E1 | CGV communiquées avant le contrat | 🟡 | Section 5 réécrite le 2026-08-26 : elle décrit enfin **l'offre réellement vendue** (forfaits entreprise et non un « premium » inexistant), l'affichage TTC, la reconduction, la résiliation et le retour au forfait gratuit sans retrait de membre. Section 5 bis ajoutée pour la rétractation. ❌ Reste : les coordonnées du **médiateur** (dépend de E4, adhésion payante non souscrite) et une relecture juridique. |
| E2 | Information précontractuelle | ❌ | Caractéristiques essentielles, prix TTC, durée, reconduction, à présenter avant la validation. |
| E3 | Rétractation 14 jours et double consentement | ✅ | Implémenté le 2026-08-26 dans `OrgBillingTab` : **deux cases distinctes**, jamais pré-cochées, demande expresse d'exécution immédiate **et** reconnaissance de renonciation. Sans les deux, `onSelect` n'est pas monté, donc aucun paiement ne peut être engagé. Recueilli côté COSMO et non via `consent_collection` de Stripe, qui exige une URL de CGV au Dashboard dont l'absence ferait **échouer** la création de session. CGU alignées (section 5 bis). |
| E4 | Médiateur de la consommation | ❌ | Adhésion **payante et obligatoire**, coordonnées à publier dans les CGV et sur le site. Oubli classique, sanctionné par la DGCCRF. |
| E5 | Résiliation en ligne (L215-1-1) | ❌ | 🔴 **Dégradé de 🟡 à ❌ le 2026-08-26 après vérification.** `/v1/billing_portal/configurations` renvoie **vide sur les DEUX comptes**, test et live : le portail client n'a jamais été configuré. `stripe-org-portal` ne passe aucun `configuration`, il compte donc sur un défaut inexistant, et Stripe refuse de créer la session tant que les réglages n'ont pas été enregistrés au Dashboard. La fonction porte d'ailleurs déjà l'alerte « customer cannot manage or cancel ». **Le bouton existe, la résiliation ne marche pas.** Correctif : Dashboard Stripe → Settings → Billing → Customer portal, activer l'annulation d'abonnement, enregistrer, sur les deux comptes. Non faisable par API depuis ici. |
| E6 | Information de reconduction tacite | ❌ | 🔴 Déclenchée par la facturation **annuelle** livrée le 2026-08-25. Aucun envoi automatisé. |
| E7 | Affichage des prix TTC | ✅ | Les 8 prix live sont en `tax_behavior: inclusive`, et la mention « Tous les prix sont affichés TTC » est rendue sous la grille publique (`PricingSection.tsx`) **et** sous la grille produit (`OrgBillingTab.tsx`), en fr et en en. Corrigé le 2026-08-26. |
| E8 | Bouton de commande explicite | 🟡 | `custom_text.submit.message` ajouté dans `stripe-org-checkout` le 2026-08-26 : « commande avec obligation de paiement », reconduction et résiliation annoncées avant le clic. `submit_type` n'existe pas en `mode: 'subscription'`, le libellé du bouton Stripe n'est donc pas réécrivable. ⚠️ **Passe au vert au redéploiement de la fonction**, la prod tourne encore sur l'ancienne version. |
| E9 | Garantie de conformité du service numérique | 🟡 | Audit fait le 2026-08-26 sur les 216 chaînes du parcours entreprise. **Bonne nouvelle** : aucune intégration inexistante n'est promise (ni SSO, ni API, ni Slack), et les réponses de la FAQ sur le cloisonnement et le non-retrait de membres sont exactes. **Deux promesses non tenues** : `pricing.i5` « résiliable à tout moment » et `hero.reassurance` « réversible à tout moment », alors que la résiliation ne fonctionne pas (E5). Le correctif est E5, pas un retrait de la phrase. |

### F. Produit, marque et dépendances

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| F1 | Recherche d'antériorité sur le nom | ❌ | 🔴 **Jamais faite.** Nom court et générique, risque élevé. Meilleur rapport coût sur risque du document : à faire avant d'investir davantage en acquisition. |
| F2 | Dépôt de marque INPI | ❌ | Pas obligatoire, mais sans dépôt aucun droit exclusif sur le nom. Dépend de F1. |
| F3 | Conformité des licences open source | ❌ | Inventaire à produire, attributions à publier, absence de licence à réciprocité forte à vérifier. |
| F4 | Accessibilité (législation européenne) | 🟡 | Un travail a été engagé côté produit (`docs/ACCESSIBILITY.md`). ⚠️ Exemption microentreprise à vérifier, et seuil à surveiller. Demandé par les acheteurs B2B de toute façon. |
| F5 | Transparence des systèmes d'IA | ⬜ | ⚠️ Se déclenche si la direction produit vers des agents IA se concrétise. À prévoir dès la conception. |
| F6 | Obligations liées au partage entre utilisateurs | ⬜ | Micro et petites entreprises largement exemptées, mais pas de tout. Qualification à faire. |

### Où en es-tu

| Statut | Nombre |
|---|---|
| ✅ Bon | 6 |
| 🟡 Partiellement bon | 6 |
| ❌ À faire | 27 |
| ⬜ Sans objet aujourd'hui | 6 |

Six lignes sont pleinement vertes, et **six à moitié faites** : les pages
légales existent, l'export et la suppression de compte fonctionnent, la sécurité technique est
sérieuse, la base est dans l'Union et le réglage TTC est correct. L'essentiel du reste ne peut
pas passer au vert avant l'immatriculation, qui est le vrai verrou.

---

## 🔴 État d'alerte au 2026-08-26 : la chaîne de paiement est ARMÉE

Vérifié en base et dans le code le même jour, pas déduit :

| Vérification | Valeur réelle |
|---|---|
| `ENTERPRISE_BILLING_ENFORCED` (client) | **`true`** |
| `billing_flags.enterprise_seat_limit` (serveur) | **`true`** |
| `STRIPE_SECRET_KEY` en prod | clé de **TEST** |
| Configuration du portail de résiliation | **absente**, sur les deux comptes |
| Organisations | 4, dont **1 déjà au plafond** |
| Abonnements souscrits | **0** |

**Le parcours réel d'un client aujourd'hui :** son organisation atteint cinq membres, l'invitation
suivante est refusée par `org_seats_allowed`, l'écran lui propose de payer, il clique, arrive sur
un Stripe Checkout en **mode test**, et sa vraie carte est refusée. Il ne peut ni grandir, ni
payer. Et s'il voulait partir, la résiliation échouerait aussi.

Une seule organisation est concernée à cette date, mais le chemin est ouvert pour toutes.

**Trois issues, à choisir en connaissance de cause :**

1. **Repasser `ENTERPRISE_BILLING_ENFORCED` à `false` et le drapeau serveur à `false`** en attendant
   l'immatriculation. Les deux se déplacent ENSEMBLE, jamais l'un sans l'autre. C'est le retour
   à l'état sûr, et c'est réversible en deux minutes.
2. **Configurer le portail Stripe** pour qu'au moins la résiliation fonctionne, en acceptant que
   le paiement reste en mode test.
3. **Immatriculer, passer Stripe en live**, et tout devient cohérent.

> ⚠️ Aucune de ces issues n'est urgente au sens du risque juridique : **aucun euro n'est encaissé**,
> donc il n'y a ni travail dissimulé ni TVA due. Le problème est d'abord une impasse produit pour
> le client qui essaie de payer, et une promesse de résiliation non tenue.

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

## Annexe — mesures techniques et organisationnelles (art. 32)

> Pièce prévue par l'article 32 du RGPD, réclamée en contrôle CNIL et dans les questionnaires
> d'achat B2B. Chaque ligne est vérifiée dans le code au 2026-08-26, avec sa source. Le détail
> d'implémentation vit dans [`SECURITY.md`](./SECURITY.md), qui n'est pas dupliqué ici.

### Mesures en place

| Mesure | Mise en œuvre vérifiée | Source |
|---|---|---|
| Chiffrement en transit | HSTS `max-age=63072000`, `includeSubDomains`, `preload`. Aucun accès en clair. | `vercel.json` |
| Localisation des données | Supabase `eu-west-1` (Irlande). Aucun transfert hors UE pour la base. | console Supabase |
| Cloisonnement par utilisateur | RLS activée sur **toutes** les tables, une seule policy permissive par rôle et action (mig. 049). Isolation prouvée par test d'intégration. | `supabase/migration/`, `e2e/rls/` |
| Contrôle d'accès | Supabase Auth. `ProtectedRoute` est une défense en profondeur, **la frontière est la RLS**, jamais le client. | `src/App.tsx` |
| Moindre privilège | `service_role` jamais exposé au navigateur. Les helpers sensibles ont `EXECUTE` révoqué à `authenticated` (mig. 100). | `.env.example`, migrations |
| Maîtrise des écritures | Whitelist `mapToDb` côté repository, validation `zod` en garde UX. La whitelist est la barrière, pas `zod`. | `src/lib/validation/` |
| Anti-XSS et injection de contenu | CSP stricte : `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. | `vercel.json` |
| Anti-clickjacking | `X-Frame-Options: DENY` **et** `frame-ancestors 'none'`. | `vercel.json` |
| Durcissement navigateur | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` fermant caméra, micro et géolocalisation. | `vercel.json` |
| Minimisation dans le monitoring | `sendDefaultPii: false`, et `beforeSend` retire emails et UUID des messages, des exceptions **et** des breadcrumbs avant émission. | `src/main.tsx` |
| Réduction de surface tierce | Un seul script tiers sur l'origine, et il n'est chargé **que hors session** pour qu'aucun jeton ne soit exposable. | `src/lib/audience.ts` |
| Traçabilité des versions | `release` Sentry = SHA du commit, donc toute erreur est attribuable à un déploiement. | `src/main.tsx` |
| Contrôle continu | Gates CI bloquantes : `check:rls` (invariants RLS), `validate:migrations`, `test:rls`, `i18n:check`, `check:bundle`. | `package.json` |
| Effacement | Edge Function `delete-account`, et export CSV au titre de la portabilité. | `supabase/functions/delete-account`, `src/lib/csv-export.ts` |

### Limites assumées

Un document article 32 qui ne recense que ses forces ne vaut rien en contrôle. Les suivantes
sont connues et documentées dans le code :

1. **Fenêtre du script de mesure d'audience.** Un visiteur qui se connecte sans recharger la
   page conserve, pour la durée de l'onglet, un script tiers déjà évalué. On ne décharge pas du
   JavaScript exécuté. Fenêtre étroite mais réelle, décrite dans `src/lib/audience.ts`.
2. **`style-src 'unsafe-inline'`** reste nécessaire à la chaîne de styles. C'est un
   assouplissement conscient de la CSP.
3. **La CSP autorise les domaines publicitaires Google.** Aucun n'est chargé aujourd'hui,
   `AdModal` injectant le script à la demande et `PREMIUM_ENFORCED` valant `false`. 🔴 **Le jour
   où ce drapeau passe à `true`, de la publicité se charge, et la publicité n'est JAMAIS
   exemptée de consentement** : voir la ligne A4.
4. **Aucun exercice de restauration n'a été conduit.** Les sauvegardes dépendent du plan
   Supabase souscrit ; leur existence et leur délai de restauration restent à vérifier.
5. **Pas de journal d'accès applicatif** distinct des logs d'infrastructure.

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
