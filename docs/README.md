# Documentation COSMO — carte

**Dernière revue de cohérence : 2026-08-25**, tous les documents notés ci-dessous ont été
confrontés au code de `main`, au build du jour et à la prod à cette date.

## Tableau de bord des audits · avant / après (2026-08-24 → 2026-08-25)

Chaque note est justifiée, critère par critère, en tête du document correspondant. Elles ne se
comparent **pas entre elles** : un 64 en performance et un 86 en sécurité ne disent pas que la
performance va moins bien que la sécurité, ils disent où chaque domaine se situe par rapport à
**sa propre cible**.

| Audit | 08-24 | 08-25 | Δ | Ce qui a bougé |
|---|---|---|---|---|
| [Scalabilité](./SCALABILITY.md) | 71 | **84** | **+13** | 4 findings structurels sur 5 refermés (mig. 117, 118, 119, 120, 121) |
| [Mobile / DA](./MOBILE.md) | 62 | **72** | **+10** | `MobileHeader` migré sur 6 pages, et découvert cassé depuis sa création |
| [UI / UX](./UI-PATTERNS.md) | 70 | **80** | **+10** | Les 6 findings de l'audit du 14 août sont refermés |
| [RGPD](./RGPD.md) | 78 | **84** | **+6** | FK d'effacement alignée en prod (mig. 116) ; portabilité préservée malgré la troncature |
| [Sécurité](../faille.md) | 82 | **86** | **+4** | Une nouvelle surface d'autorisation livrée avec son test de base réelle (mig. 115) |
| [Architecture](./ARCHITECTURE.md) | 74 | **79** | **+5** | Budget > 600 LOC : 12 503 → 11 452 lignes |
| [Tests / CI](./TESTING.md) | 80 | **88** | **+8** | +188 tests, +21 E2E, 5ᵉ job CI ; couverture repassée au rouge puis **refermée sans baisser un seuil** |
| [Mode entreprise](./archive/RAPPORT-MODE-ENTREPRISE-2026-08-12.md) | 74 | **80** | **+6** | Permissions par membre (mig. 115) et périodicité annuelle (mig. 123) ; le finding n°1 est toujours là le soir |
| [Accessibilité](./ACCESSIBILITY.md) | 76 | **79** | **+3** | 2ᵉ gate a11y, sur les pages **publiques** cette fois |
| [SEO](./SEO.md) | 73 | **73** | **0** | Aucun travail SEO : le seul levier restant est hors dépôt |
| [Performance](./PERFORMANCE.md) | 68 | **88** | **+20** | Page d'accueil **1 610 → 749 kB** : JS −160 kB, images 1 046 → 2,7 kB, polices −85 kB |

### Ce que ce tableau dit, au-delà des chiffres

**Un audit dont toutes les notes montent est un audit qui se félicite.** Deux lignes valent plus
que les neuf autres :

- **Performance, de −4 à +14 dans la même journée.** À 16 h la note tombait à 64 : sept
  migrations et un système de permissions livrés sans que personne ne regarde le bundle, sur le
  seul budget du dépôt qu'aucune garde ne mesurait. Le soir, le chemin critique passe de
  **580 à 420 kB gzip** (−27,6 %) et le budget devient une gate CI. Les deux leviers :
  les catalogues i18n voyagent avec leur page, et **recharts était préchargé pour tous les
  visiteurs** à cause d'une ligne de `manualChunks`, 117 kB gzip que ce dossier décrivait comme
  « lazy » depuis des semaines. Ce n'est pas une coïncidence si le seul budget non outillé est
  celui qui cachait une erreur : *une règle qu'aucun script ne mesure recule à chaque vague de
  features.*
