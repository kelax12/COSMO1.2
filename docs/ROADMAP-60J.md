# Roadmap 60 jours — du lancement à 10 000 utilisateurs

**Établie le 2026-08-27, consolidée le 2026-08-28, dédoublonnée le 2026-08-30.** Source de vérité
unique du travail des 60 prochains jours (2026-08-28 → 2026-10-26). Elle consolide les dix audits
vivants du dépôt, les confronte au code de `main` et à la production `ykeugqfgklejcdbrmawy`, et ne
garde que ce qui reste à faire.

> **Ce document ne remplace aucun audit.** `faille.md` reste la source de vérité sécurité,
> `docs/LEGAL.md` la source de vérité juridique. Cette roadmap dit **quoi faire, dans quel ordre,
> par qui**. Quand un audit et cette roadmap se contredisent sur un *fait*, l'audit gagne ; sur
> une *priorité*, cette roadmap gagne.

### Règles d'entretien

1. 🔴 **Un seul endroit porte l'état d'une tâche : le tableau du §1.** Le §2 porte le calendrier et
   une case cochée, jamais une date ni un récit ; le §3 des décisions, le §4 des interdits, le §6
   le journal daté. En cas de contradiction, **le §1 gagne**. C'est la correction du 2026-08-30 :
   sept sections portaient un statut pour la même tâche, elles avaient divergé, et rien ne disait
   laquelle faisait foi (T-13 était « fait » dans quatre sections et « restant » dans une
   cinquième).
2. **On coche au moment où le critère « Done » est vérifié**, pas quand le code est écrit. Une
   migration écrite n'est pas une migration appliquée : c'est la leçon du 2026-08-27, elle vaut
   pour toute cette roadmap.
3. **Une tâche faite n'est jamais retirée** : elle est cochée au §1 et racontée au §6. Le fil de ce
   qui s'est passé compte autant que la liste de ce qui reste, c'est lui qui empêche de refaire un
   travail déjà fait ou de croire fait un travail seulement écrit.
4. **Recompter par script, jamais de tête.** Trois erreurs de comptage documentées en trois jours
   dans ce dépôt. Un total ne prouve rien.

---

## 1. Tableau récapitulatif — 52 tâches, la seule table qui porte un statut

**Décompte au 2026-08-30**, recompté **par script** sur les tableaux ci-dessous, jamais de tête.

| | Nombre | Lesquelles |
|---|---|---|
| ✅ Fait et vérifié | **26** | T-03 · T-04 · T-07 · T-08 · T-10 · T-11 · T-12 · T-13 · T-16 · T-18 · T-19 · T-20 · T-24 · T-25 · T-26 · T-28 · T-29 · T-30 · T-31 · T-42 · T-44 · T-45 · T-46 · T-48 · T-49 · T-50 |
| 🟡 Partiel | 6 | T-05 · T-06 · T-14 · T-23 · T-41 · T-51 |
| ⚪ Clos sans suite | 3 | T-01 · T-04b · T-27 |
| ⬜ Ouvert | **17** | T-02 · T-09 · T-15 · T-17 · T-21 · T-22 · T-32 · T-33 · T-34 · T-35 · T-36 · T-37 · T-38 · T-39 · T-40 · T-43 · T-47 |

> Ce décompte est le seul résumé du document, et il vit **collé à sa source**. La version
> précédente le tenait 500 lignes plus haut, dans une section qui avait cessé d'être mise à jour :
> c'est ainsi qu'une tâche pouvait être « faite » ici et « restante » ailleurs.

Priorité : **P0** bloque le lancement · **P1** risque important · **P2** rapidement après ·
**P3** optimisation · **P4** nice to have.
Effort : **XS** <1 h · **S** 1-3 h · **M** 3-8 h · **L** 1-2 j · **XL** 3-5 j · **XXL** >5 j.
Piste : **A** = agent backend/infra/sécu · **B** = agent front/UX/tests · **X** = Axel seul.

**Angles morts** cités par la colonne « Pourquoi ». Ce sont les cinq trous trouvés en production
le 2026-08-27, que les dix audits vivants avaient tous manqués. Leur état se lit sur la tâche qui
les porte, jamais ici.

| # | Ce que c'est | Tâche qui le referme |
|---|---|---|
| AM-1 | Aucun SMTP applicatif pour Supabase Auth, et aucune vérification d'adresse à l'inscription | T-03, T-04b |
| AM-2 | La fonction `report-bug`, seul canal de support, n'était pas déployée en production | T-12 |
| AM-3 | Aucune protection anti-bot sur l'inscription | T-14 |
| AM-4 | Aucune surveillance de disponibilité : personne n'est prévenu si le site tombe | T-17 |
| AM-5 | `tmp-org-price-setup`, fonction temporaire déployée et absente du dépôt | T-18 |

