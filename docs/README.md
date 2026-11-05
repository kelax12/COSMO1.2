<!-- note-audit: tableau-de-bord -->
<!--
  🔴 C-109 · CE MARQUEUR EST LU PAR `npm run check:docs-scored`.
  Douze documents de fond n'étaient notés par RIEN : ils ne pouvaient ni monter
  ni baisser, donc **rien ne signalait qu'ils avaient vieilli**.
  Chaque document de `docs/` déclare donc soit sa note, soit la note qui le
  couvre, soit qu'il n'est pas noté ET pourquoi.
  ❌ Ne JAMAIS inventer une note sans avoir audité le domaine : `non-note` est
     une réponse honnête, un chiffre faux ne l'est pas.
-->
> **Note d'audit** — Ce document EST le tableau de bord des notes. Il ne s'en attribue pas une.

# Documentation COSMO — carte

## 🗺️ Trois niveaux, depuis le 2026-09-16

La documentation de travail est organisee en **trois niveaux**, et le niveau decide de ce que ca
coute en contexte a chaque session :

| Niveau | Repond a | Quand c'est charge |
|---|---|---|
| `CLAUDE.md` racine | « qu'est-ce que je ne dois pas casser partout ? » et « ou est ecrit le reste ? » | **a chaque session** |
| `<dossier>/CLAUDE.md` | « qu'est-ce que je dois savoir avant de toucher CE code ? » | seulement quand un fichier de ce sous-arbre est lu ou edite |
| `docs/*.md` | « pourquoi cette regle existe, et qu'est-ce qui a ete mesure ? » | sur demande |

**Pourquoi.** `CLAUDE.md` est le seul fichier qui se paie a chaque message. Le 2026-09-16 il pesait
2 070 lignes et ~43 000 tokens, contre 17,8 ko dix semaines plus tot, avec 78 commits en trente
jours. Il avait cesse d'etre un guide pour devenir un journal : 146 dates, 114 lignes-marqueurs,
une section `## Scripts` de 281 lignes pour 20 commandes. Et sur dix sujets sondes, huit etaient
ecrits deux fois, dans `CLAUDE.md` **et** dans le doc qui declare faire foi.

Il a ete ramene a 373 lignes **sans une coupe** : des 1 672 lignes significatives de l'ancien
fichier, une seule reste introuvable dans les `.md` du depot, et c'est un artefact de coupure de
ligne. Les 16 `CLAUDE.md` de dossier et les docs de domaine portent tout le reste.

❌ **Ne jamais reecrire un recit d'incident dans `CLAUDE.md`.** Un incident s'ecrit **une fois**,
dans le doc de son domaine ; le `CLAUDE.md` concerne n'en garde que l'interdit, en une ligne.
C est l'absence de cette regle qui a produit la courbe ci-dessus, et des affirmations fausses
restees en place pendant des jours parce que le fichier etait trop gros pour etre relu.

✅ Cliquet : `npm run check:docs` (gate CI) plafonne le racine et chaque `CLAUDE.md` de dossier,
**et** verifie que chaque fichier de dossier est cite par le racine. Une regle qui descend dans un
fichier que personne ne cite est perdue sans qu'un octet ne manque : c'est le seul risque du
decoupage, et c'est ce que la garde mesure. Temoin : `scripts/check-docs-budget.guard.test.mjs`,
vu rouge sur cinq sabotages.


---

## 📊 Tableau de bord des notes · dernière notation : 2026-10-25 (968 / 1100)

Chaque note se justifie dans son document. Le journal des notations successives (2026-08-25 →
2026-10-25), avec leurs listes « ce qui reste » à leur date, est archivé :
[`archive/README-journal-des-notes-2026-08-25-au-10-25.md`](./archive/README-journal-des-notes-2026-08-25-au-10-25.md).

