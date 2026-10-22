-- ═══════════════════════════════════════════════════════════════════
-- Migration 007 (bis) — colonnes ajoutées HORS MIGRATION, formalisées
--
-- Ces colonnes existent en production depuis toujours, mais aucune migration
-- ne les crée : elles ont été ajoutées à la main avant que la convention
-- `NNN_*.sql` ne soit tenue. Le jeu de migrations ne décrivait donc pas la
-- base qu'il prétend reconstruire, et le replay sur base vierge s'arrêtait
-- dès qu'une migration ultérieure s'y référait :
--
--   019_fix_task_sharing_unified.sql   shared_tasks.shared_by  (42703)
--   027_shared_tasks_friendship_check  friends.friend_user_id  (42703)
--
-- Même cause que la mig. 000 pour la table `subscriptions`. C'est ce qui
-- rendait le job CI `rls-integration` rouge depuis sa création (2026-06-21) :
-- il n'a jamais été vert une seule fois.
--
-- La liste est EXHAUSTIVE au 2026-08-18 : obtenue en comparant colonne par
-- colonne le schéma réel de la production (introspection) à ce que les 104
-- migrations créent (CREATE TABLE + ALTER TABLE ADD COLUMN). Trois colonnes
-- en dérive sur 40 tables, toutes ci-dessous.
--
-- Numérotée 007 comme `007_friends.sql`, qui crée les trois tables
-- concernées : ce fichier doit s'appliquer juste après, et bien avant la 019.
-- Le validateur n'accepte que `NNN_` (pas de suffixe lettre) et ne fait
-- qu'avertir sur un numéro partagé — précédent : les deux `010_`.
--
-- EFFET EN PRODUCTION : AUCUN. Tout est en `ADD COLUMN IF NOT EXISTS`.
-- ═══════════════════════════════════════════════════════════════════

-- ─── shared_tasks ────────────────────────────────────────────────────
-- `shared_by` est la moitié « propriétaire » de TOUTES les policies de
-- partage à partir de la mig. 019 (`auth.uid() = shared_by OR auth.uid() =
-- friend_id`). Une base reconstruite sans elle ne peut pas porter le modèle
-- d'accès que les tests RLS prétendent vérifier.
-- Le DEFAULT `auth.uid()` n'est PAS posé ici : c'est le rôle de la 019
-- (étape « 3) shared_by »), et le dupliquer ferait diverger les deux fichiers.
ALTER TABLE public.shared_tasks
  ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- `shared_at` n'est référencée par aucune migration : elle est ajoutée pour
-- que la base reconstruite converge vraiment vers le schéma de prod, pas
-- seulement « assez pour que le replay passe ».
ALTER TABLE public.shared_tasks
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ DEFAULT now();

-- ─── friends ─────────────────────────────────────────────────────────
-- `friend_user_id` porte l'identité RÉELLE de l'ami (auth.users.id). C'est
-- elle qui permet à la mig. 027 de vérifier qu'un partage vise bien un ami
-- réciproque ; sans elle, ce contrôle ne peut pas exister.
-- Nullable, comme en prod : d'anciennes lignes n'en avaient pas, et la 027
-- fait justement un backfill défensif avant de s'en servir.
ALTER TABLE public.friends
  ADD COLUMN IF NOT EXISTS friend_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── friend_requests ─────────────────────────────────────────────────
ALTER TABLE public.friend_requests
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN public.shared_tasks.shared_by IS
  'auth.users.id du partageur. Moitie proprietaire des policies de partage depuis la mig. 019. Colonne creee hors migration, formalisee ici.';
COMMENT ON COLUMN public.friends.friend_user_id IS
  'auth.users.id de l ami (identite reelle, distincte de la ligne friends). Utilisee par la mig. 027 pour verifier la reciprocite. Colonne creee hors migration, formalisee ici.';
