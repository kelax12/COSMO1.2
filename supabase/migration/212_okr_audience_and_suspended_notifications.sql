-- ═══════════════════════════════════════════════════════════════════
-- 212 · Audience d'un OKR : la gérer exige le droit de MODIFIER l'OKR (E-3)
--       Notifications : un membre suspendu n'en reçoit plus (E-4)
--       (2026-10-01, audit A-1 joué en production)
--
-- ── E-3 ─────────────────────────────────────────────────────────────
--
-- 🔴 `team_okr_members` (mig. 205) et `team_okr_teams` (mig. 073) n'exigeaient
-- que `is_org_manager(org_id)` pour ajouter ou retirer un lien : admin, ou
-- n'importe qui ayant un subordonné, SANS regarder l'OKR. Prouvé en prod
-- (transaction annulée) : un manager qui ne voit pas un OKR `custom` s'y
-- inscrit, puis le voit, le lit et modifie ses KR (la policy UPDATE de
-- `team_key_results` est `can_access_team_okr`). Il peut aussi retirer les
-- autres, et l'OKR se referme sur les admins.
--
-- Règle : gérer l'audience = le droit de modifier l'OKR (policy UPDATE de
-- `team_okrs` : manager ET voit l'OKR), plus le CRÉATEUR. Sans lui, un manager
-- qui crée un OKR `custom` ne pourrait pas y mettre la première personne : sans
-- lien, il ne le voit pas encore (cf. l'invariant de la mig. 205).
--
-- 🔴 Pourquoi une fonction d'écriture en plus des policies : le front
-- remplaçait l'audience en DEUX requêtes (tout supprimer, puis réinsérer). Un
-- manager qui ne voit l'OKR que parce qu'il est dans son audience perdait ce
-- droit à la suppression, et la réinsertion était refusée : l'OKR se
-- refermait. `set_team_okr_links` vérifie le droit UNE fois, AVANT de toucher
-- à quoi que ce soit, puis remplace en une transaction. Les policies, elles,
-- bornent les onglets restés sur l'ancien code, qui écrivent encore la table.
--
-- ── E-4 ─────────────────────────────────────────────────────────────
--
-- `org_notifications` se lit par `user_id = auth.uid()` seul. Trois triggers
-- notifiaient sans écarter les membres suspendus ou expirés, qui lisaient
-- donc encore les changements de statut, les commentaires et le NOM des
-- projets archivés. `notify_project_at_risk` et `notify_team_task_automations`
-- les écartaient déjà : alignement, sur la règle de `is_org_member` (mig. 161).
--
-- Corps relus en production le 2026-10-01 par `pg_get_functiondef` ; seules
-- les lignes marquées « mig. 212 » changent.
-- Preuve : `supabase/proofs/212.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Qui gère l'audience d'un OKR ────────────────────────────────
-- DEFINER parce qu'une policy l'appelle et que l'OKR peut être invisible à
-- son propre créateur (aucun lien) : la lecture se fait sans RLS, la décision
-- ne repose que sur `auth.uid()`. Introuvable et refusé rendent le même `false`.
CREATE OR REPLACE FUNCTION public.can_manage_team_okr_audience(p_okr uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
     WHERE o.id = p_okr
       AND o.deleted_at IS NULL
       AND (
         public.is_org_admin(o.org_id)
         OR (
           public.is_org_manager(o.org_id)
           -- `is_org_manager` ne regarde pas la suspension (has_subordinates).
           AND public.is_org_member(o.org_id)
           AND (o.created_by = (SELECT auth.uid()) OR public.can_access_team_okr(o.id))
         )
       )
  );
$function$;

REVOKE ALL ON FUNCTION public.can_manage_team_okr_audience(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_team_okr_audience(uuid) TO authenticated;

-- ── 2 · Les policies d'écriture des deux tables de liens ────────────
DROP POLICY IF EXISTS "team_okr_members_insert" ON public.team_okr_members;
CREATE POLICY "team_okr_members_insert"
  ON public.team_okr_members FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_team_okr_audience(okr_id));

DROP POLICY IF EXISTS "team_okr_members_delete" ON public.team_okr_members;
CREATE POLICY "team_okr_members_delete"
  ON public.team_okr_members FOR DELETE
  TO authenticated
  USING (public.can_manage_team_okr_audience(okr_id));

DROP POLICY IF EXISTS "team_okr_teams_insert" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_insert"
  ON public.team_okr_teams FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_team_okr_audience(okr_id));

DROP POLICY IF EXISTS "team_okr_teams_delete" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_delete"
  ON public.team_okr_teams FOR DELETE
  TO authenticated
  USING (public.can_manage_team_okr_audience(okr_id));

-- ── 3 · Remplacer l'audience d'un bloc ─────────────────────────────
-- `NULL` = ne pas toucher à cette liste. Mêmes plafonds que le front (20
-- équipes, 50 personnes). L'organisation vient de l'OKR, jamais de l'appelant ;
-- la clé (okr_id, org_id) → organization_members et le trigger
-- `validate_team_okr_team` refusent toute personne ou équipe étrangère.
CREATE OR REPLACE FUNCTION public.set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.can_manage_team_okr_audience(p_okr) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT o.org_id INTO v_org FROM public.team_okrs o WHERE o.id = p_okr;

  IF p_team_ids IS NOT NULL THEN
    DELETE FROM public.team_okr_teams WHERE okr_id = p_okr;
    INSERT INTO public.team_okr_teams (okr_id, org_id, team_id, added_by)
      SELECT p_okr, v_org, t.id, auth.uid()
        FROM (SELECT DISTINCT unnest(p_team_ids) AS id LIMIT 20) t;
  END IF;

  IF p_member_ids IS NOT NULL THEN
    DELETE FROM public.team_okr_members WHERE okr_id = p_okr;
    INSERT INTO public.team_okr_members (okr_id, org_id, user_id, added_by)
      SELECT p_okr, v_org, m.id, auth.uid()
        FROM (SELECT DISTINCT unnest(p_member_ids) AS id LIMIT 50) m;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_team_okr_links(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_team_okr_links(uuid, uuid[], uuid[]) TO authenticated;

-- ── 4 · E-4 : plus de notification à un membre suspendu ou expiré ───
CREATE OR REPLACE FUNCTION public.notify_team_task_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Suiveurs, créateur, assignés : sauf l'auteur du changement.
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id, meta)
  SELECT DISTINCT NEW.org_id, r.uid, v_actor, 'status_changed', NEW.id,
         jsonb_build_object('from', OLD.status, 'to', NEW.status)
    FROM (
      SELECT f.user_id AS uid FROM public.team_task_followers f WHERE f.task_id = NEW.id
      UNION SELECT NEW.created_by
      UNION SELECT unnest(COALESCE(NEW.assignee_ids, ARRAY[]::uuid[]))
    ) r
   WHERE r.uid IS NOT NULL
     AND r.uid IS DISTINCT FROM v_actor
     AND EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.org_id = NEW.org_id AND m.user_id = r.uid
                    -- mig. 212 : un membre suspendu ou expiré n'est plus notifié.
                    AND m.suspended_at IS NULL
                    AND (m.access_expires_at IS NULL OR m.access_expires_at > now()));

  -- Terminée : les tâches qu'elle bloquait et qui n'attendent plus rien.
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    SELECT DISTINCT NEW.org_id, a.uid, v_actor, 'unblocked', b.id
      FROM public.team_task_dependencies d
      JOIN public.team_tasks b ON b.id = d.task_id AND NOT b.completed
      CROSS JOIN LATERAL unnest(COALESCE(b.assignee_ids, ARRAY[]::uuid[])) AS a(uid)
     WHERE d.depends_on_id = NEW.id
       AND a.uid IS DISTINCT FROM v_actor
       -- mig. 212 : même règle pour les assignés débloqués.
       AND EXISTS (SELECT 1 FROM public.organization_members m
                    WHERE m.org_id = NEW.org_id AND m.user_id = a.uid
                      AND m.suspended_at IS NULL
                      AND (m.access_expires_at IS NULL OR m.access_expires_at > now()))
       AND NOT EXISTS (
         SELECT 1 FROM public.team_task_dependencies d2
           JOIN public.team_tasks o ON o.id = d2.depends_on_id
          WHERE d2.task_id = b.id AND o.id <> NEW.id AND NOT o.completed
       );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_team_project_archived()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF OLD.archived_at IS NOT NULL OR NEW.archived_at IS NULL OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, project_id, meta)
  SELECT NEW.org_id, r.uid, v_actor, 'project_archived', NEW.id,
         jsonb_build_object('project_name', NEW.name)
    FROM (
      SELECT DISTINCT unnest(t.assignee_ids) AS uid
        FROM public.team_tasks t
       WHERE t.project_id = NEW.id AND NOT t.completed AND t.deleted_at IS NULL
      UNION
      SELECT NEW.owner_id WHERE NEW.owner_id IS NOT NULL
      UNION
      SELECT f.user_id FROM public.team_project_followers f WHERE f.project_id = NEW.id
    ) r
    JOIN public.organization_members om ON om.org_id = NEW.org_id AND om.user_id = r.uid
         -- mig. 212 : un membre suspendu ou expiré ne lit plus le nom du projet.
         AND om.suspended_at IS NULL
         AND (om.access_expires_at IS NULL OR om.access_expires_at > now())
   WHERE r.uid IS DISTINCT FROM v_actor;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_task_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_assignee UUID;
  v_org UUID;
  v_assignee_ids UUID[];
BEGIN
  SELECT t.org_id, t.assignee_ids INTO v_org, v_assignee_ids
    FROM public.team_tasks t WHERE t.id = NEW.task_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_assignee IN ARRAY COALESCE(v_assignee_ids, ARRAY[]::uuid[])
  LOOP
    -- On ne se notifie pas soi-même pour son propre commentaire.
    CONTINUE WHEN v_assignee = NEW.author_id;
    -- Déjà notifié via `notify_comment_mention` (mig. 095) pour CE même
    -- commentaire : une seconde notification « comment » en plus de la
    -- « mention » serait un doublon sur le même événement.
    CONTINUE WHEN v_assignee = ANY (COALESCE(NEW.mentions, ARRAY[]::uuid[]));
    -- mig. 212 : un membre suspendu, expiré ou sorti n'est plus notifié.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = v_org AND m.user_id = v_assignee
         AND m.suspended_at IS NULL
         AND (m.access_expires_at IS NULL OR m.access_expires_at > now())
    );
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (v_org, v_assignee, NEW.author_id, 'comment', NEW.task_id);
  END LOOP;
  RETURN NEW;
END;
$function$;

-- `CREATE OR REPLACE` conserve l'ACL des fonctions de trigger ; reposée ici.
REVOKE ALL ON FUNCTION public.notify_team_task_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_team_project_archived() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_comment() FROM PUBLIC, anon, authenticated;
