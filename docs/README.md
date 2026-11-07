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

## 📊 Tableau de bord des notes · dernière notation : 2026-11-06 (964 / 1100)

Chaque note se justifie dans son document, par une entrée datée en tête de sa section « Note ».
La notation précédente (2026-10-25, 968) et ses motifs se relisent au commit `a99df915` ; le journal
des notations du 2026-08-25 au 2026-10-25 est archivé :
[`archive/README-journal-des-notes-2026-08-25-au-10-25.md`](./archive/README-journal-des-notes-2026-08-25-au-10-25.md).

| Audit | 10-25 | **11-06** | Δ | Ce qui l'a décidé |
|---|---|---|---|---|
| Sécurité (`faille.md`, hors dépôt) | 84 | **87** | **+3** | SV-1, SV-2, SV-3, SV-8 en production (+4) ; CodeQL n° 19 `high` sans décision (−1). Advisors `24 / 87 / 2 / 1`, les objets d'affiliation relus au catalogue et légitimes |
| [Tests / CI](./TESTING.md) | 96 | **94** | **−2** | `main` rouge 56 runs sur 75 depuis le 10-26 (−1) ; `Sabotages` rouge, cinq témoins non rejoués (−1) ; `Mutation` enfin joué (+1, AM-3) puis rouge à 90,78 % sous 99 (−1) |
| [Performance](./PERFORMANCE.md) | 97 | **97** | 0 | plafonds `legalTerms` (14 000) et `legal` (3 800) relevés sur arbitrage écrit d'Axel, texte légal sur un chunk paresseux ; `check:bundle` et `lighthouse` verts |
| [Accessibilité](./ACCESSIBILITY.md) | 84 | **84** | 0 | échéances des lecteurs d'écran tenues (2026-12-15, 2027-01-15) ; `e2e` vert à `ba169ba1` |
| [UI / UX](./UI-PATTERNS.md) | 87 | **86** | **−1** | `Visual` rouge huit jours (10-29 → 11-06) pendant la nav, deux vagues entreprise, le thème Noir et la facturation ; 14 références régénérées d'un geste, sans revue tracée |
| [Architecture](./ARCHITECTURE.md) | 94 | **94** | 0 | gardes de structure vertes à `074aa8c8`, module `affiliation` déclaré dans `MODULES.md` |
| [Scalabilité](./SCALABILITY.md) | 91 | **91** | 0 | 90 tables, base à 30 Mo ; `scalability-volume` vert le 11-03 ; `unused_index` 75 → 57 |
| [RGPD](./RGPD.md) | 88 | **86** | **−2** | affiliation absente du registre art. 30 (−1) ; signal du détecteur de violation du 10-26 (82 839 lignes lues par un compte en 24 h) jamais trié (−1) |
| [i18n](./I18N.md) | 90 | **89** | **−1** | `No new hardcoded strings` rouge à `HEAD` (écran de démarrage, `c3294936` et `d938bc6e`) |
| [SEO](./SEO.md) | 79 | **78** | **−1** | articles du blog à deux `<h1>` et `/guide/` à 682 mots servis (−2) ; `Signaux SEO` joué (+1, AM-4) |
| [Mobile / DA](./MOBILE.md) | 78 | **78** | 0 | `e2e` mobile vert ; toujours aucune mesure sur appareil réel |

**968 → 964.** Une note monte, celle qui attendait un déploiement. Les cinq qui baissent ont un
point commun : un instrument qui a parlé sans que personne ne le reprenne (`main`, `Visual`,
`Sabotages`, `Mutation`, le détecteur de violation). [`OBSERVABILITE.md`](./OBSERVABILITE.md) reste
**non noté**.

### Mesures de la passe (2026-11-06, `c3294936` puis `d938bc6e`)

| Source | Verdict | Ce qu'elle dit |
|---|---|---|
| `CI` de `main` | 🔴 | 56 runs rouges sur 75 depuis le 2026-10-26 ; vert à `074aa8c8`, rouge à `c3294936` et `d938bc6e` (`No new hardcoded strings`) ; dernier `e2e` complet vert à `ba169ba1` |
| `Edge deploy drift` | 🔴 | `stripe-webhook`, `stripe-org-subscription`, `stripe-org-refund`, `seat-alert`, `renewal-notice` en retard sur les commits du 2026-11-03 ; `edge-deploy.yml` ne déploie que sur une CI verte |
| `Visual` | ✅ | vert à `c3294936` (relance) et `d938bc6e`, après huit jours rouge |
| `Mutation` | 🔴 | 90,78 % sous le seuil 99 (2026-11-04) ; vert le 2026-10-28 |
| `Sabotages` | 🔴 | cinq témoins non rejoués (2026-11-02) |
| `Posture` | 🔴 | `unused_index` 57 contre 75 : une amélioration ; recalage = geste d'Axel ([`SECURITY.md`](./SECURITY.md) AM-7) |
| `Secrets age` | 🔴 | rouge depuis sa pose (2026-10-26) : 9 dates de rotation inconnues, une trentaine de secrets hors registre |
| `restore-drill` | ⚪ | dernier run le 2026-10-15, sans confirmation |
| `Migration coverage`, `Grille Stripe`, `Erreurs de prod`, `Signaux SEO`, `db-backup`, `Uptime`, `Deploy SHA drift`, `inactive-accounts`, `renewal-notice` | ✅ | |
| Alertes GitHub | 🟠 | CodeQL **3** (n° 19 `high`, n° 15 et 18 `medium`), Dependabot **1** (développement), secret scanning : la n° 1, connue |
| Production | | 90 tables toutes sous RLS, 205 policies, ledger 192 (mig. `241`), 16 Edge Functions, base 30 Mo ; 2 abonnements d'organisation et 3 lignes au journal de paiement |
| PR ouvertes | 🟠 | n° 164 (historique KR coupé à 500, COSMO-40 ; 401 sur `get_my_tasks`) depuis le 2026-10-26 et n° 167 (calendrier des échéances) depuis le 2026-10-29, jamais fusionnées ; n° 125 (détecteur de violation) depuis le 2026-10-23 |

