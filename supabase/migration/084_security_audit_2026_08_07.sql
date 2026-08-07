-- ═══════════════════════════════════════════════════════════════════
-- 084 — Correctifs de l'audit de sécurité 2026-08-07
-- Rapport : AUDIT-SECURITE-2026-08-07.md
--
-- AUD-02 (High) Tout membre d'une org pouvait y faire entrer des externes
-- AUD-03 (Med)  profiles.avatar_url écrivable sans validation ni borne
-- AUD-04 (Med)  Bucket Storage `avatars` (l'avatar quitte le JWT)
-- AUD-07 (Low)  expires_at non contraint à l'insertion des liens d'invitation
-- AUD-08 (Low)  Quota d'énumération d'emails contournable en multi-comptes
-- AUD-09 (Low)  Fenêtre de blocage de la télémétrie démo ramenée à 1 minute
-- AUD-14 (Low)  bump_win_streak : incrément atomique du streak Stripe
-- AUD-15 (Info) Fusion des policies PERMISSIVE d'`events` (règle mig. 049)
-- AUD-16 (Info) auth.uid() wrappé dans team_task_comments_insert (mig. 043)
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : cette migration doit être appliquée AVANT (ou en
-- même temps que) le déploiement front. Le front continue de fonctionner sans
-- elle, mais l'upload d'avatar échouera tant que le bucket n'existe pas.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- AUD-02 · Les liens d'invitation d'organisation exigent un privilège réel
-- ═══════════════════════════════════════════════════════════════════
--
-- La policy de la mig. 067 acceptait la branche `manager_id = auth.uid()`,
-- VRAIE POUR N'IMPORTE QUEL MEMBRE — y compris un `role = 'member'` sans le
-- moindre subordonné. Le commentaire d'intention disait « manager posant le
-- lien sous LUI », mais rien ne vérifiait que l'appelant était manager. La
-- re-validation au claim reproduisait exactement la même tautologie
-- (`v_link.manager_id = v_link.created_by`).
--
-- Conséquence : un employé quelconque pouvait générer autant de liens qu'il
-- voulait et faire entrer des comptes externes dans l'entreprise, sans
-- validation admin. Le nouvel arrivant lisait alors, via `shares_org_with`
-- (mig. 071), les profils de TOUS les collègues — nom, avatar et EMAIL.
--
-- Correctif : « être manager » devient une propriété vérifiée (avoir au moins
-- un subordonné), pas une chaîne auto-déclarée.
--
-- On réutilise `public.has_subordinates(p_org, p_user)` de la migration 066 —
-- déjà en place et déjà consommée par `is_org_manager`. Aucun nouvel helper
-- n'est créé : la première version de cette migration en introduisait un
-- (`has_reports`) qui en était le doublon exact, corrigé par la 087.

-- AUD-02 + AUD-07 — la policy porte désormais les deux gardes.
DROP POLICY IF EXISTS "org_invite_links_insert" ON public.org_invite_links;
CREATE POLICY "org_invite_links_insert"
  ON public.org_invite_links FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    -- AUD-07 : `DEFAULT NOW() + 7 days` n'est qu'un défaut ; le client insère
    -- directement dans la table et pouvait fournir expires_at = 2099 (lien
    -- perpétuel). On borne, et on interdit de pré-marquer le lien consommé.
    AND expires_at <= NOW() + INTERVAL '7 days'
    AND claimed_at IS NULL
    AND claimed_by IS NULL
    AND (
      public.is_org_admin(org_id)
      OR (
        manager_id IS NOT NULL
        AND public.has_subordinates(org_id, (SELECT auth.uid()))
        AND (
          manager_id = (SELECT auth.uid())
          OR public.is_above(org_id, manager_id)
        )
      )
    )
  );

-- AUD-07 — même garde sur les liens de partage de tâche (mig. 046).
DROP POLICY IF EXISTS "share_links_insert" ON public.share_links;
CREATE POLICY "share_links_insert"
  ON public.share_links FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND public.owns_task(task_id)
    AND expires_at <= NOW() + INTERVAL '7 days'
  );

