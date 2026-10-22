-- ═══════════════════════════════════════════════════════════════════
-- 093 — Labels transverses (item UX #13)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- Le SEUL axe de classement d'une tâche d'équipe est son projet. Impossible
-- de répondre à « tout ce qui concerne le client X », « tous les bugs », « ce
-- qui est engagé pour le Q3 » — ces questions traversent les projets, et
-- l'outil n'a aucun moyen de les exprimer.
--
-- ── FORME : TABLE DE LABELS + TABLE DE JONCTION ────────────────────
--
-- L'alternative évidente était un `text[]` sur `team_tasks`. Rejetée :
--
--   * un label renommé devrait être réécrit dans toutes les lignes ;
--   * rien n'empêcherait « bug », « Bug » et « bugs » de coexister ;
--   * aucune couleur, aucune description, aucun inventaire des labels
--     existants pour l'autocomplétion.
--
-- Le coût est une jointure de plus. Il est payé une fois ici plutôt qu'à
-- chaque évolution.
--
-- ── RLS ────────────────────────────────────────────────────────────
--
-- `team_labels` appartient à l'organisation : lecture par tout membre
-- (is_org_member), écriture réservée aux managers (is_org_manager) — un
-- vocabulaire partagé que chacun pourrait modifier n'est plus partagé.
--
-- La jonction délègue à `can_access_team_task` : poser un label sur une tâche
-- est un acte d'édition de la tâche, pas du label.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
  -- Hex validé : la valeur finit dans un style inline côté client.
  color TEXT NOT NULL DEFAULT '#6366f1' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse : c'est ce qui empêche « bug » et « Bug » de
-- devenir deux vocabulaires parallèles dans la même organisation.
CREATE UNIQUE INDEX IF NOT EXISTS ux_team_labels_org_name
  ON public.team_labels (org_id, lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.team_task_labels (
  task_id UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.team_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);

-- La PK sert déjà « les labels de cette tâche ». Cet index sert le sens
-- inverse — « les tâches portant ce label », qui EST la requête du filtre
-- transverse, donc la raison d'être de la fonctionnalité.
CREATE INDEX IF NOT EXISTS idx_team_task_labels_label
  ON public.team_task_labels (label_id);

ALTER TABLE public.team_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_task_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_labels_select" ON public.team_labels;
CREATE POLICY "team_labels_select"
  ON public.team_labels FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_labels_insert" ON public.team_labels;
CREATE POLICY "team_labels_insert"
  ON public.team_labels FOR INSERT
  WITH CHECK (
    created_by = (select auth.uid())
    AND public.is_org_manager(org_id)
  );

DROP POLICY IF EXISTS "team_labels_update" ON public.team_labels;
CREATE POLICY "team_labels_update"
  ON public.team_labels FOR UPDATE
  USING (public.is_org_manager(org_id))
  -- WITH CHECK sur org_id : sans lui, un manager pourrait déplacer un label
  -- vers une organisation dont il n'est pas manager.
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_labels_delete" ON public.team_labels;
CREATE POLICY "team_labels_delete"
  ON public.team_labels FOR DELETE
  USING (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_task_labels_select" ON public.team_task_labels;
CREATE POLICY "team_task_labels_select"
  ON public.team_task_labels FOR SELECT
  USING (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_labels_insert" ON public.team_task_labels;
CREATE POLICY "team_task_labels_insert"
  ON public.team_task_labels FOR INSERT
  WITH CHECK (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_labels_delete" ON public.team_task_labels;
CREATE POLICY "team_task_labels_delete"
  ON public.team_task_labels FOR DELETE
  USING (public.can_access_team_task(task_id));

COMMENT ON TABLE public.team_labels IS
  'Vocabulaire de labels d''une organisation (mig. 093). Lecture par tout membre, écriture réservée aux managers.';
COMMENT ON TABLE public.team_task_labels IS
  'Jonction tâche ↔ label (mig. 093). Poser un label est un acte d''édition de la tâche.';
