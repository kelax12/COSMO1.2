# Edge Functions · règles du dossier

> Le code DÉPLOYÉ et le dépôt sont deux choses différentes. Détail, mesures et historique du
> drift : [`docs/SECURITY.md`](../../docs/SECURITY.md). Stripe :
> [`src/modules/billing/CLAUDE.md`](../../src/modules/billing/CLAUDE.md) et
> [`docs/STRIPE-LIVE.md`](../../docs/STRIPE-LIVE.md). Findings : `faille.md` (hors dépôt).

## 🔴 Le dépôt ne prouve pas ce qui s'exécute (C-35)

- ❌ **Ne jamais conclure d'une lecture de `supabase/functions/` qu'une Edge Function fait ce que le
  dépôt dit.** Le 2026-09-03, les trois sources déployées lisibles divergeaient de `main`, de trois
  façons différentes. `npm run check:edge` est le seul lien entre les deux.
- ❌ **Ne jamais écrire un statut de finding sur une Edge Function sans citer sa version déployée.**
  Un « ✅ corrigé » qui ne dit pas *déployé le …* décrit un commit, pas la production.
- ⚠️ **Déployer depuis la racine du dépôt, sur `main`.** Un déploiement fait depuis un arbre de
  travail non committé se voit dans la garde, et s'est vu.
- ⚠️ Un déploiement n'événemente rien dans la CI : le job tourne aussi à l'heure, pas seulement sur
  `push`. La dérive du 09-03 est née d'un déploiement, pas d'un commit.
- ❌ **Ne jamais se fier à une copie laissée sur le disque** (`.deploy-tmp/` et consorts) : elle
  périme en silence. La sienne était antérieure au correctif C-08.

## ⚠️ Dérive au 2026-11-05

**15 fonctions déployées**, 15 sondes vertes. `Edge deploy drift` est **rouge** depuis les commits de
facturation du 2026-11-03 : `stripe-webhook`, `stripe-org-refund`, `stripe-org-subscription`,
`renewal-notice` et `seat-alert` portent en ligne une version antérieure (`_shared/billing-mail-*`).
Les dix autres sont identiques à `main`. Redéployer : geste d'Axel. Le job dit l'état du jour,
pas ce paragraphe.
- 🔴 **Un module `_shared/` modifié fait dériver TOUTES les fonctions qui l'importent**, pas seulement
  celle qu'on visait : `verify-org-domain` embarquait l'ancienne `_shared/org-integrations.ts` après W-2.
  Avant de déployer : `grep -l "_shared/<module>" supabase/functions/*/index.ts`.
- ✅ Déploiement sans Docker : `supabase functions deploy <slug> --use-api`, depuis la racine.

## 🔴 Une fonction, une section, une sonde (2026-09-30 ; quinze au 2026-11-05)

- ❌ **Jamais une fonction sans sa section `[functions.<slug>]` dans `supabase/config.toml`.**
  `org-webhook-dispatch` y manquait : déployée en `verify_jwt = true`, elle rendait 401 à la CI
  avant son code, et **aucun webhook n'est jamais parti** (W-1). `src/edge-config.guard.test.ts`
  l'exige, et exige `false` pour une fonction à `x-cron-secret`.
- ❌ **Jamais un appel sortant vers une URL client sans résoudre le nom** et refuser toute adresse
  non publique (`_shared/org-integrations.ts`, W-2). La contrainte SQL ne voit qu'un texte.
- ❌ **Jamais un membre jugé actif sur `suspended_at` seul** : `membershipIsActive` (`_shared/org-membership.ts`),
  comme `is_org_member` (SV-1, un admin expiré envoyait encore des invitations).
- ❌ **Jamais l'IP d'appel lue dans la 1re entrée de `x-forwarded-for`** : Cloudflare ajoute, il ne remplace
  pas. `callerIp` (`_shared/caller-ip.ts`) lit `cf-connecting-ip` (SV-3).
- ❌ **Jamais une fonction planifiée sans `withCronLease`** (`_shared/cron-lease.ts`, mig. `245`, ARC-06) :
  idempotentes en rejeu, elles ne l'étaient pas en concurrence (deux passages, deux envois). Garde :
  `src/edge-cron-lease.guard.test.ts`. Planification : pg_cron, `docs/DEPLOYMENT.md` § 2sexies.
- ❌ **Jamais un e-mail sans plafond de débit** (`_shared/rate-limit.ts`, W-4 ; plafond par exécution pour un cron).
- ⚠️ **`delete-account` a deux modes depuis le 2026-10-22 (C-121)** : JWT de la personne, ou
  `x-cron-secret` + compte désigné, accepté seulement si `account_inactivity_deletion_due()` (mig. `226`)
  le confirme. ❌ Ne jamais retirer cette revérification : sans elle, le secret seul effacerait n'importe qui.

## ✅ Le code déployé ≠ le comportement déployé (C-91, 2026-09-20)

`check:edge` relit les **sources** en ligne et les compare au dépôt. Il ne dit rien de ce que la
fonction **fait**. C est `npm run check:edge-smoke` qui touche les premiers mètres : **13 sondes** (12 jusqu au 2026-10-22, `inactive-accounts` en plus)
(8 jusqu au 2026-09-30, A-2), dans `edge-deploy-drift.yml`. Les fonctions cron sont sondées **sans
jeton**, comme la CI les appelle : c'est ce qui voit un `verify_jwt` faux.
⚠️ Treize sondes ne sont pas treize fonctions vérifiées : elles prouvent qu'une fonction répond et
comment elle refuse, jamais qu'elle fait son travail.

## Interdits

- ❌ **Ne jamais avaler l'erreur d'une lecture qui décide d'un routage.** Une panne de lecture
  devenue « pas d'utilisateur » ou « jamais traité » encaisse sans appliquer, ou rejoue un handler
  non idempotent. **En cas de doute, faire retenter Stripe, jamais deviner.**
- ❌ **Ne jamais rendre une garde conditionnelle à la présence de son propre secret.**
  `if (SECRET && header !== SECRET)` laisse passer tout le monde tant que le secret n'est pas posé :
  on ne se protège que quand on est déjà protégé.
- ❌ **Jamais un CORS écrit sur place ni un `?? 'http://localhost…'`** : `corsHeadersFor` et
  `requireEnv` de `_shared/env.ts` (COD-03). `APP_URL` seule, origine locale par `CORS_DEV_ORIGINS`.
  Garde : `src/edge-cors.guard.test.ts` (`affiliation-api` en exception nommée).
- ❌ **Jamais `event.data.object` appliqué tel quel** pour un abonnement : relire (SEC-08).
- ⚠️ **Traçage Sentry : `Deno.serve(withTrace('<slug>', …))`** (`_shared/trace.ts`, 9 fonctions, OBS-02). `SENTRY_DSN_EDGE`
  absent, le gestionnaire passe tel quel : c'est de l'observabilité, pas une garde. ❌ Jamais d'URL, d'en-tête,
  de corps ni d'identifiant en attribut de span (`src/edge-trace.guard.test.ts`). → `docs/OBSERVABILITE.md`.
- ⚠️ `opsAlert()` pousse sur `OPS_ALERT_WEBHOOK_URL`. Un secret absent se solde par un **échec**,
  jamais par un `::warning::` dans un run vert.
- ⚠️ **`_shared/refund-replay.ts` est un module TS pur, et doit le rester** : mélangé aux appels
  Stripe il n'est exécutable par aucun test. `src/refund.guard.test.ts` interdit de le recopier
  sur place.
