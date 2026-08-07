-- ═══════════════════════════════════════════════════════════════════
-- 088 — Suppression de `profiles_avatar_backup_084`
--
-- La 084 (AUD-03) posait une allowlist d'hôte et une borne de taille sur
-- `profiles.avatar_url`, avec un filet : sauvegarder les valeurs qui seraient
-- neutralisées. En pratique le filet est resté VIDE — les 12 avatars en base
-- étaient tous conformes, aucune donnée n'a été perdue.
--
-- La table est référencée par la `LEGACY_ALLOWLIST` de
-- `scripts/check-prod-drift.mjs`, qui renvoie vers « mig. 088 » : ce fichier
-- est cette migration, absente jusqu'ici (trou de numérotation entre 087
-- et 089).
--
-- Conditions de suppression, vérifiées en production le 2026-08-08 :
--   - `SELECT count(*) FROM profiles_avatar_backup_084` → 0
--   - contrainte `profiles_avatar_url_valid` active, trigger posé
--   - `is_allowed_avatar_url` rejette les 6 charges d'attaque du rapport
--     (balise distante, downgrade http://, suffixe supabase.co.evil.tld,
--     javascript:, data:text/html, hôte arbitraire) et accepte les 3 formes
--     légitimes (Storage, avatar Google, data:image hérité)
--   - les 12 `avatar_url` restants sont tous conformes (max 12 399 car.)
--
-- Le nouveau flux (upload vers le bucket `avatars`) est donc validé : le filet
-- n'a plus de raison d'être, et une table vide portant un nom de sauvegarde
-- de données personnelles est une dette de conservation inutile
-- (RGPD art. 5.1.e).
--
-- Le `IF EXISTS` rend la migration rejouable et sans effet sur un
-- environnement neuf, où la table n'a jamais existé.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles_avatar_backup_084') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles_avatar_backup_084) THEN
    RAISE EXCEPTION
      'profiles_avatar_backup_084 n''est pas vide — restaurer les avatars avant de supprimer';
  END IF;
END $$;

DROP TABLE IF EXISTS public.profiles_avatar_backup_084;

COMMIT;
