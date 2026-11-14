# Observabilité de la production

> **Quand lire** : avant de toucher Sentry (`src/lib/sentry-*.ts`, `src/main.tsx`, `_shared/trace*.ts`), `check:prod-errors`, `detection-violation.yml` ou `cron-journal.yml`.
> **Fait foi** : la sortie de ces gardes et le tableau de bord Sentry. Question unique : quand la production se trompe, qui le sait et en combien de temps.
> Relevés datés (premiers runs, diagnostics) : [`archive/OPS-SECURITE-recits-2026-11-13.md`](./archive/OPS-SECURITE-recits-2026-11-13.md).

## Signaux et ce qui les lit

| # | Signal | Lu par | Ce que le vert ne prouve pas |
|---|---|---|---|
| AM-1 | Issues Sentry nouvelles ou en régression, 24 h | `npm run check:prod-errors` (job `Erreurs de prod`, `ci-alert.yml`), plafond 0, échec fermé sans `SENTRY_AUTH_TOKEN` ; le job reste rouge tant que l'issue n'est pas résolue dans Sentry | qu'un utilisateur n'a pas vu d'erreur hors du SDK |
| AM-2 | Erreurs d'exécution Vercel (`api/collect.ts`) | même job : requêtes `error` / `fatal` ou 5xx, plafond 0 (le collecteur répond 204 même quand son écriture échoue : le journal compte, pas le statut) ; `VERCEL_TOKEN` doit avoir la portée de l'équipe | |
| AM-3 | Journaux Supabase (`edge_logs` ET `function_edge_logs`) | même job, six familles et couples chemin/statut contre `scripts/prod-errors.reference.json` | ⚠️ `edge_logs` ne porte aucune requête `/functions/v1/*` |
| AM-4 | Réponses 409 sur `events` | diagnostiqué : rejeu client d'un refus nommé ; `shouldRetryMutation` (`src/lib/query-retry.ts`) ne rejoue ni un refus nommé ni un délai dépassé | |
| AM-5 | Détection d'une violation de données (délai de 72 h) | `detection-violation.yml`, quotidien ; § Détection | un export qui passerait sous le plancher |
| AM-6 | Traitements planifiés | `cron-journal.yml` (`Journal des crons`) lit `cron_runs_verdict()`, rouge sur `absent` ou `echec` ; témoin `scripts/check-cron-runs.guard.test.mjs`. Bascule : [`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2sexies | qu'un envoi réel a eu lieu (`ok` = réponse 2xx) |
| AM-7 | Performance | § Mesure de performance | |
| | Disponibilité | `uptime.yml` ([`DEPLOYMENT.md`](./DEPLOYMENT.md) § 9) et la sonde pg_cron `cosmo-uptime` (mig. `252`, lignes `sonde-*` du même verdict) | une panne de la base elle-même : seul `absent` la dit |

- ⚠️ La sonde des crons reste sur GitHub exprès : logée dans pg_cron, elle se tairait avec lui.
- Témoin de `check:prod-errors` : `scripts/check-prod-errors.guard.test.mjs`.

## Détection (AM-5, OBS-01)

- Job `detecter` (lecture seule) : alertes de secret scanning ouvertes (`SECURITY_ALERTS_TOKEN`), contenu des artefacts de 26 h, journaux Supabase en agrégats seulement.
- ❌ Aucune requête de détection ne rend un compte ni une IP ; le tri nominatif se fait à la main (`SQL_TRI`).
- Export mesuré en lignes DISTINCTES par forme de requête, plancher 20 000 (la somme comptait chaque page relue).
- Job `alerter` (aucun secret de production) : issue `detection-violation` assignée à Axel, échéance de tri 72 h, une seule ouverte, au plus 3 publications sur 7 jours, puis le salon ops ; les issues échues sont republiées chaque lundi par `ci-alert.yml`.
- 🔴 Le tri reste humain : données personnelles et échéance légale. Témoin : `detection-violation.guard.test.mjs`.

## Mesure de performance (AM-7, OBS-02)

Code : `src/lib/sentry-tracing.ts`, `src/lib/sentry-client.ts` (front), `supabase/functions/_shared/trace.ts`, `trace-core.ts` (Edge). Témoins : `src/lib/sentry-tracing.test.ts`, `sentry-client.test.ts`, `src/edge-trace.guard.test.ts`.

### Front

- Mesuré : navigations (routes paramétrées), requêtes PostgREST et Auth, INP, tâches longues, images d'animation longues.
- Échantillonnage `VITE_SENTRY_TRACES_SAMPLE_RATE` dans [0, 1], défaut 0,1 ; absent, illisible ou hors bornes = 0,1, jamais 1. Les erreurs ne sont pas échantillonnées.
- L'intégration se charge avec `sentry-client`, différé après le premier rendu ; l'entrée ne porte que `sentry-tracing.ts`.
- 🔴 Aucune PII : `parameterizeRoute` réduit chaque route à un gabarit AVANT le span ; `scrubTransaction` (`beforeSendTransaction`) retire chaîne de requête et fragment, masque e-mails et UUID, supprime utilisateur, en-têtes, cookies. Le test exige qu'aucun ne survive, témoin à l'appui.
- 🔴 `traceLifecycle: 'static'` : le mode diffusé ignore `beforeSendTransaction`, donc `scrubTransaction`.
- 🔴 `dataCollection` posé clé par clé à faux (absent = tout collecter) ; seul `User-Agent` passe, jamais `Referer` (peut porter un jeton d'invitation).
- `attachStacktrace: false` garde les groupes d'incidents.
- ❌ `init` écrit dans `sentry-client.ts` : `BrowserClient` avec la liste explicite d'intégrations (figée par `sentry-client.test.ts`). Une hausse du chunk demande un retrait, jamais un plafond relevé (`check:bundle`).
- ⚠️ À faire avant Sentry 12 (qui retire `beforeSendTransaction`) : passer au mode diffusé avec `beforeSendSpan`.
- Propagation : `PostgREST` et `Auth` seulement, jamais `/functions/v1/` (`sentry-propagation.guard.test.ts`, M-32).

### Consentement

- Les ERREURS partent hors consentement (T9 du registre) ; la PERFORMANCE seulement après « Accepter » (« tout nouveau traceur est conditionné »). Motifs : une trace relie une suite de pages et propage `sentry-trace` ; la finalité n'est pas strictement nécessaire au service ; lecture prudente, non confrontée à un avis juridique. Conséquence : la perf décrit le seul public consentant ; les Core Web Vitals de tout le trafic viennent de Lighthouse en CI.
- `src/main.tsx` lit `readConsent()` / `subscribe()` de `cookie-consent.ts` (il s'exécute avant React) :
  - sans « Accepter » : aucune intégration de traçage, ni transaction ni en-tête ;
  - « Accepter » avant l'amorçage : intégration dans `init` ; après : `addIntegration` une seule fois ;
  - retrait du consentement : rechargement (RGPD art. 7.3) ; en plus `tracesSampler` rend 0 et `beforeSendTransaction` jette.
- `ConsentedAnalytics` et `traffic.ts` restent la référence pour tout autre traceur.

### Edge Functions

- Tracées par `Deno.serve(withTrace('<slug>', …))` : `delete-account`, les six `stripe-*`, `renewal-notice`, `seat-alert`. Les autres non.
- Un span par requête (`<MÉTHODE> <slug>`, code, durée ; ≥ 500 = erreur) ; une exception est capturée puis relancée telle quelle.
- 🔴 Aucune PII par construction : ni URL, en-tête, corps, IP, identifiant de compte, de client Stripe ou d'organisation en attribut ; SDK sans intégration par défaut, `sendDefaultPii` faux ; `beforeSend` et `beforeSendTransaction` nettoient e-mails, UUID, JWT, clés, identifiants Stripe. Pas de consentement : aucun appareil de visiteur.
- `SENTRY_DSN_EDGE` absent : `withTrace` rend le gestionnaire tel quel, SDK non téléchargé. Observabilité, pas une garde. 🔴 Le registre le porte : `check:secrets-age` reste rouge tant qu'il n'est pas posé (`supabase secrets set SENTRY_DSN_EDGE=…`).
- `SENTRY_TRACES_SAMPLE_RATE` (facultatif, 0,1) : s'il est posé, l'inscrire au registre des secrets.
- Un `_shared/` modifié redéploie toutes les fonctions qui l'importent (`edge-deploy.yml`) ; `@sentry/deno` reste en 10, le monter demande un redéploiement (`check:edge`).
- ⚠️ `npm:@sentry/deno` n'a jamais tourné dans le runtime Edge de ce projet (`trace-core.ts` testé, pas `trace.ts`) ; un échec de chargement est avalé. Premier geste après la pose du secret : appeler `stripe-org-portal` et chercher le span `POST stripe-org-portal`.
