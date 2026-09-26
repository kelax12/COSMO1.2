-- ═══════════════════════════════════════════════════════════════════
-- 196 · Capacité hebdomadaire et lien hiérarchique secondaire
--       (audit du mode Entreprise, 2026-09-24 : Statistiques « pas de charge
--       au regard d'une capacité », Pyramide « un seul manager »)
--
-- ⚠️ ÉCRITE LE 2026-09-26, NON APPLIQUÉE. Ordre : APRÈS 195.
--
-- ── 1. `org_member_capacity` ───────────────────────────────────────
--
-- Minutes disponibles par semaine pour le travail de l'organisation. Absente
-- = inconnue (jamais « zéro » : une capacité non déclarée ne rend personne
-- surchargé). La charge (mig. 191, `useTeamMemberWorkload`) se lit alors EN
-- REGARD de cette capacité dans l'onglet Statistiques.
--
--   · Lecture : tout membre actif (la charge d'une équipe se discute à plusieurs).
--   · Écriture : un admin, ou quelqu'un AU-DESSUS de la personne dans la
--     pyramide (`is_above`), ou la personne elle-même. Qui planifie le
--     travail d'autrui doit pouvoir dire combien il en tient.
--
-- ── 2. `org_member_secondary_managers` ─────────────────────────────
--
-- Organisation matricielle : un lien EN POINTILLÉ vers un second responsable
-- (un chef de projet transverse, un référent métier). 3 au plus par personne.
--
--   🔴 CE LIEN NE DONNE AUCUN DROIT. Il ne passe ni par `is_above`, ni par
--   `get_subtree`, ni par aucune policy : la visibilité et les permissions
--   restent celles de l'arbre principal (`manager_id`). Le faire compter
--   changerait l'audience de tous les projets d'équipe d'un seul geste.
--
--   · Lecture : tout membre actif (la pyramide est lisible par tous).
--   · Écriture : admins seulement, comme le placement principal.
--   · Garde (trigger INVOKER) : pas soi-même, pas son manager principal, les
--     deux personnes membres de l'organisation, 3 liens au plus.
--
-- RGPD : `user_id` et `manager_id` en `ON DELETE CASCADE` : le lien disparaît
-- avec l'une ou l'autre personne. Déclarées dans `check-erasure-coverage.mjs`
-- et `check-portability-export.mjs`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Capacité ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_member_capacity (
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_minutes INTEGER NOT NULL,
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id),
  -- Quitter l'organisation emporte la capacité, sans passer par la RLS de
  -- celui qui retire (une clé étrangère cascade, une policy filtrerait).
  CONSTRAINT org_member_capacity_member FOREIGN KEY (org_id, user_id)
    REFERENCES public.organization_members (org_id, user_id) ON DELETE CASCADE,
  CONSTRAINT org_member_capacity_range CHECK (weekly_minutes BETWEEN 0 AND 6000)
);

CREATE OR REPLACE FUNCTION public.org_member_capacity_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'org_member_capacity: organization and person are immutable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.org_id = NEW.org_id AND m.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'capacity_not_a_member' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_member_capacity_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_member_capacity_before_write ON public.org_member_capacity;
CREATE TRIGGER trg_org_member_capacity_before_write
  BEFORE INSERT OR UPDATE ON public.org_member_capacity
  FOR EACH ROW EXECUTE FUNCTION public.org_member_capacity_before_write();

ALTER TABLE public.org_member_capacity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_member_capacity_select" ON public.org_member_capacity;
CREATE POLICY "org_member_capacity_select" ON public.org_member_capacity FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_member_capacity_insert" ON public.org_member_capacity;
CREATE POLICY "org_member_capacity_insert" ON public.org_member_capacity FOR INSERT
  WITH CHECK (
    public.is_org_member(org_id)
    AND (user_id = (SELECT auth.uid()) OR public.is_org_admin(org_id) OR public.is_above(org_id, user_id))
  );

DROP POLICY IF EXISTS "org_member_capacity_update" ON public.org_member_capacity;
CREATE POLICY "org_member_capacity_update" ON public.org_member_capacity FOR UPDATE
  USING (
    public.is_org_member(org_id)
    AND (user_id = (SELECT auth.uid()) OR public.is_org_admin(org_id) OR public.is_above(org_id, user_id))
  )
  WITH CHECK (
    public.is_org_member(org_id)
    AND (user_id = (SELECT auth.uid()) OR public.is_org_admin(org_id) OR public.is_above(org_id, user_id))
  );

DROP POLICY IF EXISTS "org_member_capacity_delete" ON public.org_member_capacity;
CREATE POLICY "org_member_capacity_delete" ON public.org_member_capacity FOR DELETE
  USING (
    public.is_org_member(org_id)
    AND (user_id = (SELECT auth.uid()) OR public.is_org_admin(org_id) OR public.is_above(org_id, user_id))
  );

-- ── 2. Liens secondaires ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_member_secondary_managers (
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id, manager_id),
  -- Même règle : le lien part avec le départ de l'une OU l'autre personne.
  CONSTRAINT org_member_secondary_member FOREIGN KEY (org_id, user_id)
    REFERENCES public.organization_members (org_id, user_id) ON DELETE CASCADE,
  CONSTRAINT org_member_secondary_manager FOREIGN KEY (org_id, manager_id)
    REFERENCES public.organization_members (org_id, user_id) ON DELETE CASCADE,
  CONSTRAINT org_member_secondary_not_self CHECK (user_id <> manager_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_secondary_manager
  ON public.org_member_secondary_managers (org_id, manager_id);

CREATE OR REPLACE FUNCTION public.org_member_secondary_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = NEW.org_id AND m.user_id = NEW.user_id)
     OR NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = NEW.org_id AND m.user_id = NEW.manager_id) THEN
    RAISE EXCEPTION 'secondary_not_a_member' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = NEW.org_id AND m.user_id = NEW.user_id AND m.manager_id = NEW.manager_id
  ) THEN
    RAISE EXCEPTION 'secondary_is_primary' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.org_member_secondary_managers s
       WHERE s.org_id = NEW.org_id AND s.user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'secondary_limit' USING ERRCODE = '54000';
  END IF;
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_member_secondary_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_member_secondary_before_insert ON public.org_member_secondary_managers;
CREATE TRIGGER trg_org_member_secondary_before_insert
  BEFORE INSERT ON public.org_member_secondary_managers
  FOR EACH ROW EXECUTE FUNCTION public.org_member_secondary_before_insert();

ALTER TABLE public.org_member_secondary_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_member_secondary_select" ON public.org_member_secondary_managers;
CREATE POLICY "org_member_secondary_select" ON public.org_member_secondary_managers FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_member_secondary_insert" ON public.org_member_secondary_managers;
CREATE POLICY "org_member_secondary_insert" ON public.org_member_secondary_managers FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_member_secondary_delete" ON public.org_member_secondary_managers;
CREATE POLICY "org_member_secondary_delete" ON public.org_member_secondary_managers FOR DELETE
  USING (public.is_org_admin(org_id));
-- Pas de policy UPDATE : un lien se retire et se repose, il ne se modifie pas.

COMMIT;
