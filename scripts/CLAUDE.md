# `scripts/` · gardes et outils

Lire en touchant `scripts/**`, `.github/workflows/**`, une garde `check:*`. Classes et outils standards : [`docs/TESTING.md`](../docs/TESTING.md) § « Gardes : classes et outils standards ». Gardes retirées et récits du tri : [`docs/archive/GARDES-retraits-2026-11-08.md`](../docs/archive/GARDES-retraits-2026-11-08.md) et [`docs/archive/GARDES-recits-et-tri-2026-09-03-au-2026-11-08.md`](../docs/archive/GARDES-recits-et-tri-2026-09-03-au-2026-11-08.md).
Règles transversales : [`CLAUDE.md`](../CLAUDE.md).

## Inventaire : une ligne par commande

La table ne porte que la commande, sa classe et ce qu'elle regarde ; ❌ elle ne dit pas qu'une garde est juste. Classe : **N** noyau (bloquante, `ci-noyau.yml`) · **P** planifiée (rapport non bloquant, cron) · **O** outil manuel. Compte : [`docs/FAITS.md`](../docs/FAITS.md).

| Commande | Classe | Ce qu'elle regarde | Item | Détail |
|---|---|---|---|---|
| `validate:migrations` | N | garde statique sur les `.sql` | | `docs/SECURITY.md` |
| `check:rls` | N | invariants RLS (règle 3 sans équivalent dans les advisors) | | `docs/SECURITY.md` |
| `check:contrat` | N | `schema.sql`, `rpc-inventory.md`, types générés vs migrations (base vierge) | `ARC-07` | `supabase/migration/CLAUDE.md` |
| `check:migration-coverage` | P | migrations ↔ ledger ET catalogue de PROD, quotidien | | `docs/SECURITY.md` |
| `check:edge` | P | code **déployé** des Edge Functions vs dépôt, horaire | `C-35` | `supabase/functions/CLAUDE.md` |
| `check:edge-smoke` | P | comportement en ligne : une sonde par fonction, cron **sans jeton** | `C-91` | `supabase/functions/CLAUDE.md` |
| `check:edge-coverage` | N | un témoin par Edge Function | `C-82` | `docs/TESTING.md` |
| `check:deploy` | P | commit **servi** en prod vs dernier commit tagué vert | `T-8` | `docs/DEPLOYMENT.md` |
| `check:supabase-posture` | P | advisors Supabase + réglages Dashboard, par l'API | `C-88` | `docs/SECURITY.md` |
| `check:env` | N + P | contrat des variables Vercel (moitié statique au noyau) | `C-105` | `docs/DEPLOYMENT.md` |
| `check:bundle` | N | budget de bundle | | `docs/PERFORMANCE.md` |
| `check:prerender` | N | HTML prérendu vs instantanés versionnés | `COD-04` | `docs/TESTING.md` |
| `check:db-cost` | P | coût serveur et croissance | `C-87` | `docs/SCALABILITY.md` |
| `check:cycles` | N | cycles d'imports | `C-103` | `docs/ARCHITECTURE.md` |
| `check:test-floor` | N | test supprimé avec le code qu'il gardait | `C-83` | `docs/TESTING.md` |
| `check:commentaires` | N | cliquet des récits datés dans `src/` | `COD-01` | `scripts/commentaires.reference.json` |
| `check:faits` | N | `docs/FAITS.md` égal à sa régénération | `V20.1` | `docs/FAITS.md` |
| `check:sabotages` | P | **rejeu** des témoins, hebdo | `C-81` | `docs/TESTING.md` |
| `test:coverage:tooling` | P | plancher de couverture de `scripts/`, hebdo (`Sabotages`) | `C-82` | `docs/TESTING.md` |
| `test:mutation` | P | force des assertions (Stryker), argent / données | `AM-3` | `docs/TESTING.md` |
| `i18n:check` | N | parité des clés `fr` ↔ `en` | | `docs/I18N.md` |
| `i18n:scan` | N | chaînes d'interface en dur, cliquet **0** | `C-38` | `docs/I18N.md` |
| `i18n:identical` | N | valeurs `en` copiées du `fr`, cliquet **0** | `C-21` | `docs/I18N.md` |
| `i18n:namespaces` | N | catalogues rendus par le SHELL (`lazy-namespaces.guard.test.ts`) | | `docs/I18N.md` |
| `i18n:pages` | N | pluriels et locales (noyau) ; volume par page (`--pages`, CI étendue) | `C-99` | `docs/I18N.md` |
| `i18n:quality` | N | glossaire épinglé, français resté dans `en`. 🔴 Ne prouve PAS le sens | `AM-1` | `docs/I18N.md` |
| `check:seo` | P | sitemap ↔ pages prérendues, 4 balises par page | `C-98` | `docs/SEO.md` |
| `check:acquisition` | P | une action d'acquisition reliée à son résultat | `C-101` | `docs/ACQUISITION.md` |
| `check:legal` | N | arithmétique et datation du tableau de conformité | | `docs/LEGAL.md` |
| `check:legal-journal` | N | une modification des CGU est un **changement de contrat** | `C-107` | `docs/LEGAL-JOURNAL.md` |
| `check:retention` | P | durées de conservation vs la **donnée** | `C-93` | `docs/RGPD-REGISTRE.md` |
| `check:subprocessors` | N | tiers **dérivés** du code vs registre art. 30 et `LEGAL.md` § 6 | `AM-3` | `docs/RGPD-REGISTRE.md` |
| `check:erasure` | N | couverture d'effacement, sans liste en dur | `C-92` | `docs/RGPD.md` |
| `check:portability` | N | export art. 20 vs inventaire des colonnes | `C-94` | `docs/RGPD.md` |
| `check:stripe-prices` | P | grille **Stripe** vs code | `C-106` | `docs/STRIPE-LIVE.md` |
| `check:prod-errors` | P | erreurs Sentry de production | | `docs/OBSERVABILITE.md` |
| `check:secrets-age` | P | âge des secrets vs `.github/secrets-registry.json` | `AM-3` | `docs/SECURITY.md` |
| `check:coffre` | P | coffre vérifié sous 92 j | `V4.2` | `docs/SECURITY.md` |
| `check:docs` | N | plafonds et pointeurs des `CLAUDE.md`, liens des docs vivantes, aucune note /100 (ADR 0012) | | ce fichier |
| `check:lecteurs-ecran` | P | échéance des séances VoiceOver / NVDA | `M-52` | `docs/AUDIT-NVDA-WINDOWS.md` |
| `check:exercice-violation` | P | exercice 72 h de moins de 12 mois, gabarits | `M-49` | `docs/RGPD-VIOLATION-EXERCICES.md` |
| `check:peremption-chantiers` | P | chaque chantier daté (relu 90 j, ou clos) | `AM-2` | `docs/POST-AUDIT-GUIDE.md` |
| `check:study` | P | une **étude** décrit encore les versions installées | `C-108` | `docs/MIGRATION-REACT19.md` |
| `check:fichiers-sensibles` | N | liste UNIQUE (hook, job CI, `fichiers-suivis`) : `prive/**`, documents, exports, dumps, `.env*` | `SEC-01` | `docs/TESTING.md` |
| `check:captures-relues` | N | trailer `Captures-relues: <run>` sur tout commit touchant les références visuelles | `V15.4` | `e2e/CLAUDE.md` |
| `check:tooling-coverage` | O | seconde moitié de `test:coverage:tooling`, sur un rapport déjà écrit | `C-82` | `docs/TESTING.md` |
| `analyze:entry` · `profile:landing` | O | qui pèse dans le chunk d'entrée · profil du fil principal | | `docs/PERFORMANCE.md` |
| `check:mail` | O | SPF / DKIM / DMARC | | `docs/DEPLOYMENT.md` |
| `images:check` | O | images non optimisées | | `docs/PERFORMANCE.md` |

