-- ═══════════════════════════════════════════════════════════════════
-- 207, un membre suspendu ou expiré ne garde AUCUN droit de manager,
--      et un manager ne s'ouvre pas lui-même un OKR confidentiel
--
-- Audit de sécurité du 2026-09-30, avant l'ouverture de l'acquisition.
-- Corps de fonctions repris du CATALOGUE de production relu le 2026-09-30
-- (`pg_get_functiondef`), pas des fichiers : 13 migrations récentes n'ont
-- pas d'entrée au ledger, le fichier ne prouve pas ce qui tourne.
--
-- ── DÉFAUT 1 : la suspension (mig. 161) n'a été posée qu'à deux endroits ─
--
-- La 161 a ajouté `suspended_at` et `access_expires_at`, et les a fait
-- respecter par `is_org_member` et `is_org_admin`. Tout ce qui lit
-- `organization_members`, `org_team_members` ou `get_subtree` SANS passer
-- par ces deux fonctions ignore la suspension. Mesuré en prod le 2026-09-30,
-- un manager suspendu (ou dont l'accès a expiré) gardait :
--
--   · l'agenda de ses subordonnés, en lecture ET en écriture
--     (`events`, via `my_managed_user_ids`) ;
--   · l'écriture des labels et des liens d'OKR (`is_org_manager`, dont la
--     branche `has_subordinates` ne regarde pas la suspension) ;
--   · les OKR rattachés à son équipe, et la mise à jour de leurs KR
--     (`can_access_team_okr`, branche équipe) ;
--   · la dernière activité de chaque membre (`get_org_member_last_activity`) ;
--   · les profils de ses collègues (`shares_org_with`) ;
--   · `is_above` et `i_have_subordinates`, cités par des policies.
--
-- Et `org_activity_reports_select` laissait lire les rapports d'une équipe
-- à qui l'avait CRÉÉE, même après avoir quitté l'organisation.
--
-- Règle posée ici : toute branche qui accorde un droit à l'APPELANT exige
-- `public.is_org_member(org)`. Le sous-arbre (`get_subtree`) n'est PAS
-- filtré : un manager actif voit toujours un subordonné suspendu, c'est
-- voulu (il faut pouvoir reprendre son travail).
--
-- ── DÉFAUT 2 : un manager pouvait s'ouvrir un OKR qu'il ne voit pas ──────
--
-- `team_okr_teams_insert` et `team_okr_members_insert` n'exigeaient que
-- `is_org_manager(org_id)`. Tout manager de l'organisation, même d'une autre
-- équipe, pouvait donc lier SON équipe (ou lui-même) à un OKR réservé à
-- d'autres, puis le lire et modifier ses KR. Le trigger
-- `validate_team_okr_team` empêche bien le passage d'une organisation à
-- l'autre ; il ne dit rien à l'intérieur d'une même organisation.
--
-- Désormais, poser OU retirer un lien exige de VOIR déjà l'OKR, ou d'en être
-- l'auteur (le manager qui crée un OKR « Personnaliser » ne le voit pas
-- encore, cf. mig. 205 § 4, et doit pouvoir poser ses premiers liens).
-- Retirer est inclus : ôter le dernier lien d'un OKR resté à `audience =
-- 'org'` (onglet sur un ancien bundle) le publierait à toute l'entreprise.
--
-- ── RETOUR ARRIÈRE ─────────────────────────────────────────────────
--
-- Les définitions de production capturées le 2026-09-30 sont recopiées en
-- tête de `supabase/proofs/207.proof.sql`. Toutes les fonctions gardent leur
-- signature : `CREATE OR REPLACE` conserve leurs droits `EXECUTE`.
--
-- ⚠️ NON APPLIQUÉE, NON PROUVÉE au 2026-09-30. Preuve prête :
--    `supabase/proofs/207.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. is_org_manager : la branche « a des subordonnés » exige d'être actif

