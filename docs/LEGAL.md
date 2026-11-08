# LEGAL.md — obligations légales de COSMO

> **Vivant.** Établi le 2026-08-26 à partir de l'état réel du code, de la base et des comptes
> Stripe et Supabase. Décrit la situation courante, pas une cible. **Repassé le 2026-09-14** sur
> le seul point de la chaîne de paiement entreprise (§ État au 2026-09-14 et ligne E9) : la
> facturation est désarmée, vérifiée en base. Les autres sections n'ont pas été revérifiées à
> cette date et portent encore le statut du 2026-08-26.

> 🔴 **Ce document n'est pas un avis juridique.** Il est rédigé par un assistant, pas par un
> avocat ni un expert-comptable. Il sert à ne rien oublier et à savoir quoi demander. Aucune
> phrase ici ne protège en cas de contrôle. Les points marqués ⚠️ portaient, à cette date, sur
> des textes déjà modifiés au moins une fois : ils se revérifient à la source.

**Plan** : [Audits et état des lieux archivés](#audits-datés-et-état-des-lieux--archivés) · [**Tableau de conformité**](#-tableau-de-conformité) · [État de la chaîne de paiement](#-état-au-2026-09-14--la-chaîne-de-paiement-est-désarmée-mode-entreprise-gratuit-sans-plafond) · [La décision structurante](#-la-décision-structurante--tout-client-est-un-consommateur)
· [Actif aujourd'hui](#1-actif-aujourdhui-sans-structure) · [À la création](#2-à-la-création-de-la-structure)
· [Au premier euro](#3-au-premier-euro-encaissé) · [Droit de la consommation](#4-droit-de-la-consommation)
· [Produit et marque](#5-produit-marque-et-dépendances) · [Sous-traitants](#6-sous-traitants-et-transferts)
· [Garde-fous](#-garde-fous-techniques) · [**Ce sur quoi tu es engagé**](#-ce-sur-quoi-tu-es-engagé) · [Annexe art. 32](#annexe--mesures-techniques-et-organisationnelles-art-32) · [Décisions ouvertes](#décisions-encore-ouvertes)

---


## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-09-16)

> Ce document affirme des choses que rien ne pèse : chaque ligne nomme une affirmation qui n'était vérifiée
> par rien, et la garde qui la vérifie depuis. 🔴 **Une garde posée n'est pas un angle mort fermé** : la
> dernière colonne dit ce que son vert ne prouve pas. L'énoncé du 2026-09-16, la colonne « État » du
> 2026-09-21 et les mesures datées sont archivés sans une coupe :
> [`archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md`](./archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md).

| # | Angle mort (énoncé du 2026-09-16) | Garde qui le couvre | 🔴 Ce qu'elle ne prouve pas |
|---|---|---|---|
| AM-1 | **`npm run check:legal` vérifie l'ARITHMÉTIQUE du tableau, jamais la CONFORMITÉ** : une ligne ✅ à tort laisse la garde verte | `npm run check:legal-journal` : une ligne ✅ doit porter une **date** (`C-107`) | 🔴 La **conformité** : une ligne ✅ à tort **et datée** reste verte (la première exécution a trouvé `C10` sans date, et sa relecture une affirmation **fausse**) |
| AM-2 | **Les échéances légales ne sont surveillées par rien** (des lignes ❌ sans date butoir opposable dans un outil) | cliquet à **21 lignes datées** (`C-107`) | Idem AM-1 : la traçabilité, jamais le fond |
| AM-3 | **Rien ne relie une modification des documents contractuels à leur préavis de 30 jours** (CGU, confidentialité, mentions légales : namespace `legal`, article 11) | `docs/LEGAL-JOURNAL.md` + empreinte de `src/locales/{fr,en}/legal.json` exigée à chaque modification (`C-107`) | Que le préavis de 30 jours ait été servi : le journal date le changement, il ne notifie personne |

---

## Audits datés et état des lieux : archivés

Les audits juridiques du 2026-10-13 (« si je déploie maintenant ») et du 2026-09-24 (confrontation aux textes), ainsi que l'état des lieux du 2026-08-26, sont déplacés sans coupe dans [`archive/LEGAL-audits-et-etat-des-lieux-2026-08-26-au-2026-10-13.md`](./archive/LEGAL-audits-et-etat-des-lieux-2026-08-26-au-2026-10-13.md). Ils fondent des changements de contrat consignés dans [`LEGAL-JOURNAL.md`](./LEGAL-JOURNAL.md) ; l'état courant des obligations est dans le tableau de conformité ci-dessous, gardé par `check:legal`.

**Hébergement des données** : Supabase, région `eu-west-1` (Irlande), donc dans l'Union. C'est la preuve de la promesse « données en Irlande » de la landing, que `src/pages/landing/landing-promises.guard.test.ts` relit dans ce document.

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
| A1 | Registre des activités de traitement (art. 30) | ✅ | [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md), établi le 2026-08-26. **Dix traitements** organisés par finalité comme l'exige l'article, pas par table, sur les 47 tables applicatives réellement présentes en base. Chacun porte sa base légale, ses destinataires, sa durée et son cloisonnement. Il manque les DPA (A5), et le registre le dit. |
| A2 | Politique de confidentialité (art. 12 à 14) | ✅ | ✅ **Repassé au vert le 2026-10-13** (audit juridique) : la politique NIAIT que l'identifiant du compte parte chez Sentry (il part, `monitoring.setUser`), omettait l'origine des inscriptions, l'identifiant de démo, la finalité des jours de connexion, les invitations par e-mail, GitHub, Stripe, Google et Supabase Inc. dans les transferts, et ne bornait pas la durée d'un compte abandonné. Tout est désormais décrit ; durées ajoutées (comptes inactifs 3 ans, bugs 12 mois, sauvegardes 30 jours). ⚠️ La suppression des comptes inactifs est annoncée mais **pas encore automatisée** (A15). 🔴 **Redescendu à 🟡 le 2026-09-24.** Reprise ce jour : Resend et Cloudflare Turnstile ajoutés aux destinataires et aux transferts, « statut Premium, tokens » et « messagerie » retirés (fonctionnalités inexistantes), données de l'espace entreprise et signalements de bug décrits, directives post mortem (loi I&L art. 85), âge de 15 ans, retrait du consentement. ❌ **Reste** : le responsable de traitement est « l'équipe Cosmo », ce qui n'identifie personne (art. 13.1.a), alors que le registre nomme Axel Longatte. Geste d'Axel. Historique : complétée le 2026-08-26. Trois trous comblés : **Sentry et Vercel Analytics** étaient absents de la liste des sous-traitants, une section **7 bis sur les transferts hors UE** manquait entièrement (art. 13.1.f), et la section Cookies affirmait que la mesure tierce ne requiert pas de consentement, phrase devenue **fausse** depuis A4. **Reprise le 2026-09-01** : la politique affirmait encore que la mesure tierce n'écrivait rien sur l'appareil et rangeait la mesure d'audience sous l'**intérêt légitime**, alors que le script dépose un identifiant persistant en `localStorage` et que la base retenue est le **consentement** — deux sections du même document se contredisaient. La section Cookies distingue désormais ce qui est strictement nécessaire de ce qui n'est déposé qu'après acceptation, et les pages exclues de la mesure sont nommées. Détail : `faille.md` § V-1. Délai de réponse aligné sur « un mois » (art. 12) au lieu de 30 jours. |
| A3 | Mentions légales (LCEN art. 6-III) | 🟡 | **2026-10-13** : adresse de Vercel mise à jour (Covina), clause « ne saurait être tenu responsable des dommages directs ou indirects » **supprimée** (clause noire, contraire aux CGU art. 9), propriété des contenus attribuée à l'éditeur. ❌ Restent l'**adresse (domicile) et le téléphone de l'éditeur** (LCEN art. 1-1, ex-6-III depuis la loi SREN du 21/05/2024) et le téléphone des hébergeurs : sans immatriculation ni domiciliation, la seule voie est de publier le domicile. ✅ **2026-10-10 : éditeur et directeur de la publication nommés (Axel Longatte), responsable de traitement aussi (A2)**, entrée de `LEGAL-JOURNAL.md`. ❌ Restent SIREN, RCS, TVA, adresse (après `M-01`/`M-02`) et téléphone des hébergeurs (`M-65`). 🔴 **Dégradé le 2026-09-24.** « Dénomination : Cosmo » n'est ni une personne ni une société, et le directeur de la publication est « L'équipe Cosmo », alors que la loi de 1982 (art. 93-2) exige une personne physique. Les CGU annonçant des forfaits payants, l'activité se présente comme professionnelle : l'anonymat du non-professionnel (LCEN 6-III-2) n'est pas ouvert. **Le nom d'Axel est exigible dès maintenant, sans attendre l'immatriculation.** Le téléphone des hébergeurs manque aussi (6-III-1), aucun numéro public trouvé le 2026-09-24. Corrigé ce jour : juridiction du consommateur (s5), localisation AWS Irlande. Historique : `MentionsLegalesPage.tsx` existe, avec email éditeur et les deux hébergeurs. Manque l'identité complète, à ajouter **après immatriculation** (dénomination, SIREN, RCS, TVA, directeur de publication). |
| A4 | Consentement aux traceurs (art. 82) | ✅ | 🔴 **Ce ✅ était faux jusqu'au 2026-10-13.** Deux traceurs étaient posés SANS consentement et finissaient rattachés au compte : l'identifiant d'appareil de la démo (`cosmo_demo_device_id`, mig. 055) et la source d'acquisition (`cosmo_first_touch`, mig. 097/217), plus deux compteurs locaux de la démo. Le bandeau affirmait qu'un refus s'en tenait au strict nécessaire. **Corrigé le 2026-10-13** : rien n'est écrit ni envoyé sans « Accepter » (source gardée en mémoire puis posée à l'acceptation, compteurs en mémoire), tout est effacé au refus, et une valeur posée avant le correctif n'est jamais rattachée. Tests : `attribution.test.ts`, `demo-metrics.test.ts`, `demo-engagement.test.ts`, `acquisition-claim.test.ts`. **Complété le 2026-09-24 : le RETRAIT n'existait pas.** Une fois « Accepter » cliqué, rien ne rouvrait le bandeau, et la politique disait « effacez les données du site » (RGPD art. 7.3 : retirer doit être aussi simple que donner). « Gérer les cookies » est désormais dans le pied de page, les Paramètres et la politique ; refuser après avoir accepté efface `_a_cid`, `_a_sid`, `_a_sact` et recharge la page. Le choix expire au bout de six mois (`cosmo_cookie_consent_at`, recommandation CNIL). En réouverture, la croix ne retire pas un accord en silence. Tests : `cookie-consent.test.ts`. Historique : corrigé le 2026-08-26. Un store unique (`src/lib/cookie-consent.ts`) conditionne les surfaces : `<Analytics />` de Vercel (`App.tsx`) et le bandeau (le script de mesure tiers est débranché depuis le 2026-10-18). Rien ne se charge tant que la réponse n'est pas donnée, `null` n'étant pas une acceptation tacite ; accepter monte la mesure sans rechargement ; refuser ne la monte jamais. 5 tests dédiés. |
| A5 | Contrats de sous-traitance (art. 28) | 🟡 | **2026-10-13** : ⚠️ l'idée qu'un DPA « ne s'obtient qu'en tant qu'entreprise » est **fausse pour Sentry** (le propriétaire du compte l'accepte en deux minutes). **Vercel** : l'équipe porte le nom par défaut d'un compte personnel, plan probablement Hobby (non commercial, sans DPA), à vérifier. ⚠️ **Au 2026-09-24, la liste compte deux sous-traitants de plus que ce relevé** : Resend (e-mails de service) et Cloudflare Turnstile (si activé), jamais recensés jusqu'ici. **Vérifié pour les 3 sous-traitants critiques le 2026-09-14** (lecture des DPA publics, pas déduit). Détail : § « DPA des sous-traitants — vérifié le 2026-09-14 » sous le tableau F. |
| A6 | Transferts hors UE (chap. V) | 🟡 | ✅ Supabase en `eu-west-1`, donc dans l'Union, et l'**information** due à la personne est faite (section 7 bis de la politique, art. 13.1.f). ❌ Reste la **preuve contractuelle** : les clauses types vivent dans les DPA de Vercel et Sentry, qu'il faut accepter et archiver en tant qu'entreprise. Dépend donc de A5, donc de l'immatriculation. |
| A7 | Notification de violation sous 72 h (art. 33) | ✅ | `RGPD-VIOLATION.md` (hors dépôt), rédigée **à froid** le 2026-08-26. Qualification des trois types d'atteinte, six heures de marche à suivre, arbre de décision de notification, sources à consulter, et registre des violations (obligatoire même sans notification, art. 33.5). Recense trois manques réels : pas d'astreinte, pas d'exercice de restauration, pas de DPA pour être alerté d'une violation chez un sous-traitant. |
| A8 | Droits des personnes (art. 15 à 22) | ✅ | Complété le 2026-08-26. L'export ne couvrait que tâches, habitudes, événements et OKR : **profil, catégories et listes manquaient**, alors que le nom et l'adresse sont les données les plus évidemment « fournies par la personne ». Sept fichiers désormais, et le périmètre exact est annoncé dans la politique. Effacement par `delete-account`. Délai d'un mois documenté, prolongation de deux mois prévue. |
| A9 | Sécurité du traitement (art. 32) | 🟡 | 🔴 **Redescendu à 🟡 le 2026-10-13.** Les sauvegardes quotidiennes de la base partaient EN CLAIR en artefacts GitHub d'un dépôt public, téléchargeables par tout compte GitHub (violation de données, registre privé hors dépôt). Corrigé le jour même : chiffrement avant dépôt (`8c6a971d`), anciennes sauvegardes supprimées. Restent : révoquer les sessions et changer le mot de passe de la base (gestes d'Axel). Sentry : jetons retirés des adresses de page (`src/lib/sentry-scrub.ts`). Mesures formalisées en [annexe](#annexe--mesures-techniques-et-organisationnelles-art-32), limites comprises. Vérifiées dans `vercel.json`, `src/main.tsx` et les migrations. Formalisé le 2026-08-26. |
| A11 | Information au point de collecte (art. 13) | ✅ | 🔴 **Partiellement faux jusqu'au 2026-10-13** : le bouton « Continuer avec Google » est aussi rendu en mode CONNEXION, où la mention n'existait pas, alors que 6 inscriptions sur 7 passent par Google. Corrigé : une mention dédiée en mode connexion (`auth.legalConsentLogin`), test `AuthForm.legal.test.tsx`. **Corrigé le 2026-09-24.** Le formulaire d'inscription (`AuthForm.tsx`) ne montrait **ni** la politique **ni** les CGU. Une phrase sous le bouton, en mode inscription, les lie toutes deux (nouvel onglet, pour ne pas perdre la saisie dans la modale) et couvre aussi l'inscription par Google. |
| A12 | Mineurs (RGPD art. 8, loi I&L art. 45) | ✅ | **Posé le 2026-09-24** : âge minimum de 15 ans dans les CGU (3.3) et accord parental conjoint pour la mesure d'audience en dessous (politique, section 5). Aucun contrôle d'âge technique, ce qui est l'usage pour un service non destiné aux enfants. |
| A13 | COSMO sous-traitant des organisations clientes (art. 28) | 🟡 | **Clause posée le 2026-09-24** (CGU 6.3), qui couvre les huit éléments de l'art. 28.3. Le mode entreprise traite des données de salariés pour le compte de l'employeur (activité, vélocité, commentaires), et **aucune clause ne le disait** jusqu'ici. Reste : relecture juridique, et un DPA séparé et signable, que réclamera un acheteur B2B. Préavis de 30 jours dû (cf. `LEGAL-JOURNAL.md`). |
| A14 | Directives post mortem (loi I&L art. 85) | ✅ | **Ajouté à la politique le 2026-09-24** (section 8). Absent jusqu'ici, alors que c'est une mention propre au droit français. |
| A15 | Durée de conservation des comptes inactifs (art. 5.1.e) | 🟡 | **Posé le 2026-10-13** dans la politique : un compte sans connexion pendant 3 ans est supprimé après un e-mail d'avertissement 30 jours avant. Jusqu'ici, un compte abandonné était gardé sans limite. ❌ Le traitement qui l'applique n'existe pas : à construire avant le premier anniversaire de 3 ans (2029 au plus tôt). |
| A10 | Analyse d'impact (art. 35) | ⬜ | Probablement non requise pour ce traitement. À confirmer, et à réexaminer si des agents IA traitent du contenu utilisateur. |

### B. Structure juridique — **se déclenche à la création**

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| B1 | Choix de la forme juridique | ✅ | **Micro-entreprise** (entrepreneur individuel, nom commercial COSMO), arbitré par Axel le 2026-08-26, immatriculée le 2026-10-20 (B2), relu le 2026-11-05 aux mentions légales en ligne. Conséquences : franchise en base par défaut (C1), livre des recettes seul (C11), affiliation travailleur indépendant (D1). |
| B2 | Immatriculation au guichet unique INPI | ✅ | **Immatriculé au RNE le 2026-10-20** : SIREN 131 769 317, SIRET 131 769 317 00010, publiés aux mentions légales le 2026-10-21 (`LEGAL-JOURNAL.md`), relu le 2026-11-05. |
| B3 | Compte bancaire dédié | ❌ | Obligatoire pour une société ; en micro, au-delà de 10 000 € deux années de suite. |
| B4 | Déclaration CFE initiale | ❌ | À déposer avant le 31 décembre de l'année de création. Exonération la 1re année mais **la déclaration reste due**. |
| B5 | Domiciliation | ✅ | **Société de domiciliation Les Tricolores**, 138 avenue Victor Hugo, 75116 Paris, publiée aux mentions légales le 2026-10-21, relu le 2026-11-05. Le domicile personnel reste hors du registre. |
| B6 | Assurance RC professionnelle | ❌ | Pas obligatoire légalement, mais exigée contractuellement par les acheteurs entreprise. |

### C. Fiscal et facturation — **se déclenche au premier euro**

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| C1 | Régime de TVA à déterminer | 🟡 | **Franchise en base**, conséquence directe du choix micro-entreprise. Mention « TVA non applicable, art. 293 B du CGI » due sur chaque facture (C4). ⚠️ Seuils services 37 500 € et 41 250 €, réforme du seuil unique votée puis suspendue : à revérifier à la date d'immatriculation. |
| C2 | Numéro de TVA intracommunautaire | ❌ | Nécessaire **même en franchise en base**, à cause de C3. |
| C3 | Autoliquidation de la TVA sur les achats étrangers | ❌ | 🔴 Due dès aujourd'hui si la structure existait : Supabase, Vercel, Sentry et les frais Stripe sont tous étrangers. **Stripe Tax ne couvre pas ce point**, il ne connaît que les ventes. Règle la plus souvent ignorée. |
| C4 | Mention « TVA non applicable, art. 293 B du CGI » | ❌ | À configurer dans les factures Stripe tant que la franchise s'applique. Pas posé par défaut. |
| C5 | Mentions obligatoires des factures | ❌ | Le modèle Stripe n'est pas configuré pour la France. À auditer contre L441-9 et 242 nonies A. |
| C6 | Numérotation chronologique continue | ❌ | À vérifier côté Stripe : aucune rupture de séquence ne doit être possible. |
| C7 | Facturation électronique | ❌ | ⚠️ Calendrier décalé plusieurs fois. Chantier plus lourd que C9. |
| C8 | Guichet OSS (ventes B2C dans l'UE) | ⬜ | Sans objet tant que le marché reste français. Se déclenche au-delà de 10 000 € de ventes numériques à des consommateurs européens. |
| C9 | Conformité du logiciel d'encaissement | ✅ | Journal append-only livré le 2026-08-26 (**mig. 125, appliquée en prod**). **I** : trigger `BEFORE UPDATE OR DELETE` qui lève, choisi plutôt que la RLS parce que `service_role` contourne la RLS mais pas les triggers. **S** : chaînage de hash SHA-256, `verify_payment_chain()` détecte toute altération. **C** : aucune purge possible par construction. **A** : `seal_payment_period()` fige un total mensuel, et refuse le mois en cours. Webhook câblé et redéployé. Prouvé en transaction annulée : UPDATE bloqué, DELETE bloqué, rejeu bloqué, falsification détectée. |
| C10 | Conservation des pièces | ✅ | **Vérifié le 2026-09-20**, en relisant `supabase/migration/125_payment_journal_inalterable.sql`. Garantie **par construction** : `trg_forbid_payment_mutation` et `trg_forbid_closure_mutation` sont des triggers `BEFORE UPDATE OR DELETE` qui lèvent (« journal append-only : ni UPDATE ni DELETE. Pour corriger, inserer une ligne compensatoire »). C'est un TRIGGER et pas la RLS, parce que `service_role` contourne la RLS et pas les triggers. Le droit à l'effacement cède devant l'obligation de conservation (RGPD art. 17.3.b). 🔴 **Cette ligne disait « une purge doit anonymiser `user_id` » — c'est FAUX et inapplicable**, corrigé ici le 2026-09-20 pour s'aligner sur `CLAUDE.md` § Journal fiscal, qui l'a redressé le 2026-09-02 : `row_hash` scelle `user_id` dans le chaînage et `verify_payment_chain()` recalcule chaque hash depuis les colonnes, donc écrire NULL casserait la chaîne et produirait le signal de falsification qu'on montre à un contrôleur. Le trigger refuse d'ailleurs l'UPDATE. Ce qui rend la conservation acceptable est ailleurs : `user_id` cesse d'identifier quiconque dès que la ligne `auth.users` disparaît. `delete-account` ne touche donc PAS cette table. |
| C11 | Comptabilité (livre des recettes ou complète) | 🟡 | **Livre des recettes** seul, conséquence du régime micro. Le journal d'encaissement (C9) en fournit désormais la matière, horodatée et scellée. Reste à tenir le registre lui-même après immatriculation. |
| C12 | Déclarations fiscales annuelles | ❌ | Selon la forme retenue en B1. |

### D. Social — **se déclenche à la création, puis à l'embauche**

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| D1 | Affiliation sociale du dirigeant | 🟡 | **Travailleur indépendant**, conséquence du régime micro. Cotisations en pourcentage du chiffre d'affaires encaissé, déclarées mensuellement ou trimestriellement. Effectif à l'immatriculation. |
| D2 | Déclarations et cotisations URSSAF | ❌ | Dues même sans rémunération dans certains cas. |
| D3 | Obligations d'employeur | ⬜ | Aucun salarié. Se déclenche au premier : DPAE, convention collective, DUERP, mutuelle, santé au travail, DSN, registre du personnel. |

### E. Droit de la consommation — **s'applique à TOUTE l'offre**

Par l'effet de la décision structurante ci-dessous : aucun client n'est vérifié comme professionnel.

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| E1 | CGV communiquées avant le contrat | 🟡 | Section 5 réécrite le 2026-08-26 : elle décrit enfin **l'offre réellement vendue** (forfaits entreprise et non un « premium » inexistant), l'affichage TTC, la reconduction, la résiliation et le retour au forfait gratuit sans retrait de membre. Section 5 bis ajoutée pour la rétractation. Coordonnées du médiateur ajoutées le 2026-10-25 (CGU 12 bis, cf. E4). ❌ Reste : une relecture juridique. |
| E2 | Information précontractuelle | ✅ | **Remise le 2026-11-01** (décision d'Axel) au-dessus de la grille d'`OrgBillingTab`, pour tout propriétaire qui peut payer : « Abonnement à durée indéterminée, prix TTC, reconduit automatiquement à chaque échéance jusqu'à résiliation. Résiliable à tout moment depuis cet écran, sans motif ni frais. » (fr/en, clé `billing.precontractual`). Elle avait été retirée le 2026-10-31 (`9eedd3ca`). Le montant exact est sur chaque carte, et Stripe répète reconduction et résiliation au-dessus de son bouton (E8). Témoin : `e2e/demo-billing-consent.spec.ts`. |
| E3 | Rétractation 14 jours | ✅ | **Aucune renonciation recueillie depuis le 2026-10-30** (décision d'Axel) : les deux cases sont retirées d'`OrgBillingTab` et `stripe-org-checkout` ne les exige plus. Le client garde ses 14 jours et est remboursé en entier s'il se rétracte. CGU 5 bis réécrite le même jour. Avant cette date : double consentement, preuves gardées dans `withdrawal_consents`. |
| E4 | Médiateur de la consommation | 🟡 | **Adhésion faite** : Société Médiation Professionnelle (CPMN), courrier reçu le 2026-10-25 (texte intégral au § Médiateur de la consommation). Publié le 2026-10-25 dans les CGU (article 12 bis, texte imposé repris mot pour mot) et dans les mentions légales (5.p2). ❌ Reste : **le pied de facture Stripe**, action Dashboard d'Axel (Settings → Billing → Invoices → Default footer), sur le compte live. |
| E5 | Résiliation en ligne (L215-1-1) | ✅ | **Revu le 2026-11-05 après la refonte du 2026-11-01** (`d765d9c5`), sur deux chemins. (1) Dans l'app, onglet Facturation : « Résilier mon abonnement » (fin de période, `cancel_at_period_end`) et « Se rétracter du contrat ici » sous 14 jours, sans motif ni courrier, par l'Edge Function `stripe-org-subscription` (déployée, sonde `check:edge-smoke`) ; parcours joué par `e2e/stubbed/retractation.spec.ts`. Plus aucun bouton ne rembourse : `stripe-org-refund` est réservé à `is_admin()`. (2) Portail Stripe : configuration par défaut du compte live (`bpc_1UAv9vHJLweDSN4F4xssO3OQ`, `subscription_cancel` actif), relue par l'API le 2026-10-20 ([`STRIPE-LIVE.md`](./STRIPE-LIVE.md)). |
| E6 | Information de reconduction tacite | 🟡 | Construit et **déployé** le 2026-08-26. Mig. 126 appliquée (`renewal_notices`, clé primaire `(org_id, period_end)` qui rend l'envoi idempotent) + Edge Function `renewal-notice` + workflow CI quotidien. Fenêtre J+30 à J+60, dans les bornes légales de 1 à 3 mois. Preuve enregistrée **après** l'envoi, jamais avant. ⚠️ **Passe au vert quand deux secrets sont posés** : `CRON_SECRET` (Supabase et GitHub) et `RESEND_API_KEY`. Sans eux la fonction refuse tout appel, en échec fermé. |
| E7 | Affichage des prix TTC | ✅ | Les 8 prix live sont en `tax_behavior: inclusive`. Grille publique (`PricingSection.tsx`) : mention « Tous les prix sont affichés TTC » sous la grille. Grille produit (`EnterpriseTierGrid.tsx`) : depuis le 2026-10-31 (`9eedd3ca`), « TTC » suit **chaque** prix, mensuel, annuel et prix barré, et la mention globale d'`OrgBillingTab` est retirée. fr et en. |
| E8 | Bouton de commande explicite | 🟡 | `custom_text.submit.message` ajouté dans `stripe-org-checkout` le 2026-08-26 : « commande avec obligation de paiement », reconduction et résiliation annoncées avant le clic. `submit_type` n'existe pas en `mode: 'subscription'`, le libellé du bouton Stripe n'est donc pas réécrivable. ⚠️ **Passe au vert au redéploiement de la fonction**, la prod tourne encore sur l'ancienne version. |
| E10 | Opposabilité des CGU (C. civ. art. 1119) | ✅ | **2026-10-13** : même trou qu'A11 (inscription Google depuis l'écran de connexion), corrigé le même jour. Les comptes créés ainsi avant cette date n'ont pas vu les CGU : le préavis de `M-63` est l'occasion de les leur présenter. **Corrigé le 2026-09-24.** Les CGU se disaient acceptées « en créant un compte » sans jamais avoir été présentées à l'inscription. Même correctif que A11 : lien sous le bouton de création de compte. |
| E11 | Clauses abusives (C. conso R212-1, liste noire) | 🟡 | **2026-10-13** : 9.p1 « du fait d'un tiers » restreint au fait imprévisible et insurmontable d'un tiers étranger au service (L221-15) ; 12.p3 « dans la mesure où la loi le permet » (CPC art. 48 : clause attributive entre commerçants seulement). **Réécrites le 2026-09-24**, non relues par un juriste. Le plafond de responsabilité aux sommes versées valait **0 €** pour un utilisateur gratuit (R212-1 6°) : il est réservé aux professionnels. « Décline toute responsabilité » (8) retiré. Suspension « sans préavis » (3.2) remplacée par information préalable, motif et contestation. Modification unilatérale (11) : préavis de 30 jours et droit de partir sans frais. |
| E12 | Formulaire type de rétractation (L221-5, R221-1) | ✅ | **Ajouté le 2026-09-24** (CGU 5 bis.4), avec la renonciation réécrite selon L221-25 : pour un abonnement continu, le consommateur qui se rétracte doit le prorata, il ne perd son droit qu'à exécution complète. Dormant tant que rien n'est vendu. |
| E14 | Information précontractuelle du service GRATUIT (directive 2019/2161, C. conso L111-1, L221-5) | 🟡 | **2026-10-13** : le service gratuit est fourni contre des données personnelles, le droit de la consommation à distance s'applique donc sans attendre le premier euro. Ajoutés aux CGU : identité de l'éditeur (1.3), garantie légale de conformité et ses modalités (9.4). ❌ Restent l'adresse et le téléphone (cf. A3) et la qualification du **médiateur** (adhésion faite le 2026-10-25) pour un service gratuit (E4, `M-76`). |
| E13 | Fonction de rétractation en ligne (directive 2023/2673) | ❌ | Applicable depuis le 19/06/2026 aux contrats conclus en ligne : un bouton qui permet de se rétracter pendant les 14 jours. Absent. `stripe-org-refund` (C-65) en fait l'essentiel, sans le libellé attendu. ⚠️ Transposition française à vérifier. **Dormant** (`ENTERPRISE_BILLING_ENFORCED = false`, relevé le 2026-09-24). |
| E9 | Garantie de conformité du service numérique | ✅ | Audit fait le 2026-08-26 sur les 216 chaînes du parcours entreprise : aucune intégration inexistante n'est promise (ni SSO, ni API, ni Slack), et les réponses de la FAQ sur le cloisonnement et le non-retrait de membres sont exactes. Les deux promesses qui ont fait douter, `pricing.i5` « résiliable à tout moment » et `hero.reassurance` « réversible à tout moment », sont **tenues depuis l'armement de la facturation (2026-10-20)** par les deux chemins de résiliation d'E5. Relu le 2026-10-31 : la justification précédente (« facturation dormante, rien à résilier ») ne valait plus depuis le 2026-10-20. |

### F. Produit, marque et dépendances

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| F1 | Recherche d'antériorité sur le nom | 🟡 | **2026-10-13** : inchangé, toujours aucun conseil consulté. **Faite le 2026-08-28 via TMview** (portail EUIPO qui agrège INPI-FR **et** EUIPO, exactement les deux registres que cette ligne exigeait). Périmètre : marques verbales `COSMO` exactes, offices **FR** et **EM**, **classes 9 et 42**. Résultat : **11 marques `COSMO` ACTIVES**, dont **4 en classe 42** (Cosmo Technologies ×2, ISTITUTO VENETO DI TERAPIA FAMIGLIARE, COSMO PHARMACEUTICALS) et **8 en classe 9** (dont **TANAZA S.p.A.**, éditeur de logiciel en nuage, et Hearst Communications). La question que posait cette ligne — « une marque COSMO couvre-t-elle le logiciel ? » — a donc une réponse : **oui, plusieurs, et en vigueur dans l'Union**. Détail et méthode en §7. ❌ Reste : l'arbitrage, qui n'est pas technique. TMview avertit lui-même que ses données **n'ont aucun effet juridique** ; seul un conseil en propriété industrielle peut dire si ces antériorités bloquent un dépôt ou un usage. |
| F2 | Dépôt de marque INPI | ❌ | Pas obligatoire, mais sans dépôt aucun droit exclusif sur le nom. Dépend de F1. |
| F3 | Conformité des licences open source | ✅ | Inventaire du 2026-08-26 sur **644 paquets** : 548 MIT, 36 ISC, 23 Apache-2.0, 25 BSD, toutes permissives. **Aucune licence à réciprocité forte** (ni GPL, ni AGPL, ni SSPL), et **aucune licence non déclarée**. Les MPL-2.0 (`axe-core`) et CC-BY-4.0 (`caniuse-lite`) sont des dépendances de build ou de test, non embarquées. GSAP a sa propre licence : vérifiée à la source, **libre d'usage commercial, plugins `SplitText`, `ScrambleText` et `Inertia` compris, sans attribution obligatoire**, la seule interdiction visant les outils d'animation sans code concurrents de Webflow. |
| F4 | Accessibilité (législation européenne) | 🟡 | Un travail a été engagé côté produit (`docs/ACCESSIBILITY.md`). ⚠️ Exemption microentreprise à vérifier, et seuil à surveiller. Demandé par les acheteurs B2B de toute façon. |
| F5 | Transparence des systèmes d'IA | ⬜ | ⚠️ Se déclenche si la direction produit vers des agents IA se concrétise. À prévoir dès la conception. |
| F7 | Hébergeur de contenus (DSA, règl. 2022/2065 art. 11, 12, 14, 16, 17) | 🟡 | **Posé le 2026-09-24** (CGU 4 bis) : procédure de signalement de contenu illicite avec les éléments de l'art. 16, motivation et contestation des restrictions (art. 17), point de contact unique `contact@thecosmo.app` (art. 11 et 12). Les tâches partagées et les commentaires d'équipe font de COSMO un hébergeur, et l'exemption des micro-entreprises (art. 19) ne couvre pas l'art. 16. Reste : un signalement par e-mail est un minimum ; un formulaire dans l'app serait plus sûr. |
| F8 | Changement de fournisseur (Data Act, règl. 2023/2854 chap. VI) | 🟡 | ⚠️ À qualifier par un juriste (relevé le 2026-09-24) : un SaaS est un « service de traitement de données ». Export CSV sans frais, clause posée ce jour (CGU 6.4). L'art. 25 demande davantage (préavis maximal, période de récupération), et la suppression de compte est immédiate. |
| F9 | Notices des licences open source | ✅ | **Corrigé le 2026-09-24.** MIT, BSD, ISC et Apache exigent de reproduire leur mention de copyright dans les copies distribuées, et le bundle servi au navigateur en est une : aucun fichier ne le faisait. `scripts/third-party-notices.mjs` écrit `dist/third-party-notices.txt` à chaque build (145 paquets, fermeture transitive des `dependencies`, donc un sur-ensemble de ce que Vite embarque), lié depuis les mentions légales (s3). Généré, jamais commité : il ne peut pas vieillir. Voir F3 pour la compatibilité, qui, elle, est bonne. |
| F10 | Allégations et publicité comparative (C. conso L121-2, L122-1 à L122-7) | ✅ | **Corrigé le 2026-10-13.** « Cosmo est la seule application qui… » (FAQ) retiré ; FAQ entreprise « pas d'activité individuelle » réécrite (un responsable voit la dernière activité et qui a terminé quoi) et la notice d'adhésion complétée (`org.consent.reports`) ; FAQ « personne d'autre ne peut accéder » réécrite ; article Cosmo vs Todoist daté, sourcé, et sa phrase « aucune intégration » corrigée (l'espace entreprise envoie vers Slack). Les faits sur Todoist sont à relire à chaque mise à jour. |
| F11 | Conditions d'usage de l'hébergeur (Vercel) | ❌ | **Relevé le 2026-10-13.** L'équipe Vercel porte le nom par défaut d'un compte personnel : plan probablement **Hobby**, réservé à un usage non commercial et non couvert par le DPA de Vercel. Une page de tarifs publiée en fait un usage commercial. À vérifier, et passer en Pro si c'est Hobby. Non vérifiable par l'API (le plan n'y figure pas). |
| F6 | Obligations liées au partage entre utilisateurs | ⬜ | Micro et petites entreprises largement exemptées, mais pas de tout. Qualification à faire. |

### DPA des sous-traitants — vérifié le 2026-09-14

> Lecture des trois DPA publics (Supabase, Vercel, Sentry), pas déduite d'une note antérieure.
> **Les trois fonctionnent différemment** : un seul reste réellement à faire.

| Sous-traitant | Ce que dit leur DPA | Action requise |
|---|---|---|
| **Supabase** | Le DPA (`supabase.com/legal/dpa`, clause 12.2) dit explicitement : *« acceptance of the Agreement shall have the same effect as signing the SCCs »*. Il « forme partie » des Terms of Service dès leur acceptation. **Aucune signature séparée n'est requise** : avoir un compte Supabase suffit à le rendre contractuellement applicable. | ✅ **Rien à faire.** Juste archiver une copie/capture du DPA daté comme preuve documentaire (ce que réclame un acheteur B2B). |
| **Sentry** | Leur DPA dit l'inverse : *« entered into by ... the party that electronically accepts or otherwise agrees or opts-in »* — il faut un **acte d'acceptation explicite**, disponible dans Sentry (section « Legal & Compliance » du menu de l'organisation) ou par un lien DocuSign. **Seul un membre au rôle Owner ou Billing peut l'accepter/signer** ; les autres membres peuvent seulement le consulter. | ❌ **Manuel, pour Axel seul** : se connecter au compte Sentry (rôle Owner), ouvrir Legal & Compliance, accepter le DPA (ou signer via DocuSign). Deux minutes, aucune donnée sensible à saisir. |
| **Vercel** | Leur DPA (`vercel.com/legal/dpa`) dit explicitement : *« forms part of Vercel Enterprise Terms and Conditions ... for Customers who are on Enterprise and Pro plans »* — **le texte ne mentionne pas le plan Hobby (gratuit)**. Si le projet `cosmo1` tourne sur Hobby, rien ne dit que ce DPA s'applique contractuellement aujourd'hui. | ⚠️ **À vérifier par Axel** : quel plan Vercel héberge `cosmo1` ? Si Hobby, contacter le support Vercel ou passer sur Pro pour obtenir une couverture DPA contractuelle. Non vérifiable depuis ici (accès au compte Vercel refusé, cf. état des lieux). |

- ❌ **Ne pas conclure que A5 est réglée** : sur les trois, une seule (Supabase) l'est réellement sans action ; Sentry et Vercel restent, pour des raisons différentes, entre les mains d'Axel.
- Ce relevé ne couvre que les **trois sous-traitants cités par ce document** (Supabase, Vercel, Sentry) — pas Stripe (DPA propre à leur relation processeur de paiement) ni un futur sous-traitant.

### Où en es-tu

> Recompté **par script** dans ce fichier le 2026-08-26 en fin de journée, avec vérification que
> le total correspond aux lignes et qu'aucun identifiant n'est en double. Les décomptes tenus à
> la main ont été faux deux fois, dont une où douze lignes étaient devenues invisibles pour
> s'être collées à la ligne précédente. **Ne jamais reporter un total, toujours le recompter.**

| Statut | Nombre |
|---|---|
| ✅ Bon | **23** |
| 🟡 Partiellement bon | **19** |
| ❌ À faire | **14** |
| ⬜ Sans objet aujourd'hui | **5** |
| **Total** | **61** |

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

---

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
parce qu'un service en ligne traite les données de personnes réelles. Leur état courant est **uniquement** dans le tableau de conformité (famille A) plus haut. Le
tableau de départ du 2026-08-26 qui figurait ici (registre « absent », procédure 72 h « à écrire »)
était démenti par ce tableau ; il se relit dans l'historique git.


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
| Médiateur de la consommation | Conso. art. L612-1, L616-1 | ✅ Adhésion Société Médiation Professionnelle (2026-10-25), publiée CGU 12 bis + mentions légales. Reste le pied de facture (E4). |
| Résiliation en ligne | Conso. art. L215-1-1 | ✅ probablement satisfait par `stripe-org-portal`, **à tester réellement**. |
| Information de reconduction tacite | Conso. art. L215-1 | 🔴 Déclenchée par la facturation **annuelle** livrée le 2026-08-25. À automatiser. |
| Prix TTC affichés | Conso. art. L112-1 | ✅ cohérent avec `tax_behavior: inclusive`. Reste à afficher la mention. |
| Bouton de commande explicite | Conso. art. L221-14 | « Commande avec obligation de paiement ». Un simple « Valider » rend le contrat inopposable. |
| Garantie de conformité du service numérique | Conso. art. L224-25-1 s. | ⚠️ Une fonctionnalité promise sur la landing et non livrée devient un défaut opposable. |

---

### Médiateur de la consommation · courrier reçu le 2026-10-25

Médiateur désigné : **Société Médiation Professionnelle**, membre de la CPMN (syndicat des
médiateurs professionnels). Texte fourni par le médiateur, **à reprendre mot pour mot** :

**1. Dans les conditions générales de vente** (rendu : CGU article 12 bis, `terms.s12bis`) :

> LITIGE – MEDIATION DE LA CONSOMMATION
>
> En cas de litige entre le Client et l'entreprise, ceux-ci s'efforceront de le résoudre à
> l'amiable (le Client adressera une réclamation écrite auprès du professionnel ou, le cas
> échéant, auprès du Service Relations Clientèle du professionnel).
> A défaut d'accord amiable ou en l'absence de réponse du professionnel dans un délai
> raisonnable d'un (1) mois, le Client consommateur au sens de l'article L.612-2 du code de la
> consommation a la possibilité de saisir gratuitement, si un désaccord subsiste, le médiateur
> compétent inscrit sur la liste des médiateurs établie par la Commission d'évaluation et de
> contrôle de la médiation de la consommation en application de l'article L.615-1 du code de la
> consommation, à savoir :
> La Société Médiation Professionnelle
> www.mediateur-consommation-smp.fr
> Alteritae 5 rue Salvaing 12000 Rodez

**2. Sur les factures** :

> Société Médiation Professionnelle
> www.mediateur-consommation-smp.fr
> Alteritae 5 rue Salvaing 12000 Rodez

**3. Sur le site internet** : les mêmes informations (rendu : mentions légales 5.p2 + CGU 12 bis).

Seule adaptation : « Service Relations Clientèle » remplacé par l'adresse
`contact@thecosmo.app`, COSMO n'ayant pas de tel service. Les factures sont émises par Stripe :
le bloc 2 se pose dans le pied de facture par défaut du Dashboard (action manuelle, E4).

## 5. Produit, marque et dépendances

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
| Supabase | base de données, auth | **`eu-west-1`, Irlande** | ✅ **DPA déjà applicable** (vérifié 2026-09-14) : auto-incorporé aux ToS dès l'acceptation du compte, rien à signer. Reste à en archiver une copie datée comme preuve. Données dans l'UE, c'est le point le plus confortable du dossier. |
| Vercel | hébergement front | société américaine, région du projet non vérifiée | ⚠️ **Le DPA publié ne couvre explicitement que les plans Enterprise et Pro** (vérifié 2026-09-14). À vérifier : plan Vercel du projet `cosmo1` — si Hobby, la couverture contractuelle n'est pas acquise. Traite au minimum les adresses IP et les logs, qui sont des données personnelles. |
| Stripe | paiement | Irlande et États-Unis | DPA. Devient responsable de traitement pour ses propres finalités antifraude. |
| Sentry | monitoring | société américaine | ❌ **Signature manuelle requise** (vérifié 2026-09-14) : DPA disponible dans Sentry → Legal & Compliance, acceptable uniquement par un membre au rôle Owner/Billing (ou via DocuSign). `beforeSend` retire déjà emails et UUID, à documenter comme mesure de minimisation. |
| Resend | envoi des e-mails transactionnels (invitations, avis de reconduction, signalements, inactivité) | société américaine | ⚠️ **Écart relevé le 2026-10-24 par `check:subprocessors`** : déclaré au registre (ajout du 2026-09-24) mais absent de ce tableau. DPA **non archivé** (ligne A5). |
| Cloudflare (Turnstile) | anti-robot des formulaires de connexion et d'inscription | société américaine | ⚠️ **Écart relevé le 2026-10-24** : absent de ce tableau. Reçoit l'adresse IP et des signaux du navigateur, seulement si la clé Turnstile est posée. DPA **non archivé**. |
| Google | connexion OAuth (choix de l'utilisateur), avatars | Irlande et États-Unis | ⚠️ **Écart relevé le 2026-10-24** : absent de ce tableau. Uniquement si l'utilisateur choisit la connexion Google. |
| GitHub | sauvegardes chiffrées de la base (artefact de `db-backup.yml`, 30 jours) | États-Unis | ⚠️ **Écart relevé le 2026-10-24** : absent de ce tableau. Dump chiffré, clé hors de GitHub. |
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
| Réduction de surface tierce | **Aucun script tiers de mesure** depuis le 2026-10-18 (`faille.md` V-1) : audience maison, revérifiée avant chaque envoi (consentement, page publique, hors session), postée à la même origine. | `src/lib/traffic.ts`, `api/collect.ts` |
| Traçabilité des versions | `release` Sentry = SHA du commit, donc toute erreur est attribuable à un déploiement. | `src/main.tsx` |
| Contrôle continu | Gates CI bloquantes : `check:rls` (invariants RLS), `validate:migrations`, `test:rls`, `i18n:check`, `check:bundle`. | `package.json` |
| Effacement | Edge Function `delete-account`, et export CSV au titre de la portabilité. | `supabase/functions/delete-account`, `src/lib/csv-export.ts` |

### Limites assumées

Un document article 32 qui ne recense que ses forces ne vaut rien en contrôle. Les suivantes
sont connues et documentées dans le code :

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
4. **Aucun exercice de restauration n'a été conduit.** Les sauvegardes dépendent du plan
   Supabase souscrit ; leur existence et leur délai de restauration restent à vérifier.
5. **Pas de journal d'accès applicatif** distinct des logs d'infrastructure.
6. **Sauvegardes chez GitHub** (2026-10-13) : chiffrées (AES-256) avant dépôt, phrase secrète en secret
   GitHub et copie hors dépôt chez Axel. Elles ont été publiques et en clair du 2026-08-29 au
   2026-10-13 : c'est la violation consignée au registre.

---

## 📜 Ce sur quoi tu es engagé

Chaque ligne passée au vert est une **promesse tenue publiquement**. Une promesse tenue engage
plus qu'un flou : elle est vérifiable par un client, opposable par un contrôleur. Ce tableau
existe pour qu'aucun de ces engagements ne soit découvert le jour où il est invoqué.

### Engagements permanents, qui ne s'arrêtent jamais

| Engagement | Ce que ça t'oblige à faire | Si tu ne le fais pas |
|---|---|---|
| **Répondre aux demandes RGPD en un mois** | Surveiller la boîte de contact. Le délai court dès la réception, pas dès que tu la lis. | Manquement caractérisé, et la personne peut saisir la CNIL |
| **Notifier une violation en 72 heures** | Le compte à rebours démarre à la **prise de connaissance**, week-end compris. | Sanction distincte de la violation elle-même |
| **Tenir le registre des violations** | Y consigner **aussi** celles que tu décides de ne pas notifier, avec la justification. | Une absence non documentée est indistinguable d'un manquement |
| **Maintenir les mesures de sécurité déclarées** | HSTS, CSP stricte, RLS sur toutes les tables, scrubbing Sentry. Les assouplir sans mettre à jour l'annexe retourne le document contre toi. | Le document art. 32 devient une preuve à charge |
| **Ne charger aucun traceur sans consentement** | Tout nouvel outil de mesure ou de publicité passe par le store de consentement. | Le bandeau redevient mensonger, ce qui est pire que son absence |
| **Purger les comptes clos sous 90 jours** | C'est la durée que la politique annonce désormais. | Conservation excessive, et contradiction avec ta propre politique |
| **Supprimer les comptes inactifs depuis 3 ans** (2026-10-13) | Avertir par e-mail 30 jours avant, puis supprimer. Le traitement reste à construire, avant 2029. | Promesse de la politique non tenue |
| **Ne jamais déposer une donnée personnelle en clair hors de la base** (2026-10-13) | Sauvegardes chiffrées avant tout dépôt ; aucun export, log ou artefact public qui en contienne. | C'est exactement la violation du 2026-10-13 |
| **Ne poser aucun identifiant ni aucune source d'acquisition sans « Accepter »** (2026-10-13) | Tout nouveau stockage local qui n'est pas strictement nécessaire passe par `hasConsented()` et s'efface au refus. | Traceur illicite, bandeau mensonger |
| **Faire entrer toute nouvelle donnée saisie dans l'export** | Sept fichiers aujourd'hui. Une nouvelle table utilisateur non exportée rend la portabilité fausse. | La portabilité devient une promesse creuse |
| **Conserver le journal d'encaissement dix ans** | Aucune suppression, jamais, et aucune anonymisation : `row_hash` scelle `user_id` (cf. C10, corrigé ici le 2026-09-24, cette ligne disait encore « anonymise »). `user_id` cesse d'identifier quiconque quand le compte disparaît. | Perte d'une pièce comptable obligatoire |
| **Laisser retirer le consentement** | « Gérer les cookies » doit rester atteignable partout où le bandeau peut apparaître. Tout nouveau traceur doit effacer ses traces au retrait (`clearAudienceTraces`). | Consentement non valable, donc traceur illicite |
| **Traiter un signalement de contenu** | Répondre à `contact@thecosmo.app`, motiver toute restriction, permettre la contestation (CGU 4 bis). | Manquement au DSA, art. 16 et 17 |

### Engagements envers tes clients, dès le premier paiement

> ⚠️ **Sans objet aujourd'hui** : `ENTERPRISE_BILLING_ENFORCED = false` (vérifié le 2026-09-14),
> aucun paiement n'est possible, donc aucun de ces engagements n'est actuellement dû. Ce tableau
> redevient actif le jour où la facturation est réarmée — voir § État au 2026-09-14.

| Engagement | Ce que ça t'oblige à faire | Coût si tu l'oublies |
|---|---|---|
| **Le prix affiché est le prix payé** | `tax_behavior: inclusive` est **définitif** chez Stripe. Le jour de l'assujettissement TVA, 20 € TTC ne te rapportent plus que 16,67 €. | **−17 % de marge**, sans pouvoir augmenter les abonnés existants sans préavis |
| **Rembourser sous 14 jours** toute rétractation | Aucune renonciation n'est plus recueillie (2026-10-30). | Remboursement intégral dû sur simple demande |
| **Résilier depuis l'application, sans motif ni frais** | Promis dans les CGU, sur la landing, et dans l'écran de paiement. 🔴 **Ne fonctionne pas aujourd'hui** (E5). | Manquement à L215-1-1, et un client qui ne peut pas partir |
| **Informer avant chaque reconduction annuelle** | 🔴 **Pas encore fait** (E6). Déclenché par la facturation annuelle. | Le client peut résilier à tout moment sans frais |
| **Ne jamais retirer un membre** en cas de baisse de palier | Annoncé en FAQ. Le code le respecte déjà : on bloque la croissance, on ne retire rien. | Contradiction directe avec une promesse écrite |
| **Livrer ce que la landing annonce** | Une fonctionnalité promise et non livrée est un défaut de conformité opposable. | Réduction de prix ou résolution du contrat |

### Engagements qui découlent de tes décisions du 2026-08-26

| Décision | Ce qu'elle engage |
|---|---|
| **Un particulier peut acheter** | Tout le droit de la consommation s'applique à toute l'offre. Y compris l'adhésion **payante** à un médiateur, avant le premier client. |
| **Micro-entreprise** | Franchise en base par défaut, livre des recettes, affiliation travailleur indépendant. Et l'**autoliquidation de la TVA sur tes achats étrangers**, due même en franchise. |
| **Société de domiciliation** | Un coût mensuel récurrent, en échange de quoi ton adresse personnelle reste hors du registre public. |
| **Journal d'encaissement construit** | Tu peux signer l'attestation individuelle **honnêtement**. C'était impossible ce matin. |

> 🔴 **Les deux engagements actuellement non tenus sont E5 et E6.** Le premier se répare en deux
> minutes au Dashboard Stripe, le second demande un envoi d'emails que COSMO ne sait pas encore
> faire. Tant qu'ils ne le sont pas, la landing et les CGU promettent quelque chose que le
> produit ne délivre pas.

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

---

## Garde du tableau de conformité · repris de `CLAUDE.md` (déplacé le 2026-09-16)

> Commentaires de la section `## Scripts` de `CLAUDE.md`, où ils étaient chargés à chaque
> session. Déplacés ici **sans une coupe**. La racine ne garde que la commande.

```bash
npm run check:legal         # Cohérence du tableau de conformité de docs/LEGAL.md :
                            # lignes collées, identifiants en double, et surtout que la
                            # synthèse corresponde aux lignes. Ce total a été faux TROIS
                            # fois le 2026-08-26, toujours pour l'avoir additionné de tête.
```
