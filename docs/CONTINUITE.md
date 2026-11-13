# Continuité : second administrateur et gestes de production (V5.4, V20.3)

Rien de ce qui suit n'est de la sécurité de surface : c'est ce qui décide si COSMO survit à
l'indisponibilité d'une personne. Trois pièces, écrites le 2026-11-08 :

1. [Arrivée d'un second administrateur](#arrivée-dun-second-administrateur) ;
2. [Départ d'un administrateur](#départ-dun-administrateur) ;
3. [Inventaire des gestes de production](#inventaire-des-gestes-de-production) : ce qui est déjà
   automatisé, ce qui a été converti en job, ce qui reste manuel et pourquoi.

Le coffre, l'accès d'urgence et le registre des secrets sont dans [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md)
(§ « Coffre et accès d'urgence » et § « Rotation des secrets »). Ce document ne les recopie pas.

> 🔴 **Aucune valeur ici** : ni adresse de courriel, ni identifiant de compte, ni code. Les
> commandes SQL portent des paramètres entre chevrons, à remplir au moment du geste.

---

## Arrivée d'un second administrateur

**Principe** : le rôle **minimal** par service, **un compte par personne** (jamais un identifiant
partagé), second facteur activé **avant** l'invitation, et chaque ligne cochée par écrit. Les
rôles des consoles changent de nom : relire la liste des rôles du service **le jour de
l'invitation** et prendre le plus petit qui permet la ligne « pourquoi ».

### 1. Avant d'inviter quoi que ce soit

- [ ] La personne a un gestionnaire de mots de passe à elle et un second facteur sur chaque compte
      ci-dessous. Ses codes de récupération sont **dans son coffre**, jamais dans un message.
- [ ] Le coffre de continuité existe et l'accès d'urgence est en place
      ([`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md) § « Coffre et accès d'urgence »).
- [ ] Le propriétaire décide qui est **suppléant de qui** : la personne de confiance de l'accès
      d'urgence peut être, ou non, le second administrateur. Les deux rôles se distinguent : l'un agit
      au quotidien, l'autre n'ouvre le coffre qu'en urgence.

### 2. Les comptes à inviter, rôle minimal

| Service | Rôle minimal | Pourquoi (ce que la personne doit pouvoir faire) |
|---|---|---|
| GitHub (dépôt) | **Write** ; **Admin** seulement le jour où elle doit poser un secret Actions (poser un secret exige Admin) | pousser sur `noyau/*` et `main`, lancer un `workflow_dispatch`, lire les journaux |
| Supabase (organisation) | le plus petit rôle qui ouvre SQL editor, clés d'API, secrets Edge et Vault ; propriétaire de l'organisation **non** transféré | rotation des clés, sortie de secours de la console admin, migrations |
| Vercel (équipe) | **Member** | redéployer, lire et poser les variables, promouvoir un déploiement |
| Stripe | le plus petit rôle qui voit les journaux d'API et les webhooks et peut faire tourner la clé secrète | rotation `stripe-cle` et `stripe-webhook`, remboursements d'organisation (console `/admin`, `is_admin()`) |
| Hébergeur de la messagerie | utilisateur délégué sur la boîte de contact et la zone DNS, **sans** accès au contrat ni au moyen de paiement | courrier de contact, enregistrements SPF, DKIM, DMARC |
| Sentry | **Member** | lire les erreurs de production |
| Salon d'alerte (webhook ops) | membre du salon | recevoir les alertes de `ci-alert.yml` |
| Search Console, Bing Webmaster | utilisateur délégué | signaux SEO, lecture seule |
| Gestionnaire de mots de passe | accès à la collection « continuité » | ouvrir le coffre quand c'est son tour |

❌ Ne pas transférer la propriété d'une organisation ni le moyen de paiement : c'est un acte
irréversible qui n'est pas nécessaire à la continuité (le coffre et l'accès d'urgence le couvrent).

### 3. Ajout à l'allowlist admin de COSMO (écriture en base, **décrite, jamais jouée par un agent**)

La console `/admin` est gardée par `public.is_admin()` : être dans `public.admin_users` **ET** avoir
une session `aal2` ([`SECURITY.md`](./SECURITY.md) § « `/admin` »). L'inscription à l'allowlist est une
**écriture en production** : elle se fait par le propriétaire, depuis le SQL editor du projet, jamais par
le MCP Supabase (il contourne la RLS) ni par le CLI agent.

Ordre, qui évite la coupure de la mig. `131` :

1. **La personne crée un compte COSMO normal** en production (inscription ordinaire), avec une adresse
   qu'elle contrôle, et se connecte une fois.
2. **Prouver avant d'écrire** qu'il n'y a qu'une ligne à insérer :
   `select id from auth.users where lower(email) = lower('<adresse du second administrateur>');`
   doit rendre **exactement une** ligne.
3. **Le propriétaire insère** (écriture, une fois) :
   `insert into public.admin_users (user_id) select id from auth.users where lower(email) = lower('<adresse>') on conflict (user_id) do nothing;`
4. **La personne enrôle son second facteur** : ouvrir `/admin` (l'écran d'enrôlement reste atteignable,
   `admin_allowlisted()` ignore volontairement `aal`), scanner le QR dans **son** authentificateur,
   saisir le code. La session passe en `aal2`.
5. **Vérifier**, connectée en admin : `select auth.jwt() ->> 'aal';` rend `aal2` et
   `select public.is_admin();` rend `true`.
6. **Contrôle négatif** (c'est lui qui prouve la garde) : se déconnecter, se reconnecter par mot de passe
   seul, s'arrêter avant le code. `/admin` doit demander le code et **ne rien afficher**.
7. **Compter** : `select count(*) from public.admin_users;` rend le nombre attendu.
8. **Parcourir la sortie de secours une fois** ([`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2quinquies,
   « Téléphone perdu ») : le propriétaire retire le facteur de la personne, elle se réenrôle. C'est
   l'épreuve qui prouve que la porte de sortie marche **avant** qu'on en ait besoin.
9. Ranger le facteur `admin-aal2` de la personne dans **son** coffre (jamais dans le dépôt).

### 4. Prêt quand la personne a joué trois choses, sans aide

- [ ] Un `workflow_dispatch` de `Posture` et de `Secrets age`, et lu leur verdict.
- [ ] Une rotation **à faible enjeu**, suivie dans `.github/secrets-registry.json` (par exemple
      `BING_WEBMASTER_API_KEY`, procédure `cle-bing`), de la génération à la révocation de l'ancienne.
- [ ] Une lecture du runbook de reprise ([`DEPLOYMENT.md`](./DEPLOYMENT.md) §§ 3 et 7) et du
      déclenchement du `drill-auto`.

Puis : une vérification du coffre **à deux** (`.github/coffre-verifications.json`, champ `par`), qui
remet le compteur de 92 jours à zéro avec les deux noms. Les documents de gestes et de coffre se
mettent à jour dans le même commit.

---

## Départ d'un administrateur

Le jour même, dans cet ordre. L'ordre compte : on **retire l'accès** avant de **faire tourner** les
secrets, sinon on les fait tourner sous les yeux de la personne.

- [ ] **Allowlist** (écriture en base, décrite, jouée par le propriétaire au SQL editor) :
      `delete from public.admin_users where user_id = (select id from auth.users where lower(email) = lower('<adresse>'));`
      puis `select count(*) from public.admin_users;` et, si le compte COSMO doit rester, son facteur
      peut rester : sans ligne dans l'allowlist, `is_admin()` est faux.
- [ ] **Sessions** : invalider les sessions actives du compte COSMO concerné (`auth.admin.signOut` depuis
      une Edge Function, ou la suppression ciblée de ses `auth.refresh_tokens`).
- [ ] **Retirer les comptes**, dans l'ordre inverse de l'arrivée : gestionnaire de mots de passe
      (collection « continuité »), salon d'alerte, Sentry, Search Console et Bing, hébergeur de la
      messagerie, Stripe, Vercel, Supabase, GitHub.
- [ ] **Révoquer ce qui lui appartient** : jetons personnels (GitHub fine-grained, Vercel, Supabase,
      Sentry) et clés d'API créés à son nom. Un jeton créé par la personne meurt avec son compte chez
      certains services, pas chez tous : le vérifier dans chaque console.
- [ ] **Faire tourner les secrets qu'elle a pu lire**, par leur entrée du registre :
      si le départ est conflictuel, **tous**, en commençant par `critical` puis `high` ; sinon au moins
      ceux dont l'effet de fuite (`leak`) touche la base ou l'argent (`SUPABASE_DB_URL`,
      `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`).
- [ ] **Si la personne a eu accès au coffre** : nouvelle phrase des sauvegardes (`phrase-sauvegardes`),
      nouveaux codes de récupération de **chaque** service, retrait de l'accès d'urgence, et choix d'une
      nouvelle personne de confiance si c'était elle.
- [ ] **Consigner** une vérification complète du coffre dans la semaine (`check:coffre`), et dater les
      rotations (`lastRotated` pour les stores que l'API ne date pas).
- [ ] **Relire** `Secrets age` et `Posture` : aucun écart nouveau.

---

## Inventaire des gestes de production

Cherché dans `docs/README.md` (« Gestes d'Axel »), `docs/DEPLOYMENT.md`, `supabase/migration/CLAUDE.md`
et `scripts/CLAUDE.md`, relu au 2026-11-08 sur `99564c19` et au-delà. Trois statuts :

- ✅ **Automatisé** : une garde ou un workflow le fait sans personne ;
- 🔁 **Converti ici** : rendu exécutable ou rappelé par la CI, sans secret nouveau et sans écriture
  en production ;
- 🖐️ **Manuel, avec sa raison** : il reste un geste, parce qu'il écrit en production, crée un secret,
  ou demande un jugement.

### ✅ Déjà automatisés

| Geste | Par quoi |
|---|---|
| Déployer le front | Vercel, derrière la porte `CI vert` (tag `ci-vert/<sha>`, [`DEPLOYMENT.md`](./DEPLOYMENT.md) § 1) |
| Redéployer les Edge Functions | `edge-deploy.yml` après un `CI noyau` vert sur `main`, sélection par `scripts/edge-deploy-select.mjs`, puis `check:edge` et `check:edge-smoke` ; secours manuel (`supabase functions deploy`) documenté en § 2bis |
| Détecter la dérive Edge et front | `Edge deploy drift`, `Deploy SHA drift`, relayés par `ci-alert.yml` |
| Sauvegarder la base | `db-backup.yml`, quotidien, chiffré, avec manifeste de comptages |
| **Jouer `restore-drill`** | `restore-drill.yml`, job `drill-auto`, **mensuel** (le 9, V4.4, `99564c19`) : restaure le dernier dump dans un Postgres jetable du runner et compare au manifeste ; `restore-drill-fraicheur.yml` rougit sans drill vert depuis 35 jours. Aucun secret de connexion |
| Mesurer l'âge des secrets | `secrets-age.yml`, hebdomadaire : dates **vivantes** lues par l'API GitHub, Vercel et Supabase (le geste « dater les rotations » ne subsiste que pour la clé `service_role` de la plateforme) |
| Recaler `Posture` | `posture.yml` : job `regenerer` par `workflow_dispatch` (`-f regenerer=true`), exécutable par **toute personne** qui a l'écriture sur le dépôt ; voir la ligne manuelle pour la décision |
| Traitements planifiés de production | pg_cron et `Journal des crons` (mig. `245`, `246`, ARC-06) |
| Tenir les échéances datées | `gardes-calendrier.yml` (lecteurs d'écran, exercice de violation, chantiers, acquisition) |

### 🔁 Convertis dans cette passe

| Geste | Devient | Garde-fou |
|---|---|---|
| « Penser à vérifier le coffre » | `check:coffre`, dans `gardes-calendrier.yml`, quotidien : rouge au-delà de 92 jours, élément oublié, ou première échéance (2026-12-08) dépassée ; alerte par l'issue `calendrier-red` | ne prouve pas le contenu du coffre, seulement qu'une vérification complète a été consignée ; ❌ aucune période relevable |
| « Tenir le registre des secrets à jour, complet, sans valeur » | `check:secrets-age` refuse désormais une entrée sans `readers`, `leak` ou procédure, une procédure de moins de trois étapes, et toute forme de valeur | le registre est le seul : pas de second fichier |
| « Savoir comment faire tourner un secret » | une procédure pas à pas par entrée (`procedures` du registre), exécutable par n'importe quelle personne qui a les droits | l'écriture du secret reste humaine (ci-dessous) |
| « Retrouver ce qui se passe si la personne manque » | les check-lists d'arrivée et de départ ci-dessus | la CI ne les joue pas : elles écrivent des droits |

Constat de la passe : sur les gestes restants, **aucun** n'est convertible sans secret nouveau ni
écriture en production. C'est la raison de leur statut manuel, pas un oubli.

### 🖐️ Restent manuels, avec la raison

| Geste | Raison |
|---|---|
| Appliquer les migrations (`supabase db push`) | écriture en production par la voie qui contourne le déploiement du front. **Son passage en CI est la vague 8.3**, menée à part : pas traité ici |
| Poser `SECRETS_AUDIT_TOKEN` | un jeton personnel fin se crée dans le compte du propriétaire (`jeton-audit-github`) ; c'est un secret nouveau |
| Dater ou faire tourner la `service_role` de la plateforme | aucune API ne la date ; la rotation est une action de console (`cle-service-plateforme`) |
| Faire tourner un secret (toute entrée du registre) | écrit un secret chez Supabase, GitHub, Vercel ou Stripe ; la CI ne porte que des jetons de **lecture**. Les procédures sont écrites, l'exécution est humaine |
| Retirer chez Vercel les variables de l'intégration que rien ne lit | écriture dans la console Vercel, pas de jeton d'écriture côté CI (`variable-orpheline`) |
| Décider du recalage de `Posture` | le bouton existe (ci-dessus) ; **le jugement** est humain : relire les nouveaux objets au catalogue avant de recaler, jamais pour faire taire |
| Trier le signal du détecteur de violation, sort de la PR n° 125 | jugement sur des données personnelles, échéance légale de 72 h : un responsable de traitement ne délègue pas ce tri à un job |
| Arbitrer le périmètre de l'affiliation au registre art. 30 | décision de périmètre |
| Séances VoiceOver (avant le 2026-12-15) et NVDA (avant le 2027-01-15) | appareils et lecteurs d'écran réels ; `check:lecteurs-ecran` mesure l'échéance, il ne joue pas la séance |
| « Promote » Vercel, M-47 (`DEPLOYMENT.md` § 3) | console Vercel, à froid, une fois |
| Redéployer sans verdict vert (urgence) | console Vercel, **voulu** : le contournement de la porte doit rester un geste conscient et laisse sa trace (`prod_en_avance`) |
| Bascule pg_cron : secrets Vault, mig. `245` et `246`, retrait des `schedule:` GitHub | écritures en production et valeur de `CRON_SECRET` dans le Vault (`MISES-EN-SERVICE.md` § 2sexies) |
| Drill **manuel** vers un projet Supabase jetable | seul à restaurer sur la plateforme réelle (pg_cron, Vault, rôles gérés) et à chronométrer le RTO d'un sinistre ; crée puis détruit un projet et un secret `DRILL_DB_URL` le jour même |
| Mettre le coffre en place, désigner la personne de confiance, inviter le second administrateur, inscrire l'allowlist | droits sur des comptes et écriture en base ; pas de valeur dans le dépôt |
| Rédiger le préavis de modification des CGU, rembourser (M-08) | message sortant et argent réel |

### Piste volontairement non posée

Une fois le second administrateur inscrit, `Posture` pourra compter les lignes de `public.admin_users`
et rougir à moins de deux : la lecture existe déjà (`SUPABASE_DB_URL`, lecture seule). Elle n'est
**pas** posée avant, parce qu'une garde rouge dès sa pose ne signale plus rien.
