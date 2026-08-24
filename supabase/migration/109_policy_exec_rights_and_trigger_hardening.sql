-- ═══════════════════════════════════════════════════════════════════
-- Migration 109 — Referme les trois findings ouverts par la vague
--                 entreprise du 2026-08-23/24 (B-1, B-2, B-3 de faille.md)
--
-- CONSTAT COMMUN AUX TROIS
-- Aucun des trois n'est une idée neuve : chacun enfreint une règle déjà
-- écrite, dans la migration qui SUIT celle qui posait la règle. Ce n'est pas
-- de la négligence, c'est la démonstration qu'une règle qu'aucun script ne
-- mesure ne survit pas à la feature suivante. Cette migration corrige les
-- trois ; les gardes qui les auraient attrapés sont ajoutées en même temps
-- à `scripts/check-rls-advisors.mjs` et `scripts/validate-migrations.mjs`.
--
-- RÉVERSIBILITÉ : réappliquer les corps des mig. 105, 107 et 108 restaure
-- l'état antérieur. Aucune donnée n'est lue, écrite ni supprimée.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- B-1 · `org_team_members_update` appelle un helper révoqué
--
-- La mig. 100 a fermé la fuite inter-organisations en révoquant `EXECUTE`
-- sur `get_subtree` à `authenticated`, et a réécrit la seule policy qui
-- l'appelait DIRECTEMENT (`org_team_members_insert`) en `is_above`.
-- La mig. 107 a créé `org_team_members_update` en réintroduisant le motif
-- supprimé.
--
-- Pourquoi ça casse : une fonction `SECURITY DEFINER` s'exécute avec le rôle
-- PROPRIÉTAIRE — les appels internes survivent donc au REVOKE. Mais un
-- `USING` / `WITH CHECK` de policy s'évalue avec le RÔLE COURANT
-- (`authenticated`), qui n'a plus le droit. Le `OR` court-circuitant de
-- gauche à droite, l'échec est INVISIBLE pour un admin d'organisation et
-- pour quelqu'un qui modifie sa propre ligne — et frappe exactement le cas
-- pour lequel la mig. 107 a été écrite : un lead ou un manager non-admin qui
-- nomme un lead sur un subordonné, avec
--   ERROR: permission denied for function get_subtree
--
-- `is_above(p_org, p_user)` est, à la lettre,
-- `p_user IN (SELECT get_subtree(p_org, auth.uid()))` (vérifié via
-- pg_get_functiondef le 2026-08-24) : la sémantique est identique, seul le
-- droit d'exécution change.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "org_team_members_update" ON public.org_team_members;
CREATE POLICY "org_team_members_update"
  ON public.org_team_members FOR UPDATE
  USING (public.can_manage_team(team_id))
  WITH CHECK (
    public.can_manage_team(team_id)
    AND (
      public.is_org_admin(org_id)
      OR user_id = (select auth.uid())
      OR public.is_above(org_id, user_id)
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- B-2 · un simple membre pouvait faire entrer quelqu'un dans l'org
--
-- `invite_friend_to_org` (mig. 105) n'exigeait que `is_org_member(p_org)`,
-- là où les deux autres chemins d'entrée sont bien plus stricts :
--   • `org_invite_links_insert` (lien / code) : admin OU manager ayant des
--     subordonnés (`i_have_subordinates`) ;
--   • `organization_join_requests` : c'est l'admin qui répond.
-- La feuille la plus basse de la pyramide pouvait donc faire entrer un tiers
-- — et, le paywall entreprise une fois actif, consommer un siège payant —
-- sans qu'aucun admin ne l'ait décidé.
--
-- DÉCISION (Axel, 2026-08-24) : aligner sur le chemin du lien d'invitation.
-- On reprend le MÊME prédicat que `org_invite_links_insert` pour qu'il n'y
-- ait qu'une seule réponse à « qui peut faire grossir l'organisation ».
--
-- Le reste de la RPC est INCHANGÉ (amitié confirmée, non-membre, pas
-- soi-même, ré-armement d'une invitation refusée).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.invite_friend_to_org(p_org UUID, p_invitee UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_invitee = auth.uid() THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  -- L'inviteur doit appartenir à l'organisation qu'il prétend représenter.
  IF NOT public.is_org_member(p_org) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  -- … et avoir autorité pour la faire grossir (B-2). Même prédicat que
  -- `org_invite_links_insert` : admin, ou manager ayant au moins un
  -- subordonné dans CETTE organisation.
  IF NOT (public.is_org_admin(p_org) OR public.i_have_subordinates(p_org)) THEN
    RAISE EXCEPTION 'not_allowed_to_invite';
  END IF;

  -- Même modèle de confiance que le partage de tâches (mig. 027/045) :
  -- amitié CONFIRMÉE uniquement. On n'accepte pas ici la variante « demande
  -- d'ami en attente » du partage : entrer dans une entreprise engage plus
  -- qu'accepter une tâche.
  IF NOT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.user_id = auth.uid() AND f.friend_user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'not_a_friend';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'already_a_member';
  END IF;

  -- Ré-invitation : on réarme la ligne (un refus passé ne condamne pas).
  INSERT INTO public.org_invitations (org_id, inviter_id, invitee_id)
  VALUES (p_org, auth.uid(), p_invitee)
  ON CONFLICT (org_id, invitee_id) DO UPDATE
    SET inviter_id  = auth.uid(),
        created_at  = NOW(),
        accepted_at = NULL,
        declined_at = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.invite_friend_to_org(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invite_friend_to_org(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.invite_friend_to_org(UUID, UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- B-3 · les deux triggers de la mig. 108 en `SECURITY DEFINER`
--
-- Deux règles enfreintes :
--   1. « Un trigger de garde doit être SECURITY INVOKER » (audit 2026-07-26).
--      Une garde exécutée avec des privilèges élargis devient elle-même le
--      contournement. La mig. 107, écrite le même jour, respecte pourtant la
--      règle pour `freeze_team_membership_identity`.
--   2. Pas de `REVOKE … FROM anon` (mig. 064b, réappliquée par 094b).
--
-- Ce qui était RÉELLEMENT exploitable : un trigger BEFORE s'exécute AVANT
-- l'évaluation du `WITH CHECK` de la RLS. En DEFINER, la lecture de
-- `team_tasks` ignorait donc la RLS, et le message d'erreur distinguait :
--   • `depends_on_id` inexistant            -> « Both tasks must exist »
--   • `depends_on_id` réel, hors périmètre  -> « … single project »
-- soit un ORACLE D'EXISTENCE sur `team_tasks` hors organisation. Étroit
-- (il faut déjà connaître un UUID v4, la réponse est un booléen), mais c'est
-- la classe exacte du finding refermé par la mig. 100.
--
-- En INVOKER, le SELECT redevient filtré par la RLS : une tâche hors
-- périmètre est simplement introuvable, les deux cas convergent vers
-- « Both tasks must exist », et l'oracle disparaît.
--
-- POURQUOI ÇA NE CASSE PAS L'INSERTION LÉGITIME : la policy
-- `team_task_dependencies_insert` exige DÉJÀ de voir les deux tâches. Un
-- appelant autorisé les voit donc aussi depuis le trigger.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Cohérence : même projet, org_id redérivé (SECURITY INVOKER) ────
CREATE OR REPLACE FUNCTION public.validate_team_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_task_project    UUID;
  v_task_org        UUID;
  v_depends_project UUID;
BEGIN
  SELECT project_id, org_id INTO v_task_project, v_task_org
    FROM public.team_tasks WHERE id = NEW.task_id;
  SELECT project_id INTO v_depends_project
    FROM public.team_tasks WHERE id = NEW.depends_on_id;

  IF v_task_project IS NULL OR v_depends_project IS NULL THEN
    RAISE EXCEPTION 'Both tasks must exist';
  END IF;

  IF v_task_project IS DISTINCT FROM v_depends_project THEN
    RAISE EXCEPTION 'A dependency must stay within a single project';
  END IF;

  -- `org_id` n'est jamais pris depuis l'input : il est redérivé de la tâche.
  NEW.org_id := v_task_org;
  RETURN NEW;
END;
$fn$;

-- ─── Anti-cycle (SECURITY INVOKER) ──────────────────────────────────
-- La récursion lit `team_task_dependencies`, désormais sous RLS. Ce n'est
-- pas un angle mort : une dépendance ne peut exister qu'à l'intérieur d'un
-- même projet (trigger ci-dessus), et qui voit une tâche du projet voit
-- toutes ses dépendances. La chaîne remontée est donc complète.
CREATE OR REPLACE FUNCTION public.prevent_team_task_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT NEW.depends_on_id, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.team_task_dependencies d
        JOIN upstream u ON d.task_id = u.id
       WHERE u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'This dependency would create a cycle';
  END IF;
  RETURN NEW;
END;
$fn$;

-- ─── Durcissement sur TOUTES les fonctions de trigger restantes ─────
-- Une fonction `RETURNS trigger` n'est de toute façon pas appelable
-- directement (Postgres refuse), mais la règle 064b/094b veut qu'aucune ne
-- soit exécutable par `anon` ni `authenticated` : c'est ce qui rend l'advisor
-- lisible, donc ce qui permet de VOIR la prochaine anomalie. Quatre fonctions
-- restaient exposées au 2026-08-24 — deux de la mig. 108, une de la 107, plus
-- `seed_default_categories` (mig. 102), jamais révoquée.
--
-- ⚠️ `authenticated` EXPLICITEMENT : `REVOKE … FROM PUBLIC` ne retire pas le
-- GRANT par défaut posé par Supabase (leçon de la mig. 094b, réappliquée par
-- les mig. 095 et 110).
--
-- Retirer ces droits ne casse aucun trigger : Postgres vérifie le privilège
-- `EXECUTE` d'une fonction de trigger au `CREATE TRIGGER`, pas à chaque
-- déclenchement. C'est le modèle déjà en production pour
-- `notify_task_assignment` / `notify_comment_mention` (mig. 095).
REVOKE ALL ON FUNCTION public.validate_team_task_dependency()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_team_task_dependency_cycle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_team_membership_identity()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_categories()            FROM PUBLIC, anon, authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION (à copier/coller dans le SQL editor)
--
--   -- B-1 : la policy ne cite plus get_subtree
--   select with_check from pg_policies
--    where tablename = 'org_team_members' and cmd = 'UPDATE';
--   -- attendu : contient is_above(...), ne contient PAS get_subtree
--
--   -- B-1 bis : toute fonction citée par une policy est exécutable
--   select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE')
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('can_manage_team','is_org_admin','is_above');
--   -- attendu : true partout
--
--   -- B-3 : plus aucune fonction de trigger en DEFINER ni ouverte à anon
--   select p.proname, p.prosecdef,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     join pg_type t on t.oid = p.prorettype
--    where n.nspname = 'public' and t.typname = 'trigger';
--   -- attendu : anon_exec = false partout
-- ═══════════════════════════════════════════════════════════════════
