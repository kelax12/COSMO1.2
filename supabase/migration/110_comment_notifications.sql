-- ═══════════════════════════════════════════════════════════════════
-- 110 — Notification + badge non-lu : commentaire sur une tâche assignée
--
-- La mig. 095 notifiait déjà les MENTIONS (« @nom » dans un commentaire),
-- mais pas le reste : un assigné qui n'est mentionné par personne ne sait
-- jamais qu'un commentaire a été posté sur SA tâche. La mention est un cas
-- particulier (quelqu'un vous interpelle) ; être simplement assigné à la
-- tâche commentée en est un autre (la conversation avance sans vous, mais
-- vous concerne quand même) — les deux méritent une notification.
--
-- Réutilise `org_notifications` (mig. 095) plutôt qu'une table dédiée : le
-- badge « non lus » par tâche se dérive alors gratuitement côté client en
-- comptant les lignes `kind = 'comment', read_at IS NULL, task_id = X` de
-- CE destinataire (RLS `org_notifications_select` ne renvoie déjà que les
-- siennes) — aucune nouvelle table de lecture à maintenir.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Nouveau type de notification ──────────────────────────────

ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;

ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN ('task_assigned', 'mention', 'task_overdue', 'comment'));

-- ─── 2. Trigger : commentaire sur une tâche assignée ──────────────

CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (v_org, v_assignee, NEW.author_id, 'comment', NEW.task_id);
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_comment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_task_comment() FROM anon;
-- `authenticated` explicitement : REVOKE FROM PUBLIC ne retire pas le GRANT
-- par défaut de Supabase (leçon de la mig. 094b).
REVOKE EXECUTE ON FUNCTION public.notify_task_comment() FROM authenticated;

DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.team_task_comments;

CREATE TRIGGER trg_notify_task_comment
  AFTER INSERT ON public.team_task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_comment();

COMMENT ON FUNCTION public.notify_task_comment() IS
  'Notifie chaque assigné (hors auteur, hors déjà notifié par mention) qu''un commentaire a été posté sur sa tâche (mig. 110).';
