-- ═══════════════════════════════════════════════════════════════════
-- Migration 039 — Plafond quotidien sur les crédits premium "pub"
--
-- Modèle produit voulu : l'utilisateur regarde autant de pubs qu'il veut et
-- gagne 1 token premium par pub (token = premium complet, comme l'abonnement
-- Stripe). On NE bride donc PAS le rythme — on borne seulement le total à
-- 20 crédits / 24 h glissantes.
--
-- ⚠️ Limite de sécurité INHÉRENTE à AdSense : AdSense est un réseau d'affichage
--    (display), PAS un réseau "rewarded" avec Server-Side Verification. Il est
--    donc IMPOSSIBLE de prouver côté serveur qu'une pub a réellement été vue —
--    un script peut appeler cette RPC sans regarder de pub. Ce plafond est
--    DISSUASIF (borne les dégâts à 20 jours premium / 24 h par compte), pas
--    inviolable. La seule façon de fermer totalement le trou serait de passer
--    à un réseau rewarded avec callback SSV signé (AdMob/Unity/ironSource) et
--    de créditer depuis une Edge Function qui vérifie la signature.
--
-- Remplace la 1ʳᵉ version de cette migration (cap 1/24h, jamais appliquée en
-- prod) qui cassait le modèle "pubs illimitées". Idempotent.
-- À appliquer via `supabase db push` (non auto-appliqué par le déploiement front).
-- ═══════════════════════════════════════════════════════════════════

-- Compteur de fenêtre glissante. `last_ad_credit_at` (ancienne v1) n'est plus
-- utilisé mais on le laisse si déjà présent — sans dépendance.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS ad_credits_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ad_credits_in_window    INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION credit_premium_token_from_ad()
RETURNS subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result  subscriptions;
  v_start TIMESTAMPTZ;
  v_count INTEGER;
  c_daily_cap CONSTANT INTEGER := 20;  -- max crédits par fenêtre de 24 h
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ad_credits_window_start, ad_credits_in_window
    INTO v_start, v_count
  FROM subscriptions
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Ouvre une nouvelle fenêtre de 24 h si jamais créditée ou fenêtre expirée.
  IF v_start IS NULL OR v_start <= NOW() - INTERVAL '24 hours' THEN
    v_start := NOW();
    v_count := 0;
  END IF;

  -- Plafond anti-farm. ERRCODE check_violation (23514) pour que le client
  -- distingue ce cas d'une vraie erreur et affiche un message dédié.
  IF v_count >= c_daily_cap THEN
    RAISE EXCEPTION 'Daily ad-credit limit reached (% per 24h)', c_daily_cap
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE subscriptions
    SET premium_tokens          = premium_tokens + 1,
        -- Activer plan/status pour que isPremium() passe (cf. mig. 016).
        plan                    = 'premium',
        status                  = 'active',
        ad_credits_window_start = v_start,
        ad_credits_in_window    = v_count + 1,
        updated_at              = NOW()
    WHERE user_id = auth.uid()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION credit_premium_token_from_ad() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION credit_premium_token_from_ad() TO authenticated;
