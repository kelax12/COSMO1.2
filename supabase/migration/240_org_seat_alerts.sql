-- ═══════════════════════════════════════════════════════════════════
-- 240 · Alerte 80 % des sièges entreprise (spec 2026-11-02 § 6.3)
-- ═══════════════════════════════════════════════════════════════════
--
-- Une table de traçabilité et une RPC de sélection. L'envoi est fait par
-- l'Edge Function `seat-alert`, appelée chaque jour par
-- `.github/workflows/renewal-notice.yml` (job `seat-alert`).
--
-- 🔴 UNIQUE `(org_id, tier_key)` : UNE alerte par palier, rejouable sans
--    doublon. Une CONTRAINTE, pas un simple index : la fonction absorbe le
--    `23505` comme `renewal-notice` le fait (mig. 126, 138).
--
-- `org_id` en ON DELETE CASCADE, comme la 126 à sa création : cette ligne
-- n'est PAS une preuve légale (contrairement à `renewal_notices`, passée en
-- SET NULL par la 138), et elle ne porte aucune donnée personnelle.
--
-- RLS activée, AUCUNE policy : écriture par la fonction (service_role) seule.
--
-- La RPC applique la règle de `org_seats_allowed` (mig. 101) : drapeau
-- `billing_flags.enterprise_seat_limit` faux ou absent → rien ; abonnement
-- non actif → palier gratuit, quota 5 ; quota NULL (illimité) → exclu ;
-- effectif = COUNT(*) de `organization_members`, même source.
-- Le seuil de 80 % est appliqué en TS (`_shared/seat-alert-text.ts`,
-- `shouldAlert`, testé) ET ici, pour ne rendre que des candidats.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.org_seat_alerts (
  id        BIGSERIAL PRIMARY KEY,
  org_id    UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier_key  TEXT NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient TEXT,
  provider_message_id TEXT,
  CONSTRAINT org_seat_alerts_org_tier_key UNIQUE (org_id, tier_key)
);

ALTER TABLE public.org_seat_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_seat_alerts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.org_seat_alerts_id_seq FROM anon, authenticated;

COMMENT ON TABLE public.org_seat_alerts IS
  'Alerte 80 % des sieges envoyee au proprietaire, une ligne par palier (UNIQUE org_id, tier_key). Ecrite par l Edge Function seat-alert seule.';

CREATE OR REPLACE FUNCTION public.orgs_for_seat_alert()
RETURNS TABLE (
  org_id       UUID,
  org_name     TEXT,
  owner_email  TEXT,
  tier_key     TEXT,
  member_count INT,
  quota        INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH flag AS (
    SELECT enabled FROM public.billing_flags WHERE key = 'enterprise_seat_limit'
  ),
  eff AS (
    SELECT
      o.id   AS org_id,
      o.name AS org_name,
      o.owner_id,
      CASE WHEN s.status = 'active' THEN COALESCE(s.tier_key, 'free') ELSE 'free' END AS tier_key,
      CASE WHEN s.status = 'active' THEN s.max_members ELSE 5 END AS quota
    FROM public.organizations o
    LEFT JOIN public.org_subscriptions s ON s.org_id = o.id
  ),
  counted AS (
    SELECT e.*, (SELECT COUNT(*)::int FROM public.organization_members m WHERE m.org_id = e.org_id) AS member_count
    FROM eff e
    WHERE e.quota IS NOT NULL AND e.quota > 0
  )
  SELECT c.org_id, c.org_name, u.email::text, c.tier_key, c.member_count, c.quota
  FROM counted c
  JOIN auth.users u ON u.id = c.owner_id
  WHERE (SELECT enabled FROM flag) IS TRUE
    AND c.member_count * 10 >= c.quota * 8
    AND u.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.org_seat_alerts a
       WHERE a.org_id = c.org_id AND a.tier_key = c.tier_key
    );
$$;

REVOKE ALL ON FUNCTION public.orgs_for_seat_alert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.orgs_for_seat_alert() FROM anon;
REVOKE EXECUTE ON FUNCTION public.orgs_for_seat_alert() FROM authenticated;
