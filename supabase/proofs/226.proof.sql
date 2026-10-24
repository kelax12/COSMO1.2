-- Preuve de la mig. 226 (C-121, comptes inactifs depuis 3 ans).
--
-- Même forme que 208-210 et 217 : un seul bloc `DO`, toujours terminé par
-- `RAISE EXCEPTION`, qui applique lui-même la migration.
--   Passe normale : « PREUVE-ANNULEE 0 ECHEC | … »
--   Passe TÉMOIN  : précéder de `SELECT set_config('proof.skip_migration', 'on', false);`
--                   les fonctions n'existent pas, la preuve DOIT échouer.
--
-- Acteurs (tous créés dans la transaction annulée) :
--   I  inactif depuis 4 ans, gratuit                    → averti, puis effaçable à J+30
--   H  connecté il y a 4 ans MAIS vu hier (last_seen)   → JAMAIS visé (TÉMOIN)
--   R  connecté hier                                    → JAMAIS visé (TÉMOIN)
--   P  inactif 4 ans, propriétaire d'une org PAYANTE    → jamais visé
--   F  inactif 4 ans, propriétaire d'une org GRATUITE   → averti (une org gratuite n'est pas un client)
--   B  inactif 4 ans, revenu APRÈS l'avertissement      → plus effaçable

DO $proof$
DECLARE
  r  text[] := '{}';
  ko int := 0;
  I constant uuid := '00000000-0000-0000-0000-0000000a0226';
  H constant uuid := '00000000-0000-0000-0000-0000000b0226';
  R_ constant uuid := '00000000-0000-0000-0000-0000000c0226';
  P constant uuid := '00000000-0000-0000-0000-0000000d0226';
  F constant uuid := '00000000-0000-0000-0000-0000000e0226';
  B constant uuid := '00000000-0000-0000-0000-0000000f0226';
  OP constant uuid := '10000000-0000-0000-0000-0000000d0226';
  OFR constant uuid := '10000000-0000-0000-0000-0000000e0226';
  old timestamptz := now() - interval '4 years';
  skip boolean := coalesce(current_setting('proof.skip_migration', true), '') = 'on';
  due uuid[];
  flag boolean;
