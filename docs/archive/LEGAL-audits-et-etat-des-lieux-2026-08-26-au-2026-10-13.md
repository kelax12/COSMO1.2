> ⚠️ **ARCHIVE : audits juridiques des 2026-09-24 et 2026-10-13 et état des lieux du 2026-08-26, extrait de `docs/LEGAL.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/LEGAL.md`](../LEGAL.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## 🔎 Audit du 2026-10-13 · « si je déploie maintenant »

> Repart du **produit publié** (textes, code client, Edge Functions, workflows), pas de ce tableau.
> Toujours pas un avis juridique.

**Trouvé et corrigé le jour même** :

- 🔴 **Violation de données** : les sauvegardes quotidiennes de la base partaient en clair en
  artefacts GitHub d'un dépôt public. Chiffrées avant dépôt (`8c6a971d`), anciennes copies
  supprimées, nouvelle sauvegarde chiffrée vérifiée. Registre tenu **hors dépôt** (dossier privé
  d'Axel), procédure : `RGPD-VIOLATION.md` (hors dépôt). Lignes A7, A9.
- Deux traceurs et deux compteurs posés sans consentement, bandeau inexact (A4).
- Inscription Google depuis l'écran de connexion sans mention des CGU (A11, E10).
- Politique de confidentialité inexacte sur Sentry, les transferts, les durées (A2, A15).
- Mentions légales : clause d'irresponsabilité, adresse de Vercel (A3).
- Identité de l'éditeur et garantie de conformité absentes des CGU (E14) ; clauses 9 et 12 (E11).
- FAQ et article comparatif (F10) ; notice d'adhésion entreprise incomplète (F10).
- Sentry recevait les jetons d'invitation et codes OAuth des adresses de page (A9).
- Liens vers les documents légaux absents de l'application connectée (LCEN) : ajoutés dans
  Paramètres, onglet « Mes données ».
- Pied d'e-mail d'invitation : information art. 14 pour la personne invitée.
- `public/ads.txt` (éditeur AdSense) supprimé.

**Ce qui n'appartient qu'à Axel**, par ordre d'urgence : `a-faire-manuel.md` (hors dépôt) § 11.

---

## 🔎 Audit du 2026-09-24 · confrontation aux textes, pas à ce document

> Première passe qui part du **produit publié** (textes réels de `legal.json`, formulaire
> d'inscription, bandeau, Edge Functions) et non de ce tableau, dont 44 lignes n'avaient pas été
> revérifiées depuis le 2026-08-26. **Seize manques n'y figuraient pas.** Toujours pas un avis
> juridique.

**Corrigé le jour même, dans le code et les textes** : A4 (retrait et expiration du
consentement), A11 et E10 (CGU et politique présentées à l'inscription), A12 (âge), A13 (clause
de sous-traitance), A14 (post mortem), E11 (clauses abusives), E12 (formulaire de rétractation),
F7 (signalement DSA), F8 (clause d'export), F9 (notices open source), A2 et A1 (Resend et Turnstile déclarés, textes
périmés retirés), et la ligne « anonymise » des engagements, restée fausse depuis le 2026-09-02.
Détail des clauses : [`LEGAL-JOURNAL.md`](../LEGAL-JOURNAL.md) § 2026-09-24.

**Ce qui n'appartient qu'à Axel**, par ordre d'urgence :

| # | Geste | Pourquoi maintenant |
|---|---|---|
| 1 | Mettre son **nom** comme éditeur, directeur de la publication (mentions légales) et responsable de traitement (politique, section 1) | A2, A3 : exigible sans structure, et le registre le nomme déjà dans un dépôt public |
| 2 | Envoyer le **préavis de 30 jours** des CGU aux comptes existants (clauses 3.3, 6.3, 9) | CGU art. 11 : sans lui, ces trois clauses ne sont pas opposables aux inscrits d'avant le 2026-09-24 |
| 3 | Accepter le DPA **Sentry**, vérifier le plan **Vercel**, obtenir celui de **Resend** | A5, A6 |
| 4 | Trouver et publier le **téléphone** des hébergeurs | A3 (LCEN 6-III-1) |
| 5 | Consulter un conseil en propriété industrielle sur **COSMO** | F1, F2 |
| 6 | Faire relire les CGU (6.3 surtout) et qualifier le **Data Act** | E11, A13, F8 |

**Dormant, à régler avant de réarmer la facturation** : E4 (pied de facture Stripe seulement), E13 (bouton de
rétractation), E5 (portail de résiliation), et tout le bloc B à D. Le lien vers la plateforme
européenne de règlement en ligne des litiges n'est **plus** exigé : elle a fermé le 20/07/2025.

---

## État des lieux au 2026-08-26

| Sujet | État vérifié |
|---|---|
| Structure juridique | **Aucune.** Ni micro-entreprise, ni société. |
| Encaissement réel | **Aucun.** La prod tourne sur une clé Stripe de TEST. |
| Compte Stripe live | Équipé de 8 prix le 2026-08-26, `tax_behavior: inclusive`. Aucun client. Voir [`STRIPE-LIVE.md`](../STRIPE-LIVE.md). |
| Enregistrements fiscaux Stripe Tax | **Zéro**, dans aucun pays. Stripe ne collecte donc aucune taxe. |
| Base de données | Supabase, région `eu-west-1` (Irlande). **Données dans l'Union.** |
| Hébergement front | Vercel, projet `cosmo1`. Région non vérifiée (accès refusé au compte connecté). |
| Utilisateurs réels | ~27 comptes lifetime, avec adresse email. **Le RGPD s'applique déjà.** |
| Marché visé | France uniquement à court terme. |
| Chiffre d'affaires visé | Non déterminé. Les trois scénarios sont traités plus bas. |
| Expert-comptable | Aucun, et Axel envisage de s'en passer. Voir l'encadré dédié. |
| Domiciliation | Société de domiciliation Les Tricolores, 75116 Paris (B5). Pas au domicile personnel. |

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