- **Tests, de +3 à +8 en fin de journée.** À 16 h la note ne montait que de 3 malgré 73 tests
  ajoutés : la couverture était repassée sous ses seuils, le dénominateur ayant grossi plus vite
  que le numérateur (~2 000 lignes d'interface non testées). La gate a été refermée le soir par
  **115 tests de repository**, sans qu'aucun seuil ne soit baissé, et les seuils du glob
  `supabase.repository.ts` ont été **remontés** (65 → 74 % de statements) pour verrouiller le
  gain. C'est le cliquet dans les deux sens : il attrape la dette, puis il enregistre le
  remboursement.

Et deux constats de méthode, tous deux issus de vérifications faites **contre le code**, pas
contre la doc :

- **Trois `refetchInterval` permanents subsistaient** alors que `CLAUDE.md` et `SCALABILITY.md`
  annonçaient le matin même qu'il n'en restait aucun. Trouvés par recomptage nominatif, corrigés
  dans la journée. La cause de l'erreur est instructive : `isDemo ? false : 20_000` avait été lu
  comme « gardé par le mode démo », alors que c'est l'inverse, le sondage est retiré du seul
  environnement qui ne paie rien. **Un total ne prouve rien ; seul un décompte qui nomme le
  composant qui monte chaque hook prouve quelque chose.**
- **`MobileHeader` n'avait jamais fonctionné** en un mois d'existence, sur la seule page qui
  l'utilisait. Un code sans consommateur n'est pas seulement inutile, il est **non éprouvé**.
- **La facturation entreprise a basculé deux fois dans la journée** : `true` le matin, `false` à
  midi, `true` le soir (commits `d7d0ed7` puis `0425044`), les deux drapeaux à chaque fois
  ensemble, ce qui est la bonne pratique. Mais un état qui change trois fois en douze heures ne
  peut pas être documenté par une phrase d'affirmation : le rapport entreprise l'a affirmé trois
  fois, et s'est trompé deux fois. **L'état de la facturation se lit dans
  `src/modules/billing/premium-config.ts` et dans `billing_flags`, jamais dans un document.**

> 🔴 **Un seul point bloque encore, en fin de journée du 2026-08-25, et ce n'est pas une faille :**
> la clé Stripe de production reste une **clé de test** alors que le quota de sièges, lui, est
> réellement appliqué depuis ce soir. Un client bloqué à 5 membres ne peut pas payer pour se
> débloquer. Détail :
> [`archive/RAPPORT-MODE-ENTREPRISE-2026-08-12.md`](./archive/RAPPORT-MODE-ENTREPRISE-2026-08-12.md) §4.15.
>
> ✅ **Le second point est levé** : `npm run test:coverage` bloquait la CI en milieu de journée,
> il est vert depuis la campagne de tests du soir. Détail dans [`TESTING.md`](./TESTING.md).

---

**Correctifs de la veille (2026-08-24)** : la migration `109` referme les trois findings B-1, B-2,
B-3, **appliquée et vérifiée en prod le jour même**. La suite unitaire repasse au vert, la
convention d'alias `@/` devient une règle ESLint, et deux gardes de migration sont ajoutées **puis
testées** (`scripts/migration-guards.test.mjs`).

`I18N`, `DEPLOYMENT` et `POST-AUDIT-GUIDE` portent encore la date de leur dernier audit propre :
**ils n'ont pas été remesurés**, ne pas lire leur date comme une revérification.

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
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Invariants du projet et leur état vérifié · **remesuré le 2026-08-25, note 79** |
| [`SECURITY.md`](./SECURITY.md) | RLS, migrations SQL, repositories, Edge Functions, Stripe, CSP, secrets |
| [`TESTING.md`](./TESTING.md) | Vitest, Playwright, a11y, i18n, CI, **checklist avant push prod** · **note 88**, couverture verte au 2026-08-25 |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Runbook deploy / rollback Vercel + Supabase, drill de restauration |
| [`MOBILE.md`](./MOBILE.md) | Pages et composants mobiles, bottom-sheets, pièges iOS Safari · **note 72** |
| [`UI-PATTERNS.md`](./UI-PATTERNS.md) | Listes, modals, tutoriels, onboarding, thèmes · **dette UI/UX remesurée le 2026-08-25, note 80** |
| [`PERFORMANCE.md`](./PERFORMANCE.md) | `manualChunks`, lazy loading, images et polices, budget bundle · **note 88**, gardé par `npm run check:bundle` |
| [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) | WCAG / EAA, aria, contraste, gates axe-core + Lighthouse · **note 79** |
| [`SCALABILITY.md`](./SCALABILITY.md) | Montée en charge · **remesuré le 2026-08-25, note 84**, avec runbook reproductible |
| [`SEO.md`](./SEO.md) | Prérendu, sitemap, hreflang, indexation par locale — **audit du 2026-08-14, données Search Console du 2026-08-19** + règles |
| [`ACQUISITION-BACKLINKS.md`](./ACQUISITION-BACKLINKS.md) | 🔴 Le chantier qui débloque le SEO : kit de soumission annuaires, prêt à coller — **100 % manuel** |
| [`ACQUISITION.md`](./ACQUISITION.md) | Attribution `?ref=`, funnel mesuré en prod, runbook — **audit du 2026-08-14** |
| [`I18N.md`](./I18N.md) | Qualité réelle des traductions, périmètre bilingue — **audit du 2026-08-14** |
| [`RGPD.md`](./RGPD.md) | Inventaire des données personnelles, droits, rétention · **remesuré le 2026-08-25, note 84** |
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
