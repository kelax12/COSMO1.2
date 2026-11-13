# RGPD : inventaire, droits des personnes, rétention

Lire avant de toucher une table de données personnelles, `delete-account`, `src/lib/csv-export.ts`, une purge `pg_cron` ou la politique de confidentialité. Fait foi : le schéma (`supabase/schema.sql`) et le code. Registre art. 30 : [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md). Violation : [`RGPD-VIOLATION-EXERCICES.md`](./RGPD-VIOLATION-EXERCICES.md), [`RGPD-VIOLATION-GABARITS.md`](./RGPD-VIOLATION-GABARITS.md). Récits et audits datés : [`archive/RGPD-etat-des-lieux-et-recits-avant-2026-11-13.md`](./archive/RGPD-etat-des-lieux-et-recits-avant-2026-11-13.md) et [`archive/RGPD-journal-des-notes-2026-04-06-au-2026-11-06.md`](./archive/RGPD-journal-des-notes-2026-04-06-au-2026-11-06.md). Indicateurs : [`INDICATEURS.md`](./INDICATEURS.md).

## Règle de fond

- 🔴 Toute donnée personnelle conservée a une durée de péremption écrite (art. 5.1.e) ; toute table qui en porte entre dans le registre ET dans l'inventaire ci-dessous.
- 🔴 Borner la durée de vie d'une donnée et borner son public sont deux gestes distincts : un seul ne clôt pas le sujet (art. 5.1.c).
- ❌ Un `author_id` / `actor_id` en `ON DELETE SET NULL` laisse survivre le contenu de son auteur, anonyme : régime voulu pour du travail d'équipe, défendable seulement s'il est écrit ici et au registre.
- ✅ Hébergement : Supabase, région `eu-west-1` (Irlande), dans l'UE. Sous-traitants : Supabase (hébergement), Vercel (diffusion), Sentry (erreurs), Stripe (paiement entreprise). Liste faisant foi : registre et `npm run check:subprocessors`.
- ✅ Sentry : `beforeSend` retire emails et UUID avant envoi.

## Inventaire des données personnelles

| Table | Données personnelles | Origine |
|---|---|---|
| `auth.users` | email, horodatages de connexion | Supabase Auth |
| `profiles` | email, `display_name`, `avatar_url` | copie applicative |
| `friends` | email, nom, avatar d'un TIERS, copiés dans la ligne d'un autre utilisateur | saisie utilisateur |
| `friend_requests` | email du destinataire et de l'expéditeur | saisie utilisateur |
| `subscriptions` | `stripe_customer_id`, `stripe_subscription_id` | Stripe |
| `tasks`, `habits`, `events`, `okrs`, `team_tasks` | contenu libre (`name`, `description`) | saisie utilisateur |
| `demo_devices` | identifiant d'appareil, horodatages | analytique |
| `user_activity_days` | jours d'activité par compte | analytique |
| `org_invitations` | UUID d'un tiers invité, trace d'un refus (`declined_at`) | saisie d'un membre |
| `org_removal_notices` | UUID du membre retiré et de l'auteur du retrait | action d'un admin |
| `team_task_dependencies` | `created_by` | action utilisateur |
| `team_task_comments` | contenu libre + `author_id` | saisie utilisateur |
| `team_task_activity` | `actor_id`, nature de l'action, horodatage | trace applicative |
| `org_notifications` | `user_id`, `actor_id`, libellé de l'événement | trace applicative |

## Effacement (art. 17)

- ✅ Suppression de compte en libre-service, exécutée côté serveur par `delete-account` : purge les tables de données, transfère la propriété des organisations à un successeur, nettoie les affectations d'équipe sans clé étrangère, alerte en cas d'échec (`opsAlert`), puis `auth.admin.deleteUser`.
- 🔴 Les tables symétriques (`friends`, `friend_requests`, `shared_tasks`) se purgent sur DEUX colonnes : `.or('user_id.eq.X,friend_user_id.eq.X')`. `friends` copie l'email, le nom et l'avatar de l'ami dans la ligne de l'AUTRE utilisateur : un filtre sur `user_id` seul le laisse survivre. Garde : `src/rgpd-erasure.guard.test.ts`.
- ✅ `friends_friend_user_id_fkey` est `ON DELETE CASCADE` en prod comme dans le dépôt (mig. `116`) : défense en profondeur ; la purge explicite de `delete-account` reste le rempart principal.
- ❌ Ne jamais conclure « aucune clé étrangère » sans lire `pg_constraint` en production : le dépôt et la prod ont divergé sur la sémantique d'effacement d'une table de données personnelles.

