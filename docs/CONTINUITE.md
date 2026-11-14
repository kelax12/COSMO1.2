# Continuité · second administrateur et gestes de production

> **Quand lire** : avant d'inviter ou de retirer un administrateur, ou de convertir un geste manuel en job.
> **Fait foi** : les consoles des services et `public.admin_users`. Coffre, accès d'urgence, registre des secrets : [`SECRETS-ET-COFFRE.md`](./SECRETS-ET-COFFRE.md).
> 🔴 Aucune valeur ici (ni courriel, ni identifiant, ni code) : les commandes SQL portent des chevrons à remplir au moment du geste.

## Arrivée d'un second administrateur

- ✅ Rôle minimal par service, un compte par personne, second facteur activé AVANT l'invitation, chaque ligne cochée par écrit.
- ⚠️ Les noms de rôle changent : relire la liste le jour de l'invitation et prendre le plus petit qui permet la colonne « pour ».
- ❌ Jamais transférer la propriété d'une organisation ni le moyen de paiement : irréversible et inutile (le coffre couvre).

Avant d'inviter :

- [ ] La personne a son gestionnaire de mots de passe et un second facteur sur chaque compte ; ses codes de récupération dans son coffre, jamais dans un message.
- [ ] Coffre de continuité et accès d'urgence en place.
- [ ] Le propriétaire décide qui supplée qui : la personne de confiance (ouvre le coffre en urgence) peut ou non être le second administrateur (agit au quotidien).

| Service | Rôle minimal | Pour |
|---|---|---|
| GitHub | **Write** ; **Admin** le seul jour où un secret Actions doit être posé | pousser `noyau/*` et `main`, `workflow_dispatch`, journaux |
| Supabase | plus petit rôle ouvrant SQL editor, clés, secrets Edge et Vault ; propriété non transférée | rotations, sortie de secours `/admin`, migrations |
| Vercel | **Member** | redéployer, variables, Promote |
| Stripe | plus petit rôle voyant journaux d'API et webhooks, pouvant faire tourner la clé | rotations `stripe-cle`, `stripe-webhook` ; remboursements via `/admin` |
| Hébergeur de messagerie | utilisateur délégué boîte de contact et DNS, sans contrat ni paiement | courrier, SPF, DKIM, DMARC |
| Sentry | **Member** | erreurs de production |
| Salon d'alerte | membre | alertes `ci-alert.yml` |
| Search Console, Bing Webmaster | délégué | lecture SEO |
| Gestionnaire de mots de passe | collection « continuité » | ouvrir le coffre à son tour |

Allowlist admin (écriture en prod par le propriétaire au SQL editor ; ❌ jamais le MCP Supabase ni le CLI agent) :

