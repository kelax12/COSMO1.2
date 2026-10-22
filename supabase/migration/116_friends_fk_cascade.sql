-- ═══════════════════════════════════════════════════════════════════
-- Migration 116 — `friends.friend_user_id` : SET NULL → CASCADE
--
-- CONTEXTE. Le dépôt et la production divergeaient sur la sémantique
-- d'effacement d'une table qui porte des données personnelles en clair.
--
--   dépôt (mig. 007_out_of_band_columns) : ON DELETE CASCADE
--   production (vérifié sur pg_constraint, 2026-08-24) : ON DELETE SET NULL
--
-- La mig. 007 ne pouvait pas corriger cet écart : elle est écrite en
-- `ADD COLUMN IF NOT EXISTS`, et la colonne existait déjà en prod (créée à la
-- main, avant la convention `NNN_*.sql`). La contrainte déclarée dans le
-- dépôt n'a donc JAMAIS été appliquée. Un replay des migrations sur base
-- vierge produisait une base qui s'efface différemment de la vraie.
--
-- POURQUOI CASCADE EST LA BONNE SÉMANTIQUE, ET PAS L'INVERSE.
-- Une ligne de `friends` porte `name`, `email` et `avatar` de l'ami, EN CLAIR,
-- dans les données de l'autre utilisateur. Quand l'ami supprime son compte :
--
--   • SET NULL  → la ligne SURVIT. Le lien est coupé, mais l'email et le nom
--                 restent, et la ligne devient introuvable par identifiant.
--                 C'est une violation de l'article 17 (droit à l'effacement),
--                 et elle est indétectable une fois le lien coupé.
--   • CASCADE   → la ligne disparaît. C'est ce que le RGPD demande.
--
-- ⚠️ Ce n'est PAS le seul rempart, et ce n'est plus le rempart principal :
-- `delete-account` purge désormais `friends` explicitement sur ses DEUX
-- colonnes (`.or('user_id.eq.X,friend_user_id.eq.X')`), et une garde bloque
-- toute régression (`src/rgpd-erasure.guard.test.ts`). Cette migration est
-- de la DÉFENSE EN PROFONDEUR : elle couvre les suppressions qui ne passent
-- pas par la Edge Function (suppression depuis le dashboard Supabase, purge
-- administrative, script de maintenance).
--
-- EFFET SUR LES DONNÉES EXISTANTES : AUCUN. Vérifié en prod le 2026-08-24 :
-- 11 lignes, 0 avec `friend_user_id IS NULL`. La contrainte est simplement
-- redéfinie ; aucune ligne n'est supprimée par cette migration.
-- ═══════════════════════════════════════════════════════════════════

-- Idempotent : on ne recrée la contrainte que si elle n'est pas DÉJÀ en
-- CASCADE. `confdeltype` vaut 'c' pour CASCADE, 'n' pour SET NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.friends'::regclass
       AND conname  = 'friends_friend_user_id_fkey'
       AND confdeltype <> 'c'
  ) THEN
    ALTER TABLE public.friends
      DROP CONSTRAINT friends_friend_user_id_fkey;

    ALTER TABLE public.friends
      ADD CONSTRAINT friends_friend_user_id_fkey
      FOREIGN KEY (friend_user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;

    RAISE NOTICE 'friends_friend_user_id_fkey : SET NULL -> CASCADE';

  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.friends'::regclass
       AND conname  = 'friends_friend_user_id_fkey'
  ) THEN
    -- Base reconstruite depuis zéro : la mig. 007 a bien posé la colonne ET
    -- la contrainte. Rien à faire, mais on le dit plutôt que de rester muet.
    RAISE NOTICE 'friends_friend_user_id_fkey absente — rien a corriger';

  ELSE
    RAISE NOTICE 'friends_friend_user_id_fkey deja en CASCADE — no-op';
  END IF;
END $$;

COMMENT ON COLUMN public.friends.friend_user_id IS
  'auth.users.id de l ami (identite reelle, distincte de la ligne friends). '
  'ON DELETE CASCADE depuis la mig. 116 : la ligne porte le nom et l email de '
  'l ami en clair, SET NULL la laissait survivre a son effacement (RGPD art. 17).';

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.friends'::regclass and contype = 'f';
--
--   Attendu : friends_friend_user_id_fkey ... ON DELETE CASCADE
--             friends_user_id_fkey        ... ON DELETE CASCADE
--
--   select count(*) from public.friends;   -- doit etre inchange (11 au 2026-08-24)
