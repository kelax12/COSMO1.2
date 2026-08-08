-- ═══════════════════════════════════════════════════════════════════
-- 095 — Notifications d'entreprise (item UX #17)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- Deux mécanismes existent aujourd'hui, aucun n'est un système de notification :
--
--   1. `useOrgNotificationCount` DÉRIVE un compteur des tâches + demandes
--      d'adhésion, borné par un `lastSeen` en localStorage. Donc : un seul
--      chiffre, pas de détail, non persistant entre appareils, et remis à zéro
--      dès qu'on ouvre la page sur un autre poste.
--   2. `useMessages` lit un tableau en localStorage que RIEN n'alimente côté
--      serveur.
--
-- Conséquence : une mention dans un commentaire ne prévient personne. La boucle
-- de collaboration est ouverte — on écrit à quelqu'un qui ne le saura jamais.
--
-- ── POURQUOI DES TRIGGERS ──────────────────────────────────────────
--
-- Même raisonnement que le journal de la mig. 094 : une notification écrite par
-- le client manque toutes les écritures hors app (CLI, RPC, automatisations à
-- venir) et s'oublie au premier chemin de code ajouté. Le trigger ne peut pas
-- être contourné.
--
-- ── CE QU'ON NE FAIT PAS ───────────────────────────────────────────
--
-- Pas de notification pour les échéances dépassées : cela exigerait un travail
-- périodique (cron), donc une infrastructure d'ordonnancement qui appartient à
-- la mig. 096 (automatisations). On s'en tient ici aux événements qui ont un
-- déclencheur naturel : une assignation, une mention.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Destinataire.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Auteur de l'action — NULL si le compte a été supprimé.
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('task_assigned', 'mention')),
  task_id UUID REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  -- NULL = non lue. Une date plutôt qu'un booléen : « quand » se révèle
  -- toujours utile, et un booléen ne se rétro-remplit pas.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L'accès est toujours « MES notifications, les plus récentes d'abord ».
CREATE INDEX IF NOT EXISTS idx_org_notifications_user
  ON public.org_notifications (user_id, created_at DESC);

-- Compteur de non-lues : index partiel, il ne porte que les lignes concernées
-- et reste minuscule même quand l'historique grossit.
CREATE INDEX IF NOT EXISTS idx_org_notifications_unread
  ON public.org_notifications (user_id)
  WHERE read_at IS NULL;

-- FK indexées (leçon de la 094c : ces colonnes sont cibles de CASCADE).
CREATE INDEX IF NOT EXISTS idx_org_notifications_org ON public.org_notifications (org_id);
CREATE INDEX IF NOT EXISTS idx_org_notifications_actor ON public.org_notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_org_notifications_task ON public.org_notifications (task_id);

ALTER TABLE public.org_notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : les siennes uniquement. `(select auth.uid())` — convention mig. 043.
DROP POLICY IF EXISTS "org_notifications_select" ON public.org_notifications;
CREATE POLICY "org_notifications_select"
  ON public.org_notifications FOR SELECT
  USING (user_id = (select auth.uid()));

-- Marquer comme lue. WITH CHECK identique : sans lui, on pourrait réattribuer
-- sa propre notification à quelqu'un d'autre (faille N1).
DROP POLICY IF EXISTS "org_notifications_update" ON public.org_notifications;
CREATE POLICY "org_notifications_update"
  ON public.org_notifications FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "org_notifications_delete" ON public.org_notifications;
CREATE POLICY "org_notifications_delete"
  ON public.org_notifications FOR DELETE
  USING (user_id = (select auth.uid()));

-- PAS de policy INSERT : seuls les triggers écrivent.

-- ─── Trigger : assignation d'une tâche ────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_new_assignee UUID;
  v_added UUID[];
BEGIN
  -- Seuls les assignés AJOUTÉS sont notifiés : re-notifier tout le monde à
  -- chaque édition de la tâche transformerait la boîte en bruit.
  --
  -- Le tableau est calculé dans une variable AVANT la boucle : `FOREACH ... IN
  -- ARRAY (SELECT ...)` n'est pas une expression de tableau valide en plpgsql.
  SELECT COALESCE(array_agg(x), ARRAY[]::uuid[])
    INTO v_added
    FROM unnest(COALESCE(NEW.assignee_ids, ARRAY[]::uuid[])) AS x
   WHERE x <> ALL (COALESCE(OLD.assignee_ids, ARRAY[]::uuid[]));

  IF array_length(v_added, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_new_assignee IN ARRAY v_added
  LOOP
    -- S'auto-assigner ne notifie pas : on sait ce qu'on vient d'écrire.
    CONTINUE WHEN v_new_assignee = v_actor;
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (NEW.org_id, v_new_assignee, v_actor, 'task_assigned', NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignment() FROM anon;
-- `authenticated` explicitement : REVOKE FROM PUBLIC ne retire pas le GRANT
-- par défaut de Supabase (leçon de la mig. 094b).
REVOKE EXECUTE ON FUNCTION public.notify_task_assignment() FROM authenticated;

DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.team_tasks;

CREATE TRIGGER trg_notify_task_assignment
  AFTER UPDATE OF assignee_ids ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();

-- ─── Trigger : mention dans un commentaire ────────────────────────

CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mentioned UUID;
  v_org UUID;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.org_id INTO v_org FROM public.team_tasks t WHERE t.id = NEW.task_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_mentioned IN ARRAY NEW.mentions
  LOOP
    -- Se mentionner soi-même ne notifie pas.
    CONTINUE WHEN v_mentioned = NEW.author_id;
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (v_org, v_mentioned, NEW.author_id, 'mention', NEW.task_id);
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_comment_mention() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_comment_mention() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_comment_mention() FROM authenticated;

DROP TRIGGER IF EXISTS trg_notify_comment_mention ON public.team_task_comments;

CREATE TRIGGER trg_notify_comment_mention
  AFTER INSERT ON public.team_task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_mention();

COMMENT ON TABLE public.org_notifications IS
  'Notifications d''entreprise (mig. 095). Écrites UNIQUEMENT par trigger — aucune policy INSERT. Le destinataire peut lire, marquer lue et supprimer les siennes.';
