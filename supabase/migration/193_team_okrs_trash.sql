-- ═══════════════════════════════════════════════════════════════════
-- 193 · Un objectif d'équipe supprimé va à la CORBEILLE, 30 jours
--        (recommandations de l'étape 6, 2026-09-25)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. La 152 a mis les TÂCHES d'équipe à la
-- corbeille. Un OKR d'entreprise, lui, se supprimait toujours pour de bon,
-- avec ses résultats clés, ses points d'étape (160) et ses liens de projets :
-- un clic de trop effaçait un trimestre de suivi, sans retour possible.
--
-- ── CE QUE FAIT CETTE MIGRATION ─────────────────────────────────────
--
--   · `team_okrs.deleted_at` / `deleted_by`. Personne ne les écrit en
--     direct : seules `trash_team_okr` / `restore_team_okr` (DEFINER).
--   · `can_access_team_okr` exclut la corbeille. Comme TOUT ce qui touche un
--     OKR passe par ce helper (KR, liens d'équipes, liens de projets, points
--     d'étape, policies), un objectif à la corbeille disparaît d'un bloc, et
--     revient d'un bloc.
--   · La suppression DÉFINITIVE devient un geste d'admin (depuis la corbeille)
--     et la purge à 30 jours un job planifié, comme pour les tâches.
--   · Le rappel `kr_due` (162) ne parle plus d'un objectif à la corbeille.
--   · Tâches (152) : la corbeille est invisible à la RLS, donc un admin ne
--     pouvait pas la vider avant 30 jours. `purge_team_task` le permet, depuis
--     la corbeille et pour un admin seulement, comme `purge_team_okr`.
--   · Journal d'audit : `okr.trashed`, `okr.restored`, `okr.deleted`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.team_okrs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_okrs_trash
  ON public.team_okrs (org_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- ── 1. Personne ne pose ni ne retire `deleted_at` en direct ────────
CREATE OR REPLACE FUNCTION public.team_okr_trash_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
          OR (NEW.deleted_by IS NOT NULL AND NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)) THEN
    RAISE EXCEPTION 'team_okr_trash_direct_write' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_okr_trash_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_okr_trash_guard ON public.team_okrs;
CREATE TRIGGER trg_team_okr_trash_guard
  BEFORE UPDATE ON public.team_okrs
  FOR EACH ROW EXECUTE FUNCTION public.team_okr_trash_guard();

-- ── 2. Un objectif à la corbeille n'est accessible par personne ────
-- Corps de la mig. 073, une condition ajoutée.
CREATE OR REPLACE FUNCTION public.can_access_team_okr(p_okr UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
    WHERE o.id = p_okr
      AND o.deleted_at IS NULL
      AND (
        public.is_org_admin(o.org_id)
        OR (
          NOT EXISTS (SELECT 1 FROM public.team_okr_teams l WHERE l.okr_id = o.id)
          AND public.is_org_member(o.org_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.team_okr_teams l
          JOIN public.org_team_members tm ON tm.team_id = l.team_id
          WHERE l.okr_id = o.id
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(o.org_id, auth.uid()))
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_team_okr(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_team_okr(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_team_okr(UUID) TO authenticated;

-- Suppression définitive : admin seulement (depuis la corbeille). Une seule
-- policy par action (mig. 049) : on REMPLACE celle de la 115.
DROP POLICY IF EXISTS "team_okrs_delete" ON public.team_okrs;
CREATE POLICY "team_okrs_delete"
  ON public.team_okrs FOR DELETE
  USING (public.is_org_admin(org_id));

-- ── 3. Les trois RPC de la corbeille ───────────────────────────────

-- Mettre à la corbeille : miroir de l'ancienne policy DELETE (`okr.delete`),
-- plus la visibilité de l'objectif.
CREATE OR REPLACE FUNCTION public.trash_team_okr(p_okr uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT o.org_id INTO v_org
    FROM public.team_okrs o
   WHERE o.id = p_okr AND o.deleted_at IS NULL
   FOR UPDATE;
  -- Même réponse pour « n'existe pas » et « ne vous est pas visible ».
  IF v_org IS NULL OR NOT public.can_access_team_okr(p_okr) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.my_org_perm(v_org, 'okr.delete') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_okrs SET deleted_at = now(), deleted_by = v_uid WHERE id = p_okr;
END;
$function$;

-- Qui peut restaurer : un admin, la personne qui a supprimé, ou un
-- détenteur de `okr.delete`, tant qu'il est membre actif.
CREATE OR REPLACE FUNCTION public.can_restore_team_okr(p_org uuid, p_deleted_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT (select auth.uid()) IS NOT NULL
     AND public.is_org_member(p_org)
     AND (
       public.is_org_admin(p_org)
       OR p_deleted_by = (select auth.uid())
       OR public.my_org_perm(p_org, 'okr.delete')
     );
$function$;

CREATE OR REPLACE FUNCTION public.restore_team_okr(p_okr uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_okr record;
BEGIN
  SELECT o.id, o.org_id, o.deleted_by INTO v_okr
    FROM public.team_okrs o
   WHERE o.id = p_okr AND o.deleted_at IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND OR NOT public.can_restore_team_okr(v_okr.org_id, v_okr.deleted_by) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.team_okrs SET deleted_at = NULL, deleted_by = NULL WHERE id = p_okr;
END;
$function$;

-- ❌ Jamais `SELECT o.*` : l'intitulé et les métadonnées de suppression, pas
-- la description (le contenu reste derrière la restauration).
CREATE OR REPLACE FUNCTION public.get_team_okr_trash(p_org uuid)
RETURNS TABLE (
  id         uuid,
  title      text,
  deleted_at timestamptz,
  deleted_by uuid,
  created_by uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT o.id, o.title, o.deleted_at, o.deleted_by, o.created_by
    FROM public.team_okrs o
   WHERE o.org_id = p_org
     AND o.deleted_at IS NOT NULL
     AND o.deleted_at > now() - INTERVAL '30 days'
     AND public.can_restore_team_okr(o.org_id, o.deleted_by)
   ORDER BY o.deleted_at DESC
   LIMIT 200;
$function$;

-- Suppression définitive DEPUIS la corbeille, admin seulement. DEFINER : la
-- policy DELETE est admin, mais `can_access_team_okr` rend la ligne
-- invisible à la corbeille, donc un DELETE direct ne la trouverait pas.
CREATE OR REPLACE FUNCTION public.purge_team_okr(p_okr uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_okrs WHERE id = p_okr AND deleted_at IS NOT NULL;
  IF v_org IS NULL OR NOT public.is_org_admin(v_org) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.team_okrs WHERE id = p_okr;
END;
$function$;

REVOKE ALL ON FUNCTION public.trash_team_okr(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_team_okr(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_team_okr_trash(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_team_okr(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_restore_team_okr(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trash_team_okr(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_team_okr(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_okr_trash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_team_okr(uuid) TO authenticated;

-- Même geste pour une TÂCHE à la corbeille (mig. 152) : sa policy SELECT
-- (`deleted_at IS NULL`) la rend introuvable par un DELETE direct.
CREATE OR REPLACE FUNCTION public.purge_team_task(p_task uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_tasks WHERE id = p_task AND deleted_at IS NOT NULL;
  IF v_org IS NULL OR NOT public.is_org_admin(v_org) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.team_tasks WHERE id = p_task;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_team_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_team_task(uuid) TO authenticated;

-- ── 4. Purge à 30 jours ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_team_okr_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.team_okrs
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_team_okr_trash() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cosmo-purge-team-okr-trash')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-purge-team-okr-trash');

-- 03:47 UTC : juste après la corbeille des tâches (03:45, mig. 152).
SELECT cron.schedule(
  'cosmo-purge-team-okr-trash',
  '47 3 * * *',
  $cron$SELECT public.purge_team_okr_trash();$cron$
);

-- ── 5. Le rappel `kr_due` ignore la corbeille ──────────────────────
-- Corps de la mig. 162, une condition ajoutée.
CREATE OR REPLACE FUNCTION public.notify_kr_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.org_notifications (org_id, user_id, kind, kr_id, meta)
  SELECT DISTINCT k.org_id, r.uid, 'kr_due', k.id,
         jsonb_build_object('title', left(k.title, 120), 'endDate', o.end_date)
    FROM public.team_key_results k
    JOIN public.team_okrs o ON o.id = k.okr_id
    CROSS JOIN LATERAL (
      SELECT o.created_by AS uid
      UNION SELECT k.assignee_id
      UNION SELECT unnest(k.contributor_ids)
    ) r
   WHERE NOT k.completed
     AND o.deleted_at IS NULL
     AND o.end_date = current_date + 3
     AND r.uid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.org_notifications n
        WHERE n.kr_id = k.id AND n.user_id = r.uid AND n.kind = 'kr_due'
          AND n.created_at > now() - INTERVAL '7 days'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_kr_due() FROM PUBLIC, anon, authenticated;

-- ── 6. Journal d'audit ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_team_okr_trash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.write_org_audit(OLD.org_id, 'okr.deleted', 'okr', OLD.id, NULL,
      jsonb_build_object('name', left(OLD.title, 120)));
  ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM public.write_org_audit(NEW.org_id,
      CASE WHEN NEW.deleted_at IS NULL THEN 'okr.restored' ELSE 'okr.trashed' END,
      'okr', NEW.id, NULL, jsonb_build_object('name', left(NEW.title, 120)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_team_okr_trash() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_team_okr_trash ON public.team_okrs;
CREATE TRIGGER trg_audit_team_okr_trash
  AFTER UPDATE OF deleted_at OR DELETE ON public.team_okrs
  FOR EACH ROW EXECUTE FUNCTION public.audit_team_okr_trash();

COMMIT;