| Audit | 10-23 | **10-25** | Δ | Ce qui l'a décidé |
|---|---|---|---|---|
| [Sécurité](../faille.md) | 87 | **84** | **−3** | SV-1, SV-2, SV-3, SV-8 (🟠) ouverts en production tant que les fonctions ne sont pas redéployées (−4) ; checklist SQL en onze règles de `validate:migrations`, verte (+1, AM-4) |
| [Tests / CI](./TESTING.md) | 96 | **96** | 0 | dépendances de dev débloquées, axe-core 4.14 (+1, AM-6) ; `main` rouge sur le journal légal (−1). Stryker posé mais jamais joué : AM-3 non crédité |
| [Performance](./PERFORMANCE.md) | 95 | **97** | **+2** | LCP mobile des pages de contenu 4,5 à 5,6 s → 1,5 à 1,7 s, rendu bloquant à 2 000 ms (PR n° 149) : le −2 du 10-22 est remboursé |
| [Accessibilité](./ACCESSIBILITY.md) | 82 | **84** | **+2** | **61 surfaces modales sur 63** mesurées au clavier (PR n° 132, vert après n° 145) : AM-2 remboursé. **59 au 2026-10-31**, deux surfaces retirées du produit (glossaire, organigramme). VoiceOver et NVDA restent à jouer (échéance datée, PR n° 137) |
| [UI / UX](./UI-PATTERNS.md) | 86 | **87** | **+1** | manifeste des promesses de la landing et garde des chiffres (PR n° 138, AM-4) |
| [Architecture](./ARCHITECTURE.md) | 93 | **94** | **+1** | React 19 et `react-router` 8 (PR n° 129) : la dette de version est soldée, `Visual` vert sans régénérer |
| [Scalabilité](./SCALABILITY.md) | 91 | **91** | 0 | index des 40 FK appliqués (mig. `227`, 2026-10-26, ledger `20261026124018`) ; advisors de performance lus par `Posture`, recalée le 2026-10-26 |
| [RGPD](./RGPD.md) | 87 | **88** | **+1** | sous-traitants dérivés du code et confrontés au registre (PR n° 134, `RGPD-REGISTRE.md` AM-3). Détection de violation : PR n° 125 non fusionnée |
| [i18n](./I18N.md) | 89 | **90** | **+1** | revue de sens des catalogues anglais (PR n° 128, `M-50`) ; le SENS reste mesuré par une revue datée, pas par une garde |
| [SEO](./SEO.md) | 79 | **79** | 0 | `Signaux SEO` posé (PR n° 131), jamais joué : AM-4 non crédité |
| [Mobile / DA](./MOBILE.md) | 77 | **78** | **+1** | LCP mobile des pages de contenu : le −1 est remboursé |

**962 → 968.** [`OBSERVABILITE.md`](./OBSERVABILITE.md) reste **non noté**.

⚠️ **Lire la colonne Sécurité à sa date** : le −4 venait de SV-1, SV-2, SV-3, SV-8 non déployés ; ils le
sont depuis les 2026-11-01 et 11-02 (relu le 2026-11-05). Aucune note n'a été rejouée depuis.

### État mesuré le 2026-11-05 (non noté : aucune note n'a été rejouée)

| Source | Verdict | Ce qu'elle dit |
|---|---|---|
| `CI` de `main` | 🔴 | rouge au dernier commit (`fcb00fea`, 2026-11-03) : tests unitaires + couverture, couverture de l'outillage |
| `Edge deploy drift` | 🔴 | `stripe-webhook`, `stripe-org-refund`, `stripe-org-subscription`, `renewal-notice`, `seat-alert` en retard sur les commits de facturation du 2026-11-03 ; les 10 autres fonctions identiques à `main` (SV-1 à SV-9 sont donc déployés) |
| `Migration coverage` | ✅ | dépôt `000` → `240`, tout en prod sauf `206` (délibéré) |
| `Grille Stripe` | ✅ | 2026-11-05 |
| `Posture`, `Secrets age`, `Mutation` | 🔴 | derniers runs en échec (11-05, 11-02, 11-04) |
| `Erreurs de prod`, `Signaux SEO` | ✅ | |

---

## Deux statuts, jamais à confondre

| Statut | Où | Comment le lire |
|---|---|---|
| **Vivant** | [`../CLAUDE.md`](../CLAUDE.md), [`../faille.md`](../faille.md), [`../a-faire-code.md`](../a-faire-code.md), [`../a-faire-manuel.md`](../a-faire-manuel.md), `docs/*.md` | Décrit l'état courant. Si le code le contredit, **c'est un bug de doc à corriger**. |
| **Archive** | `docs/archive/**` | Instantané daté, **non maintenu**, coiffé d'un bandeau ⚠️. À lire pour comprendre *pourquoi* une décision a été prise. **Le code fait foi contre une archive.** |

## Documents vivants

Une ligne par document. Les notes sont dans le tableau de bord ci-dessus, pas ici.

