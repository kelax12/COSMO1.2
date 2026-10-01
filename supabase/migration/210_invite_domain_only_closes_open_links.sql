-- ═══════════════════════════════════════════════════════════════════
-- 210 · « Domaine vérifié seulement » ferme aussi les liens ouverts
--       (finding G-3, décision d'Axel du 2026-10-01)
--
-- 🔴 `invite_domain_only` (mig. 195) ne comparait que l'adresse ÉCRITE dans
-- un lien nominatif. Un lien ouvert (`email IS NULL`) passait, « rien à
-- comparer » : un admin qui cochait l'option pouvait croire son organisation
-- fermée, alors qu'un lien ouvert l'ouvrait à n'importe quelle adresse.
--
-- Décision d'Axel : tant que l'option est active, un lien ouvert ne se crée
-- pas ET ne se réclame pas. Deux étages, parce qu'un lien créé AVANT
-- l'activation de l'option existe déjà en base :
--   1. `enforce_org_invite_domain` (trigger BEFORE INSERT, INVOKER, la règle
--      B-3 tient) refuse la création : `open_link_not_allowed`.
--   2. `claim_org_invite` refuse la réclamation d'un lien ouvert, avec le même
--      identifiant. Désactiver l'option rend ces liens à nouveau utilisables :
--      c'est le réglage qui décide, pas une purge.
--
-- ⚠️ Ce que cette migration ne règle PAS : G-2. Sans confirmation d'adresse,
-- `auth.email()` est une adresse DÉCLARÉE ; un lien nominatif transféré ou
-- fuité reste réclamable par qui inscrit l'adresse avant son propriétaire.
-- Le code d'accès (`request_join_organization`) n'est pas touché non plus :
-- il crée une DEMANDE qu'un admin accepte à la main.
--
-- ⚠️ Les deux refus du trigger passent de `42501` à `P0001` (le défaut de
-- `RAISE EXCEPTION`). Mesuré le 2026-10-01 : `normalizeApiError` laisse gagner
-- un code SQL déjà connu sur l'identifiant métier, et `42501` y vaut « Vous
-- n'avez pas les droits nécessaires ». Le message `email_domain_not_allowed` de
-- la mig. 195 n'a donc JAMAIS atteint l'écran. En `P0001`, l'identifiant est
-- promu et le catalogue rend la phrase (témoin : `normalizeApiError.test.ts`).
--
-- Corps relus en production le 2026-10-01 (`pg_get_functiondef`, mig. 195
-- et 194/161) ; seules les lignes marquées « mig. 210 » changent.
-- Preuve : `supabase/proofs/208-210.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_org_invite_domain()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.email IS NULL THEN
    -- Mig. 210 : un lien ouvert ne porte pas d'adresse, donc aucun domaine à
    -- vérifier. Quand l'organisation n'accepte que ses domaines, il est refusé.
    IF EXISTS (SELECT 1 FROM public.org_settings s WHERE s.org_id = NEW.org_id AND s.invite_domain_only) THEN
      RAISE EXCEPTION 'open_link_not_allowed';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.org_settings s WHERE s.org_id = NEW.org_id AND s.invite_domain_only)
     AND NOT EXISTS (
       SELECT 1 FROM public.org_verified_domains d
        WHERE d.org_id = NEW.org_id
          AND d.verified_at IS NOT NULL
          AND d.domain = lower(split_part(NEW.email, '@', 2))
     ) THEN
    RAISE EXCEPTION 'email_domain_not_allowed';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_org_invite_domain() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_org_invite(p_token uuid)
 RETURNS TABLE(org_id uuid, org_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_link public.org_invite_links;
  v_org public.organizations;
  v_creator_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.org_invite_links WHERE id = p_token FOR UPDATE;

  IF NOT FOUND OR v_link.claimed_at IS NOT NULL OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF v_link.created_by = auth.uid() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  -- NOUVEAU (mig. 161) : un lien nominatif ne sert qu'à son destinataire.
  -- Même erreur générique que les autres refus : ne pas confirmer à un tiers
  -- que ce jeton existe.
  IF v_link.email IS NOT NULL AND lower(COALESCE(auth.email(), '')) <> lower(v_link.email) THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  -- Mig. 210 : un lien ouvert créé AVANT l'activation de « domaine vérifié
  -- seulement » ne se réclame plus tant que l'option est active.
  IF v_link.email IS NULL AND EXISTS (
    SELECT 1 FROM public.org_settings s WHERE s.org_id = v_link.org_id AND s.invite_domain_only
  ) THEN
    RAISE EXCEPTION 'open_link_not_allowed';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = v_link.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE public.organization_members.org_id = v_link.org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this organization';
  END IF;

  IF v_link.manager_id IS NULL THEN
    v_creator_ok := EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.created_by AND m.role = 'admin'
    );
  ELSE
    v_creator_ok := EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.created_by
        AND (
          m.role = 'admin'
          OR (
            public.has_subordinates(v_link.org_id, v_link.created_by)
            AND (
              v_link.manager_id = v_link.created_by
              OR v_link.manager_id IN (SELECT public.get_subtree(v_link.org_id, v_link.created_by))
            )
          )
        )
    );
  END IF;
  IF NOT v_creator_ok THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF NOT public.org_seats_allowed(v_link.org_id) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  INSERT INTO public.organization_members (org_id, user_id, role, manager_id, access_expires_at)
  VALUES (
    v_link.org_id,
    auth.uid(),
    'member',
    CASE WHEN v_link.manager_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.manager_id
    ) THEN v_link.manager_id ELSE NULL END,
    CASE WHEN v_link.access_days IS NULL THEN NULL
         ELSE now() + make_interval(days => v_link.access_days) END
  );

  -- Équipes prévues par l'invitation (celles qui existent encore).
  INSERT INTO public.org_team_members (team_id, org_id, user_id)
    SELECT t.id, v_link.org_id, auth.uid()
      FROM public.org_teams t
     WHERE t.org_id = v_link.org_id AND t.id = ANY (v_link.team_ids)
  ON CONFLICT DO NOTHING;

  UPDATE public.org_invite_links
  SET claimed_at = NOW(), claimed_by = auth.uid()
  WHERE id = p_token;

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN QUERY SELECT v_org.id, v_org.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_org_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_org_invite(uuid) TO authenticated;
