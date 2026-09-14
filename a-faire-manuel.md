# À faire — MANUEL (ce que le code ne peut pas faire)

**Dressé le 2026-09-03**, en sortie de l'audit **A-5**, comme pendant de
[`a-faire-code.md`](./a-faire-code.md).

**Ce que ce fichier contient** : uniquement ce qui se règle **avec tes mains**, hors de l'éditeur.
Une console de fournisseur, un guichet, un formulaire, une carte bancaire, un téléphone, une
décision. Rien ici ne se corrige en écrivant du code.

> 🔴 **Ce fichier ne porte AUCUN statut.** Le statut de chaque ligne vit à un seul endroit, nommé
> dans la colonne « Statut tenu dans ». C'est la règle qui a déjà évité trois fois qu'un même sujet
> soit « fait » ici et « ouvert » ailleurs. Ce fichier dit **quoi faire et pourquoi**, pas où ça en
> est.

---

> ### 🔄 Mise à jour du 2026-09-14 — **3 gestes neufs, 3 retirés, 3 lignes qui décrivaient un produit disparu**
>
> Tout ce qui suit est **mesuré ce jour-là**, pas repris d'un tableau : ledger de migrations lu en
> base, versions d'Edge Functions lues par l'API, runs lus par `gh`, branches `case` du webhook
> recomptées dans le code.
>
> **🆕 Trois gestes qui n'étaient écrits nulle part**
>
> | # | Geste | Pourquoi il apparaît maintenant |
> |---|---|---|
> | **M-43** | appliquer la mig. `140` et jouer `reset_stripe_identifiers(true)` **dans** la fenêtre de bascule | Il conditionne M-06 et **aucune ligne ne le portait**. Sans lui, un identifiant Stripe de TEST présenté à une clé LIVE répond 404, donc 500 |
> | **M-44** | trancher le retrait de la pastille « Aujourd'hui » du report rapide | Un fichier non commité d'une autre session contredit la conclusion de `C-72`. Deux lectures du produit, pas deux états du code |
> | **M-37b**, 5ᵉ point | rejouer volontairement le remboursement et vérifier qu'il ne rend **rien de plus** | Le verrou vient d'être rendu testable et déployé (v6). Son arithmétique est prouvée ; son comportement **contre Stripe** ne l'est pas |
>
> **🔴 Trois lignes étaient FAUSSES, et deux auraient coûté cher**
>
> | # | Ce qu'elle disait | Ce que la mesure rend |
> |---|---|---|
> | **M-07** | réenregistrer l'endpoint webhook live « avec les **5** mêmes events » | **SIX** branches `case` dans `stripe-webhook`, recomptées dans le code. En réenregistrer cinq **couperait le remboursement en silence** |
> | **M-08** | la recette live n'exerçait **pas** le remboursement | Le chemin existe depuis le 2026-09-12 (v6 aujourd'hui). Une recette qui ne l'emprunte pas laisse sortir en live le seul geste qui REND de l'argent, jamais éprouvé |
> | **M-22** | « aujourd'hui **oui**, un admin non propriétaire peut supprimer l'entreprise » | Faux depuis la mig. `138` (prod, 2026-09-12). Décision **prise et appliquée** : non. Parcours joué dans un navigateur le 09-14 |
>
> **✅ Trois lignes retirées, le geste étant fait** — ~~M-30~~ (les **8** Edge Functions sont en ligne
> et identiques au dépôt, run `34861975638`), ~~M-31~~ (migrations `137` `138` `139` au ledger de
> prod, relu en base), ~~M-22~~ (ci-dessus). Et le § 8 ne décrit plus une production divergente :
> elle ne l'est plus.
>
> ⚠️ **Ce que cette passe redit, pour la énième fois** : M-07, M-08 et M-22 n'ont pas été trouvées
> en relisant ce fichier — elles l'ont été en comptant dans le code et en lisant le ledger. Une
> ligne recopiée vieillit sans que rien ne l'annonce, et **un tableau de gestes qui en contient de
> faux use la crédibilité de ceux qui restent.**

---

## Sommaire

