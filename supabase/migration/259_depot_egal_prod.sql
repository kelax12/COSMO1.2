-- ═══════════════════════════════════════════════════════════════════
-- 259 · Le dépôt rejoué et la production convergent (TST-06)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- `Schema prod` (scripts/schema-prod.mjs) compare chaque jour une base
-- vierge où `supabase/migration/` est rejoué à la production. Run du
-- 2026-11-15 : 109 écarts. 47 étaient du bruit (commentaires et mise en
-- page des corps de fonction, ordre des colonnes), normalisés dans le
-- comparateur ; 22 tiennent à la mig. 206, pas encore appliquée. Cette
-- migration règle le reste, objet par objet, dans le sens choisi pour
-- chacun. Après elle, les deux bases ont la même forme.
--
-- Relu au catalogue de production le 2026-11-15 (lecture seule) : aucune
-- valeur NULL dans les colonnes passées NOT NULL ci-dessous, aucun
-- `okrs.progress` hors de 0..100, les quatre fonctions de trigger citées
-- existent, aucune vue ne dépend de `okrs`.
--
-- ── A. LA PRODUCTION REJOINT LE DÉPÔT (effet réel en production) ───
--   · NOT NULL et défauts stricts des tables de base (tables créées au
--     Dashboard avant la mig. 001, jamais resserrées) ;
--   · `okrs_progress_check` ;
--   · colonnes `updated_at` (events, habits, lists, okrs) et leurs
--     triggers, `shared_tasks.created_at` ;
--   · six index de lecture (mig. 001 à 006) ;
--   · `trg_prevent_user_id_change` sur `subscriptions` (mig. 011) ;
--   · triggers de `friend_requests` aussi sur UPDATE (mig. 033) ;
--   · textes de commentaires (version du dépôt, sans tiret long).
--
-- ── B. LE DÉPÔT REJOINT LA PRODUCTION (sans effet en production) ───
--   · défauts de couleur et de durée tels que la production les sert ;
--   · `okrs.start_date` / `end_date` en timestamptz (21 objectifs sur 26
--     portent une heure : revenir à `date` les tronquerait) ;
--   · `tasks.updated_at` NOT NULL, un seul trigger de mise à jour
--     (`trg_tasks_updated_at`) ;
--   · noms d'index de `friend_requests`, index `idx_shared_tasks_friend` ;
--   · `friend_requests.receiver_id` en ON DELETE SET NULL (4 demandes y
--     ont déjà un destinataire supprimé) ;
--   · corps de `remove_friendship` (sans le prédicat doublé) et de
--     `toggle_habit_completion` (sans la variable inutilisée) tels qu'en
--     production ; `remove_friendship` passe en plus en `search_path = ''`
--     (SECURITY DEFINER, noms déjà qualifiés), des deux côtés.
--
-- ── HORS DE CETTE MIGRATION (décision d'Axel) ──────────────────────
--   · `events.end_after_start` : 3 événements de production finissent
--     avant de commencer ; la contrainte ne se pose qu'après correction ;
--   · `on_auth_user_created_seed_categories` (auth.users) : présent dans
--     le dépôt, absent de la production ; le poser change l'inscription.
--
-- Rejouable : chaque instruction est idempotente. Appliquée d'un bloc
-- (SQL editor ou `apply_migration`, une transaction). Une valeur NULL
-- inattendue arrête tout AVANT la première modification.
-- ═══════════════════════════════════════════════════════════════════


DO $garde$
DECLARE
  n bigint;
BEGIN
  SELECT
      (SELECT count(*) FROM public.categories WHERE user_id IS NULL)
    + (SELECT count(*) FROM public.events WHERE user_id IS NULL)
    + (SELECT count(*) FROM public.friends WHERE user_id IS NULL)
    + (SELECT count(*) FROM public.habits
        WHERE user_id IS NULL OR color IS NULL OR completions IS NULL OR estimated_time IS NULL OR icon IS NULL)
    + (SELECT count(*) FROM public.lists WHERE user_id IS NULL OR color IS NULL OR task_ids IS NULL)
    + (SELECT count(*) FROM public.okrs
        WHERE user_id IS NULL OR progress IS NULL OR completed IS NULL OR key_results IS NULL
           OR start_date IS NULL OR end_date IS NULL OR progress < 0 OR progress > 100)
    + (SELECT count(*) FROM public.shared_tasks WHERE task_id IS NULL OR friend_id IS NULL OR role IS NULL)
    + (SELECT count(*) FROM public.tasks
        WHERE user_id IS NULL OR estimated_time IS NULL OR bookmarked IS NULL OR completed IS NULL
           OR is_collaborative IS NULL OR updated_at IS NULL)
  INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'mig. 259 : % ligne(s) contredisent un NOT NULL ou un CHECK pose ici ; rien n''est modifie', n
      USING ERRCODE = '23502';
  END IF;
END
$garde$;

-- ── A.1 NOT NULL et défauts ────────────────────────────────────────
ALTER TABLE public.categories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.events     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.friends    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.habits
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN color SET NOT NULL,
  ALTER COLUMN completions SET NOT NULL,
  ALTER COLUMN estimated_time SET NOT NULL,
  ALTER COLUMN icon SET NOT NULL;

ALTER TABLE public.lists
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN color SET NOT NULL,
  ALTER COLUMN task_ids SET NOT NULL;

UPDATE public.okrs SET description = '' WHERE description IS NULL;
ALTER TABLE public.okrs
  ALTER COLUMN description SET DEFAULT ''::text,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN progress SET NOT NULL,
  ALTER COLUMN completed SET NOT NULL,
  ALTER COLUMN key_results SET NOT NULL,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE public.okrs DROP CONSTRAINT IF EXISTS okrs_progress_check;
ALTER TABLE public.okrs ADD CONSTRAINT okrs_progress_check CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE public.shared_tasks
  ALTER COLUMN task_id SET NOT NULL,
  ALTER COLUMN friend_id SET NOT NULL,
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE public.tasks
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN estimated_time SET NOT NULL,
  ALTER COLUMN bookmarked SET NOT NULL,
  ALTER COLUMN completed SET NOT NULL,
  ALTER COLUMN is_collaborative SET NOT NULL;

-- ── A.2 Horodatages ────────────────────────────────────────────────
ALTER TABLE public.events       ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.habits       ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.lists        ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.okrs         ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.shared_tasks ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_habits_updated_at ON public.habits;
CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_lists_updated_at ON public.lists;
CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_okrs_updated_at ON public.okrs;
CREATE TRIGGER update_okrs_updated_at BEFORE UPDATE ON public.okrs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── A.3 Index de lecture ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_user_start  ON public.events USING btree (user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_habits_created_at  ON public.habits USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lists_task_ids     ON public.lists USING gin (task_ids);
CREATE INDEX IF NOT EXISTS idx_okrs_created_at    ON public.okrs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at   ON public.tasks USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON public.tasks USING btree (user_id, created_at DESC);

-- ── A.4 Triggers de garde ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_prevent_user_id_change ON public.subscriptions;
CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

DROP TRIGGER IF EXISTS trg_set_receiver_id ON public.friend_requests;
CREATE TRIGGER trg_set_receiver_id BEFORE INSERT OR UPDATE OF email ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_friend_request_receiver_id();
DROP TRIGGER IF EXISTS trg_set_sender_email ON public.friend_requests;
CREATE TRIGGER trg_set_sender_email BEFORE INSERT OR UPDATE OF sender_id ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_friend_request_sender_email();

-- ── A.5 Commentaires ───────────────────────────────────────────────
COMMENT ON COLUMN public.tasks.recurrence_parent_id IS 'Occurrence dont cette tâche est issue (récurrence). Clé d''idempotence : l''index unique ux_tasks_recurrence_parent garantit AU PLUS UN enfant par parent, donc recocher deux fois ne duplique jamais.';
COMMENT ON COLUMN public.team_tasks.status IS 'Statut de flux : todo | in_progress | review | blocked | done. Synchronisé avec `completed` par trigger dans les deux sens (mig. 091) ; `completed` reste la colonne lue par le front existant.';
COMMENT ON COLUMN public.shared_tasks.shared_by IS 'auth.users.id du partageur. Moitie proprietaire des policies de partage depuis la mig. 019. Colonne creee hors migration, formalisee ici.';
COMMENT ON FUNCTION public.prune_processed_stripe_events() IS 'Purge les marqueurs d''idempotence Stripe de plus de 90 jours. Stripe cesse de re-livrer après ~3 j : au-delà, la ligne ne protège plus de rien.';
COMMENT ON FUNCTION public.run_overdue_reminders() IS 'Automatisation (mig. 096) : cree un rappel par tache en retard et par assigne, au plus une fois par jour (index unique partiel). Appelee par pg_cron, jamais par le client.';
COMMENT ON FUNCTION public.toggle_task_complete(uuid) IS 'DEPRECIEE (2026-08-07) : remplacee par toggle_task_complete_v2, qui genere aussi l''occurrence recurrente dans la meme transaction. Conservee pour un rollback front.';
COMMENT ON TABLE public.org_notifications IS 'Notifications d''entreprise (mig. 095). Écrites UNIQUEMENT par trigger : aucune policy INSERT. Le destinataire peut lire, marquer lue et supprimer les siennes.';
COMMENT ON TABLE public.team_task_activity IS 'Journal append-only des modifications de tâches d''équipe (mig. 094). Écrit UNIQUEMENT par trigger : aucune policy INSERT/UPDATE/DELETE, volontairement.';
COMMENT ON TABLE public.team_task_labels IS 'Jonction tâche ↔ label (mig. 093). Poser un label est un acte d''édition de la tâche.';
COMMENT ON TABLE public.team_task_subtasks IS 'Sous-tâches d''une tâche d''équipe (mig. 092). Un seul niveau, pas de récursion. Accès délégué à can_access_team_task.';

-- ── B.1 Défauts servis par la production ───────────────────────────
ALTER TABLE public.categories ALTER COLUMN color SET DEFAULT '#3B82F6'::text;
ALTER TABLE public.events     ALTER COLUMN color SET DEFAULT '#3B82F6'::text;
ALTER TABLE public.friends    ALTER COLUMN avatar SET DEFAULT '👤'::text;
ALTER TABLE public.habits
  ALTER COLUMN color SET DEFAULT '#10B981'::text,
  ALTER COLUMN estimated_time SET DEFAULT 15;
ALTER TABLE public.lists      ALTER COLUMN color SET DEFAULT '#8B5CF6'::text;
ALTER TABLE public.tasks      ALTER COLUMN estimated_time SET DEFAULT 30;

-- ── B.2 Types et horodatage de `tasks` ─────────────────────────────
-- Même type en production : aucune réécriture.
ALTER TABLE public.okrs
  ALTER COLUMN start_date TYPE timestamp with time zone,
  ALTER COLUMN end_date TYPE timestamp with time zone;

ALTER TABLE public.tasks ALTER COLUMN updated_at SET NOT NULL;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;

-- ── B.3 `friend_requests` et `shared_tasks` ────────────────────────
ALTER INDEX IF EXISTS public.idx_friend_requests_receiver_id RENAME TO idx_friend_requests_receiver;
ALTER INDEX IF EXISTS public.idx_friend_requests_sender_id RENAME TO idx_friend_requests_sender;
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_shared_tasks_friend ON public.shared_tasks USING btree (friend_id);

ALTER TABLE public.friend_requests DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;
ALTER TABLE public.friend_requests ADD CONSTRAINT friend_requests_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── B.4 Corps de fonction de la production ─────────────────────────
-- `CREATE OR REPLACE` garde propriétaire et droits.
CREATE OR REPLACE FUNCTION public.remove_friendship(p_friend_row_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_email TEXT;
  v_friend_email TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT f.email INTO v_friend_email
  FROM public.friends f
  WHERE f.id = p_friend_row_id
    AND f.user_id = v_caller;

  IF v_friend_email IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = v_caller;

  DELETE FROM public.friends
  WHERE id = p_friend_row_id
    AND user_id = v_caller;

  IF v_caller_email IS NOT NULL THEN
    DELETE FROM public.friends
    WHERE lower(email) = lower(v_caller_email)
      AND user_id <> v_caller
      AND user_id IN (
        SELECT id FROM auth.users WHERE lower(email) = lower(v_friend_email)
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_habit_completion(p_habit_id uuid, p_date text) RETURNS public.habits
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_row public.habits;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  UPDATE public.habits
  SET completions = jsonb_set(
    COALESCE(completions, '{}'::jsonb),
    ARRAY[p_date],
    to_jsonb(NOT COALESCE((completions->>p_date)::boolean, false)),
    true
  )
  WHERE id = p_habit_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  RETURN v_row;
END;
$_$;

