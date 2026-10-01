# Edge Functions · règles du dossier

> Le code DÉPLOYÉ et le dépôt sont deux choses différentes. Détail, mesures et historique du
> drift : [`docs/SECURITY.md`](../../docs/SECURITY.md). Stripe :
> [`src/modules/billing/CLAUDE.md`](../../src/modules/billing/CLAUDE.md) et
> [`docs/STRIPE-LIVE.md`](../../docs/STRIPE-LIVE.md). Findings : [`faille.md`](../../faille.md).

## 🔴 Le dépôt ne prouve pas ce qui s exécute (C-35)

- ❌ **Ne jamais conclure d une lecture de `supabase/functions/` qu une Edge Function fait ce que le
  dépôt dit.** Le 2026-09-03, les trois sources déployées lisibles divergeaient de `main`, de trois
  façons différentes. `npm run check:edge` est le seul lien entre les deux.
- ❌ **Ne jamais écrire un statut de finding sur une Edge Function sans citer sa version déployée.**
  Un « ✅ corrigé » qui ne dit pas *déployé le …* décrit un commit, pas la production.
- ⚠️ **Déployer depuis la racine du dépôt, sur `main`.** Un déploiement fait depuis un arbre de
  travail non committé se voit dans la garde, et s est vu.
- ⚠️ Un déploiement n événemente rien dans la CI : le job tourne aussi à l heure, pas seulement sur
  `push`. La dérive du 09-03 est née d un déploiement, pas d un commit.
- ❌ **Ne jamais se fier à une copie laissée sur le disque** (`.deploy-tmp/` et consorts) : elle
  périme en silence. La sienne était antérieure au correctif C-08.

## ✅ Plus aucune dérive (2026-10-01)

Les six fonctions en retard ont été redéployées depuis `main` le 2026-10-01 (`org-webhook-dispatch`
APRÈS la mig. `207`) : `Edge deploy drift` **vert** pour la première fois depuis le 09-21, 12 fonctions
identiques, 12 sondes. Versions : [`faille.md`](../../faille.md) § « Ordre de priorité ».
- 🔴 **Un module `_shared/` modifié fait dériver TOUTES les fonctions qui l importent**, pas seulement
  celle qu on visait : `verify-org-domain` embarquait l ancienne `_shared/org-integrations.ts` après W-2.
  Avant de déployer : `grep -l "_shared/<module>" supabase/functions/*/index.ts`.
- ✅ Déploiement sans Docker : `supabase functions deploy <slug> --use-api`, depuis la racine.

## 🔴 Douze fonctions, douze sections, douze sondes (2026-09-30)

- ❌ **Jamais une fonction sans sa section `[functions.<slug>]` dans `supabase/config.toml`.**
  `org-webhook-dispatch` y manquait : déployée en `verify_jwt = true`, elle rendait 401 à la CI
  avant son code, et **aucun webhook n est jamais parti** (W-1). `src/edge-config.guard.test.ts`
  l exige, et exige `false` pour une fonction à `x-cron-secret`.
- ❌ **Jamais un appel sortant vers une URL client sans résoudre le nom** et refuser toute adresse
  non publique (`_shared/org-integrations.ts`, W-2). La contrainte SQL ne voit qu un texte.
- ❌ **Jamais un e-mail sans plafond de débit** (`_shared/rate-limit.ts`, W-4).

## ✅ Le code déployé ≠ le comportement déployé (C-91, 2026-09-20)

`check:edge` relit les **sources** en ligne et les compare au dépôt. Il ne dit rien de ce que la
fonction **fait**. C est `npm run check:edge-smoke` qui touche les premiers mètres : **12 sondes**
(8 jusqu au 2026-09-30, A-2), dans `edge-deploy-drift.yml`. Les fonctions cron sont sondées **sans
jeton**, comme la CI les appelle : c est ce qui voit un `verify_jwt` faux.
⚠️ Douze sondes ne sont pas douze fonctions vérifiées : elles prouvent qu une fonction répond et
comment elle refuse, jamais qu elle fait son travail.

## Interdits

- ❌ **Ne jamais avaler l erreur d une lecture qui décide d un routage.** Une panne de lecture
  devenue « pas d utilisateur » ou « jamais traité » encaisse sans appliquer, ou rejoue un handler
  non idempotent. **En cas de doute, faire retenter Stripe, jamais deviner.**
- ❌ **Ne jamais rendre une garde conditionnelle à la présence de son propre secret.**
  `if (SECRET && header !== SECRET)` laisse passer tout le monde tant que le secret n est pas posé :
  on ne se protège que quand on est déjà protégé.
- ⚠️ `APP_URL` (`https://thecosmo.app`) est la **seule** origine CORS autorisée par les deux
  fonctions org : le checkout entreprise ne peut pas être testé depuis `localhost:5173`.
- ⚠️ `opsAlert()` pousse sur `OPS_ALERT_WEBHOOK_URL`. Un secret absent se solde par un **échec**,
  jamais par un `::warning::` dans un run vert.
- ⚠️ **`_shared/refund-replay.ts` est un module TS pur, et doit le rester** : mélangé aux appels
  Stripe il n est exécutable par aucun test. `src/refund.guard.test.ts` interdit de le recopier
  sur place.
