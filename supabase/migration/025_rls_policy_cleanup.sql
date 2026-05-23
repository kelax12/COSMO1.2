-- ═══════════════════════════════════════════════════════════════════
-- Migration 025 — Nettoyage des policies RLS dupliquées
--
-- Deux problèmes découverts via pg_policies (audit 2026-05-23) :
--
--   (A) 13 policies stale créées manuellement en Dashboard (nommées
--       "Users can CREATE own X") ont survécu aux migrations car elles
--       avaient des noms différents de ceux droppés. PostgreSQL évalue
--       les policies du même command avec OR → la policy permissive
--       bypass la stricte. Cas critiques :
--       - friends INSERT : "create" bypass la vérification de demande
--         acceptée (n'importe qui peut s'ajouter en ami sans invitation)
--       - friend_requests UPDATE ancien : sans WITH CHECK, bypasse les
--         contraintes de status pending/cancelled/accepted/rejected
--       - friends UPDATE : pas de WITH CHECK + pas de trigger → user_id
--         réécrivable (data poisoning, faille N1 étendue)
--
--   (B) 6 tables ont leur policy UPDATE sans WITH CHECK (faille N1).
--       Le trigger prevent_user_id_change bloque le cas le plus grave
--       (réécriture de user_id), mais la conformité CLAUDE.md exige
--       WITH CHECK sur tout UPDATE.
--
-- ═══════════════════════════════════════════════════════════════════

-- ─── (A) DROP policies stale/dupliquées ───────────────────────────

-- Duplicates INSERT — noms "create" = créés en dashboard avant les
-- migrations canoniques "insert". Le OR avec la stricte les rendait
-- inutiles mais potentiellement dangereux en cas de divergence future.
DROP POLICY IF EXISTS "Users can create own tasks"       ON public.tasks;
DROP POLICY IF EXISTS "Users can create own habits"      ON public.habits;
DROP POLICY IF EXISTS "Users can create own events"      ON public.events;
DROP POLICY IF EXISTS "Users can create own categories"  ON public.categories;
DROP POLICY IF EXISTS "Users can create own lists"       ON public.lists;
DROP POLICY IF EXISTS "Users can create own okrs"        ON public.okrs;

-- friends INSERT : bypass critique. La policy simple (auth.uid()=user_id)
-- court-circuitait la vérification EXISTS (friend_requests accepted).
DROP POLICY IF EXISTS "Users can create own friends"     ON public.friends;

-- friends UPDATE : pas de use-case légitime (l'amitié n'est pas éditée),
-- pas de trigger prevent_user_id_change → user_id réécrivable.
DROP POLICY IF EXISTS "Users can update own friends"     ON public.friends;

-- friend_requests : policies pré-migration 010. La "update" sans WITH
-- CHECK bypass les contraintes de status des policies granulaires.
DROP POLICY IF EXISTS "Users can view friend requests"   ON public.friend_requests;
DROP POLICY IF EXISTS "Users can create friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can send requests"          ON public.friend_requests;
DROP POLICY IF EXISTS "Users can update friend requests" ON public.friend_requests;
DROP POLICY IF EXISTS "Users can delete friend requests" ON public.friend_requests;

-- ─── (B) Recréer les UPDATE avec WITH CHECK ────────────────────────
-- Ces tables ont le trigger trg_prevent_user_id_change (mitigation user_id),
-- mais CLAUDE.md exige WITH CHECK sur tout UPDATE sans exception.

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON public.events;
CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own habits" ON public.habits;
CREATE POLICY "Users can update own habits" ON public.habits
  FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lists" ON public.lists;
CREATE POLICY "Users can update own lists" ON public.lists
  FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own okrs" ON public.okrs;
CREATE POLICY "Users can update own okrs" ON public.okrs
  FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
