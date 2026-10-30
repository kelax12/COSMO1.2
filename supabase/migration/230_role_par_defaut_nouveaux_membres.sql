-- ═══════════════════════════════════════════════════════════════════
-- 230 · Rôle par défaut d'un nouveau membre
-- ═══════════════════════════════════════════════════════════════════
--
-- Demande d'Axel du 2026-10-30, à la suite de la mig. 229 (un seul système de
-- rôles). Paramètres → Rôles et permissions : « quand une nouvelle personne
-- rejoint l'entreprise, quel est son rôle par défaut ».
--
--   · `org_settings.default_role_id` : NULL = aucun rôle (droits de base de
--     membre, mig. 229). Écrit par un admin seul (policies org_settings, mig. 195).
--   · Le rôle doit appartenir à la MÊME organisation (trigger), et sa
--     suppression remet le réglage à NULL (ON DELETE SET NULL).
--   · À l'arrivée d'un membre (INSERT sur organization_members, role 'member'),
--     une attribution sans limite de durée est posée. Jamais rétroactif : les
--     membres déjà présents gardent leurs rôles.
--
-- Les quatre chemins d'arrivée (claim_org_invite, respond_org_invitation,
-- respond_join_request, create_organization) sont des fonctions DEFINER : le
-- trigger, INVOKER comme le veut la mig. 108, y tourne donc sous leur
-- propriétaire. Aucune policy INSERT n'ouvre organization_members au client.
-- `granted_by` est fixé par enforce_org_member_role_write à auth.uid() : la
-- personne qui arrive (lien, invitation) ou l'admin qui accepte la demande.

BEGIN;

ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS default_role_id uuid REFERENCES public.org_roles(id) ON DELETE SET NULL;

-- ─── 1 · Le rôle par défaut appartient à l'organisation ─────────────

CREATE OR REPLACE FUNCTION public.enforce_org_settings_default_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.default_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_roles r WHERE r.id = NEW.default_role_id AND r.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'org_settings: default role belongs to another organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_org_settings_default_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_org_settings_default_role ON public.org_settings;
CREATE TRIGGER trg_enforce_org_settings_default_role
  BEFORE INSERT OR UPDATE OF default_role_id ON public.org_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_settings_default_role();

-- ─── 2 · Attribution à l'arrivée ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_default_org_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_role uuid;
BEGIN
  -- Un admin détient tout : jamais de rôle sur lui (enforce_org_member_role_write).
  IF NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;
  SELECT s.default_role_id INTO v_role FROM public.org_settings s WHERE s.org_id = NEW.org_id;
  IF v_role IS NOT NULL THEN
    INSERT INTO public.org_member_roles (org_id, role_id, user_id, starts_at, ends_at)
    VALUES (NEW.org_id, v_role, NEW.user_id, now(), NULL)
    ON CONFLICT (role_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.assign_default_org_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assign_default_org_role ON public.organization_members;
CREATE TRIGGER trg_assign_default_org_role
  AFTER INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_org_role();

COMMIT;
