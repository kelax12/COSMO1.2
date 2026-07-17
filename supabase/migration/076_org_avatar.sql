-- ═══════════════════════════════════════════════════════════════════
-- 076_org_avatar.sql — Image de profil de l'entreprise (#12)
-- ═══════════════════════════════════════════════════════════════════
--
-- data URL (jpeg redimensionné client ≤ 500 Ko avant compression, même
-- pipeline que l'avatar utilisateur) ou URL. Modifiable par les admins via
-- la policy UPDATE existante (organizations_update : is_org_admin).
-- Le trigger prevent_org_immutables ne protège que join_code/owner_id.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