BEGIN
  IF NOT skip THEN
    EXECUTE $mig$
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
$mig$;
  END IF;

  INSERT INTO auth.users(id, email, created_at, last_sign_in_at) VALUES
    (I,  'i@proof226.test', old, old),
    (H,  'h@proof226.test', old, old),
    (R_, 'r@proof226.test', old, now() - interval '1 day'),
    (P,  'p@proof226.test', old, old),
    (F,  'f@proof226.test', old, old),
    (B,  'b@proof226.test', old, old);
  INSERT INTO public.profiles(id, email) SELECT id, email FROM auth.users
   WHERE id IN (I, H, R_, P, F, B) ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET last_seen_at = NULL WHERE id IN (I, R_, P, F, B);
  UPDATE public.profiles SET last_seen_at = now() - interval '1 day' WHERE id = H;
  INSERT INTO public.organizations(id, name, join_code, owner_id) VALUES
    (OP, 'Payante', 'P226', P), (OFR, 'Gratuite', 'F226', F);
  INSERT INTO public.org_subscriptions(org_id, tier_key, status) VALUES (OP, 't10', 'active')
    ON CONFLICT (org_id) DO UPDATE SET tier_key = 't10', status = 'active';
  INSERT INTO public.org_subscriptions(org_id, tier_key, status) VALUES (OFR, 'free', 'active')
    ON CONFLICT (org_id) DO UPDATE SET tier_key = 'free', status = 'active';

  SELECT array_agg(d.user_id) INTO due FROM public.accounts_due_for_inactivity_notice(200) d
   WHERE d.user_id IN (I, H, R_, P, F, B);
  due := coalesce(due, '{}');

  IF I = ANY(due) THEN r := r || '01 ok inactif averti'::text; ELSE ko := ko + 1; r := r || '01 KO inactif non averti'::text; END IF;
  IF NOT H = ANY(due) THEN r := r || '02 ok vu hier jamais vise'::text; ELSE ko := ko + 1; r := r || '02 KO vu hier VISE'::text; END IF;
  IF NOT R_ = ANY(due) THEN r := r || '03 ok connecte hier jamais vise'::text; ELSE ko := ko + 1; r := r || '03 KO connecte hier VISE'::text; END IF;
  IF NOT P = ANY(due) THEN r := r || '04 ok client epargne'::text; ELSE ko := ko + 1; r := r || '04 KO client vise'::text; END IF;
  IF F = ANY(due) THEN r := r || '05 ok org gratuite avertie'::text; ELSE ko := ko + 1; r := r || '05 KO org gratuite tenue pour client'::text; END IF;

  -- Avertissement d'il y a 10 jours : pas encore effaçable.
  INSERT INTO public.account_inactivity_notices(user_id, warned_at, activity_at) VALUES (I, now() - interval '10 days', old);
  flag := public.account_inactivity_deletion_due(I);
  IF NOT flag THEN r := r || '06 ok J+10 non effacable'::text; ELSE ko := ko + 1; r := r || '06 KO efface avant 30 j'::text; END IF;

  -- Averti : I sort de la liste à avertir.
  IF NOT EXISTS (SELECT 1 FROM public.accounts_due_for_inactivity_notice(200) d WHERE d.user_id = I)
    THEN r := r || '07 ok pas averti deux fois'::text; ELSE ko := ko + 1; r := r || '07 KO averti deux fois'::text; END IF;

  -- J+31 : effaçable.
  UPDATE public.account_inactivity_notices SET warned_at = now() - interval '31 days' WHERE user_id = I;
  flag := public.account_inactivity_deletion_due(I);
  IF flag THEN r := r || '08 ok J+31 effacable'::text; ELSE ko := ko + 1; r := r || '08 KO J+31 non effacable'::text; END IF;
  IF EXISTS (SELECT 1 FROM public.accounts_due_for_inactivity_deletion(100) d WHERE d.user_id = I)
    THEN r := r || '09 ok liste effacement'::text; ELSE ko := ko + 1; r := r || '09 KO absent de la liste'::text; END IF;

  -- B averti il y a 31 jours, puis revenu une fois : plus effaçable.
  INSERT INTO public.account_inactivity_notices(user_id, warned_at, activity_at) VALUES (B, now() - interval '31 days', old);
  UPDATE public.profiles SET last_seen_at = now() - interval '2 days' WHERE id = B;
  flag := public.account_inactivity_deletion_due(B);
  IF NOT flag THEN r := r || '10 ok revenu apres avertissement epargne'::text; ELSE ko := ko + 1; r := r || '10 KO revenu mais efface'::text; END IF;

  -- Sans avertissement, jamais effaçable.
  IF NOT public.account_inactivity_deletion_due(P) AND NOT public.account_inactivity_deletion_due(H)
     AND NOT public.account_inactivity_deletion_due(F)
    THEN r := r || '11 ok jamais sans avertissement'::text; ELSE ko := ko + 1; r := r || '11 KO effacable sans avertissement'::text; END IF;

  -- Droits : service_role seul.
  IF NOT has_function_privilege('anon', 'public.accounts_due_for_inactivity_notice(integer)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.accounts_due_for_inactivity_notice(integer)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.account_inactivity_deletion_due(uuid)', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.account_activity()', 'EXECUTE')
     AND NOT has_function_privilege('authenticated', 'public.account_has_live_billing(uuid)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.accounts_due_for_inactivity_deletion(integer)', 'EXECUTE')
     AND has_function_privilege('service_role', 'public.account_inactivity_deletion_due(uuid)', 'EXECUTE')
     AND has_function_privilege('service_role', 'public.accounts_due_for_inactivity_notice(integer)', 'EXECUTE')
    THEN r := r || '12 ok execute service_role seul'::text; ELSE ko := ko + 1; r := r || '12 KO droits'::text; END IF;
  IF NOT has_table_privilege('authenticated', 'public.account_inactivity_notices', 'SELECT')
     AND NOT has_table_privilege('anon', 'public.account_inactivity_notices', 'SELECT')
     AND has_table_privilege('service_role', 'public.account_inactivity_notices', 'INSERT')
    THEN r := r || '13 ok table fermee'::text; ELSE ko := ko + 1; r := r || '13 KO droits table'::text; END IF;

  -- La trace part avec le compte.
  DELETE FROM auth.users WHERE id = I;
  IF NOT EXISTS (SELECT 1 FROM public.account_inactivity_notices WHERE user_id = I)
    THEN r := r || '14 ok trace effacee avec le compte'::text; ELSE ko := ko + 1; r := r || '14 KO trace survit'::text; END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END
$proof$;
