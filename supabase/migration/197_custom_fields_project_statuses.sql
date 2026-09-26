-- ═══════════════════════════════════════════════════════════════════
-- 197 · Champs personnalisés et statuts de flux par projet
--       (audit du mode Entreprise, 2026-09-24, étape 6 : « champs
--       personnalisés et statuts de flux par projet »)
--
-- ⚠️ ÉCRITE LE 2026-09-26, NON APPLIQUÉE. Ordre : APRÈS 190 (rôle `viewer`,
-- `my_project_role`) et 195-196. Le front qui lit `custom_status_id` ne se
-- déploie qu'APRÈS elle (règle des mig. 113 et 146).
--
-- ── 1. Statuts de flux par projet ──────────────────────────────────
--
-- Un projet peut nommer ses propres colonnes (« Maquette », « Recette
-- client »…). Chacune CORRESPOND à l'un des cinq statuts du produit
-- (`maps_to`) : les statistiques, « terminée », le journal et les filtres
-- continuent de raisonner sur les cinq statuts, et un projet sans statut
-- propre ne change pas.
--
--   · `team_tasks.custom_status_id` : nullable, `ON DELETE SET NULL`.
--   · Trigger `trg_apply_team_task_custom_status` (INVOKER), qui s'exécute
--     AVANT `trg_sync_team_task_status` (ordre alphabétique des triggers
--     BEFORE) : un statut propre ÉCRIT `status`, puis la 091 aligne
--     `completed`. Un statut propre d'un AUTRE projet est refusé ; un
--     changement de `status` qui le contredit le détache.
--   · 12 statuts au plus par projet. Lecture : qui voit le projet ; écriture :
--     qui peut modifier le projet (`can_edit_team_project`, mig. 190).
--
-- ── 2. Champs personnalisés ────────────────────────────────────────
--
--   · `team_custom_fields` : un champ d'organisation (`project_id` NULL, géré
--     par les admins) ou d'un projet (géré par qui modifie le projet).
--     Types : texte, nombre, date, liste, case à cocher. 30 par organisation.
--   · `team_task_field_values` : une valeur par tâche et par champ, validée
--     par son type (trigger INVOKER). Lecture et écriture : qui accède à la
--     tâche ; un `viewer` du projet ne l'écrit pas (même règle que la 190).
--
-- 🔎 Les policies de `team_custom_fields` appellent `can_access_team_project`
-- sur une colonne de la ligne : la table est petite (30 lignes par
-- organisation au plus), l'index n'a rien à y perdre. La règle des mig. 085 /
-- 113 vise les tables de TRAVAIL (tâches, projets), pas un vocabulaire.
--
-- RGPD : aucune colonne `user_id` ; `created_by` / `updated_by` passent à
-- NULL avec leur auteur. Les valeurs suivent la tâche (cascade).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Statuts de flux par projet ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_project_statuses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  maps_to    TEXT NOT NULL,
  position   SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_project_statuses_maps_to CHECK (maps_to IN ('todo', 'in_progress', 'review', 'blocked', 'done')),
  CONSTRAINT team_project_statuses_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  CONSTRAINT team_project_statuses_color CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT team_project_statuses_position CHECK (position BETWEEN 0 AND 99)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_project_statuses_name
  ON public.team_project_statuses (project_id, lower(btrim(name)));

CREATE OR REPLACE FUNCTION public.team_project_status_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'team_project_statuses: project is immutable';
  END IF;
  -- L'organisation se DÉDUIT du projet : jamais celle qu'envoie le client.
  SELECT p.org_id INTO NEW.org_id FROM public.team_projects p WHERE p.id = NEW.project_id;
  NEW.name := btrim(NEW.name);
  IF TG_OP = 'INSERT' AND (
    SELECT count(*) FROM public.team_project_statuses s WHERE s.project_id = NEW.project_id
  ) >= 12 THEN
    RAISE EXCEPTION 'project_statuses_limit' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_project_status_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_project_status_before_write ON public.team_project_statuses;
CREATE TRIGGER trg_team_project_status_before_write
  BEFORE INSERT OR UPDATE ON public.team_project_statuses
  FOR EACH ROW EXECUTE FUNCTION public.team_project_status_before_write();

ALTER TABLE public.team_project_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_project_statuses_select" ON public.team_project_statuses;
CREATE POLICY "team_project_statuses_select" ON public.team_project_statuses FOR SELECT
  USING (public.can_access_team_project(project_id));

