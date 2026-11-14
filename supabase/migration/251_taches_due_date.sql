-- ═══════════════════════════════════════════════════════════════════
-- 251 · `tasks.due_date date` : l'échéance d'une tâche perso est un JOUR (DAT-01)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- La personne saisit un jour, la base gardait un instant (`deadline
-- timestamptz`, mig. 001). Trois écritures divergentes ont coexisté : relu au
-- catalogue le 2026-11-13, 468 des 690 échéances portent 00:00 UTC, donc la
-- veille pour qui vit à l'ouest de Greenwich. `team_tasks.deadline` est déjà
-- une `date` (mig. 062).
--
-- ── EXPAND / CONTRACT ──────────────────────────────────────────────
--
-- Vercel déploie le front avant qu'Axel applique ce fichier. Le front lit et
-- écrit la forme que la base porte (`src/modules/tasks/deadline-columns.ts`) :
--   · 251 (ce fichier) : ajoute `due_date`, la remplit, tient les deux
--     colonnes d'accord par trigger (un onglet resté sur l'ancien bundle
--     n'écrit que `deadline`) ;
--   · 253 : retire `deadline`, À APPLIQUER APRÈS vérification.
--
-- ── CONVERSION : `echeance_jour(instant)` ──────────────────────────
--
-- La base ne connaît aucun fuseau par compte (la préférence vit dans le
-- localStorage du navigateur ; seul `org_settings.timezone` existe, pour les
-- organisations). On lit donc le jour dans la valeur elle-même :
--   · instant au quart d'heure près : c'est un MINUIT écrit dans le fuseau de
--     son auteur (00:00 UTC, 23:00 UTC à Paris, 05:00 UTC à Montréal, 15:00
--     UTC à Tokyo, 18:30 UTC en Inde). Jour = celui de l'instant + 13 h, lu
--     en UTC : exact pour tout fuseau de UTC-10 à UTC+13 ;
--   · tout autre instant (anciens reports, imports, à la seconde près) :
--     jour vécu à Europe/Paris, celui que la métropole voyait déjà.
-- Miroir exact côté front : `dayKeyFromStoredDeadline` (src/lib/deadline.ts).
-- Sens inverse (le trigger, quand seul `due_date` est écrit) : minuit à Paris.
--
-- ── LECTEURS SERVEUR ───────────────────────────────────────────────
--
--   · `toggle_task_complete_v2` : corps relu au catalogue le 2026-11-13,
--     identique à la mig. 215. L'occurrence suivante est écrite en `due_date`
--     (jour de `p_next_deadline`), signature inchangée : le front de chaque
--     état l'appelle de la même façon, et la 253 n'a pas à la toucher.
--   · `get_my_tasks`, `get_pending_shared_tasks` : `SELECT t.*`, rien à faire.
--   · Aucune policy, vue, cron ni Edge Function ne lit `tasks.deadline`.
--
-- Rejouable. Les triggers utilisateur de `tasks` sont suspendus le temps du
-- remplissage : `updated_at` ne bouge pas (la récurrence s'y fie, mig. 086).
-- Preuve : `supabase/proofs/251.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.echeance_jour(p_instant timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_instant IS NULL THEN NULL
    WHEN date_trunc('minute', p_instant) = p_instant
         AND extract(minute FROM (p_instant AT TIME ZONE 'UTC'))::int % 15 = 0
      THEN ((p_instant AT TIME ZONE 'UTC') + interval '13 hours')::date
    ELSE (p_instant AT TIME ZONE 'Europe/Paris')::date
  END
$$;

REVOKE ALL ON FUNCTION public.echeance_jour(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.echeance_jour(timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.echeance_jour(timestamptz) IS
  'Jour d''une ancienne échéance timestamptz (mig. 251) : minuit au quart d''heure près → jour de l''instant + 13 h en UTC, sinon jour à Europe/Paris. Miroir : dayKeyFromStoredDeadline (src/lib/deadline.ts).';

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.tasks DISABLE TRIGGER USER;
UPDATE public.tasks
   SET due_date = public.echeance_jour(deadline)
 WHERE deadline IS NOT NULL AND due_date IS NULL;
ALTER TABLE public.tasks ENABLE TRIGGER USER;

CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks USING btree (due_date);

-- Bascule : une écriture qui ne porte qu'une des deux colonnes remplit l'autre.
-- Les deux écrites ensemble (le front) : la base les prend telles quelles.
CREATE OR REPLACE FUNCTION public.tasks_sync_echeance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.due_date IS NULL AND NEW.deadline IS NOT NULL THEN
      NEW.due_date := public.echeance_jour(NEW.deadline);
    ELSIF NEW.due_date IS NOT NULL AND NEW.deadline IS NULL THEN
      NEW.deadline := NEW.due_date::timestamp AT TIME ZONE 'Europe/Paris';
    END IF;
  ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date
        AND NEW.deadline IS NOT DISTINCT FROM OLD.deadline THEN
    NEW.deadline := NEW.due_date::timestamp AT TIME ZONE 'Europe/Paris';
  ELSIF NEW.deadline IS DISTINCT FROM OLD.deadline
        AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date THEN
    NEW.due_date := public.echeance_jour(NEW.deadline);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_sync_echeance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tasks_sync_echeance ON public.tasks;
CREATE TRIGGER trg_tasks_sync_echeance
  BEFORE INSERT OR UPDATE OF deadline, due_date ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_echeance();

CREATE OR REPLACE FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row   public.tasks;
  v_child public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 215 : plus de filtre `user_id = auth.uid()` ; la RLS UPDATE décide
  -- (propriétaire, ou ami « editor » ayant accepté).
  UPDATE public.tasks
  SET
    completed = NOT COALESCE(completed, false),
    completed_at = CASE
      WHEN NOT COALESCE(completed, false) THEN NOW()
      ELSE NULL
    END
  WHERE id = p_task_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_row.completed
     AND COALESCE(v_row.recurrence, 'none') <> 'none'
     AND p_next_deadline IS NOT NULL
     AND v_row.user_id = auth.uid()  -- 215 : l'occurrence suivante reste au propriétaire
  THEN
    INSERT INTO public.tasks (
      user_id, name, description, priority, category, due_date,
      estimated_time, bookmarked, completed, subtasks, kr_id, recurrence,
      recurrence_parent_id
    )
    VALUES (
      v_row.user_id,
      v_row.name,
      v_row.description,
      v_row.priority,
      v_row.category,
      public.echeance_jour(p_next_deadline),  -- 251 : le jour, plus l'instant
      v_row.estimated_time,
      v_row.bookmarked,
      false,
      COALESCE((
        SELECT jsonb_agg(jsonb_set(elem, '{completed}', 'false'::jsonb))
        FROM jsonb_array_elements(COALESCE(v_row.subtasks, '[]'::jsonb)) AS elem
      ), '[]'::jsonb),
      v_row.kr_id,
      v_row.recurrence,
      v_row.id
    )
    ON CONFLICT (recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL
    DO NOTHING
    RETURNING * INTO v_child;

  ELSIF NOT v_row.completed THEN
    DELETE FROM public.tasks c
    WHERE c.recurrence_parent_id = v_row.id
      AND c.user_id = auth.uid()
      AND c.completed = false
      AND c.updated_at <= c.created_at + interval '1 second';

    UPDATE public.tasks c
    SET recurrence_parent_id = NULL
    WHERE c.recurrence_parent_id = v_row.id
      AND c.user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'task',    to_jsonb(v_row),
    'spawned', CASE WHEN v_child.id IS NULL THEN NULL ELSE to_jsonb(v_child) END
  );
END;
$function$;

-- Contrôle final : aucune ligne avec une seule des deux colonnes renseignée.
DO $controle$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.tasks WHERE (deadline IS NULL) <> (due_date IS NULL);
  IF n > 0 THEN
    RAISE EXCEPTION '251 : % tâche(s) avec une seule des deux colonnes d''échéance', n;
  END IF;
END
$controle$;

COMMENT ON COLUMN public.tasks.due_date IS
  'Échéance FACULTATIVE, un jour (mig. 251). NULL = aucune échéance. Remplace deadline (retirée par la mig. 253).';
COMMENT ON COLUMN public.tasks.deadline IS
  'ANCIENNE échéance (timestamptz), tenue d''accord avec due_date par trg_tasks_sync_echeance. Retirée par la mig. 253.';