-- AUD-02 — re-validation au claim : le créateur doit TOUJOURS avoir le
-- privilège au moment où le lien est consommé (il a pu être rétrogradé).
-- Seule la clause `v_creator_ok` change par rapport à la mig. 067.
CREATE OR REPLACE FUNCTION public.claim_org_invite(p_token UUID)
RETURNS TABLE (org_id UUID, org_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.org_invite_links;
  v_org public.organizations;
  v_creator_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.org_invite_links
  WHERE id = p_token
  FOR UPDATE;

  -- Erreurs génériques : ne pas distinguer inconnu/expiré/consommé.
  IF NOT FOUND OR v_link.claimed_at IS NOT NULL OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF v_link.created_by = auth.uid() THEN
    RAISE EXCEPTION 'invalid_link';
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
          -- AUD-02 : `v_link.manager_id = v_link.created_by` seul était une
          -- tautologie. On exige en plus un privilège hiérarchique réel
          -- (helper has_subordinates, mig. 066).
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

  INSERT INTO public.organization_members (org_id, user_id, role, manager_id)
  VALUES (
    v_link.org_id,
    auth.uid(),
    'member',
    CASE WHEN v_link.manager_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.manager_id
    ) THEN v_link.manager_id ELSE NULL END
  );

  UPDATE public.org_invite_links
  SET claimed_at = NOW(), claimed_by = auth.uid()
  WHERE id = p_token;

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN QUERY SELECT v_org.id, v_org.name;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_org_invite(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_org_invite(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_org_invite(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- AUD-04 · Bucket Storage `avatars`
-- ═══════════════════════════════════════════════════════════════════
--
-- L'avatar était encodé en data URL base64 et écrit dans
-- `auth.user_metadata` — donc EMBARQUÉ DANS LE JWT, renvoyé dans l'en-tête
-- `Authorization` de chaque requête PostgREST (plusieurs dizaines de Ko, au-delà
-- de la limite usuelle des proxys : 431 Request Header Fields Too Large).
--
-- Le bucket est public en lecture (les avatars sont affichés aux amis et
-- co-membres, aucun secret) ; l'écriture est restreinte au dossier dont le nom
-- vaut l'uid de l'appelant.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- `(storage.foldername(name))[1]` = premier segment du chemin, soit l'uid.
-- Un utilisateur ne peut donc écrire que sous `<son uid>/…`.
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ═══════════════════════════════════════════════════════════════════
-- AUD-03 · profiles.avatar_url : allowlist d'hôte + borne de taille
-- ═══════════════════════════════════════════════════════════════════
--
-- La colonne était `TEXT` sans contrainte, avec `GRANT UPDATE (…, avatar_url)`
-- au rôle `authenticated` (mig. 083) et AUCUNE validation dans le trigger
-- `enforce_profile_integrity` (qui ne sanitisait que `display_name`).
--
-- 1. Balise de traçage : `avatar_url = 'https://mallory.tld/px.gif'` est rendue
--    dans un `<img src>` chez tous les amis et co-membres (annuaire, pyramide,
--    inbox). Chaque affichage envoie IP + User-Agent + horodatage au serveur de
--    l'attaquante. L'ancienne CSP `img-src … https:` l'autorisait explicitement
--    (resserrée en parallèle dans vercel.json).
-- 2. Bloat : aucune borne de longueur — un PATCH de 10 Mo passait, sur une table
--    relue à chaque chargement d'annuaire.
--
-- Les data URLs restent tolérées mais bornées : c'est le format des avatars
-- DÉJÀ en base (ancien chemin canvas). Elles sont auto-contenues, donc sans
-- rappel réseau — le vecteur de traçage ne les concerne pas. Les nouveaux
-- uploads passent par Storage.

CREATE OR REPLACE FUNCTION public.is_allowed_avatar_url(p_url text)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_url IS NULL
      OR p_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
      OR p_url ~ '^https://lh3\.googleusercontent\.com/'
      OR p_url ~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$';
$$;

REVOKE ALL ON FUNCTION public.is_allowed_avatar_url(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_allowed_avatar_url(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_avatar_url(text) TO authenticated;

-- Normalisation préalable : toute valeur non conforme (ou trop longue) devient
-- NULL — l'UI retombe sur les initiales. Sans ce passage, l'ajout de la
-- contrainte ci-dessous échouerait sur les lignes existantes.
UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_url IS NOT NULL
  AND (length(avatar_url) > 60000 OR NOT public.is_allowed_avatar_url(avatar_url));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_valid
  CHECK (
    avatar_url IS NULL
    OR (length(avatar_url) <= 60000 AND public.is_allowed_avatar_url(avatar_url))
  );

-- Défense en profondeur : le trigger neutralise avant que la contrainte
-- n'échoue, pour que le PATCH d'un client honnête (avatar Google d'un autre
-- CDN, par exemple) dégrade en « pas d'avatar » au lieu de renvoyer une 400.
-- Corps identique à la mig. 083 + le bloc AUD-03.
CREATE OR REPLACE FUNCTION public.enforce_profile_integrity()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (defaut) — VOLONTAIRE, cf. mig. 083 : c'est ce qui permet
-- de distinguer un PATCH client (current_user = 'authenticated') d'un corps
-- SECURITY DEFINER (current_user = 'postgres').
SET search_path = ''
AS $fn$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'profile identity fields (id, email, account_type) are immutable'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'cannot create a profile for another user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.display_name := public.sanitize_display_name(NEW.display_name);

  -- AUD-03 : hôte non autorisé ou valeur démesurée → pas d'avatar.
  IF NEW.avatar_url IS NOT NULL
     AND (length(NEW.avatar_url) > 60000 OR NOT public.is_allowed_avatar_url(NEW.avatar_url)) THEN
    NEW.avatar_url := NULL;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_profile_integrity ON public.profiles;
CREATE TRIGGER trg_enforce_profile_integrity
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_integrity();

-- ═══════════════════════════════════════════════════════════════════
-- AUD-08 · Quota d'énumération d'emails : plafond global additionnel
-- ═══════════════════════════════════════════════════════════════════
--
-- Le quota de la mig. 083 est indexé sur `user_id` (200 résolutions hors
-- contacts / 24 h). La création de compte étant gratuite et non limitée, le
-- coût d'une énumération de 100 000 adresses tombait à 500 comptes. On ajoute
-- un plafond global horaire : il ne gêne aucun usage réaliste (une résolution
-- légitime est un ajout d'ami) mais rend l'énumération de masse non rentable.

CREATE TABLE IF NOT EXISTS public.email_lookup_global (
  window_start      TIMESTAMPTZ PRIMARY KEY,
  lookups_in_window INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.email_lookup_global ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_lookup_global FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_email_lookup_quota(p_cost integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_cap        CONSTANT INTEGER := 200;   -- par compte / 24 h
  c_global_cap CONSTANT INTEGER := 2000;  -- tous comptes confondus / 1 h
  v_start TIMESTAMPTZ;
  v_count INTEGER;
  v_hour  TIMESTAMPTZ;
  v_total INTEGER;
BEGIN
  IF p_cost <= 0 THEN RETURN; END IF;

  -- ── Plafond global horaire (AUD-08) ──
  v_hour := date_trunc('hour', NOW());
  INSERT INTO public.email_lookup_global (window_start, lookups_in_window)
  VALUES (v_hour, 0)
  ON CONFLICT (window_start) DO NOTHING;

  SELECT lookups_in_window INTO v_total
  FROM public.email_lookup_global WHERE window_start = v_hour
  FOR UPDATE;

  IF v_total + p_cost > c_global_cap THEN
    RAISE EXCEPTION 'email lookup quota exceeded (global)'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.email_lookup_global
  SET lookups_in_window = v_total + p_cost
  WHERE window_start = v_hour;

  -- Rétention : on ne garde que 48 h de fenêtres.
  DELETE FROM public.email_lookup_global WHERE window_start < NOW() - INTERVAL '48 hours';

  -- ── Plafond par compte (mig. 083, inchangé) ──
  INSERT INTO public.email_lookup_quota (user_id, window_start, lookups_in_window)
  VALUES (auth.uid(), NOW(), 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT window_start, lookups_in_window INTO v_start, v_count
  FROM public.email_lookup_quota WHERE user_id = auth.uid()
  FOR UPDATE;

  IF v_start IS NULL OR v_start <= NOW() - INTERVAL '24 hours' THEN
    v_start := NOW();
    v_count := 0;
  END IF;

  IF v_count + p_cost > c_cap THEN
    RAISE EXCEPTION 'email lookup quota exceeded (% per 24h)', c_cap
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.email_lookup_quota
  SET window_start = v_start, lookups_in_window = v_count + p_cost
  WHERE user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_email_lookup_quota(integer) FROM public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- AUD-09 · Télémétrie démo : fenêtre de blocage 1 h → 1 min + rétention
-- ═══════════════════════════════════════════════════════════════════
--
-- Le plafond de la mig. 083 était GLOBAL et horaire : un anonyme émettait 500
-- appels avec des UUID aléatoires en quelques secondes et, pendant l'heure
-- suivante, PLUS AUCUNE visite démo légitime n'était comptée (métriques
-- d'acquisition faussées).
--
-- Toute écriture non authentifiée est intrinsèquement inondable ; on ne peut
-- pas la rendre fiable, seulement borner les dégâts. En passant à une fenêtre
-- glissante d'une minute, une rafale n'aveugle plus le compteur que ~60 s.
-- Le correctif durable reste de déporter ce compteur vers Vercel Analytics
-- (mesure côté client, aucune écriture en base).

CREATE INDEX IF NOT EXISTS idx_demo_devices_first_seen
  ON public.demo_devices (first_seen_at);

CREATE OR REPLACE FUNCTION public.record_demo_visit(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_per_minute_cap CONSTANT INTEGER := 60;
  v_recent INTEGER;
BEGIN
  IF p_device_id IS NULL THEN RETURN; END IF;

  -- Rétention 90 jours (RGPD art. 5.1.e — l'identifiant d'appareil est une
  -- donnée personnelle) et borne la croissance de la table.
  DELETE FROM public.demo_devices
  WHERE first_seen_at < NOW() - INTERVAL '90 days' AND converted_at IS NULL;

  SELECT count(*) INTO v_recent
  FROM public.demo_devices
  WHERE first_seen_at > NOW() - INTERVAL '1 minute';

  -- Au-delà du plafond on absorbe silencieusement : télémétrie best-effort,
  -- elle ne doit ni échouer bruyamment ni servir de primitive d'écriture
  -- anonyme illimitée.
  IF v_recent >= c_per_minute_cap THEN RETURN; END IF;

  INSERT INTO public.demo_devices (device_id) VALUES (p_device_id)
  ON CONFLICT (device_id) DO NOTHING;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- AUD-14 · bump_win_streak — incrément atomique
-- ═══════════════════════════════════════════════════════════════════
--
-- `stripe-webhook` écrit son marqueur d'idempotence APRÈS le handler (choix
-- délibéré, faille M-5 : sinon un crash transformait la livraison at-least-once
-- en at-most-once). Deux livraisons concurrentes du même event exécutent donc
-- toutes deux le handler. Toutes les écritures étaient idempotentes SAUF
-- l'incrément de `win_streak`, fait par un SELECT puis un upsert `n+1` : les
-- deux exécutions lisaient la même valeur (un incrément perdu) ou
-- s'entrelaçaient en `n+2`.

CREATE OR REPLACE FUNCTION public.bump_win_streak(p_user uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.subscriptions
  SET win_streak = COALESCE(win_streak, 0) + 1,
      updated_at = NOW()
  WHERE user_id = p_user
  RETURNING win_streak;
$$;

-- Appelée uniquement par la Edge Function (service_role). Jamais par un client.
REVOKE ALL ON FUNCTION public.bump_win_streak(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_win_streak(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_win_streak(uuid) TO service_role;

-- ═══════════════════════════════════════════════════════════════════
-- AUD-15 · events : une seule policy PERMISSIVE par rôle + action
-- ═══════════════════════════════════════════════════════════════════
--
-- Les mig. 077 puis 081 ont ajouté `events_manager_select` / `_insert` EN PLUS
-- des policies « own », soit deux policies PERMISSIVE pour authenticated +
-- SELECT — exactement ce que la mig. 049 et CLAUDE.md interdisent (advisor
-- `multiple_permissive_policies`). Fusion en un OR unique, sémantique
-- strictement préservée :
--   own                        : user_id = auth.uid()
--   hiérarchie, non privé      : manages_user(user_id) AND NOT is_private

DROP POLICY IF EXISTS "events_manager_select" ON public.events;
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events"
  ON public.events FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR (public.manages_user(user_id) AND NOT is_private)
  );

DROP POLICY IF EXISTS "events_manager_insert" ON public.events;
DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR (public.manages_user(user_id) AND NOT is_private)
  );

-- ═══════════════════════════════════════════════════════════════════
-- AUD-16 · team_task_comments : auth.uid() wrappé (convention mig. 043)
-- ═══════════════════════════════════════════════════════════════════
-- Sans le `(SELECT …)`, `auth.uid()` est ré-évalué par ligne au lieu d'être
-- hissé en InitPlan. Purement performance, aucun changement de sémantique.

DROP POLICY IF EXISTS "team_task_comments_insert" ON public.team_task_comments;
CREATE POLICY "team_task_comments_insert"
  ON public.team_task_comments FOR INSERT
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.can_access_team_task(task_id)
  );

DROP POLICY IF EXISTS "team_task_comments_delete" ON public.team_task_comments;
CREATE POLICY "team_task_comments_delete"
  ON public.team_task_comments FOR DELETE
  USING (author_id = (SELECT auth.uid()));

COMMIT;
