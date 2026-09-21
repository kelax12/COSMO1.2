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

## 🔴 `report-bug` DOIT être redéployée (au 2026-09-21)

Sa source a changé dans `2b4c4304` (compteur de `C-110`). **Tant qu elle ne l est pas,
`npm run check:edge` signale une dérive LÉGITIME** : le rouge est juste.
❌ **Ne pas le lire comme un faux positif, et surtout ne pas le faire taire.** Confondre une dérive
réelle avec du bruit est exactement ce qui use une garde jusqu à ce qu elle ne serve plus. Geste :
`M-61` d [`a-faire-manuel.md`](../../a-faire-manuel.md).

## ✅ Le code déployé ≠ le comportement déployé (C-91, 2026-09-20)

`check:edge` relit les **sources** en ligne et les compare au dépôt. Il ne dit rien de ce que la
fonction **fait**. C est `npm run check:edge-smoke` qui touche les premiers mètres : **8 sondes**,
dans `edge-deploy-drift.yml`, **vertes contre la production** le jour de leur pose.
⚠️ Huit sondes ne sont pas huit fonctions vérifiées : elles prouvent qu une fonction répond et
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
