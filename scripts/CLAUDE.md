# Gardes et scripts · règles du dossier

> Repris de `CLAUDE.md` le 2026-09-16. Règles transversales : [`CLAUDE.md`](../CLAUDE.md) à la
> racine. Classes et outils standards : [`docs/TESTING.md`](../docs/TESTING.md) § « Gardes : classes
> et outils standards ». Récits d'incident et mesures du tri V18.1 : [`docs/archive/GARDES-recits-et-tri-2026-09-03-au-2026-11-08.md`](../docs/archive/GARDES-recits-et-tri-2026-09-03-au-2026-11-08.md).

---

## 📋 Inventaire des gardes · une ligne par commande

> ⚠️ **Cette table ne porte QUE la commande, sa classe et ce qu'elle regarde.** Pièges et mesures
> datées : le doc cité en fin de ligne. ❌ Elle ne dit pas qu'une garde est juste.
>
> **Classe** (tri V18.1 du 2026-11-08, `docs/TESTING.md`) : **N** noyau (bloquante, juge le
> commit, `ci-noyau.yml`) · **P** planifiée (rapport non bloquant, cron) · **O** outil lancé à la
> main, pas une garde. **Compte** : [`docs/FAITS.md`](../docs/FAITS.md), généré.

| Commande | Classe | Ce qu'elle regarde | Item | Détail |
|---|---|---|---|---|
| `validate:migrations` | N | garde statique sur les `.sql` | | `docs/SECURITY.md` |
| `check:rls` | N | invariants RLS (la règle 3 n'a aucun équivalent dans les advisors) | | `docs/SECURITY.md` |
| `check:contrat` | N | `schema.sql`, `rpc-inventory.md` et types générés vs les migrations (base vierge) | `ARC-07` | `supabase/migration/CLAUDE.md` |
| `check:migration-coverage` | P | fichiers de migration ↔ ledger ET catalogue de PROD, quotidien | | `docs/SECURITY.md` |
| `check:edge` | P | code **déployé** des Edge Functions vs dépôt, horaire | `C-35` | `supabase/functions/CLAUDE.md` |
| `check:edge-smoke` | P | le **comportement** en ligne : une sonde par fonction, les cron **sans jeton** | `C-91` | `supabase/functions/CLAUDE.md` |
| `check:edge-coverage` | N | un témoin par Edge Function | `C-82` | `docs/TESTING.md` |
| `check:deploy` | P | le commit **servi** en prod vs le dernier commit tagué vert | `T-8` | `docs/DEPLOYMENT.md` |
| `check:supabase-posture` | P | advisors Supabase + réglages de Dashboard, lus par l'API | `C-88` | `docs/SECURITY.md` |
| `check:env` | N + P | contrat des variables d'environnement Vercel (moitié statique au noyau) | `C-105` | `docs/DEPLOYMENT.md` |
| `check:bundle` | N | budget de bundle | | `docs/PERFORMANCE.md` |
| `check:db-cost` | P | coût serveur et croissance | `C-87` | `docs/SCALABILITY.md` |
| `check:cycles` | N | cycles d'imports | `C-103` | `docs/ARCHITECTURE.md` |
| `check:test-floor` | N | un test supprimé avec le code qu'il gardait | `C-83` | `docs/TESTING.md` |
| `check:commentaires` | N | cliquet des récits datés dans `src/` | `COD-01` | `scripts/commentaires.reference.json` |
| `check:faits` | N | `docs/FAITS.md` égal à sa régénération | `V20.1` | `docs/FAITS.md` |
| `check:sabotages` | P | **rejeu** des témoins, hebdo | `C-81` | `docs/TESTING.md` |
| `test:coverage:tooling` | P | plancher de couverture de `scripts/`, hebdo dans `Sabotages` | `C-82` | `docs/TESTING.md` |
| `test:mutation` | P | **force des assertions** (Stryker), périmètre argent / données | `AM-3` | `docs/TESTING.md` |
| `i18n:check` | N | parité des clés `fr` ↔ `en` | | `docs/I18N.md` |
| `i18n:scan` | N | chaînes d'interface en dur, cliquet à **0** | `C-38` | `docs/I18N.md` |
| `i18n:identical` | N | valeurs `en` recopiées du `fr`, cliquet à **0** | `C-21` | `docs/I18N.md` |
| `i18n:namespaces` | N | catalogues rendus par le SHELL (joué par `lazy-namespaces.guard.test.ts`) | | `docs/I18N.md` |
| `i18n:pages` | N | pluriels et locales (noyau) ; volume par page (`--pages`, CI étendue) | `C-99` | `docs/I18N.md` |
| `i18n:quality` | N | glossaire épinglé et français resté dans `en`. 🔴 Ne prouve PAS le sens | `AM-1` | `docs/I18N.md` |
| `check:seo` | P | sitemap ↔ pages prérendues, 4 balises par page (CI étendue) | `C-98` | `docs/SEO.md` |
| `check:acquisition` | P | une action d'acquisition reliée à son résultat | `C-101` | `docs/ACQUISITION.md` |
| `check:legal` | N | arithmétique et datation du tableau de conformité | | `docs/LEGAL.md` |
| `check:legal-journal` | N | une modification des CGU est un **changement de contrat** | `C-107` | `docs/LEGAL-JOURNAL.md` |
| `check:retention` | P | durées de conservation confrontées à la **donnée** | `C-93` | `docs/RGPD-REGISTRE.md` |
| `check:subprocessors` | N | tiers **dérivés** du code vs registre art. 30 et `LEGAL.md` § 6 | `AM-3` | `docs/RGPD-REGISTRE.md` |
| `check:erasure` | N | couverture d'effacement, sans liste en dur | `C-92` | `docs/RGPD.md` |
| `check:portability` | N | export art. 20 comparé à l'inventaire des colonnes | `C-94` | `docs/RGPD.md` |
| `check:stripe-prices` | P | grille **Stripe** comparée au code | `C-106` | `docs/STRIPE-LIVE.md` |
| `check:prod-errors` | P | erreurs Sentry de production | | `docs/OBSERVABILITE.md` |
| `check:secrets-age` | P | âge des secrets contre `.github/secrets-registry.json` | `AM-3` | `docs/SECURITY.md` |
| `check:coffre` | P | coffre vérifié sous 92 j | `V4.2` | `docs/SECURITY.md` |
| `check:docs` | N | plafonds et pointeurs des `CLAUDE.md`, liens des docs vivantes, aucune note /100 (ADR 0012) | | ce fichier |
| `check:lecteurs-ecran` | P | échéance des séances VoiceOver / NVDA | `M-52` | `docs/AUDIT-NVDA-WINDOWS.md` |
| `check:exercice-violation` | P | exercice 72 h de moins de 12 mois, gabarits | `M-49` | `docs/RGPD-VIOLATION-EXERCICES.md` |
| `check:peremption-chantiers` | P | chaque chantier daté (relu 90 j, ou clos) | `AM-2` | `docs/POST-AUDIT-GUIDE.md` |
| `check:study` | P | une **étude** décrit encore les versions installées | `C-108` | `docs/MIGRATION-REACT19.md` |
| `check:fichiers-sensibles` | N | liste UNIQUE (hook, job CI, `fichiers-suivis`) : `prive/**`, documents, exports, dumps, `.env*` | `SEC-01` | `docs/TESTING.md` |
| `check:captures-relues` | N | trailer `Captures-relues: <run>` sur tout commit qui touche les références visuelles | `V15.4` | `docs/TESTING.md` |
| `check:tooling-coverage` | O | seconde moitié de `test:coverage:tooling`, sur un rapport déjà écrit | `C-82` | `docs/TESTING.md` |
| `analyze:entry` · `profile:landing` | O | qui pèse dans le chunk d'entrée · profil du fil principal | | `docs/PERFORMANCE.md` |
| `check:mail` | O | SPF / DKIM / DMARC | | `docs/DEPLOYMENT.md` |
| `images:check` | O | images non optimisées | | `docs/PERFORMANCE.md` |

📅 **Gardes de calendrier** (`study`, `lecteurs-ecran`, `exercice-violation`,
`peremption-chantiers`, `acquisition`, `coffre`) : `gardes-calendrier.yml`, quotidien, issue
`calendrier-red`. ❌ Jamais dans un job bloquant (CI-01) → `docs/TESTING.md` § CI.

🔒 **Hooks** : `pre-push` refuse un noyau rouge (`CI noyau` seul), sans contournement →
`docs/DEPLOYMENT.md` § 1 ; `pre-commit` lance `check:fichiers-sensibles --index`.

🔴 **`check:supabase-posture` compte une entrée PAR OCCURRENCE** (corrigé le 2026-10-02 : il lisait
0 depuis sa pose). Référence : `scripts/supabase-posture.reference.json`, chaque compte avec la
liste NOMMÉE de ses objets. Un rouge = de nouveaux objets en base : les relire au catalogue
(`pg_get_functiondef`, `has_function_privilege`, `relacl`) AVANT `--update`, et écrire leurs noms
dans la `_note`. ❌ Jamais recaler pour faire taire.
⚠️ Recalé le 2026-11-07 (mig. `247`) : `docs/SECURITY.md` § AM-5. Rouge > 7 j : `docs/TESTING.md`.

---

## 🗑️ Retraits · une ligne chacun (date, motif, ce qui couvre le risque)

> ❌ Une garde née d'un incident ne sort que si autre chose couvre le risque, prouvé par un témoin
> ROUGE sur ce remplaçant. Le code retiré se relit dans l'historique : `git show 305bb463:<chemin>`.

- **2026-11-08 · `check:drift`** (`check-prod-drift.mjs`, 307 l., et ses 2 blocs de
  `migration-guards.test.mjs`) : deux étapes à la main, lancé par aucun workflow. Son seul échec,
  « objet attendu absent de la prod » (incident 017 du 2026-06-10), est le verdict `ABSENT DES
  DEUX` de `check:migration-coverage`, quotidien. Témoin rouge : absence classée `SANS OBJET`,
  8 cas rouges dans `check-migration-coverage.guard.test.mjs` ; 8 sabotages `mcov-*` au catalogue.
  Perdu : l'avertissement sur un objet EN TROP (ajout au Dashboard), que rien ne lisait.
- **2026-11-08 · `visual-audit.mjs`, `visual-audit-report.mjs`** (1 383 l.) : passe visuelle à la
  main (2026-06-21), jamais en CI. Couvert par `visual.yml` (Playwright `toHaveScreenshot`) : 98
  rouges sur ses 300 derniers runs, issue `ci-red` n° 63.
- **2026-11-08 · `_c56-probe.mjs`, `_c56-app-probe.mjs`, `_c57-probe.mjs`,
  `landing-bimodal-probe.mjs`** (437 l.) : sondes jetables d'audits clos (C-56, C-57, C-68),
  lancées par rien. Aucune garde à remplacer.
- **2026-11-08 · job `audit` de `ci.yml`** (`npm audit`) : non bloquant, doublon des alertes et
  mises à jour de sécurité Dependabot, actives (alerte n° 65, `minimatch`, ouverte le 2026-11-05).
- **2026-11-08 · alias `check:keyboard-coverage`** : relançait `src/keyboard-audit-coverage.guard.test.ts`,
  déjà joué par `test:coverage` au noyau.

**Déplacements du même jour** : `test:coverage:tooling` sort du noyau vers `Sabotages` (les témoins
de `scripts/` tournaient deux fois, `vitest.config.ts` les inclut) ; `check:legal` entre au noyau
(lancé par aucun workflow, trouvé rouge à la main le 2026-10-31). Témoin : `noyau-ci.guard.test.mjs`.

---

## 🛡️ Ce qu'une garde doit tenir (récits : l'archive citée en tête)

- ❌ **Ne jamais conclure d'un « exit 0 » qu'une garde a mesuré** : la question est « sur quoi ? ».
  Quatre gardes répondaient sans mesurer en cinq jours (passe du 2026-09-03).
- ❌ **Ne jamais laisser une garde sauter une moitié de son travail.** Secret absent = **échec**,
  jamais un `::warning::` dans un run vert. Vaut pour `ci-alert.yml` lui-même (`scripts/ops-alert.mjs`).
- ✅ **Toute garde corrigée repart avec un TÉMOIN** qui refuse un détecteur aveugle.
- 🔴 **Une garde qui se trompe dans le sens rassurant est pire qu'une garde absente.**
- 🔴 **Toute étape de garde de `lint-test-build` joue après un rouge** (`if: ${{ !cancelled() && steps.deps.outcome == 'success' }}`, un `id`, jamais `continue-on-error`). Témoin : `ci-toutes-les-gardes.guard.test.mjs`.
- 🔴 **Une garde que rien ne lance ne garde rien** : chaque ligne `N` ou `P` ci-dessus nomme un workflow.
- ❌ **Ne jamais conclure d'une lecture de `supabase/functions/` qu'une Edge Function fait ce que le
  dépôt dit** : `check:edge` est le seul lien (C-35). Un statut de finding Edge cite sa version déployée.
- 📣 **Une alerte que personne ne lit est une archive** : les échecs sont poussés sur
  `OPS_ALERT_WEBHOOK_URL` (`ci-alert.yml`). Un HTTP 204 prouve l'envoi, pas la lecture.
- ⚠️ **Pas de shebang** sur un script importé par son témoin (`scripts/ops-alert.mjs`, `indicateurs.mjs`) :
  la chaîne Vite/vitest ne le retire pas (C-82).
