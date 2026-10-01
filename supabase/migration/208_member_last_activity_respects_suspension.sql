-- ═══════════════════════════════════════════════════════════════════
-- 208 · `get_org_member_last_activity` respecte la suspension et l'échéance
--       d'accès (finding E-2, 2026-10-01)
--
-- 🔴 La fonction est `SECURITY DEFINER` : la RLS ne la borne pas, seule sa
-- CTE `me` décide de qui lit. Or `me` ne regardait que la LIGNE de
-- `organization_members`, pas son état. Un admin suspendu (mig. 161,
-- `suspended_at`) ou dont l'accès a expiré (`access_expires_at`) relisait
-- encore les dates d'activité de toute l'organisation, alors que
-- `is_org_member()` le tient déjà pour sorti partout ailleurs.
--
-- Correctif : la même condition que `is_org_member` (mig. 161), posée sur
-- l'APPELANT seulement. Les membres suspendus restent visibles comme SUJETS
-- (un admin actif doit voir quand un suspendu a travaillé pour la dernière
-- fois) ; c'est le LECTEUR suspendu qui ne voit plus rien.
--
-- Le corps est celui relu en production le 2026-10-01 par
-- `pg_get_functiondef` (mig. 170), à cette seule condition près.
-- Preuve : `supabase/proofs/208-210.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_org_member_last_activity(p_org uuid)
 RETURNS TABLE(user_id uuid, last_activity_at timestamp with time zone, source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH me AS (
    -- Index Scan sur la cle primaire (org_id, user_id).
    -- Mig. 208 : un appelant suspendu ou dont l'acces a expire n'est plus
    -- membre (meme regle que is_org_member, mig. 161).
    SELECT om.role
    FROM public.organization_members om
    WHERE om.org_id = p_org
      AND om.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
      AND om.suspended_at IS NULL
      AND (om.access_expires_at IS NULL OR om.access_expires_at > now())
  ),
  scope AS (
    -- Admin : toute l'organisation.
    SELECT m.user_id
    FROM public.organization_members m
    WHERE m.org_id = p_org
      AND EXISTS (SELECT 1 FROM me WHERE me.role = 'admin')
    UNION
    -- Manager : son sous-arbre strict, evalue UNE fois. Le garde EXISTS(me)
    -- evite de payer la CTE recursive pour un p_org etranger.
    SELECT s.user_id
    FROM (SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id) s
    WHERE EXISTS (SELECT 1 FROM me)
  )
  SELECT sc.user_id, latest.at, latest.source
  FROM scope sc
  LEFT JOIN LATERAL (
    SELECT u.at, u.source
    FROM (
      (SELECT a.created_at AS at, 'activity'::text AS source
         FROM public.team_task_activity a
        WHERE a.actor_id = sc.user_id
          AND a.org_id = p_org
        ORDER BY a.created_at DESC
        LIMIT 1)
      UNION ALL
      (SELECT c.created_at, 'comment'::text
         FROM public.team_task_comments c
         JOIN public.team_tasks t ON t.id = c.task_id
        WHERE c.author_id = sc.user_id
          AND t.org_id = p_org
        ORDER BY c.created_at DESC
        LIMIT 1)
      UNION ALL
      (SELECT t.completed_at, 'completion'::text
         FROM public.team_tasks t
        WHERE t.assignee_ids @> ARRAY[sc.user_id]
          AND t.org_id = p_org
          AND t.completed_at IS NOT NULL
        ORDER BY t.completed_at DESC
        LIMIT 1)
    ) u
    ORDER BY u.at DESC
    LIMIT 1
  ) latest ON true;
$function$;

-- `CREATE OR REPLACE` conserve l'ACL ; reposée pour qu'elle se lise ici.
REVOKE ALL ON FUNCTION public.get_org_member_last_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_member_last_activity(uuid) TO authenticated;
