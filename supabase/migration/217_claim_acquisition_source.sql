-- ═══════════════════════════════════════════════════════════════════
-- 217 · La source d'acquisition survit à une inscription Google
-- ═══════════════════════════════════════════════════════════════════
--
-- 🔴 SYMPTÔME (mesuré le 2026-10-10) : 35 comptes, AUCUN `acquisition_source`
-- renseigné, et 6 des 7 inscriptions des 30 derniers jours passent par Google.
--
-- CAUSE : la source first-touch (`?ref=`, src/lib/attribution.ts) ne voyage
-- qu'en metadata de `signUp` (mig. 097). `signInWithOAuth` n'a pas d'équivalent :
-- la ligne `profiles` d'un compte Google naît donc toujours sans source, et
-- rien ne la complète ensuite. La colonne n'est pas modifiable par le client
-- (privilège UPDATE limité à `display_name` / `avatar_url`), c'est voulu.
--
-- CORRECTIF : une RPC qui inscrit la source UNE fois, pour l'appelant seul,
-- et seulement :
--   - si son profil n'en a pas déjà une (first-touch : jamais écrasée) ;
--   - si son compte a moins d'une heure (sinon un compte ancien pourrait
--     s'attribuer après coup à une campagne qui ne l'a pas amené) ;
--   - si la valeur passe la même whitelist que le trigger de la mig. 097.
-- Le client l'appelle à l'ouverture de session d'un compte neuf. Pour une
-- inscription par e-mail, le trigger a déjà posé la source : no-op.
--
-- SECURITY DEFINER parce que la colonne est fermée au client ; le périmètre
-- vient de `auth.uid()` seul, aucun argument ne désigne une ligne.
-- Renvoie TRUE si une ligne a été écrite.
-- Preuve jouée avant application : supabase/proofs/217.proof.sql.

CREATE OR REPLACE FUNCTION public.claim_acquisition_source(
  p_source   text,
  p_campaign text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c_re       CONSTANT text := '^[a-z0-9_-]{1,40}$';
  v_uid      uuid := auth.uid();
  v_campaign text := p_campaign;
  v_count    int;
BEGIN
  IF v_uid IS NULL OR p_source IS NULL OR p_source !~ c_re THEN
    RETURN false;
  END IF;
  IF v_campaign IS NOT NULL AND v_campaign !~ c_re THEN
    v_campaign := NULL;
  END IF;

  UPDATE public.profiles p
     SET acquisition_source   = p_source,
         acquisition_campaign = v_campaign
   WHERE p.id = v_uid
     AND p.acquisition_source IS NULL
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = v_uid
          AND u.created_at > now() - interval '1 hour'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_acquisition_source(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_acquisition_source(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_acquisition_source(text, text) TO authenticated;

COMMENT ON FUNCTION public.claim_acquisition_source(text, text) IS
  'Inscrit la source first-touch d''un compte neuf (< 1 h) qui n''en a pas, typiquement après une inscription Google. Mig. 217.';