1. La personne crée un compte COSMO ordinaire en production et se connecte une fois.
2. Prouver avant d'écrire : `select id from auth.users where lower(email) = lower('<adresse>');` rend exactement une ligne.
3. Insérer : `insert into public.admin_users (user_id) select id from auth.users where lower(email) = lower('<adresse>') on conflict (user_id) do nothing;`
4. La personne ouvre `/admin` (l'enrôlement reste atteignable, `admin_allowlisted()` ignore `aal`), scanne le QR dans SON authentificateur, saisit le code.
5. Vérifier, connectée : `select auth.jwt() ->> 'aal';` = `aal2`, `select public.is_admin();` = `true`.
6. Contrôle négatif : reconnexion par mot de passe seul, arrêt avant le code : `/admin` demande le code et n'affiche rien.
7. `select count(*) from public.admin_users;` rend le nombre attendu.
8. Parcourir la sortie de secours une fois ([`MISES-EN-SERVICE.md`](./MISES-EN-SERVICE.md) § 2quinquies) : le propriétaire retire le facteur, la personne se réenrôle.
9. La personne range son facteur `admin-aal2` dans SON coffre.

Prête quand elle a joué seule :

- [ ] un `workflow_dispatch` de `Posture` et de `Secrets age`, verdict lu ;
- [ ] une rotation à faible enjeu de `.github/secrets-registry.json` (ex. `BING_WEBMASTER_API_KEY`, procédure `cle-bing`), jusqu'à la révocation de l'ancienne ;
- [ ] une lecture de [`DEPLOYMENT.md`](./DEPLOYMENT.md) §§ 3 et 7 et un déclenchement de `drill-auto`.

Puis une vérification du coffre à deux (`.github/coffre-verifications.json`, champ `par`) ; docs de gestes et de coffre mis à jour dans le même commit.

## Départ d'un administrateur

Le jour même, dans l'ordre : retirer l'accès AVANT de faire tourner les secrets.

- [ ] Allowlist (propriétaire, SQL editor) : `delete from public.admin_users where user_id = (select id from auth.users where lower(email) = lower('<adresse>'));` puis `select count(*) from public.admin_users;`. Le facteur peut rester : sans ligne, `is_admin()` est faux.
- [ ] Sessions : `auth.admin.signOut` depuis une Edge Function, ou suppression ciblée de ses `auth.refresh_tokens`.
- [ ] Comptes, dans l'ordre inverse de l'arrivée : gestionnaire (« continuité »), salon, Sentry, Search Console et Bing, messagerie, Stripe, Vercel, Supabase, GitHub.
- [ ] Jetons et clés créés à son nom (GitHub fine-grained, Vercel, Supabase, Sentry) : révoquer, vérifier dans chaque console.
- [ ] Secrets qu'elle a pu lire, par leur entrée du registre : départ conflictuel = tous, `critical` puis `high` ; sinon au moins `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`.
- [ ] Accès au coffre eu : nouvelle phrase (`phrase-sauvegardes`), nouveaux codes de chaque service, accès d'urgence retiré, nouvelle personne de confiance si c'était elle.
- [ ] Dans la semaine : vérification complète du coffre consignée (`check:coffre`), `lastRotated` daté pour les stores non datés.
- [ ] `Secrets age` et `Posture` relus : aucun écart nouveau.

## Gestes de production

Automatisés :

| Geste | Par |
|---|---|
| Déployer le front | Vercel derrière la porte `ci-vert/<sha>` ([`DEPLOYMENT.md`](./DEPLOYMENT.md) § 1) |
| Déployer les Edge Functions | `edge-deploy.yml` après `CI noyau` vert, puis `check:edge` et `check:edge-smoke` |
| Voir la dérive Edge et front | `Edge deploy drift`, `Deploy SHA drift` |
| Sauvegarder et éprouver la restauration | `db-backup.yml` quotidien ; `restore-drill.yml` › `drill-auto` mensuel ; `restore-drill-fraicheur.yml` |
| Mesurer l'âge des secrets | `secrets-age.yml`, hebdomadaire |
| Recaler `Posture` | `posture.yml` `-f regenerer=true`, par quiconque a l'écriture (la décision reste humaine) |
| Traitements planifiés | pg_cron et `Journal des crons` (mig. `245`, `246`) |
| Rappeler les échéances (coffre, lecteurs d'écran, exercice de violation, chantiers) | `gardes-calendrier.yml` |

Restent manuels, avec la raison (chacun écrit en prod, crée un secret ou demande un jugement) :

| Geste | Raison |
|---|---|
| Appliquer une migration (SQL editor ou `apply_migration`) | écriture en production |
| Poser `SECRETS_AUDIT_TOKEN` (`jeton-audit-github`) | secret nouveau, compte du propriétaire |
| Dater ou faire tourner la `service_role` de la plateforme (`cle-service-plateforme`) | aucune API ne la date |
| Faire tourner un secret | la CI ne porte que des jetons de lecture |
| Retirer chez Vercel les variables que rien ne lit (`variable-orpheline`) | console Vercel |
| Décider d'un recalage de `Posture` | relire au catalogue, jamais pour faire taire |
| Trier une alerte `detection-violation` | données personnelles, 72 h légales |
| Arbitrer le périmètre de l'affiliation au registre art. 30 | décision |
| Séances VoiceOver et NVDA | appareils réels ; `check:lecteurs-ecran` mesure l'échéance |
| Promote Vercel (`M-47`), redéploiement sans vert | console Vercel ; le contournement doit rester conscient (`prod_en_avance`) |
| Bascule pg_cron (Vault, `245`, `246`, retrait des `schedule:`) | écriture en prod et valeur de `CRON_SECRET` |
| Drill manuel vers un projet jetable | seule épreuve de la plateforme et du RTO |
| Coffre, personne de confiance, second administrateur, allowlist | droits sur des comptes, écriture en base |
| Préavis de modification des CGU, remboursement (`M-08`) | message sortant, argent réel |

- ⚠️ Piste non posée : `Posture` pourra rougir à moins de deux lignes dans `public.admin_users`, une fois le second administrateur inscrit ; pas avant, une garde rouge dès sa pose ne signale rien.
