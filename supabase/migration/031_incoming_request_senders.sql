-- ═══════════════════════════════════════════════════════════════════
-- Migration 031 — Avatar / nom des expéditeurs de demandes d'amis
--
-- Contexte : depuis le durcissement N12 (migration 022), la policy SELECT
-- sur `profiles` n'expose un profil qu'à son propriétaire et aux amis
-- CONFIRMÉS. Or l'expéditeur d'une demande d'ami EN ATTENTE n'est, par
-- définition, pas encore un ami confirmé → son `avatar_url` / `display_name`
-- est illisible côté destinataire. La boîte de réception affichait donc une
-- icône générique au lieu de la photo de profil de l'expéditeur.
--
-- Fix : RPC SECURITY DEFINER `get_incoming_request_senders()` qui renvoie
-- l'avatar + le nom des expéditeurs, MAIS uniquement pour les demandes
-- `pending` adressées au caller (`receiver_id = auth.uid()`). Ce n'est PAS
-- un vecteur d'énumération : le caller ne peut voir que les profils de gens
-- qui l'ont explicitement contacté. Aucun email n'est renvoyé.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_incoming_request_senders()
RETURNS TABLE (request_id UUID, sender_id UUID, avatar_url TEXT, display_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT fr.id, p.id, p.avatar_url, p.display_name
  FROM public.friend_requests fr
  JOIN public.profiles p ON p.id = fr.sender_id
  WHERE fr.receiver_id = auth.uid()
    AND fr.status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.get_incoming_request_senders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_incoming_request_senders() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_incoming_request_senders() TO authenticated;