DROP POLICY IF EXISTS "team_project_statuses_insert" ON public.team_project_statuses;
CREATE POLICY "team_project_statuses_insert" ON public.team_project_statuses FOR INSERT
  WITH CHECK (public.can_edit_team_project(project_id));

DROP POLICY IF EXISTS "team_project_statuses_update" ON public.team_project_statuses;
CREATE POLICY "team_project_statuses_update" ON public.team_project_statuses FOR UPDATE
  USING (public.can_edit_team_project(project_id))
  WITH CHECK (public.can_edit_team_project(project_id));

DROP POLICY IF EXISTS "team_project_statuses_delete" ON public.team_project_statuses;
CREATE POLICY "team_project_statuses_delete" ON public.team_project_statuses FOR DELETE
  USING (public.can_edit_team_project(project_id));

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS custom_status_id UUID REFERENCES public.team_project_statuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_tasks_custom_status
  ON public.team_tasks (custom_status_id) WHERE custom_status_id IS NOT NULL;

-- Nom choisi pour passer AVANT `trg_init_team_task_status` et
-- `trg_sync_team_task_status` (triggers BEFORE, ordre alphabétique).
CREATE OR REPLACE FUNCTION public.apply_team_task_custom_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_project uuid;
  v_maps_to text;
BEGIN
  -- Un changement de projet détache un statut propre à l'ancien projet.
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id
     AND NEW.custom_status_id IS NOT DISTINCT FROM OLD.custom_status_id THEN
    NEW.custom_status_id := NULL;
  END IF;

  IF NEW.custom_status_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.project_id, s.maps_to INTO v_project, v_maps_to
    FROM public.team_project_statuses s WHERE s.id = NEW.custom_status_id;
  IF v_project IS NULL OR v_project <> NEW.project_id THEN
    RAISE EXCEPTION 'custom_status_not_in_project' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.custom_status_id IS NOT DISTINCT FROM OLD.custom_status_id
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IS DISTINCT FROM v_maps_to THEN
    -- Le statut du produit a changé sans passer par le statut propre (vue
    -- liste, action groupée, case « terminée ») : on détache, on ne force pas.
    NEW.custom_status_id := NULL;
    RETURN NEW;
  END IF;

  NEW.status := v_maps_to;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_team_task_custom_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_apply_team_task_custom_status ON public.team_tasks;
CREATE TRIGGER trg_apply_team_task_custom_status
  BEFORE INSERT OR UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.apply_team_task_custom_status();

-- ── 2. Champs personnalisés ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_custom_fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.team_projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  options    TEXT[] NOT NULL DEFAULT '{}',
  position   SMALLINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_custom_fields_kind CHECK (kind IN ('text', 'number', 'date', 'select', 'checkbox')),
  CONSTRAINT team_custom_fields_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  CONSTRAINT team_custom_fields_options CHECK (
    cardinality(options) <= 30
    AND (kind = 'select') = (cardinality(options) > 0)
  ),
  CONSTRAINT team_custom_fields_position CHECK (position BETWEEN 0 AND 99)
);

CREATE INDEX IF NOT EXISTS idx_team_custom_fields_org ON public.team_custom_fields (org_id, project_id);

CREATE OR REPLACE FUNCTION public.team_custom_field_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.org_id IS DISTINCT FROM OLD.org_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
  ) THEN
    -- Changer le type rendrait les valeurs déjà saisies illisibles.
    RAISE EXCEPTION 'team_custom_fields: organization, project and kind are immutable';
  END IF;
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_projects p WHERE p.id = NEW.project_id AND p.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'project_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.options := ARRAY(SELECT DISTINCT btrim(o) FROM unnest(NEW.options) o WHERE btrim(o) <> '' AND char_length(btrim(o)) <= 60);
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    IF (SELECT count(*) FROM public.team_custom_fields f WHERE f.org_id = NEW.org_id) >= 30 THEN
      RAISE EXCEPTION 'custom_fields_limit' USING ERRCODE = '54000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_custom_field_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_custom_field_before_write ON public.team_custom_fields;
CREATE TRIGGER trg_team_custom_field_before_write
  BEFORE INSERT OR UPDATE ON public.team_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.team_custom_field_before_write();

ALTER TABLE public.team_custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_custom_fields_select" ON public.team_custom_fields;
CREATE POLICY "team_custom_fields_select" ON public.team_custom_fields FOR SELECT
  USING (
    public.is_org_member(org_id)
    AND (project_id IS NULL OR public.can_access_team_project(project_id))
  );

