-- ═══════════════════════════════════════════════════════════════════
-- 264 · le bucket `avatars` ne se LISTE plus sans compte
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- La mig. 084 pose `avatars_public_read`, une policy SELECT sur
-- `storage.objects` sans rôle (donc `anon` compris), bornée au seul bucket.
-- Sur `storage.objects`, une policy SELECT ne sert pas à AFFICHER une image
-- d'un bucket public (l'URL publique est servie sans passer par la RLS) :
-- elle sert à LISTER. Sans compte, on énumère le bucket, et chaque dossier
-- porte l'UUID d'un compte (`<uid>/avatar.jpg`) : la liste des comptes qui
-- ont une photo. Écrite en 209 sur une branche jamais fusionnée ; le numéro
-- a été pris depuis, d'où le 264.
--
-- ── CE QUI CHANGE ──────────────────────────────────────────────────
--
-- `avatars_public_read` est retirée, remplacée par `avatars_owner_read` :
-- lecture réservée à `authenticated`, dans le seul dossier de l'appelant.
-- Elle reste NÉCESSAIRE : `upload(…, { upsert: true })`
-- (`src/lib/avatar-upload.ts`) relit l'objet existant avant de l'écraser.
--
-- Inchangés : l'affichage (URL publique), l'écriture et la suppression
-- limitées au dossier de l'appelant (mig. 084), `delete-account`, qui passe
-- par le rôle de service.
--
-- Retour arrière : supprimer `avatars_owner_read`, puis recréer la policy de
-- lecture de la mig. 084 § avatars à l'identique (pas recopiée ici :
-- `check:rls` lit les commentaires et y verrait une policy vivante).
--
-- ── ORDRE ──────────────────────────────────────────────────────────
--
-- Aucun code ne liste le bucket : sans risque avant comme après le front.
-- Après application, changer SA photo dans les réglages (chemin `upsert`)
-- avant de déclarer la migration vérifiée.
--
-- Rejouable. Preuve : `supabase/proofs/264.proof.sql`.
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