## Rétention

| Table | Durée | Mécanisme |
|---|---|---|
| `processed_stripe_events` | 90 j | `prune_processed_stripe_events` |
| `demo_devices` non converti | 90 j | purge dans `record_demo_visit` (mig. `084`) |
| `demo_devices` converti | 400 j | mig. `114` |
| `user_activity_days` | 400 j | mig. `114`, portée par `touch_last_seen`, bornée à l'appelant (coût constant) |
| `org_invitations` refusées | 30 j | pg_cron quotidien `cosmo-prune-declined-invitations` (mig. `112`) |

- 🔴 400 j est le plus petit seuil qui préserve la comparaison d'une année sur l'autre de `get_admin_stats`.
- ❌ Ne pas purger les invitations acceptées (historique de composition de l'organisation, tombent avec le membre par `ON DELETE CASCADE`) ni en attente (action en cours).
- ✅ La lecture de `org_invitations` est restreinte au destinataire, à l'inviteur et aux admins (mig. `130`, art. 5.1.c) : la policy `org_invitations_select` ne doit pas rouvrir la lecture à tout membre de l'organisation.
- ✅ Une purge est une migration qui SUPPRIME des lignes : elle attend une décision explicite avant application en production.
- ⚠️ Vérifier que `npm run check:retention` couvre toute nouvelle durée déclarée au registre.
- ✅ Les durées sont publiées dans la politique de confidentialité ; tenir les deux à jour ensemble.

## Accès et portabilité (art. 15 et 20)

- ✅ Export CSV : `src/lib/csv-export.ts`, onglet Données des Paramètres ; les tables exportées et les tables déclarées hors export sont mesurées par `npm run check:portability`. L'export couvre notamment les dépendances entre tâches personnelles (`task_dependencies`), le journal des résultats clés (`kr_completions`, lu en entier par `getAllForExport`, paginé, jamais borné aux 500 lignes du tableau de bord) et les rôles reçus dans une organisation (`org_member_roles`).
- 🔴 Une optimisation de lecture énumère ses consommateurs AVANT d'être appliquée, et tout export de données personnelles est un consommateur critique : un chiffre faux dans un export est une réponse inexacte à l'exercice d'un droit. Exemple : `habits.completions` est borné à 400 jours à la lecture (mig. `119`), l'export utilise `completionsTotal`, agrégat serveur sur l'historique entier.
- 🔴 La RLS ne suffit pas pour `org_member_roles` : la policy SELECT (`is_org_member(org_id)`) rend les attributions de TOUS les membres ; le filtre vit dans `getMyAssignments` (`.eq('user_id', moi)`), verrouillé par `src/lib/csv-export.kr-roles.test.ts`. ❌ Ne jamais exporter `getAssignments(orgId)`. `granted_by` ne sort pas (il désigne un tiers).

## Autres garanties en place

- ✅ Consentement cookies : bannière avec choix, option la plus protectrice par défaut (`src/lib/cookie-consent.ts`).
- ✅ Information : politique de confidentialité, mentions légales, CGU, en `noindex` mais crawlables (Google doit pouvoir lire le `noindex`).
- ✅ Sécurité du traitement (art. 32) : RLS sur toutes les tables, chiffrement en transit, minimisation Sentry, mots de passe délégués à Supabase Auth.

## Vente B2B

COSMO est sous-traitant de l'employeur pour les données de ses salariés.

- ✅ Registre des traitements (art. 30) : [`RGPD-REGISTRE.md`](./RGPD-REGISTRE.md).
- ⚠️ DPA (accord de sous-traitance) à proposer aux organisations clientes qui le demandent.
- ✅ Durées de conservation publiées dans la politique de confidentialité (voir Rétention).
