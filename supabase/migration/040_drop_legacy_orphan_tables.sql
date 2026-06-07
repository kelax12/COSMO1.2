-- ═══════════════════════════════════════════════════════════════════
-- Migration 040 — Suppression des tables orphelines héritées
--
-- Audit 2026-06-07 : l'introspection du schéma prod (generate types) a révélé
-- deux tables présentes en base mais ABSENTES du versioning et NON utilisées :
--   - `billing`        → remplacée par `subscriptions` (la source de vérité premium)
--   - `user_profiles`  → remplacée par `profiles`
--
-- Les deux sont vides (0 ligne) et sans aucune référence dans le code
-- (`grep from('billing') / user_profiles` → 0). On les supprime pour aligner
-- le schéma réel sur les migrations (reproductibilité DR / ISO 27001).
--
-- Idempotent. Pas de perte de donnée (tables vides).
-- ═══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.billing CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
