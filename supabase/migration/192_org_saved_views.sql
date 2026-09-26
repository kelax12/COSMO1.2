-- ═══════════════════════════════════════════════════════════════════
-- 192 · Vues enregistrées (recommandations de l'étape 6, 2026-09-25)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. Un manager refaisait ses filtres à
-- chaque visite de Tâches ou de Projets (« mon équipe, en retard, priorité
-- haute »). Les filtres vivent désormais dans l'URL (partageables tels quels)
-- et une combinaison peut être NOMMÉE et retrouvée.
--
-- ── RÈGLES ─────────────────────────────────────────────────────────
--
--   · Une vue est PERSONNELLE : lue et écrite par son auteur seul, dans une
--     organisation dont il est membre actif. Partager une vue, c'est partager
--     son URL, qui porte déjà les filtres.
--   · `filters` est un objet JSON opaque pour la base (le client le valide) :
--     borné en taille, jamais interprété côté serveur. Une vue ne DONNE
--     aucun droit : rejouer ses filtres relit sous la RLS de qui l'ouvre.
--   · 50 vues par personne, par organisation et par écran.
--   · RGPD : `user_id ON DELETE CASCADE` (effacement avec le compte), et la
--     table suit l'export de portabilité.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_saved_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL,
  name       TEXT NOT NULL,
  filters    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_saved_views_scope_check CHECK (scope IN ('tasks', 'projects')),
  CONSTRAINT org_saved_views_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT org_saved_views_filters_shape
    CHECK (jsonb_typeof(filters) = 'object' AND octet_length(filters::text) <= 4000),
  CONSTRAINT org_saved_views_unique_name UNIQUE (org_id, user_id, scope, name)
);

CREATE INDEX IF NOT EXISTS idx_org_saved_views_owner
  ON public.org_saved_views (user_id, org_id, scope);

-- L'auteur et l'organisation ne changent pas ; `updated_at` se déduit ; 50
-- vues au plus. INVOKER : ne compte que les lignes de l'appelant, qu'il voit.
CREATE OR REPLACE FUNCTION public.org_saved_view_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.org_id IS DISTINCT FROM OLD.org_id
          OR NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.scope IS DISTINCT FROM OLD.scope) THEN
    RAISE EXCEPTION 'org_saved_views: owner, organization and scope are immutable';
  END IF;
  IF TG_OP = 'INSERT' AND (
    SELECT count(*) FROM public.org_saved_views v
     WHERE v.org_id = NEW.org_id AND v.user_id = NEW.user_id AND v.scope = NEW.scope
  ) >= 50 THEN
    RAISE EXCEPTION 'saved_views_limit' USING ERRCODE = '54000';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_saved_view_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_saved_view_before_write ON public.org_saved_views;
CREATE TRIGGER trg_org_saved_view_before_write
  BEFORE INSERT OR UPDATE ON public.org_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.org_saved_view_before_write();

ALTER TABLE public.org_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_saved_views_select" ON public.org_saved_views;
CREATE POLICY "org_saved_views_select" ON public.org_saved_views FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_saved_views_insert" ON public.org_saved_views;
CREATE POLICY "org_saved_views_insert" ON public.org_saved_views FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_saved_views_update" ON public.org_saved_views;
CREATE POLICY "org_saved_views_update" ON public.org_saved_views FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_saved_views_delete" ON public.org_saved_views;
CREATE POLICY "org_saved_views_delete" ON public.org_saved_views FOR DELETE
  USING (user_id = (SELECT auth.uid()));

COMMIT;
