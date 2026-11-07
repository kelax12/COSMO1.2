<!-- note-audit: non-note -->
> **Note d'audit** — **NON NOTÉ** au 2026-10-23 : audit ouvert ce jour, aucune garde n'existe encore sur ce domaine. Une note ne se pose qu'après la première mesure en CI, jamais avant.

# Observabilité de la production

> **Vivant.** Créé le 2026-10-23. Répond à une seule question : **quand la production se trompe,
> qui le sait, et en combien de temps ?** Le reste du dépôt sait très bien dire si le CODE est
> juste (tests, gardes, CI) ; ce document porte ce qui se passe une fois le code déployé.

## Pourquoi un audit à part

**Arbitrage du 2026-10-23.** Les signaux de production étaient éparpillés dans quatre documents
sans qu'aucun ne les porte : `uptime.yml` dans [`DEPLOYMENT.md`](./DEPLOYMENT.md), Sentry cité dans
`CLAUDE.md` sans aucune garde, la détection d'une violation dans
`RGPD-VIOLATION.md` (hors dépôt) AM-2, les journaux Supabase dans aucun. Une surface que
quatre documents effleurent et qu'aucun ne mesure est exactement la définition d'un angle mort.
Les ajouter à un audit existant aurait noyé la question sous un autre sujet.

## Ce qui a été lu le 2026-10-23, et comment

| Source | Lu par | Résultat |
|---|---|---|
| Sentry (`VITE_SENTRY_DSN`) | **rien** : aucun outil, aucune garde, aucun digest | ❌ inconnu |
| Erreurs d'exécution Vercel (`api/`) | API Vercel refusée (403) depuis l'agent ; CLI non connecté | ❌ inconnu |
| Journaux Supabase, 24 h | API Management (`query_logs`), à la main | ✅ **0 réponse 5xx** à la passerelle. ~230 `Warp server error: Thread killed by timeout manager` côté PostgREST, corrélés à l'activité, sans réponse d'erreur au client. 5 appels à `stripe-webhook` **sans signature**, tous refusés. **4 réponses 409** sur `/rest/v1/events`, non expliquées. 10 × 403 `missing sub claim` sur `/auth/v1/user` (jeton anonyme présenté à `getUser`) |
| Disponibilité | `uptime.yml` (C-104) | ✅ vert |

## 🕳️ Angles morts · ce que ce document NE mesure PAS (2026-10-23)

