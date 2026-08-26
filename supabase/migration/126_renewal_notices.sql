-- ═══════════════════════════════════════════════════════════════════
-- Migration 126 — Information sur la reconduction tacite (loi Chatel)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- L'article L215-1 du Code de la consommation oblige le professionnel à
-- informer le consommateur, par écrit, de sa faculté de NE PAS reconduire un
-- contrat à reconduction tacite. La fenêtre est bornée des deux côtés : au
-- plus tôt TROIS MOIS et au plus tard UN MOIS avant le terme.
--
-- À défaut, le consommateur peut résilier à tout moment, sans frais, à
-- compter de la date de reconduction. Autrement dit : ne pas envoyer cet
-- avis transforme un abonnement annuel en abonnement résiliable en
-- permanence, et oblige à rembourser les échéances déjà payées d'avance.
--
-- L'obligation est devenue réelle le 2026-08-25 avec la livraison de la
-- facturation ANNUELLE : un abonnement mensuel se reconduit aussi, mais la
-- jurisprudence vise les engagements dont le terme se reconduit pour une
-- durée significative. L'annuel est sans ambiguïté concerné.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
-- Une table de traçabilité, et une RPC qui désigne les organisations à
-- prévenir. L'envoi lui-même est fait par l'Edge Function `renewal-notice`,
-- déclenchée quotidiennement par la CI.
--
-- 🔴 La clé primaire est `(org_id, period_end)`. C'est ce qui rend l'envoi
--    IDEMPOTENT : un avis par échéance, quel que soit le nombre de fois où
--    le travail quotidien tourne. Sans elle, un client recevrait le même
--    avis quarante-cinq jours de suite.
--
-- ❌ Ne JAMAIS purger cette table sur une base de « nettoyage » : elle est la
--    PREUVE que l'avis a été envoyé. C'est précisément ce qu'on doit produire
--    si un client conteste la reconduction.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.renewal_notices (
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Le terme concerné, PAS la date d'envoi. Deux échéances successives
  -- doivent pouvoir recevoir chacune leur avis.
  period_end DATE NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel    TEXT NOT NULL DEFAULT 'email',
  recipient  TEXT,
  PRIMARY KEY (org_id, period_end)
);

ALTER TABLE public.renewal_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.renewal_notices FROM anon, authenticated;

COMMENT ON TABLE public.renewal_notices IS
  'Preuve d envoi de l avis de reconduction tacite (Conso. art. L215-1). Une ligne par echeance. Ne jamais purger.';

-- ─── Qui doit être prévenu aujourd'hui ──────────────────────────────
--
-- Fenêtre par défaut : entre J+30 et J+60. La borne haute légale est de trois
-- mois, la borne basse d'un mois ; viser le milieu laisse trente jours de
-- rattrapage si le travail quotidien ne tourne pas, sans jamais sortir de la
-- fenêtre autorisée.
--
-- ⚠️ Seuls les abonnements ANNUELS sont retournés. Un mensuel se reconduit
-- aussi, mais l'envoyer douze fois par an transformerait une obligation
-- d'information en harcèlement, et le texte vise les engagements de durée.

CREATE OR REPLACE FUNCTION public.orgs_due_for_renewal_notice(
  p_min_days INT DEFAULT 30,
  p_max_days INT DEFAULT 60
)
RETURNS TABLE (
  org_id      UUID,
  org_name    TEXT,
  owner_email TEXT,
  period_end  DATE,
  tier_key    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.org_id,
    o.name,
    u.email::text,
    s.current_period_end::date,
    s.tier_key
  FROM public.org_subscriptions s
  JOIN public.organizations o ON o.id = s.org_id
  JOIN auth.users u           ON u.id = o.owner_id
  WHERE s.status = 'active'
    AND s.billing_interval = 'yearly'
    AND s.tier_key <> 'free'
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end::date
        BETWEEN (CURRENT_DATE + p_min_days) AND (CURRENT_DATE + p_max_days)
    -- Déjà prévenu pour CETTE échéance : on ne renvoie pas.
    AND NOT EXISTS (
      SELECT 1 FROM public.renewal_notices n
       WHERE n.org_id = s.org_id
         AND n.period_end = s.current_period_end::date
    )
    AND u.email IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.orgs_due_for_renewal_notice(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.orgs_due_for_renewal_notice(INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.orgs_due_for_renewal_notice(INT, INT) FROM authenticated;