- ✅ Gardes de calendrier (`study`, `lecteurs-ecran`, `exercice-violation`, `peremption-chantiers`, `acquisition`, `coffre`) : `gardes-calendrier.yml`, quotidien, issue `calendrier-red`. ❌ Jamais dans un job bloquant (CI-01) → `docs/TESTING.md` § CI.
- ✅ Budget d'outillage (MAI-02) : fichiers et lignes de `scripts/`, workflows planifiés, tests `*.guard.test.*`, plafonds dans `scripts/outillage.reference.json`, joués par `check:faits`. Un nouvel outil en remplace un : retirer ou fusionner avant d'ajouter ; une baisse se recopie (`npm run faits:generer -- --recaler`), ❌ jamais de relèvement.
- ✅ Hooks : `pre-push` refuse un noyau rouge (`CI noyau` seul), sans contournement → `docs/DEPLOYMENT.md` § 1 ; `pre-commit` lance `check:fichiers-sensibles --index`.
- 🔴 `check:supabase-posture` compte une entrée PAR OCCURRENCE. Référence : `scripts/supabase-posture.reference.json`, chaque compte avec la liste NOMMÉE de ses objets. Un rouge = de nouveaux objets en base : les relire au catalogue (`pg_get_functiondef`, `has_function_privilege`, `relacl`) AVANT `--update`, et écrire leurs noms dans la `_note`. ❌ Recaler pour faire taire. Rouge > 7 j : `docs/TESTING.md` ; recalage : `docs/SECURITY.md` § AM-5.