| Doc | Périmètre |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | Point d'entrée : produit, carte de la doc, conventions, garde-fous |
| [`../faille.md`](../faille.md) | Sécurité : **source de vérité**, findings ouverts, ordre de priorité avant prod |
| [`../a-faire-code.md`](../a-faire-code.md) · [`../a-faire-manuel.md`](../a-faire-manuel.md) | Ce qui reste à faire, en code et à la main (consoles, guichets, décisions) |
| [`MODULES.md`](./MODULES.md) | **Carte** : module → fichiers, tables, RPC, écran |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Invariants du projet et leur état vérifié |
| [`SECURITY.md`](./SECURITY.md) | RLS, migrations SQL, repositories, Edge Functions, Stripe, CSP, secrets |
| [`TESTING.md`](./TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Runbook deploy / rollback Vercel + Supabase, drill de restauration |
| [`OBSERVABILITE.md`](./OBSERVABILITE.md) | Signaux de production : disponibilité, erreurs Sentry, alertes |
| [`MOBILE.md`](./MOBILE.md) | Pages et composants mobiles, bottom-sheets, pièges iOS Safari |
| [`UI-PATTERNS.md`](./UI-PATTERNS.md) | Listes, modales, tutoriels, onboarding, thèmes |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | `manualChunks`, lazy loading, images et polices, budget bundle |
| [`SCALABILITY.md`](./SCALABILITY.md) | Montée en charge, coût par ligne, plans d'exécution |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | WCAG / EAA, aria, contraste, gates axe-core + Lighthouse |
| [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md) · [`AUDIT-NVDA-WINDOWS.md`](./AUDIT-NVDA-WINDOWS.md) | Check-lists de lecteurs d'écran à jouer à date fixe (échéances gardées par `check:lecteurs-ecran`) |
| [`I18N.md`](./I18N.md) | Qualité des traductions, périmètre bilingue, gates i18n |
| [`SEO.md`](./SEO.md) | Prérendu, sitemap, hreflang, indexation par locale |
| [`ACQUISITION.md`](./ACQUISITION.md) · [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) | Attribution `?ref=`, funnel, runbook ; kit de soumission aux annuaires (manuel) |
| [`RGPD.md`](./RGPD.md) | Inventaire des données personnelles, droits, rétention |
| [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md) | Registre des activités de traitement (art. 30) |
| [`RGPD-VIOLATION.md`](./RGPD-VIOLATION.md) · [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md) | Procédure de violation sous 72 h (art. 33-34) et ses gabarits |
| [`LEGAL.md`](./LEGAL.md) | Obligations légales : statut, TVA, consommation, marque, sous-traitants (tableau de conformité gardé par `check:legal`) |
| [`LEGAL-JOURNAL.md`](./LEGAL-JOURNAL.md) | Journal des documents contractuels (CGU, CGV, politique), gardé par `check:legal-journal` |
| [`MARQUE-COSMO.md`](./MARQUE-COSMO.md) | Dossier marque pour un conseil en propriété industrielle (`M-66`) |
| [`STRIPE-LIVE.md`](./STRIPE-LIVE.md) | Compte Stripe live (en production depuis le 2026-10-20) : grille, `tax_behavior`, portail, bascule |
| [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) | Réactivation premium (`PREMIUM_ENFORCED`) et chantiers datés |
| [`ENTREPRISE-FEATURES.md`](./ENTREPRISE-FEATURES.md) | Liste commerciale des fonctionnalités du mode entreprise |
| [`SUPPORT.md`](./SUPPORT.md) | Procédure de support : qui répond, sous quel délai, quand ça devient un incident |
| [`MIGRATION-REACT19.md`](./MIGRATION-REACT19.md) | Étude React 19 + `react-router` 8 (migration faite), gardée par `check:study` |
| [`COSMO-CLI.md`](./COSMO-CLI.md) · [`AGENT-AJOUTER-TACHE.md`](./AGENT-AJOUTER-TACHE.md) | CLI d'accès aux données COSMO réelles, et son mémo court |
| [`../supabase/migration/README.md`](../supabase/migration/README.md) | Convention de nommage des migrations |

## Archives (`docs/archive/`)

Rangées par nature. Aucune n'est maintenue.

- **Sécurité** : [`faille-historique.md`](./archive/faille-historique.md), `faille-jusqua-2026-10-11.md`,
  [`SECURITY-journal-migrations-150-223.md`](./archive/SECURITY-journal-migrations-150-223.md)
  (journal daté des migrations `150` → `240`).
- **Notes d'audit** : [`README-journal-des-notes-2026-08-25-au-10-25.md`](./archive/README-journal-des-notes-2026-08-25-au-10-25.md).
- **Audits datés** : `AUDIT-*`, `audit-*`, `I18N-REVUE-2026-10-23.md`, `DEMO-DATA-EXPORT-2026-08-21.md`.
- **Plans** : [`ROADMAP-60J-2026-08-28-au-10-26.md`](./archive/ROADMAP-60J-2026-08-28-au-10-26.md)
  (fenêtre close), `PLAN-ACQUISITION-30J-2026-08-13.md`, `a-faire-*` (lignes retirées, à l'identique).
- **Plans et specs exécutés** : `archive/superpowers/plans/*`, `archive/superpowers/specs/*`. Depuis
  le 2026-11-05, `docs/superpowers/` est vide : facturation (lots 1 à 3), validation des tâches
  d'équipe, rôles personnalisés, guide entreprise, kanban perso et import sont livrés. Deux plans y
  sont **abandonnés** et non exécutés (pattern de liste mobile, 2026-09-21) : un plan abandonné se
  range, il ne se supprime pas.
- **Landing, mobile, produit** : `LANDING-*`, `MOBILE-DA-BRIEF.md`, `RAPPORT-MODE-ENTREPRISE-2026-08-12.md`,
  `ENTREPRISE-MANQUEMENTS-2026-08-12.md`, `text-landingpage.md`, `OUTREACH-SEO-2026-07.md`.

## Règles d'entretien

1. **Un audit ne se met pas à jour** — c'est un instantané. Ses findings encore ouverts remontent
   dans le document vivant correspondant (`faille.md`, `PERFORMANCE.md`…), puis il part en archive.
2. **Jamais de numéro de ligne** vers un autre fichier : les fichiers bougent, les ancres de
   section survivent.
3. **Un chiffre porte sa date de mesure** (nombre de tests, taille de bundle, nombre de migrations),
   sinon il devient un piège silencieux.
4. **Un doc vivant qui n'a plus rien d'ouvert** part en archive ou disparaît — il ne reste pas à la
   racine à faire croire qu'il y a du travail en cours.
