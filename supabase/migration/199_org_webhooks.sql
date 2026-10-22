-- ═══════════════════════════════════════════════════════════════════
-- 199 · Webhooks d'organisation (Slack ou JSON signé)
--       (audit du mode Entreprise, 2026-09-24, étape 6 : « intégrations,
--       pas de webhook »)
--
-- ⚠️ ÉCRITE LE 2026-09-26, NON APPLIQUÉE. Ordre : APRÈS 198.
-- ⚠️ Rien ne part tant que l'Edge Function `org-webhook-dispatch` n'est pas
-- DÉPLOYÉE et que `.github/workflows/org-webhook-dispatch.yml` ne l'appelle
-- pas (même mécanisme que `org-digest` : pg_net n'est pas installé).
--
-- ── MODÈLE ─────────────────────────────────────────────────────────
--
--   · `org_webhooks` : une URL HTTPS, un format (`slack` : un message lisible
--     posté sur un « Incoming Webhook » ; `json` : un corps JSON signé en
--     HMAC-SHA256 dans l'en-tête `X-Cosmo-Signature`), les événements choisis.
--     10 par organisation. ADMINS SEULEMENT, en lecture comme en écriture :
--     le secret de signature et l'URL (qui vaut jeton chez Slack) ne sortent
--     jamais vers un non-admin.
--   · `org_webhook_deliveries` : la FILE. Une ligne par événement et par
--     webhook, écrite par `enqueue_team_task_webhook` (DEFINER), vidée par
--     l'Edge Function (service_role). Aucune policy : le client ne la lit ni
--     ne l'écrit. Purge à 7 jours (pg_cron).
--
-- ── ÉVÉNEMENTS ─────────────────────────────────────────────────────
--
--   `task.created`, `task.status_changed`, `task.completed` sur les tâches
--   d'équipe. Le trigger AFTER (INVOKER) appelle la fonction d'enfilement,
--   qui ne fait RIEN sans webhook actif pour cet événement : le coût d'une
--   organisation sans intégration est une lecture d'index vide.
--
-- ── DONNÉES QUI SORTENT ────────────────────────────────────────────
--
--   Nom, statut, priorité, échéance de la tâche, nom du projet, lien vers
--   l'application. JAMAIS d'adresse e-mail, de description, de commentaire,
--   ni d'identifiant de personne. Un admin qui branche un webhook décide
--   d'une sortie de données vers un tiers : l'écran le dit, et c'est un
--   destinataire à inscrire au registre (docs/RGPD-REGISTRE.md, T4).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_webhooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  url              TEXT NOT NULL,
  format           TEXT NOT NULL DEFAULT 'json',
  events           TEXT[] NOT NULL DEFAULT '{task.created,task.completed}',
  secret           TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  enabled          BOOLEAN NOT NULL DEFAULT true,
  last_status      INTEGER,
  last_delivery_at TIMESTAMPTZ,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_webhooks_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- HTTPS seulement, jamais une adresse locale ou privée écrite en clair.
  CONSTRAINT org_webhooks_url CHECK (
    char_length(url) <= 500
    AND url ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$'
    AND url !~* '^https://(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)'
  ),
  CONSTRAINT org_webhooks_format CHECK (format IN ('json', 'slack')),
  CONSTRAINT org_webhooks_events CHECK (
    cardinality(events) BETWEEN 1 AND 3
    AND events <@ '{task.created,task.status_changed,task.completed}'::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_org_webhooks_org ON public.org_webhooks (org_id) WHERE enabled;

CREATE OR REPLACE FUNCTION public.org_webhook_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.secret IS DISTINCT FROM OLD.secret THEN
      RAISE EXCEPTION 'org_webhooks: organization and secret are immutable';
    END IF;
    -- Le suivi d'envoi ne s'écrit que par l'Edge Function (service_role).
    IF auth.uid() IS NOT NULL THEN
      NEW.last_status := OLD.last_status;
      NEW.last_delivery_at := OLD.last_delivery_at;
      NEW.failure_count := CASE WHEN NEW.enabled AND NOT OLD.enabled THEN 0 ELSE OLD.failure_count END;
    END IF;
  ELSE
    NEW.created_by := auth.uid();
    NEW.last_status := NULL;
    NEW.last_delivery_at := NULL;
    NEW.failure_count := 0;
    IF (SELECT count(*) FROM public.org_webhooks w WHERE w.org_id = NEW.org_id) >= 10 THEN
      RAISE EXCEPTION 'webhooks_limit' USING ERRCODE = '54000';
    END IF;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.events := ARRAY(SELECT DISTINCT e FROM unnest(NEW.events) e ORDER BY e);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_webhook_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_webhook_before_write ON public.org_webhooks;
CREATE TRIGGER trg_org_webhook_before_write
  BEFORE INSERT OR UPDATE ON public.org_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.org_webhook_before_write();

ALTER TABLE public.org_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_webhooks_select" ON public.org_webhooks;
CREATE POLICY "org_webhooks_select" ON public.org_webhooks FOR SELECT
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_webhooks_insert" ON public.org_webhooks;
CREATE POLICY "org_webhooks_insert" ON public.org_webhooks FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_webhooks_update" ON public.org_webhooks;
CREATE POLICY "org_webhooks_update" ON public.org_webhooks FOR UPDATE
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_webhooks_delete" ON public.org_webhooks;
CREATE POLICY "org_webhooks_delete" ON public.org_webhooks FOR DELETE
  USING (public.is_org_admin(org_id));

-- ── File d'envoi ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id   UUID NOT NULL REFERENCES public.org_webhooks(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  payload      JSONB NOT NULL,
  attempts     SMALLINT NOT NULL DEFAULT 0,
  status_code  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  CONSTRAINT org_webhook_deliveries_payload CHECK (octet_length(payload::text) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_org_webhook_deliveries_pending
  ON public.org_webhook_deliveries (created_at) WHERE delivered_at IS NULL AND attempts < 5;

ALTER TABLE public.org_webhook_deliveries ENABLE ROW LEVEL SECURITY;
-- Aucune policy : ni lecture ni écriture depuis le client.

-- Enfilement. DEFINER parce qu'il écrit une table sans policy ; il ne rend
-- rien et ne lève rien (pas d'oracle), et n'enfile que pour une tâche que
-- l'appelant voit déjà.
CREATE OR REPLACE FUNCTION public.enqueue_team_task_webhook(p_task uuid, p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_payload jsonb;
  v_org     uuid;
BEGIN
  IF p_event NOT IN ('task.created', 'task.status_changed', 'task.completed') THEN
    RETURN;
  END IF;
  SELECT t.org_id INTO v_org FROM public.team_tasks t WHERE t.id = p_task;
  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.org_webhooks w WHERE w.org_id = v_org AND w.enabled AND p_event = ANY (w.events)
  ) THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_access_team_task(p_task) THEN
    RETURN;
  END IF;

  SELECT jsonb_build_object(
           'event', p_event,
           'occurred_at', now(),
           'organization', o.name,
           'task', jsonb_build_object(
             'id', t.id, 'name', t.name, 'status', t.status, 'priority', t.priority,
             'deadline', t.deadline, 'project', p.name
           )
         )
    INTO v_payload
    FROM public.team_tasks t
    JOIN public.team_projects p ON p.id = t.project_id
    JOIN public.organizations o ON o.id = t.org_id
   WHERE t.id = p_task;

  INSERT INTO public.org_webhook_deliveries (webhook_id, org_id, event, payload)
  SELECT w.id, w.org_id, p_event, v_payload
    FROM public.org_webhooks w
   WHERE w.org_id = v_org AND w.enabled AND p_event = ANY (w.events);
END;
$function$;

REVOKE ALL ON FUNCTION public.enqueue_team_task_webhook(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_team_task_webhook(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.team_task_webhook_events()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_team_task_webhook(NEW.id, 'task.created');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.enqueue_team_task_webhook(NEW.id, 'task.status_changed');
    IF NEW.status = 'done' THEN
      PERFORM public.enqueue_team_task_webhook(NEW.id, 'task.completed');
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_task_webhook_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_task_webhook_events ON public.team_tasks;
CREATE TRIGGER trg_team_task_webhook_events
  AFTER INSERT OR UPDATE OF status ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.team_task_webhook_events();

-- Lot à envoyer, pour l'Edge Function (service_role seulement).
CREATE OR REPLACE FUNCTION public.org_webhook_deliveries_due(p_limit integer DEFAULT 100)
RETURNS TABLE (delivery_id uuid, webhook_id uuid, url text, format text, secret text, event text, payload jsonb, attempts smallint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT d.id, w.id, w.url, w.format, w.secret, d.event, d.payload, d.attempts
    FROM public.org_webhook_deliveries d
    JOIN public.org_webhooks w ON w.id = d.webhook_id
   WHERE d.delivered_at IS NULL AND d.attempts < 5 AND w.enabled
   ORDER BY d.created_at
   LIMIT LEAST(GREATEST(p_limit, 1), 500);
$function$;

REVOKE ALL ON FUNCTION public.org_webhook_deliveries_due(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_webhook_deliveries_due(integer) TO service_role;

-- Purge : 7 jours suffisent à diagnostiquer une intégration.
SELECT cron.schedule('cosmo-purge-webhook-deliveries', '35 4 * * *',
  $cron$DELETE FROM public.org_webhook_deliveries WHERE created_at < now() - interval '7 days';$cron$);

COMMIT;
