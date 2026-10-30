<!-- note-audit: couvert-par=LEGAL.md -->
# Audit juridique avant déploiement · 2026-10-13

> **Ce n'est pas un avis juridique.** Rédigé par un assistant, pas par un avocat. Il sert à ne
> rien oublier et à savoir quoi demander à un professionnel. Chaque constat ci-dessous a été
> **vérifié dans le code, la configuration ou en ligne le 2026-10-13**, sauf mention « non
> vérifié ». Point de départ : le produit publié (textes de `legalTerms.json`,
> `legalPrivacy.json`, `legal.json`, code client, Edge Functions, workflows), pas le tableau de
> `docs/LEGAL.md`.
>
> 🔴 **NE PAS COMMITTER CE FICHIER tant que le constat P0-1 n'est pas refermé.** Le dépôt est
> public : publier ce rapport reviendrait à indiquer où se trouvent les sauvegardes.

**Hypothèse de l'audit** : tu déploies aujourd'hui, dans l'état actuel (facturation désarmée,
`ENTERPRISE_BILLING_ENFORCED = false`, clé Stripe de test, aucune structure juridique).

---

## ✅ État après correctifs (même jour, 2026-10-13)

| Constat | État | Preuve |
|---|---|---|
| P0-1 sauvegardes publiques | ✅ **Exposition refermée.** Dump chiffré avant dépôt (`8c6a971d`), run `38392672092` vert (paquet `8c`, aller-retour sha256), 29 dumps en clair supprimés, l'API publique ne liste plus qu'un artefact, chiffré. ⏳ Restent à Axel : sessions, mot de passe de la base, décision CNIL, information des personnes (`M-68` à `M-71`) | registre privé hors dépôt |
| P1-1 mentions légales | 🟡 Vercel (Covina, relu à la source), clause d'irresponsabilité supprimée, propriété corrigée. ⏳ adresse et téléphone (`M-72`) | `legal.json` |
| P1-2 immatriculation | ⏳ geste d'Axel (`M-73`) | |
| P1-3 traceurs | ✅ sous consentement, effacés au refus, valeurs anciennes jamais rattachées ; bandeau réécrit | 4 fichiers de test, vérifié au navigateur (accepter, retirer, démo refusée) |
| P1-4 inscription Google | ✅ mention en mode connexion | `AuthForm.legal.test.tsx`, vu au navigateur |
| P1-5 préavis | ⏳ `M-63`, enrichi par `M-75` | |
| P1-6 politique | ✅ réécrite point par point (fr, en) | journal `2026-10-13`, vu au navigateur |
| P1-7 DPA | ⏳ `M-64` corrigé (Sentry n'attend rien ; Vesk identifié, DPA publié) ; Vercel `M-74` | |
| P1-8 liens dans l'app | ✅ Paramètres, onglet « Mes données » | vu au navigateur |
| P2-1 information précontractuelle | 🟡 identité et garantie de conformité dans les CGU ; ⏳ adresse, téléphone, médiateur (`M-72`, `M-76`) | |
| P2-2 FAQ entreprise | ✅ réécrite, notice d'adhésion complétée | `OrgConsentNotice.test.tsx` |
| P2-3 marque | ⏳ `M-66` | |
| P2-4 publicité comparative | ✅ « seule application » retiré, article daté, sourcé, corrigé | |
| P2-5 clauses CGU | ✅ 9.1, 7, 12.3 ; ⏳ relecture juriste `M-67` | |
| P2-6 Sentry URLs | ✅ `src/lib/sentry-scrub.ts` | 10 tests dont un témoin |
| P2-7 personnes invitées | ✅ pied d'e-mail + politique ; ⏳ redéploiement de `send-org-invite` | |
| P2-8 Vesk en double | ⏳ décision produit (Vesk gardé le 2026-08-18) ; identité et DPA désormais connus | |
| P3-1 `ads.txt` | ✅ supprimé | |
| P3-2 e-mails de digest | ✅ rien à faire : le pied dit déjà pourquoi on les reçoit et renvoie aux préférences | |
| P3-3 à P3-7 | inchangés (risque accepté, ton éditorial, exemption EAA, hors dépôt) | |
| Comptes inactifs | 🟡 règle publiée (3 ans), traitement à construire : `C-121` | |

### 🔎 Revérifié le 2026-10-15 (passe d'audit complète, `docs/README.md`)

| Constat | Ce qui a bougé | Preuve |
|---|---|---|
| P0-1 sauvegardes | ✅ `db-backup` vert et **chiffré** les 10-13 et 10-14. ⚠️ Le dépôt a été **privé** du 10-13 au 10-14 (21:51 UTC), puis rendu public. ⏳ `M-68` à `M-71` non vérifiables par l'agent (lecture de `auth.sessions` refusée), toujours ouverts à `a-faire-manuel.md`. **`M-69` : avant le 2026-10-16 vers 11 h UTC** | runs `db-backup` ; API GitHub, `visibility` |
| P0-1, effet sur les notes | Sécurité **84 → 82**, RGPD **87 → 84** : la violation est entrée dans les deux notes | `faille.md`, `docs/RGPD.md` |
| P0-1, documentation | `docs/DEPLOYMENT.md` § 7 répétait encore la phrase fausse du workflow (« les artefacts exigent une authentification ») : **corrigée** | `docs/DEPLOYMENT.md` |
| P0-1, restauration | 🔴 `restore-drill.yml`, seul workflow qui déchiffre un dump pour le restaurer, est **désactivé depuis le 2026-09-01** : aucune restauration d'un dump chiffré n'a été jouée | API GitHub, `disabled_manually` |
| P2-7 personnes invitées | ✅ `send-org-invite` **redéployée** (v3, 2026-10-13 à 12:34 UTC), `Edge deploy drift` vert le 10-14 | API Supabase, Edge Functions |
| `org_member_roles` (mig. `219`) | 🔴 table neuve, `user_id` sans décision d'effacement ni d'export : `check:erasure` et `check:portability` rouges à `HEAD` | `docs/RGPD.md` |
| Fichier | Toujours **non commité**, conformément à `M-77` | `git status` |

### 🔎 Revérifié le 2026-10-18 (dernière passe avant l'acquisition, `docs/README.md`)

| Constat | Ce qui a bougé | Preuve |
|---|---|---|
| P0-1 sauvegardes | ✅ `M-68` fait (10-16), `M-69` notifié, tardif, `M-70` décidé par écrit. 🔴 `M-71` : le fichier de la phrase secrète est **toujours présent** dans le coffre (existence relue, contenu non lu) | `faille.md` § `BK-1` |
| P1-1 mentions légales | 🟡 adresse publiée (domiciliation, `ab0ad655`). ⏳ **téléphone** absent, SIREN absent | `src/locales/fr/legal.json` |
| P1-2 immatriculation | ⏳ `M-73` : **à faire avant de lancer la prospection** | |
| P1-7 DPA | ⏳ Sentry, Resend, Vercel ; **deux de plus** avec la prospection (T11) : Anthropic et IONOS | `RGPD-REGISTRE.md` T11 |
| P2-8 Vesk en double | ✅ **résolu** : Vesk débranché le 2026-10-18 (`23a12fdb`), mesure d'audience internalisée, sans IP stockée | `faille.md` § `V-1` |
| Prospection B2B (nouveau, T11) | 🟠 la politique de confidentialité n'en dit rien ; l'information de l'art. 14 repose sur chaque email, non relu ici | `legalPrivacy.json` |
| `M-77` | ✅ condition remplie (`M-68` fait) : la publication de ce fichier est désormais une décision d'Axel | |

---

## Synthèse

| Priorité | Nombre | Sens |
|---|---|---|
| 🔴 P0 | 1 | Violation de données **en cours**. À traiter aujourd'hui, avant toute autre chose |
| 🔴 P1 | 8 | Non-conformités actives, exposées dès qu'un visiteur arrive. À régler avant de lancer l'acquisition |
| 🟠 P2 | 8 | Risques réels mais moins probables, ou qui demandent un professionnel |
| 🟡 P3 | 7 | Hygiène, incohérences, à planifier |
| ⏸️ Dormant | 6 | Ne s'applique qu'au premier euro. Ne jamais réarmer la facturation sans eux |

---

## 🔴 P0 · Violation de données en cours

### P0-1 · Les sauvegardes complètes de la base sont téléchargeables par n'importe quel compte GitHub

**Constat vérifié.**

- `.github/workflows/db-backup.yml` lance chaque jour un `pg_dump` **complet** de la base de
  production (`--format=custom`, sans filtre de schéma, avec la chaîne de connexion
  `postgres`), puis le dépose en **artefact GitHub Actions** (`db-dump`, rétention 30 jours),
  **sans chiffrement**.
- Le dépôt `kelax12/COSMO1.2` est **public** (`"visibility": "public"`, API GitHub, 2026-10-13).
- L'API publique liste, **sans authentification**, **29 artefacts `db-dump` non expirés**
  (le plus récent du 2026-10-12, ~560 ko).
- La documentation GitHub : peut télécharger un artefact toute personne **connectée à GitHub
  et ayant l'accès en lecture au dépôt**. Sur un dépôt public, cela veut dire **n'importe quel
  compte GitHub gratuit**.
- Le commentaire du workflow affirme l'inverse (« les artefacts d'un run ne le sont pas ») :
  **c'est faux** pour un dépôt public.

