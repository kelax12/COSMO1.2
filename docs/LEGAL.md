# LEGAL : obligations légales de COSMO

**Quand lire** : avant de toucher facturation, CGU, mentions légales, politique de confidentialité, consentement, un prestataire, ou la structure juridique. **Fait foi** : le code, les consoles (Stripe, Supabase, Vercel, Sentry) et les textes de loi, jamais ce tableau. Garde : `npm run check:legal` (`scripts/check-legal-table.mjs`) ; journal des modifications de contrat : [`LEGAL-JOURNAL.md`](./LEGAL-JOURNAL.md). Audits datés et état des lieux de départ : [`archive/LEGAL-audits-et-etat-des-lieux-2026-08-26-au-2026-10-13.md`](./archive/LEGAL-audits-et-etat-des-lieux-2026-08-26-au-2026-10-13.md) ; historique des cellules, état d'alerte et ancien relevé de marque : [`archive/LEGAL-etat-avant-reecriture-2026-11-13.md`](./archive/LEGAL-etat-avant-reecriture-2026-11-13.md) ; recomptages datés du tableau : [`archive/LEGAL-journal-2026-11-13.md`](./archive/LEGAL-journal-2026-11-13.md).

- 🔴 Ce document n'est PAS un avis juridique : il est rédigé par un assistant, pas par un avocat ni un expert-comptable. Il sert à ne rien oublier et à savoir quoi demander. Les points ⚠️ portent sur des textes déjà modifiés : les revérifier à la source.
- 🔴 Un tableau au vert ne vaut pas conformité : certaines lignes exigent un jugement professionnel, les textes bougent, un contrôleur apprécie la situation réelle.
- ⚠️ `check:legal` vérifie l'arithmétique et la datation, jamais la conformité : une ligne ✅ à tort et datée reste verte.
- ✅ Hébergement des données : Supabase, région `eu-west-1` (Irlande), donc dans l'Union. C'est la preuve de la promesse « données en Irlande » de la landing, relue par `src/pages/landing/landing-promises.guard.test.ts`.
- ⚠️ Chaque modification d'un catalogue juridique (`src/locales/{fr,en}/{legal,legalTerms,legalPrivacy}.json`) exige une entrée de journal (`npm run check:legal-journal`) ; le préavis d'un mois (CGU art. 11) est un geste d'Axel dont la trace est `renewal_notices` (jamais purgée).

## Décisions d'Axel

