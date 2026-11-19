-- ═══════════════════════════════════════════════════════════════════
-- 263 · `org_settings.locale` admet le croate (`hr`)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- COSMO s'ouvre au croate (lot 3 de l'ajout de `hr`). La langue d'une
-- organisation est stockée dans `org_settings.locale` (mig. 195), et lue par
-- l'Edge Function `org-digest` pour rédiger le résumé par courriel. La
-- contrainte `org_settings_locale` (mig. 195, `CHECK (locale IN ('fr','en'))`)
-- refuserait en 23514 le réglage d'une organisation croate.
--
-- ── CE QUI CHANGE ──────────────────────────────────────────────────
--
-- La seule contrainte : `('fr', 'en')` devient `('fr', 'en', 'hr')`. Le
-- défaut reste `'fr'`, aucune ligne n'est réécrite, aucune policy, aucun
-- droit ni trigger n'est touché. Les valeurs déjà présentes (`fr`, `en`)
-- restent admises : la revalidation de la contrainte ne peut pas échouer.
--
-- ── ORDRE ──────────────────────────────────────────────────────────
--
-- Sans risque avant le front : tant que l'écran ne propose pas `hr`, rien ne
-- l'écrit. `org-digest` lit toute valeur inconnue comme du français.
--
-- Rejouable. Preuve : `supabase/proofs/263.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.org_settings DROP CONSTRAINT IF EXISTS org_settings_locale;
ALTER TABLE public.org_settings
  ADD CONSTRAINT org_settings_locale CHECK (locale IN ('fr', 'en', 'hr'));

COMMENT ON CONSTRAINT org_settings_locale ON public.org_settings IS
  'Langue de l''organisation (mig. 263) : fr, en ou hr. Lue par l''Edge Function org-digest, repli sur fr.';