## Retrait d'une garde

- ❌ Retirer une garde née d'un incident sans qu'autre chose couvre le risque, prouvé par un témoin ROUGE sur le remplaçant. Le code retiré se relit : `git show 305bb463:<chemin>`. Liste des retraits : archive citée en tête.
- ✅ `test:coverage:tooling` tourne dans `Sabotages`, pas au noyau (les témoins de `scripts/` tournaient deux fois, `vitest.config.ts` les inclut) ; `check:legal` est au noyau. Témoin : `noyau-ci.guard.test.mjs`.

## Ce qu'une garde doit tenir

- ❌ Conclure d'un « exit 0 » qu'une garde a mesuré : la question est « sur quoi ? ».
- ❌ Laisser une garde sauter une moitié de son travail : secret absent = **échec**, jamais un `::warning::` dans un run vert (vaut pour `ci-alert.yml`, `scripts/ops-alert.mjs`). ❌ Une garde conditionnelle à la présence de son propre secret.
- ✅ Toute garde corrigée repart avec un TÉMOIN qui refuse un détecteur aveugle.
- 🔴 Une garde qui se trompe dans le sens rassurant est pire qu'une garde absente.
- 🔴 Toute étape de garde de `lint-test-build` joue après un rouge : `if: ${{ !cancelled() && steps.deps.outcome == 'success' }}`, un `id`, jamais `continue-on-error`. Témoin : `ci-toutes-les-gardes.guard.test.mjs`.
- 🔴 Une garde que rien ne lance ne garde rien : chaque ligne `N` ou `P` nomme un workflow.
- ❌ Conclure d'une lecture de `supabase/functions/` qu'une Edge Function fait ce que le dépôt dit : `check:edge` est le seul lien (C-35) ; un statut de finding Edge cite sa version déployée.
- ✅ Les échecs sont poussés sur `OPS_ALERT_WEBHOOK_URL` (`ci-alert.yml`) : un HTTP 204 prouve l'envoi, pas la lecture.
- ⚠️ Pas de shebang sur un script importé par son témoin (`scripts/ops-alert.mjs`, `indicateurs.mjs`) : la chaîne Vite/vitest ne le retire pas (C-82).
