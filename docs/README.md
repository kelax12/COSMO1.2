# Documentation COSMO — carte

**Dernière revue de cohérence : 2026-08-24** — tous les documents vivants ci-dessous ont été
confrontés au code de `main` **et à la prod** à cette date. Ont été remesurés à cette occasion :
[`../faille.md`](../faille.md) (1 finding fermé, 3 ouverts), [`ARCHITECTURE.md`](./ARCHITECTURE.md),
[`SECURITY.md`](./SECURITY.md), [`SCALABILITY.md`](./SCALABILITY.md),
[`PERFORMANCE.md`](./PERFORMANCE.md) (build du jour), [`TESTING.md`](./TESTING.md) (suite rouge),
[`ACQUISITION.md`](./ACQUISITION.md) et [`RGPD.md`](./RGPD.md).

**Puis, le même jour, les correctifs** : la migration `109` referme les trois findings ouverts
(B-1, B-2, B-3 — **écrite, pas encore appliquée en prod**), la suite unitaire repasse au vert, la
convention d'alias `@/` devient une règle ESLint, et deux gardes de migration sont ajoutées **puis
testées** (`scripts/migration-guards.test.mjs`). Les autres (`MOBILE`, `SEO`,
`I18N`, `ACCESSIBILITY`, `UI-PATTERNS`, `DEPLOYMENT`, `POST-AUDIT-GUIDE`) portent encore la date de
leur dernier audit propre : **ils n'ont pas été remesurés le 2026-08-24**, ne pas lire leur date
comme une revérification.

## Deux statuts, jamais à confondre

| Statut | Où | Comment le lire |
|---|---|---|
| **Vivant** | [`../CLAUDE.md`](../CLAUDE.md), [`../faille.md`](../faille.md), `docs/*.md` | Décrit l'état courant. Si le code le contredit, **c'est un bug de doc à corriger**. |
| **Archive** | `docs/archive/**` | Instantané daté, **non maintenu**, coiffé d'un bandeau ⚠️. À lire pour comprendre *pourquoi* une décision a été prise. **Le code fait foi contre une archive.** |

## Documents vivants

| Doc | Périmètre |
|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | Point d'entrée : stack, modules, conventions, garde-fous |
| [`../faille.md`](../faille.md) | Sécurité : findings **ouverts**, priorités avant prod, règles durables |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Invariants du projet et leur état vérifié — **audit du 2026-08-14** |
| [`SECURITY.md`](./SECURITY.md) | RLS, migrations SQL, repositories, Edge Functions, Stripe, CSP, secrets |
| [`TESTING.md`](./TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Runbook deploy / rollback Vercel + Supabase, drill de restauration |
| [`MOBILE.md`](./MOBILE.md) | Pages et composants mobiles, bottom-sheets, pièges iOS Safari |
| [`UI-PATTERNS.md`](./UI-PATTERNS.md) | Listes, modals, tutoriels, onboarding, thèmes — **+ dette UI/UX mesurée le 2026-08-14** |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | `manualChunks`, lazy loading, pagination, budget bundle |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | WCAG / EAA, aria, contraste, gate axe-core |
| [`SCALABILITY.md`](./SCALABILITY.md) | Montée en charge — **audit remesuré le 2026-08-14**, avec runbook reproductible |
| [`SEO.md`](./SEO.md) | Prérendu, sitemap, hreflang, indexation par locale — **audit du 2026-08-14, données Search Console du 2026-08-19** + règles |
| [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) | 🔴 Le chantier qui débloque le SEO : kit de soumission annuaires, prêt à coller — **100 % manuel** |
| [`ACQUISITION.md`](./ACQUISITION.md) | Attribution `?ref=`, funnel mesuré en prod, runbook — **audit du 2026-08-14** |
| [`I18N.md`](./I18N.md) | Qualité réelle des traductions, périmètre bilingue — **audit du 2026-08-14** |
| [`RGPD.md`](./RGPD.md) | Inventaire des données personnelles, droits, rétention — **audit du 2026-08-14** |
| [`POST-AUDIT-GUIDE.md`](./POST-AUDIT-GUIDE.md) | Réactivation premium (`PREMIUM_ENFORCED`), finalisation Stripe |
| [`COSMO-CLI.md`](./COSMO-CLI.md) | CLI d'accès aux données COSMO réelles (`scripts/cosmo/`) |
| [`AGENT-AJOUTER-TACHE.md`](./AGENT-AJOUTER-TACHE.md) | Mémo court : ajouter une tâche dans le vrai compte |
| [`../supabase/migration/README.md`](../supabase/migration/README.md) | Convention de nommage et ledger des migrations |

## Archives (`docs/archive/`)

Rangées par nature. Aucune n'est maintenue.

**Sécurité** — [`faille-historique.md`](./archive/faille-historique.md) : preuve de toutes les
corrections 2026-04 → 2026-08, audits datés, anciens ordres de priorité.

**Audits techniques** — `AUDIT-ARCHITECTURE-2026-08-07.md` (20 correctifs, note 60→79),
`AUDIT-TECHNIQUE-2026-07-15.md`, `audit-architecture-ultime-2026-06-11.md`.

**Audits UI / UX / mobile** — `AUDIT-UI-2026-07-14.md`, `audit-ux-ui.md`,
`AUDIT-IMPECCABLE-MOBILE-2026-07-25.md`, `AUDIT-DESIGN-SKILL-MOBILE-2026-07-25.md`,
`MOBILE-DA-BRIEF.md`.

**Acquisition / SEO / produit** — `PLAN-ACQUISITION-30J-2026-08-13.md`, `AUDIT-SEO-2026-07-18.md`,
`OUTREACH-SEO-2026-07.md`, `RAPPORT-MODE-ENTREPRISE-2026-08-12.md`,
`ENTREPRISE-MANQUEMENTS-2026-08-12.md`, `text-landingpage.md`.

**Plans et specs exécutés** — `superpowers/plans/*`, `superpowers/specs/*`.

## Règles d'entretien

1. **Un audit ne se met pas à jour** — c'est un instantané. Ses findings encore ouverts remontent
   dans le document vivant correspondant (`faille.md`, `PERFORMANCE.md`…), puis il part en archive.
2. **Jamais de numéro de ligne** vers un autre fichier : les fichiers bougent, les ancres de
   section survivent.
3. **Un chiffre porte sa date de mesure** (nombre de tests, taille de bundle, nombre de migrations),
   sinon il devient un piège silencieux.
4. **Un doc vivant qui n'a plus rien d'ouvert** part en archive ou disparaît — il ne reste pas à la
   racine à faire croire qu'il y a du travail en cours.
