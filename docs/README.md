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

## 📊 État de santé : indicateurs mesurés, plus de notes

Les notes sur 100 ont cessé le 2026-11-08 (ADR 0012, [`adr/0012-indicateurs-mesures-a-la-place-des-notes.md`](./adr/0012-indicateurs-mesures-a-la-place-des-notes.md)) :
une note qu'on s'attribue ne mesure rien. L'état de santé se lit dans [`INDICATEURS.md`](./INDICATEURS.md),
**six indicateurs mesurés, datés et sourcés**, régénérés chaque lundi (taux de vert de `main`, délai de
restauration éprouvé, couverture des parcours critiques, âge des secrets, dérive de la production,
incidents ouverts). Les chiffres du dépôt (tests, migrations, gardes, tables) sont dans
[`FAITS.md`](./FAITS.md), générés. Les gestes qui restent à Axel sont listés dans
[`CONTINUITE.md`](./CONTINUITE.md) § « Inventaire des gestes de production ».

Le dernier tableau de bord des notes (2026-11-06, 964 / 1100), ses mesures de passe et la liste de ce
qui restait ce jour-là sont archivés : [`archive/README-tableau-de-bord-des-notes-2026-08-25-au-2027-01-15.md`](./archive/README-tableau-de-bord-des-notes-2026-08-25-au-2027-01-15.md).

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

Une ligne par document. L'état de santé est dans [`INDICATEURS.md`](./INDICATEURS.md), pas ici.

| Doc | Périmètre |
|---|---|
| [`../README.md`](../README.md) | Point d'entrée **pour un humain** : ce qu'est COSMO, lancer, tester, déployer |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) · [`../SECURITY.md`](../SECURITY.md) | Conventions et processus de contribution ; politique de divulgation responsable des failles (à ne pas confondre avec [`SECURITY.md`](./SECURITY.md) de ce dossier, qui porte les règles internes) |
| [`adr/`](./adr/README.md) | Décisions d'architecture déjà prises (Supabase et RLS, poussée sur `main`, i18n, Stripe, modules entreprise, migrations…), une par fichier |
| [`INDICATEURS.md`](./INDICATEURS.md) · [`propositions/GABARIT.md`](./propositions/GABARIT.md) | Six indicateurs mesurés, datés et sourcés, générés chaque lundi à la place des notes (ADR 0012) ; gabarit de proposition d'une fonctionnalité de plus d'une semaine (ADR 0013) |
| [`../CLAUDE.md`](../CLAUDE.md) | Point d'entrée : produit, carte de la doc, conventions, garde-fous |
| `faille.md` (hors dépôt) | Sécurité : **source de vérité**, findings ouverts, ordre de priorité avant prod |
| [`../a-faire-code.md`](../a-faire-code.md) · `a-faire-manuel.md` (hors dépôt) | Le backlog de code vit dans les issues GitHub étiquetées `backlog` (ADR 0020) : ce fichier est un renvoi. Le reste à la main (consoles, guichets, décisions) est hors dépôt |
| [`CONTINUITE.md`](./CONTINUITE.md) | Continuité : arrivée et départ d'un second administrateur, **inventaire des gestes de production** (automatisé, converti, manuel et pourquoi). Le coffre et le registre des secrets sont dans [`SECURITY.md`](./SECURITY.md) |
| [`MODULES.md`](./MODULES.md) | **Carte** : module → fichiers, tables, RPC, écran |
| [`FAITS.md`](./FAITS.md) | **Chiffres du dépôt** (Edge Functions, migrations, workflows, modules, tables), générés par `npm run faits:generer` et vérifiés dans le noyau : les autres docs y renvoient |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Invariants du projet et leur état vérifié |
| [`SECURITY.md`](./SECURITY.md) | RLS, migrations SQL, repositories, Edge Functions, Stripe, CSP, secrets |
| [`TESTING.md`](./TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Runbook deploy / rollback Vercel + Supabase, drill de restauration |
| [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) | Mises en service : emails Auth (Resend), Turnstile, second facteur `/admin`, crons pg_cron (ex-§ 2ter à 2sexies de DEPLOYMENT) |
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

- **Sécurité** : `faille-historique.md` et `faille-jusqua-2026-10-11.md` (retirés du dépôt public, SEC-02),
  [`SECURITY-journal-migrations-150-223.md`](./archive/SECURITY-journal-migrations-150-223.md)
  (journal daté des migrations `150` → `240`). Les récits d'incident, de mesure et de bascule retirés de
  `SECURITY.md` le 2026-11-08 (angles morts, base de données, gardes SQL, garde-fous transversaux, AM-5) :
  [`SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md`](./archive/SECURITY-recits-base-gardes-angles-morts-2026-08-26-au-2026-11-08.md).
- **Exploitation et migration** : [`DEPLOYMENT-journal-2026-11-13.md`](./archive/DEPLOYMENT-journal-2026-11-13.md) (extraits du runbook et des mises en service, 2026-11-13), [`DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md`](./archive/DEPLOYMENT-recits-et-releves-2026-06-07-au-2026-11-08.md)
  (récits et relevés du runbook, dont les drills de restauration anciens),
  [`MIGRATION-REACT19-etude-2026-09-03-au-2026-09-13.md`](./archive/MIGRATION-REACT19-etude-2026-09-03-au-2026-09-13.md)
  (l'étude sous React 18, caduque depuis la migration du 2026-10-23),
  [`ANGLES-MORTS-2026-09-16-docs-vivantes.md`](./archive/ANGLES-MORTS-2026-09-16-docs-vivantes.md)
  (tableaux « Angles morts » d'origine de neuf docs).
- **Notes d'audit et journaux de notes** (retirés des docs le 2026-11-08, ADR 0012) : [`README-journal-des-notes-2026-08-25-au-10-25.md`](./archive/README-journal-des-notes-2026-08-25-au-10-25.md), puis un `<DOC>-journal-des-notes-<dates>.md` par domaine (angles morts, mesures, récits d'incident, notes) : `ACCESSIBILITY-journal-des-notes-2026-08-24-au-2027-01-15.md`, `ARCHITECTURE-journal-des-notes-2026-07-01-au-2026-11-06.md`, `I18N-journal-des-notes-2026-08-14-au-2026-11-06.md`, `MOBILE-journal-des-notes-2026-08-14-au-2026-12-15.md`, `PERFORMANCE-journal-des-notes-2026-08-24-au-2026-11-06.md`, `README-journal-des-notes-2026-08-25-au-10-25.md`, `README-tableau-de-bord-des-notes-2026-08-25-au-2027-01-15.md`, `RGPD-journal-des-notes-2026-04-06-au-2026-11-06.md`, `SCALABILITY-journal-des-notes-2026-08-07-au-2026-11-06.md`, `SEO-journal-des-notes-2026-01-10-au-2026-11-06.md`, `TESTING-journal-des-notes-2026-06-21-au-2026-11-07.md`, `UI-PATTERNS-journal-des-notes-2026-07-23-au-2026-11-06.md`.
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
5. **Un doc vivant décrit l'état courant, sans récit.** Un incident daté, une mesure ancienne ou une
   chronologie part dans `archive/<DOC>-journal-<dates>.md` ; la règle qu'il fonde garde une ligne de
   « pourquoi » qui y renvoie. Une décision structurante devient un ADR (`adr/`).
6. **Un chiffre qui se compte se génère** : il renvoie vers [`FAITS.md`](./FAITS.md) au lieu d'être recopié.
7. **Aucune note sur 100** (ADR 0012) : `npm run check:docs` la refuse. L'état de santé est dans
   [`INDICATEURS.md`](./INDICATEURS.md).
