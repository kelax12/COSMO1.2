-- ═══════════════════════════════════════════════════════════════════
-- 207 · Webhooks d'organisation, deux correctifs AVANT le premier envoi réel
--       (2026-09-30)
--
--   1. Cible : un NOM DNS, jamais une adresse (A-6, SSRF).
--   2. Enfilement : par le trigger seulement, jamais en RPC directe (A-1).
--
-- ── 1 · CIBLE ──────────────────────────────────────────────────────
--
-- 🔴 La contrainte `org_webhooks_url` de la mig. 199 était une LISTE NOIRE
-- textuelle : `localhost|127.|10.|192.168.|169.254.|0.|[`. Elle laissait
-- passer `172.16.0.0/12`, `100.64.0.0/10`, et l'IPv4 écrite en entier ou en
-- hexadécimal (`https://2130706433/`, `https://0x7f000001/`), que le parseur
-- WHATWG de `fetch` normalise en `127.0.0.1`.
--
-- On passe à une LISTE BLANCHE de forme : un nom DNS dont le dernier label est
-- alphabétique. Aucune adresse littérale ne peut s'y écrire, quelle que soit
-- sa notation (une IPv4 finit par un chiffre, une IPv6 porte des crochets),
-- et les TLD internes ou réservés sont refusés.
--
-- ⚠️ Ce CHECK ne voit qu'un TEXTE. Un nom qui RÉSOUT vers une adresse privée
--    (`127.0.0.1.nip.io`, rebinding) le passe : c'est l'Edge Function
--    `org-webhook-dispatch` qui résout et refuse, avant chaque envoi
--    (`_shared/org-integrations.ts`, `addressesArePublic`). Les deux étages
--    ne se remplacent pas.
--
-- ── ORDRE DES GESTES ───────────────────────────────────────────────
--
-- 1. Les webhooks existants que la nouvelle forme refuse sont COUPÉS
--    (`enabled = false`), sous l'ancienne contrainte, qui l'accepte.
-- 2. La nouvelle contrainte est posée `NOT VALID` : elle s'applique à toute
--    écriture, y compris à la réactivation d'une ligne coupée, sans échouer
--    sur les lignes anciennes. Réactiver une URL refusée exige donc de la
--    corriger, et c'est voulu.
--
-- 🔴 À appliquer AVANT de redéployer `org-webhook-dispatch` en
--    `verify_jwt = false` (A-3) : c'est ce redéploiement qui rend l'envoi réel.
-- Écrite le 2026-09-30, NON appliquée.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.org_webhooks
   SET enabled = false
 WHERE enabled
   AND NOT (
     url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:[0-9]{1,5})?(/.*)?$'
     AND url !~* '^https://[^/:]*\.(localhost|local|internal|localdomain|lan|home|corp|intranet|private|arpa|test|invalid|example|onion)(:[0-9]{1,5})?(/.*)?$'
   );

ALTER TABLE public.org_webhooks
  DROP CONSTRAINT IF EXISTS org_webhooks_url;

ALTER TABLE public.org_webhooks
  ADD CONSTRAINT org_webhooks_url CHECK (
    char_length(url) <= 500
    AND url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:[0-9]{1,5})?(/.*)?$'
    AND url !~* '^https://[^/:]*\.(localhost|local|internal|localdomain|lan|home|corp|intranet|private|arpa|test|invalid|example|onion)(:[0-9]{1,5})?(/.*)?$'
  ) NOT VALID;

-- ── Enfilement : par le trigger SEULEMENT (A-1, relu le 2026-09-30) ──
--
-- 🔴 `enqueue_team_task_webhook` est `SECURITY DEFINER` et `EXECUTE` à
-- `authenticated` : il le faut, le trigger AFTER qui l'appelle est INVOKER
-- (une fonction de trigger n'est jamais DEFINER). Mais la fonction était
-- donc AUSSI appelable en RPC, par tout membre qui voit une tâche :
--   · forger un `task.completed` sur une tâche ouverte, ou un
--     `task.status_changed` sans changement, vers le Slack ou l'intégration
--     du client ;
--   · boucler, et remplir la file sans borne. La file est COMMUNE à toutes
--     les organisations (200 plus anciennes par passage) : une organisation
--     qui s'inonde retarde les webhooks de toutes les autres.
-- Appelée directement, `pg_trigger_depth()` vaut 0 ; depuis le trigger, au
-- moins 1. Le corps est celui de la mig. 199, précédé de cette seule garde.

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
  -- Hors trigger : rien. Pas d'erreur non plus (aucun oracle).
  IF pg_trigger_depth() = 0 THEN
    RETURN;
  END IF;
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

-- `CREATE OR REPLACE` conserve l'ACL ; reposée pour qu'elle se lise ici.
REVOKE ALL ON FUNCTION public.enqueue_team_task_webhook(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_team_task_webhook(uuid, text) TO authenticated;

COMMIT;

-- ── Vérification après application ─────────────────────────────────
--
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'org_webhooks_url';
--   → doit citer `[a-z]{2,63}` et `NOT VALID`.
-- Dans une transaction annulée, en admin d'une organisation :
--   INSERT … url = 'https://2130706433/x'        → 23514
--   INSERT … url = 'https://172.16.0.1/x'        → 23514
--   INSERT … url = 'https://intranet.corp/x'     → 23514
--   INSERT … url = 'https://hooks.slack.com/s/x' → accepté
--   SELECT public.enqueue_team_task_webhook(<tâche visible>, 'task.completed');
--     → aucune ligne de plus dans org_webhook_deliveries
--   UPDATE team_tasks SET status = 'done' WHERE id = <tâche d'une org à webhook>;
--     → une ligne `task.status_changed` ET une `task.completed` enfilées