DROP POLICY IF EXISTS "team_custom_fields_insert" ON public.team_custom_fields;
CREATE POLICY "team_custom_fields_insert" ON public.team_custom_fields FOR INSERT
  WITH CHECK (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  );

DROP POLICY IF EXISTS "team_custom_fields_update" ON public.team_custom_fields;
CREATE POLICY "team_custom_fields_update" ON public.team_custom_fields FOR UPDATE
  USING (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  )
  WITH CHECK (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  );

DROP POLICY IF EXISTS "team_custom_fields_delete" ON public.team_custom_fields;
CREATE POLICY "team_custom_fields_delete" ON public.team_custom_fields FOR DELETE
  USING (
    CASE WHEN project_id IS NULL THEN public.is_org_admin(org_id)
         ELSE public.can_edit_team_project(project_id) END
  );

CREATE TABLE IF NOT EXISTS public.team_task_field_values (
  task_id    UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  field_id   UUID NOT NULL REFERENCES public.team_custom_fields(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, field_id),
  CONSTRAINT team_task_field_values_size CHECK (octet_length(value::text) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_team_task_field_values_field ON public.team_task_field_values (field_id);

CREATE OR REPLACE FUNCTION public.team_task_field_value_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_task_project uuid;
  v_task_org     uuid;
  v_field        public.team_custom_fields%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.task_id IS DISTINCT FROM OLD.task_id OR NEW.field_id IS DISTINCT FROM OLD.field_id) THEN
    RAISE EXCEPTION 'team_task_field_values: task and field are immutable';
  END IF;
  SELECT t.project_id, t.org_id INTO v_task_project, v_task_org FROM public.team_tasks t WHERE t.id = NEW.task_id;
  SELECT * INTO v_field FROM public.team_custom_fields f WHERE f.id = NEW.field_id;
  IF v_task_org IS NULL OR v_field.id IS NULL OR v_field.org_id <> v_task_org
     OR (v_field.project_id IS NOT NULL AND v_field.project_id <> v_task_project) THEN
    RAISE EXCEPTION 'field_not_for_task' USING ERRCODE = 'P0001';
  END IF;
  -- Même règle que les tâches (mig. 190) : un lecteur du projet ne saisit rien.
  IF public.my_project_role(v_task_project) = 'viewer' THEN
    RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
  END IF;
  -- La valeur respecte le type du champ.
  IF NOT CASE v_field.kind
    WHEN 'text'     THEN jsonb_typeof(NEW.value) = 'string' AND char_length(NEW.value #>> '{}') <= 500
    WHEN 'number'   THEN jsonb_typeof(NEW.value) = 'number'
    WHEN 'checkbox' THEN jsonb_typeof(NEW.value) = 'boolean'
    WHEN 'date'     THEN jsonb_typeof(NEW.value) = 'string' AND (NEW.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
    WHEN 'select'   THEN jsonb_typeof(NEW.value) = 'string' AND (NEW.value #>> '{}') = ANY (v_field.options)
    ELSE false
  END THEN
    RAISE EXCEPTION 'invalid_field_value' USING ERRCODE = '22023';
  END IF;
  NEW.org_id := v_task_org;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_task_field_value_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_team_task_field_value_before_write ON public.team_task_field_values;
CREATE TRIGGER trg_team_task_field_value_before_write
  BEFORE INSERT OR UPDATE ON public.team_task_field_values
  FOR EACH ROW EXECUTE FUNCTION public.team_task_field_value_before_write();

ALTER TABLE public.team_task_field_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_task_field_values_select" ON public.team_task_field_values;
CREATE POLICY "team_task_field_values_select" ON public.team_task_field_values FOR SELECT
  USING (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_field_values_insert" ON public.team_task_field_values;
CREATE POLICY "team_task_field_values_insert" ON public.team_task_field_values FOR INSERT
  WITH CHECK (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_field_values_update" ON public.team_task_field_values;
CREATE POLICY "team_task_field_values_update" ON public.team_task_field_values FOR UPDATE
  USING (public.can_access_team_task(task_id))
  WITH CHECK (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_field_values_delete" ON public.team_task_field_values;
CREATE POLICY "team_task_field_values_delete" ON public.team_task_field_values FOR DELETE
  USING (public.can_access_team_task(task_id));

COMMIT;