### Ce qui reste, et qui le porte

Chaque item qui ne demande que du code part dans une session dédiée, trois à la fois au plus
(au-delà, ce poste de 8 Go sature). Les autres attendent qu'une place se libère.

| Item | Domaine | Porté par | Modèle · effort |
|---|---|---|---|
| Double `<h1>` des articles, `/guide/` à 682 mots, JSON-LD de l'accueil | SEO | session `seo-regressions` (2026-11-06) | Sonnet 5.5 · high |
| CodeQL n° 15, 18, 19 et Dependabot `minimatch` | Sécurité | session `codeql-triage` (2026-11-06) | Opus 5.5 · high |
| `Mutation` remonté au-dessus de 99 sans exclure | Tests | session `mutation-score` (2026-11-06) | Sonnet 5.5 · high |
| `Sabotages` : cinq témoins à rebrancher ; retirer `tmp-webkit-repeat.yml` | Tests | en file d'attente | Sonnet 5.5 · medium |
| Registre de `Secrets age` : déclarer les secrets présents, retirer les absents | Sécurité | en file d'attente | Sonnet 5.5 · medium |
| PR n° 164 et n° 167 : vérifier, rebaser, porter sur `main` | Tests, UI | en file d'attente | Sonnet 5.5 · high |
| `No new hardcoded strings` (écran de démarrage) | i18n | la session voisine qui l'a poussé, prévenue | |

**Gestes d'Axel** (pas du code) : recaler `Posture` (`gh workflow run posture.yml -f regenerer=true`) ;
dater les rotations des 9 secrets ; trier le signal du détecteur du 2026-10-26 et décider du sort de
la PR n° 125 ; arbitrer le périmètre de l'affiliation au registre art. 30, qu'une session pourra
ensuite rédiger depuis la mig. `236` ; jouer `restore-drill` ; les séances VoiceOver (avant le
2026-12-15) et NVDA (avant le 2027-01-15).

---

## Deux statuts, jamais à confondre

| Statut | Où | Comment le lire |
|---|---|---|
| **Vivant** | [`../CLAUDE.md`](../CLAUDE.md), `faille.md` (hors dépôt), [`../a-faire-code.md`](../a-faire-code.md), `a-faire-manuel.md` (hors dépôt), `docs/*.md` | Décrit l'état courant. Si le code le contredit, **c'est un bug de doc à corriger**. |
| **Archive** | `docs/archive/**` | Instantané daté, **non maintenu**, coiffé d'un bandeau ⚠️. À lire pour comprendre *pourquoi* une décision a été prise. **Le code fait foi contre une archive.** |

🔒 **Hors dépôt depuis le 2026-11-06** (le dépôt est PUBLIC, constat `SEC-02`) : `faille.md`,
`a-faire-manuel.md` et `RGPD-VIOLATION.md` vivent dans `C:\Users\Axel\Documents\COSMO1.1\prive\`,
dossier local du checkout principal, ignoré par git et refusé par le hook `pre-commit`. Ils restent
vivants et `faille.md` reste la source de vérité sécurité ; aucun lien du dépôt ne les vise.

## Documents vivants

Une ligne par document. Les notes sont dans le tableau de bord ci-dessus, pas ici.

| Doc | Périmètre |
|---|---|
| [`../README.md`](../README.md) | Point d'entrée **pour un humain** : ce qu'est COSMO, lancer, tester, déployer |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) · [`../SECURITY.md`](../SECURITY.md) | Conventions et processus de contribution ; politique de divulgation responsable des failles (à ne pas confondre avec [`SECURITY.md`](./SECURITY.md) de ce dossier, qui porte les règles internes) |
| [`adr/`](./adr/README.md) | Décisions d'architecture déjà prises (Supabase et RLS, poussée sur `main`, i18n, Stripe, modules entreprise, migrations…), une par fichier |
| [`../CLAUDE.md`](../CLAUDE.md) | Point d'entrée : produit, carte de la doc, conventions, garde-fous |
| `faille.md` (hors dépôt) | Sécurité : **source de vérité**, findings ouverts, ordre de priorité avant prod |
| [`../a-faire-code.md`](../a-faire-code.md) · `a-faire-manuel.md` (hors dépôt) | Ce qui reste à faire, en code et à la main (consoles, guichets, décisions) |
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
| `RGPD-VIOLATION.md` (hors dépôt) · [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md) · [`RGPD-VIOLATION-EXERCICES.md`](./RGPD-VIOLATION-EXERCICES.md) | Procédure de violation sous 72 h (art. 33-34), ses gabarits, et le journal public de ses exercices (gardé par `check:exercice-violation`) |
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