| # | Angle mort | Vérifié le 2026-10-23 | 🔎 État au 2026-10-23 |
|---|---|---|---|
| AM-1 | 🔴 **Les erreurs Sentry ne sont lues par personne.** Le SDK remonte, le tableau de bord existe, rien ne le relit : une régression vue par cent utilisateurs ne fait échouer aucun job et n'arrive dans aucun digest | `grep -ril sentry .github/workflows` : seul `ci.yml` (build) | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-10-23 · `npm run check:prod-errors` (job planifié `Erreurs de prod`, relié à `ci-alert.yml`) lit les issues nouvelles ou en régression sur 24 h, plafond **0**, échec fermé sans jeton. 🔴 `SENTRY_AUTH_TOKEN` n'est pas posé (`gh secret list`) : le job est ROUGE tant qu'il manque, et ne se ferme qu'au premier run vert. Témoin : `check-prod-errors.guard.test.mjs`, 9 sabotages vus rouges |
| AM-2 | **Les erreurs d'exécution des fonctions Vercel (`api/collect.ts`) ne sont lues par rien.** Le collecteur d'audience peut échouer en silence : l'audience tombe à zéro sans alerte | aucun appel à l'API Vercel dans `scripts/` | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-10-23 · même job : requêtes de production en `error`/`fatal` OU en 5xx, plafond **0** (`collect.ts` répond 204 même quand son écriture échoue : le journal est compté, pas seulement le statut). Point d'accès de la CLI officielle (`vercel logs`), jamais appelé avec `VERCEL_TOKEN` depuis le dépôt : le premier run planifié dit si le jeton y a droit |
| AM-3 | **Les journaux Supabase ne sont lus qu'à la main**, le jour où quelqu'un y pense. Un pic de 5xx, de 409 ou de refus d'authentification ne remonte nulle part | relevé manuel ci-dessus | 🟡 **OUTILLÉ** au 2026-10-23 · même job : `edge_logs` ET `function_edge_logs` (la première ne porte AUCUNE requête `/functions/v1/*`), six familles (5xx, sondes uptime, sondes `edge-smoke`, refus d'auth, webhook Stripe non signé, 4xx métier) et couples chemin/statut, contre `scripts/prod-errors.reference.json` posée sur trois fenêtres de 24 h. Les « 5 appels sans signature » du relevé ci-dessus étaient les sondes de `check:edge-smoke`. Fermé au premier run planifié vert |
| AM-4 | **Les 4 réponses 409 sur `events` ne sont pas expliquées.** Une collision de clé à l'écriture d'un événement est soit un rejeu client (double envoi), soit une restauration à identifiant forcé (R-08) | `query_logs` | 🟢 **DIAGNOSTIQUÉ ET CORRIGÉ 2026-10-23.** Les 4 réponses sont des **23503 `events_task_id_fkey`** (`postgres_logs`), pas des 23505 : `POST /rest/v1/events` d'un seul utilisateur, 16:59:57 et 17:01:30 le 2026-10-22, **sans `id` dans le corps** (`columns=` ne liste pas `id`), donc ni restauration R-08 ni upsert. Chaque geste est parti **deux fois à 1,3 s** : le `retry: 1` global des mutations rejouait un refus nommé et déterministe. Cause amont, bénigne : un `task_id` désignant une tâche supprimée entre-temps (cache de 5 min, suppression faite ailleurs). Correctif : `shouldRetryMutation` (`src/lib/query-retry.ts`, testé) ne rejoue ni un refus nommé ni un délai dépassé. Reste : le premier échec s'affiche en toast d'erreur, c'est voulu |
| AM-6 | **Les traitements planifiés de production n'avaient aucun journal** (ARC-06, audit du 2026-11-06). Six appels d'Edge Functions (avis L215-1, alertes de sièges, comptes inactifs, notifications d'entreprise horaires et quotidiennes, webhooks) partaient du cron de GitHub, qui ne garantit ni l'heure ni l'exécution : un passage manqué ne laissait aucune trace | `grep -l "schedule:" .github/workflows/*.yml`, 2026-11-07 : 22 workflows planifiés, dont 5 qui écrivent en production | 🟡 **OUTILLÉ, NON APPLIQUÉ** au 2026-11-07 · mig. `245` (journal `cron_runs`, bail `cron_leases`, `cron_invoke` par pg_net et Vault) et `246` (planifications pg_cron), prouvées sur base vierge par `e2e/rls/cron-journal.test.ts` (un job pg_cron écrit dans le journal). Surveillance : `cron-journal.yml` (`Journal des crons`, relié à `ci-alert.yml`) lit `cron_runs_verdict()` et rougit sur un job `absent` ou en `echec` dans sa fenêtre. Reste sur GitHub exprès : une sonde logée dans pg_cron se tairait avec lui. Témoin : `scripts/check-cron-runs.guard.test.mjs`. Fermé quand les deux migrations sont en prod et la sonde planifiée verte (gestes : [`DEPLOYMENT.md`](./DEPLOYMENT.md) § 2sexies) |
| AM-5 | **La DÉTECTION d'une violation de données n'est mesurée par rien** (repris de `RGPD-VIOLATION.md` (hors dépôt) AM-2, qui en garde l'énoncé). Le délai de 72 h court depuis la détection ; `BK-1` a été trouvée par un audit, six semaines après | aucune alerte sur un export massif, un pic d'échecs de connexion ou une alerte de secret scanning | 🟠 **OUVERT** · session dédiée |
| AM-6 | **Aucune mesure de performance.** On sait si une action échoue, pas laquelle est lente ni pourquoi. Le front n'avait qu'un `tracesSampleRate: 0.1` en dur, branché sans condition, sans nettoyage des noms de span ; les Edge Functions n'avaient aucun traçage (audit externe du 2026-11-06, OBS-02) | `grep -n tracesSampleRate src/main.tsx` et `grep -rl sentry supabase/functions` | 🟡 **OUTILLÉ, NON MESURÉ** au 2026-11-07 · voir § Mesure de performance. Reste à voir : une première transaction dans Sentry, front (après un « Accepter ») et Edge (après la pose de `SENTRY_DSN_EDGE`) |

## Mesure de performance (OBS-02, vague 10.4, 2026-11-07)

> **Vivant.** Répond à AM-6. Code : `src/lib/sentry-tracing.ts` (front), `supabase/functions/_shared/trace.ts`
> et `trace-core.ts` (Edge). Témoins : `src/lib/sentry-tracing.test.ts`, `src/edge-trace.guard.test.ts`.

### Front

- **Ce qui est mesuré** : navigations (noms de route paramétrés), requêtes vers Supabase (PostgREST,
  Auth), interactions lentes (INP), tâches longues et images d'animation longues.
- **Échantillonnage** : `VITE_SENTRY_TRACES_SAMPLE_RATE`, entre 0 et 1, **0,1 par défaut**. Absent, illisible
  ou hors de [0, 1] : 0,1 (jamais un plafonnement silencieux à 1). Les erreurs ne sont pas échantillonnées.
- **Poids** : l'intégration se charge avec `sentry-client`, déjà différé après le premier rendu. Le
  chunk d'entrée ne grandit que de `sentry-tracing.ts` (texte seul, pas de SDK). Mesuré le 2026-11-07, build avec DSN : `sentry-client`
  49,4 ko gzip pour 52,0 de plafond (49,3 avant), entrée 69,3 ko pour 70,5, chemin critique 305,3 ko
  pour 323,0. Aucun plafond de `check:bundle` n'a bougé.
- **Aucune PII** : `parameterizeRoute` ramène chaque route à un gabarit (`/invite/:token`,
  `/entreprise/okr/:id`) AVANT la création du span ; `scrubTransaction` (dans `beforeSendTransaction`)
  retire ensuite la chaîne de requête et le fragment de toute adresse, masque e-mails et UUID, et
  supprime l'utilisateur, les en-têtes et les cookies. Le test rejoue un évènement rempli d'un e-mail,
  d'un UUID et d'un jeton et exige qu'aucun ne survive, avec un témoin qui prouve que l'évènement brut
  les contient.
- **Propagation** : inchangée, `PostgREST` et `Auth` seulement, jamais `/functions/v1/`
  (`sentry-propagation.guard.test.ts`, M-32). Les spans des appels vers les Edge Functions existent
  côté navigateur, sans en-tête de trace.

### DÉCISION : la mesure de performance relève du consentement

**Décidé le 2026-11-07. Les ERREURS restent hors consentement (T9 du registre, inchangé). La
PERFORMANCE est conditionnée à « Accepter ».**

Motifs :

1. **La règle du dépôt** : « tout nouveau traceur est conditionné, `null` n'est pas une acceptation »
   (`CLAUDE.md`). La mesure de performance relie une suite de pages visitées, de requêtes et
   d'interactions par un identifiant de trace, et propage un en-tête `sentry-trace` aux requêtes
   Supabase. Ce n'est pas la même chose qu'une trace d'erreur, qui ne part qu'au premier incident.
2. **La finalité n'est pas strictement nécessaire au service demandé.** Mesurer pour optimiser
   améliore le produit, mais le service est rendu sans. C'est notre lecture, prudente, de la ligne
   exigeant le consentement ; elle n'a pas été confrontée à un avis juridique, et le sens de l'erreur
   possible est le bon (une mesure manquante, jamais un traceur posé sans accord).
3. **Le coût est assumé** : seules les personnes qui acceptent sont mesurées. Les chiffres de
   performance décrivent donc ce public, pas tout le trafic. Les Core Web Vitals de tout le trafic
   restent lus par Lighthouse en CI.

Comment c'est branché (`src/main.tsx`, `useCookieConsent()` n'est pas utilisé : `main.tsx` s'exécute
avant React, il lit `readConsent()` / `subscribe()` de `cookie-consent.ts`, comme `traffic.ts`) :

- sans « Accepter » : **aucune intégration de traçage**, donc ni transaction ni en-tête `sentry-trace` ;
- « Accepter » avant l'amorçage de Sentry : l'intégration est dans `init` ;
- « Accepter » APRÈS : `addIntegration` à chaud, une seule fois ;
- **retrait** : refuser après avoir accepté recharge la page (RGPD art. 7.3, `CookieBanner`), ce qui
  retire l'intégration. En défense en profondeur : `tracesSampler` rend 0 dès que le consentement
  n'est plus `accepted`, et `beforeSendTransaction` jette toute transaction restante ;
- `ConsentedAnalytics` et `traffic.ts` restent la référence pour les autres traceurs.

### Edge Functions

- **Neuf fonctions tracées** : `delete-account`, les six `stripe-*` (`stripe-create-checkout`,
  `stripe-org-checkout`, `stripe-org-portal`, `stripe-org-refund`, `stripe-org-subscription`,
  `stripe-webhook`), `renewal-notice` et `seat-alert`, par `Deno.serve(withTrace('<slug>', …))`.
  Les autres fonctions ne le sont pas encore.
- **Un span par requête**, nommé `<MÉTHODE> <slug>`, avec le code de réponse (≥ 500 marque le span en
  erreur) et la durée. Une exception qui sort du gestionnaire est capturée puis relancée telle quelle.
- **Aucune PII, par construction** : ni URL, ni en-tête, ni corps, ni IP, ni identifiant de compte,
  de client Stripe ou d'organisation en attribut. Le SDK tourne sans intégration par défaut et
  `sendDefaultPii` faux ; `beforeSend` et `beforeSendTransaction` retirent en plus requête, utilisateur
  et nom d'hôte, et nettoient e-mails, UUID, JWT, clés et identifiants d'objets Stripe de toutes les
  chaînes. Ces données ne concernent aucun appareil de visiteur : pas de consentement.
- **Un secret, et son absence n'est pas une panne** : `SENTRY_DSN_EDGE`. Absent, `withTrace` rend le
  gestionnaire tel quel et le SDK n'est même pas téléchargé. C'est de l'observabilité, pas une garde.
  `SENTRY_TRACES_SAMPLE_RATE` (facultatif, 0,1 par défaut) règle l'échantillonnage ; si Axel le pose, il
  doit aussi figurer dans `.github/secrets-registry.json`.
  🔴 Le registre porte `SENTRY_DSN_EDGE` : `check:secrets-age` est donc **rouge tant que le secret n'est
  pas posé** (`supabase secrets set SENTRY_DSN_EDGE=…`). C'est voulu, c'est le rappel.
- **Déploiement** : par `edge-deploy.yml`, sur un `CI noyau` vert. Un module `_shared/` modifié
  redéploie toutes les fonctions qui l'importent : ici les neuf.
- ⚠️ **Non vérifié avant la production** : le SDK `npm:@sentry/deno` n'a jamais tourné dans le runtime
  Edge de ce projet, aucun test local ne le charge (`trace-core.ts` est testé, pas `trace.ts`). Un échec
  de chargement est avalé (la fonction répond sans traçage) ; il se voit à l'absence de spans dans
  Sentry. Premier geste après la pose du secret : provoquer un appel à `stripe-org-portal` et chercher
  le span `POST stripe-org-portal`.

> ❌ **Ne jamais noter ce document avant la première mesure en CI.** `non-note` est la réponse
> honnête tant qu'aucune de ces lignes n'est outillée.