**Ce que contient probablement chaque dump** (non vérifié : je n'ai volontairement pas
téléchargé de données personnelles) : un `pg_dump` sans `--schema` exporte aussi le schéma
`auth`, donc les adresses e-mail, les **empreintes bcrypt des mots de passe**, les identités
Google et les **jetons de rafraîchissement de session** ; plus le profil, toutes les tâches,
habitudes, événements, OKR, commentaires d'équipe et données d'organisation.

**Pourquoi c'est un P0.** Une mise à disposition de données personnelles à des personnes non
autorisées est une **violation de données** au sens de l'article 4.12 du RGPD, même sans
preuve qu'un tiers ait téléchargé. Le délai de **72 heures** de l'article 33 court à partir du
moment où le responsable de traitement en a connaissance, c'est-à-dire **aujourd'hui**. Ta
propre procédure est prête : [`docs/RGPD-VIOLATION.md`](../RGPD-VIOLATION.md). L'article 32
(sécurité) est aussi en cause, et la politique de confidentialité, la FAQ (« personne d'autre
ne peut accéder à vos tâches ») et l'annexe art. 32 de `LEGAL.md` deviennent inexactes.

**Marche à suivre, dans l'ordre :**

1. **Supprimer les 29 artefacts `db-dump`** (onglet Actions, ou `gh api -X DELETE
   repos/kelax12/COSMO1.2/actions/artifacts/<id>`), puis vérifier que la liste est vide.