### PHASE 1 — Avant d'ouvrir l'acquisition

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| ✅ T-48 | Tests / QA | **Job CI `e2e` rouge** : l'Aperçu entreprise a été renommé le 2026-08-27, le test cherchait encore l'ancien titre | La CI verte est une condition du GO. Rouge depuis 4 jours, personne n'a regardé | P1 | XS | — | B | S3 |
| ✅ T-49 | Tests / QA | **Job CI `rls-integration` VERT le 2026-08-29** : ~~4 cas échouent sur base vierge alors que la logique est correcte en prod~~. **Cause trouvée et mesurée le 2026-08-29** : le test appelait `.insert(...).select()`, donc une RELECTURE soumise à `can_access_team_project(id)`, qui cherche en table une ligne pas encore visible. Ni la base ni les migrations n'étaient en cause. Une seconde cause, indépendante, attendait derrière : `org-invitations.test.ts` écrivait une colonne `status` qui n'existe pas. Les deux corrigées, **le job passe** | ~~Écart dépôt rejoué / prod~~ · Le vrai enseignement : **le test n'éprouvait pas le chemin du produit**, que `createProject` documente depuis le bug #9 | P1 | M | ~~Docker~~ | A | S3 |
| ✅ T-50 | Tests / QA | **Job CI `lighthouse`** : deux causes, trouvées sans `gh auth login`. (1) le bac à sable de Chrome, qu'Ubuntu 24.04 empêche de démarrer → `--no-sandbox` ; (2) Lighthouse mesurait `/guide/index.html`, une URL que le routeur ne connaît pas, donc la page 404 de la SPA, marquée `noindex` : SEO 0,66 au lieu de 1,00 | Idem : gate du GO. ~~Demande la lecture du log du run~~ — les **annotations** d'un run sont publiques, elles, et elles ont suffi | P2 | S | — | A | S3 |
| ⚪ T-01 | Infrastructure | **ÉCARTÉ SCIEMMENT — décision d'Axel du 2026-08-29 : on reste en plan Free le plus longtemps possible.** Mesuré avant de trancher : Pro = 25 $/mois, **PITR = 100 $/mois de plus**, pour une base de 19 Mo dont ~2,5 Mo de données réelles et 28 comptes. La dépense n'est pas justifiée à ce volume. **Compensation posée le soir même : T-46 passe en quotidien et devient la SEULE sauvegarde** (le Free n'en offre aucune). Ce qui reste non couvert et doit être dit : pas de restauration en un clic, pas de point-dans-le-temps, RPO de 24 h, aucun SLA, logs conservés 24 h. **Seuils de réouverture** : egress > 3 Go/mois sur les 5 Go inclus, ou le premier client payant | ~~P0~~ | XS | — | X | ~~S1~~ |
| T-02 | Fiabilité | **Reformulé le 2026-08-29** : le drill ne restaure plus un PITR (écarté, cf. T-01) mais **le dump quotidien** de T-46, vers un projet jetable, chronométré. ⚠️ Le plan Free plafonne à **2 projets actifs** : le jetable se supprime juste après. Un backup non testé n'est pas un backup, et il l'est d'autant moins qu'il est désormais le seul 🟡 **Outillé le 2026-08-30** : `.github/workflows/restore-drill.yml` restaure le dump dans GitHub Actions (le poste n'a ni client Postgres ni Docker), chronomètre, et juge sur l'isolation autant que sur les volumes : 0 table publique sans RLS, et un utilisateur qui ne voit que ses tâches. Trois gardes avant toute connexion, dont le refus de la production par l'hôte ou par l'utilisateur, testées sur cinq cibles. **Reste, et c'est entièrement hors du dépôt** : créer le projet jetable, poser `DRILL_DB_URL`, lancer, reporter le chronomètre, supprimer le projet et le secret. | **P0** | M | ~~T-01~~ T-46 | X + A | S2 |
| ✅ T-03 | Emails | ~~Configurer un SMTP applicatif (Resend) pour **Supabase Auth**~~ **FAIT le 2026-08-29**, `check:mail` vert (DKIM, SPF et MX du Return-Path sur `send.send.thecosmo.app`), email reçu depuis `noreply@send.thecosmo.app`, limite d'envoi portée à 100/h. Configurer un SMTP applicatif (Resend) pour **Supabase Auth** : sous-domaine d'envoi `send.thecosmo.app` vérifié, clé SMTP posée dans Supabase, limite d'envoi horaire relevée | AM-1. Sans lui l'inscription casse dès la première vague de trafic. ⚠️ Le sous-domaine est obligatoire : la racine porte les MX et le SPF d'IONOS qui servent `contact@` | P0 | M | — | **X** (préparé : runbook, gabarits, garde) | S1 |
| ✅ T-04 | Emails | ~~Coller les 4 gabarits d'email dans le Dashboard~~ **fait le 2026-08-29** | ✅ **Écrits** (`supabase/templates/`, en français). Ils ne se déploient pas depuis le dépôt : `config push` n'est pas le workflow de ce projet | P1 | XS | T-03 | X | S2 |
| ⚪ T-04b | Sécurité | **CLOS SANS CHANGEMENT — décision d'Axel du 2026-08-29 : trop de friction à l'inscription**, sur un produit dont le problème mesuré est l'activation. Risque accepté, pas oublié : détail, conditions de réouverture et état du front dans `faille.md` § G-2. ~~Activer *Confirm email*~~ | Ferme la porte à l'inscription avec l'adresse d'un tiers et aux comptes injoignables. ✅ Le front est prêt : `AuthForm` affiche « Vérifiez votre boîte mail » au lieu de pousser l'inscrit vers un écran protégé qui le rejetterait | P1 | XS | T-03, T-04 | X | S2 |
| 🟡 T-05 | Sécurité | **Minimum 12 caractères posé le 2026-08-29** (déclaré : aucun réglage Auth n'est lisible depuis le dépôt). Aligné sur `MIN_PASSWORD_LENGTH`, et l'aide des Réglages, restée à 8 en fr comme en en, a été corrigée dans la foulée : la constante avait été centralisée, pas le TEXTE. **Coupée en deux le 2026-08-29.** Minimum 12 caractères : faisable, à faire. « Leaked password protection » : 🔴 **réservée au plan Pro** (« available on the Pro Plan and above »), donc **hors de portée tant qu'on reste en Free** ; l'advisor restera rouge et ce n'est pas un oubli | A-10, encore ouvert : l'advisor `auth_leaked_password_protection` est toujours remonté par la prod le 2026-08-27 | P0 | XS | — | X | S1 |
| 🟡 T-06 | Sécurité | **Coupée en deux le 2026-08-29, l'énoncé était faux.** (a) ✅ **2FA posée sur le compte Supabase d'Axel le 2026-08-29** (application d'authentification ; cette page n'offre aucun code de récupération, la clé d'amorçage EST la sauvegarde). Protège la console et la base. (b) **Code livré le 2026-08-30, en attente de la mig. `131`.** `is_admin()` exige désormais `admin_allowlisted()` ET une session `aal2`, et `/admin` monte un écran d'enrôlement TOTP puis un défi (`AdminMfaGate`). Ce qui ferme la tâche, et rien d'autre, **dans cet ordre** : déployer le front, enrôler un authentificateur, appliquer la `131`, puis vérifier que `/admin` rend ses chiffres. Dans ce sens, aucune fenêtre d'indisponibilité. | `/admin` expose toute la volumétrie business et n'est protégé que par un mot de passe | P0 | (a) XS · (b) M | — | (a) X · (b) A + B | S1 |
| ✅ T-07 | Sécurité | ~~Vérifier l'allowlist de redirection OAuth~~ **fait le 2026-08-29**. Deux jokers `cosmoapp-*-…vercel.app` conservés sciemment : le suffixe appartient au compte Vercel d'Axel, et `flowType: 'pkce'` rend le `code` inexploitable par une autre origine. **Un manque a été trouvé au passage** : `/reset-password` n'était PAS dans la liste alors que `ForgotPasswordPage` le demande, donc les resets retombaient sur la Site URL. Ajouté | Un wildcard trop large annule une partie du bénéfice de PKCE | P1 | XS | — | X | S1 |
| ✅ T-08 | Sécurité | ~~Activer « Secure email change »~~ **fait le 2026-08-29** (déclaré). Le réglage vit dans le fournisseur **Email** de *Sign In / Providers*, pas dans le bloc *User Signups* | Prise de contrôle de compte par changement d'email | P1 | XS | — | X | S1 |
| T-09 | Sécurité | Activer le secret scanning GitHub + vérifier la non-réutilisation du mot de passe `DATABASE_URL` historique | Le dépôt est **public** | P1 | XS | — | X | S1 |
| ✅ T-10 | Base de données | ~~Appliquer la **mig. 130** en prod~~ **faite le 2026-08-29**, vérifiée en base acteur par acteur : membre simple 0 ligne (avant : toutes), témoin 0, inviteur/destinataire/admin 2 lignes. `check:drift` propre derrière | G-1 : tout membre lit aujourd'hui les invitations refusées de ses collègues. ⚠️ **Corrigé le 2026-08-29** : `npm run test:rls` ne prouve RIEN sur la prod, il tourne contre une base vierge où la 130 est toujours appliquée. Son rouge venait d'une colonne `status` inventée par le test, pas d'une migration manquante | P1 | XS | — | X applique / A vérifie | S1 |
| ✅ T-11 | Base de données | `npm run check:drift` après la 130, et consigner le résultat | Après chaque migration appliquée, sans exception | P1 | XS | T-10 | A | S1 |
| ✅ T-12 | Support | **FERMÉ le 2026-08-29.** Fonction déployée, secrets posés (`RESEND_API_KEY`, `BUG_REPORT_FROM`, `BUG_REPORT_TO`), et **envoi réel réussi en production** : un signalement de test a été accepté par Resend (`{"ok":true}`) et reçu sur `contact@thecosmo.app`. Le repli `mailto` n'est plus le chemin normal, il redevient ce qu'il doit être : un repli | AM-2. Seul canal de support du produit | P1 | XS | T-03 | A + X | S1 |
| ✅ T-13 | Monitoring | ~~Poser `OPS_ALERT_WEBHOOK_URL`~~ **fait le 2026-08-29** (webhook Discord). Prouvé de bout en bout : un appel réel à `renewal-notice` a fait partir l'alerte dans le salon. Confirmé une seconde fois par la pose du secret elle-même, qui a redéployé les 6 autres fonctions | `alert.ts` est un no-op silencieux aujourd'hui : un webhook Stripe en échec ou une purge RGPD avortée ne réveillent personne | P1 | XS | — | X | S1 |
| 🟡 T-14 | Sécurité | **Code livré le 2026-08-28, inerte.** Reste : créer le widget Cloudflare, poser `VITE_TURNSTILE_SITE_KEY`, puis activer côté Supabase. Activer un CAPTCHA (Cloudflare Turnstile) sur inscription et reset de mot de passe | AM-3. Se pose côté Supabase Auth + un champ dans le formulaire | P1 | S | T-03 | A + B | S2 |
| T-15 | Analytics | Valider la chaîne `?ref=` de bout en bout : ouvrir `https://thecosmo.app/?ref=test_manuel`, créer un compte jetable, vérifier `profiles.acquisition_source = 'test_manuel'`, puis supprimer le compte | 28 comptes, **0** avec une source. On ne sait toujours pas si la chaîne marche ou si personne n'est passé par un `?ref=`. Lancer une campagne sur une chaîne jamais validée est le gaspillage le plus cher possible | P0 | S | T-03 | X | S2 |
| ✅ T-16 | Monitoring | Vérifier que `VITE_SENTRY_DSN` est bien posé sur Vercel et qu'une erreur de test remonte | Le monitoring est désactivé en silence si la variable manque. Jamais vérifié depuis le dépôt | P1 | XS | — | X | S1 |
| T-17 | Monitoring | Brancher une sonde de disponibilité externe (UptimeRobot / Better Stack, palier gratuit) sur `/` et sur `auth/v1/health` | AM-4. **Palliatif en place depuis le 2026-08-29** (`uptime.yml`), qui ne dispense pas : une sonde hébergée chez GitHub ne détecte pas une panne de GitHub, et son cron dérive | P2 | XS | — | X | S2 |
| ✅ T-18 | DevOps | ~~Supprimer la fonction `tmp-org-price-setup`~~ **faite le 2026-08-29**, vérifiée : 7 fonctions en prod, elle n'y est plus, l'appel rend `404 NOT_FOUND` (avant : `410`) | AM-5, artefact non versionné dans la surface exposée. ⚠️ **Ne peut pas être fait par un agent** : le MCP Supabase déploie et lit des fonctions, il n'en supprime aucune. Le seul autre chemin est `supabase functions delete`, qui exige un jeton d'accès personnel. Geste d'Axel, 2 minutes | P3 | XS | — | X | S2 |
| ✅ T-19 | Tests | Committer les trois fichiers non suivis (`e2e/rls/org-invitations.test.ts`, `e2e/reduced-motion-sheets.spec.ts`, `src/modules/team-projects/hooks.background.test.tsx`) et les 12 docs modifiés | Du travail vérifié qui n'est pas dans `main` n'existe pas, et une autre session peut l'emporter dans son propre commit | P1 | XS | — | X | S1 |
| ✅ T-20 | UX / Produit | Passer les deux drapeaux de facturation en revue **avant** d'ouvrir l'acquisition et confirmer qu'ils sont bien à `false` des deux côtés (`ENTERPRISE_BILLING_ENFORCED` + `billing_flags.enterprise_seat_limit`) | Ils ont basculé trois fois en douze heures le 2026-08-25. L'état se lit dans le code et en base, jamais dans un document | P0 | XS | — | A | S2 |

### PHASE 2 — 0 → 100 utilisateurs

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| T-21 | Acquisition | Soumettre COSMO aux 20 premiers annuaires de `ACQUISITION-BACKLINKS.md`, dans l'ordre donné, et tenir le tableau de suivi | **Le seul levier qui débloque le SEO.** Position 88 sur les requêtes non-marque = 0 domaine référent. Aucun contenu ne compensera | P1 | XL | — | X | S3-S5 |
| T-22 | SEO | Relever dans Search Console : type de propriété (domaine ou préfixe), nombre de pages réellement indexées, et connecter Ahrefs Webmaster Tools pour compter les domaines référents | On pilote le SEO sans savoir combien de pages sont indexées. 13 impressions pour 20 URLs laisse l'hypothèse ouverte | P1 | S | — | X | S3 |
| 🟡 T-23 | UX / Produit | ⚠️ **L'instrumentation EXISTAIT DÉJÀ** (`get_admin_stats` v3 → `/admin` : activation 24 h, activation 48 h par canal, rétention J+7 par cohorte). Reste la correction seule. Instrumenter et corriger l'activation : **0 compte actif sur 7 jours** pour 28 comptes. Identifier le décrochage (première tâche créée ? deuxième session ?) et traiter le premier écran après inscription | Le vrai problème produit du dossier. Acquérir des utilisateurs qui ne reviennent pas est un coût, pas un progrès | P1 | L | T-15 | B | S3-S4 |
| ✅ T-24 | Fiabilité | Détection de nouvelle version pour les onglets jamais rechargés (bannière « une mise à jour est disponible ») | **91,5 % du trafic Supabase du 2026-08-26 venait de deux onglets exécutant un bundle périmé.** Sans ce mécanisme, tout correctif client n'atteint que ceux qui rouvrent l'application, et les utilisateurs les plus assidus sont les plus coûteux | P2 | M | — | B | S4 |
| ✅ T-25 | UX / Produit | Barre d'onglets entreprise sur mobile : 4 destinations sur 7 hors écran, aucun indice de continuation | P1 de la critique UI du 2026-08-27. Le mode entreprise est l'offre qui se vend | P2 | M | — | B | S4 |
| ✅ T-26 | UX / Produit | Unifier les deux grammaires de filtre entre les onglets « Tâches » et « Projets » | Même donnée, deux façons de la filtrer. Second P1 de la même critique | P2 | M | — | B | S5 |
| ⚪ T-27 | UX / Produit | **CLOS sans changement** (arbitrage Axel, 2026-08-28) : la répétition est assumée, le titre était déjà corrigé. `buildOrgEvents` : exclure `currentUserId` de la frise « entreprise », et corriger le titre contradictoire | La frise répète les tâches déjà affichées juste au-dessus | P3 | S | — | B | S5 |
| ✅ T-28 | Performance | Resserrer les seuils Lighthouse après le premier run réel en CI. **Fait le 2026-08-29**, le run existe enfin | Ils sont provisoires et posés au-dessus du réel : un budget très au-dessus du réel ne mesure rien | P2 | S | — | A | S3 |
| ✅ T-29 | Performance | Ramener le chunk d'entrée sous 92 ko gzip et **redescendre le plafond** de `check:bundle` | 87,2 → 106,9 ko en deux jours, plafond relevé de 92 à 112 pour l'absorber. C'est le seul plafond du dépôt qu'on ait jamais remonté ; tant que la marge se regagne en relevant la barre, le budget ne garde plus rien | P2 | M | — | B | S4 |
| ✅ T-30 | Legal | Publier les durées de conservation dans la politique de confidentialité (90 j visite démo, 400 j activité et démo convertie, 90 j marqueurs Stripe) | Dernier point du dossier RGPD qui n'attend plus rien d'autre que d'être écrit, et il débloque la réponse à un acheteur B2B | P2 | XS | — | B | S3 |
| ✅ T-31 | Support | Écrire la procédure de support : qui répond, sous quel délai, où arrivent les signalements, gabarit de réponse | À 100 utilisateurs le support devient réel. Un canal sans procédure devient un canal ignoré | P2 | S | T-12 | X | S4 |

### PHASE 3 — 100 → 1 000 utilisateurs

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| T-32 | Legal | **Immatriculation micro-entreprise au guichet unique INPI** | Bloquant absolu de tout encaissement. Encaisser avant l'immatriculation est du travail dissimulé | P1 | M | — | X | S5 |
| T-33 | Legal | Choisir et signer une société de domiciliation | Décision prise le 2026-08-26, exécution en attente. Conditionne B2 | P1 | S | — | X | S5 |
| T-34 | Legal | Adhérer à un médiateur de la consommation et publier ses coordonnées dans les CGV | Adhésion payante et **obligatoire**, oubli classique sanctionné par la DGCCRF | P1 | S | T-32 | X | S6 |
| T-35 | Paiement | Configurer le portail client Stripe (annulation d'abonnement activée) sur les **deux** comptes, test et live | E5 : `/v1/billing_portal/configurations` renvoie vide sur les deux comptes. **Le bouton existe, la résiliation ne marche pas** — et la landing promet « résiliable à tout moment » | P1 | XS | — | X | S6 |
| T-36 | Paiement | Basculer Stripe en compte **live** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, les 4 `STRIPE_ORG_PRICE_*` mensuels, endpoint webhook live avec les 5 mêmes events | La prod COSMO tourne sur une clé de TEST depuis le début : les customers réels vivent dans le sandbox. Les prix annuels se **dérivent**, il n'y a aucun secret annuel à poser | P1 | M | T-32, T-35 | X + A | S6 |
| T-37 | Paiement | Compléter les mentions légales (SIREN, RCS, TVA, directeur de publication) et configurer les factures Stripe pour la France : mention « TVA non applicable, art. 293 B du CGI », mentions L441-9, numérotation continue | A3, C4, C5, C6. Une mention fausse est pire qu'une mention absente, d'où la dépendance au SIREN | P1 | S | T-32 | X + B | S6 |
| T-38 | Paiement | Réarmer la facturation : `ENTERPRISE_BILLING_ENFORCED = true` **et** `billing_flags.enterprise_seat_limit = true`, dans le même déploiement | Les deux drapeaux se déplacent ensemble. Serveur seul = impasse client, client seul = on encaisse sans rien débloquer | P1 | XS | T-35, T-36, T-37 | A | S7 |
| T-39 | Paiement | Recette de bout en bout avec une **vraie carte** : souscription mensuelle, changement de palier depuis le portail, résiliation, vérification de `org_subscriptions` et du journal `payment_records` | Le webhook et le checkout n'ont jamais traité un paiement réel. Le seul endroit où COSMO choisit un prix au lieu de se le faire désigner est la résolution annuelle | P1 | M | T-38 | X + A | S7 |
| T-40 | Emails | Poser `CRON_SECRET` (Supabase **et** GitHub) pour armer les avis de reconduction tacite | E6. Un avis non envoyé rend l'abonnement résiliable à tout moment, remboursement compris. Sans objet tant qu'aucun abonnement annuel n'existe, donc juste après T-39 | P2 | XS | T-39 | X | S7 |
| 🟡 T-41 | Scalabilité | **Coût par ligne mesuré le 2026-08-28** (SCALABILITY §9bis), le rapport de 54× confirme l'audit du 14 août. Reste le comportement du planificateur, qui exige un vrai jeu de données. Mesurer à volume réel : injecter ~2 000 `team_tasks` dans une organisation de test de 50 membres et rejouer le runbook `SCALABILITY.md` §10 | Les correctifs 113/117/128 sont vérifiés en plan et en test, **jamais contre du volume**. C'est exactement la confiance non vérifiée qui a laissé passer un `Seq Scan` global pendant six semaines | P2 | M | — | A | S6 |
| ✅ T-42 | Infrastructure | Confirmer que la prod utilise l'URL du pooler (PgBouncer 6543, mode transaction) | Jamais vérifié depuis le dépôt, et d'autant plus important vu le coût par ligne des prédicats RLS | P2 | XS | — | A | S5 |
| T-43 | Legal | Collecter et archiver les DPA des sous-traitants (Supabase, Vercel, Sentry, Stripe, Resend) | A5 et A6. Chaînon obligatoire pour vendre à une entreprise, et il ne s'obtient qu'en tant qu'entreprise | P2 | M | T-32 | X | S7 |
| ✅ T-44 | Legal | Recherche d'antériorité « COSMO » sur `data.inpi.fr` **et** `euipo.europa.eu`, classes 9 et 42 | Nom très générique, antériorités quasi certaines. La question n'est pas « existe-t-il une marque COSMO » mais « une marque COSMO couvre-t-elle le logiciel ». Se lancer sans le savoir, c'est risquer de devoir renommer après acquisition | P2 | S | — | X | S6 |

### PHASE 4 — 1 000 → 10 000 utilisateurs

| ID | Cat. | Tâche | Pourquoi | P | Effort | Dép. | Piste | Deadline |
|---|---|---|---|---|---|---|---|---|
| ✅ T-45 | Dette technique | Découper `TaskTable.tsx` (1 124 lignes, plus gros fichier du dépôt, immobile depuis trois jours). **Fait le 2026-08-29 : 1 124 → 890** | Les quatre passes du cliquet ont toutes porté sur `/entreprise`, parce que c'est là qu'a lieu le travail. La dette du socle ne baisse pas toute seule | P3 | L | — | B | S8 |
| ✅ T-46 | Fiabilité | **FERMÉ le 2026-08-29 (soir) : la sauvegarde EXISTE et tourne.** Secret posé, run vert, artefact `db-dump` de **385 ko** produit et téléchargeable, rétention 30 jours, prochain passage automatique à 04:26 UTC. Trois échecs successifs ont livré trois causes réelles, toutes refermées dans le workflow : identité du pooler (`postgres.<ref>`, absente), client PostgreSQL 16 utilisé face à un serveur 17, et un `Re-run` qui rejouait l'ancien fichier. ~~`pg_dump` mensuel~~ → **QUOTIDIEN**, et **remonté de P3 à P0**. La décision de rester en plan Free (donc sans T-01, donc sans aucune sauvegarde Supabase) fait de ce dump **la seule copie de la base qui existe**. Toujours inerte : sans le secret `SUPABASE_DB_URL` le job s'arrête en avertissement | ~~Complément du PITR~~ · Il n'y a plus rien à compléter : c'est la sauvegarde | **P0** | S | ~~T-01~~ | A livré / **X pose le secret** | S1 |
| 🟡 T-51 | Performance | **Premier levier livré le 2026-08-29 : 407 ko de moins au chargement** (recharts n'arrive plus qu'à l'approche de sa section), LCP 3,3 → 2,7 s, TTI 3,4 → 2,8 s en mesure locale. **Landing : 55 de performance et jusqu'à 1,5 s de blocage du fil principal.** Mesuré en CI le 2026-08-29, quatre fois, sur la version française. Le blog et le guide sont à 96-97 sur le même build : ce n'est pas le socle, c'est la page | La landing est la première chose que voit un visiteur d'annuaire, et c'est la seule page lente du site. Ouvrir l'acquisition sur elle, c'est payer un clic pour une page qui rame | P3 | M | — | B | S8 |
| T-47 | Performance | Trancher `vendor-sentry` (49,2 ko gzip) sur le chemin critique | Ce n'est **pas** un arbitrage de performance : le différer revient à ne plus capturer les erreurs de démarrage, celles qui blanchissent l'écran. Décision produit, pas optimisation | P3 | S | — | X décide | S8 |

---

## 2. Roadmap semaine par semaine

### SEMAINE 1 — 28 août → 3 septembre · **Rendre la production rattrapable**

**Objectif** : qu'une erreur en production redevienne réparable, et qu'un incident réveille
quelqu'un.

**Pourquoi cette semaine** : aujourd'hui, une manipulation malheureuse en base est définitive
(pas de PITR), et une Edge Function qui échoue ne prévient personne. Tout ce qui suit dans cette
roadmap suppose qu'on puisse se tromper sans tout perdre.

- [x] **T-19** — committer les trois tests non suivis et les douze docs modifiés · P1 · XS · X
  **Done** : `git status` propre, CI verte sur `main`.
- [⚪] **T-01** — Supabase plan Pro + PITR · P0 · XS · X · écarté ; motif, compensation et seuils de réouverture au §3.
- [ ] **T-02** — drill de restauration **du dump quotidien** vers un projet jetable · P0 · M · X + A · dép. **T-46** · outillé, cf. `DEPLOYMENT.md` §7
  **Done** : la date, la durée mesurée et le RTO constaté sont inscrits dans `DEPLOYMENT.md` §7 ;
  un login réel et une création de tâche ont été faits sur le projet restauré ; le projet jetable
  est supprimé. Un drill dont on ne peut pas citer le chronomètre n'a pas eu lieu.
- [~] **T-05 à T-09** — les réglages de console · P0/P1 · X
  **Done** : chaque réglage est relu dans la console et recopié ici, aucun n'étant lisible depuis
  le dépôt. L'allowlist de redirection doit contenir **toutes** les pages qui la demandent,
  `/reset-password` comprise.
  ❌ **Hors de portée en plan Free** : `auth_leaked_password_protection` est réservée au plan Pro. L'advisor restera rouge, ce n'est pas un oubli.
  ⚠️ **La moitié (b) de T-06 est du code, pas un réglage** : livrée le 2026-08-30, elle attend l'application de la mig. `131` puis un enrôlement.
- [x] **T-16** — vérifier `VITE_SENTRY_DSN` sur Vercel · P1 · XS · X
  **Done** : une erreur déclenchée volontairement en prod apparaît dans Sentry sous 2 minutes.
- [x] **T-13** — poser `OPS_ALERT_WEBHOOK_URL` · P1 · XS · X
  **Done** : prouvé par un appel réel à `renewal-notice` en production, qui échoue en fermé faute de `CRON_SECRET` et a fait partir l'alerte dans le canal. Pas un POST manuel : le vrai chemin du code.
- [x] **T-10 / T-11** — appliquer la mig. 130, puis `check:drift` · P1 · XS · X applique / A vérifie
  **Done** : le ledger affiche `130`, `check:drift` sort 0, et surtout la requête de vérification
  du pied de la migration renvoie **0** pour un membre simple.
  ⚠️ **Ne pas attendre de signal du test d'intégration** : il tourne sur une base vierge, où la 130
  est appliquée quoi qu'il arrive. Son rouge du 2026-08-28 venait d'une colonne `status` que le
  test inventait, pas de la production.
- [x] **T-03** — SMTP Auth via Resend · P0 · M · X
  Procédure pas à pas : [`DEPLOYMENT.md` §2ter](./DEPLOYMENT.md). Gabarits prêts dans
  `supabase/templates/`.
  **Done** : `npm run check:mail` sort **0** ;
  une inscription de test reçoit son email en moins d'une minute, depuis `@send.thecosmo.app`,
  **hors dossier indésirables sur Gmail ET sur Outlook** ; la limite *Emails per hour* a été
  relevée — elle ne bouge pas toute seule quand on branche un SMTP.
- [x] **T-12** — déployer `report-bug` · P1 · XS · A
  **Done** : `list_edge_functions` liste `report-bug` ; un signalement envoyé depuis la prod
  arrive sur `contact@thecosmo.app` **sans** que le repli `mailto` s'affiche.

### SEMAINE 2 — 4 → 10 septembre · **Fermer la porte d'entrée, prouver la mesure**

**Objectif** : que l'inscription tienne debout sous trafic, et que la campagne à venir soit
mesurable.

**Pourquoi cette semaine** : l'inscription est le seul chemin entre une campagne et un
utilisateur. Elle n'a jamais été éprouvée sous volume, ni protégée des bots, ni vérifiée de bout
en bout côté attribution.

- [x] **T-04** — coller les 4 gabarits d'email · [⚪] **T-04b** *Confirm email*, écarté (friction assumée, cf. `faille.md` § G-2 et §3)
  **Done** : les quatre emails reçus sont ceux de `supabase/templates/` ; une inscription de test
  n'ouvre plus de session et affiche « Vérifiez votre boîte mail » ; le lien reçu active bien le
  compte. **Dans cet ordre** : activer les confirmations avant d'avoir le SMTP, c'est ouvrir
  l'inscription sur un expéditeur plafonné.
- [~] **T-14** — Turnstile sur inscription et reset · P1 · S · A + B
  **Done** : une inscription sans jeton de challenge est refusée côté Supabase (pas seulement
  masquée côté client) ; le parcours démo → inscription reste franchissable en un essai ; un test
  E2E couvre le cas nominal.
- [x] **T-20** — audit des deux drapeaux de facturation · P0 · XS · A
  **Done** : `ENTERPRISE_BILLING_ENFORCED` lu dans `premium-config.ts` **et**
  `billing_flags.enterprise_seat_limit` lu en base sont tous deux `false`, avec la requête et sa
  date citées dans le commit. Jamais depuis un document.
- [ ] **T-15** — chaîne `?ref=` validée de bout en bout · P0 · S · X
  **Done** : `select acquisition_source from profiles where id = '<compte jetable>'` renvoie
  `test_manuel`, et le canal apparaît dans `/admin`. Puis le compte est supprimé par
  `delete-account`, ce qui teste au passage le droit à l'effacement en conditions réelles.
- [ ] **T-17** — sonde de disponibilité externe · P2 · XS · X
  **Done** : une alerte arrive sur le même canal que `OPS_ALERT_WEBHOOK_URL` quand la sonde est
  volontairement pointée sur une URL invalide.
- [x] **T-18** — supprimer `tmp-org-price-setup` · P3 · XS · X
  **Done** : la fonction n'est plus listée en production, et l'appel rend `404`.

> 🚦 **Fin de semaine 2 : passage du GO / NO-GO du §3.**

### SEMAINE 3 — 11 → 17 septembre · **Ouvrir l'acquisition, et regarder**

**Objectif** : les premières soumissions d'annuaires partent, et on sait enfin ce que Google voit.

**Pourquoi cette semaine** : le SEO est bloqué par l'autorité de domaine, pas par le contenu.
C'est un chantier long et manuel : plus tôt il commence, plus tôt le seuil de ~20 domaines
référents est franchi. Rien d'autre ne le remplace.

- [ ] **T-22** — état des lieux Search Console + Ahrefs · P1 · S · X
  **Done** : trois chiffres écrits dans `SEO.md` avec leur date — type de propriété, pages
  indexées, domaines référents.
- [ ] **T-21 (vague 1)** — les 5 premiers annuaires de `ACQUISITION-BACKLINKS.md` · P1 · X
  **Done** : 5 lignes remplies dans le tableau de suivi, avec la date de soumission et le statut.
- [x] **T-23 (mesure)** — instrumenter l'activation · P1 · B
  **Done** : on peut répondre par une requête à « combien de comptes créent une tâche le jour de
  leur inscription » et « combien reviennent le lendemain ». La correction vient après la mesure,
  pas avant.
- [x] **T-30** — publier les durées de conservation · P2 · XS · B
  **Done** : les trois durées sont dans la politique de confidentialité, et `RGPD.md` §6 passe le
  point 3 au vert.
- [x] **T-28** · resserrer les seuils Lighthouse · P2 · S · A
  **Done** : chaque seuil est posé juste au-dessus de la valeur du premier run réel, et le job
  reste vert.

### SEMAINE 4 — 18 → 24 septembre · **Que les correctifs atteignent les gens**

**Objectif** : traiter le décrochage d'activation et faire en sorte qu'un déploiement change
quelque chose pour ceux qui sont déjà là.

**Pourquoi cette semaine** : les premiers utilisateurs arrivent. Or 91,5 % du trafic serveur
vient d'onglets qui exécutent un vieux bundle, et 0 compte sur 28 est actif à 7 jours. Acquérir
sans corriger ces deux points revient à remplir un seau percé.

- [ ] **T-23 (correction)** — traiter le premier écran après inscription · P1 · L · B
  **Done** : une action utile est faite par un nouveau compte dans les 60 premières secondes dans
  le parcours de recette, et la mesure de la semaine 3 est rejouée deux semaines plus tard.
- [x] **T-24** — détection de nouvelle version · P2 · M · B
  **Done** : un onglet ouvert sur l'ancien build affiche l'invitation à recharger en moins de
  5 minutes après un déploiement ; vérifié dans deux onglets réels, pas en test unitaire seul.
- [x] **T-29** — chunk d'entrée sous 92 ko gzip · P2 · M · B
  **Done** : `npm run check:bundle` est vert **avec le plafond redescendu à 92 000**. Un plafond
  qu'on ne redescend pas n'est pas un budget.
- [x] **T-25** · barre d'onglets entreprise sur mobile · P2 · M · B
  **Done** : les 7 destinations sont atteignables sans connaissance préalable sur un écran de
  375 px, vérifié dans le navigateur, pas déduit d'une règle.
- [x] **T-31** · procédure de support écrite · P2 · S · X
  **Done** : un document d'une page dit qui répond, sous quel délai, et où arrivent les
  signalements.
- [ ] **T-21 (vague 2)** — annuaires 6 à 12 · X

### SEMAINE 5 — 25 septembre → 1er octobre · **Ouvrir le dossier juridique**

**Objectif** : lancer l'immatriculation, qui a un délai administratif incompressible et bloque
tout l'encaissement.

**Pourquoi cette semaine** : entre le dépôt au guichet INPI et l'obtention du SIREN il s'écoule
plusieurs semaines. Si le dossier part en semaine 7, la facturation ne peut pas être armée dans
ces 60 jours. C'est la seule tâche de la roadmap dont le délai ne dépend pas de nous.

- [ ] **T-33** — choisir et signer la domiciliation · P1 · S · X (préalable pratique à T-32)
- [ ] **T-32** — déposer l'immatriculation au guichet unique INPI · P1 · M · X
  **Done** : dossier déposé, numéro de suivi conservé. Le SIREN arrivera plus tard, ce n'est pas
  le critère.
- [x] **T-44** — recherche d'antériorité « COSMO » · P2 · S · X
  **Done** : les résultats INPI et EUIPO en classes 9 et 42 sont copiés dans `LEGAL.md` §F1, avec
  une conclusion écrite : on garde le nom, ou on consulte un conseil.
- [x] **T-42** — vérifier l'URL du pooler en prod · P2 · XS · A
- [ ] **T-21 (vague 3)** — annuaires 13 à 20 · X
- [x] **T-26** — unifier les grammaires de filtre · P2 · M · B

### SEMAINE 6 — 2 → 8 octobre · **Rendre la chaîne de paiement réelle**

**Objectif** : que le jour où le SIREN arrive, il ne reste qu'un drapeau à basculer.

**Pourquoi cette semaine** : tout ce qui suit peut être préparé sans SIREN, sauf les mentions de
facture. Préparer maintenant évite de tout découvrir le jour de la bascule.

- [ ] **T-35** — configurer le portail client Stripe sur les deux comptes · P1 · XS · X
  **Done** : `GET /v1/billing_portal/configurations` renvoie une configuration active sur le
  compte test **et** sur le compte live, avec l'annulation d'abonnement autorisée. C'est la
  vérification qui a dégradé cette ligne de 🟡 à ❌ le 2026-08-26 : la refaire, ne pas la
  supposer.
- [ ] **T-34** — adhérer à un médiateur de la consommation · P1 · S · X
- [ ] **T-36** — basculer Stripe en compte live · P1 · M · X + A
  **Done** : les 4 prix mensuels live existent tous en `tax_behavior: inclusive`, l'endpoint
  webhook live est enregistré avec les 5 mêmes events, `STRIPE_SECRET_KEY` et
  `STRIPE_WEBHOOK_SECRET` sont remplacés, et un appel de fumée au webhook répond
  « Invalid signature » (donc la fonction tourne et vérifie).
- [~] **T-41** — mesure de scalabilité à volume réel · P2 · M · A
  **Done** : `EXPLAIN (analyze, buffers)` à chaud sur une organisation de 50 membres et
  ~2 000 `team_tasks`, ratio buffers / lignes scannées inscrit dans `SCALABILITY.md` §9 en
  remplacement de la projection.

### SEMAINE 7 — 9 → 15 octobre · **Encaisser, pour de vrai**

**Objectif** : le premier euro peut être encaissé légalement et le client peut partir.

**Pourquoi cette semaine** : c'est la première semaine où le SIREN peut être arrivé. Les deux
drapeaux ne bougent qu'ici, et ensemble.

- [ ] **T-37** — mentions légales complètes + factures Stripe conformes · P1 · S · X + B · dép. T-32
- [ ] **T-38** — réarmer les deux drapeaux dans le même déploiement · P1 · XS · A
  **Done** : `ENTERPRISE_BILLING_ENFORCED = true` déployé sur Vercel **et**
  `billing_flags.enterprise_seat_limit = true` en base, vérifiés tous les deux après coup. Jamais
  l'un sans l'autre.
- [ ] **T-39** — recette de paiement avec une vraie carte · P1 · M · X + A
  **Done** : une souscription mensuelle réelle apparaît dans `org_subscriptions` avec le bon
  palier et le bon `billing_interval` ; un changement de palier depuis le portail se reflète en
  base (le palier se redérive du **price ID**, jamais des metadata) ; une résiliation fonctionne ;
  `verify_payment_chain()` renvoie vrai.
- [ ] **T-40** — poser `CRON_SECRET` · P2 · XS · X
- [ ] **T-43** — collecter les DPA · P2 · M · X
- [ ] **T-27** — frise entreprise, exclure `currentUserId` · P3 · S · B

### SEMAINE 8 — 16 → 22 octobre · **Rembourser, mesurer, décider**

**Objectif** : refermer la dette qui gêne le rythme, et prendre les deux décisions différées.

**Pourquoi cette semaine** : une fois la boucle acquisition → produit → encaissement bouclée, la
question redevient « à quelle vitesse peut-on avancer », donc la dette du socle.

- [x] **T-45** · découper `TaskTable.tsx` · P3 · L · B
  **Done** : plus aucun fichier au-dessus de 900 lignes, et le budget de `architecture.guard`
  redescendu d'autant. Le cliquet ne descend que quand la mesure descend.
- [~] **T-46** — sauvegarde `pg_dump` hors fournisseur · P0 · S · A livre / X pose le secret
- [ ] **T-47** — trancher `vendor-sentry` · P3 · S · X décide
- [ ] **Revue de fin de cycle** : remesurer les dix notes d'audit, mettre à jour
  `docs/README.md`, archiver cette roadmap et en écrire une nouvelle. Une roadmap ne se met pas à
  jour, c'est un instantané — même règle que les audits.


---

## 3. Décisions assumées et seuils de réouverture

Ce que l'on a choisi de ne PAS faire, avec le prix de ce choix et l'événement qui doit le rouvrir.
Ce ne sont pas des retards : un risque assumé et daté vaut mieux qu'un risque oublié.

### Les deux décisions d'Axel du 2026-08-29

| Décision | Motif | Ce qui la compense | Ce qui doit la rouvrir |
|---|---|---|---|
| **Rester en plan Supabase Free** (T-01) | 125 $/mois pour 19 Mo de base et 28 comptes | T-46 passé en quotidien, seule sauvegarde | Egress > 3 Go/mois sur 5, ou le premier client payant |
| **Ne pas activer la confirmation d'adresse** (T-04b) | Friction à l'inscription, sur un produit dont le problème mesuré est l'activation | Rien à ce jour. Une garde anti-faute-de-frappe sur le domaine reste proposée | Un compte injoignable au support, une inscription avec l'adresse d'un tiers, ou le premier client payant |

### Risques acceptés au lancement, à ne pas confondre avec « réglés »

| Risque | Pourquoi il est acceptable maintenant | Quand il cesse de l'être |
|---|---|---|
| **Aucune monétisation active** (les deux drapeaux à `false`, Stripe en test) | Sans SIREN, encaisser serait du travail dissimulé. Le produit est gratuit et le dit | Dès le SIREN — T-38 |
| **Aucune vérification d'adresse à l'inscription** (T-04b écarté) | Décision d'Axel du 2026-08-29 : la friction coûte des inscrits de façon certaine, le risque est probabiliste. Le SMTP étant en service, l'interrupteur reste à un clic | Un compte injoignable au support, une inscription avec l'adresse d'un tiers, ou le premier client payant |
| **Plan Supabase Free : aucune sauvegarde native, aucun SLA, logs 24 h** (T-01 écarté) | 125 $/mois ne se justifient pas pour 19 Mo et 28 comptes. Le dump quotidien couvre la perte totale, pas le retour à hier | Egress > 3 Go/mois sur les 5 inclus, ou le premier client payant |
| **Position 88 en SEO, 0 domaine référent** | C'est un état de départ, pas un défaut. La correction est manuelle et longue | Jamais bloquant, mais rien ne s'améliore sans T-21 |
| **Jamais mesuré à volume** (`team_tasks`) | 4 organisations, 8 tâches d'équipe en prod | À la première organisation de plus de 20 personnes — T-41 |
| **13 fichiers > 600 lignes** (14 la veille) | Le cliquet empêche la croissance nette, et il a fait sortir `AuthContext` du budget le 2026-08-28 — première coupe dans le socle et non dans `/entreprise` | Jamais un bloquant produit, seulement un coût de vitesse |
| **`en` servie mais non indexable** | Choix délibéré : le contenu des pages est en français | Quand le contenu sera traduit |
| **CVE dev-only et `GHSA-qwww-vcr4-c8h2`** | Inapplicables à une SPA Vite sans RSC, verrouillé par `no-open-redirect.test.ts` | À la migration React 19 |
| **Le nom « COSMO » n'est pas libre** en classes 9 et 42 | 11 marques actives, dont une d'un éditeur de logiciel (T-44). Ça ne bloque pas un lancement, ça bloque un DÉPÔT — et ça crée un risque d'opposition | Dès que l'acquisition rend le nom coûteux à changer. Consultation de conseil en PI |

> 🔴 **Le mode de défaillance à garder en tête, parce qu'il est corrélé au trafic et mal
> étiqueté.** Aucune adresse n'est vérifiée à l'inscription, l'activer ferait passer chaque
> inscription par un expéditeur plafonné, et rien ne protège le formulaire des bots. Il ne se
> déclenche donc qu'un jour de campagne, et l'inscrit voit « Trop de tentatives. Réessayez dans
> quelques minutes. » Il n'a rien fait de trop : c'est le quota du projet, éventuellement consommé
> par quelqu'un d'autre, qui est épuisé. Il réessaie, échoue, et part. Côté tableau de bord, ça
> ressemble trait pour trait à une campagne qui ne convertit pas. C'est le scénario que T-03,
> T-04b, T-14 et T-15 existent pour rendre impossible.

### Conditions de GO

Les conditions ne se lisent pas ici mais **au §1** : toute tâche P0 non cochée est un NO-GO. S'y
ajoutent trois gardes mécaniques, à vérifier le jour du GO et jamais sur mémoire : les **cinq**
jobs CI verts sur `main` (`lint-test-build`, `audit`, `e2e`, `rls-integration`, `lighthouse`),
`npm run check:drift` à zéro, et `git status` propre.

> ⚠️ La version du 2026-08-27 écrivait « les quatre gardes CI » en en listant cinq, et personne ne
> les avait regardées : trois étaient rouges. Un décompte faux dans la condition de GO elle-même.

---

## 4. Ce qu'il ne faut PAS faire pendant ces 60 jours

La section la plus utile de ce document : elle porte ce qu'aucune liste de tâches ne peut dire,
c'est-à-dire le travail qu'il serait naturel d'entreprendre et qui ne rapporterait rien.

| À ne pas faire | Pourquoi |
|---|---|
| **Écrire ou approfondir des articles de blog** | Position 88 sur les requêtes non-marque. Un article de 2 000 mots en position 88 reste en position 88. Le SEO se débloque par T-21, pas par du contenu |
| **Lancer `npm audit fix`** | Il propose `react-router` 7.11.0, qui **réintroduit** l'open redirect. Aucune version ne clôt les deux familles sous React 18 |
| **Migrer vers React 19 + react-router 8** | Chantier réel, sans urgence : la CVE ouverte concerne le mode RSC, absent d'une SPA Vite. À faire en PR dédiée, hors de ces 60 jours |
| **Supprimer les 43 index inutilisés** | Décision déjà prise et documentée. Sur 18 Mo de base, leur coût d'écriture est négligeable, et certains sont des FK `ON DELETE CASCADE` |
| **Ajouter Redis, une file d'attente ou des read replicas** | YAGNI à 10 000 utilisateurs. React Query couvre le cache client, tout est synchrone, le webhook Stripe est idempotent |
| **Migrer `vendor-charts` vers visx ou chart.js** | Le grief d'origine est caduc : la landing n'importe plus Recharts, le chunk est réellement lazy |
| **Découper `PyramidTab` ou les fichiers > 600 lignes « pour la propreté »** | Le cliquet fait déjà baisser le budget à chaque passe, sans qu'aucune fonctionnalité ne soit reportée. Seul `TaskTable` mérite une coupe volontaire, et en semaine 8 |
| **Ajouter un `refetchInterval` « juste pour être sûr »** | Chaque tick est une requête pour tout le monde, en permanence. C'est la dette qui a coûté 91,5 % du trafic d'une journée |
| **Réintroduire un gate `isPremium()` sur le partage ou la collaboration** | Choix stratégique explicite : c'est le pari viral du produit |
| **Traduire le contenu des pages pour ouvrir `en` à l'indexation** | Chantier XXL sans retour tant que le domaine n'a pas d'autorité. `en` reste servie, non indexable |
| **Construire un back-office d'administration** | `/admin` répond déjà à la question qu'on se pose à ce stade : combien, qui, d'où |
| **Armer la facturation avant le SIREN** | Encaisser avant l'immatriculation est du travail dissimulé. Et le parcours actuel mène à un checkout en mode test, donc à une carte réelle refusée |
| **Faire confiance à un total sans le recompter** | Trois erreurs de comptage documentées en trois jours dans ce dépôt : les `refetchInterval`, les fichiers > 600 lignes, le tableau de `LEGAL.md`. Un total ne prouve rien |
| **Déclarer un correctif acquis sans mesure** | La règle du dépôt, écrite après deux rétractations en trois jours. Une garde rouge est coupable jusqu'à preuve du contraire, et la preuve est une mesure à un commit nommé |

### Recommandations d'audit devenues obsolètes

Confrontées au code le 2026-08-27. Elles figurent encore dans les audits, il ne faut pas les
exécuter.

| Recommandation | Pourquoi elle tombe |
|---|---|
| `SEO.md` §3 : « approfondir les 5 articles les plus courts » | **Renversée par le §4 du même document.** Un article de 2 000 mots en position 88 reste en position 88. Le facteur limitant est l'autorité de domaine, pas la longueur |
| `PERFORMANCE.md` : « migrer `vendor-charts` vers visx / chart.js » | Caduc : la landing n'importe plus Recharts, le chunk est réellement lazy |
| `SCALABILITY.md` §7 : supprimer les 43 index inutilisés | Décision déjà prise : on ne supprime rien. 18 Mo de base, coût d'écriture négligeable |
| `npm audit fix` sur `react-router` | **Piège actif.** Il propose 7.11.0, qui réintroduit l'open redirect `GHSA-wrjc-x8rr-h8h6`. La sortie est React 19 + router 8, en PR dédiée, hors de ces 60 jours |
| Redis / file d'attente / read replicas | YAGNI à 10 000 utilisateurs |
| `ACQUISITION.md` §4 : travailler la boucle de partage | Explicitement écarté par l'audit lui-même : il n'y a personne pour partager |

### Recommandations d'audit déjà satisfaites

Annoncées « à faire » par un audit, vérifiées faites dans le code. Ne pas les rouvrir.

| Recommandation d'audit | Réalité vérifiée |
|---|---|
| `SCALABILITY.md` §9 : « `useTeamOKRs` en `live` conditionnel, ~15 min » | ✅ **Déjà fait.** `team-okrs/hooks.ts:39` porte `...(options?.live ? { refetchInterval: 30_000 } : {})`. Les 4 `refetchInterval` restants sont tous conditionnels, vérifié par grep nominatif |
| `ACQUISITION.md` §7.1 : « appliquer la mig. 099 » | ✅ Appliquée en prod le 2026-08-23 |
| `ARCHITECTURE.md` §5 : dérive repo ↔ prod | ✅ Refermée, seule la `130` est en attente |
| `RGPD.md` §3 : rétention des tables analytiques | ✅ mig. 114 en prod |
| `POST-AUDIT-GUIDE.md` point 4 : harnais RLS d'intégration en CI | ✅ Job `rls-integration`, 8 fichiers dans `e2e/rls/` |
| `docs/TESTING.md` : couverture rouge | ✅ Verte au 2026-08-27 soir, 1 802 tests, seuils jamais baissés |

---

## 5. Checkpoints après lancement

Ce qu'il faudra revérifier à chaque palier. Aucun de ces points n'a de statut : ce sont des
questions à reposer le jour venu.

### À 100 utilisateurs

| Axe | À vérifier |
|---|---|
| Performance | Le chemin critique est-il toujours sous 400 ko gzip ? `check:bundle` vert sans plafond relevé |
| Coûts | Egress Supabase contre le plafond du plan ; base toujours loin de 500 Mo |
| Sécurité | `get_advisors` : aucun WARN nouveau ; les fonctions exécutables par `anon` sont-elles toujours deux ? |
| Infrastructure | Le dump quotidien tourne-t-il encore, et un second drill de restauration a-t-il été fait ? Le PITR redevient-il justifiable (cf. seuils du §3) ? |
| Erreurs | Taux d'erreur Sentry par session ; y a-t-il une erreur qui touche plus de 5 % des sessions ? |
| Support | Combien de signalements, quel délai de réponse médian |
| Analytics | `acquisition_source` renseignée sur quelle proportion des comptes ? Si c'est encore 0, la chaîne est cassée |
| Conversion | Taux visite démo → compte ; comparer au 74 % de juillet 2026, qui était de l'entourage |
| Rétention | Actifs à 7 jours et à 30 jours. **C'est le chiffre décisif** : il était à 0 sur 28 comptes |
| Architecture | Les 4 `refetchInterval` sont-ils toujours 4, et toujours conditionnels ? Recompter nominativement |

### À 1 000 utilisateurs

| Axe | À vérifier |
|---|---|
| Performance | Rejouer le runbook `SCALABILITY.md` §10 : ratio buffers / lignes scannées sur les 5 requêtes les plus chères |
| Coûts | Première facture Supabase et Vercel réelles ; egress par utilisateur actif |
| Sécurité | Audit RLS complet sur toute nouvelle table ; les tests `e2e/rls/` couvrent-ils chaque surface d'autorisation ajoutée depuis ? |
| Infrastructure | Pooler confirmé, connexions simultanées au pic, CPU base au pic |
| Erreurs | Un budget d'erreur explicite : au-delà de X % de sessions en erreur, on arrête les features |
| Support | Le canal unique suffit-il encore ? Sinon, une FAQ avant un outil |
| Analytics | Quel canal d'acquisition produit des utilisateurs **retenus**, pas seulement inscrits |
| Conversion | Taux gratuit → payant sur les organisations qui touchent le plafond de 5 sièges |
| Rétention | Cohortes mensuelles. Une rétention à 30 jours sous 20 % rend toute acquisition non rentable |
| Architecture | Le journal `payment_records` est-il intact ? `verify_payment_chain()` doit renvoyer vrai |

### À 10 000 utilisateurs

| Axe | À vérifier |
|---|---|
| Performance | Read replicas à envisager (l'app est déjà compatible, lectures et écritures sont séparées) |
| Coûts | Coût d'infrastructure par utilisateur actif, et sa tendance. C'est lui qui décide du prix |
| Sécurité | Test d'intrusion externe ; rotation des secrets ; revue des accès admin |
| Infrastructure | Plan de bascule fournisseur éprouvé, pas seulement documenté |
| Erreurs | Astreinte réelle : qui est joignable, sous quel délai. `RGPD-VIOLATION.md` recense déjà son absence |
| Support | Premier recrutement ou externalisation ; le fondateur ne peut plus être le support |
| Analytics | Attribution multi-touch, pas seulement first-touch |
| Conversion | Prix revalidé contre la valeur perçue, pas contre les coûts |
| Rétention | Rétention par palier de taille d'organisation : c'est là que se trouve le produit qui marche |
| Architecture | La question devient « quelle partie du monolithe freine », pas « comment tout découper » |

---

## 6. Journal d'exécution

Une session par entrée, la plus récente en tête de sa journée. **On coche quand le critère
« Done » est vérifié, pas quand le code est écrit.** Les statuts vivent au §1 ; ici on raconte
comment on y est arrivé, et surtout ce qu'on a cru à tort en chemin.

### 2026-08-30 — T-06 (b) : `/admin` derrière un second facteur, et la roadmap dédoublonnée

**Mesure d'abord.** Rien de ce qui est visible depuis le dépôt n'avait bougé depuis la veille :
aucun script Cloudflare sur `https://thecosmo.app/signup` (T-14 attend toujours ses deux clés),
`acquisition_source` toujours renseignée sur **0 profil sur 28** (T-15), les deux drapeaux de
facturation à `false`, `org_subscriptions` et `payment_records` vides, advisors sécurité
identiques. Ce qui a avancé la veille l'a été dans des consoles, et n'y laisse aucune trace.

#### ✅ Le document se contredisait lui-même

`ROADMAP-60J.md` portait l'état de chaque tâche dans **sept sections à la fois** : T-01 y
apparaissait 14 fois, T-13 onze. Les copies avaient divergé, et rien ne disait laquelle faisait
foi : T-13 était « fait le 2026-08-29 » au tableau de bord, au §1, à la semaine 1 et au journal,
et « webhook restant » au résumé exécutif. Le fichier passe de 1 541 à 1 250 lignes et de 11
sections à 6. Une seule table porte un statut, et son décompte est recompté par script, collé à sa
source. Ce qui a été gardé bien que non demandé l'a été pour une raison précise : les décisions
assumées et leurs seuils de réouverture, les interdits des 60 jours, les checkpoints par palier.
Aucun ne se déduit de la liste des tâches.

#### ✅ T-06 (b) — la 2FA de la console ne protégeait pas l'application

La 2FA posée la veille protège la **console Supabase**. `get_admin_stats()`, elle, n'exigeait
qu'une session valide d'un compte présent dans `admin_users` : un mot de passe volé rendait
lisible toute la volumétrie business du produit.

**Mig. `131`** sépare deux questions qui portaient le même nom :

| Fonction | Répond à | Rôle |
|---|---|---|
| `admin_allowlisted()` | « ce compte est-il admin ? » | affichage, ignore la session **exprès** |
| `is_admin()` | « cette requête est-elle autorisée ? » | garde : allowlist **et** `aal2` |

`is_admin()` garde son nom et sa signature : `get_admin_stats()` l'appelle déjà et n'a pas été
touchée. Réécrire ses 200 lignes pour y insérer deux lignes de garde aurait ajouté un risque de
transcription sur la fonction la plus longue du dépôt, pour un gain nul.

**Trois choix qui méritent d'être écrits, parce qu'ils étaient tentants dans l'autre sens :**

1. **`aal2` porte sur la SESSION, pas sur le compte.** Tester « ce compte a activé la 2FA »
   aurait laissé passer exactement le cas qu'on veut refuser : une session ouverte avec un mot de
   passe volé sur un compte pourtant enrôlé.
2. **L'écran d'enrôlement ne dépend pas de la garde.** S'il en dépendait, appliquer la migration
   enfermerait l'admin dehors sans chemin de retour. C'est pour ça que `admin_allowlisted()`
   ignore volontairement le niveau d'assurance, et c'est pour ça qu'elle ne doit jamais servir de
   garde.
3. **Le QR passe par une balise `<img>` sur une `data:` URI**, jamais par
   `dangerouslySetInnerHTML`. Un SVG inline exécute ses scripts, un SVG chargé comme image ne le
   peut pas. Le SVG vient de notre propre GoTrue, et ce n'est pas une raison suffisante.

**Témoin exécuté** : en affaiblissant la garde (`challenge` rendant le tableau de bord), le test
du défi échoue ; restaurée, les 18 tests passent. Un test qui passe du premier coup sans avoir
jamais échoué ne prouve rien.

**Ce qui n'est PAS prouvé, et ne le sera pas d'ici** : la migration n'est pas appliquée, aucun
authentificateur n'est enrôlé. Tant que ces deux gestes ne sont pas faits, T-06 reste 🟡. Le
téléphone perdu ne verrouille rien : `DELETE FROM auth.mfa_factors WHERE user_id = '<uid>'` depuis
le SQL editor ramène la session en `aal1` et fait reparaître l'écran d'enrôlement. Il n'y a donc
pas de codes de récupération à conserver.

### 2026-08-29 (soir) — 11 tâches fermées, 2 décisions rendues, 3 angles morts refermés

La session la plus dense du dossier. Tout ce qui suit a été **vérifié en production**, jamais sur
déclaration, sauf les réglages du dashboard Auth qui ne sont lisibles de nulle part et sont
marqués « déclarés ».

| Tâche | Résultat |
|---|---|
| ✅ **T-03** | SMTP applicatif en service. `send.thecosmo.app` vérifié chez Resend ; DKIM sur `resend._domainkey.send`, MX et SPF du Return-Path sur **`send.send.thecosmo.app`** chez IONOS ; expéditeur `thecosmo@send.thecosmo.app` ; limite d'envoi portée à 100/h. **`npm run check:mail` vert pour la première fois.** Un email de réinitialisation a été reçu, hors indésirables |
| ✅ **T-04** | Les quatre gabarits français collés en production, à la place des gabarits anglais signés Supabase |
| ⚪ **T-04b** | **Écarté par Axel** : trop de friction à l'inscription. Risque accepté et documenté dans `faille.md` § G-2, avec ses trois conditions de réouverture |
| ✅ **T-05** (moitié) | Longueur minimale portée à 12, alignée sur `MIN_PASSWORD_LENGTH`. **L'aide affichée dans les Réglages annonçait encore 8**, en fr comme en en : un utilisateur qui la suivait se faisait refuser sa saisie. Corrigé. La constante avait été centralisée, pas le texte |
| ✅ **T-06** (moitié) | 2FA posée sur le **compte Supabase**. L'autre moitié, protéger `/admin`, s'est révélée être du **développement** et non un réglage : `grep -i "mfa\|totp\|aal2"` sur `src/` ne rend rien |
| ✅ **T-07** | Allowlist de redirection relue. **`/reset-password` n'y était pas** alors que `ForgotPasswordPage` le demande : les réinitialisations retombaient sur la Site URL. Ajouté. Les deux jokers Vercel sont conservés sciemment, `flowType: 'pkce'` rendant le code inexploitable depuis une autre origine |
| ✅ **T-08** | *Secure email change* activé |
| ✅ **T-10 / T-11** | Mig. 130 appliquée. Prouvée acteur par acteur sur les données réelles : membre simple **0 ligne** (avant : toutes), témoin sur un second membre à 0, inviteur/destinataire/admin à 2, inchangé. Une seule policy PERMISSIVE. `check:drift` propre derrière. **G-1 refermé : plus aucun finding ouvert en production** |
| ✅ **T-12** | `report-bug` déployée (elle ne l'était pas, malgré deux documents qui l'affirmaient), puis secrets posés, puis **envoi réel réussi** : un signalement de test accepté par Resend et reçu sur `contact@thecosmo.app` |
| ✅ **T-13** | `OPS_ALERT_WEBHOOK_URL` posé. Prouvé par le vrai chemin du code, pas par un POST manuel |
| ✅ **T-18** | `tmp-org-price-setup` supprimée. 7 fonctions en prod, l'appel rend `404` |
| ✅ **T-46** | **Il existe une sauvegarde.** Passée en quotidien, remontée de P3 à P0, secret posé, artefact de 385 ko produit |
| ⚪ **T-01** | **Écarté par Axel** : plan Free conservé. 125 $/mois ne se justifient pas pour 19 Mo et 28 comptes |

**Livré côté dépôt** : sonde de disponibilité `uptime.yml` (AM-4 à moitié refermé), diagnostic de
chaîne de connexion dans `db-backup.yml`, correction de `check:mail` qui cherchait le Return-Path
au mauvais endroit, correction de l'aide de mot de passe en fr et en en, et le runbook §2ter
réécrit avec les enregistrements DNS exacts à poser chez IONOS.

#### Les quatre leçons de la soirée

1. **Un message d'erreur qui désigne le mauvais coupable coûte plus cher qu'un silence.**
   « password authentication failed » alors que l'identité était fausse, « server version
   mismatch » alors que le bon paquet était installé mais pas utilisé. Les deux sont désormais
   détectées **par nom** avant la connexion.
2. **Une garde qui crie au loup sur du travail juste s'ignore en trois jours.** `check:mail`
   cherchait le MX et le SPF sur le domaine d'envoi ; Resend les place sur `send.<domaine>`. Elle
   aurait affiché deux échecs sur une configuration parfaite.
3. **Centraliser une constante ne centralise pas les phrases qui la citent.** `MIN_PASSWORD_LENGTH`
   valait 12 partout dans le code, et l'écran disait 8.
4. **`Re-run` ne relit jamais le fichier de workflow.** Sept tentatives ont rejoué la version
   buguée avant qu'on s'en aperçoive.

### 2026-08-28 — 5 tâches fermées, 1 mesurée à moitié, 1 arbitrage rendu à Axel

| Tâche | Résultat |
|---|---|
| ✅ **T-20** | Les deux drapeaux sont à `false`, **vérifiés séparément** : `premium-config.ts` lignes 14 et 160 pour le client, `select key, enabled from billing_flags` pour le serveur (`enterprise_seat_limit` → `false`). Jamais depuis un document, c'est la règle posée après les trois bascules du 2026-08-25 |
| ✅ **T-11** | `check:drift` joué contre la prod : **aucun objet attendu ne manque**, 48 tables, 112 fonctions, 137 policies. ⚠️ Joué AVANT la mig. 130, il ne la couvre donc pas — la 130 remplace une policy de même nom, et cette garde compare des noms, pas des définitions. À rejouer après application, sans en attendre un signal sur ce point précis |
| ✅ **T-30** | Les trois durées mesurées sont publiées dans la politique de confidentialité (90 j visite démo non convertie, 400 j activité et démo convertie, 90 j marqueurs Stripe), avec la mention que le journal d'encaissement est anonymisé et non supprimé. Débloque le dernier point RGPD en attente d'un acheteur B2B |
| ✅ **T-24** | Un onglet resté ouvert sur un bundle périmé propose de recharger. `version.json` est émis au build avec le **même** identifiant que celui compilé dans le bundle, revalidé à chaque lecture (`vercel.json`). Déclenché au retour d'onglet, **étranglé à une fois par demi-heure**, jamais un minuteur permanent. Propose, ne recharge jamais d'autorité : un onglet ouvert contient souvent une saisie en cours |
| 🟡 **T-23** | **Mesure faite, correction non engagée.** Voir le tableau ci-dessous |
| ⏸️ **T-27** | **Rendu à Axel, ce n'est pas une décision technique.** Voir plus bas |

#### La ligne de base d'activation (T-23, mesurée en prod le 2026-08-28)

| Indicateur | Valeur | Lecture |
|---|---|---|
| Comptes | 28 | · |
| Ont créé au moins une tâche | **18** (64 %) | Plus d'un tiers des inscrits n'ont jamais rien créé |
| En ont créé une le jour même | **12** (43 %) | · |
| Ont au moins 5 tâches | **11** (39 %) | Le seuil au-delà duquel un compte ressemble à un usage réel |
| Revenus après J+1 | **13** (46 %) | · |
| **Ne sont jamais revenus** après leur session d'inscription | **14** (50 %) | **Le chiffre qui compte** |

> ⚠️ **Ceci corrige une lecture répétée dans les audits.** « 0 compte actif sur 7 jours » décrivait
> l'activité *récente*, et se lisait comme « personne n'a jamais rien fait ». C'est faux :
> 18 comptes sur 28 ont créé des tâches, 11 en ont au moins cinq. Le vrai défaut n'est pas que le
> produit ne serve à personne, c'est qu'**un inscrit sur deux ne revient jamais**. Ce n'est pas le
> même problème et ça n'appelle pas les mêmes corrections : le premier écran après inscription,
> pas la découverte des fonctionnalités.
>
> ⚠️ **28 comptes, dont des comptes de test.** Ces pourcentages donnent une direction, pas une
> mesure. À rejouer au-delà de 100 comptes réels avant d'en tirer une conclusion produit.

#### Défaut trouvé dans une garde, en l'exécutant (hors roadmap)

`check:drift` annonçait `get_my_habits` et `toggle_habit_completion_v2` comme **« EN TROP en prod,
héritage dashboard »** alors que les deux sont versionnées depuis les migrations 119 et 121.

Cause : le motif normal d'un changement de signature — créer la nouvelle, supprimer l'ancienne —
quand le `DROP FUNCTION nom(args)` arrive plus bas dans le même fichier (mig. 122 : `CREATE` aux
lignes 55 et 159, `DROP` aux lignes 279 et 280). Le parseur, aveugle aux signatures, retirait alors
le nom de l'ensemble attendu.

🔴 **Le symptôme était bénin, le défaut ne l'est pas : il faisait échouer la garde dans le sens
rassurant.** Si l'une de ces deux fonctions avait réellement manqué en production, le script ne
l'aurait pas signalée — il ne l'attendait plus. Corrigé, et verrouillé par trois tests dans
`scripts/migration-guards.test.mjs`, dont un **témoin** qui vérifie qu'une fonction réellement
absente est toujours détectée : sans lui, un parseur qui n'oublierait jamais rien passerait aussi.

#### L'arbitrage rendu à Axel (T-27)

Le titre incriminé par la critique UI est **déjà corrigé** : la carte dit « Prochains événements de
**l'entreprise** », vérifié dans `src/locales/fr/org.json`. Reste la seconde moitié du finding,
exclure mes propres tâches de la frise, et **je ne la prends pas seul** : les deux lectures
mènent à des produits différents.

- **Exclure** supprime la répétition avec la liste juste au-dessus — mais une frise intitulée
  « de l'entreprise » qui omet certaines échéances **devient fausse**, et le pire cas est celui où
  la prochaine échéance de l'entreprise est la mienne : la frise annoncerait alors autre chose.
- **Garder** assume la répétition, qui est le grief d'origine.

Une troisième voie existe, plus chère : garder tout et **marquer** les événements qui me sont
assignés. Trancher demande de savoir à quoi sert cette carte — un rappel personnel, ou une vue
d'ensemble de l'organisation. C'est une question produit, pas une question de code.

### 2026-08-28 (suite) — semaine 1 parcourue dans l'ordre

| Tâche | Résultat |
|---|---|
| ✅ **T-19** | Le travail vérifié du 2026-08-27 est sur `main` (`d4f1a58`) : 12 documents, 3 tests, 2 correctifs source. Le spec e2e non suivi a été **rejoué avant** d'être commité — 3/3 verts sur chromium, témoin compris. On ne pose pas un spec e2e sur `main` sans l'avoir vu passer. Reste hors index, volontairement : `.claude/settings.local.json`, `supabase/.temp/cli-latest` (suivi à tort) et `.impeccable/` |
| ✅ **T-16** | `VITE_SENTRY_DSN` **est bien posé sur Vercel**, prouvé sans accès à la console : le DSN est inliné dans le bundle servi en production (`/assets/index-*.js`). C'est une variable `VITE_`, donc compilée au build — son absence serait visible de la même façon. Le monitoring n'est donc pas éteint en silence. ⚠️ Ce qui n'est PAS vérifié : qu'une erreur remonte effectivement jusqu'au tableau de bord Sentry. Ça demande la console, côté Axel, et une erreur déclenchée volontairement |
| ✅ **T-24, vérifié en PRODUCTION** | Le mécanisme est complet et cohérent en ligne : le bundle servi porte `a516b5c`, `/version.json` renvoie `{"release":"a516b5c"}`, en `Cache-Control: public, max-age=0, must-revalidate`. La réécriture SPA ne l'avale pas — c'était le risque réel, tout ce qui n'est pas `/assets`, `/fonts` ou `/screenshots` est réécrit vers `index.html`, et Vercel ne consulte les réécritures qu'après le système de fichiers. Les deux valeurs étant identiques, **aucun bandeau ne s'affiche, et c'est le bon résultat** |

> ⚠️ **Ce qui reste à prouver sur T-24 ne peut l'être qu'au prochain déploiement** : qu'un onglet
> resté ouvert sur `a516b5c` affiche bien l'invitation quand un build plus récent est servi. Test
> gratuit et concret : laisser un onglet ouvert sur la production, pousser le commit suivant,
> revenir sur l'onglet. Le bandeau doit apparaître dans la demi-heure — l'étranglement est à
> 30 minutes, pas à l'instant.

#### Semaine 1 — ce qui reste, et c'est entièrement hors du dépôt

T-01 (plan Pro + PITR), T-02 (drill de restauration), T-03 (SMTP applicatif), T-05 à T-09 (les
cinq réglages de console), T-10 (appliquer la mig. 130) et T-13 (webhook d'alerte) sont des clics
dans les consoles Supabase, Vercel, Resend et GitHub. Aucun n'est atteignable depuis le dépôt, et
tout ce qui pouvait être préparé en amont l'est : runbook, gabarits d'email, front prêt pour la
confirmation d'adresse, garde `check:mail`.

**La semaine 1 n'attend plus une seule ligne de code.**

### 2026-08-28 (fin) — semaine 2 entamée : T-14 livré inerte, T-27 clos

| Tâche | Résultat |
|---|---|
| 🟡 **T-14** | **Cloudflare Turnstile câblé, et volontairement inerte.** Aucun script tiers n'est chargé tant que `VITE_TURNSTILE_SITE_KEY` est absente — vérifié par test, c'est le témoin du fichier. Le jeton est joint aux **trois** points d'entrée que Supabase protège : `signUp`, `signInWithPassword` et `resetPasswordForEmail`. En oublier un rendrait l'authentification inutilisable le jour de l'activation |
| ⚪ **T-27** | **Clos sans changement**, arbitrage rendu par Axel : la répétition est assumée. Le titre incriminé était déjà corrigé |

> 🔴 **Deux avertissements à lire AVANT de toucher au réglage Supabase**, tous deux dans
> `DEPLOYMENT.md` §2quater :
>
> 1. **L'ordre est impératif.** Poser la clé publique et redéployer *d'abord*, activer côté
>    Supabase *ensuite*. Inversé, GoTrue exige un jeton que personne n'envoie encore : inscription
>    **et** connexion tombent pour tout le monde. Ce n'est pas une dégradation, c'est une panne
>    totale de l'authentification.
> 2. **Activer le CAPTCHA cassera `npm run cosmo:login`.** La protection couvre aussi
>    `signInWithOtp`, qu'utilise le CLI agent, et un script Node ne peut pas résoudre un challenge.
>    Une session CLI déjà ouverte survit ; c'est la *reconnexion* qui casse.

#### Le cliquet de taille a joué une cinquième fois

Le cas captcha demandait quatre lignes dans `safeAuthError`, or `AuthContext.tsx` était à
626 lignes pour un budget qui n'avait plus **qu'une seule ligne de marge**. La garde a donc imposé
la découpe plutôt que le contournement, exactement comme les quatre fois précédentes.

`src/modules/auth/auth-errors.ts` sort la traduction d'erreurs du provider : une fonction pure,
testable sans React ni Supabase. **`AuthContext` passe de 626 à 591 lignes et QUITTE la liste des
fichiers hors budget** — le budget tombe de 10 811 à **10 185**, et le fichier est retiré de
`KNOWN_OVERSIZED`. C'est la première fois qu'une coupe fait sortir un fichier du socle et non de
`/entreprise`.

> Le classement change en conséquence : `TaskTable` 1 124 · `PyramidTab` 1 045 · `AgendaPage` 900 ·
> `SettingsPage` 852 · `InboxMenu` 802 · `useTaskModal` 719 · `TasksPage` 712 ·
> `team-projects/local.repository` 710 · `DesktopDetailsStep` 703 · `TaskModalMobileBody` 697 ·
> `TeamTaskModal` 692 · `TaskListsBar` 615 · `friends/supabase.repository` 601. **Treize fichiers.**

### 2026-08-28 (semaine 3) — la CI est rouge sur `main` depuis quatre jours

C'est le résultat de la journée, et il ne vient pas d'une tâche de la roadmap : il vient d'avoir
regardé l'état réel de la CI au lieu de la croire verte.

| Fait | Preuve |
|---|---|
| **Aucun run CI complètement vert sur `main` dans les 100 derniers** | API GitHub, remonte au moins au 2026-08-24 |
| Trois jobs sur cinq échouent : `e2e`, `rls-integration`, `lighthouse` | `lint-test-build` et `audit` passent |
| **Le même triplet échoue AVANT et APRÈS mes commits** | Comparaison job par job entre `f32d080` et `b2f2294` — je n'ai rien cassé, et je ne l'affirme pas, je le montre |
| **L'issue #44 « CI en echec sur main » est ouverte depuis le 2026-08-23, avec 90 commentaires** | L'alerte fonctionne parfaitement. Personne n'a réagi |

> 🔴 **La leçon est déjà écrite dans ce dépôt, et elle vient de se rejouer.** L'en-tête de
> `ci-alert.yml` dit : « une garde rouge est une garde muette : elle ne protège plus de rien, et
> elle rend inaudibles les autres gardes du même job. » Le workflow a été construit exactement
> pour ça, il a fait son travail 90 fois, et le signal est devenu du bruit. **Le problème n'était
> pas l'absence d'alerte, c'était l'absence de lecture.**
>
> ⚠️ Corollaire de méthode : les gardes citées comme « vertes » dans les audits sont les gardes
> **locales** (`typecheck`, `lint`, `check:rls`, `i18n:check`, `test`), toutes rejouables à la
> main. Personne ne vérifiait les jobs **CI**, qui sont un ensemble différent. Un décompte de
> gardes vertes qui ne nomme pas lesquelles ne prouve rien — c'est la même erreur que celle des
> `refetchInterval` du 2026-08-25.

#### ✅ T-48 — le job `e2e` est réparé

Un seul test échouait, reproduit en local : `demo-entreprise.spec.ts › Aperçu`. La liste
« Mes échéances » a été remplacée le 2026-08-27 par la frise « Prochains événements de
l'entreprise » (commits `ce8ac2c`, `e6a873a`) et **le test n'a pas suivi**. Suite complète après
correctif : **62 passés, 3 ignorés, 0 échec.**

> ⚠️ Le correctif embarque un piège qui aurait pu se reproduire : le catalogue écrit
> « l’entreprise » avec l'apostrophe **typographique** (U+2019). Une regex avec l'apostrophe
> droite ne matche jamais, et l'échec ressemble alors à une section absente — c'est-à-dire à un
> bug produit qui n'existe pas. La classe `[’']` est là pour ça, pas par décoration.

#### 🔴 T-49 — `rls-integration` : ce n'est PAS une faille de production

Quatre cas de `org-permissions.test.ts` (mig. 115) échouent sur base vierge, tous avec la même
racine : `chef`, membre non-admin avec un subordonné, n'est pas reconnu comme manager, donc ne
peut ni créer un projet ni déléguer un droit.

**Vérifié en production, sous le rôle réel** (transaction annulée, lecture seule) : pour un membre
non-admin ayant un subordonné, `is_org_manager` renvoie **`true`** et
`my_org_perm(org, 'project.create')` renvoie **`true`**. La production est correcte.

L'écart est donc entre **le dépôt rejoué sur base vierge** et la production — la même famille que
la dérive documentée dans `ARCHITECTURE.md` §5, dans l'autre sens. Diagnostiquer plus loin exige
la stack Supabase locale (Docker), que je n'ai pas ici.

> ⚠️ **Conséquence à énoncer clairement** : `faille.md` porte au crédit de la mig. 115 d'être
> arrivée « avec 337 lignes de test d'intégration contre une vraie base dans le même commit ». Le
> test existe, il est bon, et **il n'a jamais été vert en CI**. Un test rouge qu'on n'ouvre pas ne
> vaut pas mieux qu'un test absent : il coûte en plus la confiance qu'on lui accorde.

#### 🔴 T-50 — `lighthouse` : non diagnosticable d'ici

La phase `collect` échoue avant de produire le moindre rapport (`.lighthouseci/` vide à l'upload),
ce n'est donc pas un seuil trop strict — **T-28 n'est pas la cause**. Non reproductible sur cette
machine : Lighthouse a besoin d'un Chrome, et l'essai avec le Chromium de Playwright meurt sur un
`spawn UNKNOWN` propre à Windows. Le log du run est nécessaire, et il exige une authentification
GitHub (`gh auth login`).

#### Ce que la semaine 3 a donné par ailleurs

- **T-22, moitié technique : saine.** `robots.txt` conforme, `sitemap.xml` à 20 URLs, `lastmod`
  portant de vraies dates de contenu et non celle du build. Le sitemap servi en production est
  **identique** à celui que produit le build courant. La moitié terrain (type de propriété GSC,
  pages indexées, domaines référents) demande tes comptes.
- **T-23 : correction d'une affirmation d'hier.** J'avais mesuré l'activation à la main en la
  présentant comme le premier volet de la tâche. C'était inutile : `get_admin_stats` v3 calcule
  déjà l'activation à 24 h, l'activation à 48 h **par canal d'acquisition** et la rétention J+7
  **par cohorte**, et `/admin` les affiche — la chaîne RPC → repository → types → page est
  complète. *Vérifier qu'une capacité existe avant de la reconstruire*, c'est la version
  symétrique de la règle déjà écrite dans `ARCHITECTURE.md` §4.

### 2026-08-28 (semaine 4) — T-29 : le chemin critique perd 29,6 ko pour tout le monde

| Mesure | Avant | Après |
|---|---|---|
| Chemin critique (**la mesure qui compte**) | 393,9 ko | **364,3 ko** |
| Chunk d'entrée | 106,9 ko | **75,5 ko** |
| Plafond `critical` | 400 000 o | **379 000 o** |
| Plafond `entry` | 112 000 o | **79 000 o** |

**Le plafond redescend, et c'est la moitié de la tâche.** Le 2026-08-26 il avait été relevé de 92
à 112 ko pour absorber une dérive — la seule fois où ce dépôt a remonté un plafond. C'est
remboursé : le cliquet joue dans les deux sens, il attrape la dette puis enregistre son
remboursement.

#### L'outil d'abord, la correction ensuite

`check:bundle` disait QUE le budget dérivait, jamais D'OÙ. La dérive de 19,7 ko en deux jours
n'avait donc pas de coupable nommable, et un budget qu'on ne sait pas expliquer finit toujours par
être relevé. `npm run analyze:entry` rejoue le build et imprime le contenu de l'entrée, par
origine puis par module. Les deux leviers se lisaient en une capture :

1. **`zod`, 131,8 ko bruts, le plus gros module non-React que tout visiteur téléchargeait** — y
   compris celui qui arrive sur la landing et repart sans rien créer. C'est une garde UX,
   explicitement pas la frontière de sécurité, et ses 17 points d'appel sont tous dans une
   `mutationFn` : déjà asynchrones, déjà derrière un geste. Elle se charge maintenant à la
   première écriture (`src/lib/validation/lazy.ts`).
2. **Le `<TooltipProvider>` d'`App.tsx` était redondant.** Le composant `Tooltip` fournit déjà le
   sien, avec le même `delayDuration`. Celui du shell traînait `@radix-ui/react-tooltip` et **tout
   `floating-ui`**, 113 ko bruts, pour **un seul** consommateur réel — `OrgTabBadge`, dans un
   chunk déjà lazy.

> ⚠️ **C'est l'histoire de recharts, à l'identique** : le plus gros poste du chemin critique était
> là par accident, décrit comme « lazy » dans la doc, et personne ne pouvait le nommer faute d'un
> outil pour regarder dedans. *Un budget sans outil de décomposition n'est pas un budget, c'est un
> plafond qu'on relèvera.*

#### Ce que la paresse introduit comme risque, et comment il est fermé

Un import dynamique vers un export inexistant **compile parfaitement** et résout `undefined` :
`import('…').then(m => m.createTaskShema)` ne se verrait qu'au moment où un utilisateur enregistre.
Le registre est donc parcouru en entier par un test qui exige qu'un vrai schéma réponde pour
**chacune des 13 clés**. Vérifié rouge en cassant une clé : le test nomme la clé fautive.

Trois nettoyages au passage : les barrels `organizations`, `team-okrs` et `team-projects`
réexportaient des schémas **sans aucun consommateur** — un export mort qui suffisait à rattacher
zod à tout fichier important le barrel pour une autre raison.

#### Semaine 4 — le reste

- **T-24** : déjà fermé le 2026-08-28 (matin), vérifié en production.
- **T-23 (correction)** : toujours en attente d'une direction produit. La mesure existe et est
  déjà dans `/admin` ; ce qui manque est la décision sur ce que doit faire le premier écran après
  inscription.
- **T-25** (barre d'onglets entreprise sur mobile) et **T-31** (procédure de support) restent
  ouverts.
- **T-21 (vague 2)** : annuaires, hors dépôt.

> ✅ **T-48 confirmé VERT en CI**, pas seulement en local : sur le run de `9d8222e`, le job `e2e`
> conclut `success`. La CI de `main` passe de **trois** jobs rouges à **deux** (`rls-integration`,
> `lighthouse`), `lint-test-build` et `audit` restant verts. Un correctif de test se vérifie là où
> le test tourne pour de vrai, pas sur la machine qui l'a écrit.

### 2026-08-28 (semaine 5) — deux questions ouvertes depuis des semaines, tranchées par la mesure

#### ✅ T-44 — la marque : la réponse est « oui, plusieurs, et en vigueur »

`LEGAL.md` portait cette ligne en ❌ avec la mention « **je ne peux pas la faire** :
`data.inpi.fr` est une application JavaScript non interrogeable ici ». C'était vrai au moment où
ça a été écrit, et ça ne l'est plus : **TMview** (portail de l'EUIPO) agrège INPI-France **et**
EUIPO, soit exactement les deux registres que la ligne exigeait, en une seule requête.

536 résultats balayés pour `COSMO` en offices FR + EM, classes 9 et 42. **21 portent le nom
exactement `COSMO`, dont 11 sont ACTIVES** : 4 en classe 42, 8 en classe 9.

Les deux plus proches de l'activité : **TANAZA S.p.A.** (EM, 2020, classe 9 seule — éditeur de
logiciel en nuage) et **ISTITUTO VENETO DI TERAPIA FAMIGLIARE** (EM, 2024, classes 9 **et** 42,
dépôt récent et très large). Tableau complet et méthode reproductible dans
[`LEGAL.md`](./LEGAL.md) §5.

> ⚠️ **Ce que ce relevé n'est pas.** TMview avertit lui-même que ses données n'ont **aucun effet
> juridique**. Rien ici ne dit que COSMO ne peut pas être utilisé — l'appréciation d'un risque de
> confusion dépend des produits visés, de la notoriété et de la similarité d'ensemble. Ce qui est
> établi, c'est que **le terrain est occupé dans les deux classes**. La suite est une consultation
> de conseil en PI, désormais avec un dossier au lieu d'une page blanche.
>
> `LEGAL.md` passe de 17 à **16 lignes rouges** ; F1 devient 🟡. Le total est revérifié par
> `npm run check:legal`, pas additionné de tête.

#### ✅ T-42 — le pooler : la question ne se posait pas comme on croyait

`SCALABILITY.md` §8 demandait de « confirmer que la prod utilise l'URL pooler ». Mesuré dans
`pg_stat_activity` : **l'application n'ouvre aucune connexion Postgres.** Les 11 connexions
applicatives viennent toutes de **PostgREST** (rôle `authenticator`), qui tient son propre pool
derrière HTTPS — leur nombre **ne dépend pas** du nombre d'utilisateurs connectés.

**14 connexions sur 60**, une seule active. Le pooler ne concerne que les accès DIRECTS
(`npm run test:rls`, l'application des migrations, un futur worker), jamais le chemin de l'app.
Le frein de montée en charge n'est donc pas le nombre de connexions : c'est le pool PostgREST et
le CPU de la base.

> ⚠️ Une inquiétude portée pendant deux semaines dans un audit, levée en une requête — parce que
> personne n'avait regardé QUI se connecte. Le pendant exact de la CI rouge d'hier.

#### Semaine 5 — le reste

**T-32** (immatriculation INPI) et **T-33** (domiciliation) sont des actes administratifs, et le
premier a un délai incompressible : c'est la seule tâche de cette roadmap dont le calendrier ne
dépend pas de nous. **T-21 vague 3** (annuaires) est manuel. **T-26** (unifier les deux
grammaires de filtre entre « Tâches » et « Projets ») reste ouvert.

#### ✅ T-26 — les deux grammaires de filtre n'en font plus qu'une

Le finding disait « deux grammaires de filtre pour la même donnée ». En regardant, la donnée, le
type (`TaskStatusFilter`) et le helper (`filterByStatus`) étaient **déjà partagés** : ce qui
divergeait tenait à un seul geste, le clic sur une pastille **déjà active**. L'onglet Projets la
désactive et revient à « Tout » ; l'onglet Tâches ne faisait rien. Même écran, même objet, deux
réponses au même geste.

L'onglet Tâches adopte donc le geste de l'onglet Projets. **La pastille « Tout » est conservée**,
et ce n'est pas une redondance : elle reste la seule affordance *visible* pour revenir à
l'ensemble. On ajoute un geste, on n'en retire aucun.

> ⚠️ Le témoin du test est plus important que le cas nominal : sans lui, on pourrait « unifier »
> en faisant basculer **aussi** la pastille « Tout » sur elle-même, ce qui la rendrait inerte au
> clic et supprimerait la sortie explicite. *Unifier un geste ne doit pas coûter une sortie.*
> Vu rouge sans le correctif, sur le seul cas attendu.

### 2026-08-28 (semaine 6) — T-41 : le ratio se mesure, le planificateur non

T-34, T-35 et T-36 sont des adhésions et des consoles. Reste T-41, et il demandait d'injecter
2 000 `team_tasks` en production — ce que ce dépôt interdit. Fait à la place ce que le runbook §10
désigne lui-même comme la seule grandeur qui se projette : **le coût par ligne**.

| Chemin | Lignes balayées | Buffers | Buffers / ligne |
|---|---|---|---|
| `team_tasks` en direct, une organisation | 6 | 20 | **3,33** |
| `tasks` en direct, table entière | 717 | 44 | **0,061** |

**Rapport : 54×.** L'audit du 2026-08-14 avait établi « ≈ 60× » par une autre méthode, deux
semaines plus tôt. **Deux mesures indépendantes, même ordre de grandeur** : le chiffre qui
justifie les migrations 113 et 117 tient.

La cause est **structurelle et visible dans le plan**, donc établie à n'importe quel volume : le
chemin direct sur `team_tasks` porte `Filter: can_access_team_project(project_id)`, un appel de
fonction **par ligne examinée**, là où le prédicat de `tasks` est entièrement hissé en `InitPlan`.

> 🔴 **Le piège découvert au passage, et il valait le détour.** À volume actuel, mesurer en
> **millisecondes** donne la réponse **inverse** de la bonne : `select * from tasks` répond en
> 0,219 ms, `get_my_tasks()` en 1,739 ms — huit fois plus lent, alors qu'elle lit **moins** de
> buffers (30 contre 44). À 717 lignes tenant en cache, le coût fixe de l'appel de fonction domine
> tout. Quelqu'un qui chronomètre aujourd'hui conclurait qu'il faut revenir à `.from('tasks')`, et
> il aurait tort : le coût du chemin direct croît avec **la table entière, tous comptes
> confondus** ; celui de la RPC, avec **les seules lignes de l'appelant**. À 7 millions de lignes,
> le premier demande ~427 000 buffers par lecture.
>
> C'est écrit dans `SCALABILITY.md` §9bis parce que c'est exactement le genre de mesure qui, prise
> au sérieux sans son contexte, ferait annuler une bonne décision.

**Ce qui reste non prouvé** : le comportement du **planificateur** à volume — un basculement de
plan ne se déduit pas d'un ratio. Cette vérification demande un vrai jeu de données, sur une
**branche Supabase ou une stack locale, jamais en production**.

Corrigé au passage dans `SCALABILITY.md` §9 : l'item 1 de l'ordre de traitement (« `useTeamOKRs`
en `live` conditionnel, ~15 minutes ») était **déjà fait**, et le document le demandait encore.

### 2026-08-29 · relecture des onze tâches cochées : dix tiennent, une avait cassé la CI

Passe de contrôle demandée : reprendre chaque ligne déclarée faite et la **revérifier à la
source**, sans faire confiance au tableau. Une seule régression trouvée, et elle avait été
introduite par le commit d'une tâche cochée le jour même.

| Tâche | Comment elle a été revérifiée | Verdict |
|---|---|---|
| ✅ T-11 | Introspection prod rejouée : **48 tables, 112 fonctions**, dernière migration appliquée `20260827081458`, donc la 130 toujours pas passée, cohérent avec T-10 ouvert. Ni les migrations ni `check-prod-drift.mjs` n'ont bougé depuis le run du 2026-08-28 : le résultat est nécessairement le même | tient |
| ✅ T-16 | `assets/index-CeOZB_67.js` servi par la prod contient bien le DSN `ingest.de.sentry.io` | tient |
| ✅ T-19 | Les trois fichiers cités sont suivis par git. Ce qui reste hors index appartient à une session voisine (`OrgTabsBar`, `docs/SUPPORT.md`, `db-backup.yml`), pas au périmètre de T-19 | tient |
| ✅ T-20 | `premium-config.ts:160` à `false` **et** `select key, enabled from billing_flags` à `enterprise_seat_limit = false`. Relus séparément, comme l'exige la règle | tient |
| ✅ T-24 | `/version.json` renvoie `{"release":"076b1d1"}` en `max-age=0, must-revalidate`, et le bundle servi porte le **même** `release:"076b1d1"`. Les deux valeurs restent alignées après le déploiement suivant : le mécanisme n'a pas dérivé | tient |
| 🔴 ✅ T-26 | Le comportement est bon (3/3 sur `TeamTasksToolbar.filter.test.tsx`), **le commit ne compilait pas** | régression, corrigée |
| ✅ T-29 | Build complet rejoué : chemin critique **364,4 ko** (plafond 379), entrée **75,5 ko** (plafond 79). Les plafonds sont bien redescendus dans le dépôt | tient |
| ✅ T-30 | Les trois durées sont dans `PolitiqueConfidentialitePage.tsx` §6, avec la mention d'anonymisation du journal d'encaissement | tient |
| ✅ T-42 | `pg_stat_activity` relu : 11 connexions `authenticator`/postgrest, **aucune connexion applicative directe**. La conclusion du 2026-08-28 tient | tient |
| ✅ T-44 | `LEGAL.md` porte le relevé TMview (11 marques actives, tableau et méthode reproductible), F1 en 🟡, et `npm run check:legal` valide la cohérence du tableau : 16 lignes rouges, comme annoncé | tient |
| ✅ T-48 | Pas seulement en local : sur le run CI de `076b1d1`, le job `e2e` conclut **`success`** | tient |

#### 🔴 La régression : T-26 a livré un test qui ne compile pas, et la garde ne l'a pas vu

`f538bc3` annonce « typecheck 0 » dans son message. C'est faux : le test passe à
`TeamTasksToolbar` les **anciens** noms de props (`search`, `onSearch`, `sort`, `onSort`), là où le
composant attend `searchTerm` / `onSearchTerm` / `sortField` / `onSortField` / `sortDirection` /
`onToggleSortDirection`.

> ⚠️ **Pourquoi ça a échappé, et c'est le vrai enseignement.** Le test **passe** en vitest : React
> ignore les props inconnues, et le cas testé, le clic sur une pastille déjà active, n'exerce
> jamais les valeurs manquantes. Seul `tsc -b` tombe. Une suite verte ne dit rien du typecheck, et
> un message de commit qui cite une garde n'est pas la garde.

Constaté **dans la CI, pas déduit** : sur le run de `076b1d1`, `lint-test-build` échoue à l'étape
« Type-check (tsc -b) ». La CI de `main` était donc à **trois** jobs rouges, pas deux, et le
troisième venait d'être créé par le correctif d'une tâche cochée le jour même. Corrigé par
`6d694bf`, et **confirmé vert en CI** sur le run de `5e2ae51`, pas seulement sur la machine qui
l'a écrit : `tsc -b` sort 0, 3/3 sur le fichier, **1 833/1 833** sur la suite, lint 0 erreur,
`check:rls`, `i18n:check`, `check:legal` et `validate:migrations` verts.

> 🔴 **Règle qui manquait à ce dépôt, et qui vient de coûter un job CI** : *une tâche n'est
> vérifiée que si la garde a été rejouée APRÈS la dernière édition du fichier.* Rejouer avant
> l'ultime retouche, puis citer le résultat dans le message de commit, produit exactement la
> confiance non fondée que cette roadmap documente depuis le début, cette fois contre elle-même.

### 2026-08-29 (suite) · six tâches fermées, et la CI cesse d'être muette

Journée d'exécution, pas de mesure. Six lignes fermées, dont trois qui étaient **écrites depuis
la veille et jamais posées sur `main`** : le dépôt les ignorait donc, exactement le cas que T-19
avait déjà eu à traiter.

| Tâche | Résultat |
|---|---|
| ✅ **T-25** | Barre d'onglets entreprise sur mobile. À 375 px, sept destinations dans 335 px visibles : l'onglet actif d'un lien profond `?tab=members` est ramené dans le champ, et des dégradés de bord disent qu'il reste des onglets. **Témoin exécuté** : les deux tests Playwright échouent contre l'ancienne barre inline, passent contre la nouvelle. Suite entreprise : 6/6 |
| ✅ **T-31** | `docs/SUPPORT.md` : par où arrivent les demandes, qui répond, sous quels délais, ce qu'on vérifie avant de répondre, et à partir de quand ce n'est plus du support mais un incident. Les deux délais qui ne sont pas des conventions y sont nommés : la demande RGPD (un mois, art. 12) et la perte de données (l'incident s'ouvre avant la réponse) |
| 🟡 **T-46** | Export mensuel `pg_dump` hors fournisseur, en workflow. Il **vérifie ce qu'il produit** (taille plancher, puis `pg_restore --list`, parce qu'un fichier vide est le mode de défaillance classique d'une sauvegarde), et sans le secret `SUPABASE_DB_URL` il s'arrête en avertissement plutôt qu'en échec. Reste le secret, côté Axel |
| ✅ **T-50** | Le job `lighthouse` mesure enfin. Deux causes, aucune n'exigeait `gh auth login` |
| ✅ **T-28** | Seuils posés sur le premier run réel, dans les deux sens |
| ✅ **T-45** | `TaskTable` : 1 124 → 890 lignes, budget du cliquet 10 185 → 9 949 |
| 🟡 **T-49** | Une cause certaine corrigée, le reste instrumenté pour se nommer au prochain run |

#### 🔑 Le déblocage de la journée : les annotations d'un run sont publiques

T-50 était classée « bloquée sur un outil absent », parce que le log d'un run exige une
authentification GitHub même sur un dépôt public. C'est vrai du **log** et du **résumé de job**.
Ça ne l'est pas des **annotations** : `GET /repos/:o/:r/check-runs/:id/annotations` répond sans
jeton. Elles portent déjà les échecs de vitest, et un job peut y écrire ce qu'il veut avec
`::error::` ou `::notice::`.

Conséquence immédiate, et elle vaut au-delà de ces deux tâches : **un agent sans compte GitHub
peut lire ce que la CI a trouvé.** Les deux jobs rouges du dossier ont été diagnostiqués dans la
foulée, sans jamais ouvrir l'interface.

#### ✅ T-50 · deux causes, dont une qui accusait un défaut inexistant

1. **Chrome ne démarrait pas.** Le runner en a pourtant trois (Chrome 151 et Chromium), ce que le
   job dit maintenant lui-même dans une annotation. Ubuntu 24.04 restreint les espaces de noms non
   privilégiés, donc le bac à sable de Chrome : `--no-sandbox --disable-dev-shm-usage`.
2. **Lighthouse mesurait la page « introuvable » de quatre pages qui existent.** La configuration
   visait `/guide/index.html` ; le routeur ne connaît pas cette forme, la SPA rend donc sa 404, et
   la 404 se marque `noindex`, ce qu'on lui demande. D'où `categories.seo` à **0,66**, sur une
   page dont le fichier prérendu porte `index, follow`. Mesuré des deux côtés, même build :
   `/guide/index.html` = 0,66 · `/guide/` = **1,00**.

> 🔴 **Une gate rouge qui pointe un défaut inexistant est pire qu'une gate absente** : elle
> apprend à ignorer sa propre sortie. C'est la même leçon que les 90 commentaires de l'issue #44,
> par un autre chemin.

Deuxième correctif structurel : `autorun` enchaîne collect → assert → upload, donc **une
assertion rouge empêchait l'upload**, et le job qui mesure ne rendait aucun chiffre précisément
quand on en avait besoin. Les trois phases sont séparées, et le relevé des scores tourne en
`always()`, en annotation publique.

#### ✅ T-28 · les seuils descendent, et deux montent

Premier run réel (deux passes par page, valeur la plus basse retenue) :

| Page | perf | a11y | best-practices | seo | LCP | TBT |
|---|---|---|---|---|---|---|
| `/` | **55** | 93 | 100 | 100 | 1 483 ms | **1 068 ms** |
| `/blog/` | 97 | 99 | 100 | 100 | 1 149 ms | 0 ms |
| `/guide/` | 96 | 96 | 100 | 100 | 1 229 ms | 0 ms |
| `/en/` | 53 | 93 | 100 | 92 | 1 506 ms | 1 116 ms |

Les seuils bloquants ne portent que sur des mesures **déterministes** : a11y 0,92 · seo 0,92 ·
best-practices 0,97 · CLS 0,02. Ceux qui varient avec le runner restent en avertissement.

> ⚠️ **Deux seuils ont été DESSERRÉS, et c'est délibéré** : performance (0,80 → 0,50) et TBT
> (300 ms → 1 700 ms) étaient posés **sous** le réel, donc en avertissement permanent. Un budget
> qu'on ne peut pas tenir ne mesure rien non plus. Ils deviennent un cliquet à la valeur réelle.
> Le vrai sujet reste entier et il est nommé : **la landing est à 55 de performance avec plus
> d'une seconde de blocage du fil principal**, quand le guide et le blog sont à 96. C'est une
> tâche produit, pas un seuil.
>
> Corrigé au passage, et c'est le même piège que dans `playwright.config.ts` : Lighthouse
> annonçait `en-US`, la racine redirigeait vers `/en/`, et le job mesurait l'anglais en croyant
> mesurer `/pour-freelances/`. Chrome reçoit désormais `--lang=fr-FR`.

#### ✅ T-45 · la première coupe volontaire du socle

`TaskTable` : **1 124 → 890 lignes**, budget du cliquet **10 185 → 9 949**. Deux extractions,
`TaskQuickFilters` et `TaskBulkActionsBar` ; aucune des deux ne connaît une tâche. Un vrai défaut
part avec : l'état du menu « ⋯ » vivait dans `TaskTable`, ce qui obligeait **cinq** gestionnaires
métier à le refermer à la main. Il vit maintenant dans la barre, qui disparaît avec le mode
sélection.

Vérifié **dans le navigateur**, parce qu'aucun test ne couvre cette barre : mode sélection, une
tâche cochée, menu « ⋯ », sous-menu Catégorie, catégorie appliquée, sortie automatique du mode,
zéro erreur console. Plus 1 833/1 833 et les quatre specs e2e du parcours tâches.

#### 🟡 T-49 · une cause certaine, et une question mieux posée

**Corrigé** : le test posait les lignes de permissions sous `service_role`, qui contourne la RLS
mais **pas les triggers**. La garde de plafond s'exécutait donc avec `auth.uid()` NULL et refusait
par « cannot grant a permission you do not hold ». Le décor passe par un admin réel.

**Éliminé, par comparaison une à une contre la production via l'API** : `is_org_admin`,
`is_org_member`, `is_org_manager`, `has_subordinates`, `my_org_perm`,
`enforce_org_permission_ceiling` et la policy `team_projects_insert` sont **identiques** entre le
dépôt et la prod.

**Éliminé aussi, par la mesure du run suivant** : les vérifications de décor ajoutées au
`beforeAll` sont passées. Sur base vierge, la base reconnaît bien le patron comme admin et le chef
comme manager. Le décor n'est pas faux.

Restent trois échecs, tous sur `team_projects` en INSERT, par trois utilisateurs dont un admin.
La policy est une conjonction, et Postgres ne dit jamais laquelle des deux moitiés a refusé. Elles
sont désormais séparées dans le test : au prochain run, l'annotation nommera la moitié fautive.

> ⚠️ Deux commits de cette tâche n'ont **pas** pu être exécutés ici : le harnais demande une stack
> Supabase locale, donc Docker, absent de cette machine. Dit tel quel dans les deux messages de
> commit. Le job étant déjà rouge, ils ne peuvent pas le rendre plus rouge, et ils le rendent
> lisible.

#### ✅ Confirmation, et une correction de ma propre affirmation

Le run de `ac139a0` conclut **`lighthouse` en `success`** avec les seuils resserrés, et
`lint-test-build`, `e2e`, `audit` verts. **Un seul job reste rouge sur `main` : `rls-integration`.**

| Page | perf | a11y | best-practices | seo |
|---|---|---|---|---|
| `/` | 60 | 97 | 100 | 100 |
| `/blog/` | 97 | 99 | 100 | 100 |
| `/guide/` | 96 | 96 | 100 | 100 |
| `/en/` | 54 | 93 | 100 | 92 |

> ⚠️ **Ce que j'ai écrit plus haut sur `--lang=fr-FR` était trop affirmatif.** Je l'ai présenté
> comme la correction d'une page mesurée en anglais. Le run suivant mesure toujours `/en/` et
> jamais `/pour-freelances/` : le drapeau n'a pas fait ce que j'annonçais. La vraie cause était
> ailleurs, et elle est ci-dessous.

#### 🔴 Trouvé en mesurant autre chose : une barre finale perdait quatre pages

`https://thecosmo.app/pour-freelances/` sert le fichier prérendu, puis **l'application renvoie
vers l'accueil**. Vérifié en production, pas déduit. Sans la barre finale, la page s'affiche.

Ce n'est pas le routeur : React Router fait bien correspondre `/pour-freelances/` à la route, la
page se **monte**. Elle se perd ensuite seule, en cherchant la fiche du slug « pour-freelances/ »
qui n'existe pas. Une ligne qui retirait la barre du début et pas celle de la fin.

> 🔴 **Pourquoi ça compte cette semaine précisément** : les annuaires normalisent presque tous les
> URL avec une barre finale, et leurs soumissions (T-21) sont le seul levier d'acquisition de ces
> 60 jours. Chaque backlink obtenu à la main aurait envoyé son visiteur sur l'accueil au lieu de
> la page qui le concerne, **sans erreur, sans 404, sans trace**. Quatre pages : freelances,
> étudiants, managers, équipes.
>
> Personne ne cherchait ce défaut. Il est tombé parce qu'une gate s'est mise à mesurer pour de
> vrai : Lighthouse visait `/pour-freelances/` et rapportait la page d'accueil.

Correctif et test témoin livrés. **Prédiction vérifiable au prochain run** : le job doit
maintenant rapporter `/pour-freelances/` à la place de `/en/`. Si `/en/` revient, la cause du
choix des URL est ailleurs et reste à trouver.

#### ✅ Prédiction vérifiée, et la dernière inconnue de la mesure levée

Run de `155f103` : le job rapporte **`/pour-freelances/` perf 97 · a11y 99 · seo 100**, à la place
de `/en/`. Le correctif de la barre finale tient, et il tient pour la raison annoncée.

Reste une ligne qui ne correspond pas à la configuration : la racine `/` est rapportée comme
`/en/`. Explication trouvée dans le code plutôt que devinée : `detectLocale()` lit
`navigator.languages` (`src/i18n/locale.ts`), Chrome annonce `en-US`, et la détection redirige la
racine. **Les scores de landing cités jusqu'ici, perf 53 à 60 et TBT jusqu'à 2,3 s, sont donc ceux
de la version anglaise.** `--lang` fixe la langue de l'interface de Chrome, pas ce que la page
voit : c'est `--accept-lang` qui pilote `navigator.languages`, et c'est lui qui manquait.

> ⚠️ **Deux fois de suite, la même erreur de méthode évitée de justesse** : j'ai d'abord annoncé
> `--lang` comme un correctif, puis constaté qu'il n'avait rien changé. Cette fois le drapeau est
> choisi en lisant la fonction qui décide, pas en supposant ce qu'elle lit. La prédiction reste
> écrite : au prochain run, la première ligne doit dire `/` et non `/en/`.

**État CI après cette journée : un seul job rouge sur `main`**, `rls-integration` (T-49).
`lint-test-build`, `audit`, `e2e` et `lighthouse` sont verts.

#### ✅ Seconde prédiction vérifiée, et un seuil que je viens de mal poser

Run de `a46cdd0` : la racine est mesurée comme **`/`**, plus comme `/en/`. `--accept-lang` fait ce
que `--lang` ne faisait pas, et le drapeau avait été choisi en lisant `detectLocale()` plutôt qu'en
supposant. Les quatre URL configurées sont enfin celles qui sont mesurées, en français.

| Page | perf | a11y | seo | TBT |
|---|---|---|---|---|
| `/pour-freelances/` | 97 | 99 | 100 | 0 ms |
| `/blog/` | 97 | 99 | 100 | 0 ms |
| `/guide/` | 96 | 96 | 100 | 0 ms |
| **`/`** (landing FR) | **55** | 93 puis **97** | 100 | 934 puis **1 521 ms** |

> ⚠️ **Le seuil d'accessibilité que j'ai posé ce matin est mauvais, et c'est la mesure qui le
> dit.** La même page, le même build, deux passes : **93 puis 97**. Quatre points d'écart. Un
> seuil bloquant à 0,92 se trouve donc *à l'intérieur du bruit* : il transforme la gate en pile ou
> face, et la première rougeur qui n'est pas une régression apprendra à ignorer le job. Il
> redescend à 0,90. Les trois autres seuils bloquants restent posés au réel, parce qu'eux ne
> bougent pas d'une passe à l'autre.
>
> L'écart lui-même est une information qu'on ne suivra pas aujourd'hui : quelque chose se rend
> différemment d'une passe à l'autre sur la landing, et fait varier son score.

#### 🆕 T-51 · la landing est la seule page lente du site

Elle est à **55 de performance** avec jusqu'à **1,5 s de blocage du fil principal**, quand le blog
et le guide sont à 96-97 **sur le même build**. Ce n'est donc pas le socle, c'est cette page — la
seule à charger GSAP et ses animations.

Ça n'a pas pu être vu plus tôt : jusqu'à ce matin le job mesurait la version anglaise, et avant ça
il ne mesurait rien du tout. C'est la première chose que voit un visiteur venu d'un annuaire, donc
le premier écran du seul canal d'acquisition ouvert dans ces 60 jours. Inscrit en P3, semaine 8 :
c'est réel, ce n'est pas bloquant pour le GO.

### 2026-08-29 (fin) · T-49 : la cause est trouvée, et elle n'était pas où trois semaines l'avaient cherchée

**Le rejeu a tranché.** Le script `scripts/diagnose-rls-state.mjs` rejoue le cas exact sur la base
fraîche, sans l'application : rôle `authenticated`, `auth.uid()` forgé comme le fait PostgREST, et
la même insertion sous trois formes. Mesuré en CI :

```
rejeu : auth.uid()=1111…  is_org_admin=true  my_org_perm=true
rejeu nue           : ACCEPTE
rejeu returning     : REFUSE 42501 new row violates row-level security policy
rejeu cte-postgrest : REFUSE 42501 new row violates row-level security policy
```

**La base est correcte, le replay des migrations aussi.** Ce qui refuse, c'est la **relecture**.

`.insert(...).select()` demande à PostgREST la représentation de la ligne écrite, donc une lecture
soumise à la policy de SELECT : `can_access_team_project(id)`, une fonction qui va rechercher cette
ligne **dans la table**. Une ligne insérée dans la même commande n'y est pas encore visible. La
relecture échoue, et PostgREST rend l'erreur RLS de l'insertion. **Le message accuse l'écriture,
le refus vient de la relecture.**

> 🔴 **Et l'application le savait déjà.** `createProject` génère l'id côté client et n'appelle
> jamais `.select()`, avec le commentaire qui l'explique, daté du bug #9
> (`src/modules/team-projects/supabase.repository.ts`). **Le test n'éprouvait donc pas le chemin
> du produit** : il exerçait une forme d'appel que l'application n'utilise nulle part, et son échec
> ne disait rien de la sécurité. C'est le pire état possible pour une garde : rouge, alarmante, et
> sans rapport avec ce qu'elle prétend protéger. `faille.md` portait pourtant ce test au crédit de
> la migration 115.

Ce qui a été éliminé en chemin, et qui vaut d'être noté parce que **rien de tout ça n'était en
cause** : les définitions SQL (comparées une à une contre la production), le décor sur base vierge
(vérifié par le test lui-même), les deux moitiés du `WITH CHECK` (vraies séparément), les
privilèges de table, les propriétaires de fonctions, les `DEFAULT` de colonnes et les triggers.

#### Deux leçons de méthode, et la seconde a coûté un run

1. **Décrire atteint une limite ; rejouer tranche.** Comparer des définitions a éliminé des
   hypothèses pendant trois semaines sans en confirmer une seule. Une reproduction de vingt
   lignes, dans une transaction annulée, a donné la réponse au premier essai.
2. **GitHub plafonne les annotations à DIX par étape, silencieusement.** La première version du
   diagnostic en émettait seize, une par ligne : les six coupées étaient exactement celles qu'on
   allait chercher. Corollaire à retenir pour ce dossier : les décomptes « 4 cas » puis « 3 cas »
   en échec étaient peut-être tronqués eux aussi. **Un total lu dans une liste plafonnée n'est pas
   un total.**

#### Ce qui reste, dit sans l'enjoliver

Le job **est toujours rouge**, et cette fois **sans aucune annotation de test** : la sortie est non
nulle alors qu'aucun cas n'échoue nominalement. C'est un autre mode de défaillance (crash à
l'import, rejet non géré, hook cassé), et il était invisible parce que l'étape n'écrivait sa fin de
journal que dans le résumé de job, lisible seulement dans l'interface. Elle l'émet désormais aussi
en annotation, comme le job `lighthouse`.

**État CI au 2026-08-29 : quatre jobs verts sur cinq.** `lint-test-build`, `audit`, `e2e` et
`lighthouse` passent ; `rls-integration` reste rouge, pour une cause qui se nommera au prochain run.

### 🟢 2026-08-29, fin · les cinq jobs CI sont verts sur `main`

```
lint-test-build -> success
audit           -> success
e2e             -> success
rls-integration -> success
lighthouse      -> success
```

Run de `493ccaf`. **Premier run entièrement vert depuis au moins le 2026-08-24**, et la condition
n° 7 du GO tombe. `rls-integration`, lui, n'avait **jamais** été vert depuis sa création le
2026-06-21.

#### Ce qui bloquait vraiment, job par job

| Job | Ce qu'on croyait | Ce que c'était |
|---|---|---|
| `lint-test-build` | vert | rouge depuis le commit de T-26 : un test passait des props inexistantes, invisible en vitest, fatal à `tsc -b` |
| `e2e` | rouge sur un bug produit | un titre renommé la veille, le test non suivi |
| `lighthouse` | seuils trop stricts | Chrome refusait de démarrer (bac à sable), puis la config mesurait une page 404 |
| `rls-integration` | une faille de RLS, ou une dérive dépôt / prod | **deux tests faux**, dans deux fichiers : `.insert().select()` que le produit n'utilise pas, et une colonne `status` qui n'existe nulle part |

> 🔴 **Aucun des cinq jobs n'était rouge à cause du produit.** Cinq gardes en échec, cinq causes
> dans les gardes elles-mêmes. C'est rassurant sur le code et inquiétant sur la méthode : une garde
> qu'on n'exécute pas avant de la commiter n'est pas une garde, c'est une déclaration d'intention.
> Deux des quatre correctifs de la journée portent sur des fichiers **posés sur `main` sans avoir
> jamais tourné**, faute de Docker sur la machine qui les écrivait.
>
> La leçon utile n'est pas « avoir Docker ». C'est : **si une garde ne peut pas être exécutée
> localement, elle doit être exécutée en CI AVANT d'être invoquée comme preuve**, et son premier
> run doit être regardé, ce que trois semaines de rouge montrent qu'on ne faisait pas.

#### Ce qui reste vrai malgré ce vert

Le GO reste bloqué par six conditions, et **aucune n'est du code** : PITR et drill de restauration,
SMTP applicatif puis vérification d'adresse, les cinq réglages de console, la migration 130
appliquée, le webhook d'alerte, et la chaîne `?ref=` prouvée sur un compte réel.
