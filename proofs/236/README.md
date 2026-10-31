# Preuves · mig. `236` (affiliation par lien)

Appliquée en prod le 2026-10-31. Ledger : version `20261031223810`, nom `236_affiliation`
(copié depuis la base). Fichier appliqué : celui du commit `43633fc6`, inchangé (498 lignes).

## Avant la prod : transaction annulée sur `cosmo-prospection`

La migration entière a été jouée avec des tables COSMO factices, puis 28 cas : **28/28**.

- Inscription : un slug valide rattache le compte ; un slug inconnu ou mal formé est ignoré.
- Un rattachement posé ne bouge plus.
- 2000 c → commission 768. Un rejeu est idempotent et un paiement en échec est ignoré.
- Un remboursement avec `user_id` NULL → −384.
- Une org payée par un affilié : 5000 → 1936. Payée par un non-affilié : ignorée.
- Un paiement antérieur au rattachement est ignoré.
- Une panne du calcul n'empêche pas l'écriture du journal.
- Backfill : interdit à un utilisateur ordinaire, il rattrape les oublis et reste idempotent.
- `claim_affiliate` : un compte neuf → true, puis false. Un compte de plus d'1 h → false.
- `authenticated` et `anon` ne lisent pas les tables et ne peuvent pas se rattacher eux-mêmes.
- `affiliate_attach` : admin seulement, une seule fois.
- La suppression du compte garde les commissions, avec `customer_id` NULL.
- Le SQL donne le même résultat que `_shared/affiliation-math.ts`.

## Après la prod : relecture du catalogue

- Les 7 tables `affiliate_*` sont sous RLS. `anon` et `authenticated` ne les lisent pas.
- Les colonnes `profiles.affiliate_id`, `affiliate_slug`, `affiliated_at` et
  `org_subscriptions.purchased_by` existent.
- Triggers : `trg_payment_records_affiliate`, `trg_profiles_affiliation_frozen`,
  `trg_affiliate_contacts_user_id_immutable`. `trg_create_profile_on_signup` est toujours
  sur `auth.users`.
- `handle_new_user_profile` est en INVOKER et appelle `create_profile_for_new_user`, en
  DEFINER. `supabase_auth_admin` a `EXECUTE` sur les deux.
- `affiliate_settings` : 3950 / 150 / 25 / 0, avec `code_hash` NULL. 0 commission.

## Après la prod : vraie chaîne d'inscription, transaction annulée

Deux INSERT dans `auth.users`, faits en tant que `postgres`. Le compte affilié a reçu
`affiliate_slug` et `affiliated_at`. L'autre a gardé `acquisition_source = tiktok`. Les noms
et `account_type` sont justes. Il ne reste rien après l'annulation.

## Non prouvé

- L'exécution en tant que `supabase_auth_admin` lui-même : l'outil ne peut pas prendre ce
  rôle. La première vraie inscription le prouvera.
- Le trigger de commission en prod : aucune ligne de test n'a été écrite dans le
  `payment_records` de prod, et il n'y en aura jamais. Sa seule preuve en prod sera le
  premier vrai paiement d'un affilié.
- `e2e/rls/affiliation.test.ts` n'a pas encore tourné sur une stack locale.
