-- ═══════════════════════════════════════════════════════════════════
-- Migration 071 — Visibilité des profils des co-membres d'entreprise
--
-- BUG production : dans la pyramide (et l'annuaire), le nom et l'avatar des
-- autres membres s'affichent en « Membre » générique. Cause : la policy
-- SELECT sur `profiles` (mig. 022/043, faille N12) n'autorise QUE son propre
-- profil et ceux de ses amis (table `friends`). Un co-membre d'entreprise
-- n'est pas un « ami » → son profil n'est pas lisible → repository.getMembers
-- retombe sur displayName='Membre' et avatar=undefined.
--
-- Correctif : autoriser en plus la lecture des profils des personnes avec qui
-- on PARTAGE une organisation. La vérification passe par une fonction
-- SECURITY DEFINER (bypass RLS sur organization_members → pas de récursion),
-- même motif que is_org_member / is_org_admin (mig. 060).
--
-- Périmètre volontairement minimal : SELECT profiles uniquement. Aucune
-- écriture élargie ; les colonnes exposées restent nom/avatar/email sanitizés.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Helper : partage-t-on une organisation avec p_target ? ──────────

CREATE OR REPLACE FUNCTION public.shares_org_with(p_target UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members mine
    JOIN public.organization_members theirs
      ON theirs.org_id = mine.org_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = p_target
  );
$$;

REVOKE ALL ON FUNCTION public.shares_org_with(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_org_with(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_org_with(UUID) FROM anon;

-- ─── Policy SELECT profiles : + co-membres d'entreprise ──────────────

DROP POLICY IF EXISTS "Users can read own profile or friends profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own, friends or org profiles" ON public.profiles;
CREATE POLICY "Users can read own, friends or org profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1
      FROM public.friends f
      WHERE f.user_id = (SELECT auth.uid())
        AND lower(f.email) = lower(profiles.email)
    )
    OR public.shares_org_with(profiles.id)
  );
