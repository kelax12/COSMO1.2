-- ═══════════════════════════════════════════════════════════════════
-- 043_rls_initplan_select_wrap.sql — wrap auth.uid() en (select auth.uid())
--
-- Pourquoi : advisor performance `auth_rls_initplan` (51 findings, vérifié
-- live le 2026-06-11 sur pg_policies). Un `auth.uid()` nu dans une policy
-- RLS est ré-évalué PAR LIGNE scannée ; wrappé en `(select auth.uid())`,
-- Postgres le traite comme un InitPlan évalué UNE fois par requête.
-- C'est le levier principal du hardening scalabilité (CPU Postgres).
--
-- Ce que cette migration fait :
--   - Recrée à L'IDENTIQUE (mêmes noms, mêmes quals, mêmes rôles) toutes
--     les policies du schéma public contenant auth.uid(), en remplaçant
--     chaque occurrence — y compris dans les sous-requêtes EXISTS — par
--     (select auth.uid()). Source = état RÉEL de la prod (pg_policies),
--     pas les fichiers de migration (qui divergent : la policy
--     ANY(collaborators) n'existe plus — colonne droppée en 028 ; pas de
--     policy UPDATE sur subscriptions ni kr_completions, par design).
--
-- Ce que cette migration NE fait PAS :
--   - "No client access to processed_stripe_events" (USING false) : aucun
--     auth.uid() → non touchée.
--   - Aucune création/suppression de droit : sémantique 1:1.
--
-- Invariants respectés (CLAUDE.md) : WITH CHECK conservé sur tous les
-- UPDATE (faille N1), guillemets non échappés, idempotence via
-- DROP POLICY IF EXISTS avant chaque CREATE POLICY.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- tasks (6 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Collaborators can read shared tasks" ON tasks;
CREATE POLICY "Collaborators can read shared tasks"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Editors can update shared tasks" ON tasks;
CREATE POLICY "Editors can update shared tasks"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = (select auth.uid())
        AND st.role = 'editor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM shared_tasks st
      WHERE st.task_id = tasks.id
        AND st.friend_id = (select auth.uid())
        AND st.role = 'editor'
    )
  );

