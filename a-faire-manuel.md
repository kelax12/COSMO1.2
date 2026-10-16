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


> 🗂️ **Allégé le 2026-10-11** (65 ko). Sont partis, **à l'identique**, dans
> **[`docs/archive/a-faire-manuel-jusqua-2026-10-11.md`](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md)** : les deux encarts de mise à jour (09-14, 09-20), les lignes de
> gestes **faits** (`M-11`, `M-12`, `M-22`, `M-30`, `M-31`, `M-33`, `M-33b`, `M-34`,
> `M-37a`, `M-45`, `M-46`, `M-57`, `M-62`…), l'état des Edge Functions au 2026-09-03 et le § 9.5.
> Les numéros `M-NN` ne se réutilisent jamais ; le dernier attribué est `M-77` (2026-10-13).

> 🔎 **Audit par mesure du 2026-10-16** (lecture seule : `gh secret list`, `supabase secrets list`, envs Vercel non déchiffrées, SELECT en prod, runs CI, git). Six lignes (sept avec `M-68`, fermée le même jour) dont le geste est **mesuré fait** sont parties **à l'identique** dans **[`docs/archive/a-faire-manuel-retires-2026-10-16.md`](./docs/archive/a-faire-manuel-retires-2026-10-16.md)**, avec la preuve de chacune : `M-29`, `M-41`, `M-42`, `M-58`, `M-59`, `M-61`. Les lignes restantes qui portaient un énoncé devenu faux ont été corrigées sur place (`M-14`, `M-60`, `M-68`, `M-69`, `M-71`). Tout ce qui se joue sur un appareil, une boîte mail, une console sans API ou une décision reste listé : **non vérifiable par agent** ne veut pas dire fait.

---

## Sommaire

