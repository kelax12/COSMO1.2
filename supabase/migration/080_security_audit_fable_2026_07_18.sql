-- ═══════════════════════════════════════════════════════════════════
-- Migration 080 — Corrections de l'audit sécurité Fable (2026-07-18)
--
-- Corrige les findings F-1, F-2, F-3, F-4, F-5 consignés dans faille.md
-- (section « Audit Fable 2026-07-18 »). Aucune faille critique/haute ;
-- ces corrections sont du durcissement + 1 point RGPD (F-2).
--
-- Idempotente (DROP … IF EXISTS / CREATE OR REPLACE). Additive et sûre.
-- ═══════════════════════════════════════════════════════════════════

-- ─── F-1 — Agenda manager : moindre privilège ───────────────────────
-- Le client n'utilise QUE getWindowForUser (SELECT) et createForUser
-- (INSERT) pour l'agenda d'un subordonné. Les policies manager UPDATE et
-- DELETE (mig. 077) ne sont exercées par AUCUN chemin applicatif : elles
-- accordaient à un manager/admin le droit de modifier et SUPPRIMER
-- silencieusement l'agenda personnel d'autrui. On les retire (capacité
-- morte = surface d'attaque inutile). SELECT + INSERT restent (la feature).
--
-- NB : la portée du SELECT (un manager lit tout l'agenda de son sous-arbre,
-- sans distinction perso/pro) reste un choix produit — un flag `is_private`
-- + divulgation onboarding est recommandé mais nécessite de l'UI, hors
-- périmètre de cette migration.

DROP POLICY IF EXISTS "events_manager_update" ON public.events;
DROP POLICY IF EXISTS "events_manager_delete" ON public.events;

-- ─── F-2 — RGPD : purge de l'utilisateur des tâches d'équipe ─────────
-- team_tasks.assignee_ids est un UUID[] (mig. 072) : pas de FK, donc
-- auth.admin.deleteUser ne cascade pas. Sans ça, l'UUID d'un compte
-- supprimé survit dans les tâches d'équipe. RPC appelée par delete-account
-- (service_role). SECURITY DEFINER + garde : n'agit que sur un uid fourni
-- par le contexte service (pas d'auth.uid() côté Edge Function service_role).

CREATE OR REPLACE FUNCTION public.purge_user_from_team_assignments(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.team_tasks
    SET assignee_ids = array_remove(assignee_ids, p_user)
    WHERE assignee_ids @> ARRAY[p_user];
END;
$$;

-- Réservée au service_role (appel depuis delete-account). Jamais exposée
-- aux clients : un utilisateur ne doit pas pouvoir désassigner autrui.
REVOKE ALL ON FUNCTION public.purge_user_from_team_assignments(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_user_from_team_assignments(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_from_team_assignments(UUID) TO service_role;

-- ─── F-3 — Oracle d'énumération : borne le batch 1000 → 50 ──────────
-- Réduit l'amplification de l'oracle d'existence de comptes. La garde
-- auth.uid() (déjà présente) bloque anon ; le contrôle relationnel reste
-- volontairement absent (design N12 : nécessaire pour inviter par email),
-- mais 50/appel limite l'énumération de masse.

CREATE OR REPLACE FUNCTION public.resolve_profiles_by_emails(p_emails text[])
RETURNS TABLE(email text, id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT lower(e) AS email, pr.id
  FROM unnest(p_emails[1:50]) AS e
  JOIN public.profiles pr ON lower(pr.email) = lower(e)
  WHERE e IS NOT NULL AND length(e) > 0 AND length(e) <= 320;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_profiles_by_emails(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_profiles_by_emails(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_profiles_by_emails(text[]) TO authenticated;

-- ─── F-4 — Hardening anon résiduel (classe 064/069) ─────────────────
-- Fonctions nées après les migrations de durcissement anon et donc non
-- révoquées. Toutes vérifient auth.uid() en interne (inoffensives), mais
-- on aligne sur la convention (owns_task : REVOKE explicite FROM anon).

REVOKE EXECUTE ON FUNCTION public.can_access_team_okr(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_org_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_project_team() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_team_membership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_team_kr() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_team_task() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_team_okr_team() FROM anon;

-- ─── F-5 — events.created_by non forgeable ──────────────────────────
-- L'AUTEUR d'un événement est toujours l'appelant (self, ou le manager en
-- createForUser). On le fige côté serveur : INSERT → created_by = auth.uid() ;
-- UPDATE → created_by immuable. Empêche l'usurpation d'auteur via insert
-- direct (le mapper mapEventToDb est déjà propre, mais la RLS ne contraint
-- pas created_by). COALESCE préserve le backfill service_role éventuel.

CREATE OR REPLACE FUNCTION public.events_enforce_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- created_by immuable côté client (transfert service_role toléré : NULL).
    IF NEW.created_by IS DISTINCT FROM OLD.created_by AND auth.uid() IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_enforce_created_by ON public.events;
CREATE TRIGGER trg_events_enforce_created_by
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_enforce_created_by();

REVOKE EXECUTE ON FUNCTION public.events_enforce_created_by() FROM anon;

-- F-5 (search_path) : credit_premium_token_from_ad passe de `= public` à
-- `= ''` (convention projet), en schéma-qualifiant public.subscriptions.
-- Comportement identique (cap 20/24h). get_work_time_stats garde
-- `= public` (pinné, sûr — rewrite risqué sur une RPC stats active, gain nul).

CREATE OR REPLACE FUNCTION public.credit_premium_token_from_ad()
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result  public.subscriptions;
  v_start TIMESTAMPTZ;
  v_count INTEGER;
  c_daily_cap CONSTANT INTEGER := 20;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ad_credits_window_start, ad_credits_in_window
    INTO v_start, v_count
  FROM public.subscriptions
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_start IS NULL OR v_start <= NOW() - INTERVAL '24 hours' THEN
    v_start := NOW();
    v_count := 0;
  END IF;

  IF v_count >= c_daily_cap THEN
    RAISE EXCEPTION 'Daily ad-credit limit reached (% per 24h)', c_daily_cap
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.subscriptions
    SET premium_tokens          = premium_tokens + 1,
        plan                    = 'premium',
        status                  = 'active',
        ad_credits_window_start = v_start,
        ad_credits_in_window    = v_count + 1,
        updated_at              = NOW()
    WHERE user_id = auth.uid()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_premium_token_from_ad() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_premium_token_from_ad() FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_premium_token_from_ad() TO authenticated;
