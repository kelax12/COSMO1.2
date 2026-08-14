# RGPD — inventaire, droits des personnes et dette

**Audit du 2026-08-14** — premier audit dédié de ce domaine. Jusqu'ici, la conformité était
traitée par fragments dans les audits sécurité. Mesuré sur le schéma de prod et le code.

> Ce document décrit l'état technique. Il ne remplace pas un avis juridique, et la
> [politique de confidentialité](../src/pages/PolitiqueConfidentialitePage.tsx) reste le document
> opposable.

---

## 1. Inventaire des données personnelles

| Table | Données personnelles | Origine |
|---|---|---|
| `auth.users` | email, horodatages de connexion | Supabase Auth |
| `profiles` | email, `display_name`, `avatar_url` | copie applicative |
| **`friends`** | **email, nom, avatar d'un TIERS** | copié dans la ligne d'un autre utilisateur |
| `friend_requests` | email du destinataire, email de l'expéditeur | saisie utilisateur |
| `subscriptions` | `stripe_customer_id`, `stripe_subscription_id` | Stripe |
| `tasks`, `habits`, `events`, `okrs`, `team_tasks` | contenu libre (`name`, `description`) | saisie utilisateur |
| `demo_devices` | identifiant d'appareil, horodatages | analytique |
| `user_activity_days` | jours d'activité par compte | analytique |

**Hébergement** : Supabase, région **eu-west-1 (Irlande)** — dans l'UE, pas de transfert hors UE
au niveau base. Sous-traitants : Supabase (hébergement), Vercel (diffusion), Sentry (erreurs),
Stripe (paiement, non activé à ce jour).

**Minimisation côté Sentry** : `beforeSend` retire emails et UUID avant envoi. Bonne pratique déjà
en place.

## 2. 🟠 Droit à l'effacement — une rémanence structurelle

La fonction `delete-account` est sérieuse : elle purge 12 tables, transfère la propriété des
organisations à un successeur avant suppression, nettoie les affectations d'équipe sans clé
étrangère, alerte en cas d'échec (`opsAlert`), puis appelle `auth.admin.deleteUser`.

**Mais la table `friends` n'a aucune clé étrangère** (vérifié : zéro FK sur cette table), et le
nettoyage générique filtre sur `user_id` :

```ts
await supabaseAdmin.from(table).delete().eq('user_id', user.id)
```

Or `friends` stocke **l'email, le nom et l'avatar de l'ami** dans la ligne de l'autre utilisateur.
Quand A supprime son compte :

- les lignes où **A est propriétaire** (`user_id = A`) sont supprimées ✅ ;
- les lignes où **A est l'ami de B** (`friend_user_id = A`, contenant l'email et le nom de A)
  **subsistent** — ni cascade (pas de FK), ni filtre sur cette colonne ❌.

**Impact** : après exercice du droit à l'effacement (art. 17), l'email et le nom de la personne
restent dans les données de ses anciens contacts, sans limite de durée.

**Vérifié en prod** : **0 ligne orpheline** aujourd'hui — le défaut n'est **pas matérialisé**.
C'est cohérent : aucun compte ayant des amis n'a encore été supprimé (11 lignes dans `friends`,
27 comptes). Le risque est structurel, pas constaté.

**Correction** : traiter `friends` comme `friend_requests` et `shared_tasks`, qui utilisent déjà
`.or('user_id.eq.X,friend_user_id.eq.X')`. Les deux tables symétriques ont été correctement
gérées ; `friends` est restée dans la boucle générique. ~15 min.

## 3. 🟡 Rétention : deux tables analytiques sans expiration

| Table | Lignes | Politique de rétention |
|---|---|---|
| `processed_stripe_events` | — | ✅ purge à 90 jours (`prune_processed_stripe_events`, finding A-6) |
| `demo_devices` | 24 | ❌ **aucune** |
| `user_activity_days` | 69 | ❌ **aucune** |

Le principe de limitation de conservation (art. 5.1.e) demande une durée définie. Les volumes sont
dérisoires, mais la règle a déjà été appliquée une fois (A-6, A-11) : elle doit valoir pour toutes
les tables analytiques, sans quoi elle n'est pas une règle.

`demo_devices` est le cas le plus sensible des deux : c'est un identifiant d'appareil posé **avant
tout consentement à un compte**. Une rétention de 12 mois maximum serait cohérente.

## 4. ✅ Ce qui est en place

- **Droit d'accès et portabilité** : export CSV disponible (`src/lib/csv-export.ts`, onglet
  Données des Paramètres).
- **Droit à l'effacement** : suppression de compte en libre-service, exécutée côté serveur —
  sous réserve du §2.
- **Consentement cookies** : bannière avec choix, l'option la plus protectrice par défaut.
- **Information** : pages politique de confidentialité, mentions légales et CGU, en `noindex`
  mais crawlables (choix correct : Google doit pouvoir lire le `noindex`).
- **Sécurité du traitement** (art. 32) : RLS sur toutes les tables, chiffrement en transit,
  minimisation Sentry, mots de passe délégués à Supabase Auth.
- **Localisation UE** : eu-west-1.

## 5. Ce qui manque pour une vente B2B

Le [rapport mode entreprise](./archive/RAPPORT-MODE-ENTREPRISE-2026-08-12.md) identifie la
confidentialité comme argument de vente. Trois éléments manquent, tous non techniques :

1. **Registre des traitements** (art. 30) — obligatoire dès qu'on traite des données pour le
   compte d'organisations clientes.
2. **DPA / accord de sous-traitance** à proposer aux organisations clientes : COSMO devient
   sous-traitant de l'employeur pour les données de ses salariés.
3. **Durées de conservation publiées** dans la politique de confidentialité — impossible tant que
   le §3 n'est pas tranché.

C'est le chaînon manquant : le §3 (technique, 30 minutes) débloque le point 3 (commercial).

## 6. Ordre de traitement

1. **`friends` dans l'effacement** (§2) — le seul écart de conformité réel, et il est trivial.
2. **Rétention `demo_devices` / `user_activity_days`** (§3) — débloque la publication des durées.
3. Registre des traitements et DPA (§5) — quand une organisation cliente le demandera.
