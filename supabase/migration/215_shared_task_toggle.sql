-- ═══════════════════════════════════════════════════════════════════
-- 215 · Un collaborateur « éditeur » peut enfin cocher une tâche partagée
--
-- ── LE DÉFAUT ──────────────────────────────────────────────────────
--
-- `toggle_task_complete_v2` (mig. 086, réécrite par la 133) filtrait
-- `WHERE id = p_task_id AND user_id = auth.uid()`. Seul le PROPRIÉTAIRE
-- trouvait la tâche : un ami « éditeur » qui cochait une tâche partagée
-- recevait « Task not found ». Reproduit en production le 2026-10-09, en
-- transaction annulée. Le défaut existait depuis la mig. 086 : la case à
-- cocher d'une tâche reçue n'a jamais fonctionné en production.
--
-- ── POURQUOI RETIRER LE FILTRE EST SÛR ────────────────────────────
--
-- La fonction est `SECURITY INVOKER` (relu au catalogue : prosecdef = false).
-- Son UPDATE passe donc par la RLS de l'appelant, `tasks_update_own_or_editor` :
-- propriétaire, OU ami « editor » ayant accepté le partage. Le filtre
-- `user_id = auth.uid()` ne protégeait rien que la policy ne protège déjà ;
-- il retirait seulement un droit qu'elle accorde. Un « viewer » ou un
-- inconnu ne voit toujours aucune ligne : « Task not found ».
--
-- ── CE QUI RESTE RÉSERVÉ AU PROPRIÉTAIRE ──────────────────────────
--
-- L'occurrence suivante d'une tâche récurrente. Elle naît au nom du
-- propriétaire (`user_id = v_row.user_id`), ce que la policy INSERT refuse à
-- un collaborateur : la tenter ferait échouer la bascule entière. Un
-- collaborateur qui coche une tâche récurrente la coche, sans générer la
-- suivante ; le propriétaire la générera en cochant lui-même. Même garde sur
-- le retrait de l'occurrence au décochage, inchangée.
--
-- Le corps est repris du catalogue (pg_get_functiondef, 2026-10-09), seules
-- les lignes commentées « 215 » changent. Droits inchangés : CREATE OR
-- REPLACE conserve les GRANT existants.
-- ═══════════════════════════════════════════════════════════════════

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
      user_id, name, description, priority, category, deadline,
      estimated_time, bookmarked, completed, subtasks, kr_id, recurrence,
      recurrence_parent_id
    )
    VALUES (
      v_row.user_id,
      v_row.name,
      v_row.description,
      v_row.priority,
      v_row.category,
      p_next_deadline,
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