| § | Domaine | Nature |
|---|---|---|
| [1](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#1-bloquant-absolu--rien-ne-sencaisse-avant) | Guichet et statut juridique | administratif |
| [2](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#2-bascule-stripe-live) | Stripe live | console + carte réelle |
| [3](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#3-secrets-à-poser) | Secrets | console |
| [4](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#4-réglages-de-console-supabase) | Supabase | clics |
| [5](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#5-décisions-qui-nappartiennent-quà-toi) | Décisions produit | arbitrage |
| [6](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#6-acquisition-et-seo) | Annuaires, Search Console | manuel, répétitif |
| [7](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#7-vérifications-quaucune-gate-ne-peut-faire) | Ce qu'il faut ouvrir soi-même | appareil réel |
| [8](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#8-déploiements-quun-git-push-ne-fait-pas) | 🔴 Edge Functions **et migrations** : le dépôt ≠ la production | ligne de commande |
| [9](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#9-angles-morts-du-2026-09-16--ce-que-seules-tes-mains-ferment) | 🕳️ **Angles morts du 2026-09-16**, versés le 2026-09-20 | M-45 → M-56, **12 gestes neufs** |
| [10](./docs/archive/a-faire-manuel-jusqua-2026-10-11.md#10-audit-juridique-du-2026-09-24--ce-que-le-code-ne-peut-pas-faire) | ⚖️ **Audit juridique du 2026-09-24** | M-62 → M-67, identité, préavis, DPA |
| [11](#11-audit-juridique-du-2026-10-13--violation-de-données-et-gestes-restants) | 🔴 **Audit juridique du 2026-10-13 : violation de données, délai 72 h** | M-68 → M-77 |

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
| M-13 | `VITE_TURNSTILE_SITE_KEY` | Vercel | Le CAPTCHA d'inscription | `ROADMAP-60J.md` |
| M-14 | `VITE_SENTRY_DSN` **au build** | Vercel et CI | ⚠️ Sans elle, Vite remplace la variable à la compilation, Rollup jette presque tout `@sentry/react`, et `check:bundle` mesure un artefact qui n'existe nulle part. La garde refuse désormais ce build, mais le réglage reste à tenir. 🔎 **Mesuré le 2026-10-16** : posée sur Vercel (Production et Preview, projet `cosmo.app`), **absente des secrets Actions** (`gh secret list`). Reste la moitié CI | `CLAUDE.md` |

> ✅ **PLUS AUCUN depuis le 2026-09-13.** (`M-29` aussi est sorti de ce tableau le 2026-10-16 : `BUG_REPORT_FROM` est posé depuis le 2026-08-29, `supabase secrets list`.) Les quatre secrets de ce tableau sont posés : ~~M-11~~ (`OPS_ALERT_WEBHOOK_URL`, depuis le 09-02, sans que ce tableau l'ait jamais vérifié), ~~M-33~~ (`SUPABASE_ACCESS_TOKEN`, 09-13), ~~M-34~~ (`RATE_LIMIT_SALT`, 09-12) et ~~M-12~~ (`CRON_SECRET`, 09-13). **Il n'y a plus un seul endroit où du code écrit, testé et committé ne produise rien en production.**
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
| **M-44** 🔴 | 🔴 **L'arbitrage a été rendu le 2026-09-15 CONTRE le retrait de la pastille « Aujourd'hui » du report rapide, et le retrait est entré dans `main` six jours plus tard.** Relu dans le code le **2026-09-21** : `src/components/task-table/OverdueQuickActions.tsx` à `HEAD` ne rend plus que « Demain » et « Choisir », et le commentaire qui porte l'argument démenti est commité (lignes 55-57), par `ab72cd39` (`feat(mobile): refonte UI mobile`, 2026-09-16) | ⚠️ **Ce n'est plus un geste manuel, et c'est précisément ce qu'il faut voir.** La ligne d'origine disait « défaire un fichier non commité d'une autre session » ; il n'y a plus rien à défaire dans l'arbre, il y a du **code à réécrire**. Ce qui reste à toi est la décision, parce que l'arbitrage du 09-15 portait sur un changement qui n'était alors dans aucun commit : soit on remet la pastille et on retire le commentaire, soit on rouvre l'arbitrage en sachant que `isOverdue` est **strictement** `< 0`, donc qu'une tâche qui affiche ces raccourcis n'est **jamais** due aujourd'hui. 🔴 **La leçon vaut plus que l'item** : un arbitrage rendu sur un fichier non suivi ne protège rien, et aucune garde ne pouvait le voir — le produit compile et la suite passe | `a-faire-code.md` C-72 |

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
| M-25 | **Ouvrir le produit sur un vrai téléphone** (iOS Safari et Android), en mode démo puis sur un vrai compte | La note mobile de 76/100 n'a **aucune** mesure hors viewport émulé. 🟠 **Tenté le 2026-09-03, audit A-4** : aucun appareil n'était accessible, donc seule la moitié indépendante de l'appareil a pu être jouée (viewport émulé + sondes). Elle a rendu deux findings de code, `a-faire-code.md` **C-56** (le haut des trois formulaires `FirstRunSetup`, `BugReportModal`, `InviteOrJoinModal` devient inatteignable clavier ouvert, mesuré à 375×350) et **C-57** (cibles tactiles à 16×16 px pour cocher une tâche sur `/dashboard`, 40×40 sur `/okr`) — et a écarté deux soupçons (le plancher 16px des champs tient déjà, la conversion jour/instant de la date mobile d'événement est correcte). **Rien de tout ça n'a été confirmé au doigt**, et le mécanisme de C-56 diffère entre Android (viewport de mise en page réduit, modélisé) et iOS (page qui défile à la place, pas testé). Chaque bug retenu doit porter le modèle, la version d'OS et le navigateur, sinon il n'est pas reproductible. Prompt prêt : `docs/archive/prompts/prompts-audits.md`, A-4 |
| M-40 | **Jouer la check-list VoiceOver iOS sur un iPhone**, d'une traite, en mode démo : [`docs/AUDIT-VOICEOVER-IOS.md`](./docs/AUDIT-VOICEOVER-IOS.md) (12 étapes, ~60 min, préparation comprise) | C'est le **quatrième** audit d'accessibilité de `C-24`, le seul que le 2026-09-03 n'a pas passé. Il ne se simule pas : ce que le dépôt prouve aujourd'hui, c'est le **focus**, jamais l'**annonce** (Playwright lit le DOM, pas l'arbre d'accessibilité comme un lecteur d'écran). Trois correctifs d'annonce (D4, D5, E2) ont été écrits **sans jamais avoir été entendus**. La check-list commence par un **témoin** : si le premier bouton n'annonce pas son `aria-label`, l'instrument est faux et rien de la suite ne compte. Chaque finding doit porter modèle, version d'iOS et **verbatim**. Se joue dans la même séance que M-25 |
| M-26 | **Vérifier une échéance sur un appareil réglé sur un fuseau à décalage NÉGATIF** | C'est là que le bug R-01 cassait, et c'est invisible depuis la métropole. 467 des 601 échéances de la prod portaient 00:00:00 UTC |
| M-27 | **Envoyer un e-mail de test vers un compte jetable Gmail ET Outlook** | Le DNS vert ne prouve pas la délivrabilité. Procédure dans `DEPLOYMENT.md` §2ter |
| M-28 | **Parcourir l'application au clavier seul**, souris débranchée | Un tiers de WCAG est invisible pour axe-core. Le 2026-08-30, les flèches ne déplaçaient pas le focus dans le calendrier depuis des semaines, et aucune gate ne pouvait le voir. Prompt prêt : `docs/archive/prompts/prompts-audits.md`, A-3 |
| M-35 | **Provoquer les vraies pannes, connecté à la vraie base** : mot de passe refusé, session expirée en cours d'usage, réseau coupé pendant une sauvegarde, et le claim d'un lien d'invitation hors ligne | 🔴 **L'audit A-7 n'a pas pu le faire** : le `.env` local ne porte aucune valeur Supabase, donc l'app locale tourne intégralement en mode démo, et la seule tentative de connexion rend « Supabase non configuré », qui mesure la configuration, pas le produit. Tous les chemins d'erreur réels de Supabase, de GoTrue et du réseau sont donc **non mesurés**. Le cas le plus payant est celui de `a-faire-code.md` **C-63** : hors ligne, un lien d'invitation valide doit-il vraiment s'annoncer « invalide » ? |
| M-36 | **Ouvrir Sentry et lire les alertes `api error non catalogué`** | `normalizeApiError` émet un `captureMessage` à chaque code d'erreur absent du catalogue — c'est-à-dire à chaque fois qu'un utilisateur réel a lu « Une erreur inattendue est survenue » sans que personne sache laquelle. C'est la seule source qui dise **quels** codes tombent vraiment en production. Aucune gate ne peut la lire à ta place : elle est derrière ton compte Sentry |
| M-38 | **Ouvrir `/` sur ton poste (avec GPU) puis sur un téléphone**, `prefers-reduced-motion` **désactivé** | Toute la mesure d'A-8 a été prise dans un Chromium qui rastérise en **logiciel** (SwiftShader) — la bonne condition pour expliquer le score de CI, **pas** celle d'un poste équipé d'un GPU. Le lancement d'un navigateur avec GPU a échoué dans cet environnement : la question reste ouverte, et il ne faut pas la refermer par déduction. Regarder si le scroll reste fluide et si la fenêtre produit tourne sans à-coups. Un téléphone d'entrée de gamme est plus proche du cas logiciel qu'un poste de bureau : c'est là que le coût se paie. Rejoint M-25 |

---

## 8. Déploiements qu'un `git push` ne fait pas

🔴 **Un push ne déploie ni Edge Function ni migration.** Un correctif committé, testé et vert peut
ne pas exister pour les utilisateurs. La dérive des Edge Functions est mesurée chaque jour par
`npm run check:edge` (job `Edge deploy drift`) ; les migrations, par `check:migration-coverage`.
❌ **Ne jamais réappliquer la mig. `164`** : elle est en prod hors ledger.

| # | À faire | Pourquoi c'est toi | Statut tenu dans |
|---|---|---|---|
| M-32 | **Envoyer un vrai signalement de bug depuis l'app**, après M-29 et M-30, et vérifier qu'il arrive sur `contact@thecosmo.app` avec le `Reply-To` du compte et la pièce jointe lisible | Envoyer un e-mail réel depuis le domaine est une action sortante. Et aucune sonde ne prouve qu'un e-mail **arrive** : il faut ouvrir la boîte. Complète M-27 | `a-faire-code.md` C-35 |
| **M-37b** | 🔴 **Jouer un remboursement réel contre le compte Stripe de TEST.** ✅ **Cible arbitrée le 2026-09-12 : `cosmoentreprise`** (7 membres, propriétaire `axellongatte2@gmail.com`), et les deux lignes définitives du journal fiscal sont **acceptées**. Deux gestes, dans cet ordre. **(1)** `npm run cosmo:login` **avec `axellongatte2@gmail.com`** — la session du CLI est **expirée**, et c'est ce qui bloque : sans elle je n'ai aucun jeton de propriétaire, donc aucun appel possible à `stripe-org-checkout` ni à `stripe-org-refund`, toutes deux réservées au propriétaire. ⚠️ Se connecter avec un AUTRE compte ne débloque rien : l'appel serait refusé en `403 forbidden`. **(2)** Ouvrir la session Stripe Checkout que je produirai et la payer avec la carte de test `4242 4242 4242 4242` : une saisie de numéro de carte ne se délègue pas à un agent, même en mode test. Ensuite je prends la suite et je vérifie **cinq** points : montant (mensuel entier / annuel au prorata), ligne compensatoire **négative** au journal + `verify_payment_chain()` toujours vraie, abonnement relu par l'écran, aucun second appel, et — **ajouté le 2026-09-14** — **un REJEU volontaire qui ne rend RIEN de plus**. Ce cinquième point est nouveau parce que le verrou qui le tient vient seulement d'être rendu testable et déployé (`_shared/refund-replay.ts`, v6, 10 cas dont un témoin) : son arithmétique est prouvée, son comportement **contre Stripe** ne l'est pas. ⚠️ La clé d'idempotence Stripe ne couvre PAS ce cas — elle expire, donc elle n'arrête que deux appels concurrents ; un rejeu à quelques minutes n'est arrêté que par ce verrou-là | La connexion attend un code reçu par e-mail (`CLAUDE.md` l'interdit explicitement à un agent), et la carte est une saisie de moyen de paiement | `a-faire-code.md` C-65, C-39 |
| **M-37c** | ⚠️ **Vérifier au tableau de bord Stripe que `charge.refunded` est bien SOUSCRIT sur l'endpoint webhook de test.** Le code du webhook traite **six** types d'events ; ce dépôt décrit l'endpoint comme enregistré pour **cinq**, et `charge.refunded` n'est arrivé qu'avec la v27 du 2026-09-06. Si l'event n'a pas été ajouté à l'endpoint avec elle, la branche est en ligne et **ne recevra jamais rien** : le journal fiscal montrerait un encaissement sans son remboursement, précisément le trou que `recordRefund` existe pour empêcher. **Une branche déployée n'est pas un event délivré.** À faire **avant** M-37b, sinon le test passera en semblant réussir | La liste des events souscrits n'est lisible qu'au tableau de bord ou avec `STRIPE_SECRET_KEY`, qui n'est ni dans `.env` ni exposée par le MCP | `a-faire-code.md` C-65 |

> **Règle de tenue de ce fichier.** Une ligne se retire quand le geste est fait, jamais quand il est
> planifié.

---

## 9. Angles morts du 2026-09-16 · ce que seules tes mains ferment

**Versé ici le 2026-09-20.** Les **23 sections « 🕳️ Angles morts »** posées le 2026-09-16 dans
`faille.md` et les 22 documents de `docs/`, plus les dix angles morts transversaux `T-1` → `T-10`
du tableau de bord, **n'étaient suivis nulle part**. Ils ont été triés selon ta règle : ce qu'une
modification du dépôt ferme est parti dans [`a-faire-code.md`](./a-faire-code.md) § 12 (`C-81` →
`C-110`, **30 items**) ; les **douze** ci-dessous n'ont pas d'autre porte que toi.

⚠️ **Aucun de ces douze n'est un défaut neuf.** Ce sont des gestes que les audits réclamaient déjà,
chacun à l'intérieur du document qui le réclamait, donc à l'endroit le moins susceptible d'être
relu au moment de décider quoi faire.

### 9.1bis Cinq gestes nés de la passe de gardes du 2026-09-21

**Versés ici le 2026-09-21.** Le commit `2b4c4304` a outillé les 28 items ouverts du § 12 de
[`a-faire-code.md`](./a-faire-code.md). Son propre message nomme ce qui reste, **et rien ne le
portait** : quatre de ces gardes ne mesurent rien tant que ces gestes ne sont pas faits.

🔴 **Une garde posée mais non alimentée est le pire des deux mondes** : elle occupe la place d'un
contrôle, et son verdict ne parle pas du produit. Deux d'entre elles échouent **exprès**, et il
faut le savoir avant de lire un run rouge.

| # | À faire | Pourquoi c'est toi | Statut tenu dans |
|---|---|---|---|
| **M-60** | **Trier les premières alertes CodeQL**, et le dater | 🔴 **Un job CodeQL vert ne ferme pas l'item** : il dit que l'analyse a tourné, pas que ce qu'elle a trouvé a été lu. Même famille que `vendor-watch` en août — l'alerte a fonctionné quatre jours pendant que personne ne l'ouvrait. 🔎 **Mesuré le 2026-10-16** : trois alertes triées le 2026-10-01 (`won't fix`), dix closes `fixed`, mais **une alerte ouverte non triée**, n° 14 `js/regex-injection`, apparue le 2026-10-15. Le tri n'est donc pas une case qu'on coche une fois | `a-faire-code.md` C-89 |

### 9.2 Trois chemins de récupération jamais parcourus

🔴 **Même famille, et le dépôt l'a déjà payée au prix fort** : la mig. `131` a rendu `/admin`
inaccessible deux jours parce que le chemin d'enrôlement TOTP n'avait jamais été ouvert.
**Un chemin de récupération qui n'a pas été parcouru est une hypothèse.**

| # | À faire | Pourquoi c'est toi | Statut tenu dans |
|---|---|---|---|
| **M-47** | **Éprouver le ROLLBACK une fois**, pour de vrai : repromouvoir le déploiement Vercel précédent, et dérouler la contrepartie côté Supabase. Relever le temps réel, et ce qui a manqué dans le runbook | Le runbook le décrit et **personne ne l'a jamais parcouru**. La partie automatisable est `restore-drill.yml`, dont la planification est `C-86` ; la promotion d'un déploiement Vercel est un geste de console, et la décision de rollback n'appartient qu'à toi | `docs/DEPLOYMENT.md` AM-2 |
| **M-48** | **Répéter à blanc la bascule Stripe live**, sur le compte de TEST : remettre à zéro les identifiants (mig. `140`), recréer les prix, réenregistrer le webhook avec ses **SIX** events, remplacer les secrets. Dans cet ordre, chronométré | La séquence n'a **jamais** été parcourue, et chaque étape manquante échoue **après** encaissement. Elle recoupe `M-43`, `M-06`, `M-07` et `M-08` : la répétition à blanc est ce qui transforme ces quatre lignes en une séquence éprouvée au lieu de quatre gestes espérés | `docs/STRIPE-LIVE.md` AM-4 |
| **M-49** | **Jouer à blanc la procédure de violation RGPD des 72 h**, une fois, et dater l'exercice dans `RGPD-VIOLATION.md` | La procédure n'a jamais été éprouvée, et elle se parcourt **sous 72 heures, en situation de panique**. ⚠️ Son second angle mort ne se ferme pas par cet exercice : le délai court à partir d'une **détection** que rien ne mesure, et un registre des violations VIDE ne distingue pas « aucune violation » de « aucune détection » | `docs/RGPD-VIOLATION.md` AM-1, AM-2, AM-3 |

### 9.3 Quatre mesures qu'aucun script ne prendra jamais

Elles complètent le § 7. Comme lui, elles ne produisent pas de correctif : elles produisent des
**findings**, qui rejoignent ensuite `a-faire-code.md`.

| # | À faire | Pourquoi aucune CI ne le remplace |
|---|---|---|
| **M-50** | **Relire la qualité des traductions `en`**, catalogue par catalogue, et dater la relecture | 🔴 Les trois gates mesurent les **clés** et les **copies**, jamais la **qualité** : `i18n:check` compare des clés, `i18n:identical` détecte un `en` recopié du `fr`. Une traduction **fausse mais différente** passe les trois sans un bruit, et elles sont vertes sur 3 898 couples. Aucun script ne lira l'anglais à ta place. Le volet outillable, le volume de texte par page et par locale, est `C-99` |
| **M-51** | **Passer la partie de WCAG qu'axe-core ne voit pas** : ordre de lecture, pertinence d'un libellé, sens porté par une couleur seule. Daté, écran par écran | Ce sont les critères **non automatisables par nature**, hors de portée de tout run vert. Ça recoupe `M-28` (clavier seul) et `M-40` (VoiceOver), sans les remplacer : `M-28` mesure l'atteignabilité, `M-40` l'annonce, et celle-ci le **sens**. Les trois se jouent dans la même séance |
| **M-52** | **Fixer une date à l'audit VoiceOver iOS, et la tenir** | 🔴 `AUDIT-VOICEOVER-IOS.md` écrit lui-même « rien dans ce fichier n'est coché », et son absence ne fait baisser **aucune** note : `ACCESSIBILITY.md` est noté sans que ce quatrième audit ait été passé. « À jouer » sans date se reconduit indéfiniment, et c'est ce qui s'est produit depuis le 2026-09-03. La check-list est prête, 12 étapes, témoin compris. L'exécution est `M-40` ; ce qui manque ici est **la date** |
| **M-53** | **Vérifier que `contact@thecosmo.app` REÇOIT vraiment**, en t'écrivant depuis une adresse extérieure, et relever le délai | `check:mail` vérifie SPF, DKIM et DMARC de l'**expédition sortante**. La **réception** n'est testée par rien, et c'est l'adresse publiée dans les mentions légales et dans le support. ⚠️ Distinct de `M-32`, qui prouve qu'un rapport de bug **part** ; celui-ci prouve qu'un message **arrive** |

### 9.4 Trois décisions qui n'appartiennent qu'à toi

| # | Décision | Ce qui en dépend | Statut tenu dans |
|---|---|---|---|
| **M-54** | **Fixer une échéance de rotation des secrets**, et la porter quelque part de vérifiable | Le § « Rotation des secrets » de `SECURITY.md` dit **comment** faire, jamais **quand**, et rien ne mesure l'âge d'un secret. Une échéance décidée rend l'item outillable (un job qui rappelle l'âge) ; sans elle il n'y a rien à outiller | `docs/SECURITY.md` AM-3 |
| **M-55** | **Relever les backlinks obtenus ET PERDUS**, et donner une date et un état à chaque action d'annuaire | 🔴 Aucun suivi des backlinks perdus, alors que c'est **le seul levier que `ACQUISITION-BACKLINKS.md` déclare débloquant**. Un lien retiré est aujourd'hui invisible. Complète `M-23` (soumettre) et `M-24` (relever dans Search Console) : celui-ci porte la **persistance**, pas l'obtention. La colonne d'état dans le tableau est `C-101` ; ce qui la remplit est toi | `docs/ACQUISITION-BACKLINKS.md` AM-1, AM-2, AM-3 |
| ~~**M-56**~~ 🟡 **RENDU EN PARTIE le 2026-09-21** | **Arbitrer ce que chacun des 77 angles morts COÛTE en points de note**, ou décider qu'on ne les note pas | ✅ **La moitié « classer les items » est faite** : [`a-faire-code-risques.md`](./a-faire-code-risques.md) est recoté sur les **111** items le 2026-09-21, et les huit qui restent ouverts portent chacun leur G × E, leur niveau et ce qui les débloque. 🔴 **Ce qui l'a rendue possible n'est pas une méthode, c'est un ménage** : 44 items étaient clos dans leur corps sans que leur titre le dise, et le tableau en cotait cinquante qui n'existaient plus. ❌ **La moitié qui reste est bien la tienne** : tarifer un angle mort **en points de note d'audit** n'a PAS été fait, et les 22 lignes encore ouvertes des tableaux « Angles morts » ne pèsent toujours sur aucune note. Classer des items et débiter une note sont deux gestes différents, et le second engage un jugement qui n'appartient qu'à toi | `docs/README.md` § 2026-09-21 · `a-faire-code-risques.md` |


---

## 10. Audit juridique du 2026-09-24 · ce que le code ne peut pas faire

> Le code et les textes ont été corrigés le même jour (détail : `docs/LEGAL.md` § « Audit du
> 2026-09-24 », et `docs/LEGAL-JOURNAL.md`). Restent six gestes qui n'appartiennent qu'à toi.
> ⚠️ Rien ici n'est un avis juridique.

| # | Geste | Pourquoi | Ligne |
|---|---|---|---|
| M-63 🔴 | **Envoyer le préavis de 30 jours** des CGU aux comptes existants : clauses 3.3 (âge), 6.3 (sous-traitance entreprise), 9 (responsabilité envers un professionnel) | CGU art. 11. Sans lui, ces trois clauses ne sont pas opposables aux inscrits d'avant le 2026-09-24. Les autres changements sont plus favorables et valent dès publication | E11, A13 |
| M-64 | **DPA** : accepter celui de **Sentry** (Legal & Compliance, rôle Owner), vérifier le plan **Vercel** (Hobby = pas de DPA, cf. `M-74`), archiver celui de **Vesk** (publié sur `veske.io/dpa`, applicable dès l'usage, relevé le 2026-10-13) et celui de **Resend**, et **Cloudflare** si Turnstile est activé. Archiver chaque copie datée. ⚠️ **Rien de tout cela n'attend l'immatriculation** (relu le 2026-10-13) : Sentry s'accepte en ligne par le propriétaire du compte | RGPD art. 28 et chap. V | A5, A6 |
| M-65 | **Téléphone des hébergeurs** (Vercel, Supabase) dans les mentions légales | LCEN 6-III-1. Aucun numéro public trouvé le 2026-09-24 : le demander à leur support | A3 |
| M-66 | **Conseil en propriété industrielle** sur le nom COSMO | Dossier prêt : `docs/MARQUE-COSMO.md` (relevé 2026-10-16, classes 9, 35, 42, FR + UE + Madrid). Avant d'investir davantage en acquisition | F1, F2 |
| M-67 | **Relecture juridique** des CGU réécrites (6.3 surtout) et qualification du **Data Act** | Rédigées par un assistant. Un acheteur B2B demandera un DPA séparé et signable | E11, A13, F8 |

## 11. Audit juridique du 2026-10-13 · violation de données et gestes restants

> Tout ce que le code pouvait corriger l'a été le même jour (`docs/LEGAL.md` § « Audit du
> 2026-10-13 », `docs/LEGAL-JOURNAL.md`). Restent ces gestes, **dans cet ordre**. Les détails de
> l'incident ne sont PAS dans ce dépôt public : ils sont dans `C:\Users\Axel\Documents\COSMO-coffre-hors-depot`
> (registre des violations, brouillons).
> ⚠️ Rien ici n'est un avis juridique.

| # | Geste | Pourquoi | Ligne |
|---|---|---|---|
| **M-69** 🔴 | **Décider de la notification à la CNIL avant le 2026-10-16 vers 11 h UTC** (72 h après la découverte), sur `notifications.cnil.fr`. 🔎 **Au 2026-10-16, le registre privé porte encore « Notifiée le : _à remplir_ »**, et le délai échoit ce jour : une notification tardive reste due et se fait accompagner des motifs du retard (art. 33.1). Recommandation de l'audit : **notifier**, quitte à compléter ensuite. Remplir « Notifiée le » au registre privé | RGPD art. 33. Nature et volume des données : registre privé. « Risque improbable » serait difficile à soutenir. Ne pas notifier se justifie par écrit, et ne se rattrape pas | A7 |
| **M-70** 🔴 | **Informer les personnes concernées** (art. 34) : un e-mail court, factuel, qui dit ce qui a été exposé, ce qui a été fait, et recommande de changer son mot de passe. Brouillon : `C:\Users\Axel\Documents\COSMO-coffre-hors-depot\INFO-PERSONNES-BROUILLON.md` | Recommandé par l'audit dès lors que des empreintes de mots de passe sont en cause. Message **distinct** du préavis `M-63` | A7 |
| **M-71** 🔴 | **Ranger la phrase secrète des sauvegardes** (`C:\Users\Axel\Documents\COSMO-coffre-hors-depot\BACKUP_PASSPHRASE.txt`) dans ton gestionnaire de mots de passe, en garder une copie hors ligne, puis **supprimer le fichier**. 🔎 **2026-10-16 : le fichier est toujours présent** dans le coffre | Sans elle, aucune sauvegarde ne se relit : elle est aussi le secret `BACKUP_PASSPHRASE` des Actions, mais un secret GitHub ne se relit pas | A9 |
| **M-72** | **Publier l'adresse et le téléphone de l'éditeur** dans les mentions légales : soit ton domicile maintenant, soit l'adresse de domiciliation après `M-01`/`M-02`. Un numéro dédié suffit | LCEN art. 1-1 (ex-6-III, loi SREN du 21/05/2024) : nom, domicile **et téléphone** pour une personne physique. L'anonymat n'est ouvert qu'aux non-professionnels, et la page de tarifs t'en sort | A3, E14 |
| **M-73** | **T'immatriculer avant de lancer l'acquisition** (`M-01`), même sans rien encaisser | Une activité annoncée avec publicité et tarifs est présumée lucrative (C. trav. L8221-4). Débloque aussi `M-72` (domiciliation) et la clause de juridiction des CGU (12.3) | B2 |
| **M-74** | **Vérifier le plan Vercel** (équipe « axellongattepro-3874's projects ») et passer en **Pro** si c'est Hobby | Hobby est réservé à un usage non commercial et n'est pas couvert par le DPA de Vercel. Non lisible par l'API | F11, A5 |
| **M-75** | **Glisser dans le préavis `M-63`** : la suppression des comptes inactifs depuis 3 ans, et un lien vers les CGU pour les comptes créés par Google depuis l'écran de connexion (ils ne les avaient jamais vues) | Rend le préavis plus utile, sans second e-mail | A15, E10 |
| **M-76** | **Faire qualifier le médiateur de la consommation pour un service gratuit** (payé en données), au moment de `M-67` | Certain dès qu'il y a vente ; discuté pour un service gratuit | E4, E14 |
| **M-77** | **Publier le rapport d'audit** (`docs/audits/AUDIT-JURIDIQUE-2026-10-13.md`, non commité) **après `M-68`** | Il décrit l'incident ; dans un dépôt public, il attend que les sessions soient révoquées | A9 |

❌ **Ne jamais réarmer `ENTERPRISE_BILLING_ENFORCED`** avant d'avoir aussi réglé E4 (médiateur),
E5 (portail de résiliation) et E13 (bouton de rétractation, directive 2023/2673).
