-- ═══════════════════════════════════════════════════════════════════
-- 209 · Un point d'étape de KR ne s'écrit plus sans la valeur qu'il annonce
--       (finding E-1, 2026-10-01)
--
-- 🔴 `post_kr_checkin` (INVOKER) met à jour le KR sous la RLS, puis appelle
-- `insert_kr_checkin_row` (DEFINER, parce que `team_kr_checkins` n'a pas de
-- policy INSERT). Mais `insert_kr_checkin_row` est `EXECUTE` à
-- `authenticated`, il le faut pour que l'appel interne passe : elle était donc
-- AUSSI appelable seule, en RPC. Tout membre qui peut modifier le KR écrivait
-- alors un point d'étape (« 80 %, dans les temps ») SANS que la valeur du KR
-- bouge : un historique qui ment. Pas d'élévation de droits, la garde
-- `can_access_team_okr` reste celle de la policy UPDATE.
--
-- Correctif, sans toucher aux droits ni au chemin du front : la ligne n'est
-- acceptée que si le KR porte DÉJÀ cette valeur et cet état, posés DANS LA
-- MÊME TRANSACTION (`health_updated_at = now()`, `now()` étant l'instant de
-- début de transaction). `post_kr_checkin` remplit ces trois conditions par
-- construction ; un appel RPC isolé est sa propre transaction et ne les
-- remplit jamais. Même erreur qu'un refus de droits (aucun oracle).
--
-- Le corps est celui relu en production le 2026-10-01 (mig. 160), à cette
-- seule condition près. Preuve : `supabase/proofs/208-210.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_okr uuid;
BEGIN
  SELECT okr_id INTO v_okr
    FROM public.team_key_results
   WHERE id = p_kr AND org_id = p_org
     -- Mig. 209 : le KR a reçu CETTE valeur et CET état dans cette transaction.
     AND health_updated_at = now()
     AND current_value IS NOT DISTINCT FROM p_value
     AND health IS NOT DISTINCT FROM p_status;
  IF v_okr IS NULL OR NOT public.can_access_team_okr(v_okr) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.team_kr_checkins (kr_id, org_id, value, status, note, author_id)
  VALUES (p_kr, p_org, p_value, p_status, NULLIF(btrim(p_note), ''), auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.insert_kr_checkin_row(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_kr_checkin_row(uuid, uuid, numeric, text, text) TO authenticated;
