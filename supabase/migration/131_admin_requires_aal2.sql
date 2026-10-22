-- ═══════════════════════════════════════════════════════════════════
-- Migration 131 — `/admin` exige une session à double facteur (aal2)
--
-- CONSTAT (T-06 (b) de docs/ROADMAP-60J.md)
-- La 2FA posée le 2026-08-29 protège la CONSOLE Supabase d'Axel. Elle ne
-- protège pas le compte APPLICATIF : `get_admin_stats()` n'exige rien de
-- plus qu'une session valide d'un compte présent dans `admin_users`. Or
-- cette RPC rend toute la volumétrie business du produit (comptes, canaux
-- d'acquisition, rétention, orgs). Un mot de passe volé la rend lisible.
--
-- CE QUE FAIT CETTE MIGRATION
-- Elle sépare deux questions qui étaient confondues sous un seul nom :
--
--   public.admin_allowlisted()  — « ce compte est-il dans admin_users ? »
--                                 Question d'AFFICHAGE. C'est elle que le
--                                 client interroge pour montrer l'entrée
--                                 « Stats COSMO » et l'écran d'enrôlement.
--
--   public.is_admin()           — « cette REQUÊTE est-elle autorisée ? »
--                                 GARDE. Allowlist ET session aal2.
--
-- `is_admin()` garde son nom et sa signature exprès : `get_admin_stats()`
-- (mig. 099) l'appelle déjà, et n'a pas à être réécrite. Réécrire son corps
-- de 200 lignes pour y insérer deux lignes de garde, c'est prendre le risque
-- d'une erreur de transcription sur la fonction la plus longue du dépôt,
-- pour un gain nul.
--
-- POURQUOI LE NIVEAU D'ASSURANCE, ET PAS « A-T-IL UN FACTEUR »
-- `aal2` n'est pas « ce compte a activé la 2FA », c'est « CETTE session a
-- présenté le second facteur ». Un compte enrôlé dont on vole le mot de
-- passe ouvre une session aal1 : elle ne passe pas cette garde. C'est toute
-- la différence entre vérifier un réglage et vérifier une preuve.
--
-- La claim est posée par GoTrue dans le JWT, jamais par le client : elle
-- n'est pas falsifiable sans la clé de signature du projet.
--
-- ⚠️ ORDRE D'APPLICATION — dans le bon sens, il n'y a AUCUNE fenêtre
--   1. déployer le front (l'écran d'enrôlement apparaît sur `/admin`) ;
--   2. enrôler un authentificateur, la session passe `aal2` ;
--   3. appliquer cette migration.
-- L'enrôlement TOTP ne dépend pas de cette migration : il passe par l'API MFA
-- de GoTrue et par `admin_allowlisted()`. Appliquée AVANT l'étape 2, la
-- migration coupe simplement les statistiques jusqu'au premier code vérifié —
-- gênant, jamais bloquant, l'écran d'enrôlement restant atteignable.
--
-- 🔑 SI LE TÉLÉPHONE EST PERDU : le facteur se supprime depuis le SQL
-- editor (rôle `service_role`, qui ne passe par aucune de ces fonctions) :
--   DELETE FROM auth.mfa_factors WHERE user_id = '<uid>';
-- La session redevient aal1, l'écran d'enrôlement reparaît. Pas de
-- verrouillage définitif, donc pas de codes de récupération à stocker.
--
-- Idempotente / re-jouable. Aucune donnée touchée.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. La question d'affichage ──────────────────────────────────────
-- Corps repris tel quel de l'ancienne `is_admin()` (mig. 056).
CREATE OR REPLACE FUNCTION public.admin_allowlisted()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.admin_allowlisted() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_allowlisted() TO authenticated;

COMMENT ON FUNCTION public.admin_allowlisted() IS
  'Ce compte est-il dans admin_users ? Question d''AFFICHAGE, pas une garde : '
  'elle ignore volontairement le niveau d''assurance de la session, pour que '
  'l''écran d''enrôlement TOTP reste atteignable avant tout second facteur. '
  'La garde est is_admin() (mig. 131).';

-- ── 2. La garde ─────────────────────────────────────────────────────
-- `aal` absente = session historique ou jeton sans la claim : traitée
-- comme aal1. Une garde ne se relâche jamais sur une valeur manquante.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.admin_allowlisted()
     AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'GARDE des surfaces admin (mig. 131) : compte dans admin_users ET session '
  'ayant présenté un second facteur (aal2). Renvoie donc false pour un admin '
  'connecté par mot de passe seul — c''est l''objet de la migration. Pour '
  'savoir si un compte est admin sans juger sa session : admin_allowlisted().';

COMMIT;

-- ─── Vérification après application ─────────────────────────────────
--
-- 1. Les deux fonctions existent et sont exécutables par `authenticated` :
--
--    SELECT p.proname,
--           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS exec_auth,
--           has_function_privilege('anon',          p.oid, 'EXECUTE') AS exec_anon
--    FROM pg_proc p
--    JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname IN ('is_admin', 'admin_allowlisted');
--    -- attendu : 2 lignes, exec_auth = true, exec_anon = false
--
-- 2. Depuis l'application, connecté en admin SANS second facteur :
--
--    SELECT public.admin_allowlisted();  -- attendu : true
--    SELECT public.is_admin();           -- attendu : FALSE  (c'était true)
--    SELECT public.get_admin_stats();    -- attendu : 42501 forbidden
--
-- 3. Après enrôlement TOTP et vérification du code (session passée aal2) :
--
--    SELECT auth.jwt() ->> 'aal';        -- attendu : 'aal2'
--    SELECT public.is_admin();           -- attendu : true
--    SELECT public.get_admin_stats();    -- attendu : le jsonb complet
--
-- 4. Depuis un compte NON admin, avec ou sans second facteur :
--
--    SELECT public.admin_allowlisted();  -- attendu : false
--    SELECT public.is_admin();           -- attendu : false
--    -- inchangé par cette migration.
