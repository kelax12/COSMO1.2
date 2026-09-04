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
| [8](#8-déploiements-quun-git-push-ne-fait-pas) | 🔴 Edge Functions déployées ≠ dépôt | ligne de commande |

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
| M-07 | Réenregistrer un **endpoint webhook live**, avec les 5 mêmes events | Console Stripe | `ROADMAP-60J.md` T-36 |
| M-08 | **Recette de bout en bout avec une vraie carte** : souscription mensuelle, changement de palier depuis le portail, résiliation, puis vérification de `org_subscriptions` et du journal `payment_records` | Le webhook et le checkout n'ont **jamais** traité un paiement réel. La résolution du prix annuel est le seul endroit où COSMO choisit un montant au lieu de se le faire désigner | `ROADMAP-60J.md` T-39 |
| M-09 | **Réarmer la facturation** : `ENTERPRISE_BILLING_ENFORCED = true` **et** `UPDATE billing_flags SET enabled = true WHERE key = 'enterprise_seat_limit'`, dans le même déploiement | Les deux drapeaux se déplacent **ensemble**. Serveur seul = un propriétaire se voit refuser une invitation sans qu'aucun écran ne lui propose de payer. Client seul = on encaisse sans rien débloquer | `ROADMAP-60J.md` T-38 |
| M-10 | ⚠️ **Tester le checkout entreprise depuis la PROD, jamais depuis `localhost:5173`** | `APP_URL` vaut `https://thecosmo.app` et c'est la seule origine CORS autorisée par les deux Edge Functions org | `CLAUDE.md` |

🔴 **Trois dettes de CODE tombent pile pendant cette bascule** et doivent être payées avant :
C-08 (remise à zéro des identifiants Stripe en base, invalidation du cache `productIndex`), C-30 et
**C-39** (les preuves L215-1 / L221-28 disparaissent en cascade, et n'importe quel admin peut
déclencher la cascade depuis l'écran). Détail dans [`a-faire-code.md`](./a-faire-code.md).

---

## 3. Secrets à poser

| # | Secret | Où | Ce qui reste inerte tant qu'il manque | Statut tenu dans |
|---|---|---|---|---|
| M-11 | `OPS_ALERT_WEBHOOK_URL` | Secrets **Actions** du dépôt GitHub | Le canal d'alerte d'ops. Il existe côté Supabase, pas côté GitHub : `ci-alert.yml` ne pousse donc rien. `vendor-watch.yml` a échoué quatre jours d'affilée sans que personne n'ouvre son issue, c'est exactement ce que ce canal existe pour empêcher | `a-faire-code.md` C-28 |
| M-12 | `CRON_SECRET` | Supabase **et** GitHub, **même valeur des deux côtés** | Les avis de reconduction tacite. Un avis non envoyé rend l'abonnement résiliable à tout moment, remboursement compris. Sans objet tant qu'aucun abonnement annuel n'existe, donc juste après M-08. **Mesuré le 2026-09-03** : la fonction déployée répond `503 cron_secret_not_configured` à tout appel, donc le secret n'est posé **nulle part**, et le travail quotidien n'a jamais tourné une seule fois | `ROADMAP-60J.md` T-40, `a-faire-code.md` C-34 |
| M-29 | `BUG_REPORT_FROM` | Supabase (`supabase secrets set`) | **Les deux** fonctions qui envoient un e-mail (`report-bug` et `renewal-notice`) lisent ce même secret. La valeur doit viser `send.thecosmo.app`, jamais la racine `thecosmo.app`, que Resend ne signera jamais. ⚠️ Une fois le déploiement M-30 fait, les deux fonctions n'ont **plus de valeur par défaut** et répondent `503 sender_not_configured` : M-30 sans M-29 coupe le formulaire de signalement de bug | `a-faire-code.md` C-35 |
| M-13 | `VITE_TURNSTILE_SITE_KEY` | Vercel | Le CAPTCHA d'inscription | `ROADMAP-60J.md` |
| M-14 | `VITE_SENTRY_DSN` **au build** | Vercel et CI | ⚠️ Sans elle, Vite remplace la variable à la compilation, Rollup jette presque tout `@sentry/react`, et `check:bundle` mesure un artefact qui n'existe nulle part. La garde refuse désormais ce build, mais le réglage reste à tenir | `CLAUDE.md` |

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
| M-22 | **Un admin non propriétaire doit-il pouvoir supprimer l'entreprise ?** | Aujourd'hui oui, et la suppression emporte l'abonnement et les preuves légales. Le code peut appliquer n'importe laquelle des deux réponses, mais c'est un choix produit | `a-faire-code.md` C-39 |
| M-33 | **Quand planifier la migration React 19 + `react-router` 8** | Ce n'est plus une urgence sécurité (audit A-6, C-58 : les deux CVE citées par `faille.md` sont déjà fermées par la version installée). Le chiffrage est nettement plus léger que redouté (0,5 à 1 jour + moins d'une heure, cf. `docs/MIGRATION-REACT19.md` §5) faute de rupture réelle dans ce code. C'est désormais un arbitrage de priorité ordinaire, pas un blocage | `a-faire-code.md` C-58, `docs/MIGRATION-REACT19.md` |

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
| M-39 | **Relever l'après sur le runner** : relancer le job `lighthouse` et inscrire **deux passes** de `/` dans l'item. ✅ Le correctif C-67 est poussé depuis le 2026-09-03 (commit `9fe263e`), il n'y a plus qu'à relancer | La règle du dépôt tient : une mesure locale ne fait pas foi **entre deux pages**, la charge machine y domine tout. L'avant est déjà pris (56-63, TBT 546 à 1 633 ms, 2026-09-02, deux passes), donc il n'y a plus qu'à refaire le même geste après |

---

## 8. Déploiements qu'un `git push` ne fait pas

🔴 **Ajouté par l'audit A-1, le 2026-09-03, et c'est son résultat le plus lourd.** Les trois sources
Edge Functions **réellement déployées** ont été lues via l'API de management et comparées à `main` :
**les trois divergent, de trois façons différentes**. Un push ne déploie aucune Edge Function, donc
un correctif committé, testé et vert peut ne pas exister pour les utilisateurs.

| Fonction | Déployée | Ce qui tourne en production aujourd'hui |
|---|---|---|
| `delete-account` | v13, 2026-09-02 | Une variante **qui n'existe dans aucun commit** : elle porte les correctifs R-03 et R-06 du 09-02, mais elle a **perdu** la purge symétrique de `friends` committée le 08-24. Elle échouerait à `src/rgpd-erasure.guard.test.ts`, qui est vert |
| `renewal-notice` | v9, 2026-08-26 | Le défaut **S-4**, que `faille.md` déclare corrigé : expéditeur par défaut sur un domaine que Resend ne signera jamais |
| `report-bug` | v8, 2026-08-29 | Le **même** défaut S-4, sur la fonction jumelle. Le correctif est committé depuis le 2026-09-03, donc **seul le déploiement manque** |

| # | À faire | Pourquoi c'est toi | Statut tenu dans |
|---|---|---|---|
| M-30 | **Déployer les trois fonctions** : `supabase functions deploy delete-account`, puis `report-bug`, puis `renewal-notice`. Vérifier ensuite que le numéro de version a bien augmenté pour les trois | La commande demande les identifiants Supabase du projet. ⚠️ Faire M-29 dans la même séance, sinon le formulaire de bug répond `503` | `a-faire-code.md` C-35 |
| M-32 | **Envoyer un vrai signalement de bug depuis l'app**, après M-29 et M-30, et vérifier qu'il arrive sur `contact@thecosmo.app` avec le `Reply-To` du compte et la pièce jointe lisible | Envoyer un e-mail réel depuis le domaine est une action sortante. Et aucune sonde ne prouve qu'un e-mail **arrive** : il faut ouvrir la boîte. Complète M-27 | `a-faire-code.md` C-35 |

⚠️ **Aucune donnée n'est perdue aujourd'hui par la ligne `delete-account`** : la migration 116 a
basculé `friends_friend_user_id_fkey` en `ON DELETE CASCADE` (remesuré le 2026-09-03), donc la
cascade fait le travail que le code déployé ne fait plus. Ce qui est cassé n'est pas la purge, c'est
le fait de **raisonner depuis un dépôt qui ne décrit pas la production**.

---

> **Règle de tenue de ce fichier.** Une ligne se retire quand le geste est fait, jamais quand il est
> planifié. Et un « fait » se coche **dans le fichier de statut** nommé en face, pas ici : ce
> fichier est une liste de courses, pas un tableau de bord.
