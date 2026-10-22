-- ═══════════════════════════════════════════════════════════════════
-- 096 — Automatisation serveur : rappel d'échéance dépassée (item UX #30)
--
-- ── PÉRIMÈTRE : CE QUE CETTE MIGRATION EST, ET N'EST PAS ───────────
--
-- Ce n'est PAS un moteur de règles déclaratives (« quand X → faire Y »
-- configurable par l'utilisateur). C'est la PREMIÈRE automatisation concrète,
-- et surtout l'infrastructure qui la fait tourner : une tâche planifiée qui
-- s'exécute sans qu'aucun navigateur ne soit ouvert.
--
-- C'est la propriété qui manquait. Tout le reste du produit ne bouge que
-- lorsqu'un utilisateur clique ; « prévenir que quelque chose est en retard »
-- est par nature un événement que personne ne déclenche.
--
-- Un moteur de règles configurable viendra s'appuyer sur ce même socle
-- (pg_cron + fonction SECURITY DEFINER + table de notifications).
--
-- ── IDEMPOTENCE ────────────────────────────────────────────────────
--
-- Le travail tourne tous les jours. Sans garde, une tâche en retard depuis
-- trois semaines produirait 21 notifications identiques. L'index unique
-- `ux_org_notifications_daily_overdue` fait de « une notification de retard par
-- tâche, par personne, par jour » une contrainte de la BASE et non une
-- politesse du code appelant : un second passage le même jour ne peut pas
-- insérer de doublon, quelle que soit la raison de ce second passage.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Nouveau type de notification ──────────────────────────────

ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;

ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN ('task_assigned', 'mention', 'task_overdue'));

-- ─── 2. Garde d'idempotence ───────────────────────────────────────

-- Un seul rappel de retard par (tâche, destinataire, jour). L'index est
-- PARTIEL : il ne porte que les lignes 'task_overdue', donc il n'impose
-- aucune contrainte aux assignations et mentions, qui peuvent légitimement se
-- répéter le même jour.
--
-- ⚠️ `created_at::date` seul est REFUSÉ par Postgres : la conversion
-- timestamptz → date dépend du `TimeZone` de la session, elle n'est donc pas
-- IMMUTABLE et ne peut pas entrer dans un index. `AT TIME ZONE 'UTC'` fixe le
-- fuseau, ce qui rend l'expression déterministe.
--
-- Effet de bord assumé : la « journée » de l'idempotence est une journée UTC,
-- pas la journée locale de l'utilisateur. Comme le travail tourne à 07:00 UTC,
-- les deux coïncident pour l'Europe ; et un rappel dédoublé au changement de
-- date serait de toute façon moins grave qu'un index non déterministe.
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_notifications_daily_overdue
  ON public.org_notifications (task_id, user_id, ((created_at AT TIME ZONE 'UTC')::date))
  WHERE kind = 'task_overdue';

-- ─── 3. Le travail ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.run_overdue_reminders()
RETURNS integer
LANGUAGE plpgsql
-- SECURITY DEFINER : la fonction tourne SANS utilisateur connecté (pg_cron
-- n'a pas d'`auth.uid()`). Elle ne lit aucun paramètre d'appelant et n'écrit
-- que dans `org_notifications` — sa surface est entièrement fermée.
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
  SELECT
    t.org_id,
    assignee,
    -- Pas d'acteur : personne n'a « fait » ce rappel, c'est le temps qui passe.
    -- Afficher un auteur humain serait un mensonge.
    NULL,
    'task_overdue',
    t.id
  FROM public.team_tasks t
  CROSS JOIN LATERAL unnest(COALESCE(t.assignee_ids, ARRAY[]::uuid[])) AS assignee
  WHERE t.completed = false
    AND t.deadline IS NOT NULL
    -- Strictement antérieure à aujourd'hui : le jour même n'est pas un retard.
    AND t.deadline < CURRENT_DATE
  -- Le conflit est le cas NORMAL, pas une erreur : il se produit à chaque
  -- exécution suivante du même jour.
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.run_overdue_reminders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_overdue_reminders() FROM anon;
-- `authenticated` explicitement (leçon 094b) : REVOKE FROM PUBLIC ne retire
-- pas le GRANT par défaut de Supabase, et cette fonction ne doit être
-- appelable que par l'ordonnanceur.
REVOKE EXECUTE ON FUNCTION public.run_overdue_reminders() FROM authenticated;

COMMENT ON FUNCTION public.run_overdue_reminders() IS
  'Automatisation (mig. 096) : cree un rappel par tache en retard et par assigne, au plus une fois par jour (index unique partiel). Appelee par pg_cron, jamais par le client.';

-- ─── 4. Ordonnancement ────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 07:00 UTC : le rappel doit être là avant la journée de travail européenne,
-- sans réveiller la base en pleine nuit d'usage.
--
-- `unschedule` d'abord : `schedule` sur un nom existant échoue, ce qui rendrait
-- la migration non rejouable.
SELECT cron.unschedule('cosmo-overdue-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cosmo-overdue-reminders');

SELECT cron.schedule(
  'cosmo-overdue-reminders',
  '0 7 * * *',
  $cron$SELECT public.run_overdue_reminders();$cron$
);
