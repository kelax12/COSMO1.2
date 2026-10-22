-- ═══════════════════════════════════════════════════════════════════
-- Migration 133 — L'occurrence récurrente suivante prend un INSTANT
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Revue du 2026-09-02, risque R-01. `tasks.deadline` est un `timestamptz`,
-- mais ce que la personne saisit est un JOUR. Quatre chemins d'écriture
-- produisaient quatre valeurs différentes pour le même jour choisi ; trois
-- vivaient côté client et sont refermés par `src/lib/deadline.ts`.
--
-- Le quatrième est ICI. `p_next_deadline` est typé `DATE`, et la ligne
--
--     p_next_deadline::timestamptz
--
-- cast une date nue avec le fuseau du SERVEUR, c'est-à-dire UTC. L'occurrence
-- générée atterrit donc toujours à minuit UTC, quel que soit le fuseau de la
-- personne. Pour tout décalage négatif (Antilles, Guyane, continent
-- américain), elle se relit LA VEILLE : la tâche récurrente réapparaissait
-- déjà en retard, chaque fois qu'on validait la précédente.
--
-- Mesuré avant correctif : 467 des 601 échéances de la base portaient
-- exactement 00:00:00 UTC.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
-- Elle change UNIQUEMENT le type du paramètre : `DATE` → `TIMESTAMPTZ`. Le
-- client envoie désormais l'instant de minuit dans SON fuseau
-- (`deadlineFromDayKey`), et le serveur le stocke tel quel, sans plus rien
-- interpréter. C'est la même règle que partout ailleurs dans ce dépôt : le
-- serveur ne juge jamais « quel jour on est » à la place du client (mig. 119,
-- 121, 122).
--
-- Le corps de la fonction est repris À L'IDENTIQUE. Aucune autre ligne ne
-- change : ni l'idempotence (`ux_tasks_recurrence_parent`), ni la garde de
-- dé-validation, ni le fait que les champs collaboratifs ne se propagent pas.
--
-- ── ORDRE DE DÉPLOIEMENT : INDIFFÉRENT ─────────────────────────────
--
-- Les deux ordres sont sûrs, et c'est délibéré :
--   - migration appliquée, ancien front : il envoie 'YYYY-MM-DD', que Postgres
--     cast en timestamptz à minuit UTC. Comportement ACTUEL, inchangé.
--   - front déployé, migration non appliquée : il envoie un ISO complet, que
--     Postgres tronque au jour pour le paramètre `DATE`. Comportement ACTUEL
--     également.
-- Aucune fenêtre de casse, donc aucune coordination nécessaire.
--
-- ⚠️ `DROP` puis `CREATE` et non `CREATE OR REPLACE` : Postgres identifie une
-- fonction par sa signature COMPLÈTE, donc remplacer le type d'un paramètre
-- créerait une SECONDE surcharge au lieu de remplacer la première. Deux
-- surcharges laisseraient PostgREST choisir, et il choisirait mal.
--
-- 🔴 Les lignes ÉCRITES AVANT ce correctif ne sont pas migrées, volontairement.
-- Relues par `deadlineDayKey`, elles rendent exactement ce qu'elles rendaient
-- avant : justes en métropole, décalées ailleurs. Aucune régression. Et
-- surtout, aucune migration de données ne pourrait faire mieux : corriger une
-- ligne demande de connaître le fuseau de son auteur au moment de la saisie,
-- que la base n'a jamais enregistré.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.toggle_task_complete_v2(UUID, DATE);

CREATE OR REPLACE FUNCTION public.toggle_task_complete_v2(
  p_task_id       UUID,
  p_next_deadline TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row   public.tasks;
  v_child public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Bascule atomique (pas de read-modify-write, donc pas de course entre
  --    deux onglets).
  UPDATE public.tasks
  SET
    completed = NOT COALESCE(completed, false),
    completed_at = CASE
      WHEN NOT COALESCE(completed, false) THEN NOW()
      ELSE NULL
    END
  WHERE id = p_task_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- 2. Tâche VALIDÉE et récurrente → générer l'occurrence suivante.
  IF v_row.completed
     AND COALESCE(v_row.recurrence, 'none') <> 'none'
     AND p_next_deadline IS NOT NULL
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
      -- Plus aucun cast : l'instant arrive déjà calé sur le fuseau du client.
      p_next_deadline,
      v_row.estimated_time,
      v_row.bookmarked,
      false,
      -- Sous-tâches reportées mais DÉCOCHÉES (parité avec buildNextOccurrence).
      COALESCE((
        SELECT jsonb_agg(jsonb_set(elem, '{completed}', 'false'::jsonb))
        FROM jsonb_array_elements(COALESCE(v_row.subtasks, '[]'::jsonb)) AS elem
      ), '[]'::jsonb),
      v_row.kr_id,
      v_row.recurrence,
      v_row.id
    )
    -- Le cœur de l'idempotence : une 2ᵉ validation du même parent ne crée rien.
    -- Les champs collaboratifs (is_collaborative, pending_invites,
    -- collaborator_validations) sont volontairement OMIS : le partage ne se
    -- propage pas automatiquement à l'occurrence suivante.
    ON CONFLICT (recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL
    DO NOTHING
    RETURNING * INTO v_child;

  -- 3. Tâche DÉ-VALIDÉE → retirer l'occurrence générée, pour revenir
  --    exactement à l'état d'avant.
  --
  --    Garde : on ne supprime QUE si l'enfant est intact — non complété et
  --    jamais modifié. Si l'utilisateur a déjà retravaillé cette occurrence,
  --    elle lui appartient : on la laisse et on la détache du parent.
  --    Tolérance d'1 s sur updated_at (jitter d'horloge / trigger mig. 053).
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
$$;

REVOKE ALL ON FUNCTION public.toggle_task_complete_v2(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_task_complete_v2(UUID, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_task_complete_v2(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.toggle_task_complete_v2(UUID, TIMESTAMPTZ) IS
  'Bascule la complétion ET génère/retire l''occurrence récurrente suivante '
  'dans la MÊME transaction. Idempotent via ux_tasks_recurrence_parent. '
  'p_next_deadline est l''INSTANT de minuit calculé par le client dans SON '
  'fuseau (src/lib/deadline.ts). Le serveur ne juge jamais quel jour on est.';
