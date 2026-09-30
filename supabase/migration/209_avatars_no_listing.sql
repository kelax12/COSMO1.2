-- ═══════════════════════════════════════════════════════════════════
-- 209, le bucket `avatars` ne se LISTE plus
--
-- Audit de sécurité du 2026-09-30. La mig. 084 posait
--   avatars_public_read : FOR SELECT USING (bucket_id = 'avatars')
-- sans rôle, donc pour `anon` aussi. Sur `storage.objects`, une policy SELECT
-- ne sert pas à AFFICHER une image d'un bucket public (l'URL publique est
-- servie sans passer par la RLS) : elle sert à LISTER. N'importe qui, sans
-- compte, pouvait donc énumérer le bucket, et chaque dossier y porte l'UUID
-- d'un compte (`<uid>/avatar.jpg`) : la liste des comptes qui ont une photo.
--
-- Remplacée par une lecture réservée au propriétaire. Elle reste NÉCESSAIRE :
-- `upload(…, { upsert: true })` (`src/lib/avatar-upload.ts`) relit l'objet
-- existant avant de l'écraser, et échouerait sans elle.
--
-- Ce qui ne change pas : l'affichage (URL publique), l'écriture et la
-- suppression limitées au dossier de l'appelant, et `delete-account`, qui
-- passe par le rôle de service.
--
-- Retour arrière : supprimer `avatars_owner_read`, puis recréer la policy
-- `avatars_public_read` de la mig. 084 § avatars, à l'identique (SELECT, sans
-- rôle, USING bucket_id = 'avatars'). Pas recopiée ici en SQL : `check:rls`
-- lit les commentaires, et y verrait une policy vivante.
--
-- ⚠️ NON APPLIQUÉE au 2026-09-30. Après application, changer SA photo dans
--    les réglages (chemin `upsert`) avant de déclarer la migration vérifiée.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

DROP POLICY IF EXISTS "avatars_owner_read" ON storage.objects;
CREATE POLICY "avatars_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ── Vérification après application (lecture seule) ─────────────────
--
--   SELECT policyname, roles, qual FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT';
--   -- attendu : une seule ligne, avatars_owner_read, {authenticated}
--
--   curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/avatars" \
--     -H "apikey: <clé publique>" -H "Content-Type: application/json" \
--     -d '{"prefix":""}'
--   -- attendu : []