| § | Domaine | Nature |
|---|---|---|
| [1](#1-bloquant-absolu--rien-ne-sencaisse-avant) | Guichet et statut juridique | administratif |
| [2](#2-bascule-stripe-live) | Stripe live | console + carte réelle |
| [3](#3-secrets-à-poser) | Secrets | console |
| [4](#4-réglages-de-console-supabase) | Supabase | clics |
| [5](#5-décisions-qui-nappartiennent-quà-toi) | Décisions produit | arbitrage |
| [6](#6-acquisition-et-seo) | Annuaires, Search Console | manuel, répétitif |
| [7](#7-vérifications-quaucune-gate-ne-peut-faire) | Ce qu'il faut ouvrir soi-même | appareil réel |
| [8](#8-déploiements-quun-git-push-ne-fait-pas) | 🔴 Edge Functions **et migrations** : le dépôt ≠ la production | ligne de commande |

---

## 1. Bloquant absolu · rien ne s'encaisse avant

| # | À faire | Pourquoi c'est toi et pas le code | Statut tenu dans |
|---|---|---|---|
| M-01 | **Immatriculation micro-entreprise au guichet unique INPI** | Encaisser avant l'immatriculation est du travail dissimulé. Aucune ligne de code ne contourne ça | `ROADMAP-60J.md` T-32 |
| M-02 | **Choisir et signer une société de domiciliation** | Décision prise le 2026-08-26, exécution en attente. Conditionne l'adresse des mentions légales | `ROADMAP-60J.md` T-33 |
| M-03 | **Adhérer à un médiateur de la consommation**, puis publier ses coordonnées dans les CGV | Adhésion payante et obligatoire dès qu'on vend à un consommateur. Oubli classique, sanctionné par la DGCCRF. Et **tout client de COSMO est un consommateur** (décision du 2026-08-26) | `ROADMAP-60J.md` T-34 |
| M-04 | **Collecter et archiver les DPA** des six sous-traitants : Supabase, Vercel, Sentry, Stripe, Resend et **Vesk** | Un DPA ne s'obtient qu'en tant qu'entreprise, donc après M-01. Vesk reçoit de la donnée personnelle depuis les pages publiques : c'est un sous-traitant comme les autres | `ROADMAP-60J.md` T-43, `faille.md` V-1 |
| M-05 | **Compléter les mentions légales** : SIREN, RCS, TVA, directeur de publication, et configurer les factures Stripe pour la France (« TVA non applicable, art. 293 B du CGI », mentions L441-9, numérotation continue) | Le SIREN n'existe qu'après M-01. Une mention fausse est pire qu'une mention absente | `ROADMAP-60J.md` T-37 |

---

## 2. Bascule Stripe live

⚠️ **La production COSMO tourne sur une clé Stripe de TEST depuis le début.** Les customers des
vrais utilisateurs vivent dans le sandbox ; le compte live est équipé (4 produits, 8 prix, tous en
`tax_behavior: inclusive`) mais vide.

| # | À faire | Pourquoi c'est toi | Statut tenu dans |
|---|---|---|---|
| M-06 | Remplacer `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et les **4** `STRIPE_ORG_PRICE_*` mensuels par leurs valeurs live | Ce sont des secrets de console. ✅ Il n'y a **aucun** secret annuel à poser : le prix annuel se dérive du mensuel | `ROADMAP-60J.md` T-36 |
| M-07 | Réenregistrer un **endpoint webhook live**, avec les **SIX** events — `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` et **`charge.refunded`** | Console Stripe. 🔴 **Cette ligne disait CINQ, et c'était faux.** Recompté dans le code le 2026-09-14 : `stripe-webhook` porte **six** branches `case`. La sixième, `charge.refunded`, est arrivée avec la v27 du 2026-09-06. **En réenregistrer cinq couperait le remboursement en silence** : la branche serait en ligne et ne recevrait jamais rien, et le journal fiscal montrerait un encaissement sans son remboursement — précisément le trou que `recordRefund` existe pour empêcher | `ROADMAP-60J.md` T-36 |
| M-08 | **Recette de bout en bout avec une vraie carte** : souscription mensuelle, changement de palier depuis le portail, résiliation, **puis un REMBOURSEMENT et son REJEU**, puis vérification de `org_subscriptions` et du journal `payment_records`. ⚠️ **Le remboursement a été ajouté à cette recette le 2026-09-14** : le chemin existe désormais (`stripe-org-refund`, v6) et une recette qui ne l'emprunte pas laisserait sortir en live le seul geste du produit qui REND de l'argent, jamais éprouvé. Quatre points à relever : le montant, la **ligne compensatoire NÉGATIVE** au journal, `verify_payment_chain()` toujours vraie, et **un second appel qui ne rend RIEN de plus** | Le webhook et le checkout n'ont **jamais** traité un paiement réel. La résolution du prix annuel est le seul endroit où COSMO choisit un montant au lieu de se le faire désigner | `ROADMAP-60J.md` T-39 |
| M-09 | **Réarmer la facturation** : `ENTERPRISE_BILLING_ENFORCED = true` **et** `UPDATE billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit'`, dans le même déploiement | Les deux drapeaux se déplacent **ensemble**. Serveur seul = un propriétaire se voit refuser une invitation sans qu'aucun écran ne lui propose de payer. Client seul = on encaisse sans rien débloquer | `ROADMAP-60J.md` T-38 |
| **M-43** 🆕 | 🔴 **DANS la fenêtre de bascule, jamais avant : appliquer la mig. `140` puis jouer `SELECT * FROM public.reset_stripe_identifiers(true);`** (à blanc d'abord, sans argument). Elle remet à zéro les identifiants Stripe de TEST restés en base | **Aucune ligne de ce fichier ne portait ce geste**, alors qu'il conditionne M-06 : `stripe-org-checkout` et `stripe-org-portal` réutilisent `stripe_customer_id` et `stripe_subscription_id` tels quels, et un identifiant de TEST présenté à une clé LIVE répond 404, donc 500. ⚠️ **Le geste a un objet réel** : « les tables sont vides » était faux d'une table sur deux — mesuré, `subscriptions` porte **5 `cus_…` et 2 `sub_…`** du compte de test. 🔴 **Jouer la migration AVANT la bascule ne sert à rien** : tant que la clé est une clé de test, chaque checkout réécrit un identifiant de test. ⚠️ La fonction **rétrograde au palier gratuit** les orgs payantes qu'elle nettoie, sinon elles garderaient leur quota sans rien pour le payer et un portail qui répond `no_subscription` : ni facturable, ni résiliable | `a-faire-code.md` C-08 |
| M-10 | ⚠️ **Tester le checkout entreprise depuis la PROD, jamais depuis `localhost:5173`** | `APP_URL` vaut `https://thecosmo.app` et c'est la seule origine CORS autorisée par les deux Edge Functions org | `CLAUDE.md` |

🔴 **Trois dettes de CODE tombent pile pendant cette bascule** et doivent être payées avant :
C-08 (remise à zéro des identifiants Stripe en base, invalidation du cache `productIndex`), C-30 et
**C-39** (les preuves L215-1 / L221-28 disparaissent en cascade, et n'importe quel admin peut
déclencher la cascade depuis l'écran). Détail dans [`a-faire-code.md`](./a-faire-code.md).

---

## 3. Secrets à poser

| # | Secret | Où | Ce qui reste inerte tant qu'il manque | Statut tenu dans |
|---|---|---|---|---|
| ~~M-11~~ ✅ **Déjà POSÉ le 2026-09-02** à 09:13:47 UTC, onze jours avant que ce tableau ne le réclame encore | `OPS_ALERT_WEBHOOK_URL` | Secrets **Actions** du dépôt GitHub | 🔴 **Cette ligne était fausse**, mesurée le 2026-09-13 par `gh secret list` : le secret y est, et `ci-alert.yml` pousse. Exercice à blanc joué le 09-02 (run `33613177985`) **et rejoué le 09-13** (run `34749470125`), **HTTP 204** les deux fois ; **73** alertes réelles poussées depuis, dont les 14 échecs de `Edge deploy drift`. ✅ **CONFIRMÉ LU le 2026-09-13 à 18:28 (Paris)**, capture du salon `#général` à l'appui, avec les DEUX sources : `ci-alert.yml` et `opsAlert()` depuis une Edge Function. Un 204 disait que l'endpoint acceptait ; la lecture ne se prouve que par quelqu'un qui montre le message | `a-faire-code.md` C-28 |
| ~~M-12~~ ✅ **POSÉ le 2026-09-13 à 16:21 UTC**, des DEUX côtés, à 3 secondes d'écart | `CRON_SECRET` | Supabase **et** GitHub, **même valeur des deux côtés** | Les avis de reconduction tacite. Un avis non envoyé rend l'abonnement résiliable à tout moment, remboursement compris. **Mesuré le 2026-09-03** : la fonction répondait `503 cron_secret_not_configured` à tout appel, donc le secret n'était posé **nulle part**, et le travail quotidien n'avait jamais tourné une seule fois. ✅ **Prouvé de bout en bout le 2026-09-13**, les trois cas : sans en-tête → `401`, **mauvais secret → `401`** (donc la garde COMPARE, elle ne se contente pas de constater que le secret existe), bon secret → **`200 {"due":0,"sent":0,"failed":0}`**. Et le workflow `renewal-notice` joué en `workflow_dispatch` (run `34768378680`) sort **VERT en HTTP 200** : c'est la seule preuve possible que les deux côtés portent la MÊME valeur | `ROADMAP-60J.md` T-40, `a-faire-code.md` C-34 |
| M-29 | `BUG_REPORT_FROM` | Supabase (`supabase secrets set`) | **Les deux** fonctions qui envoient un e-mail (`report-bug` et `renewal-notice`) lisent ce même secret. La valeur doit viser `send.thecosmo.app`, jamais la racine `thecosmo.app`, que Resend ne signera jamais. ⚠️ Une fois le déploiement M-30 fait, les deux fonctions n'ont **plus de valeur par défaut** et répondent `503 sender_not_configured` : M-30 sans M-29 coupe le formulaire de signalement de bug | `a-faire-code.md` C-35 |
| ~~M-33~~ ✅ | `SUPABASE_ACCESS_TOKEN` | Secrets **Actions** du dépôt GitHub (jeton personnel : dashboard Supabase → Account → Access Tokens) | Le job `Edge deploy drift`, seule chose qui compare le code **déployé** des Edge Functions à celui du dépôt. ⚠️ Contrairement aux autres lignes de ce tableau, ce secret manquant ne rend pas la garde muette : elle **échoue** et ouvre une issue `ci-red` tous les jours jusqu'à ce qu'il soit posé. C'est voulu : un secret absent ne doit jamais produire un run vert. Poser le secret ou désactiver le workflow, pas de troisième option. ✅ **POSÉ le 2026-09-13 à 09:34 UTC** : le job a comparé les 8 fonctions le jour même, après 14 échecs d'affilée sans jamais avoir rien comparé | `a-faire-code.md` C-35 |
| ~~M-33b~~ ✅ **FAIT le 2026-09-13 à 16:12 UTC** (v32, run `34768021931` vert) | Redéployer `stripe-webhook` depuis `main` | `supabase functions deploy stripe-webhook` | La v31 en ligne (déployée le 2026-09-13 à 16:04 UTC) diffère de `main` par **un caractère de cadre dans un commentaire**, sur deux fichiers. Rien de fonctionnel, mais c'est la trace d'un déploiement fait depuis un arbre de travail non committé — exactement ce que C-35 existe pour attraper — et c'est le seul écart qui empêche encore `Edge deploy drift` d'être vert | `a-faire-code.md` C-35 |
| ~~M-34~~ ✅ **POSÉ le 2026-09-12**, et `report-bug` déployée derrière (v11, 23:08 UTC) : le plafond s'applique, borne jouée en ligne (11ᵉ appel → `429`) | `RATE_LIMIT_SALT` | Supabase (`supabase secrets set RATE_LIMIT_SALT=<valeur aléatoire longue>`) | Le plafond de débit de `report-bug` (mig. `139`, finding C-31). ⚠️ Ce secret ne rend pas la fonction permissive quand il manque : une fois la nouvelle version déployée, `consumeRateLimits` **REFUSE de servir**, donc le formulaire de signalement de bug est coupé. C'est délibéré : pas de sel, pas de service, plutôt qu'un hachage d'IP devinable, une IP étant une donnée à caractère personnel. **À poser AVANT** le redéploiement de `report-bug`, dans la même séance que M-29. Changer la valeur plus tard remet à zéro les compteurs en cours, sans conséquence : `rate_limits` est un cache de défense, jamais une preuve | `a-faire-code.md` C-31 |
| M-13 | `VITE_TURNSTILE_SITE_KEY` | Vercel | Le CAPTCHA d'inscription | `ROADMAP-60J.md` |
| M-14 | `VITE_SENTRY_DSN` **au build** | Vercel et CI | ⚠️ Sans elle, Vite remplace la variable à la compilation, Rollup jette presque tout `@sentry/react`, et `check:bundle` mesure un artefact qui n'existe nulle part. La garde refuse désormais ce build, mais le réglage reste à tenir | `CLAUDE.md` |

> ✅ **PLUS AUCUN depuis le 2026-09-13.** Les quatre secrets de ce tableau sont posés : ~~M-11~~ (`OPS_ALERT_WEBHOOK_URL`, depuis le 09-02, sans que ce tableau l'ait jamais vérifié), ~~M-33~~ (`SUPABASE_ACCESS_TOKEN`, 09-13), ~~M-34~~ (`RATE_LIMIT_SALT`, 09-12) et ~~M-12~~ (`CRON_SECRET`, 09-13). **Il n'y a plus un seul endroit où du code écrit, testé et committé ne produise rien en production.**
>
> ⚠️ **Un secret posé n'est pas un secret qui marche.** Chacun des quatre a été prouvé par un APPEL, pas par sa présence dans une liste : M-11 par un `HTTP 204` sur le webhook, M-33 par un run de comparaison vert sur 8 fonctions, M-34 par un `429` au 11ᵉ appel, M-12 par un `200` depuis le runner GitHub ET un `401` sur une mauvaise valeur. C'est la règle du dépôt appliquée aux secrets : *une garde se vérifie sur ce qu'elle REGARDE.*
>
> ⚠️ **Ce que M-11 coûte en leçon, et qui vaut pour tout ce fichier** : un secret se vérifie par `gh secret list`, une commande d'une seconde. Celui-là a été réclamé onze jours après avoir été posé, parce que la ligne a été **recopiée** au lieu d'être relue à sa source. Un tableau de gestes manquants qui liste un geste déjà fait use la crédibilité de ceux qui restent.
>
> L'ordre contraignant qui pesait sur M-34 est éteint : le secret a été posé **avant** le redéploiement de `report-bug`, comme il le fallait, le 2026-09-12. ✅ **Refermé le 2026-09-12** : mig. `139` appliquée, secret posé, `report-bug` déployée en **v11** à 23:08 UTC, dans cet ordre. Borne jouée sur la fonction EN LIGNE, 12 appels à corps invalide (donc zéro e-mail) : 10 × `400`, puis `429` au 11ᵉ et au 12ᵉ. En base, une ligne à `hits = 11`, clé opaque, aucune IP. Le compteur de la sonde a été purgé derrière, et un appel suivant rend de nouveau `400`.

❌ **Ne jamais rendre une garde conditionnelle à la présence de son propre secret.** Un secret
absent doit produire un **échec visible**, jamais un run vert. C'est le défaut qui a fait sortir
`uptime.yml` en vert en ne testant que la moitié du système.

---

## 4. Réglages de console Supabase

Aucun ne bloque un déploiement ; tous sont des clics.

| # | À faire | Où |
|---|---|---|
| M-15 | « Leaked password protection » (HaveIBeenPwned) | Authentication → Policies. ⚠️ Réservée au plan Pro : hors de portée tant que le plan `free` est assumé. L'advisor restera rouge, et c'est attendu |
| M-16 | Vérifier que « Secure email change » est bien actif | Authentication. Déclaré posé le 2026-08-29, **jamais vérifié** : aucun réglage Auth n'est lisible depuis le dépôt |
| M-17 | Vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique | Le `.env` a été commité au commit initial d'un dépôt **public**. Les clés visent un projet supprimé, donc inertes, mais **le mot de passe n'appartient qu'à toi** |

Statuts tenus dans `faille.md`, section « Ouvert · réglages de console Supabase ».

🔴 **Une seule chose à savoir par cœur** : un seul compte au monde ouvre `/admin`, et un seul
facteur TOTP y donne accès. Téléphone perdu, la seule porte de sortie est
`DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';` depuis le SQL editor.

---

## 5. Décisions qui n'appartiennent qu'à toi

| # | Décision | Ce qui en dépend | Statut tenu dans |
|---|---|---|---|
| M-18 | **Plan Supabase** : rester en `free` (pas de PITR) ou passer en Pro | La sauvegarde ponctuelle. Le drill de restauration a été exécuté le 2026-09-01, donc le risque est connu et assumé, pas ignoré | `faille.md` A-9, `ROADMAP-60J.md` T-01 |
| M-19 | **Confirmations d'inscription par e-mail** : les réactiver ou non | Elles sont **désactivées**, par ta décision. Le DNS est vert (DKIM, SPF, MX du Return-Path), mais le DNS ne prouve pas qu'un e-mail arrive | `faille.md` G-2 |
| M-20 | **Vesk** (mesure d'audience) : gardé, avec surveillance quotidienne de son empreinte | Décision du 2026-08-18. Refermer l'issue `ci-red` réarme l'alerte | `faille.md` V-1 |
| M-21 | **`vendor-sentry` sur le chemin critique** : le différer, ou pas | Ce n'est pas un arbitrage de performance : le différer revient à ne plus capturer les erreurs de démarrage, celles qui blanchissent l'écran. ⚠️ La mesure qui servait à trancher était fausse (build sans DSN) : il en faut une nouvelle avant de décider | `a-faire-code.md` C-13, `ROADMAP-60J.md` T-47 |
| ~~M-22~~ | ~~**Un admin non propriétaire doit-il pouvoir supprimer l'entreprise ?**~~ ✅ **TRANCHÉ et APPLIQUÉ : non.** | 🔴 **Cette ligne décrivait un produit qui n'existe plus.** Elle disait « aujourd'hui oui » : c'est faux depuis la mig. **138**, appliquée en prod le 2026-09-12, qui fait exiger le PROPRIÉTAIRE à `delete_organization` et refuse tant qu'un abonnement court. L'écran applique la même règle (`isOwner`), et le parcours a été **joué dans un navigateur le 2026-09-14** : un admin non propriétaire n'atteint ni la zone de danger ni le bouton (`e2e/stubbed/delete-org.spec.ts`). ⚠️ L'écran n'est que l'affichage — la règle vit dans la RPC, seule porte vers un DELETE sur `organizations` | `a-faire-code.md` C-39 |
| M-41 | ✅ **TRANCHÉ le 2026-09-13 : on DIFFÈRE la fusion** (issue 1). `feat/react-19` reste poussée, non fusionnée. Reprise conditionnée à **283,5 ko** de chemin critique sous React 18 (et non 299,7 : une garde à 0 % de marge rouvre C-14 le jour même), soit **22,8 ko** à couper, que seul `vendor-animation` peut rendre. 🔴 **Deux choses ont changé le 2026-09-14, et elles ne changent pas la décision — elles la rendent enfin opposable.** (1) Le plafond de **323 000 o EST désormais commité** (`7134d7fe`, run CI `34846164939` vert) : la phrase « il n'est dans aucun commit » est périmée, et React 19 à 329,8 ko **échouerait** maintenant à la garde de `main`, comme il le doit. (2) Les **9 corrections de types** de la branche ne sont **PAS portables** sur `main`, contrairement à ce qui était écrit : appliquées, `tsc -b` rend **72 erreurs** — sous React 18, `RefObject<T | null>` n'est pas assignable à `LegacyRef<T>`, donc chaque `ref={...}` qui les consomme casse. Port tenté, mesuré, **défait** ; `main` est propre. **Il n'y a donc aucun acompte à verser d'avance pour alléger la reprise.** Détail : `docs/MIGRATION-REACT19.md` § 4bis.c. Énoncé d'origine conservé ci-contre | ⚠️ **Ce n'est plus « quand la planifier » : elle a été jouée le 2026-09-12**, branche `feat/react-19` (poussée, **non fusionnable**). Tout est vert — typecheck, lint 0 erreur, 2 500 tests, les six gates, le build, et l'E2E (104 passés, 0 échec) — **sauf `check:bundle`, exit 1**. React 19 pèse **+23,3 ko gzip** et le chemin critique passe à **329,8 ko** pour un plafond de **323,0**. Ce plafond a été ABAISSÉ le 2026-09-11 pour satisfaire le critère de sortie de C-14 (5 % de marge) : le remonter rouvrirait C-14 le jour même. **Trois issues, et il faut en choisir une** : (1) différer — l'option par défaut, l'urgence sécurité étant tombée ; (2) sortir `framer-motion` du chemin critique pour de vrai, c'est-à-dire remplacer `MotionConfig` par une lecture CSS/`matchMedia` de `prefers-reduced-motion`, chantier à part avec sa mesure au navigateur **sous `reduce`** ; (3) accepter de rouvrir C-14. ❌ Ne pas « différer `MotionConfig` » naïvement : c'est un fournisseur de CONTEXTE, les premiers écrans rendraient sans `prefers-reduced-motion` |
| **M-44** 🆕 | 🔴 **Trancher le sort de neuf fichiers modifiés et NON COMMITÉS dans l'arbre de travail**, laissés par d'autres sessions. Un en particulier : `src/components/task-table/OverdueQuickActions.tsx` **retire la pastille « Aujourd'hui »** du report rapide d'une tâche en retard | ⚠️ Ce retrait est en **tension directe avec la conclusion de C-72**, qui a établi le 2026-09-12 que « le produit est juste » et que refuser aujourd'hui était un artefact du test, pas un défaut. Les deux ne peuvent pas être vrais ensemble : ou bien reporter à aujourd'hui a du sens (et la pastille reste), ou bien non (et c'est la note de C-72 qu'il faut corriger). 🔴 **Personne ne peut trancher ça à ta place** : ce sont deux lectures du produit, pas deux états du code. ⚠️ Les huit autres fichiers sont des retouches mobiles et de la doc ; ils n'ont **pas** été commités par cette session, délibérément — indexer le fichier d'une autre session est exactement ce qui a produit les trois `fix(build)` du 09-13/09-14 | `a-faire-code.md` C-72 |
| M-42 | ✅ **TRANCHÉ le 2026-09-13 : on GARDE `#2563eb`.** Trois teintes ont été rendues côte à côte dans le produit (`/dashboard`, mode démo, thème clair, tokens surchargés sur le vrai bandeau) — `#1d4ed8` sur ce seul texte (5,59:1), `#1d4ed8` sur les deux tokens (5,50:1), `#1e40af` (7,05:1) — et aucune n'a emporté la décision pour 0,19 point de ratio | 🔴 **La mesure a corrigé l'énoncé de cette ligne, deux fois.** (1) Les « 9 nœuds » ne sont pas neuf endroits : c'est **un seul composant**, le lien « Créez un compte » de `DemoConversionBanner`, compté une fois par route protégée. (2) Ce n'était **pas** un arbitrage sur les liens et le focus : le texte fautif est peint par `--color-accent-solid`, pas par `--color-accent`, qui vaut 5,17:1 sur blanc et n'est flaggé nulle part. ⚠️ **La dispense `color-contrast` ne tombe pas**, c'est le prix assumé de la décision, et elle est tenue par un cliquet à 4,31:1 (`src/theme-contrast.guard.test.ts`), vu rouge deux fois avant d'être commité | `docs/ACCESSIBILITY.md` § « C-23 — pourquoi le bleu du thème clair reste à 4,31:1 » · `a-faire-code.md` C-23, **clos** |

---

## 6. Acquisition et SEO

| # | À faire | Pourquoi c'est le seul levier | Statut tenu dans |
|---|---|---|---|
| M-23 | **Soumettre COSMO aux 20 premiers annuaires**, dans l'ordre donné, et tenir le tableau de suivi | Position 88 sur les requêtes non-marque = 0 domaine référent. Aucun contenu ne compensera l'absence d'autorité de domaine | `ACQUISITION-BACKLINKS.md`, T-21 |
| M-24 | **Relever dans Search Console** : type de propriété, nombre de pages réellement indexées ; connecter Ahrefs Webmaster Tools pour compter les domaines référents | On pilote le SEO sans savoir combien de pages sont indexées | `ROADMAP-60J.md` T-22 |

---

## 7. Vérifications qu'aucune gate ne peut faire

Ce sont les neuf mesures que le dépôt réclame et que personne n'a jamais prises. Elles ne
produisent pas de correctif : elles produisent des **findings**, qui rejoignent ensuite
`a-faire-code.md`.

| # | À faire | Pourquoi aucune CI ne le remplace |
|---|---|---|
| M-25 | **Ouvrir le produit sur un vrai téléphone** (iOS Safari et Android), en mode démo puis sur un vrai compte | La note mobile de 76/100 n'a **aucune** mesure hors viewport émulé. 🟠 **Tenté le 2026-09-03, audit A-4** : aucun appareil n'était accessible, donc seule la moitié indépendante de l'appareil a pu être jouée (viewport émulé + sondes). Elle a rendu deux findings de code, `a-faire-code.md` **C-56** (le haut des trois formulaires `FirstRunSetup`, `BugReportModal`, `InviteOrJoinModal` devient inatteignable clavier ouvert, mesuré à 375×350) et **C-57** (cibles tactiles à 16×16 px pour cocher une tâche sur `/dashboard`, 40×40 sur `/okr`) — et a écarté deux soupçons (le plancher 16px des champs tient déjà, la conversion jour/instant de la date mobile d'événement est correcte). **Rien de tout ça n'a été confirmé au doigt**, et le mécanisme de C-56 diffère entre Android (viewport de mise en page réduit, modélisé) et iOS (page qui défile à la place, pas testé). Chaque bug retenu doit porter le modèle, la version d'OS et le navigateur, sinon il n'est pas reproductible. Prompt prêt : `prompts-audits.md`, A-4 |
| M-40 | **Jouer la check-list VoiceOver iOS sur un iPhone**, d'une traite, en mode démo : [`docs/AUDIT-VOICEOVER-IOS.md`](./docs/AUDIT-VOICEOVER-IOS.md) (12 étapes, ~60 min, préparation comprise) | C'est le **quatrième** audit d'accessibilité de `C-24`, le seul que le 2026-09-03 n'a pas passé. Il ne se simule pas : ce que le dépôt prouve aujourd'hui, c'est le **focus**, jamais l'**annonce** (Playwright lit le DOM, pas l'arbre d'accessibilité comme un lecteur d'écran). Trois correctifs d'annonce (D4, D5, E2) ont été écrits **sans jamais avoir été entendus**. La check-list commence par un **témoin** : si le premier bouton n'annonce pas son `aria-label`, l'instrument est faux et rien de la suite ne compte. Chaque finding doit porter modèle, version d'iOS et **verbatim**. Se joue dans la même séance que M-25 |
| M-26 | **Vérifier une échéance sur un appareil réglé sur un fuseau à décalage NÉGATIF** | C'est là que le bug R-01 cassait, et c'est invisible depuis la métropole. 467 des 601 échéances de la prod portaient 00:00:00 UTC |
| M-27 | **Envoyer un e-mail de test vers un compte jetable Gmail ET Outlook** | Le DNS vert ne prouve pas la délivrabilité. Procédure dans `DEPLOYMENT.md` §2ter |
| M-28 | **Parcourir l'application au clavier seul**, souris débranchée | Un tiers de WCAG est invisible pour axe-core. Le 2026-08-30, les flèches ne déplaçaient pas le focus dans le calendrier depuis des semaines, et aucune gate ne pouvait le voir. Prompt prêt : `prompts-audits.md`, A-3 |
| M-35 | **Provoquer les vraies pannes, connecté à la vraie base** : mot de passe refusé, session expirée en cours d'usage, réseau coupé pendant une sauvegarde, et le claim d'un lien d'invitation hors ligne | 🔴 **L'audit A-7 n'a pas pu le faire** : le `.env` local ne porte aucune valeur Supabase, donc l'app locale tourne intégralement en mode démo, et la seule tentative de connexion rend « Supabase non configuré », qui mesure la configuration, pas le produit. Tous les chemins d'erreur réels de Supabase, de GoTrue et du réseau sont donc **non mesurés**. Le cas le plus payant est celui de `a-faire-code.md` **C-63** : hors ligne, un lien d'invitation valide doit-il vraiment s'annoncer « invalide » ? |
| M-36 | **Ouvrir Sentry et lire les alertes `api error non catalogué`** | `normalizeApiError` émet un `captureMessage` à chaque code d'erreur absent du catalogue — c'est-à-dire à chaque fois qu'un utilisateur réel a lu « Une erreur inattendue est survenue » sans que personne sache laquelle. C'est la seule source qui dise **quels** codes tombent vraiment en production. Aucune gate ne peut la lire à ta place : elle est derrière ton compte Sentry |
| M-38 | **Ouvrir `/` sur ton poste (avec GPU) puis sur un téléphone**, `prefers-reduced-motion` **désactivé** | Toute la mesure d'A-8 a été prise dans un Chromium qui rastérise en **logiciel** (SwiftShader) — la bonne condition pour expliquer le score de CI, **pas** celle d'un poste équipé d'un GPU. Le lancement d'un navigateur avec GPU a échoué dans cet environnement : la question reste ouverte, et il ne faut pas la refermer par déduction. Regarder si le scroll reste fluide et si la fenêtre produit tourne sans à-coups. Un téléphone d'entrée de gamme est plus proche du cas logiciel qu'un poste de bureau : c'est là que le coût se paie. Rejoint M-25 |

---

## 8. Déploiements qu'un `git push` ne fait pas

🔴 **Ajouté par l'audit A-1, le 2026-09-03, et c'est son résultat le plus lourd.** Les trois sources
Edge Functions **réellement déployées** ont été lues via l'API de management et comparées à `main` :
**les trois divergent, de trois façons différentes**. Un push ne déploie aucune Edge Function, donc
un correctif committé, testé et vert peut ne pas exister pour les utilisateurs.

> ✅ **LA DIVERGENCE EST REFERMÉE, et ce n'est plus un relevé fait à la main.** Mesuré le
> **2026-09-14 à 15:25 UTC**, run `34861975638` du job `Edge deploy drift`, sur `main` :
> **« 8 fonction(s) verifiee(s) : le code deploye est celui du depot. »** Les trois lignes du
> tableau d'origine — `delete-account` v13, `renewal-notice` v9, `report-bug` v8 — ne décrivent
> plus la production. Elles sont conservées ci-dessous **à leur date**, parce que ce qu'elles
> enseignent ne périme pas : un push ne déploie aucune Edge Function, et le dépôt n'a jamais
> garanti ce qui s'exécute.
>
> 🔴 **Ce qui a réellement changé n'est pas le déploiement, c'est la MESURE.** Tant que
> `SUPABASE_ACCESS_TOKEN` manquait (posé le 2026-09-13 à 09:34 UTC), le job échouait chaque jour
> **sans jamais avoir comparé quoi que ce soit** — 14 fois. Un tableau tenu à la main aurait
> continué à vieillir en silence.

*État du 2026-09-03, conservé à sa date :*

| Fonction | Déployée | Ce qui tournait en production le 2026-09-03 |
|---|---|---|
| `delete-account` | v13, 2026-09-02 | Une variante **qui n'existait dans aucun commit** : elle portait les correctifs R-03 et R-06 du 09-02, mais avait **perdu** la purge symétrique de `friends` committée le 08-24. Elle aurait échoué à `src/rgpd-erasure.guard.test.ts`, qui est vert |
| `renewal-notice` | v9, 2026-08-26 | Le défaut **S-4**, que `faille.md` déclarait corrigé : expéditeur par défaut sur un domaine que Resend ne signera jamais |
| ~~`report-bug`~~ | ✅ **v11, 2026-09-12 à 23:08 UTC** | ✅ **S-4 refermé en production** : la version en ligne n'a plus de valeur par défaut pour l'expéditeur. Elle porte aussi le plafond de débit (C-31), l'allowlist de pièce jointe (C-32) et la distinction « auteur non résolu » (C-33). ⚠️ Le déploiement aurait coupé le formulaire si `BUG_REPORT_FROM` (M-29) manquait : **il ne manque pas**, mesuré juste après, l'appel atteint la validation du corps (`400`) et non `503 sender_not_configured` |

| # | À faire | Pourquoi c'est toi | Statut tenu dans |
|---|---|---|---|
| ~~M-30~~ | ~~**Déployer les fonctions restantes**~~ ✅ **FAIT.** Les **8** fonctions du dépôt sont en ligne et **identiques au dépôt**, mesuré par la garde et non à la main : run `34861975638` du 2026-09-14 à 15:25 UTC, « 8 fonction(s) verifiee(s) ». `delete-account` est en **v17** et `renewal-notice` en **v13** (2026-09-13). ⚠️ Le numéro ne se réutilise pas | Fait | `a-faire-code.md` C-35 |
| M-32 | **Envoyer un vrai signalement de bug depuis l'app**, après M-29 et M-30, et vérifier qu'il arrive sur `contact@thecosmo.app` avec le `Reply-To` du compte et la pièce jointe lisible | Envoyer un e-mail réel depuis le domaine est une action sortante. Et aucune sonde ne prouve qu'un e-mail **arrive** : il faut ouvrir la boîte. Complète M-27 | `a-faire-code.md` C-35 |
| ~~M-31~~ | ~~**Appliquer les migrations `137`, `138` et `139`**~~ ✅ **FAIT, les trois.** Ledger de production relu **en base** le 2026-09-14 : `139_rate_limits`, `138_evidence_survives_org_deletion` et `137_dependency_error_identifiers` y sont, toutes trois datées du 2026-09-12. ⚠️ Ce qu'il faut garder de cette ligne, et qui ne périme pas : le piège de la borne (`hits > p_limit`, jamais `>=`, sinon le compteur gèle sur la limite et le plafond ne refuse **jamais**), et la règle de relire le ledger **avant** d'appliquer — ce dépôt a déjà appliqué deux fois la même migration parce qu'une session voisine était passée avant | Fait | `a-faire-code.md` C-48, C-30, C-31 |
| ~~M-37a~~ | ~~**Déployer `stripe-org-refund`**~~ ✅ **FAIT, et redéployée depuis : v6 le 2026-09-14 à 15:24 UTC** (extraction du verrou anti-rejeu dans `_shared/refund-replay.ts`, C-65). La garde de dérive est **verte sur ce déploiement** — run `34861975638`, « 8 fonction(s) verifiee(s) : le code deploye est celui du depot » : pour la première fois, ce n'est pas une relecture qui l'affirme. Historique : **v2 le 2026-09-12, 22:05 UTC** (v1 à 21:53, reprise pour corriger un en-tête qui se disait encore « non déployée »). Vérifiée en ligne par ses propres réponses, pas par relecture du fichier : `GET` → `405 method_not_allowed`, `POST` + jeton anon → `401 Unauthorized`, les deux émis par le corps de la fonction, donc `npm:stripe` et les deux `_shared/` se chargent. `.github/edge-deploy.json` a perdu sa note `notDeployed` le même jour, faute de quoi la garde échoue — et elle a raison d'échouer. ⚠️ La clé de `.env` est une clé `sb_publishable_…` : la passerelle la refuse **avant** la fonction, et son 401 ressemble trait pour trait à celui de la fonction. Le test de fumée n'a de valeur qu'avec le jeton anon **au format JWT** | Le déploiement est passé par l'API Management (MCP Supabase), pas par la CLI | `a-faire-code.md` C-65, C-39 |
| **M-37b** | 🔴 **Jouer un remboursement réel contre le compte Stripe de TEST.** ✅ **Cible arbitrée le 2026-09-12 : `cosmoentreprise`** (7 membres, propriétaire `axellongatte2@gmail.com`), et les deux lignes définitives du journal fiscal sont **acceptées**. Deux gestes, dans cet ordre. **(1)** `npm run cosmo:login` **avec `axellongatte2@gmail.com`** — la session du CLI est **expirée**, et c'est ce qui bloque : sans elle je n'ai aucun jeton de propriétaire, donc aucun appel possible à `stripe-org-checkout` ni à `stripe-org-refund`, toutes deux réservées au propriétaire. ⚠️ Se connecter avec un AUTRE compte ne débloque rien : l'appel serait refusé en `403 forbidden`. **(2)** Ouvrir la session Stripe Checkout que je produirai et la payer avec la carte de test `4242 4242 4242 4242` : une saisie de numéro de carte ne se délègue pas à un agent, même en mode test. Ensuite je prends la suite et je vérifie **cinq** points : montant (mensuel entier / annuel au prorata), ligne compensatoire **négative** au journal + `verify_payment_chain()` toujours vraie, abonnement relu par l'écran, aucun second appel, et — **ajouté le 2026-09-14** — **un REJEU volontaire qui ne rend RIEN de plus**. Ce cinquième point est nouveau parce que le verrou qui le tient vient seulement d'être rendu testable et déployé (`_shared/refund-replay.ts`, v6, 10 cas dont un témoin) : son arithmétique est prouvée, son comportement **contre Stripe** ne l'est pas. ⚠️ La clé d'idempotence Stripe ne couvre PAS ce cas — elle expire, donc elle n'arrête que deux appels concurrents ; un rejeu à quelques minutes n'est arrêté que par ce verrou-là | La connexion attend un code reçu par e-mail (`CLAUDE.md` l'interdit explicitement à un agent), et la carte est une saisie de moyen de paiement | `a-faire-code.md` C-65, C-39 |
| **M-37c** | ⚠️ **Vérifier au tableau de bord Stripe que `charge.refunded` est bien SOUSCRIT sur l'endpoint webhook de test.** Le code du webhook traite **six** types d'events ; ce dépôt décrit l'endpoint comme enregistré pour **cinq**, et `charge.refunded` n'est arrivé qu'avec la v27 du 2026-09-06. Si l'event n'a pas été ajouté à l'endpoint avec elle, la branche est en ligne et **ne recevra jamais rien** : le journal fiscal montrerait un encaissement sans son remboursement, précisément le trou que `recordRefund` existe pour empêcher. **Une branche déployée n'est pas un event délivré.** À faire **avant** M-37b, sinon le test passera en semblant réussir | La liste des events souscrits n'est lisible qu'au tableau de bord ou avec `STRIPE_SECRET_KEY`, qui n'est ni dans `.env` ni exposée par le MCP | `a-faire-code.md` C-65 |

✅ **Depuis le 2026-09-04, ce tableau n'est plus un relevé fait à la main.** `npm run check:edge`
(job `Edge deploy drift`, quotidien) télécharge le bundle de chaque fonction en ligne et le compare
au dépôt : la prochaine dérive s'annoncera toute seule, avec le nom du fichier et la première ligne
qui diffère. Il faut **poser M-33** pour ça. Le tableau ci-dessus reste la mesure du 09-03,
remesurée le 09-04 pour `report-bug`, puis **le 2026-09-12 : celle-ci est passée en v11 et son
S-4 est refermé**.

⚠️ **Aucune donnée n'est perdue aujourd'hui par la ligne `delete-account`** : la migration 116 a
basculé `friends_friend_user_id_fkey` en `ON DELETE CASCADE` (remesuré le 2026-09-03), donc la
cascade fait le travail que le code déployé ne fait plus. Ce qui est cassé n'est pas la purge, c'est
le fait de **raisonner depuis un dépôt qui ne décrit pas la production**.

---

> **Règle de tenue de ce fichier.** Une ligne se retire quand le geste est fait, jamais quand il est
> planifié.
>
> ✅ **Retiré le 2026-09-14 : M-30, M-31 et M-22.** Les deux premiers sont des gestes FAITS, et
> mesurés plutôt que déclarés — les 8 Edge Functions sont en ligne **et identiques au dépôt** (run
> `34861975638`, « 8 fonction(s) verifiee(s) »), les migrations `137` `138` `139` sont au ledger de
> production, relu en base. Le troisième est une **décision prise et appliquée** depuis la mig.
> `138`, dont cette ligne décrivait encore le contraire.
> ⚠️ Les numéros M-22, M-30, M-31 et M-39 ne se réutilisent pas.
> 🔴 **Ce qu'on garde de M-31, parce que ça ne périme pas** : le piège de la borne de débit — le
> refus doit être `hits > p_limit`, **jamais `>=`**, sinon le compteur gèle sur la limite et le
> plafond ne refuse jamais. Et la règle qui l'accompagne : relire le ledger **avant** d'appliquer,
> pas seulement après. Ce dépôt a déjà appliqué deux fois la même migration parce qu'une session
> voisine était passée avant.
>
> ✅ **Retiré le 2026-09-12 : M-39** (« relever l'après sur le runner pour `/` »). Le geste est fait,
> et au-delà de ce qu'il demandait : le job `lighthouse` a rendu **quatre runs consécutifs, huit
> passes, toutes au-dessus de 90** (92·94, 91·95, 94·95, 96·93). `a-faire-code.md` C-12 est clos.
> ⚠️ Le numéro M-39 ne se réutilise pas : il reste lisible dans l'historique git et dans les commits
> qui le citent. Et un « fait » se coche **dans le fichier de statut** nommé en face, pas ici : ce
> fichier est une liste de courses, pas un tableau de bord.
