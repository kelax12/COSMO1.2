-- ═══════════════════════════════════════════════════════════════════
-- 226 · Suppression des comptes inactifs depuis 3 ans (C-121)
-- ═══════════════════════════════════════════════════════════════════
--
-- La politique de confidentialité (s6.li1, depuis le 2026-10-13) promet :
-- un compte sans activité pendant TROIS ANS est supprimé, après un e-mail
-- d'avertissement envoyé TRENTE JOURS avant (RGPD art. 5.1.e). Jusqu'ici
-- aucun traitement ne l'appliquait : une promesse publiée sans exécution
-- redevient une fausse déclaration le jour où un compte franchit le seuil.
--
-- Cette migration ne supprime rien. Elle pose :
--   · `account_inactivity_notices` : un avertissement envoyé, par compte ;
--   · `accounts_due_for_inactivity_notice()` : qui avertir aujourd'hui ;
--   · `account_inactivity_deletion_due(uuid)` et
--     `accounts_due_for_inactivity_deletion()` : qui supprimer.
-- L'envoi et l'effacement sont faits par les Edge Functions
-- `inactive-accounts` (avertit, puis demande l'effacement) et
-- `delete-account` (efface, par le MÊME chemin qu'une suppression demandée
-- depuis les Réglages, transfert de propriété d'organisation compris).
--
-- ── L'ACTIVITÉ ─────────────────────────────────────────────────────
--
-- `greatest(auth.users.last_sign_in_at, profiles.last_seen_at, created_at)`.
-- 🔴 `last_sign_in_at` SEUL serait faux : il ne bouge qu'à une connexion, pas
-- au rafraîchissement de session. Quelqu'un qui ouvre l'application tous les
-- jours depuis trois ans sans jamais se reconnecter serait visé. C'est
-- `touch_last_seen()` (appelée à l'ouverture de l'app) qui dit l'usage réel.
-- `greatest` ignore les NULL ; `created_at` ne l'est jamais.
--
-- ── CE QUI N'EST JAMAIS VISÉ ───────────────────────────────────────
--
--   · un compte actif depuis moins de 3 ans (le témoin de la preuve : un
--     compte vu hier) ;
--   · un compte qui paie : abonnement personnel ou organisation possédée
--     dont l'abonnement est `active` / `past_due`. On ne supprime pas un
--     client, on lui écrit ;
--   · un compte anonyme, sans e-mail, banni ou déjà supprimé : on ne peut
--     pas l'avertir, donc on ne le supprime pas par ce chemin ;
--   · un compte averti qui est revenu, même une seule fois, après
--     l'avertissement : son activité dépasse alors celle relevée à l'envoi.
--
-- ❌ Ne JAMAIS supprimer sans avertissement : la politique le promet. Seule
--    une ligne de `account_inactivity_notices` vieille de 30 jours ouvre
--    l'effacement, et elle n'est écrite qu'APRÈS l'envoi réussi.
--
-- ── DONNÉES ────────────────────────────────────────────────────────
--
-- La table ne garde AUCUN e-mail : l'identifiant, la date d'envoi et
-- l'activité relevée. `ON DELETE CASCADE` : la trace part avec le compte
-- (décision `cascade` de `scripts/check-erasure-coverage.mjs`).
--
-- Droits : `service_role` seul. RLS activée sans policy, `EXECUTE` révoqué
-- nommément à `anon` et `authenticated` (REVOKE FROM PUBLIC ne les retire
-- pas : ACL par défaut du schéma `public`).
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.account_inactivity_notices (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  warned_at   timestamptz NOT NULL DEFAULT now(),
  activity_at timestamptz NOT NULL
);

COMMENT ON TABLE public.account_inactivity_notices IS
  'C-121 : avertissement de suppression pour inactivite (3 ans), un par compte. Ecrit APRES l envoi. Aucun e-mail stocke.';

ALTER TABLE public.account_inactivity_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_inactivity_notices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_inactivity_notices TO service_role;

-- Un compte qui paie n'est jamais supprimé pour inactivité.
CREATE OR REPLACE FUNCTION public.account_has_live_billing(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = p_user
              AND s.status IN ('active', 'past_due', 'trialing')
         )
      OR EXISTS (
           SELECT 1
             FROM public.organizations o
             JOIN public.org_subscriptions os ON os.org_id = o.id
            WHERE o.owner_id = p_user
              -- ⚠️ Une organisation GRATUITE a aussi une ligne `active`
              -- (défaut de la colonne) : sans ce filtre, tout propriétaire
              -- d'organisation serait tenu pour client.
              AND os.tier_key <> 'free'
              AND os.status IN ('active', 'past_due')
         );
$$;

-- Activité de chaque compte susceptible d'être averti.
CREATE OR REPLACE FUNCTION public.account_activity()
RETURNS TABLE (user_id uuid, email text, activity_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id,
         u.email::text,
         greatest(u.last_sign_in_at, p.last_seen_at, u.created_at)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE u.email IS NOT NULL
     AND u.deleted_at IS NULL
     AND COALESCE(u.is_anonymous, false) = false
     AND (u.banned_until IS NULL OR u.banned_until < now());
$$;

-- Qui avertir aujourd'hui : inactif depuis 3 ans, jamais averti DEPUIS sa
-- dernière activité, ne payant pas. Plus ancien d'abord, borné par appel.
CREATE OR REPLACE FUNCTION public.accounts_due_for_inactivity_notice(p_limit integer DEFAULT 50)
RETURNS TABLE (user_id uuid, email text, activity_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.user_id, a.email, a.activity_at
    FROM public.account_activity() a
   WHERE a.activity_at < now() - interval '3 years'
     AND NOT EXISTS (
           SELECT 1 FROM public.account_inactivity_notices n
            WHERE n.user_id = a.user_id
              AND n.warned_at > a.activity_at
         )
     AND NOT public.account_has_live_billing(a.user_id)
   ORDER BY a.activity_at
   LIMIT greatest(least(COALESCE(p_limit, 50), 200), 0);
$$;

-- Un compte précis est-il dû à l'effacement ? C'est la question que
-- `delete-account` pose AVANT d'effacer en mode cron : même un secret volé ne
-- peut effacer qu'un compte déjà averti depuis 30 jours et resté absent.
CREATE OR REPLACE FUNCTION public.account_inactivity_deletion_due(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.account_inactivity_notices n
      JOIN public.account_activity() a ON a.user_id = n.user_id
     WHERE n.user_id = p_user
       AND n.warned_at <= now() - interval '30 days'
       AND a.activity_at <= n.activity_at
       AND a.activity_at < now() - interval '3 years'
       AND NOT public.account_has_live_billing(p_user)
  );
$$;

CREATE OR REPLACE FUNCTION public.accounts_due_for_inactivity_deletion(p_limit integer DEFAULT 20)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT n.user_id
    FROM public.account_inactivity_notices n
   WHERE public.account_inactivity_deletion_due(n.user_id)
   ORDER BY n.warned_at
   LIMIT greatest(least(COALESCE(p_limit, 20), 100), 0);
$$;

REVOKE EXECUTE ON FUNCTION public.account_has_live_billing(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.account_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accounts_due_for_inactivity_notice(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.account_inactivity_deletion_due(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accounts_due_for_inactivity_deletion(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.account_has_live_billing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.account_activity() TO service_role;
GRANT EXECUTE ON FUNCTION public.accounts_due_for_inactivity_notice(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.account_inactivity_deletion_due(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accounts_due_for_inactivity_deletion(integer) TO service_role;
