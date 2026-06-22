-- ═══════════════════════════════════════════════════════════════════
-- 050_resolve_profiles_by_emails_batch.sql — RPC batch de résolution email→uid
--
-- Pourquoi : audit perf — `friends.getAll()` appelait `resolve_profile_by_email`
-- UNE FOIS PAR AMI non résolu (N+1 réseau via PostgREST). Cette RPC résout N
-- emails en UN aller-retour.
--
-- Calquée à l'identique sur `resolve_profile_by_email` (mig. friends) :
-- SECURITY DEFINER, auth.uid() requis, scoping `public.profiles`, search_path
-- verrouillé. Cap défensif à 1000 emails/appel (anti-abus). Mêmes droits
-- (authenticated + service_role ; PUBLIC révoqué).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_profiles_by_emails(p_emails text[])
  RETURNS TABLE(email text, id uuid)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT lower(e) AS email, pr.id
  FROM unnest(p_emails[1:1000]) AS e
  JOIN public.profiles pr ON lower(pr.email) = lower(e)
  WHERE e IS NOT NULL AND length(e) > 0 AND length(e) <= 320;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_profiles_by_emails(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profiles_by_emails(text[]) TO authenticated, service_role;
