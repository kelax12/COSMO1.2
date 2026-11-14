# Journal des documents contractuels

**Quand lire** : avant de modifier `src/locales/{fr,en}/{legal,legalTerms,legalPrivacy}.json` (CGU, confidentialité, mentions légales). **Fait foi** : `npm run check:legal-journal` (`scripts/check-legal-journal.mjs`, test `scripts/check-legal-journal.guard.test.mjs`), qui LIT ce fichier : ne pas le déplacer. Obligations et tableau de conformité : [`LEGAL.md`](./LEGAL.md). Journal par nature : une entrée par modification, ajoutée en bas de « Entrées », jamais réécrite.

## Règles

- 🔴 Toute modification d'un catalogue juridique s'écrit ici AVANT le push : date, ce qui a changé, FOND ou FORME, préavis dû ou non. La garde rougit `lint-test-build` tant que l'entrée manque.
- 🔴 Une modification de fond déclenche le préavis d'un mois de l'article 11 des CGU (Conso. L212-1 s.). Le préavis ne part pas tout seul : c'est un geste d'Axel (`a-faire-manuel.md`, hors dépôt) dont la trace est `renewal_notices`, une PREUVE qu'on ne purge jamais.
- ❌ Ne jamais recopier une empreinte sans avoir écrit ce qui a changé : l'empreinte est une clé de recherche, la phrase à côté est la pièce en cas de litige.
- ❌ Ne jamais recopier une empreinte d'un tableau ancien : la relever par `node scripts/check-legal-journal.mjs` (le message la nomme).
- ⚠️ La garde ne distingue pas fond et forme, volontairement : ce tri est un jugement humain à écrire. Une entrée « typographie, pas de préavis » coûte trente secondes.
- ✅ L'empreinte porte sur la RÉUNION des trois catalogues d'une langue, calculée sur le JSON re-sérialisé à clés triées : déplacer une clé entre catalogues ou reformater ne la change pas, modifier un mot la change toujours.
- ✅ Procédure : modifier les catalogues en `fr` ET `en` ; relever l'empreinte ; écrire l'entrée ; `npm run check:legal-journal -- --update` vérifie que l'entrée est là sans rien écrire.
- ❌ Ne jamais écrire une empreinte par `--update` : il ne recale rien tout seul.
- ⚠️ Chaque empreinte courante des deux documents doit figurer dans ce fichier : le test `check-legal-journal.guard.test.mjs` le vérifie.
- ⚠️ Une qualification « aucun préavis » posée par un assistant est à confirmer par Axel ; aucune entrée n'est un avis juridique.

## Entrées

### 2026-09-20 · pose du journal · aucun changement de contenu

| Catalogue | Empreinte |
|---|---|
| `src/locales/fr/legal.json` | `2b72b680072ffe35` |
| `src/locales/en/legal.json` | `01d51a2cb852f86d` |

Fige l'état existant ; aucun préavis. Ne certifie pas que les CGU soient conformes (ligne `A2` de [`LEGAL.md`](./LEGAL.md), vérifiée à la main).

### 2026-09-24 · passe de conformité · FOND · préavis dû pour trois clauses

| Catalogue | Empreinte |
|---|---|
| `src/locales/fr/legal.json` | `40a849b623af87e4` |
| `src/locales/en/legal.json` | `477a96cee124c558` |

Analyse : [archive](./archive/LEGAL-audits-et-etat-des-lieux-2026-08-26-au-2026-10-13.md) § « Audit du 2026-09-24 ».

CGU :

| Clause | Changement | Sens pour l'utilisateur |
|---|---|---|
| 2 | « mode Premium » (inexistant) remplacé par l'espace entreprise, gratuit à ce jour | forme, exactitude |
| 3.2 | suspension « sans préavis ni indemnité » remplacée par : manquement grave, information préalable avec motif, contestation, récupération des données (supprime la contradiction avec 10.2) | plus favorable |
| 3.3 | nouvelle : âge minimum 15 ans, accord parental en dessous | 🔴 nouvelle condition, préavis dû |
| 4 bis | nouvelle : signalement de contenu illicite et point de contact DSA (art. 11, 12, 16, 17) | nouveau droit |
| 5 bis.2 | renonciation à la rétractation réécrite selon L221-25 / L221-28 | plus exact, plus favorable |
| 5 bis.4 | nouvelle : modèle de formulaire de rétractation (L221-5) | nouveau droit |
| 6.3 | nouvelle : clause de sous-traitance RGPD art. 28 pour l'espace entreprise | 🔴 nouvelle répartition des rôles, préavis dû aux organisations |
| 6.4 | nouvelle : export sans frais pour changer de service | nouveau droit |
| 8 | « décline toute responsabilité » retiré | plus favorable |
| 9 | plafond de responsabilité réservé aux professionnels (dommages directs + 12 mois), consommateurs hors de toute limitation au-delà de la loi (R212-1 6°) | plus favorable aux consommateurs, 🔴 plus restrictif pour un professionnel, préavis dû |
| 11 | « en vigueur dès publication » remplacé par un préavis de 30 jours pour une modification substantielle, droit de partir sans frais | plus favorable |