2. **Désactiver le workflow** `db-backup` tant qu'il n'est pas corrigé. Correctif : chiffrer le
   dump avant dépôt (`age` ou `gpg` avec une clé publique dont seule ta clé privée hors ligne
   ouvre le fichier), ou l'envoyer vers un stockage privé, ou rendre le dépôt privé. Vérifier
   aussi `restore-drill.yml`.
3. **Révoquer toutes les sessions** (les jetons de rafraîchissement du dump restent utilisables
   tant qu'ils ne sont pas révoqués) et changer le mot de passe de la base, par précaution.
4. **Documenter dans le registre des violations** (obligatoire même sans notification, art.
   33.5) : période d'exposition (depuis la mise en service du workflow, fin août 2026),
   catégories de données, nombre de personnes (~30 comptes), mesures prises.
5. **Décider de la notification à la CNIL sous 72 h.** Avec e-mails, empreintes de mots de
   passe et contenu libre des tâches, l'absence de risque est difficile à soutenir : la
   notification paraît due. Une notification peut être complétée ensuite.
6. **Informer les personnes (art. 34)** si le risque est jugé élevé. Un e-mail court, honnête,
   qui recommande de changer son mot de passe, est la réponse la plus défendable.
7. Seulement après : corriger le commentaire du workflow, la FAQ et l'annexe art. 32.

> GitHub ne fournit pas au propriétaire d'un dépôt personnel la liste des téléchargements
> d'artefacts : on ne pourra pas prouver qu'**aucun** tiers n'a téléchargé. Le raisonnement
> doit donc partir de « exposé », pas de « consulté ».

---

## 🔴 P1 · Non-conformités actives dès la mise en ligne

### P1-1 · Mentions légales incomplètes et partiellement fausses

Fichier : `src/locales/{fr,en}/legal.json` (section `notice`).

| Manque ou erreur | Texte de référence | Gravité |
|---|---|---|
| **Pas d'adresse (domicile) de l'éditeur** | LCEN art. 1-1, I (ex-6-III, renuméroté par la loi SREN du 21 mai 2024) : nom, prénoms, **domicile et téléphone** pour une personne physique | Élevée |
| **Pas de téléphone de l'éditeur** | idem | Élevée |
| **Pas de téléphone des hébergeurs** | LCEN art. 1-1 : nom, adresse **et téléphone** de l'hébergeur | Moyenne |
| **Adresse de Vercel probablement périmée** : « 340 Pine Street, San Francisco ». Les sources récentes donnent 440 N Barranca Ave #4133, Covina, CA 91723 | exactitude | Faible, à vérifier sur vercel.com |
| s4.p2 : « Cosmo ne saurait être tenu responsable des dommages directs ou indirects » | Clause noire R212-1 6° C. conso, et **contredit l'art. 9 des CGU** réécrit le 2026-09-24 | Moyenne |
| s3.p1 : contenus, y compris les « **données** », « propriété exclusive de **Cosmo** » | « Cosmo » n'est pas une personne juridique, et les données des utilisateurs leur appartiennent (CGU art. 6) | Faible |

**Le nœud du problème** : tu ne veux pas publier ton domicile, mais l'anonymat de
l'article 1-1, II est réservé aux éditeurs **non professionnels**, et COSMO publie des tarifs.
La seule sortie propre est **immatriculation + société de domiciliation**, dont l'adresse
remplace le domicile. Sanction encourue pour défaut de mentions : jusqu'à un an
d'emprisonnement et 75 000 € d'amende (LCEN art. 1-2), en pratique rarement poursuivi seul,
mais c'est la première chose qu'un concurrent ou un contrôleur regarde.

### P1-2 · Activité commerciale annoncée sans immatriculation

La landing entreprise affiche des prix (« 20 € par mois pour dix personnes »), une « offre de
lancement » et des tarifs futurs, et fait de la publicité (vidéos, blog, annuaires). Aucun euro
n'est encaissé, donc il n'y a pas de travail dissimulé **aujourd'hui**. Mais l'article L8221-4
du Code du travail présume lucrative une activité exercée avec recours à la publicité en vue de
rechercher une clientèle. Le risque est faible tant que tout est gratuit, mais **l'immatriculer
avant de lancer l'acquisition** (gratuit en micro-entreprise) règle d'un coup P1-1, P1-2, la
question des DPA et la domiciliation. C'est le geste qui débloque le plus de lignes.

### P1-3 · Deux traceurs posés SANS consentement, et le bandeau dit le contraire

Article 82 de la loi Informatique et Libertés : toute lecture ou écriture sur le terminal qui
n'est pas strictement nécessaire au service demandé exige le consentement préalable.

| Traceur | Ce qu'il fait | Code |
|---|---|---|
| `cosmo_demo_device_id` | UUID persistant en `localStorage`, posé à chaque lancement de la démo, envoyé au serveur (`record_demo_visit`), puis **rattaché au compte** à l'inscription (`converted_user_id = auth.uid()`). Survit aux réinitialisations de la démo | `src/lib/demo-metrics.ts`, mig. `055` |
| `cosmo_first_touch` | Capture `?ref=` / `utm_*` au premier chargement, le garde 30 jours, puis l'**écrit sur le profil** à l'inscription (metadata `signUp`, RPC `claim_acquisition_source`) | `src/lib/attribution.ts`, `src/modules/auth/acquisition-claim.ts`, mig. `097`, `217` |

Aucun des deux ne lit `hasConsented()`. Ils ne relèvent pas de l'exemption CNIL de mesure
d'audience, dont une condition est de produire des **statistiques anonymes** sans recoupement :
ici, les deux finissent **rattachés à un compte nominatif**.

Aggravant : le bandeau affiche « Si vous refusez, seuls les éléments strictement nécessaires
au service sont utilisés (session, préférences) » (`common.json`, `cookies.ifYouRefuse`). C'est
**inexact**. Un bandeau qui ment est pire que pas de bandeau (ton propre commentaire en tête de
`cookie-consent.ts`).

**Correctifs possibles** (au choix) :
- conditionner les deux écritures à `hasConsented()` ;
- ou ne plus rien rattacher au compte (compter des visites démo sans identifiant persistant,
  stocker la source d'acquisition en agrégat par jour sans lien au profil) ;
- et dans tous les cas, mettre la politique (section 10) et le bandeau en accord.

Plus mineur : `cosmo_demo_creations` et `cosmo_demo_started_at` (`demo-engagement.ts`) servent
à choisir le moment d'une sollicitation d'inscription. Ils ne quittent jamais l'appareil, mais
l'article 82 vise aussi l'écriture locale : à lister au moins dans la politique.

### P1-4 · L'inscription par Google contourne l'acceptation des CGU

`src/components/AuthForm.tsx` : le bouton « Continuer avec Google » est rendu **dans les deux
modes**, mais la phrase « En créant un compte, y compris avec Google, vous acceptez les CGU… »
n'apparaît **qu'en mode inscription** (`mode === 'register'`, ligne ~440). Un nouveau visiteur
qui clique Google depuis l'écran de **connexion** crée un compte sans avoir vu ni les CGU ni la
politique.

Conséquence : CGU **non opposables** à ces comptes (C. civ. art. 1119 : les conditions
générales doivent avoir été portées à la connaissance de la partie), et information de
l'article 13 RGPD non délivrée au point de collecte. Ta propre mesure du 2026-10-10 : **6
inscriptions sur 7 passent par Google**. La ligne E10 de `LEGAL.md` est donc fausse en partie.

**Correctif** : afficher la phrase sous le bouton Google dans les deux modes (« En continuant
avec Google, vous acceptez… »).

### P1-5 · Le préavis de 30 jours des CGU n'a pas été envoyé (M-63)

Les clauses 3.3 (âge), 6.3 (sous-traitance entreprise) et 9 (responsabilité envers un
professionnel) ont changé le 2026-09-24. L'article 11 des CGU **promet** un e-mail 30 jours avant
l'entrée en vigueur. Tant qu'il n'est pas parti, ces trois clauses ne sont pas opposables aux
comptes créés avant le 24 septembre, et tu es en défaut sur ta propre promesse. À envoyer en même
temps que l'éventuelle information de P0-1 n'est **pas** une bonne idée : deux messages
distincts, l'un factuel sur l'incident, l'autre contractuel.

### P1-6 · Politique de confidentialité inexacte sur plusieurs points

`src/locales/{fr,en}/legalPrivacy.json`. Une information inexacte viole les articles 5.1.a, 12
et 13 du RGPD.

| Point | Ce que dit la politique | Réalité |
|---|---|---|
| Sentry | « Les adresses email **et les identifiants** sont retirés automatiquement avant l'envoi » | `monitoring.setUser({ id: user.id })` (`AuthContext.tsx:125`) envoie l'**UUID du compte** à Sentry à chaque erreur. `beforeSend` ne nettoie que les textes, pas `event.user` |
| Transferts hors UE (7 bis) | Seuls Vercel, Sentry, Resend, Cloudflare sont cités | Manquent **Stripe** (US), **Google** (OAuth, US), **Supabase Inc.** (société non européenne, accès support possible), et **Vesk** dont ni l'identité ni le pays ne sont donnés |
| Source d'acquisition | Absente | Collectée et écrite sur le profil (P1-3) |
| Conversion démo → compte | Seule la durée est donnée (6.li3) | Finalité, base légale et rattachement au compte non décrits |
| « Jours d'activité » (6.li4) | Durée donnée | Finalité « statistiques d'usage » absente de la section 4, base légale absente de la section 5 |
| Comptes inactifs | « conservées pendant toute la durée d'activité du compte » | **Aucune durée maximale pour un compte abandonné** : un compte créé et jamais rouvert est gardé indéfiniment. La CNIL attend une durée de conservation bornée (art. 5.1.e). Fixer par exemple 2 ou 3 ans d'inactivité, avec un e-mail avant suppression |
| Signalements de bug | Décrits | Durée de conservation des e-mails reçus non donnée |
| Section 2.p2 | « vous pouvez l'effacer en vidant les données de site » | Désormais « Gérer les cookies » existe : à mettre en avant, c'est le moyen « aussi simple » de l'art. 7.3 |
| Sécurité (s9) et FAQ landing (a9) | « personne d'autre ne peut accéder à vos tâches » | Faux tant que P0-1 n'est pas réglé, et approximatif ensuite (l'éditeur a un accès technique via `service_role`). Écrire plutôt ce qui est vrai : RLS, accès éditeur limité au support et à la maintenance |

### P1-7 · Contrats de sous-traitance (DPA) manquants, et une idée fausse qui les bloque

- **Sentry** : DPA non accepté. ⚠️ `a-faire-manuel.md` (M-04) dit qu'un DPA « ne s'obtient
  qu'en tant qu'entreprise, donc après M-01 ». **C'est faux pour Sentry** : le propriétaire du
  compte l'accepte dans *Legal & Compliance*, en deux minutes, aujourd'hui.
- **Vesk** : aucun DPA (V-1, ouvert depuis le 2026-09-01), alors que le script reçoit IP,
  identifiant persistant et indicateurs d'engagement, et qu'il contient une fonction qui
  aspire e-mail et nom des formulaires d'inscription (neutralisée chez toi par l'exclusion des
  pages d'identifiants). Sans DPA, la seule option propre est de **retirer Vesk** et de garder
  Vercel Analytics.
- **Resend** : DPA non archivé.
- **Vercel** : l'équipe s'appelle « axellongattepro-3874's projects », nom par défaut d'un
  compte personnel, ce qui suggère le plan **Hobby** (non vérifié : l'API ne renvoie pas le
  plan). Or les conditions de Vercel réservent Hobby à un **usage personnel et non
  commercial**, et son DPA ne vise que Pro et Enterprise. Si c'est Hobby : passer en Pro avant
  de lancer, sinon risque de suspension et absence de contrat art. 28.

### P1-8 · Aucun lien vers les documents légaux dans l'application connectée

Les mentions légales, CGU et politique ne sont liées que depuis la landing (`LandingFooter`),
le bandeau cookies, le formulaire d'inscription et les pages légales elles-mêmes. Une fois
connecté (`/dashboard`, `/settings`…), **aucun lien**. La LCEN exige un accès « direct et
permanent ». Correctif simple : un bloc « Informations légales » dans Paramètres (à côté de
« Gérer les cookies », `DataTab.tsx`) et dans le menu.

---

## 🟠 P2 · Risques réels, moins urgents ou à faire trancher

### P2-1 · Information précontractuelle due même pour le service GRATUIT

Depuis la directive « Omnibus » (2019/2161, transposée), le droit de la consommation à
distance s'applique aussi aux services fournis **en échange de données personnelles**. Les CGU
doivent donc donner, dès maintenant et pas seulement au premier paiement :

- l'**identité du professionnel** avec son **adresse géographique** et son **téléphone**. Les
  CGU ne nomment jamais l'éditeur : elles parlent de « Cosmo », qui n'est personne ;
- l'existence et les modalités de la **garantie légale de conformité** des contenus et services
  numériques (C. conso L224-25-1 et suivants, information prévue à L111-1). L'article 9.p3 la
  mentionne en une ligne, sans les modalités ;
- les coordonnées d'un **médiateur de la consommation** : obligation certaine dès qu'il y a
  vente, **à faire qualifier** pour un service gratuit. Adhésion payante.

### P2-2 · La FAQ entreprise sous-estime ce que voit un responsable

Landing, `faq.a11` : « Les statistiques portent sur les tâches d'équipe, **pas sur l'activité
individuelle** ». Or le produit montre la **dernière activité de chaque membre** (mig. `170`),
un onglet **Contribution** par membre, et des rapports quotidiens qui listent les tâches
terminées **par qui** (mig. `202`). La conception est prudente (pas de `last_sign_in_at`,
événements privés exclus), mais la phrase est **inexacte**. C'est une pratique commerciale
potentiellement trompeuse (C. conso L121-2) et une promesse opposable (garantie de
conformité). Reformuler : « Un responsable voit qui a fait quoi sur le travail d'équipe, jamais
votre activité personnelle ni vos connexions. »

Lié : les organisations clientes sont responsables de traitement pour des données de
**salariés**. Code du travail L1222-4 (information préalable des salariés) et L2312-38
(consultation du CSE quand il existe). Ce n'est pas ton obligation, mais un acheteur la posera.
Un **modèle de notice d'information salariés** et un **DPA séparé et signable** (la clause 6.3
des CGU ne suffira pas à un service achats) seraient des actifs commerciaux.

### P2-3 · Marque COSMO

Onze marques « COSMO » actives en classes 9 et 42 dans l'Union (relevé TMview du 2026-08-28).
Rien n'a bougé depuis. Plus tu investis en acquisition, plus un changement de nom forcé coûte.
**Consultation d'un conseil en propriété industrielle avant de lancer** (M-66).

### P2-4 · Publicité comparative

- `faq.a3` : « Cosmo est **la seule application** qui connecte les quatre piliers ». Allégation
  absolue, invérifiable : à retirer ou à nuancer (« une des rares »). C. conso L121-2.
- Article `cosmo-vs-todoist` : la publicité comparative est licite si elle est objective et
  porte sur des caractéristiques vérifiables (L122-1 et suivants), et c'est à l'annonceur de
  prouver l'exactitude (L122-5). Le ton est honnête, mais les faits sur Todoist (« gratuit
  plafonne à 5 projets », absence d'OKR) changent : **dater et sourcer** chaque affirmation, et
  la relire à chaque mise à jour.
- Incohérence : l'article dit « Cosmo, à ce stade, ne propose pas d'intégrations tierces », la
  landing entreprise annonce des envois vers Slack (`more.f12d`). L'un des deux est faux.

### P2-5 · Clauses des CGU à faire relire

- **9.p1** : « Il ne répond pas des dommages qui résultent […] du fait d'un tiers ». Dans un
  contrat à distance, le professionnel répond de plein droit de l'exécution, y compris par ses
  prestataires ; il ne s'exonère que par le fait **imprévisible et insurmontable** d'un tiers
  (C. conso L221-15). Formulation trop large face à un consommateur.
- **12.p3** : clause attributive de juridiction (tribunaux de Paris) : valable seulement entre
  **commerçants** (CPC art. 48). Tant que tu n'es pas immatriculé, elle est fragile.
- **7.p1** : « propriété exclusive de **Cosmo** » : nommer le titulaire réel (toi).
- **4.li6** : interdiction de « robots ou scripts automatisés » alors que la direction produit
  (agents, CLI) va vers l'inverse : à anticiper.
- La relecture par un juriste (M-67) reste le geste qui couvre tout ce bloc.

### P2-6 · Sentry : URLs non nettoyées

`beforeSend` nettoie messages, exceptions et fils d'Ariane, mais pas `event.request.url` ni les
données de navigation des fils d'Ariane. Les liens `/invite/<jeton>`, `/org-invite/<jeton>`
partent donc chez Sentry. Minimisation (art. 5.1.c) et sécurité.

### P2-7 · Personnes invitées par e-mail

Une invitation d'organisation envoie un e-mail à une personne qui n'a pas de compte, et son
adresse est stockée. Article 14 RGPD : elle doit être informée (identité du responsable,
finalité, durée, droits). Une ligne en pied d'e-mail d'invitation, avec lien vers la politique,
et une durée de conservation des invitations non acceptées (les liens expirent à 7 jours, mais
la ligne en base ?).

### P2-8 · Vercel Analytics et Vesk en double

Deux outils de mesure d'audience pour 30 comptes, dont un sans DPA et au comportement
surveillé (`vendor-watch.yml`). Chaque outil de plus est un sous-traitant, une ligne de
politique, une ligne de registre et un risque. Garder le seul Vercel Analytics simplifierait
P1-6 et P1-7.

---

## 🟡 P3 · Hygiène et incohérences

1. **`public/ads.txt`** déclare toujours un éditeur AdSense (`pub-2572718224166714`) alors que la
   publicité a été retirée le 2026-09-04. À supprimer : il laisse croire à de la publicité.
2. **E-mails du résumé d'organisation** (`org-digest`) : pas de lien pour gérer ses préférences
   dans le message. Le digest est en opt-in (`digest = 'off'` par défaut), donc pas de
   prospection, mais un lien « Gérer mes notifications » est la norme attendue.
3. **Confirmation d'adresse e-mail désactivée** (G-2, risque accepté) : n'importe qui peut créer
   un compte au nom d'une adresse qui n'est pas la sienne. Conséquences juridiques : le préavis
   de l'article 11 et toute information art. 34 partent vers des adresses non vérifiées.
4. **Mentions légales s4.p1 et CGU 8** se recoupent avec des formulations différentes : une seule
   source par sujet.
5. **« très petite équipe »**, « l'équipe de Cosmo » (about, blog) alors que l'éditeur est une
   personne seule. Sans gravité, mais cohérent avec l'identification exigée ailleurs.
6. **Accessibilité (directive EAA, en vigueur depuis le 28 juin 2025)** : les micro-entreprises
   prestataires de services sont exemptées. Rien à faire légalement, à surveiller au seuil.
7. **Vidéos marketing** (voix Gemini TTS, musique Lyria, hors de ce dépôt) : conditions
   d'usage commercial des contenus générés **non vérifiées** dans cet audit.

---

## ⏸️ Dormant · uniquement le jour où un paiement réel est possible

Inchangé depuis `LEGAL.md`, revérifié dans le code aujourd'hui : facturation désarmée
(`ENTERPRISE_BILLING_ENFORCED = false`), clé Stripe de test, aucun abonnement.
**Ne jamais réarmer la facturation tant que ces lignes sont ouvertes** :

- immatriculation (B2) : encaisser avant est du **travail dissimulé**, seul point pénal du dossier ;
- médiateur de la consommation (E4) ;
- portail de résiliation Stripe non configuré (E5), alors que les CGU (5.li5) et la landing
  promettent « résiliable à tout moment » ;
- bouton de rétractation en ligne (E13, directive 2023/2673, applicable depuis le 19/06/2026) ;
- mentions de facture, « TVA non applicable, art. 293 B du CGI », numérotation (C4 à C6),
  autoliquidation de la TVA sur les achats étrangers (C3) ;
- la « garantie de remboursement » de CGU 5.li5bis repose sur `stripe-org-refund` : à tester
  réellement en mode live avant d'ouvrir.

---

## Ordre de traitement recommandé

| # | Geste | Qui | Durée |
|---|---|---|---|
| 1 | **P0-1** : supprimer les artefacts, couper le workflow, révoquer les sessions, registre des violations, décision CNIL sous 72 h | Toi (+ moi pour le code) | aujourd'hui |
| 2 | P1-3 et P1-4 : traceurs sous consentement, phrase légale sous le bouton Google | Code | ½ journée |
| 3 | P1-6 et P1-8 : politique de confidentialité exacte, liens légaux dans l'app | Code + journal `LEGAL-JOURNAL.md` | ½ journée |
| 4 | P1-7 : DPA Sentry (2 min), plan Vercel, retirer ou contractualiser Vesk, DPA Resend | Toi | 1 h |
| 5 | P1-2 puis P1-1 : immatriculation micro-entreprise, domiciliation, téléphone, mentions complètes | Toi | 1 à 2 semaines |
| 6 | P1-5 : préavis de 30 jours des CGU | Toi | 1 h |
| 7 | P2-3 et P2-5 : conseil en PI, relecture des CGU par un juriste | Professionnels | avant l'acquisition payante |
| 8 | P2 restants, puis P3 | Code | à planifier |

---

## Ce que cet audit n'a PAS vérifié

- Le **contenu réel** des dumps (je ne les ai pas téléchargés, exprès) : déduit de la commande
  `pg_dump`.
- Le **plan Vercel** réel du projet `cosmo.app`.
- Les **réglages de console** Supabase, Stripe, Sentry (rétention, région du projet Sentry,
  masquage des IP).
- La **numérotation exacte** des articles après la loi SREN et le texte exact des obligations
  d'information sur la garantie de conformité : à confirmer sur Légifrance.
- Les textes **anglais** (`src/locales/en/*`), supposés alignés sur le français, qui prévaut.
- Tout ce qui vit hors de ce dépôt (cosmo-marketing, vidéos, comptes sociaux).

Sources consultées le 2026-10-13 :
[Simonnet Avocat, mentions légales et LCEN](https://www.simonnetavocat.fr/mentions-legales-dun-site-internet-obligations-sanctions-et-modele/) ·
[Legiscope, modèle de mentions légales](https://www.legiscope.com/blog/modele-mentions-legales-site.html) ·
[Entreprises.gouv, promulgation de la loi SREN](https://www.entreprises.gouv.fr/fr/presse/promulgation-loi-visant-securiser-et-reguler-espace-numerique-sren) ·
[Lefebvre Dalloz, garantie légale de conformité des services numériques](https://formation.lefebvre-dalloz.fr/actualite/garantie-legale-de-conformite-sur-les-produits-et-services-numeriques-quelles-nouvelles-obligations-pour-les) ·
[FAQ DGCCRF garanties légales](https://artois.ufcquechoisir.fr/wp-content/uploads/sites/115/2025/06/DGCCRF-163-FAQ-garanties-l%C3%A9gales-conformit%C3%A9-Octobre-2023.pdf) ·
[Next, lignes directrices CNIL traceurs](https://next.ink/6735/108058-rgpd-cnil-fixe-ses-lignes-directrices-pour-cookies-et-autres-traceurs/) ·
[Adobe, exemption CNIL de mesure d'audience](https://experienceleague.adobe.com/en/docs/analytics/technotes/privacy/cnil-consent-exemption) ·
[GitHub Docs, télécharger les artefacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts) ·
[datarequests.org, Vercel](https://www.datarequests.org/company/vercel/)