-- ───────────────────────────────────────────────────────────────────
-- habits (4 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own habits" ON habits;
CREATE POLICY "Users can view own habits"
  ON habits FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own habits" ON habits;
CREATE POLICY "Users can insert own habits"
  ON habits FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own habits" ON habits;
CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own habits" ON habits;
CREATE POLICY "Users can delete own habits"
  ON habits FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- events (4 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own events" ON events;
CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own events" ON events;
CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON events;
CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own events" ON events;
CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- categories (4 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own categories" ON categories;
CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON categories;
CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- lists (4 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own lists" ON lists;
CREATE POLICY "Users can view own lists"
  ON lists FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own lists" ON lists;
CREATE POLICY "Users can insert own lists"
  ON lists FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own lists" ON lists;
CREATE POLICY "Users can update own lists"
  ON lists FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own lists" ON lists;
CREATE POLICY "Users can delete own lists"
  ON lists FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- okrs (4 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own okrs" ON okrs;
CREATE POLICY "Users can view own okrs"
  ON okrs FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own okrs" ON okrs;
CREATE POLICY "Users can insert own okrs"
  ON okrs FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own okrs" ON okrs;
CREATE POLICY "Users can update own okrs"
  ON okrs FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own okrs" ON okrs;
CREATE POLICY "Users can delete own okrs"
  ON okrs FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- key_results (4 policies — la SELECT s'appelle « read own », pas « view own »)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own key_results" ON key_results;
CREATE POLICY "Users can read own key_results"
  ON key_results FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own key_results" ON key_results;
CREATE POLICY "Users can insert own key_results"
  ON key_results FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own key_results" ON key_results;
CREATE POLICY "Users can update own key_results"
  ON key_results FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own key_results" ON key_results;
CREATE POLICY "Users can delete own key_results"
  ON key_results FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- kr_completions (3 policies — PAS d'UPDATE : journal append-only, ne pas en créer)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own kr_completions" ON kr_completions;
CREATE POLICY "Users can read own kr_completions"
  ON kr_completions FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own kr_completions" ON kr_completions;
CREATE POLICY "Users can insert own kr_completions"
  ON kr_completions FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own kr_completions" ON kr_completions;
CREATE POLICY "Users can delete own kr_completions"
  ON kr_completions FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────────────────────────
-- friends (3 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own friends" ON friends;
CREATE POLICY "Users can view own friends"
  ON friends FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own friends" ON friends;
CREATE POLICY "Users can delete own friends"
  ON friends FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Qual repris verbatim de la prod (V12 : INSERT exige une friend_request
-- acceptée) — seuls les 3 auth.uid() sont wrappés.
DROP POLICY IF EXISTS "Users can insert own friends via accepted request" ON friends;
CREATE POLICY "Users can insert own friends via accepted request"
  ON friends FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = (select auth.uid()) AND fr.email = friends.email)
          OR (
            fr.receiver_id = (select auth.uid())
            AND fr.sender_id = (
              SELECT users.id
              FROM auth.users
              WHERE (users.email)::text = friends.email
            )
          )
        )
    )
  );

-- ───────────────────────────────────────────────────────────────────
-- friend_requests (6 policies — split sender/receiver CONSERVÉ, règle CLAUDE.md)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Receivers can read incoming requests" ON friend_requests;
CREATE POLICY "Receivers can read incoming requests"
  ON friend_requests FOR SELECT
  USING ((select auth.uid()) = receiver_id);

DROP POLICY IF EXISTS "Senders can read own sent requests" ON friend_requests;
CREATE POLICY "Senders can read own sent requests"
  ON friend_requests FOR SELECT
  USING ((select auth.uid()) = sender_id);

DROP POLICY IF EXISTS "Senders can create requests" ON friend_requests;
CREATE POLICY "Senders can create requests"
  ON friend_requests FOR INSERT
  WITH CHECK ((select auth.uid()) = sender_id);

DROP POLICY IF EXISTS "Receivers can accept or reject" ON friend_requests;
CREATE POLICY "Receivers can accept or reject"
  ON friend_requests FOR UPDATE
  USING ((select auth.uid()) = receiver_id)
  WITH CHECK (
    (select auth.uid()) = receiver_id
    AND status = ANY (ARRAY['accepted'::text, 'rejected'::text])
  );

DROP POLICY IF EXISTS "Senders can cancel their own request" ON friend_requests;
CREATE POLICY "Senders can cancel their own request"
  ON friend_requests FOR UPDATE
  USING ((select auth.uid()) = sender_id)
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND status = ANY (ARRAY['pending'::text, 'cancelled'::text])
  );

DROP POLICY IF EXISTS "Users can delete own requests" ON friend_requests;
CREATE POLICY "Users can delete own requests"
  ON friend_requests FOR DELETE
  USING ((select auth.uid()) = sender_id);

-- ───────────────────────────────────────────────────────────────────
-- shared_tasks (4 policies)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "shared_tasks_select" ON shared_tasks;
CREATE POLICY "shared_tasks_select"
  ON shared_tasks FOR SELECT
  USING ((select auth.uid()) = shared_by OR (select auth.uid()) = friend_id);

-- Qual repris verbatim de la prod (mig 027 + 036) : owner de la task ET
-- (amitié confirmée OU demande pending envoyée par le partageur).
DROP POLICY IF EXISTS "shared_tasks_insert" ON shared_tasks;
CREATE POLICY "shared_tasks_insert"
  ON shared_tasks FOR INSERT
  WITH CHECK (
    (select auth.uid()) = shared_by
    AND EXISTS (
      SELECT 1
      FROM tasks t
      WHERE t.id = shared_tasks.task_id
        AND t.user_id = (select auth.uid())
    )
    AND (
      EXISTS (
        SELECT 1
        FROM friends f
        WHERE f.user_id = (select auth.uid())
          AND f.friend_user_id = shared_tasks.friend_id
      )
      OR EXISTS (
        SELECT 1
        FROM friend_requests fr
        WHERE fr.sender_id = (select auth.uid())
          AND fr.receiver_id = shared_tasks.friend_id
          AND fr.status = 'pending'
      )
    )
  );

DROP POLICY IF EXISTS "shared_tasks_update" ON shared_tasks;
CREATE POLICY "shared_tasks_update"
  ON shared_tasks FOR UPDATE
  USING ((select auth.uid()) = shared_by)
  WITH CHECK ((select auth.uid()) = shared_by);

DROP POLICY IF EXISTS "shared_tasks_delete" ON shared_tasks;
CREATE POLICY "shared_tasks_delete"
  ON shared_tasks FOR DELETE
  USING ((select auth.uid()) = shared_by OR (select auth.uid()) = friend_id);

-- ───────────────────────────────────────────────────────────────────
-- subscriptions (2 policies — PAS d'UPDATE client, par design mig 015)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own subscription" ON subscriptions;
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Lockdown d'amorçage repris verbatim de 041 (fiche N14) : seule la ligne
-- free / zéro token / zéro champ Stripe est insérable côté client.
DROP POLICY IF EXISTS "Users can insert own subscription" ON subscriptions;
CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND plan = 'free'::text
    AND COALESCE(premium_tokens, 0) = 0
    AND COALESCE(win_streak, 0) = 0
    AND current_period_end IS NULL
    AND stripe_customer_id IS NULL
    AND stripe_subscription_id IS NULL
    AND ad_credits_window_start IS NULL
    AND COALESCE(ad_credits_in_window, 0) = 0
  );

-- ───────────────────────────────────────────────────────────────────
-- profiles (3 policies — la SELECT est TO authenticated, conservé)
-- ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can read own profile or friends profiles" ON profiles;
CREATE POLICY "Users can read own profile or friends profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = id
    OR EXISTS (
      SELECT 1
      FROM friends f
      WHERE f.user_id = (select auth.uid())
        AND lower(f.email) = lower(profiles.email)
    )
  );