- Politique de confidentialité : Premium et tokens retirés ; données de l'espace entreprise et signalements de bug ajoutés ; Resend et Cloudflare Turnstile ajoutés aux destinataires et transferts ; directives post mortem (loi I&L art. 85) ; âge de 15 ans pour la mesure d'audience ; choix conservé six mois et retrait par « Gérer les cookies ». Information, pas de préavis (art. 13 et 14 RGPD).
- Mentions légales : localisation AWS Irlande de la base ; lien vers les notices des licences open source (s3, ligne F9 de `LEGAL.md`) ; juridiction du consommateur préservée (s5). Forme.
- 🔴 Préavis à envoyer par Axel : e-mail aux comptes existants annonçant les clauses 3.3, 6.3 et 9, opposables 30 jours après l'envoi.
- ⚠️ Rédigé par un assistant : la clause 6.3 tient lieu de contrat art. 28 (huit éléments de l'art. 28.3) mais un acheteur B2B peut exiger un DPA séparé et signé.

### 2026-10-01 · découpage des catalogues · aucun changement de contenu · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `40a849b623af87e4` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `477a96cee124c558` |

CGU et confidentialité quittent `legal.json` pour `legalTerms.json` et `legalPrivacy.json` (chargés par leur seule page, budget de bundle). Empreinte identique à celle du 2026-09-24 : aucune clause n'a bougé.

### 2026-10-10 · identité de l'éditeur · FOND (identification) · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `7b98a53c54266c40` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `227b1e35354d1039` |

- Mentions légales s1 : « Dénomination : Cosmo » devient « Éditeur : Axel Longatte, personne physique » ; directeur de la publication : Axel Longatte (LCEN 6-III, loi de 1982 art. 93-2).
- Confidentialité s1 : le responsable de traitement est Axel Longatte, plus « l'équipe Cosmo » (RGPD art. 13.1.a).
- Dates de mise à jour portées au 10 octobre 2026.
- Aucun préavis : information exacte due tout de suite, aucune clause des CGU ne bouge. Lignes `A2` et `A3` de `LEGAL.md`.

### 2026-10-12 · adresse de contact · FORME · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `26976cb9601f5f41` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `c28a46c4cd194d75` |

L'adresse `axellongattepro@gmail.com` devient `contact@thecosmo.app` partout (mentions s1 et contact, confidentialité s1 et exercice des droits, CGU : rétractation 5 bis, modèle de formulaire, données 6, contact) ; c'est l'adresse déjà publiée comme point de contact DSA (CGU 4 bis). Dates portées au 12 octobre 2026. ⚠️ La boîte doit être relevée : une rétractation ou une demande RGPD y fait courir les délais légaux (14 jours, un mois).

### 2026-10-13 · audit juridique avant déploiement · FOND (information) et FORME · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `b11060a6dc7f99c9` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `64df04e46c848228` |

Analyse : [archive](./archive/LEGAL-audits-et-etat-des-lieux-2026-08-26-au-2026-10-13.md) § « Audit du 2026-10-13 ».

CGU :

| Clause | Changement | Sens |
|---|---|---|
| 1 (nouveau §3) | l'éditeur est nommé (Axel Longatte) (C. conso L111-1, L221-5) | information |
| 7 | « propriété exclusive de Cosmo » devient « de son éditeur », sous réserve des licences open source | forme |
| 9.p1 | exonération « du fait d'un tiers » restreinte au fait imprévisible et insurmontable d'un tiers étranger à la fourniture (L221-15) | plus favorable |
| 9 (nouveau §4) | garantie légale de conformité du service numérique (L224-25-1 s.) | information, plus favorable |
| 12.p3 | clause attributive de juridiction « dans la mesure où la loi le permet » | plus favorable |

- Confidentialité : origine des inscriptions et comptage des essais de la démonstration décrits, désormais sous consentement ; jours de connexion rattachés à une finalité et une base légale (intérêt légitime) ; invitations par e-mail (7 jours + 30 jours) ; Sentry décrit exactement (l'identifiant technique du compte EST joint aux rapports, ce que le texte niait ; jetons retirés des adresses ; hébergement UE) ; GitHub ajouté (sauvegardes chiffrées) ; transferts complétés (Stripe, Google, GitHub, Supabase Inc.) ; accès d'administration de l'éditeur dit ; durées ajoutées : comptes inactifs 3 ans avec avertissement 30 jours avant, signalements de bug 12 mois, sauvegardes 30 jours ; retrait du consentement par « Gérer les cookies ». Information, pas de préavis.
- ⚠️ La suppression des comptes inactifs après 3 ans est une règle nouvelle qu'aucun compte ne peut atteindre avant 2029 et qui s'annonce 30 jours avant ; la glisser dans le préavis de `M-63` reste la forme la plus propre.
- Mentions légales : adresse de Vercel mise à jour ; propriété des contenus attribuée à l'éditeur et non aux données des utilisateurs ; suppression de la clause « ne saurait être tenu responsable des dommages directs ou indirects » (clause noire R212-1 6°, contraire à l'art. 9 des CGU), remplacée par un renvoi à l'art. 9. Forme, plus favorable.
- ❌ Restait ouvert sur les mentions : adresse et téléphone de l'éditeur (LCEN art. 1-1), téléphone des hébergeurs.

### 2026-10-18 · mesure d'audience internalisée · FOND (information) · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `d10728a3fde91ac2` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `dc7fab7e40f1de4e` |

Confidentialité seulement : le fournisseur tiers de mesure d'audience est débranché et retiré (§2 p1 à p3, base légale §5, destinataires §7, traceurs §10). Reste Vercel Analytics, sous consentement, qui couvre tout le site une fois accepté ; les statistiques d'usage sont calculées en interne. Un destinataire et un traceur en moins : information plus favorable.

### 2026-10-18 · mesure d'audience maison (mig. 222) · FOND (information) · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `a44ecb55e4be7d94` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `e3d741991fd75d93` |

Confidentialité §2 p1 : Cosmo mesure lui-même la fréquentation des pages publiques, sous le même consentement que Vercel Analytics et pour la même finalité. Données ajoutées : pays et ville approximatifs, navigateur et appareil, temps passé, défilement, clics sur les principaux boutons. L'adresse IP n'est pas conservée (identifiant du jour, lien détruit le lendemain) ; conservation 13 mois. Registre : `RGPD-REGISTRE.md` T8. Rien n'est collecté sans « Accepter ».

- ⚠️ Question ouverte, à trancher par Axel : un accord donné avant couvrait une mesure plus étroite (pages vues et référent). Même finalité, catégories élargies : redemander le consentement lèverait le doute.

### 2026-10-21 · immatriculation de l'éditeur, section Prospection · FOND (identification, information) · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `831aab907b40374b` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `7b4ef7f726b92f39` |

Commits `e2e7679f` et `899f707f`, poussés sans entrée (la garde a tenu `lint-test-build` rouge).

- Mentions légales s1 : « personne physique » devient « entrepreneur individuel (EI), nom commercial COSMO » ; immatriculation (RNE, SIREN, SIRET, code APE), « TVA non applicable, article 293 B du CGI », téléphone de l'éditeur ; code postal corrigé (75116). Ferme `M-05` et `M-72` (LCEN art. 1-1).
- CGU s1 p3 : même identification de l'éditeur. Aucune clause ne bouge.
- Confidentialité s1 : responsable de traitement avec statut, SIREN et adresse (RGPD art. 13.1.a). Nouvelle section 7 ter « Prospection commerciale auprès des professionnels » : données, finalité, base légale (6.1.f RGPD, L34-5 CPCE), destinataires (Supabase, IONOS, Anthropic), durée de trois ans, droit d'opposition et liste d'opposition. Registre : T11.
- Dates portées au 21 octobre 2026.
- Aucun préavis : l'art. 14 RGPD exige la section 7 ter en ligne AVANT le premier envoi ; elle s'adresse à des personnes prospectées.

### 2026-10-25 · médiateur de la consommation (SMP) · FOND (information) · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `56f0531541fd571a` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `f2b0645e65f7b36a` |

Commit `bff7f874`, poussé sans entrée.

- CGU, nouvel article 12 bis « Litige et médiation de la consommation » : réclamation écrite d'abord (`contact@thecosmo.app`), puis, sans accord ni réponse sous un mois, saisine gratuite de la Société Médiation Professionnelle (Conso. L612-1 et L612-2). Texte imposé par le médiateur (courrier archivé dans [`LEGAL.md`](./LEGAL.md)).
- Mentions légales s5 p2 : coordonnées du médiateur et renvoi à l'art. 12 bis.
- Dates portées au 25 octobre 2026. Forme, en `en` : l'article français « La » devant la raison sociale du médiateur est retiré ; les noms propres restent en français.
- Aucun préavis, décision d'Axel du 2026-10-25 : voie de recours que la loi ouvre déjà (Conso. L616-1), aucune obligation nouvelle ni droit retiré.

### 2026-10-31 · droit de rétractation conservé, plus aucune renonciation · FOND (plus favorable au client) · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `c1a5029251c4427d` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `ded70bf87e8370c5` |

Commit `7aceb36f`, poussé sans entrée.

- CGU art. 5 bis p2 et p3 (`fr` et `en`) : les deux confirmations avant paiement (exécution immédiate, perte du droit) sont retirées, avec les cases de l'onglet Abonnement et leur exigence dans `stripe-org-checkout`. Le client garde ses quatorze jours entiers ; s'il se rétracte, la période en cours lui est remboursée en entier, sans retenue au prorata.
- Les lignes passées de `withdrawal_consents` restent (preuve des souscriptions antérieures).
- Aucun préavis : la clause supprime une renonciation et une retenue, elle ne peut que profiter au client. ⚠️ Qualification à confirmer par Axel.

### 2026-11-01 · rétractation au prorata, résiliation sans remboursement, CGV de vente réécrites · FOND (moins favorable sur le remboursement) · préavis dû aux abonnés existants

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `ad6a82563e89e438` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `e4a0d4a9193c6b75` |

Consigne : `Documents/analytics/docs/REMBOURSEMENT-RESILIATION.md` (décision d'Axel du 2026-11-01). Version `2026-11-01` portée en tête du document, `fr` et `en`.

- Art. 5, conditions générales de vente : TVA non applicable (art. 293 B du CGI), demande expresse d'accès immédiat et version acceptée conservée, mensuel sans engagement, annuel reconduit avec rappel à J-45 (L215-1) et remède en cas de rappel manqué, résiliation en quelques clics depuis la page Facturation, effective en fin de période, sans remboursement. La « garantie de remboursement à tout moment » (li5bis) est retirée : plus aucun remboursement après 14 jours, sauf conformité, rappel manqué, modification du contrat.
- Art. 5 bis : délai de 14 jours depuis la conclusion (première souscription), étendu au professionnel de 5 salariés au plus (L221-3) ; prorata journalier si accès immédiat demandé (L221-25), intégral sinon ; bouton « Se rétracter du contrat ici » (L221-21) ; remboursement sous 14 jours par le même moyen de paiement ; formulaire type de l'annexe R221-1.
- Art. 5 ter (nouveau) : clients professionnels, sans rétractation ni remboursement, annuel engagé 12 mois, déclaration du statut et de l'effectif.
- Art. 9 p4 : garantie de conformité des services numériques (L224-25-12 s.), remboursement au prorata en cas de résolution.
- Art. 10 p1 : la suppression d'une organisation abonnée arrête l'abonnement sans remboursement.
- Art. 11 : préavis porté à un mois par e-mail, y compris pour une hausse de prix, et droit de résilier sans frais avant l'entrée en vigueur.
- 🔴 Préavis : les nouvelles souscriptions sont soumises à cette version dès la mise en ligne ; pour les abonnés existants, le retrait de la garantie de remboursement est une modification substantielle défavorable : e-mail de préavis d'un mois à envoyer par Axel, l'ancienne garantie restant due jusqu'à l'entrée en vigueur. Relecture par un juriste avant publication (consigne §11).

### 2026-11-06 · téléphone : privilégier l'e-mail · FORME · aucun préavis

| Document | Empreinte |
|---|---|
| `src/locales/fr/{legal,legalTerms,legalPrivacy}.json` | `d195006ce9f39d6f` |
| `src/locales/en/{legal,legalTerms,legalPrivacy}.json` | `dbb94887ffe4e1ca` |

Commit `8033f2f1` (`fr` et `en`), poussé sans entrée : précision ajoutée après le numéro de téléphone de l'éditeur dans `legal.json` (`liPhone`) et `legalTerms.json` (art. 1, `p3`) : « privilégiez l'e-mail, ou laissez un message vocal sur le répondeur ». Numéro, adresse e-mail et autres clauses inchangés. Forme : aucun droit ni obligation ne change, donc aucun préavis. ⚠️ Qualification à confirmer par Axel, non rédigée par un juriste.
