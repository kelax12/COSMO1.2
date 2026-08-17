-- ═══════════════════════════════════════════════════════════════════
-- Migration 018 (bis) — `shared_tasks.shared_by`, ajoutée hors migration
--
-- Même classe de dérive que la mig. 000 : la colonne existe en production
-- depuis toujours, mais aucune migration ne la crée. La 007 crée
-- `shared_tasks` SANS elle, et la 019 la présuppose :
--
--   019_fix_task_sharing_unified.sql
--   column "shared_by" of relation "shared_tasks" does not exist  (42703)
--
-- C'est le second point d'arrêt du replay sur base vierge (job CI
-- `rls-integration`), révélé après le déblocage de la mig. 000.
--
-- `shared_by` n'est pas décorative : c'est la moitié « propriétaire » de
-- TOUTES les policies de partage posées à partir de la 019
-- (`auth.uid() = shared_by OR auth.uid() = friend_id`). Une base reconstruite
-- sans elle ne peut pas porter le modèle d'accès qu'on prétend tester.
--
-- Numérotée 018 comme `018_profiles.sql` (le validateur n'accepte que
-- `NNN_`, sans suffixe lettre, et tolère un numéro partagé — précédent :
-- les deux `010_`). Le tri place bien ce fichier après `018_profiles.sql`
-- et avant `019_…`, ce qui est le seul ordre qui compte ici.
--
-- EFFET EN PRODUCTION : AUCUN. `ADD COLUMN IF NOT EXISTS` — la colonne
-- existe déjà. Le DEFAULT `auth.uid()` n'est volontairement PAS posé ici :
-- c'est le rôle de la 019, qui le fait juste après (étape « 3) shared_by »),
-- et le dupliquer ferait diverger les deux fichiers à la prochaine
-- modification.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.shared_tasks
  ADD COLUMN IF NOT EXISTS shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.shared_tasks.shared_by IS
  'auth.users.id du partageur (proprietaire de la tache). Moitie proprietaire des policies de partage depuis la mig. 019. Colonne creee hors migration a l''origine, formalisee par la mig. 018 bis.';