- 🔴 Tout client est un consommateur (2026-08-26). Un particulier doit pouvoir acheter l'offre entreprise ; COSMO n'exige jamais la preuve d'une qualité professionnelle et aucun contrôle de SIRET, de raison sociale ou de TVA n'existe dans le parcours. Le droit regarde qui achète, pas le nom du plan : tout le droit de la consommation (§ 4) s'applique à toute l'offre.
- ❌ Ne jamais raisonner « c'est une offre entreprise, donc c'est du B2B ».
- ✅ Correctif retenu : qualifier, pas fermer la porte. `tax_id_collection` natif de Stripe et un champ SIRET facultatif : décidé, pas implémenté. Les déclarés professionnels sortent du droit de la consommation et alimentent la TVA.
- ✅ La question du premium particulier (`PREMIUM_ENFORCED`) est sans objet ici : la clientèle est déjà en partie composée de consommateurs.
- ✅ Forme juridique : micro-entreprise (entrepreneur individuel, nom commercial COSMO), arbitrée le 2026-08-26 : franchise en base, livre des recettes, affiliation travailleur indépendant.
- ✅ Société de domiciliation : coût mensuel récurrent, l'adresse personnelle reste hors du registre public.
- ✅ Journal d'encaissement construit (mig. `125`) : l'attestation individuelle de conformité du logiciel d'encaissement peut être signée honnêtement.
- ✅ Prix en `tax_behavior: inclusive` (TTC), réglage définitif chez Stripe (décision d'Axel, voir [`STRIPE-LIVE.md`](./STRIPE-LIVE.md)).

## État de la facturation

- ✅ `ENTERPRISE_BILLING_ENFORCED = true` dans `src/modules/billing/premium-config.ts` ; Stripe est live (voir [`STRIPE-LIVE.md`](./STRIPE-LIVE.md)). Les lignes du tableau E (§ 4) sont dues.
- ❌ Ne jamais modifier `ENTERPRISE_BILLING_ENFORCED` ni `billing_flags.enterprise_seat_limit` sans repasser par ce document : ils vont ensemble.
- ❌ Ne pas ouvrir de bouton de paiement réel avant le SIREN : encaisser avant l'immatriculation est du travail dissimulé, le seul point de ce document qui relève du pénal.

## Tableau de conformité

Légende : ✅ bon · 🟡 partiellement bon · ❌ à faire · ⬜ sans objet aujourd'hui.

- 🔴 Format lu par `check:legal` : une ligne `| <A-F><n> | obligation | statut | détail |`, jamais deux lignes collées, identifiants uniques, bloc « Où en es-tu » égal au recompte du tableau.
- 🔴 Une ligne ✅ porte une date `AAAA-MM-JJ` (celle où quelqu'un a regardé) ; le nombre de lignes datées ne baisse jamais (plancher dans le script). ❌ Ne jamais inventer une date pour faire passer la CI.
- ❌ Ne jamais reporter un total de tête : le recompter par `node scripts/check-legal-table.mjs`.
- ✅ La date d'une ligne dit quand elle a été relue ; une ligne non relue depuis longtemps se revérifie à sa source avant d'être lue comme un état courant.

### A. Données personnelles : actif dès aujourd'hui, sans structure

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| A1 | Registre des activités de traitement (art. 30) | ✅ | Vérifié le 2026-08-26 : [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md), organisé par finalité (pas par table), chaque traitement avec base légale, destinataires, durée et cloisonnement. Il manque les DPA (A5), et le registre le dit. |
| A2 | Politique de confidentialité (art. 12 à 14) | ✅ | Vérifié le 2026-10-13 : décrit l'identifiant du compte joint aux rapports Sentry (`monitoring.setUser`), l'origine des inscriptions, l'identifiant de démo, la finalité des jours de connexion, les invitations par e-mail, les transferts (Stripe, Google, GitHub, Supabase Inc., Resend, Cloudflare Turnstile), les durées (comptes inactifs 3 ans, bugs 12 mois, sauvegardes 30 jours), les directives post mortem, l'âge de 15 ans, le retrait du consentement, la section 7 bis sur les transferts hors UE (art. 13.1.f), et le délai de réponse d'un mois (art. 12). Responsable de traitement : Axel Longatte. ⚠️ La suppression automatique des comptes inactifs est décrite au registre (T1) : vérifier qu'elle tourne (A15). |
| A3 | Mentions légales (LCEN art. 6-III) | 🟡 | Revu le 2026-11-05 : éditeur et directeur de la publication nommés (Axel Longatte, EI, SIREN, SIRET, domiciliation Les Tricolores), « TVA non applicable, art. 293 B du CGI », téléphone de l'éditeur, juridiction du consommateur (s5), localisation Irlande, notices de licences (s3), médiateur (5.p2), adresse de Vercel. ❌ Restent le téléphone des hébergeurs (6-III-1, `M-65`) et, selon la loi SREN, l'adresse ; RCS et numéro de TVA après immatriculation. |
| A4 | Consentement aux traceurs (art. 82) | ✅ | Vérifié le 2026-10-13 : un store unique (`src/lib/cookie-consent.ts`) conditionne `<Analytics />` de Vercel et la mesure maison ; rien n'est écrit ni envoyé sans « Accepter » (source d'acquisition et compteurs de démo gardés en mémoire jusqu'à l'acceptation), tout s'efface au refus, `null` n'est pas une acceptation. Retrait aussi simple que l'octroi (art. 7.3) : « Gérer les cookies » (pied de page, Paramètres, politique) ; refuser après avoir accepté efface `_a_cid`, `_a_sid`, `_a_sact` et recharge la page ; le choix expire après six mois (`cosmo_cookie_consent_at`). Tests : `attribution.test.ts`, `demo-metrics.test.ts`, `demo-engagement.test.ts`, `acquisition-claim.test.ts`, `cookie-consent.test.ts`. |
| A5 | Contrats de sous-traitance (art. 28) | 🟡 | Revu le 2026-10-13 ; DPA relus à leur source le 2026-09-14 (voir tableau DPA plus bas). Seul Supabase est acquis sans action ; Sentry demande une acceptation explicite par un Owner ou Billing ; Vercel : couverture du DPA incertaine selon le plan. Resend et Cloudflare Turnstile : DPA non archivés. Aucune copie datée des DPA n'est archivée. |
| A6 | Transferts hors UE (chap. V) | 🟡 | ✅ Supabase en `eu-west-1`, donc dans l'Union, et l'information due à la personne est faite (section 7 bis de la politique, art. 13.1.f). ❌ Reste la preuve contractuelle : les clauses types vivent dans les DPA de Vercel et Sentry, à accepter et archiver (dépend de A5). |
| A7 | Notification de violation sous 72 h (art. 33) | ✅ | Vérifié le 2026-08-26 : `RGPD-VIOLATION.md` (hors dépôt) qualifie les trois types d'atteinte, donne la marche à suivre sur six heures, l'arbre de décision, les sources et le registre des violations (obligatoire même sans notification, art. 33.5). Exercice à blanc et gabarits : [`RGPD-VIOLATION-EXERCICES.md`](./RGPD-VIOLATION-EXERCICES.md), [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md). Manques recensés : pas d'astreinte, pas d'exercice de restauration, pas de DPA pour être alerté d'une violation chez un sous-traitant. |
| A8 | Droits des personnes (art. 15 à 22) | ✅ | Vérifié le 2026-08-26 : export CSV (profil, catégories et listes compris ; périmètre exact annoncé dans la politique, détail : [`RGPD.md`](./RGPD.md)), effacement par `delete-account`, délai d'un mois documenté, prolongation de deux mois prévue. |
| A9 | Sécurité du traitement (art. 32) | 🟡 | Revu le 2026-10-13 : mesures formalisées en [annexe](#annexe--mesures-techniques-et-organisationnelles-art-32), vérifiées dans `vercel.json`, `src/main.tsx` et les migrations ; sauvegardes chiffrées avant dépôt ; jetons retirés des adresses de page Sentry (`src/lib/sentry-scrub.ts`). 🔴 Des sauvegardes sont déjà parties en clair dans un dépôt public (violation au registre privé) : ❌ ne jamais déposer un dump en clair. Restent : révoquer les sessions et changer le mot de passe de la base (gestes d'Axel). |
| A11 | Information au point de collecte (art. 13) | ✅ | Vérifié le 2026-10-13 : le formulaire d'inscription lie la politique et les CGU (nouvel onglet) sous le bouton, Google compris ; une mention dédiée existe en mode connexion (`auth.legalConsentLogin`), test `AuthForm.legal.test.tsx`. |
| A12 | Mineurs (RGPD art. 8, loi I&L art. 45) | ✅ | Vérifié le 2026-09-24 : âge minimum de 15 ans dans les CGU (3.3), accord parental conjoint pour la mesure d'audience en dessous (politique, section 5). Aucun contrôle d'âge technique, usage pour un service non destiné aux enfants. |
| A13 | COSMO sous-traitant des organisations clientes (art. 28) | 🟡 | Revu le 2026-09-24 : clause CGU 6.3 couvrant les huit éléments de l'art. 28.3 (le mode entreprise traite des données de salariés pour le compte de l'employeur). Reste : relecture juridique et un DPA séparé et signable, que réclamera un acheteur B2B. Préavis de 30 jours dû pour cette clause (`LEGAL-JOURNAL.md`). |
| A14 | Directives post mortem (loi I&L art. 85) | ✅ | Vérifié le 2026-09-24 : section 8 de la politique. |
| A15 | Durée de conservation des comptes inactifs (art. 5.1.e) | 🟡 | Revu le 2026-10-13 : un compte sans activité pendant 3 ans est supprimé après un e-mail d'avertissement 30 jours avant (politique et registre T1, mig. `226`, `inactive-accounts`). ❌ Premier compte concerné : 2029 au plus tôt ; vérifier le traitement en base avant cette date. |
| A10 | Analyse d'impact (art. 35) | ⬜ | Probablement non requise pour ce traitement. À confirmer, et à réexaminer si des agents IA traitent du contenu utilisateur. |

### B. Structure juridique : se déclenche à la création

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| B1 | Choix de la forme juridique | ✅ | Vérifié le 2026-11-05 aux mentions légales en ligne : micro-entreprise (entrepreneur individuel, nom commercial COSMO), arbitrée par Axel le 2026-08-26. Conséquences : franchise en base par défaut (C1), livre des recettes seul (C11), affiliation travailleur indépendant (D1). |
| B2 | Immatriculation au guichet unique INPI | ✅ | Vérifié le 2026-11-05 : immatriculé au RNE le 2026-10-20 (SIREN 131 769 317, SIRET 131 769 317 00010), publiés aux mentions légales le 2026-10-21. |
| B3 | Compte bancaire dédié | ❌ | Obligatoire pour une société ; en micro, au-delà de 10 000 € deux années de suite. |
| B4 | Déclaration CFE initiale | ❌ | À déposer avant le 31 décembre de l'année de création. Exonération la 1re année mais la déclaration reste due. |
| B5 | Domiciliation | ✅ | Vérifié le 2026-11-05 : société de domiciliation Les Tricolores, 138 avenue Victor Hugo, 75116 Paris, publiée aux mentions légales. Le domicile personnel reste hors du registre. |
| B6 | Assurance RC professionnelle | ❌ | Pas obligatoire légalement, mais exigée contractuellement par les acheteurs entreprise. |

### C. Fiscal et facturation : se déclenche au premier euro

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| C1 | Régime de TVA à déterminer | 🟡 | Franchise en base, conséquence du choix micro-entreprise. Mention « TVA non applicable, art. 293 B du CGI » due sur chaque facture (C4). ⚠️ Seuils services 37 500 € et 41 250 €, réforme du seuil unique votée puis suspendue : à revérifier. |
| C2 | Numéro de TVA intracommunautaire | ❌ | Nécessaire même en franchise en base, à cause de C3. |
| C3 | Autoliquidation de la TVA sur les achats étrangers | ❌ | 🔴 Due : Supabase, Vercel, Sentry et les frais Stripe sont tous étrangers. Stripe Tax ne couvre pas ce point (il ne connaît que les ventes). Règle la plus souvent ignorée. |
| C4 | Mention « TVA non applicable, art. 293 B du CGI » | ❌ | À configurer dans les factures Stripe tant que la franchise s'applique ; pas posée par défaut. |
| C5 | Mentions obligatoires des factures | ❌ | Le modèle Stripe n'est pas configuré pour la France. À auditer contre L441-9 et 242 nonies A. |
| C6 | Numérotation chronologique continue | ❌ | À vérifier côté Stripe : aucune rupture de séquence ne doit être possible. |
| C7 | Facturation électronique | ❌ | ⚠️ Calendrier décalé plusieurs fois, à revérifier. Chantier plus lourd que C9 ; suppose une plateforme agréée. |
| C8 | Guichet OSS (ventes B2C dans l'UE) | ⬜ | Sans objet tant que le marché reste français. Se déclenche au-delà de 10 000 € de ventes numériques à des consommateurs européens. |
| C9 | Conformité du logiciel d'encaissement | ✅ | Vérifié le 2026-08-26 (mig. `125`, appliquée en prod). Inaltérabilité : trigger `BEFORE UPDATE OR DELETE` qui lève (choisi plutôt que la RLS : `service_role` contourne la RLS, pas les triggers). Sécurisation : chaînage de hash SHA-256, `verify_payment_chain()` détecte toute altération. Conservation : aucune purge possible par construction. Archivage : `seal_payment_period()` fige un total mensuel et refuse le mois en cours. Prouvé en transaction annulée : UPDATE, DELETE et rejeu bloqués, falsification détectée. |
| C10 | Conservation des pièces | ✅ | Vérifié le 2026-09-20 sur `supabase/migration/125_payment_journal_inalterable.sql` : `trg_forbid_payment_mutation` et `trg_forbid_closure_mutation` lèvent (« journal append-only : ni UPDATE ni DELETE. Pour corriger, inserer une ligne compensatoire »). Le droit à l'effacement cède devant l'obligation de conservation (RGPD art. 17.3.b). 🔴 Une purge n'anonymise JAMAIS `user_id` : `row_hash` le scelle dans le chaînage, écrire NULL casserait la chaîne et produirait le signal de falsification montré à un contrôleur. `user_id` cesse d'identifier quiconque quand la ligne `auth.users` disparaît ; `delete-account` ne touche pas cette table. |
| C11 | Comptabilité (livre des recettes ou complète) | 🟡 | Livre des recettes seul, conséquence du régime micro. Le journal d'encaissement (C9) en fournit la matière, horodatée et scellée. Reste à tenir le registre lui-même. |
| C12 | Déclarations fiscales annuelles | ❌ | Selon la forme retenue en B1. |

### D. Social : se déclenche à la création, puis à l'embauche

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| D1 | Affiliation sociale du dirigeant | 🟡 | Travailleur indépendant, conséquence du régime micro. Cotisations en pourcentage du chiffre d'affaires encaissé, déclarées mensuellement ou trimestriellement. Effectif à l'immatriculation. |
| D2 | Déclarations et cotisations URSSAF | ❌ | Dues même sans rémunération dans certains cas. |
| D3 | Obligations d'employeur | ⬜ | Aucun salarié. Se déclenche au premier : DPAE, convention collective, DUERP, mutuelle, santé au travail, DSN, registre du personnel. |

### E. Droit de la consommation : s'applique à TOUTE l'offre

Par l'effet de la décision structurante : aucun client n'est vérifié comme professionnel.

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| E1 | CGV communiquées avant le contrat | 🟡 | Revu le 2026-11-01 : section 5 des CGU = conditions générales de vente (offre réellement vendue, TTC, reconduction, résiliation, retour au forfait gratuit sans retrait de membre), section 5 bis pour la rétractation, médiateur en 12 bis. ❌ Reste une relecture juridique. |
| E2 | Information précontractuelle | ✅ | Vérifié le 2026-11-01 (décision d'Axel) : au-dessus de la grille d'`OrgBillingTab`, pour tout propriétaire qui peut payer : « Abonnement à durée indéterminée, prix TTC, reconduit automatiquement à chaque échéance jusqu'à résiliation. Résiliable à tout moment depuis cet écran, sans motif ni frais. » (fr/en, clé `billing.precontractual`). Le montant exact est sur chaque carte, Stripe répète reconduction et résiliation au-dessus de son bouton (E8). Témoin : `e2e/demo-billing-consent.spec.ts`. |
| E3 | Rétractation 14 jours | ✅ | Vérifié le 2026-10-30 (décision d'Axel) : aucune renonciation recueillie ; les deux cases sont retirées d'`OrgBillingTab` et `stripe-org-checkout` ne les exige plus. Le client garde ses 14 jours et est remboursé en entier s'il se rétracte (CGU 5 bis). Les preuves antérieures restent dans `withdrawal_consents`. |
| E4 | Médiateur de la consommation | 🟡 | Revu le 2026-10-25 : adhésion à la Société Médiation Professionnelle (CPMN), texte repris mot pour mot dans les CGU (article 12 bis) et les mentions légales (5.p2) ; texte intégral au § Médiateur de la consommation. ❌ Reste le pied de facture Stripe : action Dashboard d'Axel (Settings, Billing, Invoices, Default footer), compte live. |
| E5 | Résiliation en ligne (L215-1-1) | ✅ | Vérifié le 2026-11-05, deux chemins. (1) App, onglet Facturation : « Résilier mon abonnement » (fin de période, `cancel_at_period_end`) et « Se rétracter du contrat ici » sous 14 jours, sans motif ni courrier, par l'Edge Function `stripe-org-subscription` (sonde `check:edge-smoke`), parcours joué par `e2e/stubbed/retractation.spec.ts` ; aucun bouton ne rembourse, `stripe-org-refund` est réservé à `is_admin()`. (2) Portail Stripe : configuration par défaut du compte live, `subscription_cancel` actif ([`STRIPE-LIVE.md`](./STRIPE-LIVE.md)). |
| E6 | Information de reconduction tacite | 🟡 | Revu le 2026-08-26 : mig. `126` (`renewal_notices`, clé primaire `(org_id, period_end)` qui rend l'envoi idempotent), Edge Function `renewal-notice`, workflow quotidien, fenêtre J+30 à J+60 (bornes légales de 1 à 3 mois), preuve enregistrée APRÈS l'envoi. ⚠️ Vert quand `CRON_SECRET` (Supabase et GitHub) et `RESEND_API_KEY` sont posés : sans eux la fonction refuse tout appel, en échec fermé. |
| E7 | Affichage des prix TTC | ✅ | Vérifié le 2026-10-31 : prix live en `tax_behavior: inclusive` ; mention « Tous les prix sont affichés TTC » sous la grille publique (`PricingSection.tsx`) ; dans `EnterpriseTierGrid.tsx`, « TTC » suit chaque prix (mensuel, annuel, barré). fr et en. |
| E8 | Bouton de commande explicite | 🟡 | Revu le 2026-08-26 : `custom_text.submit.message` dans `stripe-org-checkout` (« commande avec obligation de paiement », reconduction et résiliation annoncées avant le clic). `submit_type` n'existe pas en `mode: 'subscription'` : le libellé du bouton Stripe n'est pas réécrivable. ⚠️ Vérifier que la fonction déployée porte ce texte. |
| E10 | Opposabilité des CGU (C. civ. art. 1119) | ✅ | Vérifié le 2026-10-13 : les CGU sont présentées à l'inscription (lien sous le bouton de création de compte, Google compris). Les comptes créés avant cette date ne les ont pas vues : le préavis de `M-63` est l'occasion de les leur présenter. |
| E11 | Clauses abusives (C. conso R212-1, liste noire) | 🟡 | Revu le 2026-10-13 : 9.p1 « du fait d'un tiers » restreint au fait imprévisible et insurmontable d'un tiers étranger au service (L221-15) ; 12.p3 « dans la mesure où la loi le permet » (CPC art. 48) ; plafond de responsabilité réservé aux professionnels (il valait 0 € pour un utilisateur gratuit, R212-1 6°) ; « décline toute responsabilité » (8) retiré ; suspension « sans préavis » (3.2) remplacée par information préalable, motif et contestation ; modification unilatérale (11) : préavis d'un mois et droit de partir sans frais. Non relues par un juriste. |
| E12 | Formulaire type de rétractation (L221-5, R221-1) | ✅ | Vérifié le 2026-09-24 : CGU 5 bis.4, avec la renonciation réécrite selon L221-25 (prorata si accès immédiat demandé). |
| E14 | Information précontractuelle du service GRATUIT (directive 2019/2161, C. conso L111-1, L221-5) | 🟡 | Revu le 2026-10-13 : le service gratuit est fourni contre des données personnelles, le droit de la consommation à distance s'applique donc sans attendre le premier euro. Ajoutés aux CGU : identité de l'éditeur (1.3), garantie légale de conformité et ses modalités (9.4). ❌ Reste la qualification du médiateur pour un service gratuit (E4, `M-76`). |
| E13 | Fonction de rétractation en ligne (directive 2023/2673) | ❌ | Applicable depuis le 19/06/2026 aux contrats conclus en ligne : bouton de rétractation pendant les 14 jours. Le bouton « Se rétracter du contrat ici » existe (E5) ; ⚠️ transposition française et libellé attendu à vérifier. |
| E9 | Garantie de conformité du service numérique | ✅ | Vérifié le 2026-10-31 : aucune intégration inexistante n'est promise (ni SSO, ni API), les réponses de la FAQ sur le cloisonnement et le non-retrait de membres sont exactes ; « résiliable à tout moment » (`pricing.i5`) et « réversible à tout moment » (`hero.reassurance`) sont tenues par les deux chemins de résiliation d'E5. |

### F. Produit, marque et dépendances

| # | Obligation | Statut | Ce qui manque exactement |
|---|---|:--:|---|
| F1 | Recherche d'antériorité sur le nom | 🟡 | Revu le 2026-10-16 : relevé TMview fait (plusieurs marques `COSMO` actives en classes 9 et 42 dans l'Union), détail et options dans [`MARQUE-COSMO.md`](./MARQUE-COSMO.md). TMview n'a aucun effet juridique : ❌ reste l'arbitrage par un conseil en propriété industrielle (aucun consulté), à faire avant d'investir en acquisition. |
| F2 | Dépôt de marque INPI | ❌ | Pas obligatoire, mais sans dépôt aucun droit exclusif sur le nom. Dépend de F1. |
| F3 | Conformité des licences open source | ✅ | Vérifié le 2026-08-26 : toutes permissives (MIT, ISC, Apache-2.0, BSD), aucune licence à réciprocité forte (ni GPL, ni AGPL, ni SSPL), aucune licence non déclarée. MPL-2.0 (`axe-core`) et CC-BY-4.0 (`caniuse-lite`) sont des dépendances de build ou de test, non embarquées. GSAP : licence propre, vérifiée à la source, libre d'usage commercial plugins compris, sans attribution obligatoire (seule interdiction : les outils d'animation sans code concurrents de Webflow). |
| F4 | Accessibilité (législation européenne) | 🟡 | Travail engagé côté produit ([`ACCESSIBILITY.md`](./ACCESSIBILITY.md)). ⚠️ Exemption microentreprise à vérifier, seuil à surveiller ; demandé par les acheteurs B2B de toute façon. |
| F5 | Transparence des systèmes d'IA | ⬜ | ⚠️ Se déclenche si la direction produit vers des agents IA se concrétise : informer clairement l'utilisateur ; à prévoir dès la conception. |
| F7 | Hébergeur de contenus (DSA, règl. 2022/2065 art. 11, 12, 14, 16, 17) | 🟡 | Revu le 2026-09-24 : CGU 4 bis (procédure de signalement avec les éléments de l'art. 16, motivation et contestation des restrictions art. 17, point de contact `contact@thecosmo.app` art. 11 et 12). Les tâches partagées et commentaires d'équipe font de COSMO un hébergeur ; l'exemption des micro-entreprises (art. 19) ne couvre pas l'art. 16. Reste : un formulaire dans l'app serait plus sûr qu'un e-mail. |
| F8 | Changement de fournisseur (Data Act, règl. 2023/2854 chap. VI) | 🟡 | ⚠️ À qualifier par un juriste (relevé le 2026-09-24) : un SaaS est un « service de traitement de données ». Export CSV sans frais, CGU 6.4. L'art. 25 demande davantage (préavis maximal, période de récupération) ; la suppression de compte est immédiate. |
| F9 | Notices des licences open source | ✅ | Vérifié le 2026-09-24 : MIT, BSD, ISC et Apache exigent de reproduire leur copyright dans les copies distribuées, dont le bundle. `scripts/third-party-notices.mjs` écrit `dist/third-party-notices.txt` à chaque build (fermeture transitive des `dependencies`), lié depuis les mentions légales (s3) ; généré, jamais commité. Garde : `scripts/third-party-notices.guard.test.mjs`. Compatibilité : F3. |
| F10 | Allégations et publicité comparative (C. conso L121-2, L122-1 à L122-7) | ✅ | Vérifié le 2026-10-13 : plus de « seule application qui… » ; FAQ entreprise réécrite (un responsable voit la dernière activité et qui a terminé quoi, notice `org.consent.reports`) ; « personne d'autre ne peut accéder » réécrite ; article Cosmo vs Todoist daté, sourcé. ⚠️ Les faits sur Todoist se relisent à chaque mise à jour. |
| F11 | Conditions d'usage de l'hébergeur (Vercel) | ❌ | Relevé le 2026-10-13 : l'équipe Vercel porte le nom par défaut d'un compte personnel, plan probablement Hobby (usage non commercial, hors DPA de Vercel) alors qu'une page de tarifs publiée est un usage commercial. À vérifier, passer en Pro si Hobby. Non vérifiable par l'API (le plan n'y figure pas). |
| F6 | Obligations liées au partage entre utilisateurs | ⬜ | Micro et petites entreprises largement exemptées, mais pas de tout. Qualification à faire. |

### DPA des sous-traitants (lus à leur source le 2026-09-14)

| Sous-traitant | Ce que dit leur DPA | Action |
|---|---|---|
| Supabase | `supabase.com/legal/dpa`, clause 12.2 : « acceptance of the Agreement shall have the same effect as signing the SCCs ». Il fait partie des ToS dès leur acceptation. | ✅ Rien à signer ; archiver une copie datée comme preuve documentaire. |
| Sentry | Acte d'acceptation explicite requis (Legal & Compliance, ou DocuSign) ; seul un Owner ou Billing peut l'accepter. | ❌ Axel seul : accepter le DPA dans le compte Sentry. |
| Vercel | `vercel.com/legal/dpa` : « forms part of Vercel Enterprise Terms and Conditions », pour les plans Enterprise et Pro ; le plan Hobby n'est pas mentionné. | ⚠️ Axel : vérifier le plan du projet `cosmo1` ; si Hobby, contacter le support ou passer en Pro. |

- ❌ Ne pas conclure que A5 est réglée : une seule ligne (Supabase) l'est sans action.
- ⚠️ Ce relevé ne couvre que Supabase, Vercel, Sentry : ni Stripe (DPA propre à la relation de paiement), ni Resend, Cloudflare, GitHub, Google, ni un futur sous-traitant.
- ❌ Ne jamais ajouter un prestataire traitant des données sans archiver son DPA : pièce réclamée par un acheteur entreprise, elle ne se reconstitue pas après coup.

### Où en es-tu

Compte recompté par `node scripts/check-legal-table.mjs` ; ne jamais reporter un total de tête.

| Statut | Nombre |
|---|---|
| ✅ Bon | **23** |
| 🟡 Partiellement bon | **19** |
| ❌ À faire | **14** |
| ⬜ Sans objet aujourd'hui | **5** |
| **Total** | **61** |

Familles de lignes ❌ :

| Famille | Lignes | Qui agit |
|---|---|---|
| Actes juridiques ou administratifs | B3, B4, B6, C2, C3, C12, D2, F2 | Axel seul : ouvrir un compte, adhérer, signer, déposer. Aucun code n'y change rien. |
| Réglages hors dépôt (Dashboard Stripe) | C4, C5, C6 | Axel, deux minutes chacun. |
| Développement ou veille | C7, E13, F11 | Facturation électronique (plateforme agréée), fonction de rétractation, plan Vercel. |

## 3. Au premier euro encaissé

- 🔴 Encaisser avant l'immatriculation est du travail dissimulé (voir État de la facturation).
- ✅ TVA, trois scénarios selon le chiffre d'affaires : moins de 10 000 € = franchise en base, mention « TVA non applicable, art. 293 B du CGI » sur chaque facture, aucun guichet européen ; de 10 000 à 37 500 € = franchise côté français, mais le seuil européen de 10 000 € de ventes numériques à des consommateurs peut ouvrir le guichet OSS (sans objet tant que le marché reste français) ; au-delà de 37 500 € = sortie de la franchise (seuils 37 500 € en base, 41 250 € majoré, réforme du seuil unique suspendue : revérifier).
- 🔴 Le franchissement est immédiat : au-delà du seuil majoré, la TVA est due dès le premier jour du mois de dépassement, sur les ventes déjà encaissées ce mois-là.
- 🔴 L'effet TTC sur la marge : le jour de l'assujettissement, un abonnement affiché 20 € TTC ne rapporte plus que 16,67 € (17 % de marge en moins), sans pouvoir augmenter les abonnés existants sans préavis. L'intégrer dans le modèle économique.
- ❌ L'autoliquidation de la TVA sur les achats à un prestataire établi hors de France (toute la stack) est due même en franchise en base et suppose un numéro de TVA intracommunautaire. Stripe Tax ne couvre que les ventes.
- ✅ Facturation : mentions obligatoires et numérotation chronologique continue sans trou (Code de commerce L441-9, CGI ann. II art. 242 nonies A), à vérifier sur le modèle Stripe, non configuré pour la France par défaut. ⚠️ Facturation électronique : réception obligatoire pour tous puis émission par vagues via une plateforme agréée, calendrier décalé plusieurs fois.
- ✅ Conformité du logiciel d'encaissement (dite NF525) : vise les assujettis à la TVA qui enregistrent des règlements de clients particuliers ; inaltérable, sécurisé, conservé, archivé, justifié par une certification payante ou une attestation individuelle gratuite signée par l'éditeur (C9). ❌ Ne pas signer l'attestation sans le journal inaltérable : une attestation mensongère est pire qu'aucune. Question à faire trancher : une entreprise en franchise en base est-elle visée ?
- ✅ Conservation : dix ans pour les pièces comptables, six ans de présentation à l'administration fiscale. ❌ Aucune purge, y compris motivée par le RGPD, ne doit atteindre les données de facturation.

## 4. Droit de la consommation

S'applique à toute l'offre, par l'effet de la décision structurante.

| Obligation | Référence | Notes |
|---|---|---|
| CGV communiquées avant le contrat | Conso. L111-1, L221-5 | Un modèle générique est un risque, pas une protection (E1). |
| Droit de rétractation de 14 jours | Conso. L221-18, L221-28 | Aucune renonciation recueillie (E3). Écartable pour un contenu numérique seulement avec accord exprès à l'exécution immédiate ET renonciation explicite : les deux, pas une. |
| Médiateur de la consommation | Conso. L612-1, L616-1 | Société Médiation Professionnelle, CGU 12 bis et mentions légales ; reste le pied de facture (E4). |
| Résiliation en ligne | Conso. L215-1-1 | Satisfaite (E5). |
| Information de reconduction tacite | Conso. L215-1 | Facturation annuelle : rappel à J-45, preuve dans `renewal_notices` (E6). |
| Prix TTC affichés | Conso. L112-1 | `tax_behavior: inclusive`, mention affichée (E7). |
| Bouton de commande explicite | Conso. L221-14 | « Commande avec obligation de paiement » ; un simple « Valider » rend le contrat inopposable (E8). |
| Garantie de conformité du service numérique | Conso. L224-25-1 s. | ⚠️ Une fonctionnalité promise sur la landing et non livrée devient un défaut opposable (E9). |

### Médiateur de la consommation

Médiateur : Société Médiation Professionnelle, membre de la CPMN. Texte fourni par le médiateur, à reprendre mot pour mot.

1. Dans les conditions générales de vente (rendu : CGU article 12 bis, `terms.s12bis`) :

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

2. Sur les factures :

> Société Médiation Professionnelle
> www.mediateur-consommation-smp.fr
> Alteritae 5 rue Salvaing 12000 Rodez

3. Sur le site internet : les mêmes informations (rendu : mentions légales 5.p2 et CGU 12 bis).

- ✅ Seule adaptation : « Service Relations Clientèle » remplacé par `contact@thecosmo.app`, COSMO n'ayant pas de tel service.
- ⚠️ Les factures sont émises par Stripe : le bloc 2 se pose dans le pied de facture par défaut du Dashboard (action manuelle, E4).

## 5. Produit, marque et dépendances

- ✅ Marque COSMO : [`MARQUE-COSMO.md`](./MARQUE-COSMO.md) (relevé, options, pièces pour un CPI). 🔴 TMview n'a aucun effet juridique ; consulter un CPI avant d'investir davantage en acquisition (se voir opposer une marque après le lancement oblige à renommer produit, domaine et communication).
- ✅ Licences open source : F3 (compatibilité) et F9 (notices).
- ⚠️ Accessibilité, IA, partage entre utilisateurs : F4, F5, F6.

## 6. Sous-traitants et transferts

| Prestataire | Rôle | Localisation | À faire |
|---|---|---|---|
| Supabase | base de données, auth | `eu-west-1`, Irlande | ✅ DPA applicable (relu le 2026-09-14) : auto-incorporé aux ToS dès l'acceptation du compte. Archiver une copie datée. |
| Vercel | hébergement front | société américaine, région du projet non vérifiée | ⚠️ Le DPA publié ne couvre explicitement que les plans Enterprise et Pro (relu le 2026-09-14) : vérifier le plan du projet `cosmo1` (F11). Traite au minimum les adresses IP et les logs. |
| Stripe | paiement | Irlande et États-Unis | DPA. Responsable de traitement pour ses propres finalités antifraude. |
| Sentry | monitoring | société américaine | ❌ DPA à accepter dans Legal & Compliance par un Owner ou Billing (relu le 2026-09-14). `beforeSend` retire déjà emails et UUID : documenter comme mesure de minimisation. |
| Resend | e-mails transactionnels (invitations, avis de reconduction, signalements, inactivité) | société américaine | ⚠️ DPA non archivé (A5). |
| Cloudflare (Turnstile) | anti-robot des formulaires de connexion et d'inscription | société américaine | ⚠️ Reçoit l'adresse IP et des signaux du navigateur, seulement si la clé Turnstile est posée. DPA non archivé. |
| Google | connexion OAuth (choix de l'utilisateur), avatars | Irlande et États-Unis | Uniquement si l'utilisateur choisit la connexion Google. |
| GitHub | sauvegardes chiffrées de la base (artefact de `db-backup.yml`, 30 jours) | États-Unis | Dump chiffré, clé hors de GitHub. |
| Analytics | mesure d'audience | Vercel Analytics et mesure maison, sous consentement | Aucun script tiers de mesure ; voir A4 et le registre T8. |

- ✅ `npm run check:subprocessors` compare ce tableau et celui du registre aux tiers appelés par le code, dans les deux sens : ne pas renommer le titre « Sous-traitants et transferts » ni la colonne « Prestataire » ; ajouter une ligne ici ET au registre quand un tiers apparaît.

---

## Garde-fous techniques

- ❌ Ne pas ouvrir de bouton de paiement réel avant l'obtention du SIREN.
- ❌ Ne jamais créer un prix Stripe sans `tax_behavior` explicite : le réglage est définitif (`unspecified` est à ne pas reproduire).
- ❌ Ne pas activer la collecte Stripe Tax tant que la franchise en base s'applique : aucun enregistrement fiscal n'existe.
- ❌ Ne pas raisonner « offre entreprise donc B2B ».
- ❌ Ne pas laisser une purge RGPD atteindre les données de facturation (dix ans).
- ❌ Ne pas signer l'attestation de conformité d'encaissement sans le journal inaltérable.
- ❌ Ne pas promettre sur la landing une fonctionnalité non livrée : défaut de conformité opposable par un consommateur.

## Annexe : mesures techniques et organisationnelles (art. 32)

Pièce réclamée en contrôle CNIL et dans les questionnaires d'achat B2B. Détail d'implémentation : [`SECURITY.md`](./SECURITY.md), non dupliqué ici.

### Mesures en place

| Mesure | Mise en œuvre | Source |
|---|---|---|
| Chiffrement en transit | HSTS `max-age=63072000`, `includeSubDomains`, `preload`. Aucun accès en clair. | `vercel.json` |
| Localisation des données | Supabase `eu-west-1` (Irlande). Aucun transfert hors UE pour la base. | console Supabase |
| Cloisonnement par utilisateur | RLS activée sur toutes les tables, une seule policy permissive par rôle et action (mig. `049`). Isolation prouvée par test d'intégration. | `supabase/migration/`, `e2e/rls/` |
| Contrôle d'accès | Supabase Auth. `ProtectedRoute` est une défense en profondeur, la frontière est la RLS. | `src/App.tsx` |
| Moindre privilège | `service_role` jamais exposé au navigateur. Helpers sensibles : `EXECUTE` révoqué à `authenticated` (mig. `100`). | `.env.example`, migrations |
| Maîtrise des écritures | Whitelist `mapToDb` côté repository ; `zod` est une garde UX, la whitelist est la barrière. | `src/lib/validation/` |
| Anti-XSS et injection | CSP stricte : `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. | `vercel.json` |
| Anti-clickjacking | `X-Frame-Options: DENY` et `frame-ancestors 'none'`. | `vercel.json` |
| Durcissement navigateur | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` fermant caméra, micro, géolocalisation. | `vercel.json` |
| Minimisation dans le monitoring | `sendDefaultPii: false` ; `beforeSend` retire emails et UUID des messages, exceptions et breadcrumbs. | `src/main.tsx` |
| Réduction de surface tierce | Aucun script tiers de mesure : audience maison, revérifiée avant chaque envoi (consentement, page publique, hors session), postée à la même origine. | `src/lib/traffic.ts`, `api/collect.ts` |
| Traçabilité des versions | `release` Sentry = SHA du commit. | `src/main.tsx` |
| Contrôle continu | Gates CI bloquantes : `check:rls`, `validate:migrations`, `test:rls`, `i18n:check`, `check:bundle`. | `package.json` |
| Effacement | Edge Function `delete-account`, export CSV au titre de la portabilité. | `supabase/functions/delete-account`, `src/lib/csv-export.ts` |

### Limites assumées

Un document art. 32 qui ne recense que ses forces ne vaut rien en contrôle.

- ⚠️ `style-src 'unsafe-inline'` reste nécessaire à la chaîne de styles : assouplissement conscient de la CSP.
- ❌ Réintroduire un script publicitaire rouvrirait la question du consentement (A4) : la publicité n'en est JAMAIS exemptée. Les origines publicitaires sont retirées de la CSP.
- ⚠️ Aucun exercice de restauration n'a été conduit : les sauvegardes dépendent du plan Supabase souscrit, leur existence et leur délai de restauration restent à vérifier.
- ⚠️ Pas de journal d'accès applicatif distinct des logs d'infrastructure.
- ✅ Sauvegardes chez GitHub : chiffrées (AES-256) avant dépôt, phrase secrète en secret GitHub et copie hors dépôt chez Axel. Elles ont été publiques et en clair : violation consignée au registre privé.

## Engagements

Chaque ligne au vert est une promesse tenue publiquement, vérifiable par un client, opposable par un contrôleur.

### Permanents

| Engagement | Obligation | Si non tenu |
|---|---|---|
| Répondre aux demandes RGPD en un mois | Surveiller la boîte de contact ; le délai court dès la réception. | Manquement caractérisé, saisine possible de la CNIL |
| Notifier une violation en 72 heures | Le compte à rebours part à la prise de connaissance, week-end compris. | Sanction distincte de la violation |
| Tenir le registre des violations | Y consigner aussi celles qu'on décide de ne pas notifier, avec la justification. | Une absence non documentée est indistinguable d'un manquement |
| Maintenir les mesures de sécurité déclarées | HSTS, CSP stricte, RLS sur toutes les tables, scrubbing Sentry : ne pas assouplir sans mettre à jour l'annexe. | L'annexe art. 32 devient une preuve à charge |
| Ne charger aucun traceur sans consentement | Tout nouvel outil de mesure ou de publicité passe par le store de consentement. | Bandeau mensonger, pire que son absence |
| Purger les comptes clos sous 90 jours | Durée annoncée par la politique. | Conservation excessive, contradiction avec la politique |
| Supprimer les comptes inactifs depuis 3 ans | Avertir par e-mail 30 jours avant, puis supprimer (A15). | Promesse de la politique non tenue |
| Ne jamais déposer une donnée personnelle en clair hors de la base | Sauvegardes chiffrées avant tout dépôt ; aucun export, log ou artefact public qui en contienne. | Nouvelle violation |
| Ne poser aucun identifiant ni source d'acquisition sans « Accepter » | Tout stockage local non strictement nécessaire passe par `hasConsented()` et s'efface au refus. | Traceur illicite |
| Faire entrer toute nouvelle donnée saisie dans l'export | Une nouvelle table utilisateur non exportée rend la portabilité fausse (`npm run check:portability`). | Portabilité creuse |
| Conserver le journal d'encaissement dix ans | Aucune suppression, aucune anonymisation (`row_hash` scelle `user_id`, voir C10). | Perte d'une pièce comptable obligatoire |
| Laisser retirer le consentement | « Gérer les cookies » atteignable partout où le bandeau peut apparaître ; tout nouveau traceur efface ses traces au retrait (`clearAudienceTraces`). | Consentement non valable |
| Traiter un signalement de contenu | Répondre à `contact@thecosmo.app`, motiver toute restriction, permettre la contestation (CGU 4 bis). | Manquement au DSA, art. 16 et 17 |

### Envers les clients, dès le premier paiement

| Engagement | Obligation | Coût si oublié |
|---|---|---|
| Le prix affiché est le prix payé | `tax_behavior: inclusive` est définitif ; à l'assujettissement TVA, 20 € TTC rapportent 16,67 €. | 17 % de marge en moins, sans hausse possible des abonnés existants sans préavis |
| Rembourser sous 14 jours toute rétractation | Aucune renonciation recueillie (E3). | Remboursement intégral dû sur simple demande |
| Résilier depuis l'application, sans motif ni frais | Promis dans les CGU, la landing et l'écran de paiement ; satisfait par E5. | Manquement à L215-1-1 |
| Informer avant chaque reconduction annuelle | E6 (secrets `CRON_SECRET` et `RESEND_API_KEY` posés). | Le client peut résilier à tout moment sans frais |
| Ne jamais retirer un membre en cas de baisse de palier | Annoncé en FAQ : on bloque la croissance, on ne retire rien. | Contradiction avec une promesse écrite |
| Livrer ce que la landing annonce | Voir E9. | Réduction de prix ou résolution du contrat |

### Découlant des décisions d'Axel

| Décision | Engagement |
|---|---|
| Un particulier peut acheter | Tout le droit de la consommation s'applique à toute l'offre, y compris l'adhésion à un médiateur. |
| Micro-entreprise | Franchise en base, livre des recettes, affiliation travailleur indépendant, et autoliquidation de la TVA sur les achats étrangers (même en franchise). |
| Société de domiciliation | Coût mensuel récurrent, adresse personnelle hors du registre public. |
| Journal d'encaissement construit | Attestation individuelle signable honnêtement. |

## Décisions encore ouvertes

1. Chiffre d'affaires visé : non déterminé, le calendrier TVA reste théorique.
2. Franchise en base et conformité d'encaissement : point à faire trancher (2 à 4 jours de développement).
3. `tax_code` des produits Stripe : non renseigné ; détermine le taux par pays le jour où Stripe Tax est activé.
4. Champ SIRET facultatif et `tax_id_collection` : décidé, non implémenté.

## Ordre de traitement

1. Recherche d'antériorité sur le nom (F1) : le moins cher, le plus coûteux à reporter.
2. Rendez-vous de cadrage ponctuel avec un expert-comptable, ce document en main.
3. Implémenter `tax_id_collection` et le champ SIRET facultatif.
4. Régler les lignes ❌ des familles B, C, D.
5. Vérifier E6 et E8 en production.
