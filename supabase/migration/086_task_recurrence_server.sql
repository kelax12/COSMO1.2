-- ═══════════════════════════════════════════════════════════════════
-- 086 — Récurrence des tâches : génération côté serveur, atomique
-- Rapport : AUDIT-ARCHITECTURE-2026-08-07.md, point H1
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- La génération de l'occurrence suivante vivait dans le `onSuccess` d'une
-- mutation React Query (src/modules/tasks/hooks.ts) :
--
--   repository.create(nextInput)
--     .then((created) => { spawnedNextId = created.id; ... })
--     .catch(() => { /* best-effort */ });
--
-- Quatre défaillances réelles, toutes silencieuses :
--
--   1. Onglet fermé juste après la validation → l'occurrence suivante n'est
--      JAMAIS créée. La tâche hebdomadaire de l'utilisateur disparaît.
--   2. `create()` échoue (réseau, timeout 8 s, RLS) → idem, et le `.catch`
--      vide n'informe personne.
--   3. « Annuler » cliqué avant que `create()` résolve → `spawnedNextId` vaut
--      encore null → l'occurrence créée devient ORPHELINE (doublon permanent).
--   4. Décocher puis recocher → une DEUXIÈME occurrence est créée. Les
--      doublons s'accumulent.
--
-- ── LE CORRECTIF ───────────────────────────────────────────────────
--
-- Le basculement de complétion ET la génération de l'occurrence deviennent
-- UNE SEULE transaction serveur, rendue idempotente par une contrainte
-- d'unicité. Ce qui reste côté client : le CALCUL de la date suivante.
--
-- Pourquoi garder le calcul de date côté client : `nextOccurrenceDeadline()`
-- (src/modules/tasks/recurrence.ts) raisonne en date CALENDAIRE LOCALE de
-- l'utilisateur — convention explicite du projet (`toLocaleDateString('en-CA')`,
-- cf. docs timezone). Le serveur ne connaît pas ce fuseau. Le refaire en SQL
-- décalerait les échéances d'un jour pour une partie des utilisateurs, et
-- invaliderait une logique déjà couverte par des tests unitaires.
--
-- On déplace donc ce qui était réellement cassé — l'ATOMICITÉ et
-- l'IDEMPOTENCE — sans toucher à ce qui était correct.
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : appliquer AVANT le front. `toggle_task_complete`
-- (v1) est CONSERVÉE intacte, donc l'ancien client continue de fonctionner
-- pendant toute la fenêtre de déploiement (et après un rollback front).
-- ═══════════════════════════════════════════════════════════════════


-- ─── Filiation des occurrences ──────────────────────────────────────
--
-- `ON DELETE SET NULL` (et non CASCADE) : supprimer la tâche de juin ne doit
-- pas emporter celle de juillet, qui est une tâche à part entière.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID
  REFERENCES public.tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tasks.recurrence_parent_id IS
  'Occurrence dont cette tâche est issue (récurrence). Clé d''idempotence : '
  'l''index unique ux_tasks_recurrence_parent garantit AU PLUS UN enfant par '
  'parent, donc recocher deux fois ne duplique jamais.';

-- ─── LA garde d'idempotence ─────────────────────────────────────────
--
-- Index UNIQUE partiel : au plus un enfant par parent. C'est lui — et non du
-- code applicatif — qui rend l'opération rejouable sans effet de bord :
--   • double-clic sur la case          → 2ᵉ INSERT en conflit → ignoré
--   • décocher / recocher              → idem
--   • deux onglets, deux appareils     → idem
--   • rejeu réseau après timeout       → idem
--
-- Un index unique NULLS-friendly : les lignes sans parent (l'immense majorité)
-- sont exclues par le WHERE et ne se gênent pas entre elles.

CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_recurrence_parent
  ON public.tasks(recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- toggle_task_complete_v2 — bascule + récurrence, en une transaction
-- ═══════════════════════════════════════════════════════════════════
--
-- Retourne : { "task": <ligne parent>, "spawned": <ligne enfant | null> }
--
-- Pourquoi une v2 plutôt qu'une modification en place : `toggle_task_complete`
-- renvoie `SETOF tasks`. Changer son type de retour casserait tout client
-- encore en vol pendant le déploiement. Convention déjà utilisée par le projet
-- (`accept_friend_request_v2`). La v1 pourra être supprimée une fois le front
-- déployé et stabilisé.
--
-- SECURITY INVOKER (défaut) — volontaire : la RLS de `tasks` s'applique
-- normalement, et le `user_id = auth.uid()` explicite du UPDATE reste la garde
-- principale (seul le PROPRIÉTAIRE bascule la complétion, pas un collaborateur
-- éditeur — sémantique inchangée par rapport à la v1).

CREATE OR REPLACE FUNCTION public.toggle_task_complete_v2(
  p_task_id       UUID,
  p_next_deadline DATE DEFAULT NULL
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

  -- 1. Bascule atomique (identique à la v1 : pas de read-modify-write, donc
  --    pas de course entre deux onglets).
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
      p_next_deadline::timestamptz,
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
  --    exactement à l'état d'avant (c'est le « undo » que le client faisait
  --    de façon non fiable).
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

REVOKE ALL ON FUNCTION public.toggle_task_complete_v2(UUID, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_task_complete_v2(UUID, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_task_complete_v2(UUID, DATE) TO authenticated;

COMMENT ON FUNCTION public.toggle_task_complete_v2(UUID, DATE) IS
  'Bascule la complétion ET génère/retire l''occurrence récurrente suivante '
  'dans la MÊME transaction. Idempotent via ux_tasks_recurrence_parent. '
  'p_next_deadline est calculée par le client (date locale de l''utilisateur).';


-- ═══════════════════════════════════════════════════════════════════
-- Vérification post-application (à exécuter manuellement)
-- ═══════════════════════════════════════════════════════════════════
--
-- Sur une tâche récurrente t (hebdomadaire, propriétaire = session courante) :
--
--   SELECT toggle_task_complete_v2('<t>', CURRENT_DATE + 7);  -- spawned ≠ null
--   SELECT toggle_task_complete_v2('<t>', CURRENT_DATE + 7);  -- dé-validation
--   SELECT toggle_task_complete_v2('<t>', CURRENT_DATE + 7);  -- spawned ≠ null
--   SELECT count(*) FROM tasks WHERE recurrence_parent_id = '<t>';  -- = 1
--
-- La dernière ligne DOIT valoir 1 : c'est la non-régression du doublon.
