-- ═══════════════════════════════════════════════════════════════════
-- 203 — Listes d'entreprise (2026-09-28)
--
-- ── LE BESOIN ──────────────────────────────────────────────────────
--
-- L'onglet Tâches du mode entreprise proposait un « accès rapide aux
-- projets ». Axel veut à la place les LISTES du mode personnel : des
-- regroupements libres, transverses aux projets (« à relire vendredi »,
-- « client Acme »), avec la même barre de puces, le même glisser pour
-- réordonner, les mêmes listes intelligentes.
--
-- ── FORME ──────────────────────────────────────────────────────────
--
-- Même forme que les étiquettes (mig. 093) : une table de listes rattachée à
-- l'organisation, une jonction liste ↔ tâche. Une liste est PARTAGÉE par
-- toute l'organisation ; l'épingle « liste par défaut » reste une préférence
-- de chacun, côté client, jamais une colonne ici (sinon épingler pour soi
-- épinglerait pour tout le monde).
--
-- ── RLS ────────────────────────────────────────────────────────────
--
-- `team_lists` : lecture et écriture par tout membre de l'organisation. Une
-- liste n'est qu'un classement, elle ne donne accès à rien : la tâche reste
-- gardée par sa propre policy. Toute écriture est filtrée par `org_id`, donc
-- par l'index, et le prédicat ne s'évalue que sur les quelques listes d'UNE
-- organisation.
--
-- `team_list_tasks` : lecture par tout membre de l'organisation de la liste.
-- Ajouter ou retirer une tâche exige de VOIR la tâche (`can_access_team_task`)
-- et qu'elle appartienne à la même organisation que la liste : sans ce
-- second test, on pourrait ranger dans sa liste l'identifiant d'une tâche
-- d'une autre organisation dont on est aussi membre.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  -- Nom de couleur de la palette (« blue ») ou hex : même convention que les
  -- listes personnelles (`resolveListColor`). Bornée : la valeur finit dans
  -- un style inline.
  color TEXT NOT NULL DEFAULT 'blue' CHECK (color ~ '^(#[0-9a-fA-F]{6}|[a-z]{3,12})$'),
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'smart')),
  smart_rule TEXT CHECK (smart_rule IS NULL OR smart_rule IN ('overdue', 'this-week', 'high-priority')),
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_lists_smart_rule_required CHECK (type = 'manual' OR smart_rule IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_team_lists_org ON public.team_lists (org_id, position);

CREATE TABLE IF NOT EXISTS public.team_list_tasks (
  list_id UUID NOT NULL REFERENCES public.team_lists(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, task_id)
);

-- La PK sert « les tâches de cette liste » ; cet index sert la cascade à la
-- suppression d'une tâche.
CREATE INDEX IF NOT EXISTS idx_team_list_tasks_task ON public.team_list_tasks (task_id);

ALTER TABLE public.team_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_list_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_lists_select" ON public.team_lists;
CREATE POLICY "team_lists_select"
  ON public.team_lists FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_lists_insert" ON public.team_lists;
CREATE POLICY "team_lists_insert"
  ON public.team_lists FOR INSERT
  WITH CHECK (created_by = (select auth.uid()) AND public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_lists_update" ON public.team_lists;
CREATE POLICY "team_lists_update"
  ON public.team_lists FOR UPDATE
  USING (public.is_org_member(org_id))
  -- WITH CHECK : sans lui, on déplacerait une liste vers une autre organisation.
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_lists_delete" ON public.team_lists;
CREATE POLICY "team_lists_delete"
  ON public.team_lists FOR DELETE
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_list_tasks_select" ON public.team_list_tasks;
CREATE POLICY "team_list_tasks_select"
  ON public.team_list_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_lists l
    WHERE l.id = list_id AND public.is_org_member(l.org_id)
  ));

DROP POLICY IF EXISTS "team_list_tasks_insert" ON public.team_list_tasks;
CREATE POLICY "team_list_tasks_insert"
  ON public.team_list_tasks FOR INSERT
  WITH CHECK (
    public.can_access_team_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.team_lists l
      JOIN public.team_tasks t ON t.org_id = l.org_id
      WHERE l.id = list_id AND t.id = task_id AND public.is_org_member(l.org_id)
    )
  );

DROP POLICY IF EXISTS "team_list_tasks_delete" ON public.team_list_tasks;
CREATE POLICY "team_list_tasks_delete"
  ON public.team_list_tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.team_lists l
    WHERE l.id = list_id AND public.is_org_member(l.org_id)
  ));

-- ACL par défaut du schéma public : anon reçoit les droits nommément à la
-- création. Ne pas accorder n'est pas retirer.
REVOKE ALL ON public.team_lists FROM anon;
REVOKE ALL ON public.team_list_tasks FROM anon;

COMMENT ON TABLE public.team_lists IS
  'Listes d''une organisation (mig. 203) : classement libre et partagé des tâches d''équipe. L''épingle par défaut est une préférence client.';
COMMENT ON TABLE public.team_list_tasks IS
  'Jonction liste ↔ tâche d''équipe (mig. 203). Ajouter exige de voir la tâche, et que la tâche soit de la même organisation.';
