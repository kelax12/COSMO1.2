# Edge Functions · règles du dossier

> **Quand lire** : avant de toucher `supabase/functions/**` ou `supabase/config.toml`, ou de déployer une fonction.
> **Fait foi** : le code DÉPLOYÉ, comparé au dépôt par `npm run check:edge`. Sécurité par fonction : [`docs/SECURITY.md`](../../docs/SECURITY.md) § Edge Functions ; déploiement : [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) § 2bis.
> Stripe : [`src/modules/billing/CLAUDE.md`](../../src/modules/billing/CLAUDE.md), [`docs/STRIPE-LIVE.md`](../../docs/STRIPE-LIVE.md). Nombre de fonctions : [`docs/FAITS.md`](../../docs/FAITS.md).

## Le dépôt ne prouve pas ce qui s'exécute (C-35)

- ❌ Jamais conclure d'une lecture de `supabase/functions/` qu'une fonction déployée fait ce que dit le dépôt : seul `check:edge` relie les deux.
- ❌ Jamais un statut de finding « corrigé » sur une fonction sans sa date ou version de déploiement.
- ⚠️ Déployer depuis la racine du dépôt, sur `main` : un arbre non commité se voit dans la garde.
- ❌ Jamais se fier à une copie laissée sur le disque (`.deploy-tmp/` et consorts) : elle périme en silence.
- 🔴 Un module `_shared/` modifié fait dériver TOUTES les fonctions qui l'importent. Avant de déployer : `grep -l "_shared/<module>" supabase/functions/*/index.ts`.
- ✅ Déployer sans Docker : `supabase functions deploy <slug> --use-api`, depuis la racine.

## `npm run check:edge` et `check:edge-smoke`

- `Edge deploy drift` (`edge-deploy-drift.yml`) : quotidien et à chaque push sur `supabase/functions/`, `ci-alert.yml` ; témoin `scripts/check-edge-deploy.guard.test.mjs`. Un déploiement n'événemente rien : le job tourne aussi à heure fixe.
- 🔴 Sans `SUPABASE_ACCESS_TOKEN` : ÉCHEC, jamais un `::warning::` dans un run vert.
- 🔴 `--use-api` obligatoire sur `functions download` : sans lui le verdict dépend d'un Docker installé sur le runner.
- ❌ `.github/edge-deploy.json` ne déclare que l'EXISTENCE (fonction pas encore en ligne, pourquoi, depuis quand) ; il ne fait pas taire une divergence de contenu, et une fonction qu'il dit absente mais en ligne fait échouer la garde.
- `check:edge` compare des sources, pas un comportement. `check:edge-smoke` sonde chaque fonction ; les fonctions cron sans jeton, comme la CI les appelle (voit un `verify_jwt` faux).
- ⚠️ Une sonde prouve qu'une fonction répond et comment elle refuse, jamais qu'elle fait son travail.

## Une fonction, une section, une sonde

- ❌ Jamais une fonction sans `[functions.<slug>]` dans `supabase/config.toml` (W-1 : `org-webhook-dispatch` en `verify_jwt = true` rendait 401 avant son code). Garde : `src/edge-config.guard.test.ts`, qui exige `false` pour une fonction à `x-cron-secret`.
- ❌ Jamais un appel sortant vers une URL client sans résoudre le nom et refuser toute adresse non publique (`_shared/org-integrations.ts`, W-2).
- ❌ Jamais un membre jugé actif sur `suspended_at` seul : `membershipIsActive` (`_shared/org-membership.ts`), comme `is_org_member` (SV-1).
- ❌ Jamais l'IP d'appel lue dans la 1re entrée de `x-forwarded-for` : `callerIp` (`_shared/caller-ip.ts`) lit `cf-connecting-ip` (SV-3).
- ❌ Jamais une fonction planifiée sans `withCronLease` (`_shared/cron-lease.ts`, mig. `245`) : idempotentes en rejeu, pas en concurrence. Garde : `src/edge-cron-lease.guard.test.ts`. Planification : `docs/MISES-EN-SERVICE.md` § 2sexies.
- 🔴 `analytics-admin-login` : connexion admin de l'app `analytics` par le SEUL code TOTP (choix d'Axel), `verify_jwt = false`. ❌ Jamais un plafond qui s'ouvre quand le compteur est illisible (`failClosed`), jamais sans contrôle de l'en-tête `Origin` (`analyticsOrigins`). Garde : `src/analytics-admin-login.guard.test.ts`.
- ❌ Jamais un e-mail sans plafond de débit (`_shared/rate-limit.ts`, W-4 ; plafond par exécution pour un cron).
- ⚠️ `delete-account` a deux modes (C-121) : JWT de la personne, ou `x-cron-secret` + compte désigné accepté seulement si `account_inactivity_deletion_due()` (mig. `226`) le confirme. ❌ Jamais retirer cette revérification.

## Interdits

- ❌ Jamais avaler l'erreur d'une lecture qui décide d'un routage : en cas de doute, faire retenter Stripe, jamais deviner.
- ❌ Jamais une garde conditionnelle à son propre secret (`if (SECRET && header !== SECRET)`).
- ❌ Jamais un CORS écrit sur place ni un `?? 'http://localhost…'` : `corsHeadersFor` et `requireEnv` de `_shared/env.ts` (COD-03), `APP_URL` seule, origine locale par `CORS_DEV_ORIGINS`. Garde : `src/edge-cors.guard.test.ts` (`affiliation-api` en exception nommée).
- ❌ Jamais `event.data.object` appliqué tel quel pour un abonnement : relire (SEC-08).
- ⚠️ Traçage : `Deno.serve(withTrace('<slug>', …))` (`_shared/trace.ts`, OBS-02) ; sans `SENTRY_DSN_EDGE` le gestionnaire passe tel quel. ❌ Jamais d'URL, d'en-tête, de corps ni d'identifiant en attribut de span (`src/edge-trace.guard.test.ts`). → [`docs/OBSERVABILITE.md`](../../docs/OBSERVABILITE.md).
- ⚠️ `opsAlert()` pousse sur `OPS_ALERT_WEBHOOK_URL` ; dans un workflow, un secret absent est un échec, jamais un `::warning::`.
- ⚠️ `_shared/refund-replay.ts` reste un module TS pur : `src/refund.guard.test.ts` interdit de le recopier dans l'entrypoint.
