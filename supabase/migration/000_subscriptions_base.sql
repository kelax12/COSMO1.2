-- ═══════════════════════════════════════════════════════════════════
-- Migration 000 — Table `subscriptions` (abonnement PARTICULIER)
--
-- POURQUOI CE FICHIER EXISTE, ALORS QUE LA TABLE EST EN PROD DEPUIS
-- TOUJOURS : elle n'a jamais été créée par une migration. Elle a été
-- faite à la main avant l'établissement de la convention `NNN_*.sql`.
-- Le jeu de migrations n'était donc pas AUTO-SUFFISANT : rejoué sur une
-- base vierge, il échouait à la migration 011, qui pose une policy et un
-- trigger sur une table que rien n'avait créée :
--
--   011_security_hardening_v2.sql
--   relation "subscriptions" does not exist   (sqlstate 42P01)
--
-- C'est la cause de l'échec du job CI `rls-integration` depuis son ajout
-- le 2026-06-21 — il n'a jamais été vert une seule fois.
--
-- Numérotée 000 parce qu'elle précède réellement l'historique : la table
-- existait avant `001_tasks.sql`. Elle ne dépend que de `auth.users`.
--
-- ⚠️ NE PAS confondre avec `org_subscriptions` (mig. 101), qui porte
-- l'abonnement d'une ORGANISATION. Les deux tables ne partagent aucune
-- colonne : ici les jetons premium et le `win_streak` d'un particulier,
-- là-bas un palier et un quota de sièges.
--
-- EFFET EN PRODUCTION : AUCUN. `IF NOT EXISTS` — la table existe déjà,
-- toutes les instructions sont des no-op. Ce fichier n'existe que pour
-- qu'une base vierge converge vers le même schéma que la prod.
--
-- Les colonnes ajoutées PLUS TARD ne sont volontairement pas ici, pour
-- que le replay suive la même histoire que la prod :
--   - `stripe_customer_id` / `stripe_subscription_id` → mig. 014
--   - `ad_credits_window_start` / `ad_credits_in_window` → mig. 039
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL DEFAULT 'free',
  status              TEXT NOT NULL DEFAULT 'active',
  premium_tokens      INTEGER NOT NULL DEFAULT 0,
  current_period_end  TIMESTAMPTZ,
  win_streak          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Un abonnement se lit toujours par utilisateur (`useBilling()` au montage
-- de l'app) : sans cet index, chaque lecture scanne la table entière.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

-- RLS activée dès la création, comme en prod. Les policies elles-mêmes
-- arrivent avec les migrations suivantes, dans leur ordre historique :
--   - UPDATE  → mig. 011 (+ trigger d'immuabilité de user_id)
--   - INSERT  → mig. 041 (verrouillage), réécrite par la 043
--   - SELECT  → mig. 043 (wrap de auth.uid() pour le plan d'exécution)
-- Aucune policy ici : en poser une serait créer une seconde policy
-- PERMISSIVE pour le même rôle+action, ce que `npm run check:rls`
-- interdit (mig. 049).
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.subscriptions IS
  'Abonnement premium d''un compte PARTICULIER (jetons, win_streak, Stripe). Ne pas confondre avec org_subscriptions (mig. 101), qui porte l''abonnement d''une organisation. Table anterieure a l''historique de migrations, formalisee par la mig. 000.';