CREATE OR REPLACE FUNCTION public.is_org_manager(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.is_org_admin(p_org)
      OR (public.is_org_member(p_org) AND public.has_subordinates(p_org, auth.uid()));
$function$;

-- ── 2. i_have_subordinates / is_above (cités par des policies) ──────

CREATE OR REPLACE FUNCTION public.i_have_subordinates(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.is_org_member(p_org)
     AND EXISTS (
       SELECT 1 FROM public.organization_members
        WHERE org_id = p_org AND manager_id = (SELECT auth.uid())
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_above(p_org uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.is_org_member(p_org)
     AND p_user IN (SELECT public.get_subtree(p_org, auth.uid()));
$function$;

-- ── 3. my_managed_user_ids : l'agenda des subordonnés (policies `events`)

CREATE OR REPLACE FUNCTION public.my_managed_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(ARRAY(
    SELECT DISTINCT target.user_id
      FROM public.organization_members me
      JOIN public.organization_members target ON target.org_id = me.org_id
     WHERE me.user_id = auth.uid()
       AND me.suspended_at IS NULL
       AND (me.access_expires_at IS NULL OR me.access_expires_at > now())
       AND target.user_id IS NOT NULL
       AND target.user_id <> auth.uid()
       AND (
         me.role = 'admin'
         OR target.user_id IN (SELECT public.get_subtree(me.org_id, auth.uid()))
       )
  ), '{}'::uuid[]);
$function$;

-- ── 4. shares_org_with : lecture des profils des collègues ───────────

CREATE OR REPLACE FUNCTION public.shares_org_with(p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.organization_members mine
      JOIN public.organization_members theirs ON theirs.org_id = mine.org_id
     WHERE mine.user_id = auth.uid()
       AND mine.suspended_at IS NULL
       AND (mine.access_expires_at IS NULL OR mine.access_expires_at > now())
       AND theirs.user_id = p_target
  );
$function$;

-- ── 5. get_org_member_last_activity : `me` exige un membre actif ─────

CREATE OR REPLACE FUNCTION public.get_org_member_last_activity(p_org uuid)
RETURNS TABLE(user_id uuid, last_activity_at timestamp with time zone, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH me AS (
    -- Index Scan sur la cle primaire (org_id, user_id).
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
      SELECT u.at, u.source FROM (
        (SELECT a.created_at AS at, 'activity'::text AS source
           FROM public.team_task_activity a
          WHERE a.actor_id = sc.user_id AND a.org_id = p_org
          ORDER BY a.created_at DESC LIMIT 1)
        UNION ALL
        (SELECT c.created_at, 'comment'::text
           FROM public.team_task_comments c
           JOIN public.team_tasks t ON t.id = c.task_id
          WHERE c.author_id = sc.user_id AND t.org_id = p_org
          ORDER BY c.created_at DESC LIMIT 1)
        UNION ALL
        (SELECT t.completed_at, 'completion'::text
           FROM public.team_tasks t
          WHERE t.assignee_ids @> ARRAY[sc.user_id] AND t.org_id = p_org
            AND t.completed_at IS NOT NULL
          ORDER BY t.completed_at DESC LIMIT 1)
      ) u
      ORDER BY u.at DESC
      LIMIT 1
    ) latest ON true;
$function$;

-- ── 6. can_access_team_okr : la branche équipe exige un membre actif ─
--
-- Reprise exacte de la version de production (mig. 205), une seule ligne
-- ajoutée dans la branche `team_okr_teams`.

CREATE OR REPLACE FUNCTION public.can_access_team_okr(p_okr uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
    WHERE o.id = p_okr
      AND o.deleted_at IS NULL
      AND (
        public.is_org_admin(o.org_id)
        OR (
          o.audience = 'org'
          AND NOT EXISTS (SELECT 1 FROM public.team_okr_teams l WHERE l.okr_id = o.id)
          AND NOT EXISTS (SELECT 1 FROM public.team_okr_members m WHERE m.okr_id = o.id)
          AND public.is_org_member(o.org_id)
        )
        OR (
          public.is_org_member(o.org_id)
          AND EXISTS (
            SELECT 1 FROM public.team_okr_teams l
            JOIN public.org_team_members tm ON tm.team_id = l.team_id
            WHERE l.okr_id = o.id
              AND (
                tm.user_id = auth.uid()
                OR tm.user_id IN (SELECT public.get_subtree(o.org_id, auth.uid()))
              )
          )
        )
        OR (
          o.audience = 'custom'
          AND public.is_org_member(o.org_id)
          AND EXISTS (
            SELECT 1 FROM public.team_okr_members m
            WHERE m.okr_id = o.id
              AND (
                m.user_id = auth.uid()
                OR m.user_id IN (SELECT public.get_subtree(o.org_id, auth.uid()))
              )
          )
        )
      )
  );
$function$;

-- ── 7. Rapports d'activité : lead ou créateur d'équipe ET membre actif ─

DROP POLICY IF EXISTS "org_activity_reports_select" ON public.org_activity_reports;
CREATE POLICY "org_activity_reports_select"
  ON public.org_activity_reports FOR SELECT
  TO authenticated
  USING (
    CASE scope
      WHEN 'org' THEN public.my_report_perm(org_id, 'report.org')
      ELSE (
        public.my_report_perm(org_id, 'report.allTeams')
        OR (
          public.is_org_member(org_id)
          AND team_id IN (
            SELECT tm.team_id FROM public.org_team_members tm
             WHERE tm.user_id = (SELECT auth.uid()) AND tm.is_lead
            UNION
            SELECT t.id FROM public.org_teams t
             WHERE t.created_by = (SELECT auth.uid())
          )
        )
      )
    END
  );

-- ── 8. transfer_org_ownership : jamais vers un compte suspendu ou expiré

CREATE OR REPLACE FUNCTION public.transfer_org_ownership(p_org uuid, p_new_owner uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.organizations WHERE id = p_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Seul l'owner ACTUEL transfère (pas un simple admin).
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the owner can transfer ownership';
  END IF;

  IF p_new_owner IS NULL OR p_new_owner = auth.uid() THEN
    RAISE EXCEPTION 'Invalid new owner';
  END IF;

  -- Mig. 207 : un compte suspendu ou expiré ne devient pas propriétaire,
  -- `set_member_access` refusant ensuite de restreindre un propriétaire.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE org_id = p_org AND user_id = p_new_owner
       AND suspended_at IS NULL
       AND (access_expires_at IS NULL OR access_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'New owner must be a member of the organization';
  END IF;

  PERFORM set_config('cosmo.allow_owner_transfer', 'on', true); -- local à la tx
  UPDATE public.organizations SET owner_id = p_new_owner WHERE id = p_org;

  -- Le nouvel owner devient admin (idempotent) ; l'ancien owner RESTE
  -- admin — il peut ensuite se rétrograder/partir via les flux existants
  -- (la garde « dernier admin » de leave_organization continue de protéger).
  UPDATE public.organization_members
     SET role = 'admin'
   WHERE org_id = p_org AND user_id = p_new_owner;
END;
$function$;

-- ── 9. Liens d'OKR : il faut déjà voir l'OKR, ou en être l'auteur ────
--
-- `team_okrs` est sous RLS : une sous-requête de policy ne verrait pas
-- l'OKR « Personnaliser » que son auteur ne voit pas encore. D'où une
-- fonction DEFINER étroite, qui ne répond que pour l'appelant.

CREATE OR REPLACE FUNCTION public.i_created_team_okr(p_okr uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
     WHERE o.id = p_okr
       AND o.deleted_at IS NULL
       AND o.created_by = (SELECT auth.uid())
       AND public.is_org_member(o.org_id)
  );
$function$;

REVOKE ALL ON FUNCTION public.i_created_team_okr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_created_team_okr(uuid) TO authenticated;

DROP POLICY IF EXISTS "team_okr_teams_insert" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_insert"
  ON public.team_okr_teams FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_manager(org_id)
    AND (public.can_access_team_okr(okr_id) OR public.i_created_team_okr(okr_id))
  );

DROP POLICY IF EXISTS "team_okr_teams_delete" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_delete"
  ON public.team_okr_teams FOR DELETE
  TO authenticated
  USING (
    public.is_org_manager(org_id)
    AND (public.can_access_team_okr(okr_id) OR public.i_created_team_okr(okr_id))
  );

DROP POLICY IF EXISTS "team_okr_members_insert" ON public.team_okr_members;
CREATE POLICY "team_okr_members_insert"
  ON public.team_okr_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_manager(org_id)
    AND (public.can_access_team_okr(okr_id) OR public.i_created_team_okr(okr_id))
  );

DROP POLICY IF EXISTS "team_okr_members_delete" ON public.team_okr_members;
CREATE POLICY "team_okr_members_delete"
  ON public.team_okr_members FOR DELETE
  TO authenticated
  USING (
    public.is_org_manager(org_id)
    AND (public.can_access_team_okr(okr_id) OR public.i_created_team_okr(okr_id))
  );

-- ── Vérification après application (lecture seule) ─────────────────
--
--   SELECT p.proname,
--          position('is_org_member' in pg_get_functiondef(p.oid)) > 0 AS actif
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('is_org_manager','i_have_subordinates','is_above',
--                        'can_access_team_okr','i_created_team_okr');
--   -- attendu : actif = t sur les cinq lignes
--
--   SELECT p.proname,
--          position('suspended_at' in pg_get_functiondef(p.oid)) > 0 AS actif
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN ('my_managed_user_ids','shares_org_with',
--                        'get_org_member_last_activity','transfer_org_ownership');
--   -- attendu : actif = t sur les quatre lignes
--
--   SELECT has_function_privilege('anon', 'public.i_created_team_okr(uuid)', 'EXECUTE');
--   -- attendu : f
