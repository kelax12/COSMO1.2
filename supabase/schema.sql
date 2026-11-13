-- GENERE par scripts/contrat-donnees.mjs. NE PAS EDITER A LA MAIN.
-- Instantane du schema `public` d'une base vierge sur laquelle toutes les migrations de
-- supabase/migration/ ont ete rejouees (pg_dump --schema-only, normalise), suivi des objets
-- poses hors `public` par ces migrations. La CI echoue si ce fichier diverge.
-- Regenerer : npm run contrat:generer (Docker, supabase start, node scripts/apply-migrations.mjs) ou copier les fichiers de l'artefact `contrat-donnees` du job CI.

--
-- PostgreSQL database dump
--


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_table_access_method = heap;

--
-- Name: friends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    avatar text,
    created_at timestamp with time zone DEFAULT now(),
    friend_user_id uuid
);


--
-- Name: COLUMN friends.friend_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.friends.friend_user_id IS 'auth.users.id de l ami (identite reelle, distincte de la ligne friends). ON DELETE CASCADE depuis la mig. 116 : la ligne porte le nom et l email de l ami en clair, SET NULL la laissait survivre a son effacement (RGPD art. 17).';


--
-- Name: accept_friend_request_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_friend_request_v2(request_id uuid) RETURNS public.friends
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  req RECORD;
  sender_user RECORD;
  receiver_user RECORD;
  v_friend public.friends;
  sender_display TEXT;
  receiver_display TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO req FROM friend_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF req.receiver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the receiver can accept this request';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  SELECT id, email, raw_user_meta_data INTO sender_user FROM auth.users WHERE id = req.sender_id;
  SELECT id, email, raw_user_meta_data INTO receiver_user FROM auth.users WHERE id = req.receiver_id;

  -- M-2 (026, restauré) — sanitize avant persistance ; fallback sur la
  -- partie locale de l'email si le nom est vide après nettoyage.
  sender_display := COALESCE(
    public.sanitize_display_name(sender_user.raw_user_meta_data->>'name'),
    split_part(sender_user.email, '@', 1)
  );
  receiver_display := COALESCE(
    public.sanitize_display_name(receiver_user.raw_user_meta_data->>'name'),
    split_part(receiver_user.email, '@', 1)
  );

  -- Côté destinataire : ami = expéditeur (friend_user_id = sender.id) — 034
  INSERT INTO friends (user_id, name, email, friend_user_id)
  VALUES (receiver_user.id, sender_display, sender_user.email, sender_user.id)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id
  RETURNING * INTO v_friend;

  -- Côté expéditeur : ami = destinataire (friend_user_id = receiver.id) — 034
  INSERT INTO friends (user_id, name, email, friend_user_id)
  VALUES (sender_user.id, receiver_display, receiver_user.email, receiver_user.id)
  ON CONFLICT (user_id, email) DO UPDATE
    SET friend_user_id = EXCLUDED.friend_user_id;

  UPDATE friend_requests SET status = 'accepted' WHERE id = request_id;

  RETURN v_friend;
END;
$$;


--
-- Name: accept_shared_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_shared_task(p_task_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.shared_tasks
  SET accepted_at = NOW()
  WHERE task_id = p_task_id
    AND friend_id = auth.uid()
    AND accepted_at IS NULL;
END;
$$;


--
-- Name: account_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.account_activity() RETURNS TABLE(user_id uuid, email text, activity_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT u.id,
         u.email::text,
         greatest(u.last_sign_in_at, p.last_seen_at, u.created_at)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
   WHERE u.email IS NOT NULL
     AND u.deleted_at IS NULL
     AND COALESCE(u.is_anonymous, false) = false
     AND (u.banned_until IS NULL OR u.banned_until < now());
$$;


--
-- Name: account_has_live_billing(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.account_has_live_billing(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = p_user
              AND s.status IN ('active', 'past_due', 'trialing')
         )
      OR EXISTS (
           SELECT 1
             FROM public.organizations o
             JOIN public.org_subscriptions os ON os.org_id = o.id
            WHERE o.owner_id = p_user
              -- ⚠️ Une organisation GRATUITE a aussi une ligne `active`
              -- (défaut de la colonne) : sans ce filtre, tout propriétaire
              -- d'organisation serait tenu pour client.
              AND os.tier_key <> 'free'
              AND os.status IN ('active', 'past_due')
         );
$$;


--
-- Name: account_inactivity_deletion_due(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.account_inactivity_deletion_due(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.account_inactivity_notices n
      JOIN public.account_activity() a ON a.user_id = n.user_id
     WHERE n.user_id = p_user
       AND n.warned_at <= now() - interval '30 days'
       AND a.activity_at <= n.activity_at
       AND a.activity_at < now() - interval '3 years'
       AND NOT public.account_has_live_billing(p_user)
  );
$$;


--
-- Name: accounts_due_for_inactivity_deletion(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_due_for_inactivity_deletion(p_limit integer DEFAULT 20) RETURNS TABLE(user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT n.user_id
    FROM public.account_inactivity_notices n
   WHERE public.account_inactivity_deletion_due(n.user_id)
   ORDER BY n.warned_at
   LIMIT greatest(least(COALESCE(p_limit, 20), 100), 0);
$$;


--
-- Name: accounts_due_for_inactivity_notice(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accounts_due_for_inactivity_notice(p_limit integer DEFAULT 50) RETURNS TABLE(user_id uuid, email text, activity_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT a.user_id, a.email, a.activity_at
    FROM public.account_activity() a
   WHERE a.activity_at < now() - interval '3 years'
     AND NOT EXISTS (
           SELECT 1 FROM public.account_inactivity_notices n
            WHERE n.user_id = a.user_id
              AND n.warned_at > a.activity_at
         )
     AND NOT public.account_has_live_billing(a.user_id)
   ORDER BY a.activity_at
   LIMIT greatest(least(COALESCE(p_limit, 50), 200), 0);
$$;


--
-- Name: lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    task_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type text DEFAULT 'manual'::text NOT NULL,
    smart_rule text,
    is_default boolean DEFAULT false NOT NULL,
    "position" integer,
    CONSTRAINT lists_smart_rule_check CHECK (((smart_rule IS NULL) OR (smart_rule = ANY (ARRAY['overdue'::text, 'this-week'::text, 'high-priority'::text])))),
    CONSTRAINT lists_type_check CHECK ((type = ANY (ARRAY['manual'::text, 'smart'::text])))
);


--
-- Name: add_task_to_list(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_task_to_list(p_task_id uuid, p_list_id uuid) RETURNS public.lists
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row public.lists;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Atomic upsert into array. `task_ids || x` followed by uniq dedup
  -- via array_agg(DISTINCT) avoids the read-modify-write window.
  UPDATE public.lists
  SET task_ids = (
    SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(task_ids, ARRAY[]::UUID[]) || p_task_id))
  )
  WHERE id = p_list_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'List not found';
  END IF;

  RETURN v_row;
END;
$$;


--
-- Name: admin_allowlisted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_allowlisted() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;


--
-- Name: FUNCTION admin_allowlisted(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_allowlisted() IS 'Ce compte est-il dans admin_users ? Question d''AFFICHAGE, pas une garde : elle ignore volontairement le niveau d''assurance de la session, pour que l''écran d''enrôlement TOTP reste atteignable avant tout second facteur. La garde est is_admin() (mig. 131).';


--
-- Name: admin_stats_excluded_uids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_stats_excluded_uids() RETURNS uuid[]
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT ARRAY[
    -- demo@cosmo.app : le compte de seed de la demonstration, cree le
    -- 2026-01-10, JAMAIS connecte, porteur du jeu de donnees montre.
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    -- testemail@gmail.com : compte d'essai du 2026-07-17.
    '728ecd25-67d2-4a9f-8cc4-d15b9e1ded51'::uuid
  ];
$$;


--
-- Name: FUNCTION admin_stats_excluded_uids(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.admin_stats_excluded_uids() IS 'Comptes qui ne sont pas des utilisateurs du produit (seed de demo, compte de test). SEULE liste de ce genre dans le depot : ne jamais recopier un de ces UUID ailleurs, deux listes divergeraient. Mig. 149.';


--
-- Name: affiliate_attach(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.affiliate_attach(p_affiliate_id uuid, p_email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_slug  TEXT;
  v_uid   UUID;
  v_count INT;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT l.slug INTO v_slug FROM public.affiliate_links l
   WHERE l.affiliate_id = p_affiliate_id ORDER BY l.created_at DESC LIMIT 1;
  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'unknown affiliate' USING ERRCODE = 'P0002';
  END IF;

  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(trim(p_email));
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unknown account' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.profiles p
     SET affiliate_id = p_affiliate_id, affiliate_slug = v_slug, affiliated_at = now()
   WHERE p.id = v_uid AND p.affiliate_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'already attached' USING ERRCODE = '23505';
  END IF;
  RETURN v_uid;
END;
$$;


--
-- Name: affiliate_backfill(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.affiliate_backfill() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_rec public.payment_records;
  v_n   INT := 0;
BEGIN
  IF NOT (public.is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_rec IN
    SELECT pr.* FROM public.payment_records pr
     WHERE pr.event_type IN ('invoice.payment_succeeded', 'charge.refunded')
       AND NOT EXISTS (SELECT 1 FROM public.affiliate_commissions ac WHERE ac.payment_record_id = pr.id)
     ORDER BY pr.id
  LOOP
    IF public.affiliate_process(v_rec) THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;


--
-- Name: affiliate_compute(bigint, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.affiliate_compute(p_gross bigint, p_vat_bp integer, p_deduction_bp integer, p_fee_bp integer, p_fee_fixed integer, p_rate_bp integer, OUT vat_cents bigint, OUT deduction_cents bigint, OUT fee_cents bigint, OUT base_cents bigint, OUT commission_cents bigint) RETURNS record
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
BEGIN
  vat_cents := p_gross - round(p_gross::numeric / (1 + p_vat_bp::numeric / 10000));
  deduction_cents := round(p_gross::numeric * p_deduction_bp / 10000);
  fee_cents := round(p_gross::numeric * p_fee_bp / 10000) + p_fee_fixed;
  base_cents := greatest(p_gross - vat_cents - deduction_cents - fee_cents, 0);
  commission_cents := round(base_cents::numeric * p_rate_bp / 10000);
END;
$$;


--
-- Name: payment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_records (
    id bigint NOT NULL,
    stripe_event_id text NOT NULL,
    event_type text NOT NULL,
    stripe_invoice_id text,
    stripe_customer_id text,
    org_id uuid,
    user_id uuid,
    amount_cents bigint NOT NULL,
    currency text NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    prev_hash text,
    row_hash text NOT NULL,
    CONSTRAINT payment_records_currency_ck CHECK (((currency = lower(currency)) AND (length(currency) = 3))),
    CONSTRAINT payment_records_scope_ck CHECK ((num_nonnulls(org_id, user_id) <= 1))
);


--
-- Name: TABLE payment_records; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_records IS 'Journal d encaissement append-only (CGI art. 286-I-3 bis). Ni UPDATE ni DELETE, jamais purge. Voir docs/LEGAL.md ligne C9.';


--
-- Name: affiliate_process(public.payment_records); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.affiliate_process(p_rec public.payment_records) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_set    public.affiliate_settings;
  v_uid    UUID;
  v_aff    UUID;
  v_at     TIMESTAMPTZ;
  v_c      RECORD;
  v_origin public.affiliate_commissions;
  v_comm   BIGINT;
  v_count  INT;
BEGIN
  IF p_rec.event_type = 'invoice.payment_succeeded' AND p_rec.amount_cents > 0 THEN
    v_uid := p_rec.user_id;
    IF v_uid IS NULL AND p_rec.org_id IS NOT NULL THEN
      SELECT os.purchased_by INTO v_uid
        FROM public.org_subscriptions os WHERE os.org_id = p_rec.org_id;
    END IF;
    IF v_uid IS NULL THEN RETURN false; END IF;

    SELECT p.affiliate_id, p.affiliated_at INTO v_aff, v_at
      FROM public.profiles p WHERE p.id = v_uid;
    IF v_aff IS NULL OR v_at IS NULL OR v_at > p_rec.occurred_at THEN RETURN false; END IF;

    SELECT * INTO STRICT v_set FROM public.affiliate_settings WHERE id;
    SELECT * INTO v_c FROM public.affiliate_compute(
      p_rec.amount_cents, v_set.vat_bp, v_set.deduction_bp, v_set.fee_bp, v_set.fee_fixed_cents,
      v_set.commission_bp);

    INSERT INTO public.affiliate_commissions (
      payment_record_id, affiliate_id, customer_id, org_id, gross_cents, vat_cents,
      deduction_bp, deduction_cents, fee_cents, base_cents, rate_bp, commission_cents, occurred_at)
    VALUES (p_rec.id, v_aff, v_uid, p_rec.org_id, p_rec.amount_cents, v_c.vat_cents,
      v_set.deduction_bp, v_c.deduction_cents, v_c.fee_cents, v_c.base_cents, v_set.commission_bp,
      v_c.commission_cents, p_rec.occurred_at)
    ON CONFLICT (payment_record_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;

  ELSIF p_rec.event_type = 'charge.refunded' AND p_rec.amount_cents < 0
        AND p_rec.stripe_invoice_id IS NOT NULL THEN
    -- Le remboursement Premium arrive avec `user_id` NULL : on retrouve la
    -- commission d'origine par la facture, et on garde SES taux.
    SELECT ac.* INTO v_origin
      FROM public.affiliate_commissions ac
      JOIN public.payment_records pr ON pr.id = ac.payment_record_id
     WHERE pr.stripe_invoice_id = p_rec.stripe_invoice_id
       AND pr.event_type = 'invoice.payment_succeeded'
       AND ac.commission_cents > 0
     ORDER BY pr.id
     LIMIT 1;
    IF v_origin.id IS NULL OR v_origin.gross_cents <= 0 THEN RETURN false; END IF;

    v_comm := -round(abs(p_rec.amount_cents)::numeric / v_origin.gross_cents * v_origin.commission_cents);

    INSERT INTO public.affiliate_commissions (
      payment_record_id, affiliate_id, customer_id, org_id, gross_cents, vat_cents,
      deduction_bp, deduction_cents, fee_cents, base_cents, rate_bp, commission_cents, occurred_at)
    VALUES (p_rec.id, v_origin.affiliate_id, v_origin.customer_id, v_origin.org_id,
      p_rec.amount_cents, 0, v_origin.deduction_bp, 0, 0, 0, v_origin.rate_bp, v_comm,
      p_rec.occurred_at)
    ON CONFLICT (payment_record_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
  END IF;

  -- `invoice.payment_failed` et le reste : ces lignes ne sont pas un encaissement.
  RETURN false;
END;
$$;


--
-- Name: apply_team_task_custom_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_team_task_custom_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_project uuid;
  v_maps_to text;
BEGIN
  -- Un changement de projet détache un statut propre à l'ancien projet.
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id
     AND NEW.custom_status_id IS NOT DISTINCT FROM OLD.custom_status_id THEN
    NEW.custom_status_id := NULL;
  END IF;

  IF NEW.custom_status_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.project_id, s.maps_to INTO v_project, v_maps_to
    FROM public.team_project_statuses s WHERE s.id = NEW.custom_status_id;
  IF v_project IS NULL OR v_project <> NEW.project_id THEN
    RAISE EXCEPTION 'custom_status_not_in_project' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.custom_status_id IS NOT DISTINCT FROM OLD.custom_status_id
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IS DISTINCT FROM v_maps_to THEN
    -- Le statut du produit a changé sans passer par le statut propre (vue
    -- liste, action groupée, case « terminée ») : on détache, on ne force pas.
    NEW.custom_status_id := NULL;
    RETURN NEW;
  END IF;

  NEW.status := v_maps_to;
  RETURN NEW;
END;
$$;


--
-- Name: assign_default_org_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_default_org_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_role uuid;
BEGIN
  -- Un admin détient tout : jamais de rôle sur lui (enforce_org_member_role_write).
  IF NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;
  SELECT s.default_role_id INTO v_role FROM public.org_settings s WHERE s.org_id = NEW.org_id;
  IF v_role IS NOT NULL THEN
    INSERT INTO public.org_member_roles (org_id, role_id, user_id, starts_at, ends_at)
    VALUES (NEW.org_id, v_role, NEW.user_id, now(), NULL)
    ON CONFLICT (role_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: audit_org_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_org_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  r record;
  v_name text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'organization_members' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'member.joined', 'member', NULL, NEW.user_id, NULL);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id,
        CASE WHEN OLD.user_id = auth.uid() THEN 'member.left' ELSE 'member.removed' END,
        'member', NULL, OLD.user_id, NULL);
    ELSE
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        PERFORM public.write_org_audit(NEW.org_id, 'member.role_changed', 'member', NULL, NEW.user_id,
          jsonb_build_object('from', OLD.role, 'to', NEW.role));
      END IF;
      IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        PERFORM public.write_org_audit(NEW.org_id, 'member.moved', 'member', NULL, NEW.user_id,
          jsonb_build_object('from', OLD.manager_id, 'to', NEW.manager_id));
      END IF;
      IF NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
         OR NEW.access_expires_at IS DISTINCT FROM OLD.access_expires_at THEN
        PERFORM public.write_org_audit(NEW.org_id, 'member.access_changed', 'member', NULL, NEW.user_id,
          jsonb_build_object('suspended', NEW.suspended_at IS NOT NULL, 'expiresAt', NEW.access_expires_at));
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'org_teams' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'team.created', 'team', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'team.deleted', 'team', OLD.id, NULL, jsonb_build_object('name', OLD.name));
    ELSIF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.write_org_audit(NEW.org_id, 'team.renamed', 'team', NEW.id, NULL,
        jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;

  ELSIF TG_TABLE_NAME = 'org_team_members' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'team.member_added', 'team', NEW.team_id, NEW.user_id, NULL);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'team.member_removed', 'team', OLD.team_id, OLD.user_id, NULL);
    ELSIF NEW.is_lead IS DISTINCT FROM OLD.is_lead THEN
      PERFORM public.write_org_audit(NEW.org_id,
        CASE WHEN NEW.is_lead THEN 'team.lead_granted' ELSE 'team.lead_revoked' END,
        'team', NEW.team_id, NEW.user_id, NULL);
    END IF;

  ELSIF TG_TABLE_NAME = 'team_projects' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'project.created', 'project', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'project.deleted', 'project', OLD.id, NULL, jsonb_build_object('name', OLD.name));
    ELSE
      IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
        PERFORM public.write_org_audit(NEW.org_id,
          CASE WHEN NEW.archived_at IS NULL THEN 'project.restored' ELSE 'project.archived' END,
          'project', NEW.id, NULL, jsonb_build_object('name', NEW.name));
      END IF;
      IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
        PERFORM public.write_org_audit(NEW.org_id, 'project.visibility_changed', 'project', NEW.id, NULL,
          jsonb_build_object('name', NEW.name, 'from', OLD.team_id, 'to', NEW.team_id));
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'org_member_permissions' THEN
    r := COALESCE(NEW, OLD);
    PERFORM public.write_org_audit(r.org_id, 'member.permissions_changed', 'member', NULL, r.user_id,
      CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('reset', true) ELSE NULL END);

  ELSIF TG_TABLE_NAME = 'org_roles' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.created', 'role', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'role.deleted', 'role', OLD.id, NULL, jsonb_build_object('name', OLD.name));
    ELSIF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.granted_keys IS DISTINCT FROM OLD.granted_keys
       OR NEW.assign_targets IS DISTINCT FROM OLD.assign_targets THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.updated', 'role', NEW.id, NULL, jsonb_build_object('name', NEW.name));
    END IF;

  ELSIF TG_TABLE_NAME = 'org_member_roles' THEN
    r := COALESCE(NEW, OLD);
    SELECT name INTO v_name FROM public.org_roles WHERE id = r.role_id;
    IF TG_OP = 'INSERT' THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.assigned', 'role', NEW.role_id, NEW.user_id,
        jsonb_build_object('name', v_name, 'endsAt', NEW.ends_at));
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.write_org_audit(OLD.org_id, 'role.revoked', 'role', OLD.role_id, OLD.user_id,
        jsonb_build_object('name', v_name));
    ELSIF NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
      PERFORM public.write_org_audit(NEW.org_id, 'role.extended', 'role', NEW.role_id, NEW.user_id,
        jsonb_build_object('name', v_name, 'from', OLD.ends_at, 'to', NEW.ends_at));
    END IF;

  ELSIF TG_TABLE_NAME = 'organizations' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      PERFORM public.write_org_audit(NEW.id, 'org.renamed', 'org', NEW.id, NULL,
        jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      PERFORM public.write_org_audit(NEW.id, 'org.owner_transferred', 'org', NEW.id, NEW.owner_id, NULL);
    END IF;

  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: audit_team_okr_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_team_okr_trash() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.write_org_audit(OLD.org_id, 'okr.deleted', 'okr', OLD.id, NULL,
      jsonb_build_object('name', left(OLD.title, 120)));
  ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM public.write_org_audit(NEW.org_id,
      CASE WHEN NEW.deleted_at IS NULL THEN 'okr.restored' ELSE 'okr.trashed' END,
      'okr', NEW.id, NULL, jsonb_build_object('name', left(NEW.title, 120)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: audit_team_project_details(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_team_project_details() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.is_template THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.owner_changed', 'project', NEW.id, NEW.owner_id,
      jsonb_build_object('name', NEW.name, 'from', OLD.owner_id, 'to', NEW.owner_id));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.status_changed', 'project', NEW.id, NULL,
      jsonb_build_object('name', NEW.name, 'from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.health IS DISTINCT FROM OLD.health THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.health_changed', 'project', NEW.id, NULL,
      jsonb_build_object('name', NEW.name, 'from', OLD.health, 'to', NEW.health));
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: audit_team_project_members(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_team_project_members() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  -- Cascade (projet, organisation ou compte supprimés) : la ligne de
  -- journal violerait sa clé, ou n'aurait rien à dire.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.member_added', 'project', NEW.project_id, NEW.user_id,
      jsonb_build_object('role', NEW.role));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_org_audit(OLD.org_id, 'project.member_removed', 'project', OLD.project_id, OLD.user_id,
      jsonb_build_object('role', OLD.role));
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM public.write_org_audit(NEW.org_id, 'project.member_role_changed', 'project', NEW.project_id, NEW.user_id,
      jsonb_build_object('from', OLD.role, 'to', NEW.role));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: audit_team_task_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_team_task_trash() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.write_org_audit(OLD.org_id, 'task.deleted', 'task', OLD.id, NULL,
      jsonb_build_object('name', left(OLD.name, 120)));
  ELSIF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    PERFORM public.write_org_audit(NEW.org_id,
      CASE WHEN NEW.deleted_at IS NULL THEN 'task.restored' ELSE 'task.trashed' END,
      'task', NEW.id, NULL, jsonb_build_object('name', left(NEW.name, 120)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: billing_acceptances_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.billing_acceptances_append_only() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'billing_acceptances is append-only';
  END IF;
  -- Seule évolution admise : la FK remise à NULL par la suppression de l'org.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.cgv_version IS DISTINCT FROM OLD.cgv_version
     OR NEW.immediate_access_at IS DISTINCT FROM OLD.immediate_access_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    RAISE EXCEPTION 'billing_acceptances is append-only';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: build_org_activity_report(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_org_activity_report(p_org uuid, p_team uuid, p_day date, p_tz text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_from timestamptz := (p_day::timestamp) AT TIME ZONE p_tz;
  v_to   timestamptz := ((p_day + 1)::timestamp) AT TIME ZONE p_tz;
  v_prev jsonb;
  v_out  jsonb;
BEGIN
  -- Instantané des KR de la veille : c'est lui qui dit de combien un KR a bougé.
  SELECT r.payload -> 'snapshot' -> 'krs' INTO v_prev
    FROM public.org_activity_reports r
   WHERE r.org_id = p_org
     AND r.day = p_day - 1
     AND (CASE WHEN p_team IS NULL THEN r.scope = 'org' ELSE r.team_id = p_team END);

  WITH
  scope_members AS (
    SELECT m.user_id FROM public.organization_members m
     WHERE m.org_id = p_org AND p_team IS NULL
    UNION
    SELECT tm.user_id FROM public.org_team_members tm
     WHERE tm.team_id = p_team
  ),
  scope_projects AS (
    SELECT p.id, p.name, p.color, p.status
      FROM public.team_projects p
     WHERE p.org_id = p_org
       AND NOT COALESCE(p.is_template, false)
       AND (
         p_team IS NULL
         OR p.team_id = p_team
         OR EXISTS (SELECT 1 FROM public.team_project_teams pt WHERE pt.project_id = p.id AND pt.team_id = p_team)
       )
  ),
  names AS (
    SELECT pr.id, COALESCE(NULLIF(pr.display_name, ''), split_part(pr.email, '@', 1)) AS name
      FROM public.profiles pr
  ),
  done AS (
    SELECT t.id, t.name, t.project_id, t.completed_at,
           COALESCE(
             (SELECT a.actor_id FROM public.team_task_activity a
               WHERE a.task_id = t.id AND a.field = 'status' AND a.new_value = 'done'
                 AND a.created_at >= v_from AND a.created_at < v_to
               ORDER BY a.created_at DESC LIMIT 1),
             t.assignee_ids[1],
             t.created_by
           ) AS by_id
      FROM public.team_tasks t
     WHERE t.org_id = p_org
       AND t.completed
       AND t.deleted_at IS NULL
       AND t.completed_at >= v_from AND t.completed_at < v_to
  ),
  scoped_done AS (
    SELECT d.* FROM done d
     WHERE p_team IS NULL
        OR d.project_id IN (SELECT id FROM scope_projects)
        OR d.by_id IN (SELECT user_id FROM scope_members)
     ORDER BY d.completed_at
     LIMIT 1000
  ),
  proj_stats AS (
    SELECT sp.id, sp.name, sp.color,
           count(t.id)::int AS total,
           count(t.id) FILTER (WHERE t.completed)::int AS completed,
           count(t.id) FILTER (WHERE t.completed AND t.completed_at >= v_from AND t.completed_at < v_to)::int AS today
      FROM scope_projects sp
      LEFT JOIN public.team_tasks t ON t.project_id = sp.id AND t.deleted_at IS NULL
     GROUP BY sp.id, sp.name, sp.color
  ),
  scope_krs AS (
    SELECT k.*, o.title AS okr_title
      FROM public.team_key_results k
      JOIN public.team_okrs o ON o.id = k.okr_id
     WHERE k.org_id = p_org
       AND o.deleted_at IS NULL
       AND (p_team IS NULL OR EXISTS (
         SELECT 1 FROM public.team_okr_teams ot WHERE ot.okr_id = o.id AND ot.team_id = p_team
       ))
  ),
  kr_now AS (
    SELECT k.id, k.title, k.okr_title, k.unit, k.current_value, k.target_value,
           (k.completed AND k.completed_at >= v_from AND k.completed_at < v_to) AS completed_today,
           CASE
             WHEN k.completed THEN 100
             WHEN k.progress_mode = 'tasks' AND EXISTS (SELECT 1 FROM public.team_kr_projects l WHERE l.kr_id = k.id) THEN
               COALESCE((
                 SELECT CASE WHEN count(t.id) > 0
                   THEN round(100.0 * count(t.id) FILTER (WHERE t.completed) / count(t.id)) END
                   FROM public.team_kr_projects l
                   JOIN public.team_tasks t ON t.project_id = l.project_id AND t.deleted_at IS NULL
                  WHERE l.kr_id = k.id
               ), 0)
             WHEN k.target_value <= 0 THEN 0
             ELSE LEAST(100, GREATEST(0, round(100.0 * k.current_value / k.target_value)))
           END::int AS pct,
           -- Pas d'instantané la veille (premier rapport) : dernier point d'étape.
           (SELECT CASE WHEN k.target_value > 0
                     THEN LEAST(100, GREATEST(0, round(100.0 * c.value / k.target_value)))::int END
              FROM public.team_kr_checkins c
             WHERE c.kr_id = k.id AND c.created_at < v_from
             ORDER BY c.created_at DESC LIMIT 1) AS checkin_pct
      FROM scope_krs k
  ),
  kr_moves AS (
    SELECT n.*, COALESCE((v_prev ->> n.id::text)::int, n.checkin_pct) AS before
      FROM kr_now n
  ),
  scope_events AS (
    -- Événements uniques qui se terminent dans la journée…
    SELECT e.user_id, e.title, e.start_time AS s, e.end_time AS f
      FROM public.events e
     WHERE e.user_id IN (SELECT user_id FROM scope_members)
       AND NOT e.is_private
       AND COALESCE(e.recurrence, 'none') = 'none'
       AND e.end_time > v_from AND e.end_time <= v_to
    UNION ALL
    -- …et occurrences du jour des événements récurrents (miroir de
    -- `expandRecurringEvents` : daily, weekly, custom, exceptions).
    SELECT e.user_id, e.title, occ.s, occ.s + (e.end_time - e.start_time)
      FROM public.events e
      CROSS JOIN LATERAL (
        SELECT ((p_day + (e.start_time AT TIME ZONE p_tz)::time)::timestamp AT TIME ZONE p_tz) AS s
      ) occ
     WHERE e.user_id IN (SELECT user_id FROM scope_members)
       AND NOT e.is_private
       AND e.recurrence IN ('daily', 'weekly', 'custom')
       AND (e.start_time AT TIME ZONE p_tz)::date <= p_day
       AND (
         e.recurrence = 'daily'
         OR (e.recurrence = 'weekly' AND extract(dow FROM (e.start_time AT TIME ZONE p_tz)) = extract(dow FROM p_day))
         OR (e.recurrence = 'custom' AND extract(dow FROM p_day)::int = ANY (COALESCE(e.recurrence_days, ARRAY[]::int[])))
       )
       AND NOT (to_char(occ.s AT TIME ZONE 'UTC', 'YYYY-MM-DD') = ANY (COALESCE(e.exceptions, ARRAY[]::text[])))
  )
  SELECT jsonb_build_object(
    'version', 1,
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'name', d.name,
               'projectId', d.project_id, 'projectName', p.name, 'projectColor', p.color,
               'byId', d.by_id, 'byName', nm.name,
               'at', d.completed_at
             ) ORDER BY d.completed_at)
        FROM scoped_done d
        LEFT JOIN public.team_projects p ON p.id = d.project_id
        LEFT JOIN names nm ON nm.id = d.by_id
    ), '[]'::jsonb),
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'color', s.color,
               'done', s.completed, 'total', s.total, 'completedToday', s.today,
               'before', round(100.0 * (s.completed - s.today) / s.total)::int,
               'after', round(100.0 * s.completed / s.total)::int
             ) ORDER BY s.today DESC, s.name)
        FROM proj_stats s
       WHERE s.today > 0 AND s.total > 0
    ), '[]'::jsonb),
    'krs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', m.id, 'title', m.title, 'okrTitle', m.okr_title, 'unit', m.unit,
               'value', m.current_value, 'target', m.target_value,
               'before', m.before, 'after', m.pct, 'completed', m.completed_today
             ) ORDER BY m.okr_title, m.title)
        FROM kr_moves m
       WHERE m.completed_today OR (m.before IS NOT NULL AND m.pct > m.before)
    ), '[]'::jsonb),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'userId', x.user_id, 'userName', nm.name,
               'title', x.title, 'start', x.s, 'end', x.f
             ) ORDER BY nm.name, x.s)
        FROM (SELECT * FROM scope_events ORDER BY s LIMIT 500) x
        LEFT JOIN names nm ON nm.id = x.user_id
    ), '[]'::jsonb),
    'teams', CASE WHEN p_team IS NULL THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'name', t.name, 'color', t.color,
               'tasksDone', (
                 SELECT count(*) FROM done d
                  WHERE d.by_id IN (SELECT tm.user_id FROM public.org_team_members tm WHERE tm.team_id = t.id)
                     OR d.project_id IN (
                       SELECT p.id FROM public.team_projects p WHERE p.team_id = t.id
                       UNION
                       SELECT pt.project_id FROM public.team_project_teams pt WHERE pt.team_id = t.id
                     )
               )
             ) ORDER BY t.name)
        FROM public.org_teams t
       WHERE t.org_id = p_org
    ), '[]'::jsonb) ELSE '[]'::jsonb END,
    'truncated', (SELECT count(*) FROM done) > 1000,
    'snapshot', jsonb_build_object(
      'krs', COALESCE((SELECT jsonb_object_agg(n.id::text, n.pct) FROM kr_now n), '{}'::jsonb)
    )
  ) INTO v_out;

  RETURN v_out;
END;
$$;


--
-- Name: can_access_team_okr(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_team_okr(p_okr uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
    WHERE o.id = p_okr
      AND o.deleted_at IS NULL
      AND (
        public.is_org_admin(o.org_id)
        OR (
          o.audience = 'org'
          AND NOT EXISTS (SELECT 1 FROM public.team_okr_teams l WHERE l.okr_id = o.id)
          AND NOT EXISTS (SELECT 1 FROM public.team_okr_members m WHERE m.okr_id = o.id)
          AND public.is_org_member(o.org_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.team_okr_teams l
          JOIN public.org_team_members tm ON tm.team_id = l.team_id
          WHERE l.okr_id = o.id
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(o.org_id, auth.uid()))
            )
        )
        OR (
          o.audience = 'custom'
          AND public.is_org_member(o.org_id)
          AND EXISTS (
            SELECT 1 FROM public.team_okr_members m
            WHERE m.okr_id = o.id
              AND (
                m.user_id = auth.uid()
                OR m.user_id IN (SELECT public.get_subtree(o.org_id, auth.uid()))
              )
          )
        )
      )
  );
$$;


--
-- Name: can_access_team_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_team_project(p_project uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND p.id IN (SELECT public.my_team_project_ids(p.org_id))
  );
$$;


--
-- Name: FUNCTION can_access_team_project(p_project uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_access_team_project(p_project uuid) IS 'Visibilite d un projet d equipe, posee a la regle unique my_team_project_ids (mig. 243). Ne jamais y reecrire un predicat : faire evoluer my_team_project_ids, qui vaut a la fois pour les policies et pour les RPC get_my_team_*.';


--
-- Name: can_access_team_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_team_task(p_task uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_tasks t
    WHERE t.id = p_task
      AND t.deleted_at IS NULL
      AND public.can_access_team_project(t.project_id)
  );
$$;


--
-- Name: can_assign_to(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_assign_to(p_org uuid, p_target uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_targets    text[];
  v_me         uuid := (SELECT auth.uid());
  v_my_manager uuid;
BEGIN
  IF NOT public.is_org_member(p_org) THEN
    RETURN false;
  END IF;

  -- La cible doit être membre de la MÊME organisation (miroir du trigger
  -- validate_team_task, mig. 062 — une garde de portée ne le remplace pas).
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_target
  ) THEN
    RETURN false;
  END IF;

  v_targets := public.my_assign_targets(p_org);

  IF 'everyone' = ANY (v_targets) THEN RETURN true; END IF;
  IF 'self' = ANY (v_targets) AND p_target = v_me THEN RETURN true; END IF;

  SELECT manager_id INTO v_my_manager
  FROM public.organization_members
  WHERE org_id = p_org AND user_id = v_me;

  IF 'manager' = ANY (v_targets)
     AND v_my_manager IS NOT NULL AND p_target = v_my_manager THEN
    RETURN true;
  END IF;

  -- « Même niveau » = même supérieur direct. Deux membres NON PLACÉS
  -- (manager_id NULL) ne sont pas des pairs : les traiter comme tels
  -- ouvrirait toute l'organisation d'un coup, puisqu'un membre non placé est
  -- l'état par défaut à l'arrivée.
  IF 'peers' = ANY (v_targets)
     AND v_my_manager IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE org_id = p_org AND user_id = p_target AND manager_id = v_my_manager
     ) THEN
    RETURN true;
  END IF;

  IF 'subordinates' = ANY (v_targets) AND public.is_above(p_org, p_target) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


--
-- Name: can_edit_team_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit_team_project(p_project uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND (
        public.my_project_edit_perm(p.org_id)
        OR (p.owner_id = (SELECT auth.uid()) AND public.is_org_member(p.org_id))
        OR public.my_project_role(p.id) = 'lead'
      )
  );
$$;


--
-- Name: can_manage_team(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_team(p_team uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = p_team
      AND public.is_org_member(t.org_id)
      AND (
        public.is_org_admin(t.org_id)
        OR t.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.org_team_members tm
          WHERE tm.team_id = t.id
            AND tm.user_id = (SELECT auth.uid())
            AND tm.is_lead
        )
      )
  );
$$;


--
-- Name: can_manage_team_okr_audience(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_team_okr_audience(p_okr uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
     WHERE o.id = p_okr
       AND o.deleted_at IS NULL
       AND (
         public.is_org_admin(o.org_id)
         OR (
           -- my_org_perm exige déjà un membre actif (is_org_member).
           public.my_org_perm(o.org_id, 'okr.create')
           AND (o.created_by = (SELECT auth.uid()) OR public.can_access_team_okr(o.id))
         )
       )
  );
$$;


--
-- Name: can_restore_team_okr(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_restore_team_okr(p_org uuid, p_deleted_by uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT (select auth.uid()) IS NOT NULL
     AND public.is_org_member(p_org)
     AND (
       public.is_org_admin(p_org)
       OR p_deleted_by = (select auth.uid())
       OR public.my_org_perm(p_org, 'okr.delete')
     );
$$;


--
-- Name: can_restore_team_task(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_restore_team_task(p_org uuid, p_project uuid, p_deleted_by uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT (select auth.uid()) IS NOT NULL
     AND public.is_org_member(p_org)
     AND (
       public.is_org_admin(p_org)
       OR p_deleted_by = (select auth.uid())
       OR (public.my_org_perm(p_org, 'task.deleteAny') AND public.can_access_team_project(p_project))
     );
$$;


--
-- Name: claim_acquisition_source(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_acquisition_source(p_source text, p_campaign text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: FUNCTION claim_acquisition_source(p_source text, p_campaign text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_acquisition_source(p_source text, p_campaign text) IS 'Inscrit la source first-touch d''un compte neuf (< 1 h) qui n''en a pas, typiquement après une inscription Google. Mig. 217.';


--
-- Name: claim_affiliate(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_affiliate(p_slug text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
  v_uid   UUID := auth.uid();
  v_aff   UUID;
  v_count INT;
BEGIN
  IF v_uid IS NULL OR p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{2,40}$' THEN
    RETURN false;
  END IF;
  SELECT l.affiliate_id INTO v_aff FROM public.affiliate_links l WHERE l.slug = p_slug;
  IF v_aff IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles p
     SET affiliate_id = v_aff, affiliate_slug = p_slug, affiliated_at = now()
   WHERE p.id = v_uid
     AND p.affiliate_id IS NULL
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = v_uid
          AND u.created_at > now() - interval '1 hour'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$_$;


--
-- Name: claim_org_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_org_invite(p_token uuid) RETURNS TABLE(org_id uuid, org_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_link public.org_invite_links;
  v_org public.organizations;
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

  -- Mig. 161 : un lien nominatif ne sert qu'à son destinataire.
  IF v_link.email IS NOT NULL AND lower(COALESCE(auth.email(), '')) <> lower(v_link.email) THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  -- Mig. 210 : un lien ouvert ne se réclame plus si « domaine vérifié seulement ».
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

  IF NOT public.org_member_can_invite(v_link.org_id, v_link.created_by) THEN
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
$$;


--
-- Name: claim_share_link(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_share_link(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_link            public.share_links;
  v_claimer         UUID;
  v_task_name       TEXT;
  v_owner_user      RECORD;
  v_claimer_user    RECORD;
  v_owner_display   TEXT;
  v_claimer_display TEXT;
  v_owner_avatar    TEXT;
  v_existing        public.shared_tasks;
BEGIN
  v_claimer := auth.uid();
  IF v_claimer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.share_links WHERE id = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = 'P0001';
  END IF;
  IF v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'expired_link' USING ERRCODE = 'P0001';
  END IF;
  IF v_link.owner_id = v_claimer THEN
    RAISE EXCEPTION 'own_link' USING ERRCODE = 'P0001';
  END IF;

  SELECT name INTO v_task_name FROM public.tasks WHERE id = v_link.task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, email, raw_user_meta_data INTO v_owner_user
    FROM auth.users WHERE id = v_link.owner_id;
  SELECT id, email, raw_user_meta_data INTO v_claimer_user
    FROM auth.users WHERE id = v_claimer;

  v_owner_display := COALESCE(
    public.sanitize_display_name(v_owner_user.raw_user_meta_data->>'name'),
    split_part(v_owner_user.email, '@', 1)
  );
  v_claimer_display := COALESCE(
    public.sanitize_display_name(v_claimer_user.raw_user_meta_data->>'name'),
    split_part(v_claimer_user.email, '@', 1)
  );

  -- Avatar du propriétaire (source publique = profiles ; fallback metadata).
  SELECT avatar_url INTO v_owner_avatar FROM public.profiles WHERE id = v_link.owner_id;
  IF v_owner_avatar IS NULL THEN
    v_owner_avatar := v_owner_user.raw_user_meta_data->>'avatar_url';
  END IF;

  INSERT INTO public.friends (user_id, name, email, friend_user_id)
  VALUES (v_claimer, v_owner_display, v_owner_user.email, v_link.owner_id)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id;

  INSERT INTO public.friends (user_id, name, email, friend_user_id)
  VALUES (v_link.owner_id, v_claimer_display, v_claimer_user.email, v_claimer)
  ON CONFLICT (user_id, email) DO UPDATE
    SET name = EXCLUDED.name,
        friend_user_id = EXCLUDED.friend_user_id;

  UPDATE public.friend_requests SET status = 'accepted'
  WHERE status = 'pending'
    AND ((sender_id = v_link.owner_id AND receiver_id = v_claimer)
      OR (sender_id = v_claimer AND receiver_id = v_link.owner_id));

  SELECT * INTO v_existing FROM public.shared_tasks
  WHERE task_id = v_link.task_id AND friend_id = v_claimer;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'task_id', v_link.task_id,
      'task_name', v_task_name,
      'owner_name', v_owner_display,
      'owner_avatar', v_owner_avatar,
      'already_accepted', v_existing.accepted_at IS NOT NULL
    );
  END IF;

  INSERT INTO public.shared_tasks (task_id, friend_id, shared_by, role)
  VALUES (v_link.task_id, v_claimer, v_link.owner_id, 'editor');

  RETURN jsonb_build_object(
    'task_id', v_link.task_id,
    'task_name', v_task_name,
    'owner_name', v_owner_display,
    'owner_avatar', v_owner_avatar,
    'already_accepted', false
  );
END;
$$;


--
-- Name: consume_email_lookup_quota(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_email_lookup_quota(p_cost integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
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


--
-- Name: consume_rate_limit(text, integer, interval); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window interval) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR p_limit < 1 THEN
    -- Refuser plutôt que laisser passer : une clé absente veut dire qu'on n'a
    -- pas su identifier l'appelant, pas qu'il a droit à tout.
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limits AS rl (bucket_key, window_start, hits, updated_at)
  VALUES (p_key, now(), 1, now())
  ON CONFLICT (bucket_key) DO UPDATE
    SET
      -- Fenêtre expirée → elle glisse et le compteur repart à 1.
      window_start = CASE
        WHEN rl.window_start < now() - p_window THEN now()
        ELSE rl.window_start
      END,
      hits = CASE
        WHEN rl.window_start < now() - p_window THEN 1
        -- 🔴 LA BORNE EST `> p_limit`, PAS `>= p_limit`, et la première
        -- écriture de cette migration avait l'erreur. Avec `>=` et un plafond
        -- de 3 : le 3ᵉ appel écrit 3 (accepté, correct), puis le 4ᵉ trouve
        -- `hits >= 3`, laisse 3, et `3 <= 3` le déclare ACCEPTÉ — le plafond
        -- ne refusait jamais rien. Avec `>`, le 4ᵉ écrit 4, `4 <= 3` le
        -- refuse, et le 5ᵉ trouve `4 > 3` et laisse 4.
        --
        -- Le compteur se stabilise donc à `p_limit + 1` : il refuse, et il
        -- cesse de croître. C'est voulu — une valeur qui monterait sans fin
        -- n'apporte rien et déborderait un `INTEGER` sur un abus long.
        WHEN rl.hits > p_limit THEN rl.hits
        ELSE rl.hits + 1
      END,
      updated_at = now()
  RETURNING rl.hits INTO v_hits;

  RETURN v_hits <= p_limit;
END;
$$;


--
-- Name: create_org_email_invitations(uuid, text[], uuid, uuid[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_org_email_invitations(p_org uuid, p_emails text[], p_manager uuid DEFAULT NULL::uuid, p_team_ids uuid[] DEFAULT '{}'::uuid[], p_access_days integer DEFAULT NULL::integer) RETURNS TABLE(email text, token uuid, status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
  v_email text;
  v_token uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Un admin place où il veut ; un membre avec member.invite, nulle part.
  IF NOT (
    public.is_org_admin(p_org)
    OR (p_manager IS NULL AND public.my_org_perm(p_org, 'member.invite'))
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(array_length(p_emails, 1), 0) > 50 THEN
    RAISE EXCEPTION 'too_many_emails' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_team_ids, '{}')) t
              WHERE NOT EXISTS (SELECT 1 FROM public.org_teams WHERE id = t AND org_id = p_org)) THEN
    RAISE EXCEPTION 'team_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  -- Une équipe donne de la visibilité : un non-admin n'y fait entrer
  -- l'invité que s'il gère lui-même cette équipe (admin, créateur, responsable).
  IF NOT public.is_org_admin(p_org)
     AND EXISTS (SELECT 1 FROM unnest(COALESCE(p_team_ids, '{}')) t WHERE NOT public.can_manage_team(t)) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_email := lower(btrim(v_email));
    CONTINUE WHEN v_email = '';
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      email := v_email; token := NULL; status := 'invalid'; RETURN NEXT;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.organization_members m
        JOIN auth.users u ON u.id = m.user_id
       WHERE m.org_id = p_org AND lower(u.email) = v_email
    ) THEN
      email := v_email; token := NULL; status := 'already_member'; RETURN NEXT;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.org_invite_links l
       WHERE l.org_id = p_org AND lower(l.email) = v_email
         AND l.claimed_at IS NULL AND l.expires_at > now()
    ) THEN
      email := v_email; token := NULL; status := 'already_invited'; RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.org_invite_links (org_id, manager_id, created_by, email, team_ids, access_days)
    VALUES (p_org, p_manager, auth.uid(), v_email, COALESCE(p_team_ids, '{}'), p_access_days)
    RETURNING id INTO v_token;
    email := v_email; token := v_token; status := 'created'; RETURN NEXT;
  END LOOP;
END;
$_$;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    join_code text NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    industry text,
    avatar_url text,
    CONSTRAINT organizations_description_check CHECK (((description IS NULL) OR (char_length(description) <= 500))),
    CONSTRAINT organizations_industry_check CHECK (((industry IS NULL) OR (char_length(industry) <= 80))),
    CONSTRAINT organizations_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80)))
);


--
-- Name: create_organization(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_organization(p_name text) RETURNS public.organizations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_name TEXT;
  v_code TEXT;
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := public.sanitize_display_name(p_name);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Invalid organization name';
  END IF;

  FOR attempt IN 1..5 LOOP
    v_code := public.generate_join_code();
    BEGIN
      INSERT INTO public.organizations (name, join_code, owner_id)
      VALUES (v_name, v_code, auth.uid())
      RETURNING * INTO v_org;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'admin');

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN v_org;
END;
$$;


--
-- Name: create_profile_for_new_user(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_for_new_user(p_id uuid, p_email text, p_meta jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE
  -- Whitelist alignée sur src/lib/attribution.ts. Une valeur non conforme
  -- (espaces, HTML, accents, > 40 caractères) devient NULL plutôt que d'être
  -- tronquée ou nettoyée : on ne veut pas inventer un canal qui n'existe pas.
  c_source_re CONSTANT TEXT := '^[a-z0-9_-]{1,40}$';
  c_aff_re    CONSTANT TEXT := '^[a-z0-9-]{2,40}$';
  v_source    TEXT;
  v_campaign  TEXT;
  v_aff_slug  TEXT;
  v_aff_id    UUID;
BEGIN
  v_source := p_meta->>'acquisition_source';
  IF v_source IS NULL OR v_source !~ c_source_re THEN
    v_source := NULL;
  END IF;

  v_campaign := p_meta->>'acquisition_campaign';
  IF v_campaign IS NULL OR v_campaign !~ c_source_re THEN
    v_campaign := NULL;
  END IF;

  v_aff_slug := p_meta->>'affiliate_slug';
  IF v_aff_slug IS NOT NULL AND v_aff_slug ~ c_aff_re THEN
    SELECT l.affiliate_id INTO v_aff_id
      FROM public.affiliate_links l WHERE l.slug = v_aff_slug;
  END IF;
  IF v_aff_id IS NULL THEN
    v_aff_slug := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, display_name, avatar_url, account_type,
    acquisition_source, acquisition_campaign,
    affiliate_id, affiliate_slug, affiliated_at
  )
  VALUES (
    p_id,
    p_email,
    COALESCE(public.sanitize_display_name(p_meta->>'name'), split_part(p_email, '@', 1)),
    p_meta->>'avatar_url',
    CASE WHEN p_meta->>'account_type' = 'business'
         THEN 'business' ELSE 'personal' END,
    v_source,
    v_campaign,
    v_aff_id,
    v_aff_slug,
    CASE WHEN v_aff_id IS NOT NULL THEN now() END
  )
  ON CONFLICT (id) DO NOTHING;
END;
$_$;


--
-- Name: create_team_project_with_tasks(uuid, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb DEFAULT '[]'::jsonb, p_milestones jsonb DEFAULT '[]'::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_id   uuid := gen_random_uuid();
  v_task jsonb;
BEGIN
  -- `p_milestones` : ignoré depuis la mig. 206, gardé pour les anciens bundles.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF jsonb_typeof(COALESCE(p_tasks, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'create_team_project_with_tasks: tasks must be an array';
  END IF;
  IF jsonb_array_length(COALESCE(p_tasks, '[]'::jsonb)) > 200 THEN
    RAISE EXCEPTION 'create_team_project_with_tasks: too many items (200 tasks)';
  END IF;

  INSERT INTO public.team_projects (
    id, org_id, created_by, name, color, team_id, category_id,
    description, owner_id, status, start_date, due_date, is_template, template_payload
  ) VALUES (
    v_id, p_org, v_uid,
    p_project->>'name',
    COALESCE(NULLIF(p_project->>'color', ''), 'blue'),
    NULLIF(p_project->>'team_id', '')::uuid,
    NULLIF(p_project->>'category_id', '')::uuid,
    NULLIF(p_project->>'description', ''),
    NULLIF(p_project->>'owner_id', '')::uuid,
    COALESCE(NULLIF(p_project->>'status', ''), 'active'),
    NULLIF(p_project->>'start_date', '')::date,
    NULLIF(p_project->>'due_date', '')::date,
    COALESCE((p_project->>'is_template')::boolean, false),
    CASE WHEN jsonb_typeof(p_project->'template_payload') = 'object'
         THEN p_project->'template_payload' END
  );

  FOR v_task IN SELECT * FROM jsonb_array_elements(COALESCE(p_tasks, '[]'::jsonb)) LOOP
    INSERT INTO public.team_tasks (
      org_id, created_by, project_id, name, description, priority,
      deadline, start_date, estimated_time, assignee_ids, status, category_id
    ) VALUES (
      p_org, v_uid, v_id,
      v_task->>'name',
      NULLIF(v_task->>'description', ''),
      COALESCE((v_task->>'priority')::int, 3),
      NULLIF(v_task->>'deadline', '')::date,
      NULLIF(v_task->>'start_date', '')::date,
      (v_task->>'estimated_time')::int,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_task->'assignee_ids', '[]'::jsonb))::uuid),
        ARRAY[]::uuid[]
      ),
      'todo',
      NULLIF(v_task->>'category_id', '')::uuid
    );
  END LOOP;

  RETURN v_id;
END;
$$;


--
-- Name: cron_invoke(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_invoke(p_job text) RETURNS bigint
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_path   text;
  v_url    text;
  v_secret text;
  v_req    bigint;
  v_id     bigint;
BEGIN
  v_path := CASE p_job
    WHEN 'org-webhook-dispatch' THEN 'org-webhook-dispatch'
    WHEN 'org-digest-hourly'    THEN 'org-digest?mode=hourly'
    WHEN 'org-digest-daily'     THEN 'org-digest?mode=daily'
    WHEN 'renewal-notice'       THEN 'renewal-notice'
    WHEN 'seat-alert'           THEN 'seat-alert'
    WHEN 'inactive-accounts'    THEN 'inactive-accounts'
  END;
  IF v_path IS NULL THEN
    RAISE EXCEPTION 'cron_invoke : job inconnu (%)', p_job USING ERRCODE = '22023';
  END IF;

  SELECT s.decrypted_secret INTO v_url
    FROM vault.decrypted_secrets s WHERE s.name = 'cosmo_project_url';
  SELECT s.decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets s WHERE s.name = 'cosmo_cron_secret';

  -- Secret absent = une ligne en échec, jamais un silence.
  IF coalesce(v_url, '') = '' OR coalesce(v_secret, '') = '' THEN
    INSERT INTO public.cron_runs (job, finished_at, status, detail)
    VALUES (p_job, now(), 'config_missing',
            'secret Vault absent : cosmo_project_url ou cosmo_cron_secret')
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- 300 s : au-delà de la limite d'exécution d'une Edge Function (150 s en
  -- Free, 400 s au-dessus), pour que ce soit la fonction qui tranche, pas le
  -- client. Corps vide : chaque fonction lit sa sélection en base.
  v_req := net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || v_path,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 300000
  );

  INSERT INTO public.cron_runs (job, request_id) VALUES (p_job, v_req) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: cron_lease_acquire(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_lease_acquire(p_job text, p_ttl_seconds integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_token uuid := gen_random_uuid();
  v_got   uuid;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 30 OR p_ttl_seconds > 3600 THEN
    RAISE EXCEPTION 'cron_lease_acquire : duree de bail hors bornes (%)', p_ttl_seconds
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.cron_leases AS l (job, token, locked_until, acquired_at)
  VALUES (p_job, v_token, now() + make_interval(secs => p_ttl_seconds), now())
  ON CONFLICT (job) DO UPDATE
     SET token = EXCLUDED.token,
         locked_until = EXCLUDED.locked_until,
         acquired_at = EXCLUDED.acquired_at
   WHERE l.locked_until <= now()
  RETURNING l.token INTO v_got;
  RETURN v_got;
END;
$$;


--
-- Name: cron_lease_release(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_lease_release(p_job text, p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.cron_leases
     SET locked_until = now()
   WHERE job = p_job AND token = p_token AND locked_until > now();
  RETURN FOUND;
END;
$$;


--
-- Name: cron_run_status(integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_run_status(p_http_code integer, p_timed_out boolean) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN p_timed_out IS TRUE THEN 'timeout'
    WHEN p_http_code BETWEEN 200 AND 299 THEN 'ok'
    ELSE 'error'
  END;
$$;


--
-- Name: cron_runs_close(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_runs_close() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_closed integer;
BEGIN
  UPDATE public.cron_runs r
     SET finished_at = x.created,
         http_code = x.status_code,
         status = public.cron_run_status(x.status_code, x.timed_out),
         detail = left(x.error_msg, 300)
    FROM net._http_response x
   WHERE r.status = 'started'
     AND x.id = r.request_id;
  GET DIAGNOSTICS v_closed = ROW_COUNT;

  UPDATE public.cron_runs
     SET status = 'lost',
         finished_at = now(),
         detail = 'aucune reponse pg_net une heure apres l envoi'
   WHERE status = 'started'
     AND started_at < now() - interval '1 hour';

  DELETE FROM public.cron_runs WHERE started_at < now() - interval '90 days';

  RETURN v_closed;
END;
$$;


--
-- Name: cron_runs_verdict(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cron_runs_verdict(p_now timestamp with time zone DEFAULT now()) RETURNS TABLE(job text, fenetre interval, dernier_debut timestamp with time zone, dernier_statut text, dernier_code integer, dernier_ok timestamp with time zone, verdict text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  WITH attendus (job, fenetre) AS (
    VALUES
      ('org-webhook-dispatch', interval '35 minutes'),
      ('org-digest-hourly',    interval '2 hours 15 minutes'),
      ('org-digest-daily',     interval '26 hours'),
      ('renewal-notice',       interval '26 hours'),
      ('seat-alert',           interval '26 hours'),
      ('inactive-accounts',    interval '26 hours')
  )
  SELECT a.job,
         a.fenetre,
         d.started_at,
         d.status,
         d.http_code,
         o.started_at,
         CASE
           WHEN d.started_at IS NULL OR d.started_at < p_now - a.fenetre THEN 'absent'
           WHEN o.started_at IS NULL OR o.started_at < p_now - a.fenetre THEN 'echec'
           ELSE 'ok'
         END
    FROM attendus a
    LEFT JOIN LATERAL (
      SELECT r.started_at, r.status, r.http_code
        FROM public.cron_runs r
       WHERE r.job = a.job AND r.started_at <= p_now
       ORDER BY r.started_at DESC
       LIMIT 1
    ) d ON true
    LEFT JOIN LATERAL (
      SELECT max(r.started_at) AS started_at
        FROM public.cron_runs r
       WHERE r.job = a.job AND r.status = 'ok' AND r.started_at <= p_now
    ) o ON true
   ORDER BY a.job;
$$;


--
-- Name: delete_organization(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_organization(p_org uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT owner_id INTO v_owner
    FROM public.organizations WHERE id = p_org;

  -- Organisation inexistante et organisation d'autrui rendent le MÊME refus :
  -- les distinguer serait un oracle d'existence sur `organizations`.
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not_org_owner';
  END IF;

  -- 🔴 CE REFUS EST LE FILET SERVEUR, PAS LE PARCOURS.
  --
  -- L'arbitrage du 2026-09-03 décide : « la suppression résilie ET REMBOURSE »
  -- — on résilie, on rembourse la période en cours, puis on supprime, EN UN
  -- SEUL GESTE, « aucun débit orphelin ». C'est ce que fait l'écran :
  -- `OrganizationPage` appelle `stripe-org-refund` (C-65) et n'enchaîne sur
  -- `delete_organization` QUE si le remboursement a réussi.
  --
  -- Cette garde-ci ne double pas ce parcours, elle le rend obligatoire. La RPC
  -- est la seule porte vers un DELETE sur `organizations` (aucune policy
  -- DELETE) : sans elle, un appel direct — devtools, script, futur écran
  -- distrait — supprimerait l'organisation en laissant l'abonnement courir.
  -- Un contrôle qui vit dans l'écran seul n'est pas un contrôle.
  --
  -- ⚠️ Elle ne se déclenche donc JAMAIS sur le parcours nominal : au moment où
  --    `delete_organization` est appelée, `stripe-org-refund` a déjà résilié,
  --    et le webhook a passé la ligne en `cancelled`. Une garde qui ne se
  --    déclenche jamais sur le chemin normal est exactement ce qu'on veut sur
  --    un chemin qui déplace de l'argent.
  --
  -- Sans elle : on supprimerait la ligne que le webhook Stripe vient mettre à
  -- jour, le prochain event tenterait un upsert sur une clé étrangère morte,
  -- et le client continuerait d'être débité pour une organisation qui n'existe
  -- plus.
  IF EXISTS (
    SELECT 1 FROM public.org_subscriptions
     WHERE org_id = p_org
       AND status IN ('active', 'trialing', 'past_due')
  ) THEN
    RAISE EXCEPTION 'org_has_active_subscription';
  END IF;

  DELETE FROM public.organizations WHERE id = p_org;
END;
$$;


--
-- Name: delete_team_with_transfer(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_team_with_transfer(p_team uuid, p_target uuid, p_archive_projects boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_org UUID;
  v_target_org UUID;
BEGIN
  SELECT org_id INTO v_org FROM public.org_teams WHERE id = p_team;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'team_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_target IS NOT NULL THEN
    IF p_target = p_team THEN
      RAISE EXCEPTION 'team_transfer_same_team' USING ERRCODE = '22023';
    END IF;
    SELECT org_id INTO v_target_org FROM public.org_teams WHERE id = p_target;
    IF v_target_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'team_transfer_target_invalid' USING ERRCODE = '22023';
    END IF;

    UPDATE public.team_projects
       SET team_id = p_target,
           archived_at = CASE
             WHEN p_archive_projects THEN COALESCE(archived_at, NOW())
             ELSE archived_at
           END
     WHERE team_id = p_team;

    -- Lien vers la cible AVANT le retrait (cf. en-tête, ordre des OKR).
    INSERT INTO public.team_okr_teams (okr_id, org_id, team_id)
    SELECT l.okr_id, l.org_id, p_target
      FROM public.team_okr_teams l
     WHERE l.team_id = p_team
    ON CONFLICT (okr_id, team_id) DO NOTHING;
  END IF;

  -- Sans cible, seuls les OKR PARTAGÉS avec une autre équipe perdent ce lien :
  -- ils gardent une audience fermée. Un OKR dont c'est le seul lien reste
  -- rattaché, et la clé étrangère refuse la suppression plus bas.
  DELETE FROM public.team_okr_teams l
   WHERE l.team_id = p_team
     AND EXISTS (SELECT 1 FROM public.team_okr_teams o
                  WHERE o.okr_id = l.okr_id AND o.team_id <> p_team);

  DELETE FROM public.org_teams WHERE id = p_team;
  IF NOT FOUND THEN
    -- La policy DELETE ne l'a pas laissé passer : ni admin, ni créateur.
    RAISE EXCEPTION 'team_delete_forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;


--
-- Name: drop_muted_org_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.drop_muted_org_notification() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.kind <> 'org_removed' AND EXISTS (
    SELECT 1 FROM public.org_notification_settings s
     WHERE s.org_id = NEW.org_id AND s.user_id = NEW.user_id
       AND NEW.kind = ANY (s.muted_kinds)
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_category_tree(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_category_tree() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  ancestor        UUID;
  ancestor_owner  UUID;
  depth           INTEGER := 1;
  hops            INTEGER := 0;
  branch_height   INTEGER := 1;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A category cannot be its own parent';
  END IF;

  SELECT user_id INTO ancestor_owner FROM public.categories WHERE id = NEW.parent_id;
  IF ancestor_owner IS NULL THEN
    RAISE EXCEPTION 'Parent category does not exist';
  END IF;
  IF ancestor_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'A category must stay within a single account';
  END IF;

  -- Remontée des ancêtres : cycle et profondeur d'un seul parcours.
  -- `hops` borne le parcours même si un cycle existait déjà en données.
  ancestor := NEW.parent_id;
  WHILE ancestor IS NOT NULL AND hops <= 64 LOOP
    IF ancestor = NEW.id THEN
      RAISE EXCEPTION 'This parent would create a cycle';
    END IF;
    depth := depth + 1;
    IF depth > 10 THEN
      RAISE EXCEPTION 'Category nesting is limited to 10 levels';
    END IF;
    SELECT parent_id INTO ancestor FROM public.categories WHERE id = ancestor;
    hops := hops + 1;
  END LOOP;

  -- 🔴 LA PROFONDEUR DU NŒUD ÉCRIT NE SUFFIT PAS.
  -- La boucle ci-dessus ne mesure que `NEW`. Déplacer une branche haute de 4
  -- crans sous un nœud au niveau 8 met ses FEUILLES au niveau 12, alors que
  -- `NEW` lui-même n'atteint que 9 : les lignes descendantes ne sont pas
  -- écrites, donc le trigger ne part jamais pour elles. Il faut ajouter la
  -- HAUTEUR de la branche déplacée. (`wouldExceedMaxDepth` en est le miroir
  -- client, dans `src/modules/categories/tree.ts`.)
  --
  -- ⚠️ `node_depth`, et surtout PAS `depth` : c'est la collision avec la
  -- variable PL/pgSQL du même nom qui a fait échouer la 143 (et qui a
  -- survécu en prod jusqu'à cette migration malgré la 144).
  --
  -- ⚠️ `node_depth < 64` borne la descente : le trigger interdit les cycles,
  -- mais une base restaurée ne doit pas pouvoir faire boucler la récursion.
  WITH RECURSIVE branch(node_id, node_depth) AS (
    SELECT NEW.id, 1
    UNION ALL
    SELECT c.id, b.node_depth + 1
      FROM public.categories c
      JOIN branch b ON c.parent_id = b.node_id
     WHERE b.node_depth < 64
  )
  SELECT max(b.node_depth) INTO branch_height FROM branch b;

  IF depth + COALESCE(branch_height, 1) - 1 > 10 THEN
    RAISE EXCEPTION 'Category nesting is limited to 10 levels';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_org_invite_domain(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_org_invite_domain() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: enforce_org_member_role_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_org_member_role_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.org_id := OLD.org_id;
    NEW.role_id := OLD.role_id;
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
    NEW.granted_by := OLD.granted_by;
    IF NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
      NEW.expiry_notified_at := NULL;
    END IF;
  ELSE
    NEW.granted_by := (SELECT auth.uid());
    NEW.created_at := now();
    NEW.expiry_notified_at := NULL;
    IF NOT EXISTS (
      SELECT 1 FROM public.org_roles WHERE id = NEW.role_id AND org_id = NEW.org_id
    ) THEN
      RAISE EXCEPTION 'org_member_roles: role belongs to another organization';
    END IF;
  END IF;

  -- Un admin détient tout par construction (même règle que la mig. 115).
  -- Vérifié à l'attribution et à la prolongation seulement : un membre promu
  -- admin APRÈS coup garde une ligne inerte (le court-circuit admin passe
  -- avant), et le job d'expiration doit pouvoir la marquer sans échouer.
  IF (TG_OP = 'INSERT'
      OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
      OR NEW.starts_at IS DISTINCT FROM OLD.starts_at)
     AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'org_member_roles: an admin always holds every permission';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_org_permission_ceiling(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_org_permission_ceiling() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'org_member_permissions: an admin always holds every permission';
  END IF;

  IF NOT public.is_org_admin(NEW.org_id) THEN
    IF EXISTS (
      SELECT 1 FROM (VALUES
        (NEW.can_create_task,     'task.create'),
        (NEW.can_edit_any_task,   'task.editAny'),
        (NEW.can_delete_task,     'task.deleteAny'),
        (NEW.can_create_project,  'project.create'),
        (NEW.can_edit_project,    'project.edit'),
        (NEW.can_delete_project,  'project.delete'),
        (NEW.can_create_okr,      'okr.create'),
        (NEW.can_delete_okr,      'okr.delete'),
        (NEW.can_manage_category, 'category.manage'),
        (NEW.can_create_team,     'team.create'),
        (NEW.can_invite_member,   'member.invite'),
        (NEW.can_view_org_report,       'report.org'),
        (NEW.can_view_all_team_reports, 'report.allTeams'),
        (NEW.can_manage_roles,    'role.manage')
      ) AS c(granted, perm_key)
      WHERE c.granted IS TRUE
        AND NOT CASE c.perm_key
          WHEN 'project.edit' THEN public.my_project_edit_perm(NEW.org_id)
          WHEN 'report.org' THEN public.my_report_perm(NEW.org_id, 'report.org')
          WHEN 'report.allTeams' THEN public.my_report_perm(NEW.org_id, 'report.allTeams')
          ELSE public.my_org_perm(NEW.org_id, c.perm_key)
        END
    ) THEN
      RAISE EXCEPTION 'org_member_permissions: cannot grant a permission you do not hold';
    END IF;

    IF NEW.assign_targets IS NOT NULL
       AND NOT (NEW.assign_targets <@ public.my_assign_targets(NEW.org_id)) THEN
      RAISE EXCEPTION 'org_member_permissions: cannot grant an assignment scope wider than yours';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$$;


--
-- Name: enforce_org_role_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_org_role_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid());
    NEW.created_at := now();
  ELSE
    NEW.org_id := OLD.org_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.granted_keys := ARRAY(SELECT DISTINCT k FROM unnest(NEW.granted_keys) AS k ORDER BY 1);
  NEW.assign_targets := ARRAY(SELECT DISTINCT t FROM unnest(NEW.assign_targets) AS t ORDER BY 1);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: enforce_org_settings_default_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_org_settings_default_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.default_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_roles r WHERE r.id = NEW.default_role_id AND r.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'org_settings: default role belongs to another organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_profile_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_profile_integrity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: enforce_team_category_tree(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_team_category_tree() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  ancestor        UUID;
  ancestor_org    UUID;
  depth           INTEGER := 1;
  hops            INTEGER := 0;
  branch_height   INTEGER := 1;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A category cannot be its own parent';
  END IF;

  SELECT org_id INTO ancestor_org FROM public.team_categories WHERE id = NEW.parent_id;
  IF ancestor_org IS NULL THEN
    RAISE EXCEPTION 'Parent category does not exist';
  END IF;
  IF ancestor_org <> NEW.org_id THEN
    RAISE EXCEPTION 'A category must stay within a single organization';
  END IF;

  ancestor := NEW.parent_id;
  WHILE ancestor IS NOT NULL AND hops <= 64 LOOP
    IF ancestor = NEW.id THEN
      RAISE EXCEPTION 'This parent would create a cycle';
    END IF;
    depth := depth + 1;
    IF depth > 10 THEN
      RAISE EXCEPTION 'Category nesting is limited to 10 levels';
    END IF;
    SELECT parent_id INTO ancestor FROM public.team_categories WHERE id = ancestor;
    hops := hops + 1;
  END LOOP;

  -- Hauteur de la branche déplacée, pas seulement la profondeur du nœud écrit
  -- (même correctif que la mig. 147, avec le même `node_id`/`node_depth`
  -- pour ne jamais rejouer la collision de nom qui l'a fait échouer deux fois).
  WITH RECURSIVE branch(node_id, node_depth) AS (
    SELECT NEW.id, 1
    UNION ALL
    SELECT c.id, b.node_depth + 1
      FROM public.team_categories c
      JOIN branch b ON c.parent_id = b.node_id
     WHERE b.node_depth < 64
  )
  SELECT max(b.node_depth) INTO branch_height FROM branch b;

  IF depth + COALESCE(branch_height, 1) - 1 > 10 THEN
    RAISE EXCEPTION 'Category nesting is limited to 10 levels';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_team_project_archive_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_team_project_archive_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NOT public.my_org_perm(NEW.org_id, 'project.delete') THEN
    RAISE EXCEPTION 'team_projects: archiving a project requires the project deletion permission';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_team_project_edit_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_team_project_edit_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
       WHERE m.org_id = NEW.org_id AND m.user_id = NEW.owner_id
     ) THEN
    RAISE EXCEPTION 'team_projects: the owner must be a member of the organization';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NOT public.my_project_edit_perm(NEW.org_id)
     AND (NEW.team_id     IS DISTINCT FROM OLD.team_id
       OR NEW.owner_id    IS DISTINCT FROM OLD.owner_id
       OR NEW.is_template IS DISTINCT FROM OLD.is_template) THEN
    RAISE EXCEPTION 'team_projects: changing the team, owner or template flag requires the project edit permission';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_team_task_assign_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_team_task_assign_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_old uuid[] := CASE WHEN TG_OP = 'UPDATE'
                       THEN COALESCE(OLD.assignee_ids, ARRAY[]::uuid[])
                       ELSE ARRAY[]::uuid[] END;
  v_uid uuid;
BEGIN
  FOREACH v_uid IN ARRAY COALESCE(NEW.assignee_ids, ARRAY[]::uuid[]) LOOP
    IF NOT (v_uid = ANY (v_old)) AND NOT public.can_assign_to(NEW.org_id, v_uid) THEN
      RAISE EXCEPTION 'team_tasks: your assignment scope does not cover this member';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: enforce_team_task_project_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_team_task_project_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_org_admin(NEW.org_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.my_project_role(NEW.project_id) = 'viewer' THEN
      RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Déplacer une tâche VERS un projet où je ne fais que lire : refusé.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     AND public.my_project_role(NEW.project_id) = 'viewer' THEN
    RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
  END IF;

  -- Modifier une tâche d'un projet où je ne fais que lire : seulement si elle
  -- m'est assignée (je dois pouvoir faire avancer MON travail).
  IF public.my_project_role(OLD.project_id) = 'viewer'
     AND NOT (v_uid = ANY (COALESCE(OLD.assignee_ids, ARRAY[]::uuid[]))) THEN
    RAISE EXCEPTION 'project_viewer_read_only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enqueue_team_task_webhook(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_team_task_webhook(p_task uuid, p_event text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_payload jsonb;
  v_org     uuid;
BEGIN
  -- Hors trigger : rien. Pas d'erreur non plus (aucun oracle).
  IF pg_trigger_depth() = 0 THEN
    RETURN;
  END IF;
  IF p_event NOT IN ('task.created', 'task.status_changed', 'task.completed') THEN
    RETURN;
  END IF;
  SELECT t.org_id INTO v_org FROM public.team_tasks t WHERE t.id = p_task;
  IF v_org IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.org_webhooks w WHERE w.org_id = v_org AND w.enabled AND p_event = ANY (w.events)
  ) THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_access_team_task(p_task) THEN
    RETURN;
  END IF;

  SELECT jsonb_build_object(
           'event', p_event,
           'occurred_at', now(),
           'organization', o.name,
           'task', jsonb_build_object(
             'id', t.id, 'name', t.name, 'status', t.status, 'priority', t.priority,
             'deadline', t.deadline, 'project', p.name
           )
         )
    INTO v_payload
    FROM public.team_tasks t
    JOIN public.team_projects p ON p.id = t.project_id
    JOIN public.organizations o ON o.id = t.org_id
   WHERE t.id = p_task;

  INSERT INTO public.org_webhook_deliveries (webhook_id, org_id, event, payload)
  SELECT w.id, w.org_id, p_event, v_payload
    FROM public.org_webhooks w
   WHERE w.org_id = v_org AND w.enabled AND p_event = ANY (w.events);
END;
$$;


--
-- Name: events_enforce_created_by(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.events_enforce_created_by() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- created_by immuable côté client (transfert service_role toléré : NULL).
    IF NEW.created_by IS DISTINCT FROM OLD.created_by AND auth.uid() IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: expire_org_member_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_org_member_roles() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  a record;
  n integer := 0;
BEGIN
  FOR a IN
    SELECT mr.id, mr.org_id, mr.role_id, mr.user_id, mr.granted_by, r.name AS role_name
      FROM public.org_member_roles mr
      JOIN public.org_roles r ON r.id = mr.role_id
     WHERE mr.ends_at IS NOT NULL
       AND mr.ends_at <= now()
       AND mr.expiry_notified_at IS NULL
     FOR UPDATE OF mr SKIP LOCKED
  LOOP
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (a.org_id, a.user_id, NULL, 'role_changed',
            jsonb_build_object('change', 'custom_role_expired', 'for', 'holder',
                               'role_id', a.role_id, 'role_name', a.role_name));

    IF a.granted_by IS NOT NULL AND a.granted_by <> a.user_id
       AND EXISTS (SELECT 1 FROM public.organization_members
                    WHERE org_id = a.org_id AND user_id = a.granted_by) THEN
      INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
      VALUES (a.org_id, a.granted_by, NULL, 'role_changed',
              jsonb_build_object('change', 'custom_role_expired', 'for', 'granter',
                                 'role_id', a.role_id, 'role_name', a.role_name, 'member_id', a.user_id));
    END IF;

    PERFORM public.write_org_audit(a.org_id, 'role.expired', 'role', a.role_id, a.user_id,
      jsonb_build_object('name', a.role_name));

    UPDATE public.org_member_roles SET expiry_notified_at = now() WHERE id = a.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;


--
-- Name: forbid_consent_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forbid_consent_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.org_id IS NOT NULL
     AND NEW.org_id IS NULL
     -- Le reste de la ligne doit être STRICTEMENT identique. On compare les
     -- colonnes une à une plutôt que `NEW IS DISTINCT FROM OLD` : une colonne
     -- ajoutée plus tard doit faire ÉCHOUER la comparaison, pas passer.
     AND NEW.id                  IS NOT DISTINCT FROM OLD.id
     AND NEW.user_id             IS NOT DISTINCT FROM OLD.user_id
     AND NEW.tier_key            IS NOT DISTINCT FROM OLD.tier_key
     AND NEW.billing_interval    IS NOT DISTINCT FROM OLD.billing_interval
     AND NEW.immediate_execution IS NOT DISTINCT FROM OLD.immediate_execution
     AND NEW.waives_withdrawal   IS NOT DISTINCT FROM OLD.waives_withdrawal
     AND NEW.consented_at        IS NOT DISTINCT FROM OLD.consented_at
  THEN
    -- Détachement par `ON DELETE SET NULL` : l'organisation disparaît, la
    -- preuve reste.
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'withdrawal_consents est une preuve append-only : ni UPDATE ni DELETE (seul le detachement org_id -> NULL est permis, mig. 138).'
    USING ERRCODE = 'restrict_violation';
END;
$$;


--
-- Name: forbid_payment_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forbid_payment_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  RAISE EXCEPTION
    'payment_records est un journal append-only : ni UPDATE ni DELETE. Pour corriger, inserer une ligne compensatoire.'
    USING ERRCODE = 'restrict_violation';
END;
$$;


--
-- Name: freeze_team_membership_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freeze_team_membership_identity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.org_id  IS DISTINCT FROM OLD.org_id
  THEN
    RAISE EXCEPTION 'Team membership identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_due_activity_reports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_due_activity_reports() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  r record;
  t record;
  v_day date;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT o.id, COALESCE(s.timezone, 'Europe/Paris') AS tz
      FROM public.organizations o
      LEFT JOIN public.org_settings s ON s.org_id = o.id
  LOOP
    v_day := (now() AT TIME ZONE r.tz)::date - 1;

    -- Équipes d'abord : le rapport d'entreprise n'en dépend pas, mais un
    -- échec sur l'une ne doit pas empêcher les autres (bloc par équipe).
    FOR t IN SELECT id FROM public.org_teams WHERE org_id = r.id LOOP
      IF NOT EXISTS (SELECT 1 FROM public.org_activity_reports WHERE team_id = t.id AND day = v_day) THEN
        BEGIN
          INSERT INTO public.org_activity_reports (org_id, scope, team_id, day, payload)
          VALUES (r.id, 'team', t.id, v_day, public.build_org_activity_report(r.id, t.id, v_day, r.tz));
          v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'activity report team % day %: %', t.id, v_day, SQLERRM;
        END;
      END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.org_activity_reports WHERE org_id = r.id AND scope = 'org' AND day = v_day) THEN
      BEGIN
        INSERT INTO public.org_activity_reports (org_id, scope, day, payload)
        VALUES (r.id, 'org', v_day, public.build_org_activity_report(r.id, NULL, v_day, r.tz));
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'activity report org % day %: %', r.id, v_day, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


--
-- Name: generate_join_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_join_code() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars
  v_code TEXT := 'COSMO-';
  v_byte INT;
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    LOOP
      v_byte := get_byte(extensions.gen_random_bytes(1), 0);
      EXIT WHEN v_byte < 248;   -- rejet → tirage uniforme sur 31 symboles
    END LOOP;
    v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$$;


--
-- Name: get_admin_onboarding_funnel(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_onboarding_funnel(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  excluded uuid[];
  since    timestamptz;
  result   jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();
  -- Bornée : une fenêtre absurde ne doit pas balayer toute la base.
  since := NOW() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365));

  WITH cohort AS (
    SELECT u.id, u.created_at, COALESCE(p.account_type, 'personal') AS account_type
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.created_at >= since
      AND u.id <> ALL(excluded)
  ),
  perso AS (
    SELECT
      c.id,
      EXISTS (SELECT 1 FROM public.tasks t WHERE t.user_id = c.id
                AND t.created_at < c.created_at + INTERVAL '1 day') AS has_task,
      EXISTS (SELECT 1 FROM public.events e WHERE e.user_id = c.id AND e.task_id IS NOT NULL
                AND e.created_at < c.created_at + INTERVAL '1 day') AS has_slot,
      EXISTS (SELECT 1 FROM public.habits h WHERE h.user_id = c.id
                AND h.created_at < c.created_at + INTERVAL '1 day') AS has_habit,
      EXISTS (SELECT 1 FROM public.okrs o WHERE o.user_id = c.id
                AND o.created_at < c.created_at + INTERVAL '1 day') AS has_okr,
      EXISTS (SELECT 1 FROM public.user_activity_days a WHERE a.user_id = c.id
                AND a.day >= (c.created_at + INTERVAL '7 days')::date
                AND a.day <  (c.created_at + INTERVAL '14 days')::date) AS came_back,
      c.created_at <= NOW() - INTERVAL '14 days' AS mature
    FROM cohort c
  ),
  orgs AS (
    SELECT
      o.id,
      EXISTS (SELECT 1 FROM public.org_teams t WHERE t.org_id = o.id
                AND t.created_at < o.created_at + INTERVAL '1 day') AS has_team,
      EXISTS (SELECT 1 FROM public.team_projects tp WHERE tp.org_id = o.id
                AND tp.created_at < o.created_at + INTERVAL '1 day') AS has_project,
      EXISTS (SELECT 1 FROM public.team_okrs k WHERE k.org_id = o.id
                AND k.created_at < o.created_at + INTERVAL '1 day') AS has_okr,
      (SELECT COUNT(*) FROM public.organization_members m WHERE m.org_id = o.id) > 1 AS has_member
    FROM public.organizations o
    WHERE o.created_at >= since
      AND o.owner_id <> ALL(excluded)
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'window_days', LEAST(GREATEST(COALESCE(p_days, 30), 1), 365),
    'perso', (
      SELECT jsonb_build_object(
        'signups', COUNT(*),
        'with_task', COUNT(*) FILTER (WHERE has_task),
        'with_slot', COUNT(*) FILTER (WHERE has_slot),
        'with_habit', COUNT(*) FILTER (WHERE has_habit),
        'with_okr', COUNT(*) FILTER (WHERE has_okr),
        -- Le retour ne se juge que sur les inscrits d'au moins 14 jours.
        'mature', COUNT(*) FILTER (WHERE mature),
        'came_back', COUNT(*) FILTER (WHERE mature AND came_back),
        'came_back_with_task', COUNT(*) FILTER (WHERE mature AND came_back AND has_task),
        'mature_with_task', COUNT(*) FILTER (WHERE mature AND has_task)
      ) FROM perso
    ),
    'business_signups', (SELECT COUNT(*) FROM cohort WHERE account_type = 'business'),
    'orgs', (
      SELECT jsonb_build_object(
        'created', COUNT(*),
        'with_team', COUNT(*) FILTER (WHERE has_team),
        'with_member', COUNT(*) FILTER (WHERE has_member),
        'with_project', COUNT(*) FILTER (WHERE has_project),
        'with_okr', COUNT(*) FILTER (WHERE has_okr)
      ) FROM orgs
    )
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_admin_onboarding_funnel(p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_onboarding_funnel(p_days integer) IS 'Entonnoir des accueils perso et entreprise, par cohorte d''inscription (mig. 213). Totaux seulement, garde is_admin().';


--
-- Name: get_admin_revenue(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_revenue(p_days integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  result   jsonb;
  excluded uuid[];
  v_days   integer;
  v_start  timestamptz;
  v_prev   timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();
  v_days   := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_start  := date_trunc('day', now()) - make_interval(days => v_days - 1);
  v_prev   := v_start - make_interval(days => v_days);

  WITH prices(tier_key, monthly_cents, yearly_monthly_cents) AS (
    VALUES ('t10', 7000, 5250), ('t20', 15000, 11250),
           ('t50', 35000, 26250), ('t100', 70000, 52500), ('tmax', 100000, 75000)
  ),
  paid_subs AS (
    -- Abonnements payants, entreprise et particulier, avec leur MRR.
    SELECT 'org:' || o.org_id::text AS customer,
           CASE o.tier_key WHEN 't10' THEN 'Entreprise 5-10'  WHEN 't20' THEN 'Entreprise 10-20'
                           WHEN 't50' THEN 'Entreprise 20-50' WHEN 't100' THEN 'Entreprise 50-100' ELSE 'Entreprise 100+' END
             || CASE WHEN o.billing_interval = 'yearly' THEN ' (annuel)' ELSE '' END AS plan,
           CASE WHEN o.billing_interval = 'yearly' THEN p.yearly_monthly_cents ELSE p.monthly_cents END AS mrr_cents,
           o.status, o.updated_at
      FROM public.org_subscriptions o
      JOIN prices p ON p.tier_key = o.tier_key
     WHERE o.stripe_subscription_id IS NOT NULL
    UNION ALL
    SELECT 'user:' || s.user_id::text, 'Premium perso', 350, s.status, s.updated_at
      FROM public.subscriptions s
     WHERE s.plan = 'premium'
       AND s.stripe_subscription_id IS NOT NULL
       AND NOT (s.user_id = ANY (excluded))
  ),
  payments AS (
    SELECT r.occurred_at, r.amount_cents, r.event_type,
           COALESCE('org:' || r.org_id::text, 'user:' || r.user_id::text, 'cus:' || r.stripe_customer_id) AS customer
      FROM public.payment_records r
     WHERE r.currency = 'eur'
       AND (r.user_id IS NULL OR NOT (r.user_id = ANY (excluded)))
  ),
  first_paid AS (
    SELECT customer, MIN(occurred_at) AS first_at
      FROM payments
     WHERE event_type = 'invoice.payment_succeeded' AND amount_cents > 0
     GROUP BY customer
  ),
  new_subs AS (
    SELECT ps.* FROM paid_subs ps
      JOIN first_paid f ON f.customer = ps.customer
     WHERE f.first_at >= v_start AND ps.status = 'active'
  ),
  lost_subs AS (
    SELECT * FROM paid_subs WHERE status = 'cancelled' AND updated_at >= v_start
  ),
  mrr AS (
    SELECT COALESCE(SUM(mrr_cents) FILTER (WHERE status = 'active'), 0) AS now_cents FROM paid_subs
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_days', v_days,
    'currency', 'eur',
    'mrr_cents', (SELECT now_cents FROM mrr),
    'mrr_prev_cents', (SELECT now_cents FROM mrr)
                      - (SELECT COALESCE(SUM(mrr_cents), 0) FROM new_subs)
                      + (SELECT COALESCE(SUM(mrr_cents), 0) FROM lost_subs),
    'collected_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'cents', d.cents) ORDER BY d.day), '[]'::jsonb)
        FROM (
          SELECT g.day::date AS day,
                 COALESCE((SELECT SUM(p.amount_cents) FROM payments p
                            WHERE p.occurred_at >= g.day AND p.occurred_at < g.day + interval '1 day'), 0) AS cents
            FROM generate_series(v_start, date_trunc('day', now()), interval '1 day') AS g(day)
        ) d
    ),
    'collected_prev_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM payments
                              WHERE occurred_at >= v_prev AND occurred_at < v_start),
    'refunds_cents', (SELECT COALESCE(-SUM(amount_cents), 0) FROM payments
                       WHERE amount_cents < 0 AND occurred_at >= v_start),
    'paying_customers', (SELECT COUNT(DISTINCT customer) FROM payments
                          WHERE amount_cents > 0 AND occurred_at >= v_start),
    'active_subscriptions', (SELECT COUNT(*) FROM paid_subs WHERE status = 'active'),
    'new_subscriptions', (SELECT COUNT(*) FROM new_subs),
    'lost_subscriptions', (SELECT COUNT(*) FROM lost_subs),
    'churned_mrr_cents', (SELECT COALESCE(SUM(mrr_cents), 0) FROM lost_subs),
    'mrr_movements', jsonb_build_object(
      'new_cents', (SELECT COALESCE(SUM(mrr_cents), 0) FROM new_subs),
      'expansion_cents', 0,
      'contraction_cents', 0,
      'churn_cents', (SELECT COALESCE(SUM(mrr_cents), 0) FROM lost_subs)
    ),
    'mrr_by_plan', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', plan, 'cents', cents) ORDER BY cents DESC), '[]'::jsonb)
        FROM (SELECT plan, SUM(mrr_cents) AS cents FROM paid_subs WHERE status = 'active' GROUP BY plan) x
    ),
    'trials', jsonb_build_object('started', 0, 'converted', 0),
    'limitations', jsonb_build_array(
      'expansion et contraction non suivies (aucun historique de palier)',
      'mrr_prev_cents reconstitue : MRR actuel - nouveaux + perdus',
      'pas d essai gratuit dans COSMO'
    )
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_admin_revenue(p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_revenue(p_days integer) IS 'Revenu pour la page Revenu de COSMO Analytics (mig. 221). Totaux seulement, lecture seule, garde is_admin() (allowlist ET aal2).';


--
-- Name: get_admin_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  result   jsonb;
  v3       jsonb;
  excluded uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  excluded := public.admin_stats_excluded_uids();

  -- ══ v1 (mig. 056) + v2 (mig. 057) ══════════════════════════════════
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'excluded_accounts', COALESCE(array_length(excluded, 1), 0),
    'totals', jsonb_build_object(
      'users', (SELECT COUNT(*) FROM auth.users WHERE id <> ALL(excluded)),
      'active_today', (SELECT COUNT(*) FROM public.profiles
                       WHERE id <> ALL(excluded)
                         AND last_seen_at >= date_trunc('day', NOW())),
      'active_7d', (SELECT COUNT(*) FROM public.profiles
                    WHERE id <> ALL(excluded)
                      AND last_seen_at >= NOW() - INTERVAL '7 days'),
      'inactive_7d_plus', (SELECT COUNT(*) FROM public.profiles
                           WHERE id <> ALL(excluded)
                             AND (last_seen_at IS NULL
                                  OR last_seen_at < NOW() - INTERVAL '7 days')),
      'inactive_30d_plus', (SELECT COUNT(*) FROM public.profiles
                            WHERE id <> ALL(excluded)
                              AND (last_seen_at IS NULL
                                   OR last_seen_at < NOW() - INTERVAL '30 days'))
    ),
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d.day, 'count', d.cnt) ORDER BY d.day), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS cnt
        FROM auth.users WHERE id <> ALL(excluded) GROUP BY 1
      ) d
    ),
    'dau', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', a.day, 'count', a.cnt) ORDER BY a.day), '[]'::jsonb)
      FROM (
        SELECT day, COUNT(*) AS cnt FROM public.user_activity_days
        WHERE user_id <> ALL(excluded) GROUP BY day
      ) a
    ),
    -- ⚠️ `demo_devices` compte des APPAREILS, pas des comptes : non filtrée.
    'demo', (
      SELECT jsonb_build_object(
        'visitors', COUNT(*),
        'converted', COUNT(converted_at),
        'conversion_pct', COALESCE(ROUND(100.0 * COUNT(converted_at) / NULLIF(COUNT(*), 0), 1), 0)
      ) FROM public.demo_devices
    ),
    'usage', jsonb_build_object(
      'tasks',        (SELECT COUNT(*) FROM public.tasks  WHERE user_id <> ALL(excluded)),
      'habits',       (SELECT COUNT(*) FROM public.habits WHERE user_id <> ALL(excluded)),
      'events',       (SELECT COUNT(*) FROM public.events WHERE user_id <> ALL(excluded)),
      'okrs',         (SELECT COUNT(*) FROM public.okrs   WHERE user_id <> ALL(excluded)),
      'shared_tasks', (SELECT COUNT(*) FROM public.shared_tasks st
                       WHERE st.shared_by <> ALL(excluded))
    ),
    'signups_by_provider', (
      SELECT COALESCE(jsonb_object_agg(p.provider, p.cnt), '{}'::jsonb)
      FROM (
        SELECT COALESCE(raw_app_meta_data->>'provider', 'email') AS provider, COUNT(*) AS cnt
        FROM auth.users WHERE id <> ALL(excluded) GROUP BY 1
      ) p
    ),
    'adoption', jsonb_build_object(
      'tasks_users',  (SELECT COUNT(DISTINCT user_id) FROM public.tasks  WHERE user_id <> ALL(excluded)),
      'habits_users', (SELECT COUNT(DISTINCT user_id) FROM public.habits WHERE user_id <> ALL(excluded)),
      'events_users', (SELECT COUNT(DISTINCT user_id) FROM public.events WHERE user_id <> ALL(excluded)),
      'okrs_users',   (SELECT COUNT(DISTINCT user_id) FROM public.okrs   WHERE user_id <> ALL(excluded))
    ),
    'activation_24h', (
      SELECT jsonb_build_object(
        'activated', COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.user_id = u.id AND t.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.habits h
            WHERE h.user_id = u.id AND h.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.user_id = u.id AND e.created_at <= u.created_at + INTERVAL '24 hours'
          ) OR EXISTS (
            SELECT 1 FROM public.okrs o
            WHERE o.user_id = u.id AND o.created_at <= u.created_at + INTERVAL '24 hours'
          )),
        'total', COUNT(*)
      ) FROM auth.users u WHERE u.id <> ALL(excluded)
    ),
    'tasks_completion', (
      SELECT jsonb_build_object(
        'completed', COUNT(*) FILTER (WHERE completed),
        'total', COUNT(*)
      ) FROM public.tasks WHERE user_id <> ALL(excluded)
    ),
    'collaboration', jsonb_build_object(
      'sharers', (SELECT COUNT(DISTINCT t.user_id)
                  FROM public.shared_tasks st JOIN public.tasks t ON t.id = st.task_id
                  WHERE t.user_id <> ALL(excluded)),
      'users_with_friends', (SELECT COUNT(DISTINCT user_id) FROM public.friends
                             WHERE user_id <> ALL(excluded)),
      'accepted_requests', (SELECT COUNT(*) FROM public.friend_requests
                            WHERE status = 'accepted' AND sender_id <> ALL(excluded))
    ),
    'retention_j7', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('week', c.week, 'signups', c.signups, 'retained', c.retained)
        ORDER BY c.week
      ), '[]'::jsonb)
      FROM (
        SELECT
          date_trunc('week', u.created_at)::date AS week,
          COUNT(*) AS signups,
          COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM public.user_activity_days a
            WHERE a.user_id = u.id
              AND a.day BETWEEN (u.created_at AT TIME ZONE 'UTC')::date + 7
                            AND (u.created_at AT TIME ZONE 'UTC')::date + 13
          )) AS retained
        FROM auth.users u
        WHERE u.id <> ALL(excluded)
        GROUP BY 1
      ) c
    ),
    'stickiness', jsonb_build_object(
      'dau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day = CURRENT_DATE AND user_id <> ALL(excluded)),
      'mau', (SELECT COUNT(DISTINCT user_id) FROM public.user_activity_days
              WHERE day >= CURRENT_DATE - 29 AND user_id <> ALL(excluded))
    )
  ) INTO result;

  -- ══ v3 (mig. 099), pack acquisition ═══════════════════════════════
  WITH u AS (
    SELECT
      au.id,
      au.created_at,
      (au.created_at AT TIME ZONE 'UTC')::date AS signup_day,
      COALESCE(NULLIF(p.acquisition_source, ''), 'unknown') AS source,
      (
        EXISTS (SELECT 1 FROM public.tasks t
                WHERE t.user_id = au.id AND t.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.habits h
                   WHERE h.user_id = au.id AND h.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.events e
                   WHERE e.user_id = au.id AND e.created_at <= au.created_at + INTERVAL '48 hours')
        OR EXISTS (SELECT 1 FROM public.okrs o
                   WHERE o.user_id = au.id AND o.created_at <= au.created_at + INTERVAL '48 hours')
      ) AS activated_48h,
      (au.created_at <= NOW() - INTERVAL '14 days') AS d7_eligible,
      EXISTS (
        SELECT 1 FROM public.user_activity_days a
        WHERE a.user_id = au.id
          AND a.day BETWEEN (au.created_at AT TIME ZONE 'UTC')::date + 7
                        AND (au.created_at AT TIME ZONE 'UTC')::date + 13
      ) AS retained_d7
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE au.id <> ALL(excluded)
  )
  SELECT jsonb_build_object(
    'signups_by_source', (
      SELECT COALESCE(jsonb_object_agg(s.source, s.cnt), '{}'::jsonb)
      FROM (SELECT source, COUNT(*) AS cnt FROM u GROUP BY 1) s
    ),
    'signups_by_source_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', d.signup_day, 'source', d.source, 'count', d.cnt)
        ORDER BY d.signup_day, d.source
      ), '[]'::jsonb)
      FROM (
        SELECT signup_day, source, COUNT(*) AS cnt FROM u GROUP BY 1, 2
      ) d
    ),
    'activation_48h', jsonb_build_object(
      'activated', (SELECT COUNT(*) FILTER (WHERE activated_48h) FROM u),
      'total',     (SELECT COUNT(*) FROM u),
      'by_source', (
        SELECT COALESCE(jsonb_object_agg(
          a.source, jsonb_build_object('activated', a.activated, 'total', a.total)
        ), '{}'::jsonb)
        FROM (
          SELECT source,
                 COUNT(*) FILTER (WHERE activated_48h) AS activated,
                 COUNT(*) AS total
          FROM u GROUP BY 1
        ) a
      )
    ),
    -- ── 225 : la même activation, par jour UTC d'inscription ──────────
    'activation_48h_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', a.signup_day, 'activated', a.activated, 'total', a.total)
        ORDER BY a.signup_day
      ), '[]'::jsonb)
      FROM (
        SELECT signup_day,
               COUNT(*) FILTER (WHERE activated_48h) AS activated,
               COUNT(*) AS total
        FROM u GROUP BY 1
      ) a
    ),
    'retention_d7_by_source', (
      SELECT COALESCE(jsonb_object_agg(
        r.source, jsonb_build_object('signups', r.signups, 'retained', r.retained)
      ), '{}'::jsonb)
      FROM (
        SELECT source,
               COUNT(*) AS signups,
               COUNT(*) FILTER (WHERE retained_d7) AS retained
        FROM u WHERE d7_eligible GROUP BY 1
      ) r
    ),
    -- ⚠️ `organizations` n'est PAS filtrée (cf. mig. 099).
    'orgs', (
      SELECT jsonb_build_object(
        'total',                   COUNT(*),
        'created_30d',             COUNT(*) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days'),
        'with_3plus_members',      COUNT(*) FILTER (WHERE m.members >= 3),
        'with_3plus_members_30d',  COUNT(*) FILTER (WHERE m.members >= 3
                                                      AND o.created_at >= NOW() - INTERVAL '30 days')
      )
      FROM public.organizations o
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT om.user_id) AS members
        FROM public.organization_members om
        WHERE om.org_id = o.id
      ) m ON TRUE
    )
  ) INTO v3;

  RETURN result || v3;
END;
$$;


--
-- Name: FUNCTION get_admin_stats(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_stats() IS 'Statistiques de la console /admin. Gardee par is_admin() (mig. 131 : exige aal2). Depuis la mig. 149, les comptes de admin_stats_excluded_uids() sont retranches de toutes les sources keyees par un compte, et leur NOMBRE est rendu dans la cle excluded_accounts : un chiffre corrige sans mention de sa correction ne se recoupe plus avec le tableau de bord Supabase.';


--
-- Name: get_admin_traffic(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_traffic(p_days integer DEFAULT 7) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  result  jsonb;
  v_days  integer;
  v_start timestamptz;
  v_prev  timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_days  := LEAST(GREATEST(COALESCE(p_days, 7), 1), 365);
  v_start := date_trunc('day', now()) - make_interval(days => v_days - 1);
  v_prev  := v_start - make_interval(days => v_days);

  WITH hits AS (
    SELECT * FROM public.traffic_hits WHERE occurred_at >= v_prev
  ),
  views AS (
    SELECT h.*,
           -- Nouvelle visite si plus de 30 min depuis la page précédente du même visiteur.
           CASE WHEN lag(occurred_at) OVER w IS NULL
                  OR occurred_at - lag(occurred_at) OVER w > interval '30 minutes'
                THEN 1 ELSE 0 END AS starts
      FROM hits h WHERE kind = 'view'
    WINDOW w AS (PARTITION BY visitor ORDER BY occurred_at)
  ),
  numbered AS (
    SELECT v.*, sum(starts) OVER (PARTITION BY visitor ORDER BY occurred_at) AS sess
      FROM views v
  ),
  sessions AS (
    SELECT visitor, sess, min(occurred_at) AS started_at, max(occurred_at) AS ended_at, count(*) AS pages,
           (array_agg(path ORDER BY occurred_at))[1] AS entry,
           (array_agg(path ORDER BY occurred_at DESC))[1] AS exit_path,
           (array_agg(referrer_host ORDER BY occurred_at))[1] AS referrer_host,
           (array_agg(utm_source ORDER BY occurred_at))[1] AS utm_source,
           (array_agg(utm_medium ORDER BY occurred_at))[1] AS utm_medium,
           (array_agg(country ORDER BY occurred_at))[1] AS country,
           (array_agg(region ORDER BY occurred_at))[1] AS region,
           (array_agg(city ORDER BY occurred_at))[1] AS city,
           (array_agg(browser ORDER BY occurred_at))[1] AS browser,
           (array_agg(os ORDER BY occurred_at))[1] AS os,
           (array_agg(device ORDER BY occurred_at))[1] AS device,
           (array_agg(lang ORDER BY occurred_at))[1] AS lang
      FROM numbered GROUP BY visitor, sess
  ),
  cur AS (SELECT * FROM sessions WHERE started_at >= v_start),
  chan AS (
    SELECT *,
      CASE
        WHEN utm_medium IN ('cpc', 'ppc', 'paid') THEN 'Payant'
        WHEN coalesce(utm_source, referrer_host) ~ '(instagram|facebook|tiktok|linkedin|twitter|x\.com|t\.co|reddit|youtube|pinterest|threads)'
          THEN 'Réseaux sociaux'
        WHEN coalesce(utm_source, referrer_host) ~ '(google|bing|duckduckgo|qwant|ecosia|yahoo|brave)' THEN 'Recherche'
        WHEN utm_medium = 'email' OR utm_source ~ 'mail' THEN 'Email'
        WHEN referrer_host IS NULL AND utm_source IS NULL THEN 'Direct'
        ELSE 'Référent'
      END AS channel
    FROM cur
  ),
  leaves AS (SELECT * FROM hits WHERE kind = 'leave' AND occurred_at >= v_start)
  SELECT jsonb_build_object(
    'generated_at', now(),
    'window_days', v_days,
    'visits', (SELECT count(*) FROM cur),
    'visits_prev', (SELECT count(*) FROM sessions WHERE started_at >= v_prev AND started_at < v_start),
    'uniques', (SELECT count(DISTINCT visitor) FROM cur),
    'pageviews', (SELECT count(*) FROM hits WHERE kind = 'view' AND occurred_at >= v_start),
    'pageviews_prev', (SELECT count(*) FROM hits WHERE kind = 'view' AND occurred_at < v_start),
    'avg_duration_sec', (SELECT coalesce(round(avg(extract(epoch FROM ended_at - started_at))), 0)
                           FROM cur WHERE pages > 1),
    'bounce_pct', (SELECT coalesce(round(100.0 * count(*) FILTER (WHERE pages = 1) / nullif(count(*), 0)), 0) FROM cur),
    'visits_by_day', (
      SELECT coalesce(jsonb_agg(n ORDER BY d), '[]'::jsonb) FROM (
        SELECT g.d, (SELECT count(*) FROM cur WHERE started_at >= g.d AND started_at < g.d + interval '1 day') AS n
          FROM generate_series(v_start, date_trunc('day', now()), interval '1 day') g(d)
      ) x
    ),
    'geo', jsonb_build_object(
      'country', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(country, '?') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'region',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT region k, count(*) n FROM cur WHERE region IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'city',    (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT city k, count(*) n FROM cur WHERE city IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    ),
    'tech', jsonb_build_object(
      'browser', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(browser, 'Autre') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'os',      (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(os, 'Autre') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'device',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT CASE device WHEN 'mobile' THEN 'Mobile' WHEN 'tablet' THEN 'Tablette' WHEN 'desktop' THEN 'Ordinateur' ELSE 'Autre' END k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC) t)
    ),
    'acquisition', jsonb_build_object(
      'channel', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT channel k, count(*) n FROM chan GROUP BY 1 ORDER BY 2 DESC) t),
      'source',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(utm_source, referrer_host) k, count(*) n FROM cur WHERE coalesce(utm_source, referrer_host) IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'social',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(utm_source, referrer_host) k, count(*) n FROM chan WHERE channel = 'Réseaux sociaux' GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    ),
    'pages', jsonb_build_object(
      'top',   (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT path k, count(*) n FROM hits WHERE kind = 'view' AND occurred_at >= v_start GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'entry', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT entry k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
      'exit',  (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT exit_path k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    ),
    'languages', (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT coalesce(split_part(lang, '-', 1), '?') k, count(*) n FROM cur GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t),
    'landing', jsonb_build_object(
      'measures',         (SELECT count(*) FROM leaves WHERE path IN ('/', '/en', '/es')),
      'avg_time_sec',     (SELECT coalesce(round(avg(duration_ms) / 1000.0), 0) FROM leaves WHERE path IN ('/', '/en', '/es')),
      'short_visits_pct', (SELECT coalesce(round(100.0 * count(*) FILTER (WHERE duration_ms < 10000 AND coalesce(scroll_pct, 0) < 25) / nullif(count(*), 0)), 0)
                             FROM leaves WHERE path IN ('/', '/en', '/es')),
      'scroll_pct',       (SELECT coalesce(round(avg(scroll_pct)), 0) FROM leaves WHERE path IN ('/', '/en', '/es')),
      'cta',              (SELECT coalesce(jsonb_agg(jsonb_build_array(k, n) ORDER BY n DESC), '[]') FROM (SELECT cta k, count(*) n FROM hits WHERE kind = 'cta' AND occurred_at >= v_start GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
    )
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: FUNCTION get_admin_traffic(p_days integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_admin_traffic(p_days integer) IS 'Mesure d''audience maison pour la page Trafic de COSMO Analytics (mig. 222). Totaux seulement, garde is_admin() (allowlist ET aal2).';


--
-- Name: get_incoming_request_senders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_incoming_request_senders() RETURNS TABLE(request_id uuid, sender_id uuid, avatar_url text, display_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    fr.id,
    u.id,
    COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
    COALESCE(p.display_name, u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
  FROM public.friend_requests fr
  JOIN auth.users u ON u.id = fr.sender_id
  LEFT JOIN public.profiles p ON p.id = fr.sender_id
  WHERE fr.receiver_id = auth.uid()
    AND fr.status = 'pending';
END;
$$;


--
-- Name: get_my_habits(integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_habits(p_days integer DEFAULT 400, p_today date DEFAULT NULL::date) RETURNS TABLE(id uuid, name text, description text, frequency text, estimated_time integer, color text, icon text, completions jsonb, user_id uuid, created_at timestamp with time zone, streak_current integer, streak_best integer, completions_total integer, first_completion_date date, window_days integer, scheduled_days smallint[], schedule_history jsonb)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  WITH params AS (
    SELECT
      GREATEST(1, LEAST(COALESCE(p_days, 400), 3650)) AS win,
      -- « Aujourd'hui » selon le CLIENT, borné à ± 1 jour autour du serveur
      -- (mig. 122 : la base est en UTC, les jours sont en date locale).
      GREATEST(CURRENT_DATE - 1,
               LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1)) AS today
  ),
  hab AS (
    -- Une habitude « planifiée » a un réglage autre que tous les jours.
    SELECT h.id, h.scheduled_days, h.schedule_history,
           (h.scheduled_days IS NOT NULL
            OR jsonb_array_length(h.schedule_history) > 0) AS planned
    FROM public.habits h
  ),
  days AS (
    SELECT c.habit_id, c.day AS d
    FROM public.habit_completions c
    CROSS JOIN params p
    -- Jours futurs exclus, relativement au client (mig. 122).
    WHERE c.day <= p.today
  ),
  totals AS (
    SELECT habit_id, COUNT(*)::int AS total, MIN(d) AS first_day
    FROM days GROUP BY habit_id
  ),
  -- ── Sans jours prévus : calcul de la 248, à la lettre ──
  grouped AS (
    SELECT dy.habit_id, dy.d,
           dy.d - (row_number() OVER (PARTITION BY dy.habit_id ORDER BY dy.d))::int AS island
    FROM days dy
    JOIN hab ON hab.id = dy.habit_id AND NOT hab.planned
  ),
  runs AS (
    SELECT habit_id, island, COUNT(*)::int AS len, MAX(d) AS last_day
    FROM grouped
    GROUP BY habit_id, island
  ),
  agg_plain AS (
    SELECT
      r.habit_id,
      MAX(r.len) AS best,
      -- Série EN COURS : celle qui touche aujourd'hui ou hier, du point de vue
      -- du client. Même règle que `streak.ts`, à la lettre.
      COALESCE(MAX(r.len) FILTER (
        WHERE r.last_day >= ((SELECT today FROM params) - 1)
      ), 0) AS current
    FROM runs r
    GROUP BY r.habit_id
  ),
  -- ── Avec jours prévus : îlots sur la suite des seuls jours prévus ──
  -- Les jours prévus du premier jour coché à aujourd'hui (3 650 au plus),
  -- numérotés (rn). Deux jours prévus successifs cochés sont consécutifs même
  -- si un jour non prévu les sépare ; une coche un jour non prévu est neutre.
  sched AS (
    SELECT hab.id AS habit_id, g.d::date AS d,
           (dy.d IS NOT NULL) AS is_done,
           row_number() OVER (PARTITION BY hab.id ORDER BY g.d) AS rn
    FROM hab
    JOIN totals t ON t.habit_id = hab.id
    CROSS JOIN params p
    CROSS JOIN LATERAL generate_series(
      GREATEST(t.first_day, p.today - 3650), p.today, interval '1 day'
    ) AS g(d)
    LEFT JOIN days dy ON dy.habit_id = hab.id AND dy.d = g.d::date
    WHERE hab.planned
      AND public.habit_day_scheduled(hab.scheduled_days, hab.schedule_history, g.d::date)
  ),
  last_sched AS (
    SELECT DISTINCT ON (habit_id) habit_id, rn AS last_rn, d AS last_d, is_done AS last_done
    FROM sched ORDER BY habit_id, rn DESC
  ),
  islands AS (
    SELECT habit_id, rn, rn - row_number() OVER (PARTITION BY habit_id ORDER BY rn) AS island
    FROM sched WHERE is_done
  ),
  sruns AS (
    SELECT habit_id, island, COUNT(*)::int AS len, MAX(rn) AS end_rn
    FROM islands GROUP BY habit_id, island
  ),
  agg_planned AS (
    -- Série EN COURS : l'îlot qui touche le dernier jour prévu <= today, ou
    -- l'avant-dernier si ce dernier est AUJOURD'HUI et pas encore coché (la
    -- journée n'est pas finie). Même règle que `streak.ts`.
    SELECT r.habit_id,
           MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (
             WHERE r.end_rn >= ls.last_rn
                   - CASE WHEN ls.last_d = (SELECT today FROM params) AND NOT ls.last_done
                          THEN 1 ELSE 0 END
           ), 0) AS current
    FROM sruns r
    JOIN last_sched ls ON ls.habit_id = r.habit_id
    GROUP BY r.habit_id
  ),
  agg AS (
    SELECT habit_id, best, current FROM agg_plain
    UNION ALL
    SELECT habit_id, best, current FROM agg_planned
  )
  SELECT
    h.id, h.name, h.description, h.frequency, h.estimated_time, h.color, h.icon,
    -- Fenêtre bornée : seuls les jours cochés (l'absence vaut « non coché »).
    COALESCE(
      (SELECT jsonb_object_agg(to_char(c.day, 'YYYY-MM-DD'), true)
         FROM public.habit_completions c
        WHERE c.habit_id = h.id
          AND c.user_id = h.user_id
          AND c.day >= p.today - p.win),
      '{}'::jsonb
    ) AS completions,
    h.user_id, h.created_at,
    COALESCE(a.current, 0)::int,
    COALESCE(a.best, 0)::int,
    COALESCE(t.total, 0)::int,
    t.first_day,
    p.win,
    h.scheduled_days,
    h.schedule_history
  FROM public.habits h
  CROSS JOIN params p
  LEFT JOIN totals t ON t.habit_id = h.id
  LEFT JOIN agg a ON a.habit_id = h.id
  ORDER BY h.created_at DESC, h.id DESC;
$$;


--
-- Name: FUNCTION get_my_habits(p_days integer, p_today date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_habits(p_days integer, p_today date) IS 'Lecture bornee des habitudes, depuis habit_completions (mig. 248). `completions` = jours coches des p_days derniers jours ; series sur les seuls jours PREVUS (mig. 251) et totaux sur l historique ENTIER. `p_today` est la date LOCALE du client (bornee a CURRENT_DATE +/- 1, mig. 122).';


--
-- Name: get_my_org_inbox(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_org_inbox() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
WITH me AS MATERIALIZED (
  SELECT (SELECT auth.uid()) AS uid
),
-- Ma demande d'adhesion en attente. `user_id = uid` est un filtre METIER,
-- pas un doublon de la RLS : cf. l'en-tete de la mig. 129.
mine AS (
  SELECT r.id, r.org_id, r.user_id, r.requested_at
  FROM organization_join_requests r, me
  WHERE r.user_id = me.uid
    AND r.accepted_at IS NULL
    AND r.rejected_at IS NULL
  ORDER BY r.requested_at DESC
  LIMIT 1
),
-- Vue admin : les demandes adressees aux organisations que j'administre.
admin_reqs AS (
  SELECT r.id, r.org_id, r.user_id, r.requested_at,
         row_number() OVER (PARTITION BY r.org_id ORDER BY r.requested_at ASC) AS rn
  FROM organization_join_requests r
  WHERE r.accepted_at IS NULL
    AND r.rejected_at IS NULL
    AND is_org_admin(r.org_id)
),
notifs AS (
  SELECT n.id, n.org_id, n.actor_id, n.kind, n.task_id, n.read_at, n.created_at,
         n.project_id, n.kr_id, n.event_id, n.meta,
         row_number() OVER (PARTITION BY n.org_id ORDER BY n.created_at DESC) AS rn
  FROM org_notifications n, me
  WHERE n.user_id = me.uid
)
SELECT jsonb_build_object(
  'invitations', COALESCE((
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC)
    FROM public.get_my_org_invitations() i
  ), '[]'::jsonb),

  'removal_notices', COALESCE((
    SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC)
    FROM public.get_my_org_removal_notices() n
  ), '[]'::jsonb),

  'my_join_request', (
    SELECT to_jsonb(m) FROM mine m
  ),

  'join_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id,
             'org_id', a.org_id,
             'user_id', a.user_id,
             'requested_at', a.requested_at,
             'requester_name', COALESCE(p.display_name, split_part(p.email, '@', 1)),
             'requester_email', p.email
           ) ORDER BY a.org_id, a.requested_at ASC)
    FROM admin_reqs a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.rn <= 200
  ), '[]'::jsonb),

  'notifications', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id,
             'org_id', x.org_id,
             'actor_id', x.actor_id,
             'kind', x.kind,
             'task_id', x.task_id,
             'project_id', x.project_id,
             'kr_id', x.kr_id,
             'event_id', x.event_id,
             'meta', x.meta,
             'read_at', x.read_at,
             'created_at', x.created_at
           ) ORDER BY x.org_id, x.created_at DESC)
    FROM notifs x
    WHERE x.rn <= 50
  ), '[]'::jsonb),

  -- Section ajoutee par la mig. 142 : de quoi peindre la pastille sans lire la
  -- liste des taches d'equipe.
  'badge_tasks', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'org_id', b.org_id,
             'id', b.id,
             'name', b.name,
             'created_at', b.created_at,
             'kind', b.kind
           ) ORDER BY b.org_id, b.created_at DESC)
    FROM public.my_org_badge_tasks() b
  ), '[]'::jsonb)
);
$$;


--
-- Name: FUNCTION get_my_org_inbox(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_org_inbox() IS 'Boite de reception d''entreprise en une lecture (mig. 129, etendue par la 142) : invitations, avis de retrait, ma demande d''adhesion, demandes recues cote admin, notifications, et les taches dont la pastille a besoin. SECURITY INVOKER : la RLS de l''appelant s''applique, et les sections privilegiees delegent aux fonctions DEFINER existantes. Aucun parametre : le perimetre vient de auth.uid() seul.';


--
-- Name: get_my_org_invitations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_org_invitations() RETURNS TABLE(id uuid, org_id uuid, org_name text, inviter_id uuid, inviter_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT
    i.id,
    i.org_id,
    o.name,
    i.inviter_id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    i.created_at
  FROM public.org_invitations i
  JOIN public.organizations o ON o.id = i.org_id
  LEFT JOIN public.profiles p ON p.id = i.inviter_id
  WHERE auth.uid() IS NOT NULL
    AND i.invitee_id = auth.uid()
    AND i.accepted_at IS NULL
    AND i.declined_at IS NULL
  ORDER BY i.created_at DESC
  LIMIT 50;
$$;


--
-- Name: FUNCTION get_my_org_invitations(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_org_invitations() IS 'Invitations d''entreprise en attente pour l''utilisateur courant, avec le nom de l''organisation et de l''inviteur. SECURITY DEFINER parce que le nom d''une organisation n''est pas lisible par un non-membre. Périmètre dérivé de auth.uid() seul — aucun paramètre.';


--
-- Name: get_my_org_removal_notices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_org_removal_notices() RETURNS TABLE(id uuid, org_id uuid, org_name text, actor_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT
    n.id,
    n.org_id,
    o.name,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    n.created_at
  FROM public.org_notifications n
  JOIN public.organizations o ON o.id = n.org_id
  LEFT JOIN public.profiles p ON p.id = n.actor_id
  WHERE auth.uid() IS NOT NULL
    AND n.user_id = auth.uid()
    AND n.kind = 'org_removed'
    AND n.read_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT 20;
$$;


--
-- Name: FUNCTION get_my_org_removal_notices(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_org_removal_notices() IS 'Retraits d''entreprise non acquittés pour l''utilisateur courant, avec le nom de l''organisation et de l''auteur du retrait. SECURITY DEFINER parce qu''un ex-membre ne peut plus lire `organizations`.';


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    priority integer DEFAULT 3 NOT NULL,
    category uuid,
    deadline timestamp with time zone,
    estimated_time integer DEFAULT 0 NOT NULL,
    bookmarked boolean DEFAULT false NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    is_collaborative boolean DEFAULT false NOT NULL,
    pending_invites text[] DEFAULT '{}'::text[],
    collaborator_validations jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subtasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    kr_id text,
    recurrence text DEFAULT 'none'::text NOT NULL,
    recurrence_parent_id uuid,
    status text DEFAULT 'todo'::text NOT NULL,
    health text,
    CONSTRAINT tasks_health_check CHECK (((health IS NULL) OR (health = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))),
    CONSTRAINT tasks_priority_check CHECK (((priority >= 0) AND (priority <= 5))),
    CONSTRAINT tasks_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'blocked'::text, 'done'::text])))
);


--
-- Name: COLUMN tasks.priority; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.priority IS 'Priorité FACULTATIVE (mig. 249) : 1 (P1, la plus urgente) à 5, 0 = aucune. Rangée après P5 dans tous les tris (src/lib/task-ordering.ts).';


--
-- Name: COLUMN tasks.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.category IS 'Catégorie de la tâche. NULL = aucune. FK vers categories(id), ON DELETE SET NULL : supprimer une catégorie détache, ne supprime jamais la tâche.';


--
-- Name: COLUMN tasks.deadline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.deadline IS 'Échéance FACULTATIVE (mig. 249) : instant de minuit du jour choisi, dans le fuseau de la personne (src/lib/deadline.ts). NULL = aucune échéance.';


--
-- Name: COLUMN tasks.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.updated_at IS 'Dernière modification (trigger serveur — lecture seule client, #40).';


--
-- Name: COLUMN tasks.subtasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.subtasks IS 'Checklist de la tâche : tableau [{id, name, completed}] (#12).';


--
-- Name: COLUMN tasks.kr_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.kr_id IS 'Id du Key Result (okrs.key_results JSONB) auquel la tâche contribue (#28).';


--
-- Name: COLUMN tasks.recurrence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.recurrence IS 'Récurrence de la tâche (#26) : none | daily | weekly | monthly. Occurrence suivante générée client-side à la complétion.';


--
-- Name: COLUMN tasks.recurrence_parent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.recurrence_parent_id IS 'Occurrence dont cette tâche est issue (récurrence). Clé d''idempotence : l''index unique ux_tasks_recurrence_parent garantit AU PLUS UN enfant par parent, donc recocher deux fois ne duplique jamais.';


--
-- Name: COLUMN tasks.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.status IS 'Statut perso (mig. 214) : todo, in_progress, blocked, done. Tenu d''accord avec completed par trg_tasks_status_sync.';


--
-- Name: COLUMN tasks.health; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.health IS 'État déclaré (mig. 214) : on_track, at_risk, off_track, NULL. Même vocabulaire que team_tasks.health (mig. 204).';


--
-- Name: get_my_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_tasks() RETURNS SETOF public.tasks
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  -- Branche 1 : mes propres tâches (Index Scan sur idx_tasks_user_id).
  SELECT t.*
  FROM public.tasks t
  WHERE auth.uid() IS NOT NULL
    AND t.user_id = auth.uid()

  UNION

  -- Branche 2 : les tâches partagées avec moi ET que j'ai acceptées
  -- (Index Scan sur idx_shared_tasks_friend_id, puis tasks_pkey).
  SELECT t.*
  FROM public.tasks t
  JOIN public.shared_tasks st ON st.task_id = t.id
  WHERE auth.uid() IS NOT NULL
    AND st.friend_id = auth.uid()
    AND st.accepted_at IS NOT NULL;
$$;


--
-- Name: FUNCTION get_my_tasks(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_tasks() IS 'Lecture indexable des tâches visibles (miennes UNION partagées ACCEPTÉES). Remplace un SELECT direct sur `tasks`, dont la policy OR force un Seq Scan global. Périmètre dérivé exclusivement de auth.uid() — aucun paramètre. Les partages en attente passent par get_pending_shared_tasks() (mig. 103).';


--
-- Name: get_my_team_kr_projects(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_kr_projects(p_org uuid) RETURNS TABLE(kr_id uuid, project_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT kp.kr_id, kp.project_id
    FROM public.team_kr_projects kp
    JOIN public.team_key_results k ON k.id = kp.kr_id
   WHERE kp.org_id = p_org
     AND kp.project_id IN (SELECT public.my_team_project_ids(p_org))
     AND public.can_access_team_okr(k.okr_id);
$$;


--
-- Name: team_project_dependencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_project_dependencies (
    project_id uuid NOT NULL,
    depends_on_id uuid NOT NULL,
    org_id uuid NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_project_dependencies_no_self CHECK ((project_id <> depends_on_id))
);


--
-- Name: get_my_team_project_dependencies(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_project_dependencies(p_org uuid) RETURNS SETOF public.team_project_dependencies
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT d.*
  FROM public.team_project_dependencies d
  WHERE d.org_id = p_org
    AND d.project_id    IN (SELECT public.my_team_project_ids(p_org))
    AND d.depends_on_id IN (SELECT public.my_team_project_ids(p_org));
$$;


--
-- Name: team_project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_project_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    role text DEFAULT 'contributor'::text NOT NULL,
    added_by uuid DEFAULT auth.uid(),
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_project_members_role_check CHECK ((role = ANY (ARRAY['lead'::text, 'contributor'::text, 'viewer'::text])))
);


--
-- Name: get_my_team_project_members(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_project_members(p_org uuid) RETURNS SETOF public.team_project_members
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT pm.*
  FROM public.team_project_members pm
  WHERE pm.org_id = p_org
    AND pm.project_id IN (SELECT public.my_team_project_ids(p_org));
$$;


--
-- Name: get_my_team_project_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_project_progress(p_org uuid) RETURNS TABLE(project_id uuid, total integer, done integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT t.project_id, count(*)::int, count(*) FILTER (WHERE t.completed)::int
    FROM public.team_tasks t
   WHERE t.org_id = p_org
     AND t.deleted_at IS NULL
     AND t.project_id IN (SELECT public.my_team_project_ids(p_org))
   GROUP BY t.project_id;
$$;


--
-- Name: team_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    team_id uuid,
    category_id uuid,
    description text,
    owner_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    start_date date,
    due_date date,
    is_template boolean DEFAULT false NOT NULL,
    template_payload jsonb,
    health text,
    health_note text,
    health_updated_at timestamp with time zone,
    health_updated_by uuid,
    CONSTRAINT team_projects_dates_order CHECK (((start_date IS NULL) OR (due_date IS NULL) OR (start_date <= due_date))),
    CONSTRAINT team_projects_description_length CHECK (((description IS NULL) OR (char_length(description) <= 5000))),
    CONSTRAINT team_projects_health_check CHECK (((health IS NULL) OR (health = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))),
    CONSTRAINT team_projects_health_note_length CHECK (((health_note IS NULL) OR (char_length(health_note) <= 1000))),
    CONSTRAINT team_projects_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120))),
    CONSTRAINT team_projects_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'on_hold'::text, 'done'::text]))),
    CONSTRAINT team_projects_template_payload CHECK (((template_payload IS NULL) OR (is_template AND (jsonb_typeof(template_payload) = 'object'::text) AND (octet_length((template_payload)::text) <= 200000))))
);


--
-- Name: get_my_team_projects(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_projects(p_org uuid) RETURNS SETOF public.team_projects
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT p.*
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.id IN (SELECT public.my_team_project_ids(p_org));
$$;


--
-- Name: FUNCTION get_my_team_projects(p_org uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_team_projects(p_org uuid) IS 'Lecture indexable des projets d equipe visibles. Remplace un SELECT direct sur team_projects, dont la policy (can_access_team_project) force un Seq Scan + CTE recursive par ligne. Perimetre derive de auth.uid() ; p_org est un filtre, pas une portee.';


--
-- Name: team_task_dependencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_dependencies (
    task_id uuid NOT NULL,
    depends_on_id uuid NOT NULL,
    org_id uuid NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_task_dependencies_no_self CHECK ((task_id <> depends_on_id))
);


--
-- Name: get_my_team_task_dependencies(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_task_dependencies(p_org uuid) RETURNS SETOF public.team_task_dependencies
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT d.*
  FROM public.team_task_dependencies d
  JOIN public.team_tasks t ON t.id = d.task_id
  JOIN public.team_tasks b ON b.id = d.depends_on_id
  WHERE d.org_id = p_org
    AND t.deleted_at IS NULL
    AND b.deleted_at IS NULL
    AND t.project_id IN (SELECT public.my_team_project_ids(p_org));
$$;


--
-- Name: FUNCTION get_my_team_task_dependencies(p_org uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_team_task_dependencies(p_org uuid) IS 'Lecture indexable des dependances de taches d equipe. Ferme le trou laisse par la mig. 113 (cf. SCALABILITY.md 2bis) : la policy delegue son perimetre a team_tasks et payait donc can_access_team_project PAR ARETE. Perimetre derive de auth.uid() ; p_org est un filtre, pas une portee.';


--
-- Name: team_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    priority integer DEFAULT 3 NOT NULL,
    deadline date,
    estimated_time integer,
    created_by uuid DEFAULT auth.uid(),
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assignee_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    category_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    start_date date,
    custom_status_id uuid,
    health text,
    validator_id uuid,
    CONSTRAINT team_tasks_dates_order CHECK (((start_date IS NULL) OR (deadline IS NULL) OR (start_date <= deadline))),
    CONSTRAINT team_tasks_health_check CHECK (((health IS NULL) OR (health = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))),
    CONSTRAINT team_tasks_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 500))),
    CONSTRAINT team_tasks_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT team_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'blocked'::text, 'done'::text])))
);


--
-- Name: COLUMN team_tasks.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_tasks.status IS 'Statut de flux : todo | in_progress | review | blocked | done. Synchronisé avec `completed` par trigger dans les deux sens (mig. 091) — `completed` reste la colonne lue par le front existant.';


--
-- Name: COLUMN team_tasks.validator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_tasks.validator_id IS 'Qui valide la tâche (mig. 233). NULL = aucune validation : cochée, elle est terminée. Renseigné : terminée par un autre, elle passe en review.';


--
-- Name: get_my_team_tasks(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_team_tasks(p_org uuid) RETURNS SETOF public.team_tasks
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT t.*
  FROM public.team_tasks t
  WHERE t.org_id = p_org
    AND t.deleted_at IS NULL
    AND t.project_id IN (SELECT public.my_team_project_ids(p_org));
$$;


--
-- Name: FUNCTION get_my_team_tasks(p_org uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_team_tasks(p_org uuid) IS 'Lecture indexable des taches d equipe visibles. Meme correctif que get_my_tasks (mig. 085) applique aux tables entreprise. Perimetre derive de auth.uid() ; p_org est un filtre, pas une portee.';


--
-- Name: get_org_billing_history(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_billing_history(p_org uuid) RETURNS TABLE(id bigint, event_type text, invoice_number text, hosted_invoice_url text, amount_cents bigint, currency text, occurred_at timestamp with time zone, billing_reason text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  -- Même refus pour « organisation inconnue » et « pas le propriétaire » :
  -- ne pas confirmer l'existence d'une organisation dont on connaîtrait l'UUID.
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_org AND o.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT r.id,
           r.event_type,
           r.payload ->> 'number',
           r.payload ->> 'hosted_invoice_url',
           r.amount_cents,
           r.currency,
           r.occurred_at,
           r.payload ->> 'billing_reason'
      FROM public.payment_records r
     WHERE r.org_id = p_org
     ORDER BY r.occurred_at DESC, r.id DESC
     LIMIT 100;
END;
$$;


--
-- Name: get_org_email_invitations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_email_invitations(p_org uuid) RETURNS TABLE(token uuid, email text, created_at timestamp with time zone, expires_at timestamp with time zone, last_sent_at timestamp with time zone, sent_count integer, claimed_at timestamp with time zone, created_by uuid, team_ids uuid[], access_days integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT l.id, l.email, l.created_at, l.expires_at, l.last_sent_at, l.sent_count,
         l.claimed_at, l.created_by, l.team_ids, l.access_days
    FROM public.org_invite_links l
   WHERE l.org_id = p_org AND l.email IS NOT NULL
   ORDER BY l.created_at DESC
   LIMIT 500;
$$;


--
-- Name: get_org_member_last_activity(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_org_member_last_activity(p_org uuid) RETURNS TABLE(user_id uuid, last_activity_at timestamp with time zone, source text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH me AS (
    -- Index Scan sur la cle primaire (org_id, user_id).
    -- Mig. 208 : un appelant suspendu ou dont l'acces a expire n'est plus
    -- membre (meme regle que is_org_member, mig. 161).
    SELECT om.role
    FROM public.organization_members om
    WHERE om.org_id = p_org
      AND om.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
      AND om.suspended_at IS NULL
      AND (om.access_expires_at IS NULL OR om.access_expires_at > now())
  ),
  scope AS (
    -- Admin : toute l'organisation.
    SELECT m.user_id
    FROM public.organization_members m
    WHERE m.org_id = p_org
      AND EXISTS (SELECT 1 FROM me WHERE me.role = 'admin')
    UNION
    -- Manager : son sous-arbre strict, evalue UNE fois. Le garde EXISTS(me)
    -- evite de payer la CTE recursive pour un p_org etranger.
    SELECT s.user_id
    FROM (SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id) s
    WHERE EXISTS (SELECT 1 FROM me)
  )
  SELECT sc.user_id, latest.at, latest.source
  FROM scope sc
  LEFT JOIN LATERAL (
    SELECT u.at, u.source
    FROM (
      (SELECT a.created_at AS at, 'activity'::text AS source
         FROM public.team_task_activity a
        WHERE a.actor_id = sc.user_id
          AND a.org_id = p_org
        ORDER BY a.created_at DESC
        LIMIT 1)
      UNION ALL
      (SELECT c.created_at, 'comment'::text
         FROM public.team_task_comments c
         JOIN public.team_tasks t ON t.id = c.task_id
        WHERE c.author_id = sc.user_id
          AND t.org_id = p_org
        ORDER BY c.created_at DESC
        LIMIT 1)
      UNION ALL
      (SELECT t.completed_at, 'completion'::text
         FROM public.team_tasks t
        WHERE t.assignee_ids @> ARRAY[sc.user_id]
          AND t.org_id = p_org
          AND t.completed_at IS NOT NULL
        ORDER BY t.completed_at DESC
        LIMIT 1)
    ) u
    ORDER BY u.at DESC
    LIMIT 1
  ) latest ON true;
$$;


--
-- Name: FUNCTION get_org_member_last_activity(p_org uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_org_member_last_activity(p_org uuid) IS 'Derniere trace de travail d equipe (activite de tache, commentaire, tache assignee terminee) de chaque membre dans le perimetre de l appelant : toute l organisation pour un admin, le sous-arbre strict pour un manager, personne sinon (mig. 170). Jamais auth.users.last_sign_in_at. SECURITY DEFINER uniquement pour appeler get_subtree, dont EXECUTE est revoque a authenticated. p_org est un filtre, pas une portee.';


--
-- Name: get_pending_shared_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pending_shared_tasks() RETURNS SETOF public.tasks
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT t.*
  FROM public.tasks t
  JOIN public.shared_tasks st ON st.task_id = t.id
  WHERE auth.uid() IS NOT NULL
    AND st.friend_id = auth.uid()
    AND st.accepted_at IS NULL;
$$;


--
-- Name: FUNCTION get_pending_shared_tasks(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_pending_shared_tasks() IS 'Tâches partagées AVEC moi et pas encore acceptées (accepted_at NULL). Alimente la boîte de réception : sans elle, la mig. 103 rendrait la tâche invisible avant même de pouvoir être acceptée.';


--
-- Name: get_subtree(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_subtree(p_org uuid, p_root uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH RECURSIVE sub AS (
    SELECT m.user_id, 1 AS depth
    FROM public.organization_members m
    WHERE m.org_id = p_org AND m.manager_id = p_root
    UNION ALL
    SELECT m.user_id, s.depth + 1
    FROM public.organization_members m
    JOIN sub s ON m.manager_id = s.user_id
    WHERE m.org_id = p_org AND s.depth < 50
  )
  SELECT user_id FROM sub;
$$;


--
-- Name: get_support_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_support_stats() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_out JSONB;
BEGIN
  -- 🔴 `is_admin()` et jamais `admin_allowlisted()` : la première répond à
  -- « cette requête est-elle autorisée » (allowlist ET session `aal2`), la
  -- seconde à « ce compte est-il admin » et sert à l'AFFICHAGE. Les
  -- intervertir annule la mig. 131.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'received',        (SELECT COUNT(*) FROM public.support_reports),
      'received_30d',    (SELECT COUNT(*) FROM public.support_reports
                            WHERE received_at >= now() - INTERVAL '30 days'),
      'answered',        (SELECT COUNT(*) FROM public.support_reports
                            WHERE first_response_at IS NOT NULL),
      'resolved',        (SELECT COUNT(*) FROM public.support_reports
                            WHERE resolved_at IS NOT NULL),
      -- 🔴 LE CHIFFRE QUI COMPTE LE PLUS : combien attendent encore, et
      -- depuis quand. Un compteur de volume sans âge dirait « on en reçoit
      -- cinq par semaine » sans dire qu'aucun n'a jamais reçu de réponse.
      'awaiting',        (SELECT COUNT(*) FROM public.support_reports
                            WHERE first_response_at IS NULL),
      'oldest_awaiting_days', (
        SELECT COALESCE(
          EXTRACT(DAY FROM now() - MIN(received_at))::INT, 0)
        FROM public.support_reports WHERE first_response_at IS NULL)
    ),
    'median_response_hours', (
      SELECT COALESCE(ROUND(
        EXTRACT(EPOCH FROM PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY first_response_at - received_at)) / 3600.0, 1), 0)
      FROM public.support_reports WHERE first_response_at IS NOT NULL),
    'by_category', (
      SELECT COALESCE(jsonb_object_agg(c.category, c.n), '{}'::jsonb)
      FROM (SELECT category, COUNT(*) AS n
              FROM public.support_reports GROUP BY category) AS c),
    'by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', d.day, 'count', d.n) ORDER BY d.day), '[]'::jsonb)
      FROM (SELECT received_at::DATE AS day, COUNT(*) AS n
              FROM public.support_reports
             WHERE received_at >= now() - INTERVAL '30 days'
             GROUP BY 1) AS d)
  ) INTO v_out;

  RETURN v_out;
END;
$$;


--
-- Name: get_team_deletion_impact(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_deletion_impact(p_team uuid) RETURNS TABLE(active_projects integer, archived_projects integer, sole_okrs integer, shared_okrs integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT
    (SELECT count(*)::int FROM public.team_projects p
      WHERE p.team_id = p_team AND p.archived_at IS NULL),
    (SELECT count(*)::int FROM public.team_projects p
      WHERE p.team_id = p_team AND p.archived_at IS NOT NULL),
    (SELECT count(*)::int FROM public.team_okr_teams l
      WHERE l.team_id = p_team
        AND NOT EXISTS (SELECT 1 FROM public.team_okr_teams o
                        WHERE o.okr_id = l.okr_id AND o.team_id <> p_team)),
    (SELECT count(*)::int FROM public.team_okr_teams l
      WHERE l.team_id = p_team
        AND EXISTS (SELECT 1 FROM public.team_okr_teams o
                    WHERE o.okr_id = l.okr_id AND o.team_id <> p_team));
$$;


--
-- Name: get_team_member_workload(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_member_workload(p_org uuid, p_today date) RETURNS TABLE(user_id uuid, open_tasks integer, overdue integer, due_7_days integer, estimated_minutes integer)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT a.uid,
         count(*)::int,
         count(*) FILTER (WHERE t.deadline < p_today)::int,
         count(*) FILTER (WHERE t.deadline >= p_today AND t.deadline < p_today + 7)::int,
         COALESCE(sum(t.estimated_time), 0)::int
    FROM public.get_my_team_tasks(p_org) t
   CROSS JOIN LATERAL unnest(COALESCE(t.assignee_ids, ARRAY[]::uuid[])) AS a(uid)
   WHERE NOT t.completed
   GROUP BY a.uid;
$$;


--
-- Name: get_team_okr_trash(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_okr_trash(p_org uuid) RETURNS TABLE(id uuid, title text, deleted_at timestamp with time zone, deleted_by uuid, created_by uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT o.id, o.title, o.deleted_at, o.deleted_by, o.created_by
    FROM public.team_okrs o
   WHERE o.org_id = p_org
     AND o.deleted_at IS NOT NULL
     AND o.deleted_at > now() - INTERVAL '30 days'
     AND public.can_restore_team_okr(o.org_id, o.deleted_by)
   ORDER BY o.deleted_at DESC
   LIMIT 200;
$$;


--
-- Name: get_team_project_task_stats(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_project_task_stats(p_org uuid, p_today date) RETURNS TABLE(project_id uuid, total integer, completed integer, overdue integer, in_review integer, next_deadline date)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  SELECT t.project_id,
         count(*)::int,
         count(*) FILTER (WHERE t.completed)::int,
         count(*) FILTER (WHERE NOT t.completed AND t.deadline < p_today)::int,
         count(*) FILTER (WHERE t.status = 'review')::int,
         min(t.deadline) FILTER (WHERE NOT t.completed AND t.deadline >= p_today)
    FROM public.get_my_team_tasks(p_org) t
   GROUP BY t.project_id;
$$;


--
-- Name: get_team_trash(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_team_trash(p_org uuid) RETURNS TABLE(id uuid, project_id uuid, name text, deleted_at timestamp with time zone, deleted_by uuid, created_by uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT t.id, t.project_id, t.name, t.deleted_at, t.deleted_by, t.created_by
    FROM public.team_tasks t
   WHERE t.org_id = p_org
     AND t.deleted_at IS NOT NULL
     AND t.deleted_at > NOW() - INTERVAL '30 days'
     AND public.can_restore_team_task(t.org_id, t.project_id, t.deleted_by)
   ORDER BY t.deleted_at DESC
   LIMIT 200;
$$;


--
-- Name: get_work_time_stats(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text DEFAULT 'UTC'::text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $_$
WITH me AS MATERIALIZED (
  SELECT (SELECT auth.uid()) AS uid
),
ranges AS (
  SELECT ord,
         (elem->>'start')::date AS d_start,
         (elem->>'end')::date   AS d_end
  FROM jsonb_array_elements(p_ranges) WITH ORDINALITY AS t(elem, ord)
  WHERE ord <= 32
    AND (elem->>'start') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (elem->>'end')   ~ '^\d{4}-\d{2}-\d{2}$'
),
-- Intervalle englobant : un jour en dehors ne peut appartenir à aucune plage.
bounds AS (
  SELECT MIN(d_start) AS lo, MAX(d_end) AS hi FROM ranges
),
-- ── Une lecture par table, réduite à (jour, minutes) ──
task_days AS MATERIALIZED (
  SELECT (t.completed_at AT TIME ZONE p_tz)::date AS d, t.estimated_time AS v
  FROM tasks t, me, bounds b
  WHERE t.user_id = me.uid
    AND t.completed
    AND t.completed_at IS NOT NULL
    AND (t.completed_at AT TIME ZONE p_tz)::date BETWEEN b.lo AND b.hi
),
event_days AS MATERIALIZED (
  SELECT (e.start_time AT TIME ZONE p_tz)::date AS d,
         EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60 AS v
  FROM events e, me, bounds b
  WHERE e.user_id = me.uid
    AND (e.start_time AT TIME ZONE p_tz)::date BETWEEN b.lo AND b.hi
),
-- Une ligne par (habitude, jour coché), lue dans `habit_completions`
-- (mig. 248) par l'index (user_id, day). Le jour est déjà une date LOCALE
-- validée : plus de dépliage du JSON ni de filtre de forme.
habit_days AS MATERIALIZED (
  SELECT c.day AS d, h.estimated_time AS v
  FROM habit_completions c
  JOIN habits h ON h.id = c.habit_id AND h.user_id = c.user_id, me, bounds b
  WHERE c.user_id = me.uid
    AND c.day BETWEEN b.lo AND b.hi
),
-- Minutes estimées par KR. Table dédiée d'abord, JSONB en repli pour les OKR
-- antérieurs à la mig. 008 (cf. l'en-tête : une jointure interne les perdrait).
kr_minutes_raw AS (
  SELECT kr.id AS kr_id, kr.estimated_time::numeric AS minutes, 1 AS src
  FROM key_results kr, me
  WHERE kr.user_id = me.uid
  UNION ALL
  SELECT (e.elem->>'id')::uuid,
         COALESCE(NULLIF(e.elem->>'estimatedTime', '')::numeric, 0),
         2
  FROM okrs o
  CROSS JOIN LATERAL jsonb_array_elements(o.key_results) AS e(elem), me
  WHERE o.user_id = me.uid
    -- Les KR les plus anciens portaient un id non-UUID (`${Date.now()}-${i}`) ;
    -- sans ce filtre, le cast `::uuid` LÈVE et casse toute la fonction.
    AND e.elem->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (e.elem->>'estimatedTime' IS NULL OR (e.elem->>'estimatedTime') ~ '^\d+(\.\d+)?$')
),
kr_minutes AS MATERIALIZED (
  -- `DISTINCT ON` tranche entre les deux sources. Sans lui, un KR présent des
  -- deux côtés avec deux valeurs produirait deux lignes, donc un DOUBLE
  -- COMPTAGE de chacune de ses complétions.
  SELECT DISTINCT ON (kr_id) kr_id, minutes
  FROM kr_minutes_raw
  ORDER BY kr_id, src
),
-- Une ligne par complétion de KR : le journal `kr_completions` fait foi.
-- Une complétion dont le KR a disparu compte 0 minute (LEFT JOIN) plutôt que
-- de disparaître : on n'invente pas une durée, on ne perd pas la trace.
okr_days AS MATERIALIZED (
  SELECT (c.completed_at AT TIME ZONE p_tz)::date AS d,
         COALESCE(m.minutes, 0) AS v
  FROM kr_completions c
  LEFT JOIN kr_minutes m ON m.kr_id = c.kr_id, me, bounds b
  WHERE c.user_id = me.uid
    AND (c.completed_at AT TIME ZONE p_tz)::date BETWEEN b.lo AND b.hi
),
agg AS (
  SELECT
    r.ord,
    COALESCE((SELECT SUM(v) FROM task_days  x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS tasks_time,
    COALESCE((SELECT SUM(v) FROM event_days x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS events_time,
    COALESCE((SELECT SUM(v) FROM habit_days x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS habits_time,
    COALESCE((SELECT SUM(v) FROM okr_days   x WHERE x.d BETWEEN r.d_start AND r.d_end), 0) AS okr_time
  FROM ranges r
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'tasksTime',  ROUND(tasks_time)::int,
  'eventsTime', ROUND(events_time)::int,
  'habitsTime', ROUND(habits_time)::int,
  'okrTime',    ROUND(okr_time)::int,
  'totalTime',  ROUND(tasks_time + events_time + habits_time + okr_time)::int
) ORDER BY ord), '[]'::jsonb)
FROM agg;
$_$;


--
-- Name: FUNCTION get_work_time_stats(p_ranges jsonb, p_tz text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text) IS 'Temps investi par plage. Une lecture par table (mig. 127). Le temps OKR vient du journal kr_completions (mig. 136), le temps des habitudes de habit_completions (mig. 248). Les filtres user_id = auth.uid() sont le correctif A-1 (mig. 085), ne pas les retirer.';


--
-- Name: habit_completions_mirror(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.habit_completions_mirror() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_old jsonb := '{}'::jsonb;
  v_on  date[];
  v_off date[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := COALESCE(OLD.completions, '{}'::jsonb);
  END IF;

  SELECT array_agg(d.day) FILTER (WHERE d.nv = 'true'::jsonb),
         array_agg(d.day) FILTER (WHERE d.nv IS DISTINCT FROM 'true'::jsonb)
    INTO v_on, v_off
    FROM (
      SELECT public.habit_day_from_key(COALESCE(n.key, o.key)) AS day, n.value AS nv
        FROM jsonb_each(COALESCE(NEW.completions, '{}'::jsonb)) n
        FULL JOIN jsonb_each(v_old) o ON o.key = n.key
       WHERE n.value IS DISTINCT FROM o.value
    ) d
   WHERE d.day IS NOT NULL;

  IF v_off IS NOT NULL THEN
    DELETE FROM public.habit_completions c
     WHERE c.habit_id = NEW.id
       AND c.user_id = NEW.user_id
       AND c.day = ANY (v_off);
  END IF;

  IF v_on IS NOT NULL THEN
    INSERT INTO public.habit_completions (habit_id, user_id, day)
    SELECT NEW.id, NEW.user_id, x.day FROM unnest(v_on) AS x(day)
    ON CONFLICT (habit_id, user_id, day) DO NOTHING;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: habit_day_from_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.habit_day_from_key(p_key text) RETURNS date
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    SET search_path TO ''
    AS $_$
  SELECT CASE
    WHEN p_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
         AND left(p_key, 4) <> '0000'
    THEN CASE
      WHEN substr(p_key, 9, 2)::int <= extract(day from (
             make_date(left(p_key, 4)::int, substr(p_key, 6, 2)::int, 1)
             + interval '1 month' - interval '1 day'))::int
      THEN p_key::date
    END
  END;
$_$;


--
-- Name: FUNCTION habit_day_from_key(p_key text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.habit_day_from_key(p_key text) IS 'Cle YYYY-MM-DD de habits.completions vers une date, ou NULL si ce n est pas une date reelle. Ne leve jamais (mig. 248).';


--
-- Name: habit_day_scheduled(smallint[], jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN COALESCE(jsonb_array_length(p_history), 0) > 0 THEN
      COALESCE((
        SELECT (e.value -> 'days') @> to_jsonb(EXTRACT(DOW FROM p_d)::int)
          FROM jsonb_array_elements(p_history) WITH ORDINALITY AS e(value, pos)
         WHERE (e.value ->> 'from')::date <= p_d
         ORDER BY (e.value ->> 'from')::date DESC, e.pos DESC
         LIMIT 1
      ), true)
    ELSE
      p_days IS NULL
      OR cardinality(p_days) = 0
      OR EXTRACT(DOW FROM p_d)::smallint = ANY (p_days)
  END;
$$;


--
-- Name: FUNCTION habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date) IS 'Vrai si le jour est prevu pour l habitude (reglage en vigueur ce jour-la). Miroir de isHabitScheduledOn, src/modules/habits/schedule.ts (mig. 251).';


--
-- Name: habit_schedule_history_valid(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.habit_schedule_history_valid(p_history jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $_$
  SELECT p_history IS NULL
    OR (jsonb_typeof(p_history) = 'array'
        AND jsonb_array_length(p_history) <= 100
        AND NOT EXISTS (
          SELECT 1
            FROM jsonb_array_elements(p_history) e
           WHERE jsonb_typeof(e) <> 'object'
              OR jsonb_typeof(e -> 'from') IS DISTINCT FROM 'string'
              OR public.habit_day_from_key(e ->> 'from') IS NULL
              OR jsonb_typeof(e -> 'days') IS DISTINCT FROM 'array'
              OR jsonb_array_length(e -> 'days') NOT BETWEEN 1 AND 7
              OR EXISTS (
                   SELECT 1
                     FROM jsonb_array_elements(e -> 'days') d
                    WHERE jsonb_typeof(d) <> 'number'
                       OR d::text !~ '^[0-6]$')));
$_$;


--
-- Name: handle_new_user_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_profile() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  PERFORM public.create_profile_for_new_user(NEW.id, NEW.email, NEW.raw_user_meta_data);
  RETURN NEW;
END;
$$;


--
-- Name: has_subordinates(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_subordinates(p_org uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND manager_id = p_user
  );
$$;


--
-- Name: i_have_subordinates(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.i_have_subordinates(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND manager_id = (SELECT auth.uid())
  );
$$;


--
-- Name: init_team_task_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.init_team_task_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.completed THEN
    NEW.status := 'done';
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status = 'done' THEN
    NEW.completed := true;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: insert_kr_checkin_row(uuid, uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_okr uuid;
BEGIN
  SELECT okr_id INTO v_okr
    FROM public.team_key_results
   WHERE id = p_kr AND org_id = p_org
     -- Mig. 209 : le KR a reçu CETTE valeur et CET état dans cette transaction.
     AND health_updated_at = now()
     AND current_value IS NOT DISTINCT FROM p_value
     AND health IS NOT DISTINCT FROM p_status;
  IF v_okr IS NULL OR NOT public.can_access_team_okr(v_okr) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.team_kr_checkins (kr_id, org_id, value, status, note, author_id)
  VALUES (p_kr, p_org, p_value, p_status, NULLIF(btrim(p_note), ''), auth.uid());
END;
$$;


--
-- Name: invite_friend_to_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_friend_to_org(p_org uuid, p_invitee uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_invitee = auth.uid() THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  IF NOT public.is_org_member(p_org) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  -- Autorité pour faire grossir l'organisation (B-2) : admin, ou droit
  -- member.invite (mig. 229, la hiérarchie ne compte plus).
  IF NOT (public.is_org_admin(p_org) OR public.my_org_perm(p_org, 'member.invite')) THEN
    RAISE EXCEPTION 'not_allowed_to_invite';
  END IF;

  -- Même modèle de confiance que le partage de tâches (mig. 027/045) :
  -- amitié CONFIRMÉE uniquement.
  IF NOT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.user_id = auth.uid() AND f.friend_user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'not_a_friend';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'already_a_member';
  END IF;

  INSERT INTO public.org_invitations (org_id, inviter_id, invitee_id)
  VALUES (p_org, auth.uid(), p_invitee)
  ON CONFLICT (org_id, invitee_id) DO UPDATE
    SET inviter_id  = auth.uid(),
        created_at  = NOW(),
        accepted_at = NULL,
        declined_at = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


--
-- Name: is_above(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_above(p_org uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT p_user IN (SELECT public.get_subtree(p_org, auth.uid()));
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT public.admin_allowlisted()
     AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;


--
-- Name: FUNCTION is_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_admin() IS 'GARDE des surfaces admin (mig. 131) : compte dans admin_users ET session ayant présenté un second facteur (aal2). Renvoie donc false pour un admin connecté par mot de passe seul — c''est l''objet de la migration. Pour savoir si un compte est admin sans juger sa session : admin_allowlisted().';


--
-- Name: is_allowed_avatar_url(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_allowed_avatar_url(p_url text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  SELECT p_url IS NULL
      OR p_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
      OR p_url ~ '^https://lh3\.googleusercontent\.com/'
      OR p_url ~ '^data:image/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$';
$_$;


--
-- Name: is_org_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_admin(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid() AND role = 'admin'
      AND suspended_at IS NULL
      AND (access_expires_at IS NULL OR access_expires_at > now())
  );
$$;


--
-- Name: is_org_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_manager(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT public.is_org_admin(p_org)
      OR public.has_subordinates(p_org, auth.uid());
$$;


--
-- Name: is_org_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid()
      AND suspended_at IS NULL
      AND (access_expires_at IS NULL OR access_expires_at > now())
  );
$$;


--
-- Name: leave_organization(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_organization(p_org uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Transfer the admin role before leaving';
  END IF;

  PERFORM set_config('cosmo.departing_member', auth.uid()::text, true);

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = auth.uid();

  PERFORM public.release_member_work(p_org, auth.uid());

  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = auth.uid();

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = auth.uid();
  END IF;
END;
$$;


--
-- Name: log_team_task_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_team_task_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'status', OLD.status, NEW.status);
  END IF;

  IF NEW.assignee_ids IS DISTINCT FROM OLD.assignee_ids THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (
      NEW.id, NEW.org_id, v_actor, 'assignees',
      array_to_string(OLD.assignee_ids, ','),
      array_to_string(NEW.assignee_ids, ',')
    );
  END IF;

  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'deadline', OLD.deadline::text, NEW.deadline::text);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'priority', OLD.priority::text, NEW.priority::text);
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'project', OLD.project_id::text, NEW.project_id::text);
  END IF;

  -- `name` est journalisé sans les valeurs : savoir QUE le titre a changé
  -- suffit, et stocker les anciens libellés ferait du journal une copie
  -- intégrale du contenu, avec la charge RGPD correspondante.
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'name', NULL, NULL);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: log_team_task_creation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_team_task_creation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value, created_at)
  VALUES (NEW.id, NEW.org_id, COALESCE(auth.uid(), NEW.created_by), 'created', NULL, NULL, COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION log_team_task_creation(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.log_team_task_creation() IS 'Journal append-only (mig. 181) : une ligne ''created'' par tâche d''équipe insérée. Seule source des créations affichées par l''Aperçu.';


--
-- Name: manages_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manages_user(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT p_user IS NOT NULL
     AND p_user <> auth.uid()
     AND p_user = ANY (public.my_managed_user_ids());
$$;


--
-- Name: member_departure_impact(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_departure_impact(p_org uuid, p_user uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE WHEN NOT public.is_org_admin(p_org) THEN NULL ELSE jsonb_build_object(
    'tasks', (SELECT count(*) FROM public.team_tasks
               WHERE org_id = p_org AND NOT completed AND deleted_at IS NULL
                 AND p_user = ANY (assignee_ids)),
    'reports', (SELECT count(*) FROM public.organization_members
                 WHERE org_id = p_org AND manager_id = p_user),
    'leads', (SELECT count(*) FROM public.org_team_members
               WHERE org_id = p_org AND user_id = p_user AND is_lead),
    -- Projets PORTÉS actifs hors modèles (mig. 164) + co-pilotages (mig. 190).
    'projects', (SELECT count(*) FROM public.team_projects
                  WHERE org_id = p_org AND owner_id = p_user AND archived_at IS NULL
                    AND NOT is_template)
              + (SELECT count(*) FROM public.team_project_members
                  WHERE org_id = p_org AND user_id = p_user AND role = 'lead'),
    'krs', (SELECT count(*) FROM public.team_key_results
             WHERE org_id = p_org AND assignee_id = p_user)
  ) END;
$$;


--
-- Name: my_assign_targets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_assign_targets(p_org uuid) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN ARRAY[]::text[]
    WHEN public.is_org_admin(p_org) THEN ARRAY['everyone']::text[]
    ELSE COALESCE(
      public.my_role_assign_targets(p_org),
      (
        SELECT p.assign_targets FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      ARRAY['everyone']::text[]
    )
  END;
$$;


--
-- Name: my_managed_user_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_managed_user_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT COALESCE(ARRAY(
    SELECT DISTINCT target.user_id
    FROM public.organization_members me
    JOIN public.organization_members target
      ON target.org_id = me.org_id
    WHERE me.user_id = auth.uid()
      AND target.user_id IS NOT NULL
      AND target.user_id <> auth.uid()
      AND (
        me.role = 'admin'
        OR target.user_id IN (SELECT public.get_subtree(me.org_id, auth.uid()))
      )
  ), '{}'::uuid[]);
$$;


--
-- Name: my_org_badge_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_org_badge_tasks() RETURNS TABLE(org_id uuid, id uuid, name text, created_at timestamp with time zone, kind text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH my_orgs AS (
    SELECT om.org_id
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
  ),
  visible_projects AS (
    SELECT o.org_id, p.project_id
    FROM my_orgs o
    CROSS JOIN LATERAL (
      SELECT public.my_team_project_ids(o.org_id) AS project_id
    ) p
  ),
  assigned AS (
    SELECT t.org_id, t.id, t.name, t.created_at, 'assigned'::text AS kind,
           row_number() OVER (PARTITION BY t.org_id ORDER BY t.created_at DESC) AS rn
    FROM public.team_tasks t
    JOIN visible_projects vp
      ON vp.org_id = t.org_id AND vp.project_id = t.project_id
    WHERE t.completed = false
      AND t.deleted_at IS NULL
      AND t.assignee_ids @> ARRAY[(select auth.uid())]
      AND t.created_by IS DISTINCT FROM (select auth.uid())
  ),
  unread_task_ids AS (
    SELECT DISTINCT n.task_id
    FROM public.org_notifications n
    WHERE n.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
      AND n.read_at IS NULL
      AND n.task_id IS NOT NULL
  ),
  notified AS (
    SELECT t.org_id, t.id, t.name, t.created_at, 'notified'::text AS kind,
           row_number() OVER (PARTITION BY t.org_id ORDER BY t.created_at DESC) AS rn
    FROM public.team_tasks t
    JOIN visible_projects vp
      ON vp.org_id = t.org_id AND vp.project_id = t.project_id
    WHERE t.id IN (SELECT u.task_id FROM unread_task_ids u)
      AND t.deleted_at IS NULL
  )
  SELECT a.org_id, a.id, a.name, a.created_at, a.kind
  FROM assigned a WHERE a.rn <= 200
  UNION ALL
  SELECT n.org_id, n.id, n.name, n.created_at, n.kind
  FROM notified n WHERE n.rn <= 50;
$$;


--
-- Name: FUNCTION my_org_badge_tasks(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.my_org_badge_tasks() IS 'Les seules taches d equipe dont la pastille d entreprise a besoin (mig. 142) : assignations en cours qui ne viennent pas de moi, et taches visees par mes notifications non lues. Remplace une lecture org-wide de team_tasks montee par Layout sur toutes les pages protegees. Aucun parametre : le perimetre vient de auth.uid() seul. SECURITY DEFINER uniquement pour appeler my_team_project_ids, dont EXECUTE est revoque a authenticated : l autorisation est celle de get_my_team_tasks, inchangee.';


--
-- Name: my_org_perm(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_org_perm(p_org uuid, p_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN false
    WHEN public.is_org_admin(p_org) THEN true
    ELSE COALESCE(
      public.my_role_perm(p_org, p_key),
      (
        SELECT CASE p_key
          WHEN 'task.create'     THEN p.can_create_task
          WHEN 'task.editAny'    THEN p.can_edit_any_task
          WHEN 'task.deleteAny'  THEN p.can_delete_task
          WHEN 'project.create'  THEN p.can_create_project
          WHEN 'project.delete'  THEN p.can_delete_project
          WHEN 'okr.create'      THEN p.can_create_okr
          WHEN 'okr.delete'      THEN p.can_delete_okr
          WHEN 'category.manage' THEN p.can_manage_category
          WHEN 'team.create'     THEN p.can_create_team
          WHEN 'member.invite'   THEN p.can_invite_member
          WHEN 'role.manage'     THEN p.can_manage_roles
        END
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      public.org_member_default_perm(p_org, p_key)
    )
  END;
$$;


--
-- Name: my_project_edit_perm(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_project_edit_perm(p_org uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN false
    WHEN public.is_org_admin(p_org) THEN true
    ELSE COALESCE(
      public.my_role_perm(p_org, 'project.edit'),
      (
        SELECT p.can_edit_project
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      public.org_member_default_perm(p_org, 'project.edit')
    )
  END;
$$;


--
-- Name: my_project_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_project_role(p_project uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT pm.role
    FROM public.team_project_members pm
   WHERE pm.project_id = p_project
     AND pm.user_id = (SELECT auth.uid())
     AND public.is_org_member(pm.org_id);
$$;


--
-- Name: my_report_perm(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_report_perm(p_org uuid, p_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN NOT public.is_org_member(p_org) THEN false
    WHEN public.is_org_admin(p_org) THEN true
    ELSE COALESCE(
      public.my_role_perm(p_org, p_key),
      (
        SELECT CASE p_key
                 WHEN 'report.org' THEN p.can_view_org_report
                 WHEN 'report.allTeams' THEN p.can_view_all_team_reports
               END
        FROM public.org_member_permissions p
        WHERE p.org_id = p_org AND p.user_id = (SELECT auth.uid())
      ),
      public.org_member_default_perm(p_org, p_key)
    )
  END;
$$;


--
-- Name: my_role_assign_targets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_role_assign_targets(p_org uuid) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE
           WHEN count(DISTINCT mr.id) = 0 THEN NULL
           ELSE COALESCE(array_agg(DISTINCT t.target) FILTER (WHERE t.target IS NOT NULL), '{}'::text[])
         END
    FROM public.org_member_roles mr
    JOIN public.org_roles r ON r.id = mr.role_id
    LEFT JOIN LATERAL unnest(r.assign_targets) AS t(target) ON true
   WHERE mr.org_id = p_org
     AND mr.user_id = (SELECT auth.uid())
     AND mr.starts_at <= now()
     AND (mr.ends_at IS NULL OR mr.ends_at > now());
$$;


--
-- Name: my_role_perm(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_role_perm(p_org uuid, p_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE WHEN count(*) = 0 THEN NULL ELSE bool_or(p_key = ANY (r.granted_keys)) END
    FROM public.org_member_roles mr
    JOIN public.org_roles r ON r.id = mr.role_id
   WHERE mr.org_id = p_org
     AND mr.user_id = (SELECT auth.uid())
     AND mr.starts_at <= now()
     AND (mr.ends_at IS NULL OR mr.ends_at > now());
$$;


--
-- Name: my_team_project_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_team_project_ids(p_org uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH my_membership AS (
    SELECT om.role
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND om.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
      AND public.is_org_member(p_org)
  ),
  my_teams AS (
    SELECT tm.team_id
    FROM public.org_team_members tm
    WHERE tm.user_id = (select auth.uid())
      AND tm.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
      AND EXISTS (SELECT 1 FROM my_membership)
  ),
  my_subtree AS (
    SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id
    WHERE EXISTS (SELECT 1 FROM my_membership)
  ),
  subordinate_teams AS (
    SELECT DISTINCT tm.team_id
    FROM public.org_team_members tm
    JOIN my_subtree s ON s.user_id = tm.user_id
    WHERE tm.org_id = p_org
  ),
  visible_teams AS (
    SELECT team_id FROM my_teams
    UNION
    SELECT team_id FROM subordinate_teams
  )
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IS NULL
    AND EXISTS (SELECT 1 FROM my_membership)
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND EXISTS (SELECT 1 FROM my_membership WHERE role = 'admin')
  UNION
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IN (SELECT team_id FROM visible_teams)
  UNION
  -- Équipes associées (mig. 164).
  SELECT ptt.project_id
  FROM public.team_project_teams ptt
  WHERE ptt.org_id = p_org
    AND ptt.team_id IN (SELECT team_id FROM visible_teams)
  UNION
  -- Membre direct du projet (mig. 190, index user_id, org_id).
  SELECT pm.project_id
  FROM public.team_project_members pm
  WHERE pm.org_id = p_org
    AND pm.user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM my_membership);
$$;


--
-- Name: FUNCTION my_team_project_ids(p_org uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.my_team_project_ids(p_org uuid) IS 'Projets de p_org visibles par auth.uid(), en trois branches indexables. Equivaut a can_access_team_project mais evalue le sous-arbre managerial UNE fois par organisation au lieu d une fois par ligne. Helper interne : NON expose en RPC, appele uniquement depuis get_my_team_projects / get_my_team_tasks (SECURITY DEFINER, role effectif = proprietaire).';


--
-- Name: notify_comment_mention(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_comment_mention() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_mentioned UUID;
  v_org UUID;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.org_id INTO v_org FROM public.team_tasks t WHERE t.id = NEW.task_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_mentioned IN ARRAY NEW.mentions
  LOOP
    -- Se mentionner soi-même ne notifie pas.
    CONTINUE WHEN v_mentioned = NEW.author_id;
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (v_org, v_mentioned, NEW.author_id, 'mention', NEW.task_id);
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: notify_event_scheduled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_event_scheduled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_actor IS NULL OR NEW.user_id = v_actor THEN
    RETURN NEW;
  END IF;
  SELECT me.org_id INTO v_org
    FROM public.organization_members me
    JOIN public.organization_members target
      ON target.org_id = me.org_id AND target.user_id = NEW.user_id
   WHERE me.user_id = v_actor
   LIMIT 1;
  IF v_org IS NOT NULL THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, event_id, meta)
    VALUES (v_org, NEW.user_id, v_actor, 'event_scheduled', NEW.id,
            jsonb_build_object('title', left(NEW.title, 120), 'start', NEW.start_time));
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_kr_due(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_kr_due() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.org_notifications (org_id, user_id, kind, kr_id, meta)
  SELECT DISTINCT k.org_id, r.uid, 'kr_due', k.id,
         jsonb_build_object('title', left(k.title, 120), 'endDate', o.end_date)
    FROM public.team_key_results k
    JOIN public.team_okrs o ON o.id = k.okr_id
    CROSS JOIN LATERAL (
      SELECT o.created_by AS uid
      UNION SELECT k.assignee_id
      UNION SELECT unnest(k.contributor_ids)
    ) r
   WHERE NOT k.completed
     AND o.deleted_at IS NULL
     AND o.end_date = current_date + 3
     AND r.uid IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.org_notifications n
        WHERE n.kr_id = k.id AND n.user_id = r.uid AND n.kind = 'kr_due'
          AND n.created_at > now() - INTERVAL '7 days'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: notify_member_position_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_member_position_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid := auth.uid();
  -- Posé par `remove_member`, `leave_organization` et l'assistant de départ :
  -- la personne qui PART ne reçoit pas « vous n'encadrez plus personne ».
  v_leaving text := current_setting('cosmo.departing_member', true);
BEGIN
  IF OLD.manager_id IS NOT DISTINCT FROM NEW.manager_id THEN
    RETURN NEW;
  END IF;

  -- La personne déplacée : son supérieur direct a changé.
  IF NEW.user_id IS DISTINCT FROM v_actor THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (NEW.org_id, NEW.user_id, v_actor, 'role_changed',
            jsonb_build_object('change', 'manager_changed', 'manager_id', NEW.manager_id));
  END IF;

  -- L'ancien manager qui n'encadre plus personne.
  IF OLD.manager_id IS NOT NULL AND OLD.manager_id IS DISTINCT FROM v_actor
     AND OLD.manager_id::text IS DISTINCT FROM NULLIF(v_leaving, '')
     AND NOT EXISTS (SELECT 1 FROM public.organization_members
                      WHERE org_id = NEW.org_id AND manager_id = OLD.manager_id)
     AND EXISTS (SELECT 1 FROM public.organization_members
                  WHERE org_id = NEW.org_id AND user_id = OLD.manager_id) THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (NEW.org_id, OLD.manager_id, v_actor, 'role_changed',
            jsonb_build_object('change', 'no_longer_manager'));
  END IF;

  -- Le nouveau manager qui encadre quelqu'un pour la première fois.
  IF NEW.manager_id IS NOT NULL AND NEW.manager_id IS DISTINCT FROM v_actor
     AND (SELECT count(*) FROM public.organization_members
           WHERE org_id = NEW.org_id AND manager_id = NEW.manager_id) = 1 THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, meta)
    VALUES (NEW.org_id, NEW.manager_id, v_actor, 'role_changed',
            jsonb_build_object('change', 'now_manager', 'report_id', NEW.user_id));
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_project_at_risk(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_project_at_risk() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.health IS NOT DISTINCT FROM OLD.health
     OR NEW.health NOT IN ('at_risk', 'off_track')
     OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, project_id, meta)
  SELECT DISTINCT NEW.org_id, r.uid, v_actor, 'project_at_risk', NEW.id,
         jsonb_build_object('name', left(NEW.name, 120), 'health', NEW.health,
                            'note', left(COALESCE(NEW.health_note, ''), 200))
    FROM (
      SELECT NEW.owner_id AS uid
      UNION SELECT pm.user_id FROM public.team_project_members pm
             WHERE pm.project_id = NEW.id AND pm.role = 'lead'
      UNION SELECT f.user_id FROM public.team_project_followers f
             WHERE f.project_id = NEW.id
    ) r
   WHERE r.uid IS NOT NULL
     AND r.uid IS DISTINCT FROM v_actor
     AND EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.org_id = NEW.org_id AND m.user_id = r.uid AND m.suspended_at IS NULL);
  RETURN NEW;
END;
$$;


--
-- Name: notify_task_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_task_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_new_assignee UUID;
  v_added UUID[];
BEGIN
  -- Seuls les assignés AJOUTÉS sont notifiés : re-notifier tout le monde à
  -- chaque édition de la tâche transformerait la boîte en bruit.
  --
  -- Le tableau est calculé dans une variable AVANT la boucle : `FOREACH ... IN
  -- ARRAY (SELECT ...)` n'est pas une expression de tableau valide en plpgsql.
  SELECT COALESCE(array_agg(x), ARRAY[]::uuid[])
    INTO v_added
    FROM unnest(COALESCE(NEW.assignee_ids, ARRAY[]::uuid[])) AS x
   WHERE x <> ALL (COALESCE(OLD.assignee_ids, ARRAY[]::uuid[]));

  IF array_length(v_added, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_new_assignee IN ARRAY v_added
  LOOP
    -- S'auto-assigner ne notifie pas : on sait ce qu'on vient d'écrire.
    CONTINUE WHEN v_new_assignee = v_actor;
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (NEW.org_id, v_new_assignee, v_actor, 'task_assigned', NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: notify_task_comment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_task_comment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_assignee UUID;
  v_org UUID;
  v_assignee_ids UUID[];
BEGIN
  SELECT t.org_id, t.assignee_ids INTO v_org, v_assignee_ids
    FROM public.team_tasks t WHERE t.id = NEW.task_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_assignee IN ARRAY COALESCE(v_assignee_ids, ARRAY[]::uuid[])
  LOOP
    -- On ne se notifie pas soi-même pour son propre commentaire.
    CONTINUE WHEN v_assignee = NEW.author_id;
    -- Déjà notifié via `notify_comment_mention` (mig. 095) pour CE même
    -- commentaire : une seconde notification « comment » en plus de la
    -- « mention » serait un doublon sur le même événement.
    CONTINUE WHEN v_assignee = ANY (COALESCE(NEW.mentions, ARRAY[]::uuid[]));
    -- mig. 212 : un membre suspendu, expiré ou sorti n'est plus notifié.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = v_org AND m.user_id = v_assignee
         AND m.suspended_at IS NULL
         AND (m.access_expires_at IS NULL OR m.access_expires_at > now())
    );
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    VALUES (v_org, v_assignee, NEW.author_id, 'comment', NEW.task_id);
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION notify_task_comment(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.notify_task_comment() IS 'Notifie chaque assigné (hors auteur, hors déjà notifié par mention) qu''un commentaire a été posté sur sa tâche (mig. 110).';


--
-- Name: notify_team_project_archived(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_team_project_archived() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF OLD.archived_at IS NOT NULL OR NEW.archived_at IS NULL OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, project_id, meta)
  SELECT NEW.org_id, r.uid, v_actor, 'project_archived', NEW.id,
         jsonb_build_object('project_name', NEW.name)
    FROM (
      SELECT DISTINCT unnest(t.assignee_ids) AS uid
        FROM public.team_tasks t
       WHERE t.project_id = NEW.id AND NOT t.completed AND t.deleted_at IS NULL
      UNION
      SELECT NEW.owner_id WHERE NEW.owner_id IS NOT NULL
      UNION
      SELECT f.user_id FROM public.team_project_followers f WHERE f.project_id = NEW.id
    ) r
    JOIN public.organization_members om ON om.org_id = NEW.org_id AND om.user_id = r.uid
         -- mig. 212 : un membre suspendu ou expiré ne lit plus le nom du projet.
         AND om.suspended_at IS NULL
         AND (om.access_expires_at IS NULL OR om.access_expires_at > now())
   WHERE r.uid IS DISTINCT FROM v_actor;
  RETURN NEW;
END;
$$;


--
-- Name: notify_team_task_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_team_task_automations() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  r record;
  v_to uuid;
  v_targets uuid[];
BEGIN
  FOR r IN
    SELECT a.name, a.action_value
      FROM public.team_automations a
     WHERE a.org_id = NEW.org_id
       AND a.enabled
       AND a.action_kind = 'notify_member'
       AND (a.project_id IS NULL OR a.project_id = NEW.project_id)
       AND (
         (TG_OP = 'INSERT' AND a.trigger_kind = 'task_created')
         OR (TG_OP = 'UPDATE' AND a.trigger_kind = 'status_changed'
             AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = a.trigger_value)
       )
       AND EXISTS (
         SELECT 1 FROM public.organization_members m
          WHERE m.org_id = a.org_id AND m.user_id = a.created_by
            AND m.suspended_at IS NULL
            AND (m.role = 'admin' OR a.project_id IS NOT NULL)
       )
     ORDER BY a.position, a.created_at
  LOOP
    v_targets := CASE WHEN r.action_value = 'assignees'
                      THEN COALESCE(NEW.assignee_ids, '{}')
                      ELSE ARRAY[r.action_value::uuid] END;
    FOREACH v_to IN ARRAY v_targets LOOP
      CONTINUE WHEN v_to = auth.uid();
      CONTINUE WHEN NOT EXISTS (
        SELECT 1 FROM public.organization_members m
         WHERE m.org_id = NEW.org_id AND m.user_id = v_to AND m.suspended_at IS NULL
      );
      INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id, meta)
      VALUES (NEW.org_id, v_to, auth.uid(), 'automation', NEW.id, jsonb_build_object('rule', r.name));
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;


--
-- Name: notify_team_task_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_team_task_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Suiveurs, créateur, assignés : sauf l'auteur du changement.
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id, meta)
  SELECT DISTINCT NEW.org_id, r.uid, v_actor, 'status_changed', NEW.id,
         jsonb_build_object('from', OLD.status, 'to', NEW.status)
    FROM (
      SELECT f.user_id AS uid FROM public.team_task_followers f WHERE f.task_id = NEW.id
      UNION SELECT NEW.created_by
      UNION SELECT unnest(COALESCE(NEW.assignee_ids, ARRAY[]::uuid[]))
    ) r
   WHERE r.uid IS NOT NULL
     AND r.uid IS DISTINCT FROM v_actor
     AND EXISTS (SELECT 1 FROM public.organization_members m
                  WHERE m.org_id = NEW.org_id AND m.user_id = r.uid
                    -- mig. 212 : un membre suspendu ou expiré n'est plus notifié.
                    AND m.suspended_at IS NULL
                    AND (m.access_expires_at IS NULL OR m.access_expires_at > now()));

  -- Terminée : les tâches qu'elle bloquait et qui n'attendent plus rien.
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
    SELECT DISTINCT NEW.org_id, a.uid, v_actor, 'unblocked', b.id
      FROM public.team_task_dependencies d
      JOIN public.team_tasks b ON b.id = d.task_id AND NOT b.completed
      CROSS JOIN LATERAL unnest(COALESCE(b.assignee_ids, ARRAY[]::uuid[])) AS a(uid)
     WHERE d.depends_on_id = NEW.id
       AND a.uid IS DISTINCT FROM v_actor
       -- mig. 212 : même règle pour les assignés débloqués.
       AND EXISTS (SELECT 1 FROM public.organization_members m
                    WHERE m.org_id = NEW.org_id AND m.user_id = a.uid
                      AND m.suspended_at IS NULL
                      AND (m.access_expires_at IS NULL OR m.access_expires_at > now()))
       AND NOT EXISTS (
         SELECT 1 FROM public.team_task_dependencies d2
           JOIN public.team_tasks o ON o.id = d2.depends_on_id
          WHERE d2.task_id = b.id AND o.id <> NEW.id AND NOT o.completed
       );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: offboard_org_member(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.offboard_org_member(p_org uuid, p_user uuid, p_tasks_to uuid DEFAULT NULL::uuid, p_reports_to uuid DEFAULT NULL::uuid, p_leads_to uuid DEFAULT NULL::uuid, p_projects_to uuid DEFAULT NULL::uuid, p_krs_to uuid DEFAULT NULL::uuid, p_mode text DEFAULT 'remove'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_parent uuid;
  v_tasks integer := 0;
  v_reports integer := 0;
  v_leads integer := 0;
  v_projects integer := 0;
  v_krs integer := 0;
  v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  -- `transfer` (mig. 164) : transmettre sans partir.
  IF p_mode NOT IN ('remove', 'suspend', 'transfer') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = 'P0001';
  END IF;

  SELECT manager_id INTO v_parent FROM public.organization_members
   WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Toute cible doit être un membre de l'organisation, et pas la personne qui part.
  FOREACH v_target IN ARRAY ARRAY[p_tasks_to, p_reports_to, p_leads_to, p_projects_to, p_krs_to] LOOP
    IF v_target IS NOT NULL AND (
      v_target = p_user
      OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = p_org AND user_id = v_target)
    ) THEN
      RAISE EXCEPTION 'invalid_target' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  IF p_mode <> 'transfer' THEN
    PERFORM set_config('cosmo.departing_member', p_user::text, true);
  END IF;

  -- En `transfer`, une cible absente veut dire « ne pas toucher » : on ne
  -- désassigne pas quelqu'un qui reste, sauf si on nomme qui reprend.
  IF p_mode <> 'transfer' OR p_tasks_to IS NOT NULL THEN
    UPDATE public.team_tasks t
       SET assignee_ids = (
             SELECT COALESCE(array_agg(DISTINCT u), ARRAY[]::uuid[])
               FROM unnest(array_remove(t.assignee_ids, p_user) ||
                           CASE WHEN p_tasks_to IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[p_tasks_to] END) u
           )
     WHERE t.org_id = p_org
       AND NOT t.completed
       -- Corbeille (mig. 152) : une tâche supprimée ne se transmet pas.
       AND t.deleted_at IS NULL
       AND p_user = ANY (t.assignee_ids);
    GET DIAGNOSTICS v_tasks = ROW_COUNT;
  END IF;

  -- Subordonnés directs. Si la cible est elle-même un subordonné direct, elle
  -- remonte d'abord d'un cran : sinon elle deviendrait sa propre supérieure.
  IF p_mode <> 'transfer' OR p_reports_to IS NOT NULL THEN
    UPDATE public.organization_members
       SET manager_id = v_parent
     WHERE org_id = p_org AND user_id = p_reports_to AND manager_id = p_user;
    UPDATE public.organization_members
       SET manager_id = COALESCE(p_reports_to, v_parent)
     WHERE org_id = p_org AND manager_id = p_user;
    GET DIAGNOSTICS v_reports = ROW_COUNT;
  END IF;

  -- Rôles de responsable d'équipe : transmis, puis retirés à qui les cède.
  IF p_leads_to IS NOT NULL THEN
    INSERT INTO public.org_team_members (team_id, org_id, user_id, is_lead)
      SELECT tm.team_id, p_org, p_leads_to, true
        FROM public.org_team_members tm
       WHERE tm.org_id = p_org AND tm.user_id = p_user AND tm.is_lead
    ON CONFLICT (team_id, user_id) DO UPDATE SET is_lead = true;
    GET DIAGNOSTICS v_leads = ROW_COUNT;
    UPDATE public.org_team_members SET is_lead = false
     WHERE org_id = p_org AND user_id = p_user AND is_lead;
  END IF;

  -- Projets portés ET co-pilotages (mig. 190).
  IF p_mode <> 'transfer' OR p_projects_to IS NOT NULL THEN
    UPDATE public.team_projects SET owner_id = p_projects_to
     WHERE org_id = p_org AND owner_id = p_user;
    GET DIAGNOSTICS v_projects = ROW_COUNT;
    IF p_projects_to IS NOT NULL THEN
      INSERT INTO public.team_project_members (project_id, user_id, org_id, role)
        SELECT pm.project_id, p_projects_to, p_org, 'lead'
          FROM public.team_project_members pm
         WHERE pm.org_id = p_org AND pm.user_id = p_user AND pm.role = 'lead'
      ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'lead';
    END IF;
  END IF;

  -- KR : responsable transféré, contributeur retiré (sauf en `transfer`).
  IF p_mode <> 'transfer' OR p_krs_to IS NOT NULL THEN
    UPDATE public.team_key_results SET assignee_id = p_krs_to
     WHERE org_id = p_org AND assignee_id = p_user;
    GET DIAGNOSTICS v_krs = ROW_COUNT;
  END IF;
  IF p_mode <> 'transfer' THEN
    UPDATE public.team_key_results SET contributor_ids = array_remove(contributor_ids, p_user)
     WHERE org_id = p_org AND p_user = ANY (contributor_ids);
  END IF;

  IF p_mode = 'remove' THEN
    PERFORM public.remove_member(p_org, p_user);
  ELSIF p_mode = 'suspend' THEN
    IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org AND owner_id = p_user) THEN
      RAISE EXCEPTION 'cannot_restrict_owner' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.organization_members SET suspended_at = now()
     WHERE org_id = p_org AND user_id = p_user;
  END IF;

  RETURN jsonb_build_object(
    'tasks', v_tasks, 'reports', v_reports, 'leads', v_leads,
    'projects', v_projects, 'krs', v_krs
  );
END;
$$;


--
-- Name: org_admin_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_admin_count(p_org uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT COUNT(*)::int FROM public.organization_members
  WHERE org_id = p_org AND role = 'admin';
$$;


--
-- Name: org_member_can_invite(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_member_can_invite(p_org uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = p_org AND m.user_id = p_user
         AND m.suspended_at IS NULL
         AND (m.access_expires_at IS NULL OR m.access_expires_at > now())
    ) THEN false
    WHEN EXISTS (
      SELECT 1 FROM public.organization_members m
       WHERE m.org_id = p_org AND m.user_id = p_user AND m.role = 'admin'
    ) THEN true
    ELSE COALESCE(
      (
        SELECT CASE WHEN count(*) = 0 THEN NULL ELSE bool_or('member.invite' = ANY (r.granted_keys)) END
          FROM public.org_member_roles mr
          JOIN public.org_roles r ON r.id = mr.role_id
         WHERE mr.org_id = p_org AND mr.user_id = p_user
           AND mr.starts_at <= now()
           AND (mr.ends_at IS NULL OR mr.ends_at > now())
      ),
      (
        SELECT p.can_invite_member FROM public.org_member_permissions p
         WHERE p.org_id = p_org AND p.user_id = p_user
      ),
      public.org_member_default_perm(p_org, 'member.invite')
    )
  END;
$$;


--
-- Name: org_member_default_perm(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_member_default_perm(p_org uuid, p_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT p_key = ANY (COALESCE(
    (SELECT s.member_default_perms FROM public.org_settings s WHERE s.org_id = p_org),
    ARRAY['task.create', 'task.editAny']::text[]
  ));
$$;


--
-- Name: org_notifications_to_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_notifications_to_email(p_mode text) RETURNS TABLE(notification_id uuid, org_id uuid, org_name text, user_id uuid, email text, kind text, task_name text, project_name text, actor_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT n.id, n.org_id, o.name, n.user_id, u.email::text, n.kind,
         t.name, p.name, pr.display_name, n.created_at
    FROM public.org_notifications n
    JOIN public.org_notification_settings s ON s.org_id = n.org_id AND s.user_id = n.user_id
    JOIN public.organizations o ON o.id = n.org_id
    JOIN auth.users u ON u.id = n.user_id
    LEFT JOIN public.team_tasks t ON t.id = n.task_id
    LEFT JOIN public.team_projects p ON p.id = n.project_id
    LEFT JOIN public.profiles pr ON pr.id = n.actor_id
   WHERE n.read_at IS NULL
     AND n.emailed_at IS NULL
     AND n.created_at > now() - INTERVAL '2 days'
     AND (
       (p_mode = 'hourly' AND n.kind = ANY (s.email_kinds))
       OR (p_mode = 'daily' AND s.digest = 'daily')
     )
   ORDER BY n.user_id, n.created_at
   LIMIT 5000;
$$;


--
-- Name: org_saved_view_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_saved_view_before_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.org_id IS DISTINCT FROM OLD.org_id
          OR NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.scope IS DISTINCT FROM OLD.scope) THEN
    RAISE EXCEPTION 'org_saved_views: owner, organization and scope are immutable';
  END IF;
  IF TG_OP = 'INSERT' AND (
    SELECT count(*) FROM public.org_saved_views v
     WHERE v.org_id = NEW.org_id AND v.user_id = NEW.user_id AND v.scope = NEW.scope
  ) >= 50 THEN
    RAISE EXCEPTION 'saved_views_limit' USING ERRCODE = '54000';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: org_seats_allowed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_seats_allowed(p_org uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_enforced BOOLEAN;
  v_quota    INT;
  v_status   TEXT;
  v_count    INT;
BEGIN
  SELECT enabled INTO v_enforced FROM public.billing_flags
  WHERE key = 'enterprise_seat_limit';
  IF v_enforced IS DISTINCT FROM true THEN
    RETURN true; -- gate dormant : aucune limite tant que non activé
  END IF;

  SELECT max_members, status INTO v_quota, v_status
  FROM public.org_subscriptions WHERE org_id = p_org;

  -- Pas d'abonnement, ou abonnement non actif (impayé, résilié) → palier
  -- gratuit. On ne retire JAMAIS de membre : seule la croissance est bloquée.
  IF v_status IS DISTINCT FROM 'active' THEN
    v_quota := 5;
  END IF;

  -- Palier sans plafond.
  IF v_quota IS NULL THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::int INTO v_count FROM public.organization_members
  WHERE org_id = p_org;

  RETURN v_count < v_quota;
END;
$$;


--
-- Name: org_settings_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_settings_before_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = NEW.timezone) THEN
    RAISE EXCEPTION 'invalid_timezone' USING ERRCODE = '22023';
  END IF;
  NEW.work_days := ARRAY(SELECT DISTINCT d FROM unnest(NEW.work_days) d ORDER BY d);
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: org_team_before_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_team_before_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'org_id is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: org_verified_domain_before_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_verified_domain_before_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.domain := lower(btrim(NEW.domain));
  NEW.verified_at := NULL;
  NEW.last_checked_at := NULL;
  NEW.created_by := auth.uid();
  IF (SELECT count(*) FROM public.org_verified_domains d WHERE d.org_id = NEW.org_id) >= 20 THEN
    RAISE EXCEPTION 'domains_limit' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: org_webhook_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_webhook_before_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.secret IS DISTINCT FROM OLD.secret THEN
      RAISE EXCEPTION 'org_webhooks: organization and secret are immutable';
    END IF;
    -- Le suivi d'envoi ne s'écrit que par l'Edge Function (service_role).
    IF auth.uid() IS NOT NULL THEN
      NEW.last_status := OLD.last_status;
      NEW.last_delivery_at := OLD.last_delivery_at;
      NEW.failure_count := CASE WHEN NEW.enabled AND NOT OLD.enabled THEN 0 ELSE OLD.failure_count END;
    END IF;
  ELSE
    NEW.created_by := auth.uid();
    NEW.last_status := NULL;
    NEW.last_delivery_at := NULL;
    NEW.failure_count := 0;
    IF (SELECT count(*) FROM public.org_webhooks w WHERE w.org_id = NEW.org_id) >= 10 THEN
      RAISE EXCEPTION 'webhooks_limit' USING ERRCODE = '54000';
    END IF;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.events := ARRAY(SELECT DISTINCT e FROM unnest(NEW.events) e ORDER BY e);
  RETURN NEW;
END;
$$;


--
-- Name: org_webhook_deliveries_due(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.org_webhook_deliveries_due(p_limit integer DEFAULT 100) RETURNS TABLE(delivery_id uuid, webhook_id uuid, url text, format text, secret text, event text, payload jsonb, attempts smallint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT d.id, w.id, w.url, w.format, w.secret, d.event, d.payload, d.attempts
    FROM public.org_webhook_deliveries d
    JOIN public.org_webhooks w ON w.id = d.webhook_id
   WHERE d.delivered_at IS NULL AND d.attempts < 5 AND w.enabled
   ORDER BY d.created_at
   LIMIT LEAST(GREATEST(p_limit, 1), 500);
$$;


--
-- Name: orgs_due_for_renewal_notice(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.orgs_due_for_renewal_notice(p_min_days integer DEFAULT 30, p_max_days integer DEFAULT 45) RETURNS TABLE(org_id uuid, org_name text, owner_email text, period_end date, tier_key text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT
    s.org_id,
    o.name,
    u.email::text,
    s.current_period_end::date,
    s.tier_key
  FROM public.org_subscriptions s
  JOIN public.organizations o ON o.id = s.org_id
  JOIN auth.users u           ON u.id = o.owner_id
  WHERE s.status = 'active'
    AND s.billing_interval = 'yearly'
    AND s.tier_key <> 'free'
    AND s.cancel_at_period_end = false
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end::date
        BETWEEN (CURRENT_DATE + p_min_days) AND (CURRENT_DATE + p_max_days)
    AND NOT EXISTS (
      SELECT 1 FROM public.renewal_notices n
       WHERE n.org_id = s.org_id
         AND n.period_end = s.current_period_end::date
    )
    AND u.email IS NOT NULL;
$$;


--
-- Name: orgs_for_seat_alert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.orgs_for_seat_alert() RETURNS TABLE(org_id uuid, org_name text, owner_email text, tier_key text, member_count integer, quota integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  WITH flag AS (
    SELECT enabled FROM public.billing_flags WHERE key = 'enterprise_seat_limit'
  ),
  eff AS (
    SELECT
      o.id   AS org_id,
      o.name AS org_name,
      o.owner_id,
      CASE WHEN s.status = 'active' THEN COALESCE(s.tier_key, 'free') ELSE 'free' END AS tier_key,
      CASE WHEN s.status = 'active' THEN s.max_members ELSE 5 END AS quota
    FROM public.organizations o
    LEFT JOIN public.org_subscriptions s ON s.org_id = o.id
  ),
  counted AS (
    SELECT e.*, (SELECT COUNT(*)::int FROM public.organization_members m WHERE m.org_id = e.org_id) AS member_count
    FROM eff e
    WHERE e.quota IS NOT NULL AND e.quota > 0
  )
  SELECT c.org_id, c.org_name, u.email::text, c.tier_key, c.member_count, c.quota
  FROM counted c
  JOIN auth.users u ON u.id = c.owner_id
  WHERE (SELECT enabled FROM flag) IS TRUE
    AND c.member_count * 10 >= c.quota * 8
    AND u.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.org_seat_alerts a
       WHERE a.org_id = c.org_id AND a.tier_key = c.tier_key
    );
$$;


--
-- Name: orgs_missing_renewal_notice(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.orgs_missing_renewal_notice() RETURNS TABLE(org_id uuid, period_end date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT s.org_id, s.current_period_end::date
  FROM public.org_subscriptions s
  WHERE s.status = 'active'
    AND s.billing_interval = 'yearly'
    AND s.tier_key <> 'free'
    AND s.cancel_at_period_end = false
    AND s.renewal_notice_missed_at IS NULL
    AND s.current_period_end IS NOT NULL
    AND s.current_period_end::date < CURRENT_DATE + 30
    AND NOT EXISTS (
      SELECT 1 FROM public.renewal_notices n
       WHERE n.org_id = s.org_id
         AND n.period_end = s.current_period_end::date
    );
$$;


--
-- Name: owns_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_task(p_task_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.user_id = auth.uid()
  );
$$;


--
-- Name: payment_records_affiliate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payment_records_affiliate() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  BEGIN
    PERFORM public.affiliate_process(NEW);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'affiliate commission skipped for payment_record %: %', NEW.id, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;


--
-- Name: post_kr_checkin(uuid, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_kr_checkin(p_kr uuid, p_value numeric, p_status text, p_note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  UPDATE public.team_key_results
     SET current_value = p_value,
         health = p_status,
         health_updated_at = now()
   WHERE id = p_kr
  RETURNING org_id INTO v_org;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.insert_kr_checkin_row(p_kr, v_org, p_value, p_status, p_note);
END;
$$;


--
-- Name: prevent_org_immutables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_org_immutables() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  IF NEW.join_code IS DISTINCT FROM OLD.join_code
     AND current_setting('cosmo.allow_code_regen', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'join_code is immutable';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND auth.uid() IS NOT NULL
     AND current_setting('cosmo.allow_owner_transfer', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'owner_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_task_dependency_cycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_task_dependency_cycle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT NEW.depends_on_id, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.task_dependencies d
        JOIN upstream u ON d.task_id = u.id
       WHERE u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'dependency_cycle';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_team_task_dependency_cycle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_team_task_dependency_cycle() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT NEW.depends_on_id, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.team_task_dependencies d
        JOIN upstream u ON d.task_id = u.id
       WHERE u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'dependency_cycle';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prevent_user_id_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_user_id_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: preview_share_link(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_share_link(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_owner_name TEXT;
  v_task_name  TEXT;
BEGIN
  -- `owner_name` peut être NULL (profil sans display_name) : le repli est un
  -- libellé d'INTERFACE, il appartient au client qui seul connaît la langue.
  SELECT
    NULLIF(TRIM(p.display_name), ''),
    t.name
  INTO v_owner_name, v_task_name
  FROM public.share_links sl
  JOIN public.tasks t     ON t.id = sl.task_id
  LEFT JOIN public.profiles p ON p.id = sl.owner_id
  WHERE sl.id = p_token
    AND sl.expires_at > NOW();

  -- Lien inconnu, expiré, ou tâche supprimée → réponse indistinguable.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  RETURN jsonb_build_object(
    'expired',    false,
    'owner_name', v_owner_name,
    'task_name',  v_task_name
  );
END;
$$;


--
-- Name: FUNCTION preview_share_link(p_token uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.preview_share_link(p_token uuid) IS 'Aperçu anonyme d''un lien d''invitation : owner_name + task_name uniquement. Ne consomme pas le lien.';


--
-- Name: profiles_affiliation_frozen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profiles_affiliation_frozen() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.affiliate_id   IS DISTINCT FROM OLD.affiliate_id
  OR NEW.affiliate_slug IS DISTINCT FROM OLD.affiliate_slug
  OR NEW.affiliated_at  IS DISTINCT FROM OLD.affiliated_at THEN
    IF OLD.affiliate_id IS NOT NULL OR current_user IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION 'affiliation is permanent' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: prune_declined_org_invitations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_declined_org_invitations() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.org_invitations
  WHERE declined_at IS NOT NULL
    AND declined_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: FUNCTION prune_declined_org_invitations(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.prune_declined_org_invitations() IS 'RGPD (mig. 112) : supprime les invitations d''entreprise REFUSÉES depuis plus de 30 jours. Un refus reste lisible par tous les membres de l''org (policy org_invitations_select) : sans péremption, c''est une trace personnelle permanente. Appelée par pg_cron, jamais par un client.';


--
-- Name: prune_processed_stripe_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_processed_stripe_events() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.processed_stripe_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: FUNCTION prune_processed_stripe_events(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.prune_processed_stripe_events() IS 'Purge les marqueurs d''idempotence Stripe de plus de 90 jours. Stripe cesse de re-livrer après ~3 j : au-delà, la ligne ne protège plus de rien.';


--
-- Name: purge_archived_team_project(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_archived_team_project(p_project uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_archived timestamptz;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT archived_at INTO v_archived FROM public.team_projects WHERE id = p_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'project_not_archived' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.team_projects WHERE id = p_project;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;


--
-- Name: purge_expired_email_invitations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_expired_email_invitations() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.org_invite_links
   WHERE email IS NOT NULL
     AND claimed_at IS NULL
     AND expires_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: purge_org_audit_log(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_org_audit_log() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.org_audit_log WHERE created_at < now() - INTERVAL '365 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: purge_project_memberships_on_leave(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_project_memberships_on_leave() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  DELETE FROM public.team_project_members
   WHERE org_id = OLD.org_id AND user_id = OLD.user_id;
  RETURN OLD;
END;
$$;


--
-- Name: purge_stale_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_stale_rate_limits() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits WHERE updated_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: purge_team_okr(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_team_okr(p_okr uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_okrs WHERE id = p_okr AND deleted_at IS NOT NULL;
  IF v_org IS NULL OR NOT public.is_org_admin(v_org) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.team_okrs WHERE id = p_okr;
END;
$$;


--
-- Name: purge_team_okr_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_team_okr_trash() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.team_okrs
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: purge_team_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_team_task(p_task uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_tasks WHERE id = p_task AND deleted_at IS NOT NULL;
  IF v_org IS NULL OR NOT public.is_org_admin(v_org) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.team_tasks WHERE id = p_task;
END;
$$;


--
-- Name: purge_team_task_trash(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_team_task_trash() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.team_tasks
   WHERE deleted_at IS NOT NULL
     AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


--
-- Name: purge_traffic(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_traffic() RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  DELETE FROM public.traffic_hits  WHERE occurred_at < now() - interval '13 months';
  DELETE FROM public.traffic_salts WHERE day < (now() AT TIME ZONE 'UTC')::date;
$$;


--
-- Name: purge_user_from_team_assignments(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_user_from_team_assignments(p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.team_tasks
    SET assignee_ids = array_remove(assignee_ids, p_user)
    WHERE assignee_ids @> ARRAY[p_user];
  UPDATE public.team_task_comments
    SET mentions = array_remove(mentions, p_user)
    WHERE mentions @> ARRAY[p_user];
  UPDATE public.team_key_results
    SET contributor_ids = array_remove(contributor_ids, p_user)
    WHERE contributor_ids @> ARRAY[p_user];
END;
$$;


--
-- Name: record_demo_conversion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_demo_conversion(p_device_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  UPDATE public.demo_devices
  SET converted_at = NOW(), converted_user_id = auth.uid()
  WHERE device_id = p_device_id
    AND converted_at IS NULL
    AND auth.uid() IS NOT NULL;
$$;


--
-- Name: record_demo_visit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_demo_visit(p_device_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  c_per_minute_cap CONSTANT INTEGER := 60;
  v_recent INTEGER;
BEGIN
  IF p_device_id IS NULL THEN RETURN; END IF;

  -- Rétention 90 j pour les visites non converties (mig. 084, inchangé)…
  DELETE FROM public.demo_devices
  WHERE first_seen_at < NOW() - INTERVAL '90 days' AND converted_at IS NULL;

  -- …et 400 j pour les visites converties, qui n'avaient AUCUNE borne
  -- (mig. 114). Même seuil que user_activity_days, pour n'avoir qu'une seule
  -- durée à publier dans la politique de confidentialité.
  DELETE FROM public.demo_devices
  WHERE first_seen_at < NOW() - INTERVAL '400 days';

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


--
-- Name: FUNCTION record_demo_visit(p_device_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_demo_visit(p_device_id uuid) IS 'Compteur de visites de la demo. Purge 90 j (non converties) et 400 j (converties, mig. 114 — l exception illimitee etait le cas le plus sensible). Cap de 60 insertions/minute : ecriture anonyme bornee, jamais bruyante.';


--
-- Name: record_support_report(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_support_report(p_category text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.support_reports (category)
  VALUES (p_category)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


--
-- Name: regenerate_join_code(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.regenerate_join_code(p_org uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can regenerate the join code';
  END IF;

  PERFORM set_config('cosmo.allow_code_regen', 'on', true);

  FOR attempt IN 1..5 LOOP
    v_code := public.generate_join_code();
    BEGIN
      UPDATE public.organizations SET join_code = v_code WHERE id = p_org;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;
  RETURN v_code;
END;
$$;


--
-- Name: release_member_work(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_member_work(p_org uuid, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  UPDATE public.team_tasks
     SET assignee_ids = array_remove(assignee_ids, p_user)
   WHERE org_id = p_org AND NOT completed AND deleted_at IS NULL
     AND assignee_ids @> ARRAY[p_user];
  UPDATE public.team_projects SET owner_id = NULL
   WHERE org_id = p_org AND owner_id = p_user;
  UPDATE public.team_key_results SET contributor_ids = array_remove(contributor_ids, p_user)
   WHERE org_id = p_org AND contributor_ids @> ARRAY[p_user];
  DELETE FROM public.team_task_followers WHERE org_id = p_org AND user_id = p_user;
  DELETE FROM public.team_project_followers WHERE org_id = p_org AND user_id = p_user;
END;
$$;


--
-- Name: remove_friendship(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_friendship(p_friend_row_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_email TEXT;
  v_friend_email TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Récupère l'email du caller (pour identifier la ligne réciproque) +
  -- l'email du friend ciblé. Le SELECT est scopé `user_id = v_caller`
  -- donc le caller ne peut cibler qu'une de ses propres lignes.
  SELECT f.email INTO v_friend_email
  FROM public.friends f
  WHERE f.id = p_friend_row_id
    AND f.user_id = v_caller;

  IF v_friend_email IS NULL THEN
    -- Ligne inexistante ou pas owned par le caller — no-op silencieux
    -- (idempotent, ne leak pas d'info sur l'existence d'autres lignes).
    RETURN;
  END IF;

  SELECT email INTO v_caller_email
  FROM auth.users
  WHERE id = v_caller;

  -- Suppression atomique des deux côtés
  DELETE FROM public.friends
  WHERE id = p_friend_row_id
    AND user_id = v_caller;

  IF v_caller_email IS NOT NULL THEN
    DELETE FROM public.friends
    WHERE lower(email) = lower(v_caller_email)
      AND user_id <> v_caller
      AND lower(email) = lower(v_caller_email)
      -- Restreint au "vrai" ami réciproque : celui dont l'email caller
      -- pointe ET dont la ligne est owned par l'user dont l'email matche
      -- v_friend_email.
      AND user_id IN (
        SELECT id FROM auth.users WHERE lower(email) = lower(v_friend_email)
      );
  END IF;
END;
$$;


--
-- Name: remove_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_member(p_org uuid, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can remove members';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  PERFORM set_config('cosmo.departing_member', p_user::text, true);

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = p_user;

  PERFORM public.release_member_work(p_org, p_user);

  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = p_user;

  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind)
  VALUES (p_org, p_user, auth.uid(), 'org_removed');

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
  END IF;
END;
$$;


--
-- Name: remove_task_from_list(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_task_from_list(p_task_id uuid, p_list_id uuid) RETURNS public.lists
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row public.lists;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.lists
  SET task_ids = array_remove(COALESCE(task_ids, ARRAY[]::UUID[]), p_task_id)
  WHERE id = p_list_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'List not found';
  END IF;

  RETURN v_row;
END;
$$;


--
-- Name: request_join_organization(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_join_organization(p_code text) RETURNS TABLE(org_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_org FROM public.organizations
  WHERE join_code = upper(btrim(p_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = v_org.id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this organization';
  END IF;

  INSERT INTO public.organization_join_requests (org_id, user_id)
  VALUES (v_org.id, auth.uid())
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET requested_at = NOW(), accepted_at = NULL, rejected_at = NULL;

  RETURN QUERY SELECT v_org.name;
END;
$$;


--
-- Name: reset_stripe_identifiers(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_stripe_identifiers(p_apply boolean DEFAULT false) RETURNS TABLE(cible text, action text, lignes bigint)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_perso   BIGINT := 0;
  v_org     BIGINT := 0;
  v_demoted BIGINT := 0;
BEGIN
  IF p_apply THEN
    -- ── Particuliers : les deux colonnes, rien d'autre ──────────────
    UPDATE public.subscriptions
       SET stripe_customer_id     = NULL,
           stripe_subscription_id = NULL,
           updated_at             = now()
     WHERE stripe_customer_id IS NOT NULL
        OR stripe_subscription_id IS NOT NULL;
    GET DIAGNOSTICS v_perso = ROW_COUNT;

    -- ── Organisations : le palier d'abord, tant que le lien existe ──
    --
    -- ⚠️ L'ORDRE COMPTE. La condition de rétrogradation est « la ligne portait
    -- un lien Stripe » : si on effaçait les identifiants en premier, plus
    -- aucune ligne ne satisfairait cette condition et les paliers payants
    -- resteraient tels quels, sans rien derrière pour les payer.
    UPDATE public.org_subscriptions
       SET tier_key           = 'free',
           max_members        = 5,
           status             = 'cancelled',
           current_period_end = NULL,
           discount_code      = NULL,
           -- Colonne DESCRIPTIVE (mig. 123) : elle dit ce qui est facturé.
           -- Laisser 'yearly' sur une org qu'on vient de rendre gratuite
           -- décrirait une facturation annuelle que plus rien n'émet.
           billing_interval   = 'monthly',
           updated_at         = now()
     WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
       AND tier_key <> 'free';
    GET DIAGNOSTICS v_demoted = ROW_COUNT;

    UPDATE public.org_subscriptions
       SET stripe_customer_id     = NULL,
           stripe_subscription_id = NULL,
           updated_at             = now()
     WHERE stripe_customer_id IS NOT NULL
        OR stripe_subscription_id IS NOT NULL;
    GET DIAGNOSTICS v_org = ROW_COUNT;
  ELSE
    -- À blanc : exactement les mêmes prédicats, aucune écriture.
    SELECT count(*) INTO v_perso FROM public.subscriptions
     WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;

    SELECT count(*) INTO v_demoted FROM public.org_subscriptions
     WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
       AND tier_key <> 'free';

    SELECT count(*) INTO v_org FROM public.org_subscriptions
     WHERE stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL;
  END IF;

  RETURN QUERY
  SELECT 'public.subscriptions'::TEXT,
         CASE WHEN p_apply THEN 'identifiants Stripe effaces'
              ELSE 'identifiants Stripe A EFFACER (essai a blanc)' END::TEXT,
         v_perso
  UNION ALL
  SELECT 'public.org_subscriptions'::TEXT,
         CASE WHEN p_apply THEN 'identifiants Stripe effaces'
              ELSE 'identifiants Stripe A EFFACER (essai a blanc)' END::TEXT,
         v_org
  UNION ALL
  SELECT 'public.org_subscriptions'::TEXT,
         CASE WHEN p_apply THEN 'paliers payants redescendus au gratuit'
              ELSE 'paliers payants A REDESCENDRE (essai a blanc)' END::TEXT,
         v_demoted
  -- Les trois suivantes ne sont pas des actions : ce sont les tables qu'on
  -- laisse INTACTES, affichées pour que l'operateur voie qu'elles n'ont pas
  -- ete oubliees par distraction.
  UNION ALL
  SELECT 'public.payment_records'::TEXT,
         'INTACT · journal fiscal scelle (mig. 125)'::TEXT,
         (SELECT count(*) FROM public.payment_records)
  UNION ALL
  SELECT 'public.withdrawal_consents'::TEXT,
         'INTACT · preuve de renonciation (mig. 135)'::TEXT,
         (SELECT count(*) FROM public.withdrawal_consents)
  UNION ALL
  SELECT 'public.processed_stripe_events'::TEXT,
         'INTACT · idempotence du webhook'::TEXT,
         (SELECT count(*) FROM public.processed_stripe_events);
END;
$$;


--
-- Name: FUNCTION reset_stripe_identifiers(p_apply boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.reset_stripe_identifiers(p_apply boolean) IS 'Bascule Stripe test -> live : efface stripe_customer_id / stripe_subscription_id de subscriptions et org_subscriptions, et redescend au palier gratuit toute org payante dont le lien Stripe disparait. A BLANC par defaut ; passer true pour ecrire. Ne touche JAMAIS payment_records, payment_closures, withdrawal_consents, renewal_notices ni processed_stripe_events. Voir mig. 140.';


--
-- Name: resolve_profile_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_profile_by_email(p_email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_id UUID;
  v_is_contact BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_email IS NULL OR length(p_email) = 0 OR length(p_email) > 320 THEN
    RETURN NULL;
  END IF;

  -- Un email déjà présent dans les contacts de l'appelant ne coûte rien :
  -- c'est le cas d'usage légitime (rehydratation de la liste d'amis).
  SELECT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.user_id = auth.uid() AND lower(f.email) = lower(p_email)
  ) INTO v_is_contact;

  IF NOT v_is_contact THEN
    PERFORM public.consume_email_lookup_quota(1);
  END IF;

  SELECT id INTO v_id
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
  ORDER BY id            -- M-1 : résolution déterministe
  LIMIT 1;

  RETURN v_id;
END;
$$;


--
-- Name: resolve_profiles_by_emails(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_profiles_by_emails(p_emails text[]) RETURNS TABLE(email text, id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_cost
  FROM unnest(p_emails[1:50]) AS e
  WHERE e IS NOT NULL AND length(e) > 0 AND length(e) <= 320
    AND NOT EXISTS (
      SELECT 1 FROM public.friends f
      WHERE f.user_id = auth.uid() AND lower(f.email) = lower(e)
    );

  PERFORM public.consume_email_lookup_quota(v_cost::integer);

  RETURN QUERY
  SELECT lower(e) AS email, pr.id
  FROM unnest(p_emails[1:50]) AS e
  JOIN public.profiles pr ON lower(pr.email) = lower(e)
  WHERE e IS NOT NULL AND length(e) > 0 AND length(e) <= 320;
END;
$$;


--
-- Name: respond_join_request(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_join_request(p_request_id uuid, p_accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_req public.organization_join_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req FROM public.organization_join_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF NOT public.is_org_admin(v_req.org_id) THEN
    RAISE EXCEPTION 'Only an admin can respond to join requests';
  END IF;

  IF v_req.accepted_at IS NOT NULL OR v_req.rejected_at IS NOT NULL THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  IF p_accept THEN
    IF NOT public.org_seats_allowed(v_req.org_id) THEN
      RAISE EXCEPTION 'seat_limit_reached';
    END IF;

    UPDATE public.organization_join_requests
    SET accepted_at = NOW() WHERE id = p_request_id;

    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (v_req.org_id, v_req.user_id, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE public.profiles SET account_type = 'business' WHERE id = v_req.user_id;
  ELSE
    UPDATE public.organization_join_requests
    SET rejected_at = NOW() WHERE id = p_request_id;
  END IF;
END;
$$;


--
-- Name: respond_org_invitation(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.respond_org_invitation(p_invitation uuid, p_accept boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_inv public.org_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM public.org_invitations
  WHERE id = p_invitation
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  -- SEUL le destinataire répond. Un membre de l'org peut LIRE la ligne
  -- (policy SELECT) mais pas décider à sa place.
  IF v_inv.invitee_id <> auth.uid() THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL OR v_inv.declined_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_already_processed';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.org_invitations SET declined_at = NOW() WHERE id = p_invitation;
    RETURN;
  END IF;

  -- Re-validation à l'acceptation : l'inviteur a pu être retiré de l'org
  -- entre-temps. Une invitation ne survit pas à celui qui l'a émise.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = v_inv.org_id AND user_id = v_inv.inviter_id
  ) THEN
    RAISE EXCEPTION 'inviter_no_longer_member';
  END IF;

  -- Freemium (dormant tant que le flag n'est pas activé) — même garde que
  -- claim_org_invite et respond_join_request.
  IF NOT public.org_seats_allowed(v_inv.org_id) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  -- Entrée NON PLACÉE : un admin range ensuite dans la pyramide.
  INSERT INTO public.organization_members (org_id, user_id, role, manager_id)
  VALUES (v_inv.org_id, auth.uid(), 'member', NULL)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.org_invitations SET accepted_at = NOW() WHERE id = p_invitation;
  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();
END;
$$;


--
-- Name: restore_team_okr(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_team_okr(p_okr uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_okr record;
BEGIN
  SELECT o.id, o.org_id, o.deleted_by INTO v_okr
    FROM public.team_okrs o
   WHERE o.id = p_okr AND o.deleted_at IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND OR NOT public.can_restore_team_okr(v_okr.org_id, v_okr.deleted_by) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.team_okrs SET deleted_at = NULL, deleted_by = NULL WHERE id = p_okr;
END;
$$;


--
-- Name: restore_team_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_team_task(p_task uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_task record;
BEGIN
  SELECT t.id, t.org_id, t.project_id, t.deleted_by
    INTO v_task
    FROM public.team_tasks t
   WHERE t.id = p_task AND t.deleted_at IS NOT NULL
   FOR UPDATE;
  IF NOT FOUND
     OR NOT public.can_restore_team_task(v_task.org_id, v_task.project_id, v_task.deleted_by) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.team_tasks
     SET deleted_at = NULL, deleted_by = NULL
   WHERE id = p_task;
END;
$$;


--
-- Name: run_overdue_reminders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_overdue_reminders() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind, task_id)
  SELECT
    t.org_id,
    assignee,
    NULL,
    'task_overdue',
    t.id
  FROM public.team_tasks t
  CROSS JOIN LATERAL unnest(COALESCE(t.assignee_ids, ARRAY[]::uuid[])) AS assignee
  WHERE t.completed = false
    AND t.deleted_at IS NULL
    AND t.deadline IS NOT NULL
    AND t.deadline < CURRENT_DATE
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;


--
-- Name: FUNCTION run_overdue_reminders(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.run_overdue_reminders() IS 'Automatisation (mig. 096) : cree un rappel par tache en retard et par assigne, au plus une fois par jour (index unique partiel). Appelee par pg_cron, jamais par le client.';


--
-- Name: run_team_task_automations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_team_task_automations() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT a.action_kind, a.action_value
      FROM public.team_automations a
     WHERE a.org_id = NEW.org_id
       AND a.enabled
       AND (a.project_id IS NULL OR a.project_id = NEW.project_id)
       AND (
         (TG_OP = 'INSERT' AND a.trigger_kind = 'task_created')
         OR (TG_OP = 'UPDATE' AND a.trigger_kind = 'status_changed'
             AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = a.trigger_value)
       )
       -- L'auteur de la règle doit être encore admin (règle d'organisation),
       -- ou encore membre actif (règle de projet : on ne rejoue pas ici
       -- `can_edit_team_project`, qui dépend de `auth.uid()`, pas de l'auteur).
       AND EXISTS (
         SELECT 1 FROM public.organization_members m
          WHERE m.org_id = a.org_id AND m.user_id = a.created_by
            AND m.suspended_at IS NULL
            AND (m.role = 'admin' OR a.project_id IS NOT NULL)
       )
     ORDER BY a.position, a.created_at
  LOOP
    IF r.action_kind = 'set_priority' THEN
      NEW.priority := r.action_value::smallint;
    ELSIF r.action_kind = 'set_status' THEN
      NEW.status := r.action_value;
    ELSIF r.action_kind = 'add_assignee' AND NOT (r.action_value::uuid = ANY (COALESCE(NEW.assignee_ids, '{}'))) THEN
      NEW.assignee_ids := COALESCE(NEW.assignee_ids, '{}') || r.action_value::uuid;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: sanitize_display_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sanitize_display_name(raw text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  cleaned := regexp_replace(raw, '[<>"''`\\]', '', 'g');
  -- L'espace et le tiret sont legitimes dans un nom : on ne retire QUE les
  -- metacaracteres HTML/injection (ligne precedente).
  cleaned := regexp_replace(cleaned, '[[:cntrl:]]', '', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := btrim(cleaned);
  cleaned := left(cleaned, 80);
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;


--
-- Name: payment_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_closures (
    period_start date NOT NULL,
    period_end date NOT NULL,
    record_count integer NOT NULL,
    total_cents bigint NOT NULL,
    currency text NOT NULL,
    first_record_id bigint,
    last_record_id bigint,
    last_row_hash text,
    closure_hash text NOT NULL,
    sealed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE payment_closures; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.payment_closures IS 'Clotures mensuelles figees du journal d encaissement. Immuables.';


--
-- Name: seal_payment_period(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seal_payment_period(p_month date) RETURNS public.payment_closures
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_start DATE := date_trunc('month', p_month)::date;
  v_end   DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::date;
  v_row   public.payment_closures;
BEGIN
  IF v_start >= date_trunc('month', now())::date THEN
    RAISE EXCEPTION 'Cloture refusee : le mois % n est pas termine.', to_char(v_start, 'YYYY-MM')
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT * INTO v_row FROM public.payment_closures WHERE period_start = v_start;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.payment_closures (
    period_start, period_end, record_count, total_cents, currency,
    first_record_id, last_record_id, last_row_hash, closure_hash
  )
  SELECT
    v_start,
    v_end,
    count(*)::int,
    coalesce(sum(amount_cents), 0),
    coalesce(min(currency), 'eur'),
    min(id),
    max(id),
    (SELECT row_hash FROM public.payment_records
      WHERE occurred_at::date BETWEEN v_start AND v_end
      ORDER BY id DESC LIMIT 1),
    encode(
      extensions.digest(
        to_char(v_start, 'YYYY-MM') || '|' ||
        count(*)::text || '|' ||
        coalesce(sum(amount_cents), 0)::text || '|' ||
        coalesce(
          (SELECT row_hash FROM public.payment_records
            WHERE occurred_at::date BETWEEN v_start AND v_end
            ORDER BY id DESC LIMIT 1), ''),
        'sha256'
      ), 'hex')
  FROM public.payment_records
  WHERE occurred_at::date BETWEEN v_start AND v_end
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: seal_payment_record(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seal_payment_record() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_prev TEXT;
BEGIN
  -- Hash de la dernière ligne insérée. `ORDER BY id DESC` et non par date :
  -- la date Stripe peut être antérieure sur un rejeu, l'ordre du journal est
  -- l'ordre d'écriture.
  SELECT row_hash INTO v_prev
    FROM public.payment_records
   ORDER BY id DESC
   LIMIT 1;

  NEW.prev_hash := v_prev;

  -- Représentation canonique : les champs qui engagent, séparés par un
  -- caractère qui ne peut pas apparaître dedans. `coalesce` partout, sinon un
  -- NULL rendrait la concaténation entière NULL et le hash inexploitable.
  NEW.row_hash := encode(
    extensions.digest(
      coalesce(v_prev, '')                        || '|' ||
      NEW.stripe_event_id                         || '|' ||
      NEW.event_type                              || '|' ||
      coalesce(NEW.stripe_invoice_id, '')         || '|' ||
      coalesce(NEW.stripe_customer_id, '')        || '|' ||
      coalesce(NEW.org_id::text, '')              || '|' ||
      coalesce(NEW.user_id::text, '')             || '|' ||
      NEW.amount_cents::text                      || '|' ||
      NEW.currency                                || '|' ||
      to_char(NEW.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;


--
-- Name: search_org(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_org(p_org uuid, p_query text, p_limit integer DEFAULT 8) RETURNS TABLE(kind text, id uuid, label text, detail text, parent_id uuid)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE
  v_q     text := btrim(COALESCE(p_query, ''));
  v_like  text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
BEGIN
  IF (SELECT auth.uid()) IS NULL OR char_length(v_q) < 2 OR NOT public.is_org_member(p_org) THEN
    RETURN;
  END IF;
  v_q := left(v_q, 100);
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  (SELECT 'project'::text, p.id, p.name,
          CASE WHEN p.archived_at IS NOT NULL THEN 'archived' ELSE p.status END,
          NULL::uuid
     FROM public.get_my_team_projects(p_org) p
    WHERE NOT p.is_template
      AND (p.name ILIKE v_like OR p.description ILIKE v_like)
    ORDER BY (p.archived_at IS NOT NULL), (p.name ILIKE v_like) DESC, p.name
    LIMIT v_limit)
  UNION ALL
  (SELECT 'task'::text, t.id, t.name,
          CASE WHEN t.completed THEN 'done' ELSE t.status END, t.project_id
     FROM public.get_my_team_tasks(p_org) t
    WHERE t.name ILIKE v_like
    ORDER BY t.completed, t.created_at DESC
    LIMIT v_limit)
  UNION ALL
  (SELECT 'okr'::text, o.id, o.title, o.end_date::text, NULL::uuid
     FROM public.team_okrs o
    WHERE o.org_id = p_org
      AND (o.title ILIKE v_like OR o.description ILIKE v_like)
    ORDER BY o.created_at DESC
    LIMIT v_limit)
  UNION ALL
  (SELECT 'kr'::text, k.id, k.title, NULL::text, k.okr_id
     FROM public.team_key_results k
    WHERE k.org_id = p_org
      AND k.title ILIKE v_like
    ORDER BY k.completed, k.title
    LIMIT v_limit)
  UNION ALL
  (SELECT 'team'::text, tm.id, tm.name, NULL::text, NULL::uuid
     FROM public.org_teams tm
    WHERE tm.org_id = p_org
      AND tm.name ILIKE v_like
    ORDER BY tm.name
    LIMIT v_limit)
  UNION ALL
  (SELECT 'member'::text, om.user_id, COALESCE(NULLIF(pr.display_name, ''), pr.email, ''),
          pr.email, NULL::uuid
     FROM public.organization_members om
     JOIN public.profiles pr ON pr.id = om.user_id
    WHERE om.org_id = p_org
      AND (pr.display_name ILIKE v_like OR pr.email ILIKE v_like)
    ORDER BY pr.display_name
    LIMIT v_limit);
END;
$$;


--
-- Name: seed_default_categories(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_categories() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- Table qualifiee : ceinture ET bretelles avec le search_path fige.
  INSERT INTO public.categories (user_id, name, color) VALUES
    (NEW.id, 'Personnel',  '#3B82F6'),
    (NEW.id, 'Travail',    '#EF4444'),
    (NEW.id, 'Santé',      '#10B981'),
    (NEW.id, 'Loisirs',    '#F59E0B'),
    (NEW.id, 'Finance',    '#8B5CF6');
  RETURN NEW;
END;
$$;


--
-- Name: set_friend_request_receiver_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_friend_request_receiver_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.receiver_id IS NULL THEN
    SELECT id INTO NEW.receiver_id FROM auth.users WHERE lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_friend_request_sender_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_friend_request_sender_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.sender_email IS NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT email INTO NEW.sender_email FROM auth.users WHERE id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_key_result_completed_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_key_result_completed_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.completed = TRUE AND OLD.completed = FALSE THEN
    NEW.completed_at = NOW();
  END IF;
  IF NEW.completed = FALSE THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_member_access(uuid, uuid, boolean, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_member_access(p_org uuid, p_user uuid, p_suspended boolean, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot_restrict_self' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org AND owner_id = p_user) THEN
    RAISE EXCEPTION 'cannot_restrict_owner' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.organization_members
   WHERE org_id = p_org AND user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.organization_members
     SET suspended_at = CASE WHEN p_suspended THEN COALESCE(suspended_at, now()) ELSE NULL END,
         access_expires_at = p_expires_at
   WHERE org_id = p_org AND user_id = p_user;
END;
$$;


--
-- Name: set_member_manager(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_member_manager(p_org uuid, p_user uuid, p_manager uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_user
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF public.is_org_admin(p_org) THEN
    NULL; -- admin : tout est permis (le trigger garde cohérence + cycles)
  ELSE
    -- Manager : la CIBLE doit être dans mon sous-arbre (ou non placée n'est
    -- pas suffisant — seuls les admins placent les non-placés)…
    IF NOT public.is_above(p_org, p_user) THEN
      RAISE EXCEPTION 'You can only move members below you';
    END IF;
    -- …et la DESTINATION doit être moi ou quelqu'un de mon sous-arbre.
    IF p_manager IS NULL THEN
      RAISE EXCEPTION 'Only an admin can detach a member';
    END IF;
    IF p_manager <> auth.uid() AND NOT public.is_above(p_org, p_manager) THEN
      RAISE EXCEPTION 'Destination must be within your subtree';
    END IF;
  END IF;

  UPDATE public.organization_members
  SET manager_id = p_manager
  WHERE org_id = p_org AND user_id = p_user;
END;
$$;


--
-- Name: set_member_role(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_member_role(p_org uuid, p_user uuid, p_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_current_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can change roles';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT role INTO v_current_role FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_current_role = 'admin' AND p_role <> 'admin'
     AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot demote the last admin';
  END IF;

  UPDATE public.organization_members
  SET role = p_role
  WHERE org_id = p_org AND user_id = p_user;
END;
$$;


--
-- Name: set_tasks_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_tasks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: set_team_okr_links(uuid, uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.can_manage_team_okr_audience(p_okr) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT o.org_id INTO v_org FROM public.team_okrs o WHERE o.id = p_okr;

  IF p_team_ids IS NOT NULL THEN
    DELETE FROM public.team_okr_teams WHERE okr_id = p_okr;
    INSERT INTO public.team_okr_teams (okr_id, org_id, team_id, added_by)
      SELECT p_okr, v_org, t.id, auth.uid()
        FROM (SELECT DISTINCT unnest(p_team_ids) AS id LIMIT 20) t;
  END IF;

  IF p_member_ids IS NOT NULL THEN
    DELETE FROM public.team_okr_members WHERE okr_id = p_okr;
    INSERT INTO public.team_okr_members (okr_id, org_id, user_id, added_by)
      SELECT p_okr, v_org, m.id, auth.uid()
        FROM (SELECT DISTINCT unnest(p_member_ids) AS id LIMIT 50) m;
  END IF;
END;
$$;


--
-- Name: shares_org_with(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shares_org_with(p_target uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members mine
    JOIN public.organization_members theirs
      ON theirs.org_id = mine.org_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = p_target
  );
$$;


--
-- Name: sync_profile_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_task_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_task_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed THEN
      NEW.status := 'done';
    ELSIF NEW.status = 'done' THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.completed IS DISTINCT FROM OLD.completed THEN
    -- `completed` a bougé (case à cocher, toggle_task_complete_v2) : il décide.
    -- `completed_at` suit, comme le fait déjà la RPC : une écriture directe
    -- de `completed` laissait sinon une date de fin sur une tâche ouverte.
    IF NEW.completed THEN
      NEW.status := 'done';
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      NEW.completed_at := NULL;
      IF NEW.status = 'done' THEN
        NEW.status := 'todo';
      END IF;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Seul le statut a bougé (Tableau, fiche) : il décide.
    IF NEW.status = 'done' THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF OLD.status = 'done' THEN
      NEW.completed := false;
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_team_task_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_team_task_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  -- Cas 1 : le client écrit `status` (nouveau front).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'done' THEN
      NEW.completed := true;
      -- Ne pas écraser un completed_at déjà posé : la date de complétion
      -- d'origine est ce qui alimente vélocité et « terminées cette semaine ».
      NEW.completed_at := COALESCE(OLD.completed_at, now());
    ELSE
      NEW.completed := false;
      NEW.completed_at := NULL;
    END IF;

  -- Cas 2 : le client écrit `completed` (front actuel, inchangé).
  ELSIF NEW.completed IS DISTINCT FROM OLD.completed THEN
    IF NEW.completed THEN
      NEW.status := 'done';
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      -- Décocher renvoie à 'todo' et non à l'état antérieur : on ne le
      -- connaît pas, et prétendre le restaurer serait une invention.
      NEW.status := 'todo';
      NEW.completed_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: team_automation_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_automation_before_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
    RAISE EXCEPTION 'team_automations: organization and project are immutable';
  END IF;
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_projects p WHERE p.id = NEW.project_id AND p.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'project_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  -- Le trigger BEFORE passe AVANT la contrainte CHECK : sans le filtre regex,
  -- une valeur invalide levait `22P02` au cast au lieu de `23514`.
  IF NEW.action_kind IN ('add_assignee', 'notify_member')
     AND NEW.action_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.org_id = NEW.org_id AND m.user_id = NEW.action_value::uuid
     ) THEN
    RAISE EXCEPTION 'assignee_not_in_org' USING ERRCODE = 'P0001';
  END IF;
  NEW.name := btrim(NEW.name);
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    IF (SELECT count(*) FROM public.team_automations a WHERE a.org_id = NEW.org_id) >= 50 THEN
      RAISE EXCEPTION 'automations_limit' USING ERRCODE = '54000';
    END IF;
  END IF;
  RETURN NEW;
END;
$_$;


--
-- Name: team_okr_trash_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_okr_trash_guard() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
          OR (NEW.deleted_by IS NOT NULL AND NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)) THEN
    RAISE EXCEPTION 'team_okr_trash_direct_write' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: team_project_dependency_before_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_project_dependency_before_insert() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_org        uuid;
  v_depends_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = NEW.project_id;
  SELECT org_id INTO v_depends_org FROM public.team_projects WHERE id = NEW.depends_on_id;
  -- Identifiants de la mig. 137, pas des phrases : le client les traduit
  -- (`dependencyErrorCode`), et la démo lève les mêmes.
  IF v_org IS NULL OR v_depends_org IS NULL THEN
    RAISE EXCEPTION 'dependency_task_missing';
  END IF;
  IF v_org IS DISTINCT FROM v_depends_org THEN
    RAISE EXCEPTION 'dependency_cross_account';
  END IF;
  IF public.team_project_dependency_would_cycle(NEW.project_id, NEW.depends_on_id) THEN
    RAISE EXCEPTION 'dependency_cycle';
  END IF;
  NEW.org_id := v_org;
  RETURN NEW;
END;
$$;


--
-- Name: team_project_dependency_would_cycle(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project AND public.is_org_member(p.org_id)
  )
  AND EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT p_depends_on, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.team_project_dependencies d
        JOIN upstream u ON d.project_id = u.id
       WHERE u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = p_project
  );
$$;


--
-- Name: team_project_health_stamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_project_health_stamp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.health IS NOT NULL THEN
      NEW.health_updated_at := now();
      NEW.health_updated_by := (SELECT auth.uid());
    ELSE
      NEW.health_updated_at := NULL;
      NEW.health_updated_by := NULL;
    END IF;
  ELSIF NEW.health IS DISTINCT FROM OLD.health
     OR NEW.health_note IS DISTINCT FROM OLD.health_note THEN
    NEW.health_updated_at := now();
    NEW.health_updated_by := (SELECT auth.uid());
  ELSE
    -- Personne ne réécrit l'horodatage sans changer la santé. Le passage à
    -- NULL de `health_updated_by` par la cascade RGPD reste permis.
    NEW.health_updated_at := OLD.health_updated_at;
    IF NEW.health_updated_by IS NOT NULL THEN
      NEW.health_updated_by := OLD.health_updated_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: team_project_member_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_project_member_before_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'team_project_members: a membership cannot move';
  END IF;
  SELECT org_id INTO v_org FROM public.team_projects WHERE id = NEW.project_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'team_project_members: project not found';
  END IF;
  IF TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = v_org AND m.user_id = NEW.user_id AND m.suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'team_project_members: the member must belong to the organization';
  END IF;
  NEW.org_id := v_org;
  IF TG_OP = 'INSERT' THEN
    NEW.added_by := (SELECT auth.uid());
    NEW.added_at := now();
  ELSE
    NEW.added_by := OLD.added_by;
    NEW.added_at := OLD.added_at;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: team_project_status_before_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_project_status_before_write() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'team_project_statuses: project is immutable';
  END IF;
  -- L'organisation se DÉDUIT du projet : jamais celle qu'envoie le client.
  SELECT p.org_id INTO NEW.org_id FROM public.team_projects p WHERE p.id = NEW.project_id;
  NEW.name := btrim(NEW.name);
  IF TG_OP = 'INSERT' AND (
    SELECT count(*) FROM public.team_project_statuses s WHERE s.project_id = NEW.project_id
  ) >= 12 THEN
    RAISE EXCEPTION 'project_statuses_limit' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: team_task_before_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_task_before_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  -- org_id immuable. created_by immuable SAUF passage à NULL (cascade
  -- ON DELETE SET NULL lors d'une suppression de compte RGPD) — on interdit
  -- seulement la réaffectation vers un AUTRE utilisateur.
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'org_id is immutable';
  END IF;
  IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable';
  END IF;
  -- Corbeille (mig. 152) : seules `trash_team_task` / `restore_team_task`
  -- (DEFINER, donc `current_user` = propriétaire) touchent ces colonnes.
  -- `deleted_by` passant à NULL par la cascade RGPD reste permis.
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
          OR (NEW.deleted_by IS NOT NULL AND NEW.deleted_by IS DISTINCT FROM OLD.deleted_by)) THEN
    RAISE EXCEPTION 'team_task_trash_direct_write' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: team_task_validation_gate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_task_validation_gate() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.validator_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.validator_id IS DISTINCT FROM OLD.validator_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.org_id = NEW.org_id AND m.user_id = NEW.validator_id
          AND m.suspended_at IS NULL
          AND (m.access_expires_at IS NULL OR m.access_expires_at > now())
     ) THEN
    RAISE EXCEPTION 'validator_not_member' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.validator_id IS DISTINCT FROM OLD.validator_id
     AND v_uid IS DISTINCT FROM OLD.created_by
     AND v_uid IS DISTINCT FROM OLD.validator_id
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.org_id = OLD.org_id AND m.user_id = v_uid AND m.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'validator_change_forbidden' USING ERRCODE = '42501';
  END IF;

  -- La porte : terminée par un autre que le validateur → à valider.
  IF NEW.validator_id IS NOT NULL
     AND NEW.completed AND NOT OLD.completed
     AND v_uid <> NEW.validator_id THEN
    NEW.completed := false;
    NEW.completed_at := NULL;
    NEW.status := 'review';
    NEW.custom_status_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: team_task_webhook_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.team_task_webhook_events() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_team_task_webhook(NEW.id, 'task.created');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.enqueue_team_task_webhook(NEW.id, 'task.status_changed');
    IF NEW.status = 'done' THEN
      PERFORM public.enqueue_team_task_webhook(NEW.id, 'task.completed');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: habits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    frequency text DEFAULT 'daily'::text NOT NULL,
    estimated_time integer DEFAULT 0 NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    icon text DEFAULT '⭐'::text NOT NULL,
    completions jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    scheduled_days smallint[],
    schedule_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT habits_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT habits_schedule_history_check CHECK (public.habit_schedule_history_valid(schedule_history)),
    CONSTRAINT habits_scheduled_days_check CHECK (((scheduled_days IS NULL) OR (((cardinality(scheduled_days) >= 1) AND (cardinality(scheduled_days) <= 7)) AND (scheduled_days <@ ARRAY[(0)::smallint, (1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint]) AND (array_position(scheduled_days, NULL::smallint) IS NULL))))
);


--
-- Name: COLUMN habits.scheduled_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.habits.scheduled_days IS 'Jours prevus en vigueur, 0 = dimanche (EXTRACT(DOW)). NULL = tous les jours (mig. 251).';


--
-- Name: COLUMN habits.schedule_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.habits.schedule_history IS 'Changements dates des jours prevus [{from, days}] : un jour se juge avec le reglage en vigueur ce jour-la, le passe n est jamais rejuge (mig. 251).';


--
-- Name: toggle_habit_completion(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_habit_completion(p_habit_id uuid, p_date text) RETURNS public.habits
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_row public.habits;
  v_current BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate date format (YYYY-MM-DD) to avoid jsonb_set key abuse
  IF p_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Atomic flip via jsonb_set. The READ + WRITE happen in a single
  -- statement under row-level locking on tasks.id, so a concurrent
  -- toggle on another tab will serialize behind it.
  UPDATE public.habits
  SET completions = jsonb_set(
    COALESCE(completions, '{}'::jsonb),
    ARRAY[p_date],
    to_jsonb(NOT COALESCE((completions->>p_date)::boolean, false)),
    true
  )
  WHERE id = p_habit_id
    AND user_id = auth.uid()  -- defense-in-depth (RLS already filters)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  RETURN v_row;
END;
$_$;


--
-- Name: toggle_habit_completion_v2(uuid, text, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer DEFAULT 400, p_today date DEFAULT NULL::date) RETURNS TABLE(id uuid, name text, description text, frequency text, estimated_time integer, color text, icon text, completions jsonb, user_id uuid, created_at timestamp with time zone, streak_current integer, streak_best integer, completions_total integer, first_completion_date date, window_days integer, scheduled_days smallint[], schedule_history jsonb)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_uid     UUID := (SELECT auth.uid());
  v_id      UUID;
  v_day     DATE;
  v_on      BOOLEAN;
  v_planned BOOLEAN;
  v_win     INTEGER := GREATEST(1, LEAST(COALESCE(p_days, 400), 3650));
  v_today   DATE := GREATEST(CURRENT_DATE - 1,
                             LEAST(COALESCE(p_today, CURRENT_DATE), CURRENT_DATE + 1));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Forme ET calendrier : `2026-02-30` est refusé ici (mig. 248).
  v_day := public.habit_day_from_key(p_date);
  IF v_day IS NULL THEN
    RAISE EXCEPTION 'Invalid date format (expected YYYY-MM-DD)';
  END IF;

  -- Verrou de la ligne d'habitude : deux bascules concurrentes du même jour
  -- se sérialisent (correctif TOCTOU-1, mig. 023). Ne JAMAIS décider sans.
  SELECT h.id,
         (h.scheduled_days IS NOT NULL OR jsonb_array_length(h.schedule_history) > 0)
    INTO v_id, v_planned
    FROM public.habits h
   WHERE h.id = p_habit_id
     AND h.user_id = v_uid   -- défense en profondeur (la RLS filtre déjà)
   FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;

  -- Un jour non prévu n'est PAS refusé : décocher une coche ancienne doit
  -- rester possible, et la coche y est neutre pour la série.
  DELETE FROM public.habit_completions c
   WHERE c.habit_id = v_id AND c.user_id = v_uid AND c.day = v_day;
  v_on := NOT FOUND;
  IF v_on THEN
    INSERT INTO public.habit_completions (habit_id, user_id, day)
    VALUES (v_id, v_uid, v_day);
  END IF;

  -- Miroir de transition (mig. 248) : la colonne reste exacte pour ses
  -- lecteurs (CLI, export, onglets anciens). Le trigger n'y trouve rien à refaire.
  UPDATE public.habits h
     SET completions = jsonb_set(COALESCE(h.completions, '{}'::jsonb),
                                 ARRAY[p_date], to_jsonb(v_on), true)
   WHERE h.id = v_id;

  RETURN QUERY
  WITH days AS (
    SELECT c.day AS d
    FROM public.habit_completions c
    WHERE c.habit_id = v_id
      AND c.user_id = v_uid
      AND c.day <= v_today
  ),
  totals AS (
    SELECT COUNT(*)::int AS total, MIN(d) AS first_day FROM days
  ),
  -- ── Sans jours prévus : calcul de la 248, à la lettre ──
  grouped AS (
    SELECT d, d - (row_number() OVER (ORDER BY d))::int AS island
    FROM days WHERE NOT v_planned
  ),
  runs AS (
    SELECT island, COUNT(*)::int AS len, MAX(d) AS last_day
    FROM grouped GROUP BY island
  ),
  agg_plain AS (
    SELECT MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (WHERE r.last_day >= (v_today - 1)), 0) AS current
    FROM runs r
  ),
  -- ── Avec jours prévus : même méthode que get_my_habits ──
  sched AS (
    SELECT g.d::date AS d,
           (dy.d IS NOT NULL) AS is_done,
           row_number() OVER (ORDER BY g.d) AS rn
    FROM public.habits h
    CROSS JOIN totals t
    CROSS JOIN LATERAL generate_series(
      GREATEST(t.first_day, v_today - 3650), v_today, interval '1 day'
    ) AS g(d)
    LEFT JOIN days dy ON dy.d = g.d::date
    WHERE v_planned
      AND h.id = v_id
      AND t.first_day IS NOT NULL
      AND public.habit_day_scheduled(h.scheduled_days, h.schedule_history, g.d::date)
  ),
  last_sched AS (
    SELECT rn AS last_rn, d AS last_d, is_done AS last_done
    FROM sched ORDER BY rn DESC LIMIT 1
  ),
  islands AS (
    SELECT rn, rn - row_number() OVER (ORDER BY rn) AS island
    FROM sched WHERE is_done
  ),
  sruns AS (
    SELECT island, COUNT(*)::int AS len, MAX(rn) AS end_rn
    FROM islands GROUP BY island
  ),
  agg_planned AS (
    SELECT MAX(r.len) AS best,
           COALESCE(MAX(r.len) FILTER (
             WHERE r.end_rn >= ls.last_rn
                   - CASE WHEN ls.last_d = v_today AND NOT ls.last_done THEN 1 ELSE 0 END
           ), 0) AS current
    FROM sruns r CROSS JOIN last_sched ls
  ),
  agg AS (
    SELECT best, current FROM agg_plain WHERE NOT v_planned
    UNION ALL
    SELECT best, current FROM agg_planned WHERE v_planned
  )
  SELECT
    h.id, h.name, h.description, h.frequency, h.estimated_time, h.color, h.icon,
    COALESCE(
      (SELECT jsonb_object_agg(to_char(c.day, 'YYYY-MM-DD'), true)
         FROM public.habit_completions c
        WHERE c.habit_id = v_id
          AND c.user_id = v_uid
          AND c.day >= v_today - v_win),
      '{}'::jsonb
    ),
    h.user_id, h.created_at,
    COALESCE((SELECT a.current FROM agg a), 0)::int,
    COALESCE((SELECT a.best    FROM agg a), 0)::int,
    COALESCE((SELECT t.total   FROM totals t), 0)::int,
    (SELECT t.first_day FROM totals t),
    v_win,
    h.scheduled_days,
    h.schedule_history
  FROM public.habits h
  WHERE h.id = v_id;
END;
$$;


--
-- Name: FUNCTION toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date) IS 'Bascule d un jour dans habit_completions, sous verrou de la ligne d habitude, recopiee dans habits.completions le temps de la transition (mig. 248). Series sur les seuls jours PREVUS (mig. 251). `p_today` : date LOCALE du client (mig. 122).';


--
-- Name: toggle_task_bookmark(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_task_bookmark(p_task_id uuid) RETURNS public.tasks
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tasks
  SET bookmarked = NOT COALESCE(bookmarked, false)
  WHERE id = p_task_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  RETURN v_row;
END;
$$;


--
-- Name: toggle_task_complete(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_task_complete(p_task_id uuid) RETURNS public.tasks
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tasks
  SET
    completed = NOT COALESCE(completed, false),
    completed_at = CASE
      WHEN NOT COALESCE(completed, false) THEN NOW()
      ELSE NULL
    END
  WHERE id = p_task_id
    AND user_id = auth.uid()
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  RETURN v_row;
END;
$$;


--
-- Name: toggle_task_complete_v2(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_row   public.tasks;
  v_child public.tasks;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 215 : plus de filtre `user_id = auth.uid()` ; la RLS UPDATE décide
  -- (propriétaire, ou ami « editor » ayant accepté).
  UPDATE public.tasks
  SET
    completed = NOT COALESCE(completed, false),
    completed_at = CASE
      WHEN NOT COALESCE(completed, false) THEN NOW()
      ELSE NULL
    END
  WHERE id = p_task_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_row.completed
     AND COALESCE(v_row.recurrence, 'none') <> 'none'
     AND p_next_deadline IS NOT NULL
     AND v_row.user_id = auth.uid()  -- 215 : l'occurrence suivante reste au propriétaire
  THEN
    INSERT INTO public.tasks (
      user_id, name, description, priority, category, deadline,
      estimated_time, bookmarked, completed, subtasks, kr_id, recurrence,
      recurrence_parent_id
    )
    VALUES (
      v_row.user_id,
      v_row.name,
      v_row.description,
      v_row.priority,
      v_row.category,
      p_next_deadline,
      v_row.estimated_time,
      v_row.bookmarked,
      false,
      COALESCE((
        SELECT jsonb_agg(jsonb_set(elem, '{completed}', 'false'::jsonb))
        FROM jsonb_array_elements(COALESCE(v_row.subtasks, '[]'::jsonb)) AS elem
      ), '[]'::jsonb),
      v_row.kr_id,
      v_row.recurrence,
      v_row.id
    )
    ON CONFLICT (recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL
    DO NOTHING
    RETURNING * INTO v_child;

  ELSIF NOT v_row.completed THEN
    DELETE FROM public.tasks c
    WHERE c.recurrence_parent_id = v_row.id
      AND c.user_id = auth.uid()
      AND c.completed = false
      AND c.updated_at <= c.created_at + interval '1 second';

    UPDATE public.tasks c
    SET recurrence_parent_id = NULL
    WHERE c.recurrence_parent_id = v_row.id
      AND c.user_id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'task',    to_jsonb(v_row),
    'spawned', CASE WHEN v_child.id IS NULL THEN NULL ELSE to_jsonb(v_child) END
  );
END;
$$;


--
-- Name: FUNCTION toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone) IS 'Bascule la complétion ET génère/retire l''occurrence récurrente suivante dans la MÊME transaction. Idempotent via ux_tasks_recurrence_parent. p_next_deadline est l''INSTANT de minuit calculé par le client dans SON fuseau (src/lib/deadline.ts). Le serveur ne juge jamais quel jour on est.';


--
-- Name: touch_last_seen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_last_seen() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  UPDATE public.profiles SET last_seen_at = NOW() WHERE id = auth.uid();

  INSERT INTO public.user_activity_days (user_id, day)
  SELECT auth.uid(), CURRENT_DATE
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id, day) DO NOTHING;

  -- Rétention 400 j, bornée à l'appelant (Index Scan sur le pkey).
  DELETE FROM public.user_activity_days
  WHERE user_id = auth.uid()
    AND day < CURRENT_DATE - 400;
$$;


--
-- Name: FUNCTION touch_last_seen(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.touch_last_seen() IS 'Marque l activite du jour (profiles.last_seen_at + user_activity_days) et purge les jours de plus de 400 j POUR L APPELANT (RGPD art. 5.1.e, mig. 114). 400 j = le plus petit seuil preservant une comparaison annee sur annee dans get_admin_stats. N ecrit que la ligne de auth.uid() et le jour serveur : ne JAMAIS y ajouter de parametre client.';


--
-- Name: track_hit(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_hit(p jsonb) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
DECLARE
  v_kind    text := p->>'kind';
  v_path    text := split_part(split_part(coalesce(p->>'path', ''), '?', 1), '#', 1);
  v_ip      text := left(coalesce(p->>'ip', ''), 64);
  v_ua      text := left(coalesce(p->>'ua', ''), 512);
  v_salt    text;
  v_visitor text;
  v_today   date := (now() AT TIME ZONE 'UTC')::date;
  -- Plafonds (voir l'en-tête de la mig. 223).
  c_visitor CONSTANT int := 60;     -- par visiteur et par minute
  c_minute  CONSTANT int := 300;    -- au total, par minute
  c_day     CONSTANT int := 5000;   -- au total, sur 24 heures glissantes
BEGIN
  IF v_kind IS NULL OR v_kind NOT IN ('view', 'leave', 'cta') THEN RETURN false; END IF;
  IF v_path !~ '^/' THEN RETURN false; END IF;
  v_path := left(v_path, 300);

  SELECT salt INTO v_salt FROM public.traffic_salts WHERE day = v_today;
  IF v_salt IS NULL THEN
    INSERT INTO public.traffic_salts(day, salt)
    VALUES (v_today, encode(extensions.gen_random_bytes(32), 'hex'))
    ON CONFLICT (day) DO NOTHING;
    SELECT salt INTO v_salt FROM public.traffic_salts WHERE day = v_today;
  END IF;
  v_visitor := encode(extensions.digest(v_salt || '|' || v_ip || '|' || v_ua, 'sha256'), 'hex');

  -- Plafonds anti-abus, du plus étroit au plus large. Comptages bornés.
  IF (SELECT count(*) FROM (SELECT 1 FROM public.traffic_hits
        WHERE visitor = v_visitor AND occurred_at > now() - interval '1 minute'
        LIMIT c_visitor) s) >= c_visitor THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.traffic_hits
        WHERE occurred_at > now() - interval '1 minute'
        LIMIT c_minute) s) >= c_minute THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM public.traffic_hits
        WHERE occurred_at > now() - interval '24 hours'
        LIMIT c_day) s) >= c_day THEN
    RETURN false;
  END IF;

  INSERT INTO public.traffic_hits(
    kind, visitor, path, referrer_host, utm_source, utm_medium, utm_campaign,
    country, region, city, browser, os, device, lang, duration_ms, scroll_pct, cta
  ) VALUES (
    v_kind, v_visitor, v_path,
    nullif(left(lower(p->>'referrer_host'), 255), ''),
    nullif(left(lower(p->>'utm_source'), 100), ''),
    nullif(left(lower(p->>'utm_medium'), 100), ''),
    nullif(left(lower(p->>'utm_campaign'), 100), ''),
    CASE WHEN upper(p->>'country') ~ '^[A-Z]{2}$' THEN upper(p->>'country') END,
    nullif(left(p->>'region', 100), ''),
    nullif(left(p->>'city', 100), ''),
    nullif(left(p->>'browser', 40), ''),
    nullif(left(p->>'os', 40), ''),
    CASE WHEN p->>'device' IN ('mobile', 'tablet', 'desktop') THEN p->>'device' END,
    nullif(left(p->>'lang', 20), ''),
    CASE WHEN v_kind = 'leave' AND (p->>'duration_ms') ~ '^\d{1,8}$'
         THEN LEAST((p->>'duration_ms')::int, 86400000) END,
    CASE WHEN v_kind = 'leave' AND (p->>'scroll_pct') ~ '^\d{1,3}$'
         THEN LEAST((p->>'scroll_pct')::int, 100)::smallint END,
    CASE WHEN v_kind = 'cta' THEN nullif(left(p->>'cta', 80), '') END
  );
  RETURN true;
END;
$_$;


--
-- Name: FUNCTION track_hit(p jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_hit(p jsonb) IS 'Mesure d''audience maison (mig. 222, verrouillée par la 223, finding TR-1). Appelée par le seul collecteur api/collect.ts, avec la clé secrète : EXECUTE réservé à service_role. Plafonds : 60 par visiteur et par minute, 300 par minute, 5 000 sur 24 heures.';


--
-- Name: transfer_org_ownership(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_org_ownership(p_org uuid, p_new_owner uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.organizations
  WHERE id = p_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Seul l'owner ACTUEL transfère (pas un simple admin).
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the owner can transfer ownership';
  END IF;

  IF p_new_owner IS NULL OR p_new_owner = auth.uid() THEN
    RAISE EXCEPTION 'Invalid new owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_new_owner
  ) THEN
    RAISE EXCEPTION 'New owner must be a member of the organization';
  END IF;

  PERFORM set_config('cosmo.allow_owner_transfer', 'on', true); -- local à la tx

  UPDATE public.organizations SET owner_id = p_new_owner WHERE id = p_org;

  -- Le nouvel owner devient admin (idempotent) ; l'ancien owner RESTE
  -- admin — il peut ensuite se rétrograder/partir via les flux existants
  -- (la garde « dernier admin » de leave_organization continue de protéger).
  UPDATE public.organization_members
  SET role = 'admin'
  WHERE org_id = p_org AND user_id = p_new_owner;
END;
$$;


--
-- Name: trash_team_okr(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trash_team_okr(p_okr uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT o.org_id INTO v_org
    FROM public.team_okrs o
   WHERE o.id = p_okr AND o.deleted_at IS NULL
   FOR UPDATE;
  -- Même réponse pour « n'existe pas » et « ne vous est pas visible ».
  IF v_org IS NULL OR NOT public.can_access_team_okr(p_okr) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.my_org_perm(v_org, 'okr.delete') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_okrs SET deleted_at = now(), deleted_by = v_uid WHERE id = p_okr;
END;
$$;


--
-- Name: trash_team_task(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trash_team_task(p_task uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_task record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT t.id, t.org_id, t.project_id, t.created_by
    INTO v_task
    FROM public.team_tasks t
   WHERE t.id = p_task AND t.deleted_at IS NULL
   FOR UPDATE;
  -- Même réponse pour « n'existe pas » et « ne vous est pas visible » :
  -- une fonction DEFINER ne doit pas servir d'oracle d'existence.
  IF NOT FOUND OR NOT public.can_access_team_project(v_task.project_id) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.my_org_perm(v_task.org_id, 'task.deleteAny') OR v_task.created_by = v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.team_tasks
     SET deleted_at = NOW(), deleted_by = v_uid
   WHERE id = p_task;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: validate_org_manager(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_org_manager() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Le manager doit être membre de la même organisation.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.manager_id
  ) THEN
    RAISE EXCEPTION 'Manager must be a member of the organization';
  END IF;

  -- Anti-cycle : le nouveau manager ne peut pas être un descendant du membre.
  IF NEW.manager_id IN (SELECT public.get_subtree(NEW.org_id, NEW.user_id)) THEN
    RAISE EXCEPTION 'Hierarchy cycle detected';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_project_team(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_project_team() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = NEW.team_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Team must belong to the same organization';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_task_dependency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_task_dependency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_task_owner    UUID;
  v_depends_owner UUID;
BEGIN
  SELECT user_id INTO v_task_owner
    FROM public.tasks WHERE id = NEW.task_id;
  SELECT user_id INTO v_depends_owner
    FROM public.tasks WHERE id = NEW.depends_on_id;

  IF v_task_owner IS NULL OR v_depends_owner IS NULL THEN
    RAISE EXCEPTION 'dependency_task_missing';
  END IF;

  IF v_task_owner IS DISTINCT FROM v_depends_owner THEN
    RAISE EXCEPTION 'dependency_cross_account';
  END IF;

  -- `user_id` n'est jamais pris depuis l'input : il est redérivé de la tâche.
  -- La policy WITH CHECK, évaluée APRÈS ce trigger, vérifie ensuite qu'il
  -- s'agit bien de l'appelant.
  NEW.user_id := v_task_owner;
  RETURN NEW;
END;
$$;


--
-- Name: validate_team_kr(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_kr() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE org_id = NEW.org_id AND user_id = NEW.assignee_id
     ) THEN
    RAISE EXCEPTION 'Assignee must be a member of the organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_okrs
    WHERE id = NEW.okr_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Key result must belong to an OKR of the same organization';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_team_kr_contributors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_kr_contributors() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.contributor_ids := ARRAY(SELECT DISTINCT u FROM unnest(COALESCE(NEW.contributor_ids, ARRAY[]::uuid[])) u);
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.contributor_ids) u
     WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m
                        WHERE m.org_id = NEW.org_id AND m.user_id = u)
  ) THEN
    RAISE EXCEPTION 'contributor_not_in_org';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_team_kr_project(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_kr_project() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_key_results WHERE id = NEW.kr_id;
  IF v_org IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.team_projects WHERE id = NEW.project_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'kr_project_not_in_org';
  END IF;
  NEW.org_id := v_org;
  RETURN NEW;
END;
$$;


--
-- Name: validate_team_membership(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_membership() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = NEW.team_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Team does not belong to this organization';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = NEW.org_id AND m.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User must be a member of the organization';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_team_okr_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_okr_parent() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.parent_okr_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_okrs WHERE id = NEW.parent_okr_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'okr_parent_not_in_org';
  END IF;
  IF EXISTS (
    WITH RECURSIVE up(id, depth) AS (
      SELECT NEW.parent_okr_id, 0
      UNION ALL
      SELECT o.parent_okr_id, u.depth + 1
        FROM public.team_okrs o JOIN up u ON o.id = u.id
       WHERE o.parent_okr_id IS NOT NULL AND u.depth < 20
    )
    SELECT 1 FROM up WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'okr_parent_cycle';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_team_okr_team(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_okr_team() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_okrs o
    WHERE o.id = NEW.okr_id AND o.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'OKR must belong to this organization';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = NEW.team_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Team must belong to this organization';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: validate_team_task(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_task() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF array_length(NEW.assignee_ids, 1) > 20 THEN
    RAISE EXCEPTION 'A task cannot have more than 20 assignees';
  END IF;

  -- Chaque assigné doit appartenir à l'organisation.
  IF NEW.assignee_ids <> '{}' AND EXISTS (
    SELECT 1 FROM unnest(NEW.assignee_ids) AS a(uid)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = NEW.org_id AND m.user_id = a.uid
    )
  ) THEN
    RAISE EXCEPTION 'Every assignee must be a member of the organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_projects
    WHERE id = NEW.project_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Project must belong to the same organization';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: validate_team_task_dependency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_team_task_dependency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  v_task_project    UUID;
  v_task_org        UUID;
  v_depends_project UUID;
BEGIN
  SELECT project_id, org_id INTO v_task_project, v_task_org
    FROM public.team_tasks WHERE id = NEW.task_id;
  SELECT project_id INTO v_depends_project
    FROM public.team_tasks WHERE id = NEW.depends_on_id;

  IF v_task_project IS NULL OR v_depends_project IS NULL THEN
    RAISE EXCEPTION 'dependency_task_missing';
  END IF;

  IF v_task_project IS DISTINCT FROM v_depends_project THEN
    RAISE EXCEPTION 'dependency_cross_project';
  END IF;

  -- `org_id` n'est jamais pris depuis l'input : il est redérivé de la tâche.
  NEW.org_id := v_task_org;
  RETURN NEW;
END;
$$;


--
-- Name: verify_payment_chain(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_payment_chain() RETURNS TABLE(broken_id bigint, expected_hash text, stored_hash text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  r      RECORD;
  v_prev TEXT := NULL;
  v_calc TEXT;
BEGIN
  FOR r IN SELECT * FROM public.payment_records ORDER BY id ASC LOOP
    v_calc := encode(
      extensions.digest(
        coalesce(v_prev, '')                  || '|' ||
        r.stripe_event_id                     || '|' ||
        r.event_type                          || '|' ||
        coalesce(r.stripe_invoice_id, '')     || '|' ||
        coalesce(r.stripe_customer_id, '')    || '|' ||
        coalesce(r.org_id::text, '')          || '|' ||
        coalesce(r.user_id::text, '')         || '|' ||
        r.amount_cents::text                  || '|' ||
        r.currency                            || '|' ||
        to_char(r.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
        'sha256'
      ), 'hex');

    IF v_calc IS DISTINCT FROM r.row_hash THEN
      broken_id := r.id; expected_hash := v_calc; stored_hash := r.row_hash;
      RETURN NEXT;
      RETURN; -- la première rupture suffit : tout ce qui suit en dépend
    END IF;

    v_prev := r.row_hash;
  END LOOP;
END;
$$;


--
-- Name: write_org_audit(uuid, text, text, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.write_org_audit(p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_target_user uuid, p_meta jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  INSERT INTO public.org_audit_log (org_id, actor_id, action, target_type, target_id, target_user_id, meta)
  SELECT p_org, auth.uid(), p_action, p_target_type, p_target_id, p_target_user, p_meta
   WHERE EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org);
$$;


--
-- Name: account_inactivity_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_inactivity_notices (
    user_id uuid NOT NULL,
    warned_at timestamp with time zone DEFAULT now() NOT NULL,
    activity_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE account_inactivity_notices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.account_inactivity_notices IS 'C-121 : avertissement de suppression pour inactivite (3 ans), un par compte. Ecrit APRES l envoi. Aucun e-mail stocke.';


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    user_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: affiliate_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_clicks (
    id bigint NOT NULL,
    slug text NOT NULL,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: affiliate_clicks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.affiliate_clicks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: affiliate_clicks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.affiliate_clicks_id_seq OWNED BY public.affiliate_clicks.id;


--
-- Name: affiliate_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_commissions (
    id bigint NOT NULL,
    payment_record_id bigint NOT NULL,
    affiliate_id uuid NOT NULL,
    customer_id uuid,
    org_id uuid,
    gross_cents bigint NOT NULL,
    vat_cents bigint NOT NULL,
    fee_cents bigint NOT NULL,
    base_cents bigint NOT NULL,
    rate_bp integer NOT NULL,
    commission_cents bigint NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deduction_bp integer DEFAULT 0 NOT NULL,
    deduction_cents bigint DEFAULT 0 NOT NULL
);


--
-- Name: affiliate_commissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.affiliate_commissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: affiliate_commissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.affiliate_commissions_id_seq OWNED BY public.affiliate_commissions.id;


--
-- Name: affiliate_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_contacts (
    user_id uuid NOT NULL,
    name text,
    email text,
    phone text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: affiliate_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_links (
    slug text NOT NULL,
    affiliate_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affiliate_links_slug_check CHECK ((slug ~ '^[a-z0-9-]{2,40}$'::text))
);


--
-- Name: affiliate_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    affiliate_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    paid_on date NOT NULL,
    method text,
    note text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT affiliate_payouts_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT affiliate_payouts_created_by_check CHECK ((created_by = ANY (ARRAY['admin'::text, 'code'::text])))
);


--
-- Name: affiliate_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_settings (
    id boolean DEFAULT true NOT NULL,
    commission_bp integer DEFAULT 5000 NOT NULL,
    fee_bp integer DEFAULT 150 NOT NULL,
    fee_fixed_cents integer DEFAULT 25 NOT NULL,
    vat_bp integer DEFAULT 0 NOT NULL,
    code_hash text,
    token_secret text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    code_changed_at timestamp with time zone,
    deduction_bp integer DEFAULT 2560 NOT NULL,
    CONSTRAINT affiliate_settings_commission_bp_check CHECK (((commission_bp >= 0) AND (commission_bp <= 10000))),
    CONSTRAINT affiliate_settings_deduction_bp_check CHECK (((deduction_bp >= 0) AND (deduction_bp <= 10000))),
    CONSTRAINT affiliate_settings_fee_bp_check CHECK (((fee_bp >= 0) AND (fee_bp <= 10000))),
    CONSTRAINT affiliate_settings_fee_fixed_cents_check CHECK ((fee_fixed_cents >= 0)),
    CONSTRAINT affiliate_settings_id_check CHECK (id),
    CONSTRAINT affiliate_settings_vat_bp_check CHECK (((vat_bp >= 0) AND (vat_bp <= 10000)))
);


--
-- Name: affiliates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: billing_acceptances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_acceptances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    user_id uuid NOT NULL,
    cgv_version text NOT NULL,
    immediate_access_at timestamp with time zone NOT NULL,
    tier_key text,
    billing_interval text,
    stripe_checkout_session text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: billing_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6B7280'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    "position" integer DEFAULT 0 NOT NULL
);


--
-- Name: COLUMN categories.parent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.categories.parent_id IS 'Catégorie parente. NULL = racine. NO ACTION : supprimer un parent en laissant ses enfants est refusé en fin de requête, mais une branche entière peut partir dans un seul DELETE (suppression de compte).';


--
-- Name: cron_leases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_leases (
    job text NOT NULL,
    token uuid NOT NULL,
    locked_until timestamp with time zone NOT NULL,
    acquired_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cron_leases_job_check CHECK ((job ~ '^[a-z][a-z0-9:-]{1,62}$'::text))
);


--
-- Name: TABLE cron_leases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cron_leases IS 'ARC-06 : un bail par job planifie, pris par l Edge Function. Deux executions simultanees ne travaillent jamais ensemble.';


--
-- Name: cron_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_runs (
    id bigint NOT NULL,
    job text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'started'::text NOT NULL,
    http_code integer,
    request_id bigint,
    detail text,
    CONSTRAINT cron_runs_detail_check CHECK ((char_length(detail) <= 300)),
    CONSTRAINT cron_runs_job_check CHECK ((job ~ '^[a-z][a-z0-9-]{1,62}$'::text)),
    CONSTRAINT cron_runs_status_check CHECK ((status = ANY (ARRAY['started'::text, 'ok'::text, 'error'::text, 'timeout'::text, 'lost'::text, 'config_missing'::text])))
);


--
-- Name: TABLE cron_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cron_runs IS 'ARC-06 : une ligne par execution planifiee (pg_cron -> pg_net -> Edge Function). Aucun secret, aucun corps de reponse. Purge a 90 jours.';


--
-- Name: cron_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cron_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cron_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: demo_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demo_devices (
    device_id uuid NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    converted_at timestamp with time zone,
    converted_user_id uuid
);


--
-- Name: demo_conversion_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.demo_conversion_stats WITH (security_invoker='on') AS
 SELECT (count(*))::integer AS demo_users,
    (count(converted_at))::integer AS converted_users,
    round(((100.0 * (count(converted_at))::numeric) / (NULLIF(count(*), 0))::numeric), 1) AS conversion_pct
   FROM public.demo_devices;


--
-- Name: email_lookup_global; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_lookup_global (
    window_start timestamp with time zone NOT NULL,
    lookups_in_window integer DEFAULT 0 NOT NULL
);


--
-- Name: email_lookup_quota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_lookup_quota (
    user_id uuid NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    lookups_in_window integer DEFAULT 0 NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    color text,
    description text,
    notes text,
    task_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    recurrence text DEFAULT 'none'::text NOT NULL,
    exceptions text[] DEFAULT '{}'::text[] NOT NULL,
    recurrence_days integer[] DEFAULT '{}'::integer[] NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    is_private boolean DEFAULT false NOT NULL,
    review_dismissed_at timestamp with time zone,
    CONSTRAINT end_after_start CHECK ((end_time >= start_time)),
    CONSTRAINT events_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'custom'::text])))
);


--
-- Name: COLUMN events.review_dismissed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.events.review_dismissed_at IS 'Instant où la personne a demandé de ne plus être relancée sur ce créneau de tâche terminé (bouton « Ignorer »). NULL = jamais ignoré. Remis à NULL par un report. Purement informatif : aucune policy et aucun quota n''en dépendent.';


--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    sender_id uuid NOT NULL,
    receiver_id uuid,
    sender_email text,
    CONSTRAINT friend_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);

ALTER TABLE ONLY public.friend_requests REPLICA IDENTITY FULL;


--
-- Name: COLUMN friend_requests.sender_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.friend_requests.sender_id IS 'Expéditeur de la demande (mig. 250) : toujours auth.uid() à l''insertion (policy « Senders can create requests »), NOT NULL. La table n''a plus de user_id.';


--
-- Name: habit_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.habit_completions (
    habit_id uuid NOT NULL,
    user_id uuid NOT NULL,
    day date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE habit_completions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.habit_completions IS 'DAT-02 : un jour coche par ligne (date LOCALE du client, fuseaux geles C-03). Absence = non coche. Lue par get_my_habits, toggle_habit_completion_v2 et get_work_time_stats (mig. 248). habits.completions en est le miroir le temps de la transition.';


--
-- Name: key_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    okr_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    current_value numeric DEFAULT 0 NOT NULL,
    target_value numeric DEFAULT 1 NOT NULL,
    estimated_time integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    weight integer DEFAULT 1 NOT NULL,
    CONSTRAINT key_results_weight_range CHECK (((weight >= 1) AND (weight <= 10)))
);


--
-- Name: kr_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kr_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kr_id uuid NOT NULL,
    okr_id uuid NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    kr_title text DEFAULT ''::text NOT NULL,
    okr_title text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: okrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.okrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    category uuid,
    progress integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    key_results jsonb DEFAULT '[]'::jsonb NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT okrs_progress_check CHECK (((progress >= 0) AND (progress <= 100)))
);


--
-- Name: COLUMN okrs.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.okrs.category IS 'Catégorie de l''objectif. NULL = aucune. FK vers categories(id), ON DELETE SET NULL.';


--
-- Name: org_activity_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_activity_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    scope text NOT NULL,
    team_id uuid,
    day date NOT NULL,
    payload jsonb NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_activity_reports_scope_check CHECK ((scope = ANY (ARRAY['org'::text, 'team'::text]))),
    CONSTRAINT org_activity_reports_scope_team CHECK (((scope = 'team'::text) = (team_id IS NOT NULL)))
);


--
-- Name: org_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id uuid,
    target_user_id uuid,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: org_billing_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_billing_contacts (
    org_id uuid NOT NULL,
    name text,
    email text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT org_billing_contacts_email_ck CHECK (((length(email) <= 254) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
    CONSTRAINT org_billing_contacts_name_ck CHECK (((name IS NULL) OR (length(name) <= 120)))
);


--
-- Name: org_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    declined_at timestamp with time zone,
    CONSTRAINT org_invitations_not_self CHECK ((inviter_id <> invitee_id))
);

ALTER TABLE ONLY public.org_invitations REPLICA IDENTITY FULL;


--
-- Name: TABLE org_invitations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.org_invitations IS 'Invitations nominatives d''un ami vers une organisation. Lecture (mig. 130) restreinte au destinataire, à l''inviteur et aux admins de l''organisation : un refus n''a pas à être lisible par tous les collègues (RGPD art. 5.1.c). Les refus de plus de 30 jours sont purgés par pg_cron (mig. 112).';


--
-- Name: org_invite_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_invite_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    manager_id uuid,
    created_by uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    claimed_at timestamp with time zone,
    claimed_by uuid,
    email text,
    team_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    access_days integer,
    sent_count integer DEFAULT 0 NOT NULL,
    last_sent_at timestamp with time zone,
    CONSTRAINT org_invite_links_access_days CHECK (((access_days IS NULL) OR ((access_days >= 1) AND (access_days <= 365)))),
    CONSTRAINT org_invite_links_email_format CHECK (((email IS NULL) OR ((char_length(email) <= 254) AND (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))))
);


--
-- Name: org_member_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_member_permissions (
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    can_create_task boolean,
    can_edit_any_task boolean,
    can_delete_task boolean,
    can_create_project boolean,
    can_delete_project boolean,
    can_create_okr boolean,
    can_delete_okr boolean,
    can_manage_category boolean,
    can_create_team boolean,
    can_invite_member boolean,
    assign_targets text[],
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    can_edit_project boolean,
    can_view_org_report boolean,
    can_view_all_team_reports boolean,
    can_manage_roles boolean,
    CONSTRAINT org_member_permissions_assign_targets_check CHECK ((assign_targets <@ ARRAY['self'::text, 'everyone'::text]))
);


--
-- Name: org_member_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_member_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    role_id uuid NOT NULL,
    user_id uuid NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expiry_notified_at timestamp with time zone,
    CONSTRAINT org_member_roles_period_check CHECK (((ends_at IS NULL) OR (ends_at > starts_at)))
);


--
-- Name: org_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_notification_settings (
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    muted_kinds text[] DEFAULT '{}'::text[] NOT NULL,
    email_kinds text[] DEFAULT '{}'::text[] NOT NULL,
    digest text DEFAULT 'off'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_notification_settings_digest_check CHECK ((digest = ANY (ARRAY['off'::text, 'daily'::text])))
);


--
-- Name: org_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid,
    kind text NOT NULL,
    task_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    kr_id uuid,
    event_id uuid,
    meta jsonb,
    emailed_at timestamp with time zone,
    CONSTRAINT org_notifications_kind_check CHECK ((kind = ANY (ARRAY['task_assigned'::text, 'mention'::text, 'task_overdue'::text, 'comment'::text, 'org_removed'::text, 'status_changed'::text, 'unblocked'::text, 'project_at_risk'::text, 'kr_due'::text, 'event_scheduled'::text, 'project_archived'::text, 'role_changed'::text, 'automation'::text])))
);

ALTER TABLE ONLY public.org_notifications REPLICA IDENTITY FULL;


--
-- Name: TABLE org_notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.org_notifications IS 'Notifications d''entreprise (mig. 095). Écrites UNIQUEMENT par trigger — aucune policy INSERT. Le destinataire peut lire, marquer lue et supprimer les siennes.';


--
-- Name: org_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    granted_keys text[] DEFAULT '{}'::text[] NOT NULL,
    assign_targets text[] DEFAULT '{self}'::text[] NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_roles_assign_targets_check CHECK ((assign_targets <@ ARRAY['self'::text, 'everyone'::text])),
    CONSTRAINT org_roles_color_check CHECK ((color ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT org_roles_granted_keys_check CHECK ((granted_keys <@ ARRAY['task.create'::text, 'task.editAny'::text, 'task.deleteAny'::text, 'project.create'::text, 'project.edit'::text, 'project.delete'::text, 'okr.create'::text, 'okr.delete'::text, 'category.manage'::text, 'team.create'::text, 'member.invite'::text, 'report.org'::text, 'report.allTeams'::text, 'role.manage'::text])),
    CONSTRAINT org_roles_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40)))
);


--
-- Name: org_saved_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_saved_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    scope text NOT NULL,
    name text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_saved_views_filters_shape CHECK (((jsonb_typeof(filters) = 'object'::text) AND (octet_length((filters)::text) <= 4000))),
    CONSTRAINT org_saved_views_name_length CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))),
    CONSTRAINT org_saved_views_scope_check CHECK ((scope = ANY (ARRAY['tasks'::text, 'projects'::text])))
);


--
-- Name: org_seat_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_seat_alerts (
    id bigint NOT NULL,
    org_id uuid,
    tier_key text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient text,
    provider_message_id text
);


--
-- Name: TABLE org_seat_alerts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.org_seat_alerts IS 'Alerte 80 % des sieges envoyee au proprietaire, une ligne par palier (UNIQUE org_id, tier_key). Ecrite par l Edge Function seat-alert seule.';


--
-- Name: org_seat_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.org_seat_alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: org_seat_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.org_seat_alerts_id_seq OWNED BY public.org_seat_alerts.id;


--
-- Name: org_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_settings (
    org_id uuid NOT NULL,
    locale text DEFAULT 'fr'::text NOT NULL,
    timezone text DEFAULT 'Europe/Paris'::text NOT NULL,
    week_start smallint DEFAULT 1 NOT NULL,
    work_days smallint[] DEFAULT '{1,2,3,4,5}'::smallint[] NOT NULL,
    default_task_priority smallint DEFAULT 3 NOT NULL,
    default_project_audience text DEFAULT 'team'::text NOT NULL,
    default_guest_days smallint,
    invite_domain_only boolean DEFAULT false NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_role_id uuid,
    member_default_perms text[],
    CONSTRAINT org_settings_audience CHECK ((default_project_audience = ANY (ARRAY['org'::text, 'team'::text]))),
    CONSTRAINT org_settings_guest_days CHECK (((default_guest_days IS NULL) OR ((default_guest_days >= 1) AND (default_guest_days <= 365)))),
    CONSTRAINT org_settings_locale CHECK ((locale = ANY (ARRAY['fr'::text, 'en'::text]))),
    CONSTRAINT org_settings_member_default_perms_check CHECK (((member_default_perms IS NULL) OR (member_default_perms <@ ARRAY['task.create'::text, 'task.editAny'::text, 'task.deleteAny'::text, 'project.create'::text, 'project.edit'::text, 'project.delete'::text, 'okr.create'::text, 'okr.delete'::text, 'category.manage'::text, 'team.create'::text, 'member.invite'::text, 'report.org'::text, 'report.allTeams'::text, 'role.manage'::text]))),
    CONSTRAINT org_settings_priority CHECK (((default_task_priority >= 1) AND (default_task_priority <= 5))),
    CONSTRAINT org_settings_week_start CHECK (((week_start >= 0) AND (week_start <= 6))),
    CONSTRAINT org_settings_work_days CHECK ((((cardinality(work_days) >= 1) AND (cardinality(work_days) <= 7)) AND (work_days <@ '{0,1,2,3,4,5,6}'::smallint[])))
);


--
-- Name: org_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_subscriptions (
    org_id uuid NOT NULL,
    tier_key text DEFAULT 'free'::text NOT NULL,
    max_members integer,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_end timestamp with time zone,
    stripe_customer_id text,
    stripe_subscription_id text,
    discount_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_interval text DEFAULT 'monthly'::text NOT NULL,
    purchased_by uuid,
    started_at timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    renewal_notice_missed_at timestamp with time zone,
    CONSTRAINT org_subscriptions_billing_interval_check CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT org_subscriptions_max_members_check CHECK (((max_members IS NULL) OR (max_members > 0))),
    CONSTRAINT org_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'past_due'::text, 'cancelled'::text]))),
    CONSTRAINT org_subscriptions_tier_key_check CHECK ((tier_key = ANY (ARRAY['free'::text, 't10'::text, 't20'::text, 't50'::text, 't100'::text, 'tmax'::text])))
);


--
-- Name: COLUMN org_subscriptions.billing_interval; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.org_subscriptions.billing_interval IS 'Périodicité facturée (mig. 123). Descriptive uniquement : le quota de sièges vient du palier seul, jamais d''ici.';


--
-- Name: org_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_team_members (
    team_id uuid NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid DEFAULT auth.uid(),
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    is_lead boolean DEFAULT false NOT NULL
);


--
-- Name: org_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    CONSTRAINT org_teams_description_length CHECK (((description IS NULL) OR (char_length(description) <= 500))),
    CONSTRAINT org_teams_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)))
);


--
-- Name: org_verified_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_verified_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    domain text NOT NULL,
    verification_token text DEFAULT replace((gen_random_uuid())::text, '-'::text, ''::text) NOT NULL,
    verified_at timestamp with time zone,
    last_checked_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_verified_domains_shape CHECK (((domain = lower(domain)) AND ((char_length(domain) >= 4) AND (char_length(domain) <= 253)) AND (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'::text)))
);


--
-- Name: org_webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    org_id uuid NOT NULL,
    event text NOT NULL,
    payload jsonb NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    status_code integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    CONSTRAINT org_webhook_deliveries_payload CHECK ((octet_length((payload)::text) <= 8000))
);


--
-- Name: org_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    format text DEFAULT 'json'::text NOT NULL,
    events text[] DEFAULT '{task.created,task.completed}'::text[] NOT NULL,
    secret text DEFAULT (replace((gen_random_uuid())::text, '-'::text, ''::text) || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_status integer,
    last_delivery_at timestamp with time zone,
    failure_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT org_webhooks_events CHECK ((((cardinality(events) >= 1) AND (cardinality(events) <= 3)) AND (events <@ '{task.created,task.status_changed,task.completed}'::text[]))),
    CONSTRAINT org_webhooks_format CHECK ((format = ANY (ARRAY['json'::text, 'slack'::text]))),
    CONSTRAINT org_webhooks_name CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)))
);


--
-- Name: org_weekly_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_weekly_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    scope_type text NOT NULL,
    scope_id uuid,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    summary jsonb NOT NULL,
    note text,
    CONSTRAINT org_weekly_reviews_note_check CHECK (((note IS NULL) OR (char_length(note) <= 2000))),
    CONSTRAINT org_weekly_reviews_scope_type_check CHECK ((scope_type = ANY (ARRAY['org'::text, 'subtree'::text, 'team'::text, 'project'::text])))
);


--
-- Name: org_withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_withdrawals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    user_id uuid NOT NULL,
    recipient text NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_invoice_id text,
    withdrawn_at timestamp with time zone DEFAULT now() NOT NULL,
    amount_due_cents integer NOT NULL,
    rule text NOT NULL,
    ack_message_id text,
    refunded_at timestamp with time zone,
    refunded_cents integer,
    reminder_sent_at timestamp with time zone,
    CONSTRAINT org_withdrawals_amount_due_cents_check CHECK ((amount_due_cents >= 0)),
    CONSTRAINT org_withdrawals_refunded_cents_check CHECK (((refunded_cents IS NULL) OR (refunded_cents >= 0)))
);


--
-- Name: organization_join_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_join_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone
);

ALTER TABLE ONLY public.organization_join_requests REPLICA IDENTITY FULL;


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    manager_id uuid,
    suspended_at timestamp with time zone,
    access_expires_at timestamp with time zone,
    CONSTRAINT org_member_not_own_manager CHECK (((manager_id IS NULL) OR (manager_id <> user_id))),
    CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: payment_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_records_id_seq OWNED BY public.payment_records.id;


--
-- Name: processed_stripe_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_stripe_events (
    id text NOT NULL,
    event_type text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    display_name text,
    avatar_url text,
    updated_at timestamp with time zone DEFAULT now(),
    last_seen_at timestamp with time zone,
    account_type text DEFAULT 'personal'::text NOT NULL,
    acquisition_source text,
    acquisition_campaign text,
    affiliate_id uuid,
    affiliate_slug text,
    affiliated_at timestamp with time zone,
    CONSTRAINT profiles_account_type_check CHECK ((account_type = ANY (ARRAY['personal'::text, 'business'::text]))),
    CONSTRAINT profiles_acquisition_campaign_len CHECK (((acquisition_campaign IS NULL) OR (char_length(acquisition_campaign) <= 40))),
    CONSTRAINT profiles_acquisition_source_len CHECK (((acquisition_source IS NULL) OR (char_length(acquisition_source) <= 40))),
    CONSTRAINT profiles_avatar_url_valid CHECK (((avatar_url IS NULL) OR ((length(avatar_url) <= 60000) AND public.is_allowed_avatar_url(avatar_url))))
);


--
-- Name: COLUMN profiles.acquisition_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.acquisition_source IS 'Canal d''acquisition first-touch (?ref= / utm_source), normalisé [a-z0-9_-]{1,40}. NULL = inconnu.';


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    bucket_key text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    hits integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE rate_limits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rate_limits IS 'Compteurs de debit, fenetre glissante. Le bucket_key est un opaque (hachage sale), JAMAIS une IP ni un email : rien ici ne designe quelqu un. Purgeable a volonte, c est un cache de defense, pas une preuve.';


--
-- Name: renewal_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.renewal_notices (
    org_id uuid,
    period_end date NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    recipient text,
    id bigint NOT NULL,
    provider_message_id text
);


--
-- Name: TABLE renewal_notices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.renewal_notices IS 'Preuve d envoi de l avis de reconduction tacite (Conso. art. L215-1). Une ligne par echeance. Ne jamais purger.';


--
-- Name: COLUMN renewal_notices.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.renewal_notices.org_id IS 'NULL = organisation supprimee depuis. La preuve SURVIT : recipient, period_end et sent_at disent encore a qui, pour quel terme et quand l avis a ete adresse. Etait ON DELETE CASCADE jusqu a la mig. 138 (finding C-30).';


--
-- Name: renewal_notices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.renewal_notices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: renewal_notices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.renewal_notices_id_seq OWNED BY public.renewal_notices.id;


--
-- Name: share_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL
);


--
-- Name: shared_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shared_by uuid DEFAULT auth.uid() NOT NULL,
    friend_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.shared_lists REPLICA IDENTITY FULL;


--
-- Name: shared_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    shared_by uuid DEFAULT auth.uid(),
    shared_at timestamp with time zone DEFAULT now(),
    accepted_at timestamp with time zone,
    CONSTRAINT shared_tasks_role_check CHECK ((role = ANY (ARRAY['viewer'::text, 'editor'::text])))
);

ALTER TABLE ONLY public.shared_tasks REPLICA IDENTITY FULL;


--
-- Name: COLUMN shared_tasks.shared_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.shared_tasks.shared_by IS 'auth.users.id du partageur. Moitie proprietaire des policies de partage depuis la mig. 019. Colonne creee hors migration, formalisee ici.';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    stripe_customer_id text,
    stripe_subscription_id text
);


--
-- Name: TABLE subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscriptions IS 'Abonnement premium d''un compte PARTICULIER (plan, status, periode, Stripe). Ne pas confondre avec org_subscriptions (mig. 101), qui porte l''abonnement d''une organisation. Les jetons premium et le win_streak ont ete supprimes par la mig. 141 (C-04).';


--
-- Name: support_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    category text NOT NULL,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    CONSTRAINT support_reports_category_check CHECK ((category = ANY (ARRAY['bug'::text, 'idea'::text, 'question'::text, 'other'::text]))),
    CONSTRAINT support_reports_ordre_chrono CHECK ((((first_response_at IS NULL) OR (first_response_at >= received_at)) AND ((resolved_at IS NULL) OR (resolved_at >= received_at))))
);


--
-- Name: TABLE support_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.support_reports IS 'Compteur du support (C-110). AUCUNE donnee a caractere personnel : ni user_id, ni email, ni contenu. Le rapport lui-meme vit dans la boite mail du destinataire (registre art. 30, traitement T7).';


--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_dependencies (
    task_id uuid NOT NULL,
    depends_on_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT task_dependencies_no_self CHECK ((task_id <> depends_on_id))
);


--
-- Name: TABLE task_dependencies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_dependencies IS 'Dependances entre taches personnelles (bloque / bloquee par). Perimetre strictement limite au proprietaire : contrairement a team_task_dependencies (mig. 108), la policy ne delegue PAS a tasks — le OR de la mig. 049 est non indexable, et une tache personnelle peut etre partagee.';


--
-- Name: tasks_pending_invites; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tasks_pending_invites WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    pending_invites
   FROM public.tasks
  WHERE (auth.uid() = user_id);


--
-- Name: team_automations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_automations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    name text NOT NULL,
    trigger_kind text NOT NULL,
    trigger_value text,
    action_kind text NOT NULL,
    action_value text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_automations_action CHECK ((((action_kind = 'set_priority'::text) AND (action_value = ANY (ARRAY['1'::text, '2'::text, '3'::text, '4'::text, '5'::text]))) OR ((action_kind = 'set_status'::text) AND (action_value = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'blocked'::text, 'done'::text]))) OR ((action_kind = 'add_assignee'::text) AND (action_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text)) OR ((action_kind = 'notify_member'::text) AND ((action_value = 'assignees'::text) OR (action_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text))))),
    CONSTRAINT team_automations_name CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
    CONSTRAINT team_automations_no_status_echo CHECK ((NOT ((trigger_kind = 'status_changed'::text) AND (action_kind = 'set_status'::text)))),
    CONSTRAINT team_automations_position CHECK ((("position" >= 0) AND ("position" <= 99))),
    CONSTRAINT team_automations_trigger CHECK ((((trigger_kind = 'task_created'::text) AND (trigger_value IS NULL)) OR ((trigger_kind = 'status_changed'::text) AND (trigger_value = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'blocked'::text, 'done'::text])))))
);


--
-- Name: team_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    CONSTRAINT team_categories_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)))
);


--
-- Name: TABLE team_categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_categories IS 'Catégories d''entreprise (mig. 111, arbre mig. 148) : étiquette transverse hiérarchique, partagée par les tâches (team_tasks.category_id), les projets (team_projects.category_id) et les OKR d''équipe (team_okrs.category_id). Remplace org_okr_categories (mig. 078, fusionnée ici).';


--
-- Name: COLUMN team_categories.parent_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_categories.parent_id IS 'Catégorie parente. NULL = racine. NO ACTION : supprimer un parent en laissant ses enfants est refusé en fin de requête, mais une branche entière peut partir dans un seul DELETE (suppression d''organisation).';


--
-- Name: team_key_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_key_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    okr_id uuid NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    current_value numeric DEFAULT 0 NOT NULL,
    target_value numeric DEFAULT 1 NOT NULL,
    unit text,
    assignee_id uuid,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    estimated_time numeric DEFAULT 30 NOT NULL,
    progress_mode text DEFAULT 'manual'::text NOT NULL,
    contributor_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    health text,
    health_updated_at timestamp with time zone,
    CONSTRAINT team_key_results_estimated_time_check CHECK ((estimated_time >= (0)::numeric)),
    CONSTRAINT team_key_results_health_check CHECK (((health IS NULL) OR (health = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))),
    CONSTRAINT team_key_results_progress_mode_check CHECK ((progress_mode = ANY (ARRAY['manual'::text, 'tasks'::text]))),
    CONSTRAINT team_key_results_target_value_check CHECK ((target_value > (0)::numeric)),
    CONSTRAINT team_key_results_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 300))),
    CONSTRAINT team_key_results_weight_range CHECK (((weight >= 1) AND (weight <= 10)))
);


--
-- Name: team_kr_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_kr_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kr_id uuid NOT NULL,
    org_id uuid NOT NULL,
    value numeric NOT NULL,
    status text NOT NULL,
    note text,
    author_id uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_kr_checkins_note_check CHECK (((note IS NULL) OR (char_length(note) <= 1000))),
    CONSTRAINT team_kr_checkins_status_check CHECK ((status = ANY (ARRAY['on_track'::text, 'at_risk'::text, 'off_track'::text])))
);


--
-- Name: team_kr_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_kr_projects (
    kr_id uuid NOT NULL,
    project_id uuid NOT NULL,
    org_id uuid NOT NULL,
    added_by uuid DEFAULT auth.uid(),
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_labels_color_check CHECK ((color ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT team_labels_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 40)))
);


--
-- Name: TABLE team_labels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_labels IS 'Vocabulaire de labels d''une organisation (mig. 093). Lecture par tout membre, écriture réservée aux managers.';


--
-- Name: team_list_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_list_tasks (
    list_id uuid NOT NULL,
    task_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE team_list_tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_list_tasks IS 'Jonction liste ↔ tâche d''équipe (mig. 203). Ajouter exige de voir la tâche, et que la tâche soit de la même organisation.';


--
-- Name: team_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT 'blue'::text NOT NULL,
    type text DEFAULT 'manual'::text NOT NULL,
    smart_rule text,
    "position" integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_lists_color_check CHECK ((color ~ '^(#[0-9a-fA-F]{6}|[a-z]{3,12})$'::text)),
    CONSTRAINT team_lists_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 60))),
    CONSTRAINT team_lists_smart_rule_check CHECK (((smart_rule IS NULL) OR (smart_rule = ANY (ARRAY['overdue'::text, 'this-week'::text, 'high-priority'::text])))),
    CONSTRAINT team_lists_smart_rule_required CHECK (((type = 'manual'::text) OR (smart_rule IS NOT NULL))),
    CONSTRAINT team_lists_type_check CHECK ((type = ANY (ARRAY['manual'::text, 'smart'::text])))
);


--
-- Name: TABLE team_lists; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_lists IS 'Listes d''une organisation (mig. 203) : classement libre et partagé des tâches d''équipe. L''épingle par défaut est une préférence client.';


--
-- Name: team_okr_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_okr_members (
    okr_id uuid NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_by uuid DEFAULT auth.uid(),
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_okr_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_okr_teams (
    okr_id uuid NOT NULL,
    org_id uuid NOT NULL,
    team_id uuid NOT NULL,
    added_by uuid DEFAULT auth.uid(),
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_okrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_okrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    start_date date,
    end_date date,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category_id uuid,
    parent_okr_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    audience text DEFAULT 'org'::text NOT NULL,
    CONSTRAINT team_okrs_audience_check CHECK ((audience = ANY (ARRAY['org'::text, 'teams'::text, 'custom'::text]))),
    CONSTRAINT team_okrs_parent_not_self CHECK (((parent_okr_id IS NULL) OR (parent_okr_id <> id))),
    CONSTRAINT team_okrs_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)))
);


--
-- Name: team_project_followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_project_followers (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_project_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_project_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    org_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_project_messages_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)))
);


--
-- Name: team_project_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_project_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    maps_to text NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_project_statuses_color CHECK ((color ~ '^#[0-9a-fA-F]{6}$'::text)),
    CONSTRAINT team_project_statuses_maps_to CHECK ((maps_to = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'blocked'::text, 'done'::text]))),
    CONSTRAINT team_project_statuses_name CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40))),
    CONSTRAINT team_project_statuses_position CHECK ((("position" >= 0) AND ("position" <= 99)))
);


--
-- Name: team_project_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_project_teams (
    project_id uuid NOT NULL,
    team_id uuid NOT NULL,
    org_id uuid NOT NULL,
    added_by uuid,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_task_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    org_id uuid NOT NULL,
    actor_id uuid,
    field text NOT NULL,
    old_value text,
    new_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE team_task_activity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_task_activity IS 'Journal append-only des modifications de tâches d''équipe (mig. 094). Écrit UNIQUEMENT par trigger — aucune policy INSERT/UPDATE/DELETE, volontairement.';


--
-- Name: team_task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    mentions uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_task_comments_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 2000)))
);


--
-- Name: team_task_followers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_followers (
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: team_task_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_labels (
    task_id uuid NOT NULL,
    label_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE team_task_labels; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_task_labels IS 'Jonction tâche ↔ label (mig. 093). Poser un label est un acte d''édition de la tâche.';


--
-- Name: team_task_subtasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_task_subtasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    title text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT team_task_subtasks_title_check CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 200)))
);


--
-- Name: TABLE team_task_subtasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_task_subtasks IS 'Sous-tâches d''une tâche d''équipe (mig. 092). Un seul niveau, pas de récursion. Accès délégué à can_access_team_task.';


--
-- Name: traffic_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.traffic_hits (
    id bigint NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text NOT NULL,
    visitor text NOT NULL,
    path text NOT NULL,
    referrer_host text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    country text,
    region text,
    city text,
    browser text,
    os text,
    device text,
    lang text,
    duration_ms integer,
    scroll_pct smallint,
    cta text,
    CONSTRAINT traffic_hits_browser_check CHECK ((char_length(browser) <= 40)),
    CONSTRAINT traffic_hits_city_check CHECK ((char_length(city) <= 100)),
    CONSTRAINT traffic_hits_country_check CHECK ((country ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT traffic_hits_cta_check CHECK ((char_length(cta) <= 80)),
    CONSTRAINT traffic_hits_device_check CHECK ((device = ANY (ARRAY['mobile'::text, 'tablet'::text, 'desktop'::text]))),
    CONSTRAINT traffic_hits_duration_ms_check CHECK (((duration_ms >= 0) AND (duration_ms <= 86400000))),
    CONSTRAINT traffic_hits_kind_check CHECK ((kind = ANY (ARRAY['view'::text, 'leave'::text, 'cta'::text]))),
    CONSTRAINT traffic_hits_lang_check CHECK ((char_length(lang) <= 20)),
    CONSTRAINT traffic_hits_os_check CHECK ((char_length(os) <= 40)),
    CONSTRAINT traffic_hits_path_check CHECK (((path ~ '^/'::text) AND (char_length(path) <= 300))),
    CONSTRAINT traffic_hits_referrer_host_check CHECK ((char_length(referrer_host) <= 255)),
    CONSTRAINT traffic_hits_region_check CHECK ((char_length(region) <= 100)),
    CONSTRAINT traffic_hits_scroll_pct_check CHECK (((scroll_pct >= 0) AND (scroll_pct <= 100))),
    CONSTRAINT traffic_hits_utm_campaign_check CHECK ((char_length(utm_campaign) <= 100)),
    CONSTRAINT traffic_hits_utm_medium_check CHECK ((char_length(utm_medium) <= 100)),
    CONSTRAINT traffic_hits_utm_source_check CHECK ((char_length(utm_source) <= 100)),
    CONSTRAINT traffic_hits_visitor_check CHECK ((char_length(visitor) = 64))
);


--
-- Name: traffic_hits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.traffic_hits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.traffic_hits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: traffic_salts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.traffic_salts (
    day date NOT NULL,
    salt text NOT NULL
);


--
-- Name: user_activity_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_days (
    user_id uuid NOT NULL,
    day date NOT NULL
);


--
-- Name: withdrawal_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawal_consents (
    id bigint NOT NULL,
    org_id uuid,
    user_id uuid NOT NULL,
    tier_key text NOT NULL,
    billing_interval text NOT NULL,
    immediate_execution boolean NOT NULL,
    waives_withdrawal boolean NOT NULL,
    consented_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT withdrawal_consents_complete_ck CHECK ((immediate_execution AND waives_withdrawal)),
    CONSTRAINT withdrawal_consents_interval_ck CHECK ((billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text])))
);


--
-- Name: TABLE withdrawal_consents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.withdrawal_consents IS 'Preuve du consentement de l''article L221-28, 13° (renonciation au droit de retractation). Append-only, ecrite par stripe-org-checkout AVANT la creation de la session de paiement. Jumelle de renewal_notices : ne jamais purger.';


--
-- Name: COLUMN withdrawal_consents.org_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.withdrawal_consents.org_id IS 'NULL = organisation supprimee depuis. La preuve SURVIT : user_id, tier_key, billing_interval, les deux booleens et consented_at disent encore qui a renonce, a quoi et quand. Etait ON DELETE CASCADE jusqu a la mig. 138 (finding C-30).';


--
-- Name: withdrawal_consents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.withdrawal_consents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: withdrawal_consents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.withdrawal_consents_id_seq OWNED BY public.withdrawal_consents.id;


--
-- Name: affiliate_clicks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks ALTER COLUMN id SET DEFAULT nextval('public.affiliate_clicks_id_seq'::regclass);


--
-- Name: affiliate_commissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions ALTER COLUMN id SET DEFAULT nextval('public.affiliate_commissions_id_seq'::regclass);


--
-- Name: org_seat_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_seat_alerts ALTER COLUMN id SET DEFAULT nextval('public.org_seat_alerts_id_seq'::regclass);


--
-- Name: payment_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records ALTER COLUMN id SET DEFAULT nextval('public.payment_records_id_seq'::regclass);


--
-- Name: renewal_notices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renewal_notices ALTER COLUMN id SET DEFAULT nextval('public.renewal_notices_id_seq'::regclass);


--
-- Name: withdrawal_consents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_consents ALTER COLUMN id SET DEFAULT nextval('public.withdrawal_consents_id_seq'::regclass);


--
-- Name: account_inactivity_notices account_inactivity_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_inactivity_notices
    ADD CONSTRAINT account_inactivity_notices_pkey PRIMARY KEY (user_id);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (user_id);


--
-- Name: affiliate_clicks affiliate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);


--
-- Name: affiliate_commissions affiliate_commissions_payment_record_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_payment_record_id_key UNIQUE (payment_record_id);


--
-- Name: affiliate_commissions affiliate_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_pkey PRIMARY KEY (id);


--
-- Name: affiliate_contacts affiliate_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_contacts
    ADD CONSTRAINT affiliate_contacts_pkey PRIMARY KEY (user_id);


--
-- Name: affiliate_links affiliate_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_links
    ADD CONSTRAINT affiliate_links_pkey PRIMARY KEY (slug);


--
-- Name: affiliate_payouts affiliate_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_pkey PRIMARY KEY (id);


--
-- Name: affiliate_settings affiliate_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_settings
    ADD CONSTRAINT affiliate_settings_pkey PRIMARY KEY (id);


--
-- Name: affiliates affiliates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliates
    ADD CONSTRAINT affiliates_pkey PRIMARY KEY (id);


--
-- Name: billing_acceptances billing_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_acceptances
    ADD CONSTRAINT billing_acceptances_pkey PRIMARY KEY (id);


--
-- Name: billing_flags billing_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_flags
    ADD CONSTRAINT billing_flags_pkey PRIMARY KEY (key);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: cron_leases cron_leases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_leases
    ADD CONSTRAINT cron_leases_pkey PRIMARY KEY (job);


--
-- Name: cron_runs cron_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_runs
    ADD CONSTRAINT cron_runs_pkey PRIMARY KEY (id);


--
-- Name: demo_devices demo_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_devices
    ADD CONSTRAINT demo_devices_pkey PRIMARY KEY (device_id);


--
-- Name: email_lookup_global email_lookup_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_lookup_global
    ADD CONSTRAINT email_lookup_global_pkey PRIMARY KEY (window_start);


--
-- Name: email_lookup_quota email_lookup_quota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_lookup_quota
    ADD CONSTRAINT email_lookup_quota_pkey PRIMARY KEY (user_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id);


--
-- Name: friends friends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_pkey PRIMARY KEY (id);


--
-- Name: friends friends_user_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_email_key UNIQUE (user_id, email);


--
-- Name: habit_completions habit_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_pkey PRIMARY KEY (habit_id, user_id, day);


--
-- Name: habits habits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_pkey PRIMARY KEY (id);


--
-- Name: key_results key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_results
    ADD CONSTRAINT key_results_pkey PRIMARY KEY (id);


--
-- Name: kr_completions kr_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kr_completions
    ADD CONSTRAINT kr_completions_pkey PRIMARY KEY (id);


--
-- Name: lists lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lists
    ADD CONSTRAINT lists_pkey PRIMARY KEY (id);


--
-- Name: okrs okrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.okrs
    ADD CONSTRAINT okrs_pkey PRIMARY KEY (id);


--
-- Name: org_activity_reports org_activity_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_activity_reports
    ADD CONSTRAINT org_activity_reports_pkey PRIMARY KEY (id);


--
-- Name: org_audit_log org_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_audit_log
    ADD CONSTRAINT org_audit_log_pkey PRIMARY KEY (id);


--
-- Name: org_billing_contacts org_billing_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_billing_contacts
    ADD CONSTRAINT org_billing_contacts_pkey PRIMARY KEY (org_id);


--
-- Name: org_invitations org_invitations_org_id_invitee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_org_id_invitee_id_key UNIQUE (org_id, invitee_id);


--
-- Name: org_invitations org_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_pkey PRIMARY KEY (id);


--
-- Name: org_invite_links org_invite_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invite_links
    ADD CONSTRAINT org_invite_links_pkey PRIMARY KEY (id);


--
-- Name: org_member_permissions org_member_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_permissions
    ADD CONSTRAINT org_member_permissions_pkey PRIMARY KEY (org_id, user_id);


--
-- Name: org_member_roles org_member_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_roles
    ADD CONSTRAINT org_member_roles_pkey PRIMARY KEY (id);


--
-- Name: org_member_roles org_member_roles_role_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_roles
    ADD CONSTRAINT org_member_roles_role_user_key UNIQUE (role_id, user_id);


--
-- Name: org_notification_settings org_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notification_settings
    ADD CONSTRAINT org_notification_settings_pkey PRIMARY KEY (org_id, user_id);


--
-- Name: org_notifications org_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_pkey PRIMARY KEY (id);


--
-- Name: org_roles org_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT org_roles_pkey PRIMARY KEY (id);


--
-- Name: org_saved_views org_saved_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_saved_views
    ADD CONSTRAINT org_saved_views_pkey PRIMARY KEY (id);


--
-- Name: org_saved_views org_saved_views_unique_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_saved_views
    ADD CONSTRAINT org_saved_views_unique_name UNIQUE (org_id, user_id, scope, name);


--
-- Name: org_seat_alerts org_seat_alerts_org_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_seat_alerts
    ADD CONSTRAINT org_seat_alerts_org_tier_key UNIQUE (org_id, tier_key);


--
-- Name: org_seat_alerts org_seat_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_seat_alerts
    ADD CONSTRAINT org_seat_alerts_pkey PRIMARY KEY (id);


--
-- Name: org_settings org_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_pkey PRIMARY KEY (org_id);


--
-- Name: org_subscriptions org_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_pkey PRIMARY KEY (org_id);


--
-- Name: org_subscriptions org_subscriptions_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: org_subscriptions org_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: org_team_members org_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_team_members
    ADD CONSTRAINT org_team_members_pkey PRIMARY KEY (team_id, user_id);


--
-- Name: org_teams org_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_teams
    ADD CONSTRAINT org_teams_pkey PRIMARY KEY (id);


--
-- Name: org_verified_domains org_verified_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_verified_domains
    ADD CONSTRAINT org_verified_domains_pkey PRIMARY KEY (id);


--
-- Name: org_verified_domains org_verified_domains_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_verified_domains
    ADD CONSTRAINT org_verified_domains_unique UNIQUE (org_id, domain);


--
-- Name: org_webhook_deliveries org_webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_webhook_deliveries
    ADD CONSTRAINT org_webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: org_webhooks org_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_webhooks
    ADD CONSTRAINT org_webhooks_pkey PRIMARY KEY (id);


--
-- Name: org_webhooks org_webhooks_url; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.org_webhooks
    ADD CONSTRAINT org_webhooks_url CHECK (((char_length(url) <= 500) AND (url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(:[0-9]{1,5})?(/.*)?$'::text) AND (url !~* '^https://[^/:]*\.(localhost|local|internal|localdomain|lan|home|corp|intranet|private|arpa|test|invalid|example|onion)(:[0-9]{1,5})?(/.*)?$'::text))) NOT VALID;


--
-- Name: org_weekly_reviews org_weekly_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_weekly_reviews
    ADD CONSTRAINT org_weekly_reviews_pkey PRIMARY KEY (id);


--
-- Name: org_withdrawals org_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_withdrawals
    ADD CONSTRAINT org_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: org_withdrawals org_withdrawals_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_withdrawals
    ADD CONSTRAINT org_withdrawals_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: organization_join_requests organization_join_requests_org_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_join_requests
    ADD CONSTRAINT organization_join_requests_org_id_user_id_key UNIQUE (org_id, user_id);


--
-- Name: organization_join_requests organization_join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_join_requests
    ADD CONSTRAINT organization_join_requests_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (org_id, user_id);


--
-- Name: organizations organizations_join_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_join_code_key UNIQUE (join_code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: payment_closures payment_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_closures
    ADD CONSTRAINT payment_closures_pkey PRIMARY KEY (period_start);


--
-- Name: payment_records payment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_pkey PRIMARY KEY (id);


--
-- Name: payment_records payment_records_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: processed_stripe_events processed_stripe_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_stripe_events
    ADD CONSTRAINT processed_stripe_events_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (bucket_key);


--
-- Name: renewal_notices renewal_notices_org_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renewal_notices
    ADD CONSTRAINT renewal_notices_org_period_key UNIQUE (org_id, period_end);


--
-- Name: renewal_notices renewal_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renewal_notices
    ADD CONSTRAINT renewal_notices_pkey PRIMARY KEY (id);


--
-- Name: share_links share_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_pkey PRIMARY KEY (id);


--
-- Name: shared_lists shared_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_lists
    ADD CONSTRAINT shared_lists_pkey PRIMARY KEY (id);


--
-- Name: shared_tasks shared_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_pkey PRIMARY KEY (id);


--
-- Name: shared_tasks shared_tasks_task_id_friend_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_task_id_friend_id_key UNIQUE (task_id, friend_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: support_reports support_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_reports
    ADD CONSTRAINT support_reports_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (task_id, depends_on_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: team_automations team_automations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_automations
    ADD CONSTRAINT team_automations_pkey PRIMARY KEY (id);


--
-- Name: team_categories team_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_categories
    ADD CONSTRAINT team_categories_pkey PRIMARY KEY (id);


--
-- Name: team_key_results team_key_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_key_results
    ADD CONSTRAINT team_key_results_pkey PRIMARY KEY (id);


--
-- Name: team_kr_checkins team_kr_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_checkins
    ADD CONSTRAINT team_kr_checkins_pkey PRIMARY KEY (id);


--
-- Name: team_kr_projects team_kr_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_projects
    ADD CONSTRAINT team_kr_projects_pkey PRIMARY KEY (kr_id, project_id);


--
-- Name: team_labels team_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_labels
    ADD CONSTRAINT team_labels_pkey PRIMARY KEY (id);


--
-- Name: team_list_tasks team_list_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_list_tasks
    ADD CONSTRAINT team_list_tasks_pkey PRIMARY KEY (list_id, task_id);


--
-- Name: team_lists team_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lists
    ADD CONSTRAINT team_lists_pkey PRIMARY KEY (id);


--
-- Name: team_okr_members team_okr_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_members
    ADD CONSTRAINT team_okr_members_pkey PRIMARY KEY (okr_id, user_id);


--
-- Name: team_okr_teams team_okr_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_teams
    ADD CONSTRAINT team_okr_teams_pkey PRIMARY KEY (okr_id, team_id);


--
-- Name: team_okrs team_okrs_id_org_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_id_org_key UNIQUE (id, org_id);


--
-- Name: team_okrs team_okrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_pkey PRIMARY KEY (id);


--
-- Name: team_project_dependencies team_project_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_dependencies
    ADD CONSTRAINT team_project_dependencies_pkey PRIMARY KEY (project_id, depends_on_id);


--
-- Name: team_project_followers team_project_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_followers
    ADD CONSTRAINT team_project_followers_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: team_project_members team_project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_members
    ADD CONSTRAINT team_project_members_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: team_project_messages team_project_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_messages
    ADD CONSTRAINT team_project_messages_pkey PRIMARY KEY (id);


--
-- Name: team_project_statuses team_project_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_statuses
    ADD CONSTRAINT team_project_statuses_pkey PRIMARY KEY (id);


--
-- Name: team_project_teams team_project_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_teams
    ADD CONSTRAINT team_project_teams_pkey PRIMARY KEY (project_id, team_id);


--
-- Name: team_projects team_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_pkey PRIMARY KEY (id);


--
-- Name: team_task_activity team_task_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_activity
    ADD CONSTRAINT team_task_activity_pkey PRIMARY KEY (id);


--
-- Name: team_task_comments team_task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_comments
    ADD CONSTRAINT team_task_comments_pkey PRIMARY KEY (id);


--
-- Name: team_task_dependencies team_task_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_dependencies
    ADD CONSTRAINT team_task_dependencies_pkey PRIMARY KEY (task_id, depends_on_id);


--
-- Name: team_task_followers team_task_followers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_followers
    ADD CONSTRAINT team_task_followers_pkey PRIMARY KEY (task_id, user_id);


--
-- Name: team_task_labels team_task_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_labels
    ADD CONSTRAINT team_task_labels_pkey PRIMARY KEY (task_id, label_id);


--
-- Name: team_task_subtasks team_task_subtasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_subtasks
    ADD CONSTRAINT team_task_subtasks_pkey PRIMARY KEY (id);


--
-- Name: team_tasks team_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_pkey PRIMARY KEY (id);


--
-- Name: traffic_hits traffic_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traffic_hits
    ADD CONSTRAINT traffic_hits_pkey PRIMARY KEY (id);


--
-- Name: traffic_salts traffic_salts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traffic_salts
    ADD CONSTRAINT traffic_salts_pkey PRIMARY KEY (day);


--
-- Name: user_activity_days user_activity_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_days
    ADD CONSTRAINT user_activity_days_pkey PRIMARY KEY (user_id, day);


--
-- Name: withdrawal_consents withdrawal_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_consents
    ADD CONSTRAINT withdrawal_consents_pkey PRIMARY KEY (id);


--
-- Name: billing_acceptances_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX billing_acceptances_org_idx ON public.billing_acceptances USING btree (org_id, created_at DESC);


--
-- Name: cron_runs_job_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cron_runs_job_started_idx ON public.cron_runs USING btree (job, started_at DESC);


--
-- Name: cron_runs_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cron_runs_pending_idx ON public.cron_runs USING btree (request_id) WHERE (status = 'started'::text);


--
-- Name: habit_completions_user_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX habit_completions_user_day_idx ON public.habit_completions USING btree (user_id, day);


--
-- Name: habits_id_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX habits_id_user_id_key ON public.habits USING btree (id, user_id);


--
-- Name: idx_affiliate_clicks_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_clicks_slug ON public.affiliate_clicks USING btree (slug);


--
-- Name: idx_affiliate_commissions_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_commissions_affiliate ON public.affiliate_commissions USING btree (affiliate_id, occurred_at);


--
-- Name: idx_affiliate_commissions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_commissions_customer ON public.affiliate_commissions USING btree (customer_id) WHERE (customer_id IS NOT NULL);


--
-- Name: idx_affiliate_links_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_links_affiliate ON public.affiliate_links USING btree (affiliate_id, created_at DESC);


--
-- Name: idx_affiliate_payouts_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_affiliate_payouts_affiliate ON public.affiliate_payouts USING btree (affiliate_id);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (user_id, parent_id);


--
-- Name: idx_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent_id ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_user_id ON public.categories USING btree (user_id);


--
-- Name: idx_demo_devices_converted_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demo_devices_converted_user ON public.demo_devices USING btree (converted_user_id);


--
-- Name: idx_demo_devices_first_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demo_devices_first_seen ON public.demo_devices USING btree (first_seen_at);


--
-- Name: idx_events_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_created_by ON public.events USING btree (created_by);


--
-- Name: idx_events_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_task_id ON public.events USING btree (task_id);


--
-- Name: idx_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_user_id ON public.events USING btree (user_id);


--
-- Name: idx_events_user_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_user_start ON public.events USING btree (user_id, start_time);


--
-- Name: idx_friend_requests_receiver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_receiver_id ON public.friend_requests USING btree (receiver_id);


--
-- Name: idx_friend_requests_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_sender_id ON public.friend_requests USING btree (sender_id);


--
-- Name: idx_friend_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_status ON public.friend_requests USING btree (status);


--
-- Name: idx_friends_friend_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friends_friend_user_id ON public.friends USING btree (friend_user_id);


--
-- Name: idx_friends_user_friend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friends_user_friend ON public.friends USING btree (user_id, friend_user_id);


--
-- Name: idx_friends_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friends_user_id ON public.friends USING btree (user_id);


--
-- Name: idx_friends_user_lower_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friends_user_lower_email ON public.friends USING btree (user_id, lower(email));


--
-- Name: idx_habits_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habits_created_at ON public.habits USING btree (created_at DESC);


--
-- Name: idx_habits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_habits_user_id ON public.habits USING btree (user_id);


--
-- Name: idx_key_results_okr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_results_okr_id ON public.key_results USING btree (okr_id);


--
-- Name: idx_key_results_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_results_user_id ON public.key_results USING btree (user_id);


--
-- Name: idx_kr_completions_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kr_completions_completed_at ON public.kr_completions USING btree (completed_at DESC);


--
-- Name: idx_kr_completions_kr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kr_completions_kr_id ON public.kr_completions USING btree (kr_id);


--
-- Name: idx_kr_completions_okr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kr_completions_okr_id ON public.kr_completions USING btree (okr_id);


--
-- Name: idx_kr_completions_user_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kr_completions_user_completed ON public.kr_completions USING btree (user_id, completed_at DESC);


--
-- Name: idx_kr_completions_user_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kr_completions_user_completed_at ON public.kr_completions USING btree (user_id, completed_at);


--
-- Name: idx_kr_completions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kr_completions_user_id ON public.kr_completions USING btree (user_id);


--
-- Name: idx_lists_one_default_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_lists_one_default_per_user ON public.lists USING btree (user_id) WHERE (is_default = true);


--
-- Name: idx_lists_task_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lists_task_ids ON public.lists USING gin (task_ids);


--
-- Name: idx_lists_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lists_user_id ON public.lists USING btree (user_id);


--
-- Name: idx_okrs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_okrs_category ON public.okrs USING btree (category);


--
-- Name: idx_okrs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_okrs_created_at ON public.okrs USING btree (created_at DESC);


--
-- Name: idx_okrs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_okrs_user_id ON public.okrs USING btree (user_id);


--
-- Name: idx_org_activity_reports_org_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_activity_reports_org_day ON public.org_activity_reports USING btree (org_id, day DESC);


--
-- Name: idx_org_audit_log_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_audit_log_actor_id ON public.org_audit_log USING btree (actor_id);


--
-- Name: idx_org_audit_log_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_audit_log_org ON public.org_audit_log USING btree (org_id, created_at DESC);


--
-- Name: idx_org_audit_log_target_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_audit_log_target_user ON public.org_audit_log USING btree (org_id, target_user_id, created_at DESC) WHERE (target_user_id IS NOT NULL);


--
-- Name: idx_org_audit_log_target_user_id_fk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_audit_log_target_user_id_fk ON public.org_audit_log USING btree (target_user_id);


--
-- Name: idx_org_billing_contacts_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_billing_contacts_updated_by ON public.org_billing_contacts USING btree (updated_by);


--
-- Name: idx_org_invitations_invitee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_invitee ON public.org_invitations USING btree (invitee_id) WHERE ((accepted_at IS NULL) AND (declined_at IS NULL));


--
-- Name: idx_org_invitations_inviter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_inviter_id ON public.org_invitations USING btree (inviter_id);


--
-- Name: idx_org_invitations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invitations_org ON public.org_invitations USING btree (org_id);


--
-- Name: idx_org_invite_links_claimed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invite_links_claimed_by ON public.org_invite_links USING btree (claimed_by);


--
-- Name: idx_org_invite_links_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invite_links_creator ON public.org_invite_links USING btree (created_by);


--
-- Name: idx_org_invite_links_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invite_links_email ON public.org_invite_links USING btree (org_id, lower(email)) WHERE (email IS NOT NULL);


--
-- Name: idx_org_invite_links_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invite_links_manager ON public.org_invite_links USING btree (manager_id);


--
-- Name: idx_org_invite_links_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_invite_links_org ON public.org_invite_links USING btree (org_id);


--
-- Name: idx_org_join_requests_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_join_requests_org_id ON public.organization_join_requests USING btree (org_id);


--
-- Name: idx_org_join_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_join_requests_user_id ON public.organization_join_requests USING btree (user_id);


--
-- Name: idx_org_member_permissions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_member_permissions_org ON public.org_member_permissions USING btree (org_id);


--
-- Name: idx_org_member_permissions_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_member_permissions_updated_by ON public.org_member_permissions USING btree (updated_by);


--
-- Name: idx_org_member_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_member_permissions_user_id ON public.org_member_permissions USING btree (user_id);


--
-- Name: idx_org_member_roles_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_member_roles_granted_by ON public.org_member_roles USING btree (granted_by);


--
-- Name: idx_org_member_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_member_roles_user_id ON public.org_member_roles USING btree (user_id);


--
-- Name: idx_org_members_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_manager ON public.organization_members USING btree (org_id, manager_id);


--
-- Name: idx_org_members_manager_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_manager_id ON public.organization_members USING btree (manager_id);


--
-- Name: idx_org_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_user_id ON public.organization_members USING btree (user_id);


--
-- Name: idx_org_notification_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notification_settings_user_id ON public.org_notification_settings USING btree (user_id);


--
-- Name: idx_org_notifications_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_actor ON public.org_notifications USING btree (actor_id);


--
-- Name: idx_org_notifications_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_event_id ON public.org_notifications USING btree (event_id);


--
-- Name: idx_org_notifications_kr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_kr_id ON public.org_notifications USING btree (kr_id);


--
-- Name: idx_org_notifications_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_org ON public.org_notifications USING btree (org_id);


--
-- Name: idx_org_notifications_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_project_id ON public.org_notifications USING btree (project_id);


--
-- Name: idx_org_notifications_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_task ON public.org_notifications USING btree (task_id);


--
-- Name: idx_org_notifications_unemailed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_unemailed ON public.org_notifications USING btree (created_at) WHERE ((emailed_at IS NULL) AND (read_at IS NULL));


--
-- Name: idx_org_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_unread ON public.org_notifications USING btree (user_id) WHERE (read_at IS NULL);


--
-- Name: idx_org_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_notifications_user ON public.org_notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_org_roles_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_roles_created_by ON public.org_roles USING btree (created_by);


--
-- Name: idx_org_saved_views_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_saved_views_owner ON public.org_saved_views USING btree (user_id, org_id, scope);


--
-- Name: idx_org_settings_default_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_settings_default_role_id ON public.org_settings USING btree (default_role_id);


--
-- Name: idx_org_settings_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_settings_updated_by ON public.org_settings USING btree (updated_by);


--
-- Name: idx_org_team_members_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_team_members_added_by ON public.org_team_members USING btree (added_by);


--
-- Name: idx_org_team_members_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_team_members_lead ON public.org_team_members USING btree (team_id) WHERE is_lead;


--
-- Name: idx_org_team_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_team_members_org ON public.org_team_members USING btree (org_id);


--
-- Name: idx_org_team_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_team_members_user ON public.org_team_members USING btree (user_id);


--
-- Name: idx_org_teams_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_teams_created_by ON public.org_teams USING btree (created_by);


--
-- Name: idx_org_teams_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_teams_org ON public.org_teams USING btree (org_id);


--
-- Name: idx_org_verified_domains_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_verified_domains_created_by ON public.org_verified_domains USING btree (created_by);


--
-- Name: idx_org_webhook_deliveries_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_webhook_deliveries_org_id ON public.org_webhook_deliveries USING btree (org_id);


--
-- Name: idx_org_webhook_deliveries_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_webhook_deliveries_pending ON public.org_webhook_deliveries USING btree (created_at) WHERE ((delivered_at IS NULL) AND (attempts < 5));


--
-- Name: idx_org_webhook_deliveries_webhook_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_webhook_deliveries_webhook_id ON public.org_webhook_deliveries USING btree (webhook_id);


--
-- Name: idx_org_webhooks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_webhooks_created_by ON public.org_webhooks USING btree (created_by);


--
-- Name: idx_org_webhooks_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_webhooks_org ON public.org_webhooks USING btree (org_id) WHERE enabled;


--
-- Name: idx_org_weekly_reviews_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_weekly_reviews_created_by ON public.org_weekly_reviews USING btree (created_by);


--
-- Name: idx_org_weekly_reviews_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_weekly_reviews_org ON public.org_weekly_reviews USING btree (org_id, created_at DESC);


--
-- Name: idx_org_withdrawals_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_withdrawals_org_id ON public.org_withdrawals USING btree (org_id);


--
-- Name: idx_organizations_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organizations_owner_id ON public.organizations USING btree (owner_id);


--
-- Name: idx_payment_records_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_records_occurred_at ON public.payment_records USING btree (occurred_at DESC);


--
-- Name: idx_payment_records_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_records_org ON public.payment_records USING btree (org_id) WHERE (org_id IS NOT NULL);


--
-- Name: idx_profiles_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_affiliate ON public.profiles USING btree (affiliate_id) WHERE (affiliate_id IS NOT NULL);


--
-- Name: idx_rate_limits_stale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_stale ON public.rate_limits USING btree (updated_at);


--
-- Name: idx_share_links_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_links_owner_id ON public.share_links USING btree (owner_id);


--
-- Name: idx_share_links_task_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_share_links_task_owner ON public.share_links USING btree (task_id, owner_id);


--
-- Name: idx_shared_lists_friend_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_lists_friend_id ON public.shared_lists USING btree (friend_id);


--
-- Name: idx_shared_lists_shared_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_lists_shared_by ON public.shared_lists USING btree (shared_by);


--
-- Name: idx_shared_tasks_friend_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_tasks_friend_task ON public.shared_tasks USING btree (friend_id, task_id);


--
-- Name: idx_shared_tasks_shared_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_tasks_shared_by ON public.shared_tasks USING btree (shared_by);


--
-- Name: idx_shared_tasks_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shared_tasks_task_id ON public.shared_tasks USING btree (task_id);


--
-- Name: idx_subscriptions_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_support_reports_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_reports_received_at ON public.support_reports USING btree (received_at DESC);


--
-- Name: idx_task_dependencies_depends_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_dependencies_depends_on ON public.task_dependencies USING btree (depends_on_id);


--
-- Name: idx_task_dependencies_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_dependencies_user ON public.task_dependencies USING btree (user_id);


--
-- Name: idx_tasks_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_category ON public.tasks USING btree (category);


--
-- Name: idx_tasks_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_completed ON public.tasks USING btree (completed);


--
-- Name: idx_tasks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_created_at ON public.tasks USING btree (created_at DESC);


--
-- Name: idx_tasks_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_deadline ON public.tasks USING btree (deadline);


--
-- Name: idx_tasks_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user_created ON public.tasks USING btree (user_id, created_at DESC);


--
-- Name: idx_tasks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);


--
-- Name: idx_team_automations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_automations_created_by ON public.team_automations USING btree (created_by);


--
-- Name: idx_team_automations_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_automations_org ON public.team_automations USING btree (org_id) WHERE enabled;


--
-- Name: idx_team_automations_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_automations_project_id ON public.team_automations USING btree (project_id);


--
-- Name: idx_team_categories_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_categories_created_by ON public.team_categories USING btree (created_by);


--
-- Name: idx_team_categories_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_categories_org ON public.team_categories USING btree (org_id);


--
-- Name: idx_team_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_categories_parent ON public.team_categories USING btree (org_id, parent_id);


--
-- Name: idx_team_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_categories_parent_id ON public.team_categories USING btree (parent_id);


--
-- Name: idx_team_kr_checkins_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_kr_checkins_author_id ON public.team_kr_checkins USING btree (author_id);


--
-- Name: idx_team_kr_checkins_kr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_kr_checkins_kr ON public.team_kr_checkins USING btree (kr_id, created_at DESC);


--
-- Name: idx_team_kr_checkins_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_kr_checkins_org ON public.team_kr_checkins USING btree (org_id);


--
-- Name: idx_team_kr_projects_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_kr_projects_added_by ON public.team_kr_projects USING btree (added_by);


--
-- Name: idx_team_kr_projects_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_kr_projects_org ON public.team_kr_projects USING btree (org_id);


--
-- Name: idx_team_kr_projects_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_kr_projects_project ON public.team_kr_projects USING btree (project_id);


--
-- Name: idx_team_krs_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_krs_assignee ON public.team_key_results USING btree (assignee_id);


--
-- Name: idx_team_krs_okr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_krs_okr ON public.team_key_results USING btree (okr_id);


--
-- Name: idx_team_krs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_krs_org ON public.team_key_results USING btree (org_id);


--
-- Name: idx_team_labels_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_labels_created_by ON public.team_labels USING btree (created_by);


--
-- Name: idx_team_list_tasks_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_list_tasks_task ON public.team_list_tasks USING btree (task_id);


--
-- Name: idx_team_lists_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_lists_created_by ON public.team_lists USING btree (created_by);


--
-- Name: idx_team_lists_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_lists_org ON public.team_lists USING btree (org_id, "position");


--
-- Name: idx_team_okr_members_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_members_added_by ON public.team_okr_members USING btree (added_by);


--
-- Name: idx_team_okr_members_okr_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_members_okr_org ON public.team_okr_members USING btree (okr_id, org_id);


--
-- Name: idx_team_okr_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_members_org ON public.team_okr_members USING btree (org_id);


--
-- Name: idx_team_okr_members_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_members_org_user ON public.team_okr_members USING btree (org_id, user_id);


--
-- Name: idx_team_okr_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_members_user ON public.team_okr_members USING btree (user_id);


--
-- Name: idx_team_okr_teams_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_teams_added_by ON public.team_okr_teams USING btree (added_by);


--
-- Name: idx_team_okr_teams_okr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_teams_okr ON public.team_okr_teams USING btree (okr_id);


--
-- Name: idx_team_okr_teams_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_teams_org ON public.team_okr_teams USING btree (org_id);


--
-- Name: idx_team_okr_teams_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okr_teams_team ON public.team_okr_teams USING btree (team_id);


--
-- Name: idx_team_okrs_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okrs_category ON public.team_okrs USING btree (category_id);


--
-- Name: idx_team_okrs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okrs_created_by ON public.team_okrs USING btree (created_by);


--
-- Name: idx_team_okrs_deleted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okrs_deleted_by ON public.team_okrs USING btree (deleted_by);


--
-- Name: idx_team_okrs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okrs_org ON public.team_okrs USING btree (org_id);


--
-- Name: idx_team_okrs_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okrs_parent ON public.team_okrs USING btree (parent_okr_id) WHERE (parent_okr_id IS NOT NULL);


--
-- Name: idx_team_okrs_trash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_okrs_trash ON public.team_okrs USING btree (org_id, deleted_at DESC) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_team_project_dependencies_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_dependencies_created_by ON public.team_project_dependencies USING btree (created_by);


--
-- Name: idx_team_project_deps_depends_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_deps_depends_on ON public.team_project_dependencies USING btree (depends_on_id);


--
-- Name: idx_team_project_deps_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_deps_org ON public.team_project_dependencies USING btree (org_id);


--
-- Name: idx_team_project_followers_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_followers_org_id ON public.team_project_followers USING btree (org_id);


--
-- Name: idx_team_project_followers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_followers_user ON public.team_project_followers USING btree (user_id, org_id);


--
-- Name: idx_team_project_members_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_members_added_by ON public.team_project_members USING btree (added_by);


--
-- Name: idx_team_project_members_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_members_org ON public.team_project_members USING btree (org_id);


--
-- Name: idx_team_project_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_members_user ON public.team_project_members USING btree (user_id, org_id);


--
-- Name: idx_team_project_messages_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_messages_author ON public.team_project_messages USING btree (author_id);


--
-- Name: idx_team_project_messages_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_messages_org_id ON public.team_project_messages USING btree (org_id);


--
-- Name: idx_team_project_messages_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_messages_project ON public.team_project_messages USING btree (project_id, created_at);


--
-- Name: idx_team_project_statuses_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_statuses_org_id ON public.team_project_statuses USING btree (org_id);


--
-- Name: idx_team_project_teams_added_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_teams_added_by ON public.team_project_teams USING btree (added_by);


--
-- Name: idx_team_project_teams_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_teams_org ON public.team_project_teams USING btree (org_id);


--
-- Name: idx_team_project_teams_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_project_teams_team ON public.team_project_teams USING btree (team_id);


--
-- Name: idx_team_projects_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_projects_category ON public.team_projects USING btree (category_id);


--
-- Name: idx_team_projects_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_projects_created_by ON public.team_projects USING btree (created_by);


--
-- Name: idx_team_projects_health_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_projects_health_updated_by ON public.team_projects USING btree (health_updated_by);


--
-- Name: idx_team_projects_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_projects_org ON public.team_projects USING btree (org_id);


--
-- Name: idx_team_projects_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_projects_owner ON public.team_projects USING btree (owner_id) WHERE (owner_id IS NOT NULL);


--
-- Name: idx_team_projects_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_projects_team ON public.team_projects USING btree (team_id);


--
-- Name: idx_team_task_activity_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_activity_actor ON public.team_task_activity USING btree (actor_id);


--
-- Name: idx_team_task_activity_actor_org_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_activity_actor_org_recent ON public.team_task_activity USING btree (actor_id, org_id, created_at DESC);


--
-- Name: idx_team_task_activity_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_activity_org ON public.team_task_activity USING btree (org_id, created_at DESC);


--
-- Name: idx_team_task_activity_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_activity_task ON public.team_task_activity USING btree (task_id, created_at DESC);


--
-- Name: idx_team_task_comments_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_comments_author ON public.team_task_comments USING btree (author_id);


--
-- Name: idx_team_task_comments_author_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_comments_author_recent ON public.team_task_comments USING btree (author_id, created_at DESC);


--
-- Name: idx_team_task_comments_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_comments_task ON public.team_task_comments USING btree (task_id, created_at);


--
-- Name: idx_team_task_dependencies_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_dependencies_created_by ON public.team_task_dependencies USING btree (created_by);


--
-- Name: idx_team_task_deps_depends_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_deps_depends_on ON public.team_task_dependencies USING btree (depends_on_id);


--
-- Name: idx_team_task_deps_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_deps_org ON public.team_task_dependencies USING btree (org_id);


--
-- Name: idx_team_task_followers_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_followers_org_id ON public.team_task_followers USING btree (org_id);


--
-- Name: idx_team_task_followers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_followers_user ON public.team_task_followers USING btree (user_id, org_id);


--
-- Name: idx_team_task_labels_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_labels_label ON public.team_task_labels USING btree (label_id);


--
-- Name: idx_team_task_subtasks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_subtasks_created_by ON public.team_task_subtasks USING btree (created_by);


--
-- Name: idx_team_task_subtasks_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_task_subtasks_task ON public.team_task_subtasks USING btree (task_id, "position");


--
-- Name: idx_team_tasks_assignees; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_assignees ON public.team_tasks USING gin (assignee_ids);


--
-- Name: idx_team_tasks_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_category ON public.team_tasks USING btree (category_id);


--
-- Name: idx_team_tasks_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_created_by ON public.team_tasks USING btree (created_by);


--
-- Name: idx_team_tasks_custom_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_custom_status ON public.team_tasks USING btree (custom_status_id) WHERE (custom_status_id IS NOT NULL);


--
-- Name: idx_team_tasks_deleted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_deleted_by ON public.team_tasks USING btree (deleted_by);


--
-- Name: idx_team_tasks_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_org ON public.team_tasks USING btree (org_id);


--
-- Name: idx_team_tasks_org_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_org_completed_at ON public.team_tasks USING btree (org_id, completed_at) WHERE completed;


--
-- Name: idx_team_tasks_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_org_status ON public.team_tasks USING btree (org_id, status);


--
-- Name: idx_team_tasks_org_validator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_org_validator ON public.team_tasks USING btree (org_id, validator_id) WHERE (validator_id IS NOT NULL);


--
-- Name: idx_team_tasks_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_project ON public.team_tasks USING btree (project_id);


--
-- Name: idx_team_tasks_trash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_trash ON public.team_tasks USING btree (org_id, deleted_at DESC) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_team_tasks_validator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_tasks_validator_id ON public.team_tasks USING btree (validator_id);


--
-- Name: idx_traffic_hits_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_traffic_hits_time ON public.traffic_hits USING btree (occurred_at DESC);


--
-- Name: idx_traffic_hits_visitor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_traffic_hits_visitor ON public.traffic_hits USING btree (visitor, occurred_at);


--
-- Name: idx_withdrawal_consents_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_consents_org ON public.withdrawal_consents USING btree (org_id, consented_at DESC);


--
-- Name: org_member_roles_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_member_roles_expiry_idx ON public.org_member_roles USING btree (ends_at) WHERE ((expiry_notified_at IS NULL) AND (ends_at IS NOT NULL));


--
-- Name: org_member_roles_org_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_member_roles_org_user_idx ON public.org_member_roles USING btree (org_id, user_id);


--
-- Name: org_roles_org_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX org_roles_org_name_uidx ON public.org_roles USING btree (org_id, lower(btrim(name)));


--
-- Name: org_withdrawals_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_withdrawals_pending_idx ON public.org_withdrawals USING btree (withdrawn_at) WHERE (refunded_at IS NULL);


--
-- Name: profiles_email_lower_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_email_lower_key ON public.profiles USING btree (lower(email));


--
-- Name: uniq_pending_friend_request; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_pending_friend_request ON public.friend_requests USING btree (sender_id, lower(email)) WHERE (status = 'pending'::text);


--
-- Name: ux_categories_root_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_categories_root_name ON public.categories USING btree (user_id, name) WHERE (parent_id IS NULL);


--
-- Name: ux_categories_sibling_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_categories_sibling_name ON public.categories USING btree (user_id, parent_id, name) WHERE (parent_id IS NOT NULL);


--
-- Name: ux_org_activity_reports_org_day; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_org_activity_reports_org_day ON public.org_activity_reports USING btree (org_id, day) WHERE (scope = 'org'::text);


--
-- Name: ux_org_activity_reports_team_day; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_org_activity_reports_team_day ON public.org_activity_reports USING btree (team_id, day) WHERE (scope = 'team'::text);


--
-- Name: ux_org_notifications_daily_overdue; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_org_notifications_daily_overdue ON public.org_notifications USING btree (task_id, user_id, (((created_at AT TIME ZONE 'UTC'::text))::date)) WHERE (kind = 'task_overdue'::text);


--
-- Name: ux_org_verified_domains_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_org_verified_domains_owner ON public.org_verified_domains USING btree (domain) WHERE (verified_at IS NOT NULL);


--
-- Name: ux_subscriptions_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


--
-- Name: INDEX ux_subscriptions_stripe_customer; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.ux_subscriptions_stripe_customer IS 'Un customer Stripe ne désigne qu''un seul compte. C''est ce qui rend sûr le maybeSingle() de getUidFromCustomer (stripe-webhook). Jumelle de la contrainte équivalente sur org_subscriptions (mig. 101).';


--
-- Name: ux_tasks_recurrence_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_tasks_recurrence_parent ON public.tasks USING btree (recurrence_parent_id) WHERE (recurrence_parent_id IS NOT NULL);


--
-- Name: ux_team_categories_root_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_team_categories_root_name ON public.team_categories USING btree (org_id, name) WHERE (parent_id IS NULL);


--
-- Name: ux_team_categories_sibling_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_team_categories_sibling_name ON public.team_categories USING btree (org_id, parent_id, name) WHERE (parent_id IS NOT NULL);


--
-- Name: ux_team_labels_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_team_labels_org_name ON public.team_labels USING btree (org_id, lower(TRIM(BOTH FROM name)));


--
-- Name: ux_team_project_statuses_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_team_project_statuses_name ON public.team_project_statuses USING btree (project_id, lower(btrim(name)));


--
-- Name: affiliate_contacts trg_affiliate_contacts_user_id_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_affiliate_contacts_user_id_immutable BEFORE UPDATE ON public.affiliate_contacts FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: team_tasks trg_apply_team_task_custom_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apply_team_task_custom_status BEFORE INSERT OR UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.apply_team_task_custom_status();


--
-- Name: organization_members trg_assign_default_org_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_default_org_role AFTER INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.assign_default_org_role();


--
-- Name: org_member_permissions trg_audit_org_member_permissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_org_member_permissions AFTER INSERT OR DELETE OR UPDATE ON public.org_member_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: org_member_roles trg_audit_org_member_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_org_member_roles AFTER INSERT OR DELETE OR UPDATE ON public.org_member_roles FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: organization_members trg_audit_org_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_org_members AFTER INSERT OR DELETE OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: org_roles trg_audit_org_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_org_roles AFTER INSERT OR DELETE OR UPDATE ON public.org_roles FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: org_team_members trg_audit_org_team_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_org_team_members AFTER INSERT OR DELETE OR UPDATE ON public.org_team_members FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: org_teams trg_audit_org_teams; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_org_teams AFTER INSERT OR DELETE OR UPDATE ON public.org_teams FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: organizations trg_audit_organizations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_organizations AFTER UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: team_okrs trg_audit_team_okr_trash; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_team_okr_trash AFTER DELETE OR UPDATE OF deleted_at ON public.team_okrs FOR EACH ROW EXECUTE FUNCTION public.audit_team_okr_trash();


--
-- Name: team_projects trg_audit_team_project_details; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_team_project_details AFTER UPDATE ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.audit_team_project_details();


--
-- Name: team_project_members trg_audit_team_project_members; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_team_project_members AFTER INSERT OR DELETE OR UPDATE ON public.team_project_members FOR EACH ROW EXECUTE FUNCTION public.audit_team_project_members();


--
-- Name: team_projects trg_audit_team_projects; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_team_projects AFTER INSERT OR DELETE OR UPDATE ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.audit_org_change();


--
-- Name: team_tasks trg_audit_team_task_trash; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_team_task_trash AFTER DELETE OR UPDATE OF deleted_at ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.audit_team_task_trash();


--
-- Name: billing_acceptances trg_billing_acceptances_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_acceptances_append_only BEFORE DELETE OR UPDATE ON public.billing_acceptances FOR EACH ROW EXECUTE FUNCTION public.billing_acceptances_append_only();


--
-- Name: billing_acceptances trg_billing_acceptances_user_id_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_billing_acceptances_user_id_immutable BEFORE UPDATE ON public.billing_acceptances FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: org_notifications trg_drop_muted_org_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_drop_muted_org_notification BEFORE INSERT ON public.org_notifications FOR EACH ROW EXECUTE FUNCTION public.drop_muted_org_notification();


--
-- Name: categories trg_enforce_category_tree; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_category_tree BEFORE INSERT OR UPDATE OF parent_id ON public.categories FOR EACH ROW EXECUTE FUNCTION public.enforce_category_tree();


--
-- Name: org_invite_links trg_enforce_org_invite_domain; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_org_invite_domain BEFORE INSERT ON public.org_invite_links FOR EACH ROW EXECUTE FUNCTION public.enforce_org_invite_domain();


--
-- Name: org_member_roles trg_enforce_org_member_role_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_org_member_role_write BEFORE INSERT OR UPDATE ON public.org_member_roles FOR EACH ROW EXECUTE FUNCTION public.enforce_org_member_role_write();


--
-- Name: org_member_permissions trg_enforce_org_permission_ceiling; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_org_permission_ceiling BEFORE INSERT OR UPDATE ON public.org_member_permissions FOR EACH ROW EXECUTE FUNCTION public.enforce_org_permission_ceiling();


--
-- Name: org_roles trg_enforce_org_role_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_org_role_write BEFORE INSERT OR UPDATE ON public.org_roles FOR EACH ROW EXECUTE FUNCTION public.enforce_org_role_write();


--
-- Name: org_settings trg_enforce_org_settings_default_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_org_settings_default_role BEFORE INSERT OR UPDATE OF default_role_id ON public.org_settings FOR EACH ROW EXECUTE FUNCTION public.enforce_org_settings_default_role();


--
-- Name: profiles trg_enforce_profile_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_profile_integrity BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_integrity();


--
-- Name: team_categories trg_enforce_team_category_tree; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_team_category_tree BEFORE INSERT OR UPDATE OF parent_id ON public.team_categories FOR EACH ROW EXECUTE FUNCTION public.enforce_team_category_tree();


--
-- Name: team_projects trg_enforce_team_project_archive_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_team_project_archive_scope BEFORE UPDATE ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.enforce_team_project_archive_scope();


--
-- Name: team_projects trg_enforce_team_project_edit_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_team_project_edit_scope BEFORE INSERT OR UPDATE ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.enforce_team_project_edit_scope();


--
-- Name: team_tasks trg_enforce_team_task_assign_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_team_task_assign_scope BEFORE INSERT OR UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_team_task_assign_scope();


--
-- Name: team_tasks trg_enforce_team_task_project_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_team_task_project_role BEFORE INSERT OR UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_team_task_project_role();


--
-- Name: events trg_events_enforce_created_by; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_events_enforce_created_by BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.events_enforce_created_by();


--
-- Name: team_tasks trg_f_team_task_automations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_f_team_task_automations BEFORE INSERT OR UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.run_team_task_automations();


--
-- Name: payment_closures trg_forbid_closure_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forbid_closure_mutation BEFORE DELETE OR UPDATE ON public.payment_closures FOR EACH ROW EXECUTE FUNCTION public.forbid_payment_mutation();


--
-- Name: withdrawal_consents trg_forbid_consent_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forbid_consent_mutation BEFORE DELETE OR UPDATE ON public.withdrawal_consents FOR EACH ROW EXECUTE FUNCTION public.forbid_consent_mutation();


--
-- Name: payment_records trg_forbid_payment_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forbid_payment_mutation BEFORE DELETE OR UPDATE ON public.payment_records FOR EACH ROW EXECUTE FUNCTION public.forbid_payment_mutation();


--
-- Name: org_team_members trg_freeze_team_membership_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freeze_team_membership_identity BEFORE UPDATE ON public.org_team_members FOR EACH ROW EXECUTE FUNCTION public.freeze_team_membership_identity();


--
-- Name: habits trg_habit_completions_mirror; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_habit_completions_mirror AFTER INSERT OR UPDATE OF completions ON public.habits FOR EACH ROW EXECUTE FUNCTION public.habit_completions_mirror();


--
-- Name: habit_completions trg_habit_completions_user_id_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_habit_completions_user_id_immutable BEFORE UPDATE ON public.habit_completions FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: team_tasks trg_init_team_task_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_init_team_task_status BEFORE INSERT ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.init_team_task_status();


--
-- Name: key_results trg_key_result_completed_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_key_result_completed_at BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.set_key_result_completed_at();


--
-- Name: team_tasks trg_log_team_task_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_team_task_activity AFTER UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.log_team_task_activity();


--
-- Name: team_tasks trg_log_team_task_creation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_team_task_creation AFTER INSERT ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.log_team_task_creation();


--
-- Name: team_task_comments trg_notify_comment_mention; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_comment_mention AFTER INSERT ON public.team_task_comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mention();


--
-- Name: events trg_notify_event_scheduled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_event_scheduled AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION public.notify_event_scheduled();


--
-- Name: organization_members trg_notify_member_position_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_member_position_change AFTER UPDATE OF manager_id ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.notify_member_position_change();


--
-- Name: team_projects trg_notify_project_at_risk; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_project_at_risk AFTER UPDATE OF health ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.notify_project_at_risk();


--
-- Name: team_tasks trg_notify_task_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_task_assignment AFTER UPDATE OF assignee_ids ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();


--
-- Name: team_task_comments trg_notify_task_comment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_task_comment AFTER INSERT ON public.team_task_comments FOR EACH ROW EXECUTE FUNCTION public.notify_task_comment();


--
-- Name: team_projects trg_notify_team_project_archived; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_team_project_archived AFTER UPDATE OF archived_at ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.notify_team_project_archived();


--
-- Name: team_tasks trg_notify_team_task_automations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_team_task_automations AFTER INSERT OR UPDATE OF status ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.notify_team_task_automations();


--
-- Name: team_tasks trg_notify_team_task_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_team_task_status AFTER UPDATE OF status ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.notify_team_task_status();


--
-- Name: org_saved_views trg_org_saved_view_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_saved_view_before_write BEFORE INSERT OR UPDATE ON public.org_saved_views FOR EACH ROW EXECUTE FUNCTION public.org_saved_view_before_write();


--
-- Name: org_settings trg_org_settings_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_settings_before_write BEFORE INSERT OR UPDATE ON public.org_settings FOR EACH ROW EXECUTE FUNCTION public.org_settings_before_write();


--
-- Name: org_subscriptions trg_org_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_subscriptions_updated_at BEFORE UPDATE ON public.org_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: org_teams trg_org_team_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_team_before_update BEFORE UPDATE ON public.org_teams FOR EACH ROW EXECUTE FUNCTION public.org_team_before_update();


--
-- Name: org_verified_domains trg_org_verified_domain_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_verified_domain_before_insert BEFORE INSERT ON public.org_verified_domains FOR EACH ROW EXECUTE FUNCTION public.org_verified_domain_before_insert();


--
-- Name: org_webhooks trg_org_webhook_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_webhook_before_write BEFORE INSERT OR UPDATE ON public.org_webhooks FOR EACH ROW EXECUTE FUNCTION public.org_webhook_before_write();


--
-- Name: org_withdrawals trg_org_withdrawals_user_id_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_withdrawals_user_id_immutable BEFORE UPDATE ON public.org_withdrawals FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: payment_records trg_payment_records_affiliate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payment_records_affiliate AFTER INSERT ON public.payment_records FOR EACH ROW EXECUTE FUNCTION public.payment_records_affiliate();


--
-- Name: organizations trg_prevent_org_immutables; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_org_immutables BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.prevent_org_immutables();


--
-- Name: task_dependencies trg_prevent_task_dependency_cycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_task_dependency_cycle BEFORE INSERT OR UPDATE ON public.task_dependencies FOR EACH ROW EXECUTE FUNCTION public.prevent_task_dependency_cycle();


--
-- Name: team_task_dependencies trg_prevent_team_task_dependency_cycle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_team_task_dependency_cycle BEFORE INSERT OR UPDATE ON public.team_task_dependencies FOR EACH ROW EXECUTE FUNCTION public.prevent_team_task_dependency_cycle();


--
-- Name: categories trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: events trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: habits trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: key_results trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: kr_completions trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.kr_completions FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: lists trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: okrs trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: subscriptions trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: tasks trg_prevent_user_id_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_prevent_user_id_change BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();


--
-- Name: profiles trg_profiles_affiliation_frozen; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_affiliation_frozen BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_affiliation_frozen();


--
-- Name: organization_members trg_purge_project_memberships_on_leave; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_purge_project_memberships_on_leave AFTER DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.purge_project_memberships_on_leave();


--
-- Name: payment_records trg_seal_payment_record; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_seal_payment_record BEFORE INSERT ON public.payment_records FOR EACH ROW EXECUTE FUNCTION public.seal_payment_record();


--
-- Name: friend_requests trg_set_receiver_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_receiver_id BEFORE INSERT OR UPDATE OF email ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.set_friend_request_receiver_id();


--
-- Name: friend_requests trg_set_sender_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_sender_email BEFORE INSERT OR UPDATE OF sender_id ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.set_friend_request_sender_email();


--
-- Name: team_tasks trg_sync_team_task_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_team_task_status BEFORE UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.sync_team_task_status();


--
-- Name: tasks trg_tasks_status_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tasks_status_sync BEFORE INSERT OR UPDATE OF completed, status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.sync_task_status();


--
-- Name: tasks trg_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_tasks_updated_at();


--
-- Name: team_automations trg_team_automation_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_automation_before_write BEFORE INSERT OR UPDATE ON public.team_automations FOR EACH ROW EXECUTE FUNCTION public.team_automation_before_write();


--
-- Name: team_okrs trg_team_okr_trash_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_okr_trash_guard BEFORE UPDATE ON public.team_okrs FOR EACH ROW EXECUTE FUNCTION public.team_okr_trash_guard();


--
-- Name: team_project_dependencies trg_team_project_dependency_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_project_dependency_before_insert BEFORE INSERT ON public.team_project_dependencies FOR EACH ROW EXECUTE FUNCTION public.team_project_dependency_before_insert();


--
-- Name: team_projects trg_team_project_health_stamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_project_health_stamp BEFORE INSERT OR UPDATE ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.team_project_health_stamp();


--
-- Name: team_project_members trg_team_project_member_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_project_member_before_write BEFORE INSERT OR UPDATE ON public.team_project_members FOR EACH ROW EXECUTE FUNCTION public.team_project_member_before_write();


--
-- Name: team_project_statuses trg_team_project_status_before_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_project_status_before_write BEFORE INSERT OR UPDATE ON public.team_project_statuses FOR EACH ROW EXECUTE FUNCTION public.team_project_status_before_write();


--
-- Name: team_tasks trg_team_task_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_task_before_update BEFORE UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.team_task_before_update();


--
-- Name: team_tasks trg_team_task_validation_gate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_task_validation_gate BEFORE INSERT OR UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.team_task_validation_gate();


--
-- Name: team_tasks trg_team_task_webhook_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_team_task_webhook_events AFTER INSERT OR UPDATE OF status ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.team_task_webhook_events();


--
-- Name: organization_members trg_validate_org_manager; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_org_manager BEFORE INSERT OR UPDATE OF manager_id ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.validate_org_manager();


--
-- Name: team_projects trg_validate_project_team; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_project_team BEFORE INSERT OR UPDATE ON public.team_projects FOR EACH ROW EXECUTE FUNCTION public.validate_project_team();


--
-- Name: task_dependencies trg_validate_task_dependency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_task_dependency BEFORE INSERT OR UPDATE ON public.task_dependencies FOR EACH ROW EXECUTE FUNCTION public.validate_task_dependency();


--
-- Name: team_key_results trg_validate_team_kr; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_kr BEFORE INSERT OR UPDATE ON public.team_key_results FOR EACH ROW EXECUTE FUNCTION public.validate_team_kr();


--
-- Name: team_key_results trg_validate_team_kr_contributors; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_kr_contributors BEFORE INSERT OR UPDATE OF contributor_ids ON public.team_key_results FOR EACH ROW EXECUTE FUNCTION public.validate_team_kr_contributors();


--
-- Name: team_kr_projects trg_validate_team_kr_project; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_kr_project BEFORE INSERT ON public.team_kr_projects FOR EACH ROW EXECUTE FUNCTION public.validate_team_kr_project();


--
-- Name: org_team_members trg_validate_team_membership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_membership BEFORE INSERT OR UPDATE ON public.org_team_members FOR EACH ROW EXECUTE FUNCTION public.validate_team_membership();


--
-- Name: team_okrs trg_validate_team_okr_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_okr_parent BEFORE INSERT OR UPDATE OF parent_okr_id ON public.team_okrs FOR EACH ROW EXECUTE FUNCTION public.validate_team_okr_parent();


--
-- Name: team_okr_teams trg_validate_team_okr_team; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_okr_team BEFORE INSERT OR UPDATE ON public.team_okr_teams FOR EACH ROW EXECUTE FUNCTION public.validate_team_okr_team();


--
-- Name: team_tasks trg_validate_team_task; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_task BEFORE INSERT OR UPDATE ON public.team_tasks FOR EACH ROW EXECUTE FUNCTION public.validate_team_task();


--
-- Name: team_task_dependencies trg_validate_team_task_dependency; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_team_task_dependency BEFORE INSERT OR UPDATE ON public.team_task_dependencies FOR EACH ROW EXECUTE FUNCTION public.validate_team_task_dependency();


--
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: habits update_habits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: key_results update_key_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_key_results_updated_at BEFORE UPDATE ON public.key_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lists update_lists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON public.lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: okrs update_okrs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_okrs_updated_at BEFORE UPDATE ON public.okrs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_inactivity_notices account_inactivity_notices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_inactivity_notices
    ADD CONSTRAINT account_inactivity_notices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: affiliate_clicks affiliate_clicks_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_slug_fkey FOREIGN KEY (slug) REFERENCES public.affiliate_links(slug) ON DELETE CASCADE;


--
-- Name: affiliate_commissions affiliate_commissions_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id);


--
-- Name: affiliate_commissions affiliate_commissions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: affiliate_commissions affiliate_commissions_payment_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_payment_record_id_fkey FOREIGN KEY (payment_record_id) REFERENCES public.payment_records(id);


--
-- Name: affiliate_contacts affiliate_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_contacts
    ADD CONSTRAINT affiliate_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: affiliate_links affiliate_links_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_links
    ADD CONSTRAINT affiliate_links_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;


--
-- Name: affiliate_payouts affiliate_payouts_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_payouts
    ADD CONSTRAINT affiliate_payouts_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id);


--
-- Name: billing_acceptances billing_acceptances_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_acceptances
    ADD CONSTRAINT billing_acceptances_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id);


--
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: demo_devices demo_devices_converted_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demo_devices
    ADD CONSTRAINT demo_devices_converted_user_id_fkey FOREIGN KEY (converted_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: email_lookup_quota email_lookup_quota_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_lookup_quota
    ADD CONSTRAINT email_lookup_quota_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: events events_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friends friends_friend_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_friend_user_id_fkey FOREIGN KEY (friend_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friends friends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: habit_completions habit_completions_habit_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_habit_fkey FOREIGN KEY (habit_id, user_id) REFERENCES public.habits(id, user_id) ON DELETE CASCADE;


--
-- Name: habit_completions habit_completions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: habits habits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: key_results key_results_okr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_results
    ADD CONSTRAINT key_results_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES public.okrs(id) ON DELETE CASCADE;


--
-- Name: key_results key_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.key_results
    ADD CONSTRAINT key_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: kr_completions kr_completions_kr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kr_completions
    ADD CONSTRAINT kr_completions_kr_id_fkey FOREIGN KEY (kr_id) REFERENCES public.key_results(id) ON DELETE CASCADE;


--
-- Name: kr_completions kr_completions_okr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kr_completions
    ADD CONSTRAINT kr_completions_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES public.okrs(id) ON DELETE CASCADE;


--
-- Name: kr_completions kr_completions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kr_completions
    ADD CONSTRAINT kr_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: lists lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lists
    ADD CONSTRAINT lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: okrs okrs_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.okrs
    ADD CONSTRAINT okrs_category_fkey FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: okrs okrs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.okrs
    ADD CONSTRAINT okrs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_activity_reports org_activity_reports_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_activity_reports
    ADD CONSTRAINT org_activity_reports_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_activity_reports org_activity_reports_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_activity_reports
    ADD CONSTRAINT org_activity_reports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.org_teams(id) ON DELETE CASCADE;


--
-- Name: org_audit_log org_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_audit_log
    ADD CONSTRAINT org_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_audit_log org_audit_log_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_audit_log
    ADD CONSTRAINT org_audit_log_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_audit_log org_audit_log_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_audit_log
    ADD CONSTRAINT org_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_billing_contacts org_billing_contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_billing_contacts
    ADD CONSTRAINT org_billing_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_billing_contacts org_billing_contacts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_billing_contacts
    ADD CONSTRAINT org_billing_contacts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_invitations org_invitations_invitee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_invitations org_invitations_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_invitations org_invitations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invitations
    ADD CONSTRAINT org_invitations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_invite_links org_invite_links_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invite_links
    ADD CONSTRAINT org_invite_links_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_invite_links org_invite_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invite_links
    ADD CONSTRAINT org_invite_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_invite_links org_invite_links_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invite_links
    ADD CONSTRAINT org_invite_links_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_invite_links org_invite_links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_invite_links
    ADD CONSTRAINT org_invite_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_member_permissions org_member_permissions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_permissions
    ADD CONSTRAINT org_member_permissions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_member_permissions org_member_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_permissions
    ADD CONSTRAINT org_member_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_member_permissions org_member_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_permissions
    ADD CONSTRAINT org_member_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_member_roles org_member_roles_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_roles
    ADD CONSTRAINT org_member_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_member_roles org_member_roles_member_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_roles
    ADD CONSTRAINT org_member_roles_member_fkey FOREIGN KEY (org_id, user_id) REFERENCES public.organization_members(org_id, user_id) ON DELETE CASCADE;


--
-- Name: org_member_roles org_member_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_roles
    ADD CONSTRAINT org_member_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.org_roles(id) ON DELETE CASCADE;


--
-- Name: org_member_roles org_member_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_member_roles
    ADD CONSTRAINT org_member_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_notification_settings org_notification_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notification_settings
    ADD CONSTRAINT org_notification_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_notification_settings org_notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notification_settings
    ADD CONSTRAINT org_notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_notifications org_notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_notifications org_notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: org_notifications org_notifications_kr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_kr_id_fkey FOREIGN KEY (kr_id) REFERENCES public.team_key_results(id) ON DELETE CASCADE;


--
-- Name: org_notifications org_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_notifications org_notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: org_notifications org_notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: org_notifications org_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_notifications
    ADD CONSTRAINT org_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_roles org_roles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT org_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_roles org_roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_roles
    ADD CONSTRAINT org_roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_saved_views org_saved_views_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_saved_views
    ADD CONSTRAINT org_saved_views_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_saved_views org_saved_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_saved_views
    ADD CONSTRAINT org_saved_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_seat_alerts org_seat_alerts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_seat_alerts
    ADD CONSTRAINT org_seat_alerts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_settings org_settings_default_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_default_role_id_fkey FOREIGN KEY (default_role_id) REFERENCES public.org_roles(id) ON DELETE SET NULL;


--
-- Name: org_settings org_settings_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_settings org_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_subscriptions org_subscriptions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_subscriptions
    ADD CONSTRAINT org_subscriptions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_team_members org_team_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_team_members
    ADD CONSTRAINT org_team_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_team_members org_team_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_team_members
    ADD CONSTRAINT org_team_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_team_members org_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_team_members
    ADD CONSTRAINT org_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.org_teams(id) ON DELETE CASCADE;


--
-- Name: org_team_members org_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_team_members
    ADD CONSTRAINT org_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: org_teams org_teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_teams
    ADD CONSTRAINT org_teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_teams org_teams_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_teams
    ADD CONSTRAINT org_teams_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_verified_domains org_verified_domains_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_verified_domains
    ADD CONSTRAINT org_verified_domains_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_verified_domains org_verified_domains_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_verified_domains
    ADD CONSTRAINT org_verified_domains_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_webhook_deliveries org_webhook_deliveries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_webhook_deliveries
    ADD CONSTRAINT org_webhook_deliveries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_webhook_deliveries org_webhook_deliveries_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_webhook_deliveries
    ADD CONSTRAINT org_webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.org_webhooks(id) ON DELETE CASCADE;


--
-- Name: org_webhooks org_webhooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_webhooks
    ADD CONSTRAINT org_webhooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_webhooks org_webhooks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_webhooks
    ADD CONSTRAINT org_webhooks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_weekly_reviews org_weekly_reviews_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_weekly_reviews
    ADD CONSTRAINT org_weekly_reviews_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: org_weekly_reviews org_weekly_reviews_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_weekly_reviews
    ADD CONSTRAINT org_weekly_reviews_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: org_withdrawals org_withdrawals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_withdrawals
    ADD CONSTRAINT org_withdrawals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: organization_join_requests organization_join_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_join_requests
    ADD CONSTRAINT organization_join_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_join_requests organization_join_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_join_requests
    ADD CONSTRAINT organization_join_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: organization_members organization_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payment_records payment_records_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_records
    ADD CONSTRAINT payment_records_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_affiliate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_affiliate_id_fkey FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: renewal_notices renewal_notices_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.renewal_notices
    ADD CONSTRAINT renewal_notices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: share_links share_links_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: share_links share_links_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_links
    ADD CONSTRAINT share_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: shared_lists shared_lists_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_lists
    ADD CONSTRAINT shared_lists_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_lists shared_lists_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_lists
    ADD CONSTRAINT shared_lists_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_tasks shared_tasks_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_tasks shared_tasks_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shared_tasks shared_tasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_tasks
    ADD CONSTRAINT shared_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_depends_on_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_category_fkey FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_recurrence_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_recurrence_parent_id_fkey FOREIGN KEY (recurrence_parent_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_automations team_automations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_automations
    ADD CONSTRAINT team_automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_automations team_automations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_automations
    ADD CONSTRAINT team_automations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_automations team_automations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_automations
    ADD CONSTRAINT team_automations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_categories team_categories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_categories
    ADD CONSTRAINT team_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_categories team_categories_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_categories
    ADD CONSTRAINT team_categories_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_categories team_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_categories
    ADD CONSTRAINT team_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.team_categories(id);


--
-- Name: team_key_results team_key_results_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_key_results
    ADD CONSTRAINT team_key_results_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_key_results team_key_results_okr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_key_results
    ADD CONSTRAINT team_key_results_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES public.team_okrs(id) ON DELETE CASCADE;


--
-- Name: team_key_results team_key_results_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_key_results
    ADD CONSTRAINT team_key_results_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_kr_checkins team_kr_checkins_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_checkins
    ADD CONSTRAINT team_kr_checkins_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_kr_checkins team_kr_checkins_kr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_checkins
    ADD CONSTRAINT team_kr_checkins_kr_id_fkey FOREIGN KEY (kr_id) REFERENCES public.team_key_results(id) ON DELETE CASCADE;


--
-- Name: team_kr_checkins team_kr_checkins_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_checkins
    ADD CONSTRAINT team_kr_checkins_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_kr_projects team_kr_projects_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_projects
    ADD CONSTRAINT team_kr_projects_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_kr_projects team_kr_projects_kr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_projects
    ADD CONSTRAINT team_kr_projects_kr_id_fkey FOREIGN KEY (kr_id) REFERENCES public.team_key_results(id) ON DELETE CASCADE;


--
-- Name: team_kr_projects team_kr_projects_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_projects
    ADD CONSTRAINT team_kr_projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_kr_projects team_kr_projects_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_kr_projects
    ADD CONSTRAINT team_kr_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_labels team_labels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_labels
    ADD CONSTRAINT team_labels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_labels team_labels_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_labels
    ADD CONSTRAINT team_labels_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_list_tasks team_list_tasks_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_list_tasks
    ADD CONSTRAINT team_list_tasks_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.team_lists(id) ON DELETE CASCADE;


--
-- Name: team_list_tasks team_list_tasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_list_tasks
    ADD CONSTRAINT team_list_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_lists team_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lists
    ADD CONSTRAINT team_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_lists team_lists_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_lists
    ADD CONSTRAINT team_lists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_okr_members team_okr_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_members
    ADD CONSTRAINT team_okr_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_okr_members team_okr_members_member_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_members
    ADD CONSTRAINT team_okr_members_member_fkey FOREIGN KEY (org_id, user_id) REFERENCES public.organization_members(org_id, user_id) ON DELETE CASCADE;


--
-- Name: team_okr_members team_okr_members_okr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_members
    ADD CONSTRAINT team_okr_members_okr_fkey FOREIGN KEY (okr_id, org_id) REFERENCES public.team_okrs(id, org_id) ON DELETE CASCADE;


--
-- Name: team_okr_teams team_okr_teams_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_teams
    ADD CONSTRAINT team_okr_teams_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_okr_teams team_okr_teams_okr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_teams
    ADD CONSTRAINT team_okr_teams_okr_id_fkey FOREIGN KEY (okr_id) REFERENCES public.team_okrs(id) ON DELETE CASCADE;


--
-- Name: team_okr_teams team_okr_teams_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_teams
    ADD CONSTRAINT team_okr_teams_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_okr_teams team_okr_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okr_teams
    ADD CONSTRAINT team_okr_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.org_teams(id);


--
-- Name: team_okrs team_okrs_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.team_categories(id) ON DELETE SET NULL;


--
-- Name: team_okrs team_okrs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_okrs team_okrs_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_okrs team_okrs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_okrs team_okrs_parent_okr_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_okrs
    ADD CONSTRAINT team_okrs_parent_okr_id_fkey FOREIGN KEY (parent_okr_id) REFERENCES public.team_okrs(id) ON DELETE SET NULL;


--
-- Name: team_project_dependencies team_project_dependencies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_dependencies
    ADD CONSTRAINT team_project_dependencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_project_dependencies team_project_dependencies_depends_on_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_dependencies
    ADD CONSTRAINT team_project_dependencies_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_dependencies team_project_dependencies_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_dependencies
    ADD CONSTRAINT team_project_dependencies_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_project_dependencies team_project_dependencies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_dependencies
    ADD CONSTRAINT team_project_dependencies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_followers team_project_followers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_followers
    ADD CONSTRAINT team_project_followers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_project_followers team_project_followers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_followers
    ADD CONSTRAINT team_project_followers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_followers team_project_followers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_followers
    ADD CONSTRAINT team_project_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_project_members team_project_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_members
    ADD CONSTRAINT team_project_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_project_members team_project_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_members
    ADD CONSTRAINT team_project_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_project_members team_project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_members
    ADD CONSTRAINT team_project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_members team_project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_members
    ADD CONSTRAINT team_project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_project_messages team_project_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_messages
    ADD CONSTRAINT team_project_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_project_messages team_project_messages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_messages
    ADD CONSTRAINT team_project_messages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_project_messages team_project_messages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_messages
    ADD CONSTRAINT team_project_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_statuses team_project_statuses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_statuses
    ADD CONSTRAINT team_project_statuses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_project_statuses team_project_statuses_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_statuses
    ADD CONSTRAINT team_project_statuses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_teams team_project_teams_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_teams
    ADD CONSTRAINT team_project_teams_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_project_teams team_project_teams_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_teams
    ADD CONSTRAINT team_project_teams_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_project_teams team_project_teams_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_teams
    ADD CONSTRAINT team_project_teams_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_project_teams team_project_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_project_teams
    ADD CONSTRAINT team_project_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.org_teams(id) ON DELETE CASCADE;


--
-- Name: team_projects team_projects_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.team_categories(id) ON DELETE SET NULL;


--
-- Name: team_projects team_projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_projects team_projects_health_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_health_updated_by_fkey FOREIGN KEY (health_updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_projects team_projects_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_projects team_projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_projects team_projects_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_projects
    ADD CONSTRAINT team_projects_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.org_teams(id);


--
-- Name: team_task_activity team_task_activity_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_activity
    ADD CONSTRAINT team_task_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_task_activity team_task_activity_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_activity
    ADD CONSTRAINT team_task_activity_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_task_activity team_task_activity_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_activity
    ADD CONSTRAINT team_task_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_comments team_task_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_comments
    ADD CONSTRAINT team_task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_task_comments team_task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_comments
    ADD CONSTRAINT team_task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_dependencies team_task_dependencies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_dependencies
    ADD CONSTRAINT team_task_dependencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_task_dependencies team_task_dependencies_depends_on_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_dependencies
    ADD CONSTRAINT team_task_dependencies_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_dependencies team_task_dependencies_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_dependencies
    ADD CONSTRAINT team_task_dependencies_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_task_dependencies team_task_dependencies_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_dependencies
    ADD CONSTRAINT team_task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_followers team_task_followers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_followers
    ADD CONSTRAINT team_task_followers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_task_followers team_task_followers_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_followers
    ADD CONSTRAINT team_task_followers_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_followers team_task_followers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_followers
    ADD CONSTRAINT team_task_followers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: team_task_labels team_task_labels_label_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_labels
    ADD CONSTRAINT team_task_labels_label_id_fkey FOREIGN KEY (label_id) REFERENCES public.team_labels(id) ON DELETE CASCADE;


--
-- Name: team_task_labels team_task_labels_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_labels
    ADD CONSTRAINT team_task_labels_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_task_subtasks team_task_subtasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_subtasks
    ADD CONSTRAINT team_task_subtasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_task_subtasks team_task_subtasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_task_subtasks
    ADD CONSTRAINT team_task_subtasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.team_tasks(id) ON DELETE CASCADE;


--
-- Name: team_tasks team_tasks_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.team_categories(id) ON DELETE SET NULL;


--
-- Name: team_tasks team_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_tasks team_tasks_custom_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_custom_status_id_fkey FOREIGN KEY (custom_status_id) REFERENCES public.team_project_statuses(id) ON DELETE SET NULL;


--
-- Name: team_tasks team_tasks_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: team_tasks team_tasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: team_tasks team_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.team_projects(id) ON DELETE CASCADE;


--
-- Name: team_tasks team_tasks_validator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_tasks
    ADD CONSTRAINT team_tasks_validator_id_fkey FOREIGN KEY (validator_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_activity_days user_activity_days_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_days
    ADD CONSTRAINT user_activity_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: withdrawal_consents withdrawal_consents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawal_consents
    ADD CONSTRAINT withdrawal_consents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: processed_stripe_events No client access to processed_stripe_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client access to processed_stripe_events" ON public.processed_stripe_events USING (false) WITH CHECK (false);


--
-- Name: friend_requests Senders can create requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Senders can create requests" ON public.friend_requests FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = sender_id));


--
-- Name: categories Users can delete own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own categories" ON public.categories FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: events Users can delete own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own events" ON public.events FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: friends Users can delete own friends; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own friends" ON public.friends FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: habits Users can delete own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own habits" ON public.habits FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: key_results Users can delete own key_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own key_results" ON public.key_results FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: kr_completions Users can delete own kr_completions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own kr_completions" ON public.kr_completions FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: lists Users can delete own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own lists" ON public.lists FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: okrs Users can delete own okrs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own okrs" ON public.okrs FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: friend_requests Users can delete own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own requests" ON public.friend_requests FOR DELETE USING ((( SELECT auth.uid() AS uid) = sender_id));


--
-- Name: tasks Users can delete own tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: categories Users can insert own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own categories" ON public.categories FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: events Users can insert own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own events" ON public.events FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR ((NOT is_private) AND (user_id = ANY (public.my_managed_user_ids())))));


--
-- Name: friends Users can insert own friends via accepted request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own friends via accepted request" ON public.friends FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.friend_requests fr
  WHERE ((fr.status = 'accepted'::text) AND (((fr.sender_id = ( SELECT auth.uid() AS uid)) AND (fr.email = friends.email)) OR ((fr.receiver_id = ( SELECT auth.uid() AS uid)) AND (fr.sender_id = ( SELECT users.id
           FROM auth.users
          WHERE ((users.email)::text = friends.email))))))))));


--
-- Name: habits Users can insert own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own habits" ON public.habits FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: key_results Users can insert own key_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own key_results" ON public.key_results FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: kr_completions Users can insert own kr_completions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own kr_completions" ON public.kr_completions FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: lists Users can insert own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own lists" ON public.lists FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: okrs Users can insert own okrs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own okrs" ON public.okrs FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: subscriptions Users can insert own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (plan = 'free'::text) AND (current_period_end IS NULL) AND (stripe_customer_id IS NULL) AND (stripe_subscription_id IS NULL)));


--
-- Name: tasks Users can insert own tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: key_results Users can read own key_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own key_results" ON public.key_results FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: kr_completions Users can read own kr_completions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own kr_completions" ON public.kr_completions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: subscriptions Users can read own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own subscription" ON public.subscriptions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can read own, friends or org profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own, friends or org profiles" ON public.profiles FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = id) OR (EXISTS ( SELECT 1
   FROM public.friends f
  WHERE ((f.user_id = ( SELECT auth.uid() AS uid)) AND (lower(f.email) = lower(profiles.email))))) OR public.shares_org_with(id)));


--
-- Name: categories Users can update own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own categories" ON public.categories FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: events Users can update own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own events" ON public.events FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: habits Users can update own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own habits" ON public.habits FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: key_results Users can update own key_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own key_results" ON public.key_results FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: lists Users can update own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own lists" ON public.lists FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: okrs Users can update own okrs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own okrs" ON public.okrs FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: categories Users can view own categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own categories" ON public.categories FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: events Users can view own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own events" ON public.events FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR ((NOT is_private) AND (user_id = ANY (public.my_managed_user_ids())))));


--
-- Name: friends Users can view own friends; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own friends" ON public.friends FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: habits Users can view own habits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own habits" ON public.habits FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: lists Users can view own lists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own lists" ON public.lists FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: okrs Users can view own okrs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own okrs" ON public.okrs FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: account_inactivity_notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_inactivity_notices ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_acceptances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_acceptances ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_flags billing_flags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_flags_select ON public.billing_flags FOR SELECT TO authenticated USING (true);


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: cron_leases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_leases ENABLE ROW LEVEL SECURITY;

--
-- Name: cron_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: demo_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demo_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: email_lookup_global; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_lookup_global ENABLE ROW LEVEL SECURITY;

--
-- Name: email_lookup_quota; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_lookup_quota ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: friend_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: friend_requests friend_requests_select_sender_or_receiver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY friend_requests_select_sender_or_receiver ON public.friend_requests FOR SELECT USING (((( SELECT auth.uid() AS uid) = receiver_id) OR (( SELECT auth.uid() AS uid) = sender_id)));


--
-- Name: friend_requests friend_requests_update_sender_or_receiver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY friend_requests_update_sender_or_receiver ON public.friend_requests FOR UPDATE USING (((( SELECT auth.uid() AS uid) = receiver_id) OR (( SELECT auth.uid() AS uid) = sender_id))) WITH CHECK ((((( SELECT auth.uid() AS uid) = receiver_id) AND (status = ANY (ARRAY['accepted'::text, 'rejected'::text]))) OR ((( SELECT auth.uid() AS uid) = sender_id) AND (status = ANY (ARRAY['pending'::text, 'cancelled'::text])))));


--
-- Name: friends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

--
-- Name: habit_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: habit_completions habit_completions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY habit_completions_delete ON public.habit_completions FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: habit_completions habit_completions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY habit_completions_insert ON public.habit_completions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: habit_completions habit_completions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY habit_completions_select ON public.habit_completions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: habits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

--
-- Name: key_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: kr_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kr_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

--
-- Name: okrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;

--
-- Name: org_activity_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_activity_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: org_activity_reports org_activity_reports_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_activity_reports_select ON public.org_activity_reports FOR SELECT USING (
CASE scope
    WHEN 'org'::text THEN public.my_report_perm(org_id, 'report.org'::text)
    ELSE (public.my_report_perm(org_id, 'report.allTeams'::text) OR (team_id IN ( SELECT tm.team_id
       FROM public.org_team_members tm
      WHERE ((tm.user_id = ( SELECT auth.uid() AS uid)) AND tm.is_lead)
    UNION
     SELECT t.id
       FROM public.org_teams t
      WHERE (t.created_by = ( SELECT auth.uid() AS uid)))))
END);


--
-- Name: org_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: org_audit_log org_audit_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_audit_log_select ON public.org_audit_log FOR SELECT USING (public.is_org_admin(org_id));


--
-- Name: org_billing_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_billing_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: org_billing_contacts org_billing_contacts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_billing_contacts_delete ON public.org_billing_contacts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = org_billing_contacts.org_id) AND (o.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: org_billing_contacts org_billing_contacts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_billing_contacts_insert ON public.org_billing_contacts FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = org_billing_contacts.org_id) AND (o.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: org_billing_contacts org_billing_contacts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_billing_contacts_select ON public.org_billing_contacts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = org_billing_contacts.org_id) AND (o.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: org_billing_contacts org_billing_contacts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_billing_contacts_update ON public.org_billing_contacts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = org_billing_contacts.org_id) AND (o.owner_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = org_billing_contacts.org_id) AND (o.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: org_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: org_invitations org_invitations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invitations_select ON public.org_invitations FOR SELECT USING (((( SELECT auth.uid() AS uid) = invitee_id) OR (( SELECT auth.uid() AS uid) = inviter_id) OR public.is_org_admin(org_id)));


--
-- Name: org_invite_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_invite_links ENABLE ROW LEVEL SECURITY;

--
-- Name: org_invite_links org_invite_links_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invite_links_delete ON public.org_invite_links FOR DELETE USING (((created_by = ( SELECT auth.uid() AS uid)) OR public.is_org_admin(org_id)));


--
-- Name: org_invite_links org_invite_links_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invite_links_insert ON public.org_invite_links FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (expires_at <= (now() + '7 days'::interval)) AND (claimed_at IS NULL) AND (claimed_by IS NULL) AND (public.is_org_admin(org_id) OR ((manager_id IS NULL) AND public.my_org_perm(org_id, 'member.invite'::text) AND (NOT (EXISTS ( SELECT 1
   FROM unnest(org_invite_links.team_ids) t(id)
  WHERE (NOT public.can_manage_team(t.id)))))))));


--
-- Name: org_invite_links org_invite_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_invite_links_select ON public.org_invite_links FOR SELECT USING (((created_by = ( SELECT auth.uid() AS uid)) OR public.is_org_admin(org_id)));


--
-- Name: organization_join_requests org_join_requests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_join_requests_delete ON public.organization_join_requests FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) AND (accepted_at IS NULL)));


--
-- Name: organization_join_requests org_join_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_join_requests_select ON public.organization_join_requests FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_org_admin(org_id)));


--
-- Name: org_member_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_member_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_member_permissions org_member_permissions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_permissions_delete ON public.org_member_permissions FOR DELETE USING (public.is_org_admin(org_id));


--
-- Name: org_member_permissions org_member_permissions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_permissions_insert ON public.org_member_permissions FOR INSERT WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_member_permissions org_member_permissions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_permissions_select ON public.org_member_permissions FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_member_permissions org_member_permissions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_permissions_update ON public.org_member_permissions FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_member_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_member_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: org_member_roles org_member_roles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_roles_delete ON public.org_member_roles FOR DELETE USING ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text)));


--
-- Name: org_member_roles org_member_roles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_roles_insert ON public.org_member_roles FOR INSERT WITH CHECK ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text)));


--
-- Name: org_member_roles org_member_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_roles_select ON public.org_member_roles FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_member_roles org_member_roles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_member_roles_update ON public.org_member_roles FOR UPDATE USING ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text))) WITH CHECK ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text)));


--
-- Name: org_notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: org_notification_settings org_notification_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_notification_settings_insert ON public.org_notification_settings FOR INSERT WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)));


--
-- Name: org_notification_settings org_notification_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_notification_settings_select ON public.org_notification_settings FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: org_notification_settings org_notification_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_notification_settings_update ON public.org_notification_settings FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)));


--
-- Name: org_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: org_notifications org_notifications_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_notifications_delete ON public.org_notifications FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: org_notifications org_notifications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_notifications_select ON public.org_notifications FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: org_notifications org_notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_notifications_update ON public.org_notifications FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: org_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: org_roles org_roles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_roles_delete ON public.org_roles FOR DELETE USING ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text)));


--
-- Name: org_roles org_roles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_roles_insert ON public.org_roles FOR INSERT WITH CHECK ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text)));


--
-- Name: org_roles org_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_roles_select ON public.org_roles FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_roles org_roles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_roles_update ON public.org_roles FOR UPDATE USING ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text))) WITH CHECK ((public.is_org_admin(org_id) OR public.my_org_perm(org_id, 'role.manage'::text)));


--
-- Name: org_saved_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_saved_views ENABLE ROW LEVEL SECURITY;

--
-- Name: org_saved_views org_saved_views_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_saved_views_delete ON public.org_saved_views FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: org_saved_views org_saved_views_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_saved_views_insert ON public.org_saved_views FOR INSERT WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)));


--
-- Name: org_saved_views org_saved_views_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_saved_views_select ON public.org_saved_views FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: org_saved_views org_saved_views_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_saved_views_update ON public.org_saved_views FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)));


--
-- Name: org_seat_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_seat_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: org_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: org_settings org_settings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_insert ON public.org_settings FOR INSERT WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_settings org_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_select ON public.org_settings FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_settings org_settings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_settings_update ON public.org_settings FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: org_subscriptions org_subscriptions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_subscriptions_select ON public.org_subscriptions FOR SELECT TO authenticated USING (public.is_org_member(org_id));


--
-- Name: org_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: org_team_members org_team_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_team_members_delete ON public.org_team_members FOR DELETE USING ((public.can_manage_team(team_id) OR (user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: org_team_members org_team_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_team_members_insert ON public.org_team_members FOR INSERT WITH CHECK (public.can_manage_team(team_id));


--
-- Name: org_team_members org_team_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_team_members_select ON public.org_team_members FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_team_members org_team_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_team_members_update ON public.org_team_members FOR UPDATE USING (public.can_manage_team(team_id)) WITH CHECK (public.can_manage_team(team_id));


--
-- Name: org_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: org_teams org_teams_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_teams_delete ON public.org_teams FOR DELETE USING ((public.is_org_admin(org_id) OR (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: org_teams org_teams_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_teams_insert ON public.org_teams FOR INSERT WITH CHECK ((public.my_org_perm(org_id, 'team.create'::text) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: org_teams org_teams_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_teams_select ON public.org_teams FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_teams org_teams_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_teams_update ON public.org_teams FOR UPDATE USING ((public.is_org_member(org_id) AND public.can_manage_team(id))) WITH CHECK ((public.is_org_member(org_id) AND public.can_manage_team(id)));


--
-- Name: org_verified_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_verified_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: org_verified_domains org_verified_domains_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_verified_domains_delete ON public.org_verified_domains FOR DELETE USING (public.is_org_admin(org_id));


--
-- Name: org_verified_domains org_verified_domains_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_verified_domains_insert ON public.org_verified_domains FOR INSERT WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_verified_domains org_verified_domains_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_verified_domains_select ON public.org_verified_domains FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: org_webhook_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_webhook_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: org_webhooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_webhooks ENABLE ROW LEVEL SECURITY;

--
-- Name: org_webhooks org_webhooks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_webhooks_delete ON public.org_webhooks FOR DELETE USING (public.is_org_admin(org_id));


--
-- Name: org_webhooks org_webhooks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_webhooks_insert ON public.org_webhooks FOR INSERT WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_webhooks org_webhooks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_webhooks_select ON public.org_webhooks FOR SELECT USING (public.is_org_admin(org_id));


--
-- Name: org_webhooks org_webhooks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_webhooks_update ON public.org_webhooks FOR UPDATE USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));


--
-- Name: org_weekly_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_weekly_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: org_weekly_reviews org_weekly_reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_weekly_reviews_delete ON public.org_weekly_reviews FOR DELETE USING ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: org_weekly_reviews org_weekly_reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_weekly_reviews_insert ON public.org_weekly_reviews FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)));


--
-- Name: org_weekly_reviews org_weekly_reviews_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY org_weekly_reviews_select ON public.org_weekly_reviews FOR SELECT USING (((created_by = ( SELECT auth.uid() AS uid)) OR public.is_org_admin(org_id) OR ((scope_type = 'team'::text) AND public.is_org_member(org_id) AND (EXISTS ( SELECT 1
   FROM public.org_team_members tm
  WHERE ((tm.team_id = org_weekly_reviews.scope_id) AND (tm.user_id = ( SELECT auth.uid() AS uid)) AND tm.is_lead)))) OR ((scope_type = 'project'::text) AND public.is_org_member(org_id) AND (EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE ((p.id = org_weekly_reviews.scope_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))));


--
-- Name: org_withdrawals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.org_withdrawals ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_join_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members organization_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organization_members_select ON public.organization_members FOR SELECT USING ((public.is_org_member(org_id) OR (user_id = ( SELECT auth.uid() AS uid))));


--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations organizations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_select ON public.organizations FOR SELECT USING (public.is_org_member(id));


--
-- Name: organizations organizations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY organizations_update ON public.organizations FOR UPDATE USING (public.is_org_admin(id)) WITH CHECK (public.is_org_admin(id));


--
-- Name: payment_closures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_closures ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

--
-- Name: processed_stripe_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: renewal_notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.renewal_notices ENABLE ROW LEVEL SECURITY;

--
-- Name: share_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

--
-- Name: share_links share_links_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY share_links_delete ON public.share_links FOR DELETE USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: share_links share_links_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY share_links_insert ON public.share_links FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = owner_id) AND public.owns_task(task_id) AND (expires_at <= (now() + '7 days'::interval))));


--
-- Name: share_links share_links_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY share_links_select ON public.share_links FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: shared_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_lists shared_lists_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_lists_delete ON public.shared_lists FOR DELETE USING (((( SELECT auth.uid() AS uid) = shared_by) OR (( SELECT auth.uid() AS uid) = friend_id)));


--
-- Name: shared_lists shared_lists_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_lists_insert ON public.shared_lists FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = shared_by));


--
-- Name: shared_lists shared_lists_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_lists_select ON public.shared_lists FOR SELECT USING (((( SELECT auth.uid() AS uid) = shared_by) OR (( SELECT auth.uid() AS uid) = friend_id)));


--
-- Name: shared_lists shared_lists_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_lists_update ON public.shared_lists FOR UPDATE USING ((( SELECT auth.uid() AS uid) = friend_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = friend_id));


--
-- Name: shared_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_tasks shared_tasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_tasks_delete ON public.shared_tasks FOR DELETE USING (((( SELECT auth.uid() AS uid) = shared_by) OR (( SELECT auth.uid() AS uid) = friend_id)));


--
-- Name: shared_tasks shared_tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_tasks_insert ON public.shared_tasks FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = shared_by) AND public.owns_task(task_id) AND ((EXISTS ( SELECT 1
   FROM public.friends f
  WHERE ((f.user_id = ( SELECT auth.uid() AS uid)) AND (f.friend_user_id = shared_tasks.friend_id)))) OR (EXISTS ( SELECT 1
   FROM public.friend_requests fr
  WHERE ((fr.sender_id = ( SELECT auth.uid() AS uid)) AND (fr.receiver_id = shared_tasks.friend_id) AND (fr.status = 'pending'::text)))))));


--
-- Name: shared_tasks shared_tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_tasks_select ON public.shared_tasks FOR SELECT USING (((( SELECT auth.uid() AS uid) = shared_by) OR (( SELECT auth.uid() AS uid) = friend_id)));


--
-- Name: shared_tasks shared_tasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_tasks_update ON public.shared_tasks FOR UPDATE USING ((( SELECT auth.uid() AS uid) = shared_by)) WITH CHECK ((( SELECT auth.uid() AS uid) = shared_by));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: support_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: task_dependencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

--
-- Name: task_dependencies task_dependencies_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_dependencies_delete ON public.task_dependencies FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: task_dependencies task_dependencies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_dependencies_insert ON public.task_dependencies FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: task_dependencies task_dependencies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_dependencies_select ON public.task_dependencies FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_select_own_or_shared; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_select_own_or_shared ON public.tasks FOR SELECT USING (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.shared_tasks st
  WHERE ((st.task_id = tasks.id) AND (st.friend_id = ( SELECT auth.uid() AS uid)) AND (st.accepted_at IS NOT NULL))))));


--
-- Name: tasks tasks_update_own_or_editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_update_own_or_editor ON public.tasks FOR UPDATE USING (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.shared_tasks st
  WHERE ((st.task_id = tasks.id) AND (st.friend_id = ( SELECT auth.uid() AS uid)) AND (st.role = 'editor'::text) AND (st.accepted_at IS NOT NULL)))))) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.shared_tasks st
  WHERE ((st.task_id = tasks.id) AND (st.friend_id = ( SELECT auth.uid() AS uid)) AND (st.role = 'editor'::text) AND (st.accepted_at IS NOT NULL))))));


--
-- Name: team_automations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_automations ENABLE ROW LEVEL SECURITY;

--
-- Name: team_automations team_automations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_automations_delete ON public.team_automations FOR DELETE USING (
CASE
    WHEN (project_id IS NULL) THEN public.is_org_admin(org_id)
    ELSE public.can_edit_team_project(project_id)
END);


--
-- Name: team_automations team_automations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_automations_insert ON public.team_automations FOR INSERT WITH CHECK (
CASE
    WHEN (project_id IS NULL) THEN public.is_org_admin(org_id)
    ELSE public.can_edit_team_project(project_id)
END);


--
-- Name: team_automations team_automations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_automations_select ON public.team_automations FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: team_automations team_automations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_automations_update ON public.team_automations FOR UPDATE USING (
CASE
    WHEN (project_id IS NULL) THEN public.is_org_admin(org_id)
    ELSE public.can_edit_team_project(project_id)
END) WITH CHECK (
CASE
    WHEN (project_id IS NULL) THEN public.is_org_admin(org_id)
    ELSE public.can_edit_team_project(project_id)
END);


--
-- Name: team_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: team_categories team_categories_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_categories_delete ON public.team_categories FOR DELETE USING (public.my_org_perm(org_id, 'category.manage'::text));


--
-- Name: team_categories team_categories_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_categories_insert ON public.team_categories FOR INSERT WITH CHECK ((public.my_org_perm(org_id, 'category.manage'::text) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: team_categories team_categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_categories_select ON public.team_categories FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: team_categories team_categories_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_categories_update ON public.team_categories FOR UPDATE USING (public.my_org_perm(org_id, 'category.manage'::text)) WITH CHECK (public.my_org_perm(org_id, 'category.manage'::text));


--
-- Name: team_key_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_key_results ENABLE ROW LEVEL SECURITY;

--
-- Name: team_kr_checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_kr_checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: team_kr_checkins team_kr_checkins_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_kr_checkins_select ON public.team_kr_checkins FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.team_key_results k
  WHERE (k.id = team_kr_checkins.kr_id))));


--
-- Name: team_kr_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_kr_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: team_kr_projects team_kr_projects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_kr_projects_delete ON public.team_kr_projects FOR DELETE USING ((public.my_org_perm(org_id, 'okr.create'::text) AND (EXISTS ( SELECT 1
   FROM public.team_key_results k
  WHERE (k.id = team_kr_projects.kr_id)))));


--
-- Name: team_kr_projects team_kr_projects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_kr_projects_insert ON public.team_kr_projects FOR INSERT WITH CHECK ((public.my_org_perm(org_id, 'okr.create'::text) AND (EXISTS ( SELECT 1
   FROM public.team_key_results k
  WHERE (k.id = team_kr_projects.kr_id))) AND public.can_access_team_project(project_id)));


--
-- Name: team_kr_projects team_kr_projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_kr_projects_select ON public.team_kr_projects FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.team_key_results k
  WHERE (k.id = team_kr_projects.kr_id))) AND public.can_access_team_project(project_id)));


--
-- Name: team_key_results team_krs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_krs_delete ON public.team_key_results FOR DELETE USING (public.my_org_perm(org_id, 'okr.delete'::text));


--
-- Name: team_key_results team_krs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_krs_insert ON public.team_key_results FOR INSERT WITH CHECK (public.my_org_perm(org_id, 'okr.create'::text));


--
-- Name: team_key_results team_krs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_krs_select ON public.team_key_results FOR SELECT USING (public.can_access_team_okr(okr_id));


--
-- Name: team_key_results team_krs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_krs_update ON public.team_key_results FOR UPDATE USING (public.can_access_team_okr(okr_id)) WITH CHECK (public.can_access_team_okr(okr_id));


--
-- Name: team_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: team_labels team_labels_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_labels_delete ON public.team_labels FOR DELETE USING (public.my_org_perm(org_id, 'category.manage'::text));


--
-- Name: team_labels team_labels_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_labels_insert ON public.team_labels FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND public.my_org_perm(org_id, 'category.manage'::text)));


--
-- Name: team_labels team_labels_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_labels_select ON public.team_labels FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: team_labels team_labels_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_labels_update ON public.team_labels FOR UPDATE USING (public.my_org_perm(org_id, 'category.manage'::text)) WITH CHECK (public.my_org_perm(org_id, 'category.manage'::text));


--
-- Name: team_list_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_list_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: team_list_tasks team_list_tasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_list_tasks_delete ON public.team_list_tasks FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.team_lists l
  WHERE ((l.id = team_list_tasks.list_id) AND public.is_org_member(l.org_id)))));


--
-- Name: team_list_tasks team_list_tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_list_tasks_insert ON public.team_list_tasks FOR INSERT WITH CHECK ((public.can_access_team_task(task_id) AND (EXISTS ( SELECT 1
   FROM (public.team_lists l
     JOIN public.team_tasks t ON ((t.org_id = l.org_id)))
  WHERE ((l.id = team_list_tasks.list_id) AND (t.id = team_list_tasks.task_id) AND public.is_org_member(l.org_id))))));


--
-- Name: team_list_tasks team_list_tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_list_tasks_select ON public.team_list_tasks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.team_lists l
  WHERE ((l.id = team_list_tasks.list_id) AND public.is_org_member(l.org_id)))));


--
-- Name: team_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: team_lists team_lists_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_lists_delete ON public.team_lists FOR DELETE USING (public.is_org_member(org_id));


--
-- Name: team_lists team_lists_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_lists_insert ON public.team_lists FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)));


--
-- Name: team_lists team_lists_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_lists_select ON public.team_lists FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: team_lists team_lists_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_lists_update ON public.team_lists FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));


--
-- Name: team_okr_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_okr_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_okr_members team_okr_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okr_members_delete ON public.team_okr_members FOR DELETE TO authenticated USING (public.can_manage_team_okr_audience(okr_id));


--
-- Name: team_okr_members team_okr_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okr_members_insert ON public.team_okr_members FOR INSERT TO authenticated WITH CHECK (public.can_manage_team_okr_audience(okr_id));


--
-- Name: team_okr_members team_okr_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okr_members_select ON public.team_okr_members FOR SELECT TO authenticated USING (public.can_access_team_okr(okr_id));


--
-- Name: team_okr_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_okr_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: team_okr_teams team_okr_teams_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okr_teams_delete ON public.team_okr_teams FOR DELETE TO authenticated USING (public.can_manage_team_okr_audience(okr_id));


--
-- Name: team_okr_teams team_okr_teams_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okr_teams_insert ON public.team_okr_teams FOR INSERT TO authenticated WITH CHECK (public.can_manage_team_okr_audience(okr_id));


--
-- Name: team_okr_teams team_okr_teams_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okr_teams_select ON public.team_okr_teams FOR SELECT USING (public.is_org_member(org_id));


--
-- Name: team_okrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_okrs ENABLE ROW LEVEL SECURITY;

--
-- Name: team_okrs team_okrs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okrs_delete ON public.team_okrs FOR DELETE USING (public.is_org_admin(org_id));


--
-- Name: team_okrs team_okrs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okrs_insert ON public.team_okrs FOR INSERT WITH CHECK ((public.my_org_perm(org_id, 'okr.create'::text) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: team_okrs team_okrs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okrs_select ON public.team_okrs FOR SELECT USING (public.can_access_team_okr(id));


--
-- Name: team_okrs team_okrs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_okrs_update ON public.team_okrs FOR UPDATE USING ((public.my_org_perm(org_id, 'okr.create'::text) AND public.can_access_team_okr(id))) WITH CHECK ((public.my_org_perm(org_id, 'okr.create'::text) AND public.can_access_team_okr(id)));


--
-- Name: team_project_dependencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_project_dependencies ENABLE ROW LEVEL SECURITY;

--
-- Name: team_project_dependencies team_project_dependencies_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_dependencies_delete ON public.team_project_dependencies FOR DELETE USING (public.can_edit_team_project(project_id));


--
-- Name: team_project_dependencies team_project_dependencies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_dependencies_insert ON public.team_project_dependencies FOR INSERT WITH CHECK ((public.can_edit_team_project(project_id) AND (EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE (p.id = team_project_dependencies.depends_on_id)))));


--
-- Name: team_project_dependencies team_project_dependencies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_dependencies_select ON public.team_project_dependencies FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE (p.id = team_project_dependencies.project_id))) AND (EXISTS ( SELECT 1
   FROM public.team_projects q
  WHERE (q.id = team_project_dependencies.depends_on_id)))));


--
-- Name: team_project_followers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_project_followers ENABLE ROW LEVEL SECURITY;

--
-- Name: team_project_followers team_project_followers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_followers_delete ON public.team_project_followers FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: team_project_followers team_project_followers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_followers_insert ON public.team_project_followers FOR INSERT WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.can_access_team_project(project_id) AND (EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE ((p.id = team_project_followers.project_id) AND (p.org_id = team_project_followers.org_id))))));


--
-- Name: team_project_followers team_project_followers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_followers_select ON public.team_project_followers FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: team_project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_project_members team_project_members_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_members_delete ON public.team_project_members FOR DELETE USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.can_edit_team_project(project_id)));


--
-- Name: team_project_members team_project_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_members_insert ON public.team_project_members FOR INSERT WITH CHECK (public.can_edit_team_project(project_id));


--
-- Name: team_project_members team_project_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_members_select ON public.team_project_members FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE (p.id = team_project_members.project_id))));


--
-- Name: team_project_members team_project_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_members_update ON public.team_project_members FOR UPDATE USING (public.can_edit_team_project(project_id)) WITH CHECK (public.can_edit_team_project(project_id));


--
-- Name: team_project_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_project_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: team_project_messages team_project_messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_messages_delete ON public.team_project_messages FOR DELETE USING ((author_id = ( SELECT auth.uid() AS uid)));


--
-- Name: team_project_messages team_project_messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_messages_insert ON public.team_project_messages FOR INSERT WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND public.can_access_team_project(project_id) AND (EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE ((p.id = team_project_messages.project_id) AND (p.org_id = team_project_messages.org_id))))));


--
-- Name: team_project_messages team_project_messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_messages_select ON public.team_project_messages FOR SELECT USING (public.can_access_team_project(project_id));


--
-- Name: team_project_statuses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_project_statuses ENABLE ROW LEVEL SECURITY;

--
-- Name: team_project_statuses team_project_statuses_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_statuses_delete ON public.team_project_statuses FOR DELETE USING (public.can_edit_team_project(project_id));


--
-- Name: team_project_statuses team_project_statuses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_statuses_insert ON public.team_project_statuses FOR INSERT WITH CHECK (public.can_edit_team_project(project_id));


--
-- Name: team_project_statuses team_project_statuses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_statuses_select ON public.team_project_statuses FOR SELECT USING (public.can_access_team_project(project_id));


--
-- Name: team_project_statuses team_project_statuses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_statuses_update ON public.team_project_statuses FOR UPDATE USING (public.can_edit_team_project(project_id)) WITH CHECK (public.can_edit_team_project(project_id));


--
-- Name: team_project_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_project_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: team_project_teams team_project_teams_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_teams_delete ON public.team_project_teams FOR DELETE USING (public.my_project_edit_perm(org_id));


--
-- Name: team_project_teams team_project_teams_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_teams_insert ON public.team_project_teams FOR INSERT WITH CHECK ((public.my_project_edit_perm(org_id) AND (added_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.team_projects p
  WHERE ((p.id = team_project_teams.project_id) AND (p.org_id = team_project_teams.org_id)))) AND (EXISTS ( SELECT 1
   FROM public.org_teams t
  WHERE ((t.id = team_project_teams.team_id) AND (t.org_id = team_project_teams.org_id))))));


--
-- Name: team_project_teams team_project_teams_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_project_teams_select ON public.team_project_teams FOR SELECT USING (public.can_access_team_project(project_id));


--
-- Name: team_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: team_projects team_projects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_projects_delete ON public.team_projects FOR DELETE USING (public.my_org_perm(org_id, 'project.delete'::text));


--
-- Name: team_projects team_projects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_projects_insert ON public.team_projects FOR INSERT WITH CHECK ((public.my_org_perm(org_id, 'project.create'::text) AND (created_by = ( SELECT auth.uid() AS uid))));


--
-- Name: team_projects team_projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_projects_select ON public.team_projects FOR SELECT USING (public.can_access_team_project(id));


--
-- Name: team_projects team_projects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_projects_update ON public.team_projects FOR UPDATE USING ((public.my_project_edit_perm(org_id) OR ((owner_id = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)) OR (public.my_project_role(id) = 'lead'::text))) WITH CHECK ((public.my_project_edit_perm(org_id) OR ((owner_id = ( SELECT auth.uid() AS uid)) AND public.is_org_member(org_id)) OR (public.my_project_role(id) = 'lead'::text)));


--
-- Name: team_task_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_activity team_task_activity_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_activity_select ON public.team_task_activity FOR SELECT USING (public.can_access_team_task(task_id));


--
-- Name: team_task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_comments team_task_comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_comments_delete ON public.team_task_comments FOR DELETE USING ((author_id = ( SELECT auth.uid() AS uid)));


--
-- Name: team_task_comments team_task_comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_comments_insert ON public.team_task_comments FOR INSERT WITH CHECK (((author_id = ( SELECT auth.uid() AS uid)) AND public.can_access_team_task(task_id)));


--
-- Name: team_task_comments team_task_comments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_comments_select ON public.team_task_comments FOR SELECT USING (public.can_access_team_task(task_id));


--
-- Name: team_task_dependencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_dependencies ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_dependencies team_task_dependencies_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_dependencies_delete ON public.team_task_dependencies FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.team_tasks t
  WHERE (t.id = team_task_dependencies.task_id))));


--
-- Name: team_task_dependencies team_task_dependencies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_dependencies_insert ON public.team_task_dependencies FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.team_tasks t
  WHERE (t.id = team_task_dependencies.task_id))) AND (EXISTS ( SELECT 1
   FROM public.team_tasks t
  WHERE (t.id = team_task_dependencies.depends_on_id)))));


--
-- Name: team_task_dependencies team_task_dependencies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_dependencies_select ON public.team_task_dependencies FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.team_tasks t
  WHERE (t.id = team_task_dependencies.task_id))) AND (EXISTS ( SELECT 1
   FROM public.team_tasks b
  WHERE (b.id = team_task_dependencies.depends_on_id)))));


--
-- Name: team_task_followers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_followers ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_followers team_task_followers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_followers_delete ON public.team_task_followers FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: team_task_followers team_task_followers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_followers_insert ON public.team_task_followers FOR INSERT WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.team_tasks t
  WHERE ((t.id = team_task_followers.task_id) AND (t.org_id = team_task_followers.org_id))))));


--
-- Name: team_task_followers team_task_followers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_followers_select ON public.team_task_followers FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: team_task_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_labels team_task_labels_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_labels_delete ON public.team_task_labels FOR DELETE USING (public.can_access_team_task(task_id));


--
-- Name: team_task_labels team_task_labels_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_labels_insert ON public.team_task_labels FOR INSERT WITH CHECK (public.can_access_team_task(task_id));


--
-- Name: team_task_labels team_task_labels_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_labels_select ON public.team_task_labels FOR SELECT USING (public.can_access_team_task(task_id));


--
-- Name: team_task_subtasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_task_subtasks ENABLE ROW LEVEL SECURITY;

--
-- Name: team_task_subtasks team_task_subtasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_subtasks_delete ON public.team_task_subtasks FOR DELETE USING (public.can_access_team_task(task_id));


--
-- Name: team_task_subtasks team_task_subtasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_subtasks_insert ON public.team_task_subtasks FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND public.can_access_team_task(task_id)));


--
-- Name: team_task_subtasks team_task_subtasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_subtasks_select ON public.team_task_subtasks FOR SELECT USING (public.can_access_team_task(task_id));


--
-- Name: team_task_subtasks team_task_subtasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_task_subtasks_update ON public.team_task_subtasks FOR UPDATE USING (public.can_access_team_task(task_id)) WITH CHECK (public.can_access_team_task(task_id));


--
-- Name: team_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: team_tasks team_tasks_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_tasks_delete ON public.team_tasks FOR DELETE USING (public.is_org_admin(org_id));


--
-- Name: team_tasks team_tasks_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_tasks_insert ON public.team_tasks FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (public.my_org_perm(org_id, 'task.create'::text) OR (public.my_project_role(project_id) = ANY (ARRAY['lead'::text, 'contributor'::text])))));


--
-- Name: team_tasks team_tasks_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_tasks_select ON public.team_tasks FOR SELECT USING (((deleted_at IS NULL) AND public.can_access_team_project(project_id)));


--
-- Name: team_tasks team_tasks_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_tasks_update ON public.team_tasks FOR UPDATE USING ((public.my_org_perm(org_id, 'task.editAny'::text) OR (created_by = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.uid() AS uid) = ANY (assignee_ids)) OR (public.my_project_role(project_id) = ANY (ARRAY['lead'::text, 'contributor'::text])))) WITH CHECK ((public.my_org_perm(org_id, 'task.editAny'::text) OR (created_by = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.uid() AS uid) = ANY (assignee_ids)) OR (public.my_project_role(project_id) = ANY (ARRAY['lead'::text, 'contributor'::text]))));


--
-- Name: traffic_hits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.traffic_hits ENABLE ROW LEVEL SECURITY;

--
-- Name: traffic_salts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.traffic_salts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_activity_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawal_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawal_consents withdrawal_consents_select_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawal_consents_select_owner ON public.withdrawal_consents FOR SELECT TO authenticated USING ((org_id IN ( SELECT o.id
   FROM public.organizations o
  WHERE (o.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE friends; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.friends TO anon;
GRANT ALL ON TABLE public.friends TO authenticated;
GRANT ALL ON TABLE public.friends TO service_role;


--
-- Name: FUNCTION accept_friend_request_v2(request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_friend_request_v2(request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_friend_request_v2(request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_friend_request_v2(request_id uuid) TO service_role;


--
-- Name: FUNCTION accept_shared_task(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_shared_task(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_shared_task(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_shared_task(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION account_activity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.account_activity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.account_activity() TO service_role;


--
-- Name: FUNCTION account_has_live_billing(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.account_has_live_billing(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.account_has_live_billing(p_user uuid) TO service_role;


--
-- Name: FUNCTION account_inactivity_deletion_due(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.account_inactivity_deletion_due(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.account_inactivity_deletion_due(p_user uuid) TO service_role;


--
-- Name: FUNCTION accounts_due_for_inactivity_deletion(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accounts_due_for_inactivity_deletion(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accounts_due_for_inactivity_deletion(p_limit integer) TO service_role;


--
-- Name: FUNCTION accounts_due_for_inactivity_notice(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accounts_due_for_inactivity_notice(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accounts_due_for_inactivity_notice(p_limit integer) TO service_role;


--
-- Name: TABLE lists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lists TO anon;
GRANT ALL ON TABLE public.lists TO authenticated;
GRANT ALL ON TABLE public.lists TO service_role;


--
-- Name: FUNCTION add_task_to_list(p_task_id uuid, p_list_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_task_to_list(p_task_id uuid, p_list_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_task_to_list(p_task_id uuid, p_list_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.add_task_to_list(p_task_id uuid, p_list_id uuid) TO service_role;


--
-- Name: FUNCTION admin_allowlisted(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_allowlisted() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_allowlisted() TO authenticated;
GRANT ALL ON FUNCTION public.admin_allowlisted() TO service_role;


--
-- Name: FUNCTION admin_stats_excluded_uids(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_stats_excluded_uids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_stats_excluded_uids() TO authenticated;
GRANT ALL ON FUNCTION public.admin_stats_excluded_uids() TO service_role;


--
-- Name: FUNCTION affiliate_attach(p_affiliate_id uuid, p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.affiliate_attach(p_affiliate_id uuid, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.affiliate_attach(p_affiliate_id uuid, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.affiliate_attach(p_affiliate_id uuid, p_email text) TO service_role;


--
-- Name: FUNCTION affiliate_backfill(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.affiliate_backfill() FROM PUBLIC;
GRANT ALL ON FUNCTION public.affiliate_backfill() TO authenticated;
GRANT ALL ON FUNCTION public.affiliate_backfill() TO service_role;


--
-- Name: FUNCTION affiliate_compute(p_gross bigint, p_vat_bp integer, p_deduction_bp integer, p_fee_bp integer, p_fee_fixed integer, p_rate_bp integer, OUT vat_cents bigint, OUT deduction_cents bigint, OUT fee_cents bigint, OUT base_cents bigint, OUT commission_cents bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.affiliate_compute(p_gross bigint, p_vat_bp integer, p_deduction_bp integer, p_fee_bp integer, p_fee_fixed integer, p_rate_bp integer, OUT vat_cents bigint, OUT deduction_cents bigint, OUT fee_cents bigint, OUT base_cents bigint, OUT commission_cents bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.affiliate_compute(p_gross bigint, p_vat_bp integer, p_deduction_bp integer, p_fee_bp integer, p_fee_fixed integer, p_rate_bp integer, OUT vat_cents bigint, OUT deduction_cents bigint, OUT fee_cents bigint, OUT base_cents bigint, OUT commission_cents bigint) TO service_role;


--
-- Name: TABLE payment_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_records TO service_role;


--
-- Name: FUNCTION affiliate_process(p_rec public.payment_records); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.affiliate_process(p_rec public.payment_records) FROM PUBLIC;
GRANT ALL ON FUNCTION public.affiliate_process(p_rec public.payment_records) TO service_role;


--
-- Name: FUNCTION apply_team_task_custom_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.apply_team_task_custom_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.apply_team_task_custom_status() TO service_role;


--
-- Name: FUNCTION assign_default_org_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_default_org_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_default_org_role() TO service_role;


--
-- Name: FUNCTION audit_org_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_org_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_org_change() TO service_role;


--
-- Name: FUNCTION audit_team_okr_trash(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_team_okr_trash() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_team_okr_trash() TO service_role;


--
-- Name: FUNCTION audit_team_project_details(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_team_project_details() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_team_project_details() TO service_role;


--
-- Name: FUNCTION audit_team_project_members(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_team_project_members() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_team_project_members() TO service_role;


--
-- Name: FUNCTION audit_team_task_trash(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_team_task_trash() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_team_task_trash() TO service_role;


--
-- Name: FUNCTION billing_acceptances_append_only(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.billing_acceptances_append_only() FROM PUBLIC;
GRANT ALL ON FUNCTION public.billing_acceptances_append_only() TO service_role;


--
-- Name: FUNCTION build_org_activity_report(p_org uuid, p_team uuid, p_day date, p_tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.build_org_activity_report(p_org uuid, p_team uuid, p_day date, p_tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.build_org_activity_report(p_org uuid, p_team uuid, p_day date, p_tz text) TO service_role;


--
-- Name: FUNCTION can_access_team_okr(p_okr uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_access_team_okr(p_okr uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_access_team_okr(p_okr uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_access_team_okr(p_okr uuid) TO service_role;


--
-- Name: FUNCTION can_access_team_project(p_project uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_access_team_project(p_project uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_access_team_project(p_project uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_access_team_project(p_project uuid) TO service_role;


--
-- Name: FUNCTION can_access_team_task(p_task uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_access_team_task(p_task uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_access_team_task(p_task uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_access_team_task(p_task uuid) TO service_role;


--
-- Name: FUNCTION can_assign_to(p_org uuid, p_target uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_assign_to(p_org uuid, p_target uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_assign_to(p_org uuid, p_target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_assign_to(p_org uuid, p_target uuid) TO service_role;


--
-- Name: FUNCTION can_edit_team_project(p_project uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_edit_team_project(p_project uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_edit_team_project(p_project uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_edit_team_project(p_project uuid) TO service_role;


--
-- Name: FUNCTION can_manage_team(p_team uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_manage_team(p_team uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_manage_team(p_team uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_manage_team(p_team uuid) TO service_role;


--
-- Name: FUNCTION can_manage_team_okr_audience(p_okr uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_manage_team_okr_audience(p_okr uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_manage_team_okr_audience(p_okr uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_manage_team_okr_audience(p_okr uuid) TO service_role;


--
-- Name: FUNCTION can_restore_team_okr(p_org uuid, p_deleted_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_restore_team_okr(p_org uuid, p_deleted_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_restore_team_okr(p_org uuid, p_deleted_by uuid) TO service_role;


--
-- Name: FUNCTION can_restore_team_task(p_org uuid, p_project uuid, p_deleted_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_restore_team_task(p_org uuid, p_project uuid, p_deleted_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_restore_team_task(p_org uuid, p_project uuid, p_deleted_by uuid) TO service_role;


--
-- Name: FUNCTION claim_acquisition_source(p_source text, p_campaign text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_acquisition_source(p_source text, p_campaign text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_acquisition_source(p_source text, p_campaign text) TO authenticated;
GRANT ALL ON FUNCTION public.claim_acquisition_source(p_source text, p_campaign text) TO service_role;


--
-- Name: FUNCTION claim_affiliate(p_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_affiliate(p_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_affiliate(p_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.claim_affiliate(p_slug text) TO service_role;


--
-- Name: FUNCTION claim_org_invite(p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_org_invite(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_org_invite(p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_org_invite(p_token uuid) TO service_role;


--
-- Name: FUNCTION claim_share_link(p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_share_link(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_share_link(p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_share_link(p_token uuid) TO service_role;


--
-- Name: FUNCTION consume_email_lookup_quota(p_cost integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.consume_email_lookup_quota(p_cost integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_email_lookup_quota(p_cost integer) TO service_role;


--
-- Name: FUNCTION consume_rate_limit(p_key text, p_limit integer, p_window interval); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window interval) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window interval) TO service_role;


--
-- Name: FUNCTION create_org_email_invitations(p_org uuid, p_emails text[], p_manager uuid, p_team_ids uuid[], p_access_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_org_email_invitations(p_org uuid, p_emails text[], p_manager uuid, p_team_ids uuid[], p_access_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_org_email_invitations(p_org uuid, p_emails text[], p_manager uuid, p_team_ids uuid[], p_access_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.create_org_email_invitations(p_org uuid, p_emails text[], p_manager uuid, p_team_ids uuid[], p_access_days integer) TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: FUNCTION create_organization(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_organization(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_organization(p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.create_organization(p_name text) TO service_role;


--
-- Name: FUNCTION create_profile_for_new_user(p_id uuid, p_email text, p_meta jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_profile_for_new_user(p_id uuid, p_email text, p_meta jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_profile_for_new_user(p_id uuid, p_email text, p_meta jsonb) TO service_role;
GRANT ALL ON FUNCTION public.create_profile_for_new_user(p_id uuid, p_email text, p_meta jsonb) TO supabase_auth_admin;


--
-- Name: FUNCTION create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb, p_milestones jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb, p_milestones jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb, p_milestones jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_team_project_with_tasks(p_org uuid, p_project jsonb, p_tasks jsonb, p_milestones jsonb) TO service_role;


--
-- Name: FUNCTION cron_invoke(p_job text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cron_invoke(p_job text) FROM PUBLIC;


--
-- Name: FUNCTION cron_lease_acquire(p_job text, p_ttl_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cron_lease_acquire(p_job text, p_ttl_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cron_lease_acquire(p_job text, p_ttl_seconds integer) TO service_role;


--
-- Name: FUNCTION cron_lease_release(p_job text, p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cron_lease_release(p_job text, p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cron_lease_release(p_job text, p_token uuid) TO service_role;


--
-- Name: FUNCTION cron_run_status(p_http_code integer, p_timed_out boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cron_run_status(p_http_code integer, p_timed_out boolean) FROM PUBLIC;


--
-- Name: FUNCTION cron_runs_close(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cron_runs_close() FROM PUBLIC;


--
-- Name: FUNCTION cron_runs_verdict(p_now timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cron_runs_verdict(p_now timestamp with time zone) FROM PUBLIC;


--
-- Name: FUNCTION delete_organization(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_organization(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_organization(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_organization(p_org uuid) TO service_role;


--
-- Name: FUNCTION delete_team_with_transfer(p_team uuid, p_target uuid, p_archive_projects boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_team_with_transfer(p_team uuid, p_target uuid, p_archive_projects boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_team_with_transfer(p_team uuid, p_target uuid, p_archive_projects boolean) TO authenticated;
GRANT ALL ON FUNCTION public.delete_team_with_transfer(p_team uuid, p_target uuid, p_archive_projects boolean) TO service_role;


--
-- Name: FUNCTION drop_muted_org_notification(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.drop_muted_org_notification() FROM PUBLIC;
GRANT ALL ON FUNCTION public.drop_muted_org_notification() TO service_role;


--
-- Name: FUNCTION enforce_category_tree(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_category_tree() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_category_tree() TO service_role;


--
-- Name: FUNCTION enforce_org_invite_domain(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_org_invite_domain() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_org_invite_domain() TO service_role;


--
-- Name: FUNCTION enforce_org_member_role_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_org_member_role_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_org_member_role_write() TO service_role;


--
-- Name: FUNCTION enforce_org_permission_ceiling(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_org_permission_ceiling() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_org_permission_ceiling() TO service_role;


--
-- Name: FUNCTION enforce_org_role_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_org_role_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_org_role_write() TO service_role;


--
-- Name: FUNCTION enforce_org_settings_default_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_org_settings_default_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_org_settings_default_role() TO service_role;


--
-- Name: FUNCTION enforce_profile_integrity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_profile_integrity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_profile_integrity() TO service_role;


--
-- Name: FUNCTION enforce_team_category_tree(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_team_category_tree() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_team_category_tree() TO service_role;


--
-- Name: FUNCTION enforce_team_project_archive_scope(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_team_project_archive_scope() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_team_project_archive_scope() TO service_role;


--
-- Name: FUNCTION enforce_team_project_edit_scope(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_team_project_edit_scope() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_team_project_edit_scope() TO service_role;


--
-- Name: FUNCTION enforce_team_task_assign_scope(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_team_task_assign_scope() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_team_task_assign_scope() TO service_role;


--
-- Name: FUNCTION enforce_team_task_project_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_team_task_project_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_team_task_project_role() TO service_role;


--
-- Name: FUNCTION enqueue_team_task_webhook(p_task uuid, p_event text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_team_task_webhook(p_task uuid, p_event text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_team_task_webhook(p_task uuid, p_event text) TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_team_task_webhook(p_task uuid, p_event text) TO service_role;


--
-- Name: FUNCTION events_enforce_created_by(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.events_enforce_created_by() FROM PUBLIC;
GRANT ALL ON FUNCTION public.events_enforce_created_by() TO service_role;


--
-- Name: FUNCTION expire_org_member_roles(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expire_org_member_roles() FROM PUBLIC;
GRANT ALL ON FUNCTION public.expire_org_member_roles() TO service_role;


--
-- Name: FUNCTION forbid_consent_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.forbid_consent_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.forbid_consent_mutation() TO service_role;


--
-- Name: FUNCTION forbid_payment_mutation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.forbid_payment_mutation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.forbid_payment_mutation() TO service_role;


--
-- Name: FUNCTION freeze_team_membership_identity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.freeze_team_membership_identity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.freeze_team_membership_identity() TO service_role;


--
-- Name: FUNCTION generate_due_activity_reports(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_due_activity_reports() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_due_activity_reports() TO service_role;


--
-- Name: FUNCTION generate_join_code(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_join_code() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_join_code() TO service_role;


--
-- Name: FUNCTION get_admin_onboarding_funnel(p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_onboarding_funnel(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_onboarding_funnel(p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_onboarding_funnel(p_days integer) TO service_role;


--
-- Name: FUNCTION get_admin_revenue(p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_revenue(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_revenue(p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_revenue(p_days integer) TO service_role;


--
-- Name: FUNCTION get_admin_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_stats() TO service_role;


--
-- Name: FUNCTION get_admin_traffic(p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_traffic(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_traffic(p_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_traffic(p_days integer) TO service_role;


--
-- Name: FUNCTION get_incoming_request_senders(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_incoming_request_senders() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_incoming_request_senders() TO authenticated;
GRANT ALL ON FUNCTION public.get_incoming_request_senders() TO service_role;


--
-- Name: FUNCTION get_my_habits(p_days integer, p_today date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_habits(p_days integer, p_today date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_habits(p_days integer, p_today date) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_habits(p_days integer, p_today date) TO service_role;


--
-- Name: FUNCTION get_my_org_inbox(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_org_inbox() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_org_inbox() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_org_inbox() TO service_role;


--
-- Name: FUNCTION get_my_org_invitations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_org_invitations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_org_invitations() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_org_invitations() TO service_role;


--
-- Name: FUNCTION get_my_org_removal_notices(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_org_removal_notices() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_org_removal_notices() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_org_removal_notices() TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: FUNCTION get_my_tasks(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_tasks() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_tasks() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_tasks() TO service_role;


--
-- Name: FUNCTION get_my_team_kr_projects(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_kr_projects(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_kr_projects(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_kr_projects(p_org uuid) TO service_role;


--
-- Name: TABLE team_project_dependencies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_project_dependencies TO anon;
GRANT ALL ON TABLE public.team_project_dependencies TO authenticated;
GRANT ALL ON TABLE public.team_project_dependencies TO service_role;


--
-- Name: FUNCTION get_my_team_project_dependencies(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_project_dependencies(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_project_dependencies(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_project_dependencies(p_org uuid) TO service_role;


--
-- Name: TABLE team_project_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_project_members TO anon;
GRANT ALL ON TABLE public.team_project_members TO authenticated;
GRANT ALL ON TABLE public.team_project_members TO service_role;


--
-- Name: FUNCTION get_my_team_project_members(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_project_members(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_project_members(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_project_members(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_my_team_project_progress(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_project_progress(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_project_progress(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_project_progress(p_org uuid) TO service_role;


--
-- Name: TABLE team_projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_projects TO anon;
GRANT ALL ON TABLE public.team_projects TO authenticated;
GRANT ALL ON TABLE public.team_projects TO service_role;


--
-- Name: FUNCTION get_my_team_projects(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_projects(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_projects(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_projects(p_org uuid) TO service_role;


--
-- Name: TABLE team_task_dependencies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_task_dependencies TO anon;
GRANT ALL ON TABLE public.team_task_dependencies TO authenticated;
GRANT ALL ON TABLE public.team_task_dependencies TO service_role;


--
-- Name: FUNCTION get_my_team_task_dependencies(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_task_dependencies(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_task_dependencies(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_task_dependencies(p_org uuid) TO service_role;


--
-- Name: TABLE team_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_tasks TO anon;
GRANT ALL ON TABLE public.team_tasks TO authenticated;
GRANT ALL ON TABLE public.team_tasks TO service_role;


--
-- Name: FUNCTION get_my_team_tasks(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_team_tasks(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_team_tasks(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_my_team_tasks(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_org_billing_history(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_org_billing_history(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_org_billing_history(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_org_billing_history(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_org_email_invitations(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_org_email_invitations(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_org_email_invitations(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_org_email_invitations(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_org_member_last_activity(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_org_member_last_activity(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_org_member_last_activity(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_org_member_last_activity(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_pending_shared_tasks(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_pending_shared_tasks() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_pending_shared_tasks() TO authenticated;
GRANT ALL ON FUNCTION public.get_pending_shared_tasks() TO service_role;


--
-- Name: FUNCTION get_subtree(p_org uuid, p_root uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_subtree(p_org uuid, p_root uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_subtree(p_org uuid, p_root uuid) TO service_role;


--
-- Name: FUNCTION get_support_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_support_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_support_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_support_stats() TO service_role;


--
-- Name: FUNCTION get_team_deletion_impact(p_team uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_team_deletion_impact(p_team uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_team_deletion_impact(p_team uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_deletion_impact(p_team uuid) TO service_role;


--
-- Name: FUNCTION get_team_member_workload(p_org uuid, p_today date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_team_member_workload(p_org uuid, p_today date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_team_member_workload(p_org uuid, p_today date) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_member_workload(p_org uuid, p_today date) TO service_role;


--
-- Name: FUNCTION get_team_okr_trash(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_team_okr_trash(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_team_okr_trash(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_okr_trash(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_team_project_task_stats(p_org uuid, p_today date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_team_project_task_stats(p_org uuid, p_today date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_team_project_task_stats(p_org uuid, p_today date) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_project_task_stats(p_org uuid, p_today date) TO service_role;


--
-- Name: FUNCTION get_team_trash(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_team_trash(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_team_trash(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_team_trash(p_org uuid) TO service_role;


--
-- Name: FUNCTION get_work_time_stats(p_ranges jsonb, p_tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text) TO authenticated;
GRANT ALL ON FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text) TO service_role;


--
-- Name: FUNCTION habit_completions_mirror(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.habit_completions_mirror() FROM PUBLIC;
GRANT ALL ON FUNCTION public.habit_completions_mirror() TO service_role;


--
-- Name: FUNCTION habit_day_from_key(p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.habit_day_from_key(p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.habit_day_from_key(p_key text) TO authenticated;
GRANT ALL ON FUNCTION public.habit_day_from_key(p_key text) TO service_role;


--
-- Name: FUNCTION habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date) TO authenticated;
GRANT ALL ON FUNCTION public.habit_day_scheduled(p_days smallint[], p_history jsonb, p_d date) TO service_role;


--
-- Name: FUNCTION habit_schedule_history_valid(p_history jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.habit_schedule_history_valid(p_history jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.habit_schedule_history_valid(p_history jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.habit_schedule_history_valid(p_history jsonb) TO service_role;


--
-- Name: FUNCTION handle_new_user_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user_profile() TO service_role;
GRANT ALL ON FUNCTION public.handle_new_user_profile() TO supabase_auth_admin;


--
-- Name: FUNCTION has_subordinates(p_org uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_subordinates(p_org uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_subordinates(p_org uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION i_have_subordinates(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.i_have_subordinates(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.i_have_subordinates(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.i_have_subordinates(p_org uuid) TO service_role;


--
-- Name: FUNCTION init_team_task_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.init_team_task_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.init_team_task_status() TO service_role;


--
-- Name: FUNCTION insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.insert_kr_checkin_row(p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text) TO service_role;


--
-- Name: FUNCTION invite_friend_to_org(p_org uuid, p_invitee uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.invite_friend_to_org(p_org uuid, p_invitee uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invite_friend_to_org(p_org uuid, p_invitee uuid) TO authenticated;
GRANT ALL ON FUNCTION public.invite_friend_to_org(p_org uuid, p_invitee uuid) TO service_role;


--
-- Name: FUNCTION is_above(p_org uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_above(p_org uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_above(p_org uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_above(p_org uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_allowed_avatar_url(p_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_allowed_avatar_url(p_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_allowed_avatar_url(p_url text) TO authenticated;
GRANT ALL ON FUNCTION public.is_allowed_avatar_url(p_url text) TO service_role;


--
-- Name: FUNCTION is_org_admin(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_org_admin(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_org_admin(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_org_admin(p_org uuid) TO service_role;


--
-- Name: FUNCTION is_org_manager(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_org_manager(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_org_manager(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_org_manager(p_org uuid) TO service_role;


--
-- Name: FUNCTION is_org_member(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_org_member(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_org_member(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_org_member(p_org uuid) TO service_role;


--
-- Name: FUNCTION leave_organization(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.leave_organization(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.leave_organization(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.leave_organization(p_org uuid) TO service_role;


--
-- Name: FUNCTION log_team_task_activity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_team_task_activity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_team_task_activity() TO service_role;


--
-- Name: FUNCTION log_team_task_creation(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_team_task_creation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_team_task_creation() TO service_role;


--
-- Name: FUNCTION manages_user(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.manages_user(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.manages_user(p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.manages_user(p_user uuid) TO service_role;


--
-- Name: FUNCTION member_departure_impact(p_org uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.member_departure_impact(p_org uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.member_departure_impact(p_org uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.member_departure_impact(p_org uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION my_assign_targets(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_assign_targets(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_assign_targets(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.my_assign_targets(p_org uuid) TO service_role;


--
-- Name: FUNCTION my_managed_user_ids(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_managed_user_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_managed_user_ids() TO authenticated;
GRANT ALL ON FUNCTION public.my_managed_user_ids() TO service_role;


--
-- Name: FUNCTION my_org_badge_tasks(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_org_badge_tasks() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_org_badge_tasks() TO authenticated;
GRANT ALL ON FUNCTION public.my_org_badge_tasks() TO service_role;


--
-- Name: FUNCTION my_org_perm(p_org uuid, p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_org_perm(p_org uuid, p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_org_perm(p_org uuid, p_key text) TO authenticated;
GRANT ALL ON FUNCTION public.my_org_perm(p_org uuid, p_key text) TO service_role;


--
-- Name: FUNCTION my_project_edit_perm(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_project_edit_perm(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_project_edit_perm(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.my_project_edit_perm(p_org uuid) TO service_role;


--
-- Name: FUNCTION my_project_role(p_project uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_project_role(p_project uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_project_role(p_project uuid) TO authenticated;
GRANT ALL ON FUNCTION public.my_project_role(p_project uuid) TO service_role;


--
-- Name: FUNCTION my_report_perm(p_org uuid, p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_report_perm(p_org uuid, p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_report_perm(p_org uuid, p_key text) TO authenticated;
GRANT ALL ON FUNCTION public.my_report_perm(p_org uuid, p_key text) TO service_role;


--
-- Name: FUNCTION my_role_assign_targets(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_role_assign_targets(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_role_assign_targets(p_org uuid) TO service_role;


--
-- Name: FUNCTION my_role_perm(p_org uuid, p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_role_perm(p_org uuid, p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_role_perm(p_org uuid, p_key text) TO service_role;


--
-- Name: FUNCTION my_team_project_ids(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_team_project_ids(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_team_project_ids(p_org uuid) TO service_role;


--
-- Name: FUNCTION notify_comment_mention(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_comment_mention() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_comment_mention() TO service_role;


--
-- Name: FUNCTION notify_event_scheduled(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_event_scheduled() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_event_scheduled() TO service_role;


--
-- Name: FUNCTION notify_kr_due(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_kr_due() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_kr_due() TO service_role;


--
-- Name: FUNCTION notify_member_position_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_member_position_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_member_position_change() TO service_role;


--
-- Name: FUNCTION notify_project_at_risk(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_project_at_risk() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_project_at_risk() TO service_role;


--
-- Name: FUNCTION notify_task_assignment(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_task_assignment() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_task_assignment() TO service_role;


--
-- Name: FUNCTION notify_task_comment(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_task_comment() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_task_comment() TO service_role;


--
-- Name: FUNCTION notify_team_project_archived(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_team_project_archived() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_team_project_archived() TO service_role;


--
-- Name: FUNCTION notify_team_task_automations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_team_task_automations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_team_task_automations() TO service_role;


--
-- Name: FUNCTION notify_team_task_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_team_task_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_team_task_status() TO service_role;


--
-- Name: FUNCTION offboard_org_member(p_org uuid, p_user uuid, p_tasks_to uuid, p_reports_to uuid, p_leads_to uuid, p_projects_to uuid, p_krs_to uuid, p_mode text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.offboard_org_member(p_org uuid, p_user uuid, p_tasks_to uuid, p_reports_to uuid, p_leads_to uuid, p_projects_to uuid, p_krs_to uuid, p_mode text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.offboard_org_member(p_org uuid, p_user uuid, p_tasks_to uuid, p_reports_to uuid, p_leads_to uuid, p_projects_to uuid, p_krs_to uuid, p_mode text) TO authenticated;
GRANT ALL ON FUNCTION public.offboard_org_member(p_org uuid, p_user uuid, p_tasks_to uuid, p_reports_to uuid, p_leads_to uuid, p_projects_to uuid, p_krs_to uuid, p_mode text) TO service_role;


--
-- Name: FUNCTION org_admin_count(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_admin_count(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_admin_count(p_org uuid) TO service_role;


--
-- Name: FUNCTION org_member_can_invite(p_org uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_member_can_invite(p_org uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_member_can_invite(p_org uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION org_member_default_perm(p_org uuid, p_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_member_default_perm(p_org uuid, p_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_member_default_perm(p_org uuid, p_key text) TO service_role;


--
-- Name: FUNCTION org_notifications_to_email(p_mode text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_notifications_to_email(p_mode text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_notifications_to_email(p_mode text) TO service_role;


--
-- Name: FUNCTION org_saved_view_before_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_saved_view_before_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_saved_view_before_write() TO service_role;


--
-- Name: FUNCTION org_seats_allowed(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_seats_allowed(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_seats_allowed(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.org_seats_allowed(p_org uuid) TO service_role;


--
-- Name: FUNCTION org_settings_before_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_settings_before_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_settings_before_write() TO service_role;


--
-- Name: FUNCTION org_team_before_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_team_before_update() FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_team_before_update() TO service_role;


--
-- Name: FUNCTION org_verified_domain_before_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_verified_domain_before_insert() FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_verified_domain_before_insert() TO service_role;


--
-- Name: FUNCTION org_webhook_before_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_webhook_before_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_webhook_before_write() TO service_role;


--
-- Name: FUNCTION org_webhook_deliveries_due(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.org_webhook_deliveries_due(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.org_webhook_deliveries_due(p_limit integer) TO service_role;


--
-- Name: FUNCTION orgs_due_for_renewal_notice(p_min_days integer, p_max_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.orgs_due_for_renewal_notice(p_min_days integer, p_max_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.orgs_due_for_renewal_notice(p_min_days integer, p_max_days integer) TO service_role;


--
-- Name: FUNCTION orgs_for_seat_alert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.orgs_for_seat_alert() FROM PUBLIC;
GRANT ALL ON FUNCTION public.orgs_for_seat_alert() TO service_role;


--
-- Name: FUNCTION orgs_missing_renewal_notice(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.orgs_missing_renewal_notice() FROM PUBLIC;
GRANT ALL ON FUNCTION public.orgs_missing_renewal_notice() TO service_role;


--
-- Name: FUNCTION owns_task(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.owns_task(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.owns_task(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_task(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION payment_records_affiliate(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.payment_records_affiliate() FROM PUBLIC;
GRANT ALL ON FUNCTION public.payment_records_affiliate() TO service_role;


--
-- Name: FUNCTION post_kr_checkin(p_kr uuid, p_value numeric, p_status text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_kr_checkin(p_kr uuid, p_value numeric, p_status text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_kr_checkin(p_kr uuid, p_value numeric, p_status text, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.post_kr_checkin(p_kr uuid, p_value numeric, p_status text, p_note text) TO service_role;


--
-- Name: FUNCTION prevent_org_immutables(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_org_immutables() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_org_immutables() TO service_role;


--
-- Name: FUNCTION prevent_task_dependency_cycle(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_task_dependency_cycle() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_task_dependency_cycle() TO service_role;


--
-- Name: FUNCTION prevent_team_task_dependency_cycle(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_team_task_dependency_cycle() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_team_task_dependency_cycle() TO service_role;


--
-- Name: FUNCTION prevent_user_id_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_user_id_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_user_id_change() TO service_role;


--
-- Name: FUNCTION preview_share_link(p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preview_share_link(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preview_share_link(p_token uuid) TO anon;
GRANT ALL ON FUNCTION public.preview_share_link(p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.preview_share_link(p_token uuid) TO service_role;


--
-- Name: FUNCTION profiles_affiliation_frozen(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.profiles_affiliation_frozen() FROM PUBLIC;
GRANT ALL ON FUNCTION public.profiles_affiliation_frozen() TO service_role;


--
-- Name: FUNCTION prune_declined_org_invitations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prune_declined_org_invitations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prune_declined_org_invitations() TO service_role;


--
-- Name: FUNCTION prune_processed_stripe_events(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prune_processed_stripe_events() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prune_processed_stripe_events() TO service_role;


--
-- Name: FUNCTION purge_archived_team_project(p_project uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_archived_team_project(p_project uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_archived_team_project(p_project uuid) TO authenticated;
GRANT ALL ON FUNCTION public.purge_archived_team_project(p_project uuid) TO service_role;


--
-- Name: FUNCTION purge_expired_email_invitations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_expired_email_invitations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_expired_email_invitations() TO service_role;


--
-- Name: FUNCTION purge_org_audit_log(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_org_audit_log() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_org_audit_log() TO service_role;


--
-- Name: FUNCTION purge_project_memberships_on_leave(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_project_memberships_on_leave() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_project_memberships_on_leave() TO service_role;


--
-- Name: FUNCTION purge_stale_rate_limits(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_stale_rate_limits() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_stale_rate_limits() TO service_role;


--
-- Name: FUNCTION purge_team_okr(p_okr uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_team_okr(p_okr uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_team_okr(p_okr uuid) TO authenticated;
GRANT ALL ON FUNCTION public.purge_team_okr(p_okr uuid) TO service_role;


--
-- Name: FUNCTION purge_team_okr_trash(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_team_okr_trash() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_team_okr_trash() TO service_role;


--
-- Name: FUNCTION purge_team_task(p_task uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_team_task(p_task uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_team_task(p_task uuid) TO authenticated;
GRANT ALL ON FUNCTION public.purge_team_task(p_task uuid) TO service_role;


--
-- Name: FUNCTION purge_team_task_trash(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_team_task_trash() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_team_task_trash() TO service_role;


--
-- Name: FUNCTION purge_traffic(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_traffic() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_traffic() TO service_role;


--
-- Name: FUNCTION purge_user_from_team_assignments(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_user_from_team_assignments(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_user_from_team_assignments(p_user uuid) TO service_role;


--
-- Name: FUNCTION record_demo_conversion(p_device_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_demo_conversion(p_device_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_demo_conversion(p_device_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.record_demo_conversion(p_device_id uuid) TO service_role;


--
-- Name: FUNCTION record_demo_visit(p_device_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_demo_visit(p_device_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_demo_visit(p_device_id uuid) TO anon;
GRANT ALL ON FUNCTION public.record_demo_visit(p_device_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.record_demo_visit(p_device_id uuid) TO service_role;


--
-- Name: FUNCTION record_support_report(p_category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_support_report(p_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_support_report(p_category text) TO service_role;


--
-- Name: FUNCTION regenerate_join_code(p_org uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.regenerate_join_code(p_org uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.regenerate_join_code(p_org uuid) TO authenticated;
GRANT ALL ON FUNCTION public.regenerate_join_code(p_org uuid) TO service_role;


--
-- Name: FUNCTION release_member_work(p_org uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_member_work(p_org uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_member_work(p_org uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION remove_friendship(p_friend_row_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_friendship(p_friend_row_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_friendship(p_friend_row_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_friendship(p_friend_row_id uuid) TO service_role;


--
-- Name: FUNCTION remove_member(p_org uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_member(p_org uuid, p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_member(p_org uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_member(p_org uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION remove_task_from_list(p_task_id uuid, p_list_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_task_from_list(p_task_id uuid, p_list_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_task_from_list(p_task_id uuid, p_list_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_task_from_list(p_task_id uuid, p_list_id uuid) TO service_role;


--
-- Name: FUNCTION request_join_organization(p_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_join_organization(p_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_join_organization(p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.request_join_organization(p_code text) TO service_role;


--
-- Name: FUNCTION reset_stripe_identifiers(p_apply boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reset_stripe_identifiers(p_apply boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_stripe_identifiers(p_apply boolean) TO service_role;


--
-- Name: FUNCTION resolve_profile_by_email(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_profile_by_email(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_profile_by_email(p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_profile_by_email(p_email text) TO service_role;


--
-- Name: FUNCTION resolve_profiles_by_emails(p_emails text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_profiles_by_emails(p_emails text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_profiles_by_emails(p_emails text[]) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_profiles_by_emails(p_emails text[]) TO service_role;


--
-- Name: FUNCTION respond_join_request(p_request_id uuid, p_accept boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.respond_join_request(p_request_id uuid, p_accept boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.respond_join_request(p_request_id uuid, p_accept boolean) TO authenticated;
GRANT ALL ON FUNCTION public.respond_join_request(p_request_id uuid, p_accept boolean) TO service_role;


--
-- Name: FUNCTION respond_org_invitation(p_invitation uuid, p_accept boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.respond_org_invitation(p_invitation uuid, p_accept boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.respond_org_invitation(p_invitation uuid, p_accept boolean) TO authenticated;
GRANT ALL ON FUNCTION public.respond_org_invitation(p_invitation uuid, p_accept boolean) TO service_role;


--
-- Name: FUNCTION restore_team_okr(p_okr uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.restore_team_okr(p_okr uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.restore_team_okr(p_okr uuid) TO authenticated;
GRANT ALL ON FUNCTION public.restore_team_okr(p_okr uuid) TO service_role;


--
-- Name: FUNCTION restore_team_task(p_task uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.restore_team_task(p_task uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.restore_team_task(p_task uuid) TO authenticated;
GRANT ALL ON FUNCTION public.restore_team_task(p_task uuid) TO service_role;


--
-- Name: FUNCTION run_overdue_reminders(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.run_overdue_reminders() FROM PUBLIC;
GRANT ALL ON FUNCTION public.run_overdue_reminders() TO service_role;


--
-- Name: FUNCTION run_team_task_automations(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.run_team_task_automations() FROM PUBLIC;
GRANT ALL ON FUNCTION public.run_team_task_automations() TO service_role;


--
-- Name: FUNCTION sanitize_display_name(raw text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sanitize_display_name(raw text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sanitize_display_name(raw text) TO anon;
GRANT ALL ON FUNCTION public.sanitize_display_name(raw text) TO authenticated;
GRANT ALL ON FUNCTION public.sanitize_display_name(raw text) TO service_role;


--
-- Name: TABLE payment_closures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_closures TO service_role;


--
-- Name: FUNCTION seal_payment_period(p_month date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seal_payment_period(p_month date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.seal_payment_period(p_month date) TO service_role;


--
-- Name: FUNCTION seal_payment_record(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seal_payment_record() FROM PUBLIC;
GRANT ALL ON FUNCTION public.seal_payment_record() TO service_role;


--
-- Name: FUNCTION search_org(p_org uuid, p_query text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_org(p_org uuid, p_query text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_org(p_org uuid, p_query text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_org(p_org uuid, p_query text, p_limit integer) TO service_role;


--
-- Name: FUNCTION seed_default_categories(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seed_default_categories() FROM PUBLIC;
GRANT ALL ON FUNCTION public.seed_default_categories() TO service_role;


--
-- Name: FUNCTION set_friend_request_receiver_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_friend_request_receiver_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_friend_request_receiver_id() TO service_role;


--
-- Name: FUNCTION set_friend_request_sender_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_friend_request_sender_email() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_friend_request_sender_email() TO service_role;


--
-- Name: FUNCTION set_key_result_completed_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_key_result_completed_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_key_result_completed_at() TO service_role;


--
-- Name: FUNCTION set_member_access(p_org uuid, p_user uuid, p_suspended boolean, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_member_access(p_org uuid, p_user uuid, p_suspended boolean, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_member_access(p_org uuid, p_user uuid, p_suspended boolean, p_expires_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.set_member_access(p_org uuid, p_user uuid, p_suspended boolean, p_expires_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION set_member_manager(p_org uuid, p_user uuid, p_manager uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_member_manager(p_org uuid, p_user uuid, p_manager uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_member_manager(p_org uuid, p_user uuid, p_manager uuid) TO authenticated;
GRANT ALL ON FUNCTION public.set_member_manager(p_org uuid, p_user uuid, p_manager uuid) TO service_role;


--
-- Name: FUNCTION set_member_role(p_org uuid, p_user uuid, p_role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_member_role(p_org uuid, p_user uuid, p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_member_role(p_org uuid, p_user uuid, p_role text) TO authenticated;
GRANT ALL ON FUNCTION public.set_member_role(p_org uuid, p_user uuid, p_role text) TO service_role;


--
-- Name: FUNCTION set_tasks_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_tasks_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_tasks_updated_at() TO service_role;


--
-- Name: FUNCTION set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_team_okr_links(p_okr uuid, p_team_ids uuid[], p_member_ids uuid[]) TO service_role;


--
-- Name: FUNCTION shares_org_with(p_target uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.shares_org_with(p_target uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.shares_org_with(p_target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.shares_org_with(p_target uuid) TO service_role;


--
-- Name: FUNCTION sync_profile_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_profile_email() TO service_role;


--
-- Name: FUNCTION sync_task_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_task_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_task_status() TO service_role;


--
-- Name: FUNCTION sync_team_task_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_team_task_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_team_task_status() TO service_role;


--
-- Name: FUNCTION team_automation_before_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_automation_before_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_automation_before_write() TO service_role;


--
-- Name: FUNCTION team_okr_trash_guard(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_okr_trash_guard() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_okr_trash_guard() TO service_role;


--
-- Name: FUNCTION team_project_dependency_before_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_project_dependency_before_insert() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_project_dependency_before_insert() TO service_role;


--
-- Name: FUNCTION team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid) TO authenticated;
GRANT ALL ON FUNCTION public.team_project_dependency_would_cycle(p_project uuid, p_depends_on uuid) TO service_role;


--
-- Name: FUNCTION team_project_health_stamp(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_project_health_stamp() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_project_health_stamp() TO service_role;


--
-- Name: FUNCTION team_project_member_before_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_project_member_before_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_project_member_before_write() TO service_role;


--
-- Name: FUNCTION team_project_status_before_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_project_status_before_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_project_status_before_write() TO service_role;


--
-- Name: FUNCTION team_task_before_update(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_task_before_update() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_task_before_update() TO service_role;


--
-- Name: FUNCTION team_task_validation_gate(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_task_validation_gate() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_task_validation_gate() TO service_role;


--
-- Name: FUNCTION team_task_webhook_events(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.team_task_webhook_events() FROM PUBLIC;
GRANT ALL ON FUNCTION public.team_task_webhook_events() TO service_role;


--
-- Name: TABLE habits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.habits TO anon;
GRANT ALL ON TABLE public.habits TO authenticated;
GRANT ALL ON TABLE public.habits TO service_role;


--
-- Name: FUNCTION toggle_habit_completion(p_habit_id uuid, p_date text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_habit_completion(p_habit_id uuid, p_date text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_habit_completion(p_habit_id uuid, p_date text) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_habit_completion(p_habit_id uuid, p_date text) TO service_role;


--
-- Name: FUNCTION toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_habit_completion_v2(p_habit_id uuid, p_date text, p_days integer, p_today date) TO service_role;


--
-- Name: FUNCTION toggle_task_bookmark(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_task_bookmark(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_task_bookmark(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_task_bookmark(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION toggle_task_complete(p_task_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_task_complete(p_task_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_task_complete(p_task_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_task_complete(p_task_id uuid) TO service_role;


--
-- Name: FUNCTION toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.toggle_task_complete_v2(p_task_id uuid, p_next_deadline timestamp with time zone) TO service_role;


--
-- Name: FUNCTION touch_last_seen(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC;
GRANT ALL ON FUNCTION public.touch_last_seen() TO authenticated;
GRANT ALL ON FUNCTION public.touch_last_seen() TO service_role;


--
-- Name: FUNCTION track_hit(p jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_hit(p jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_hit(p jsonb) TO service_role;


--
-- Name: FUNCTION transfer_org_ownership(p_org uuid, p_new_owner uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.transfer_org_ownership(p_org uuid, p_new_owner uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transfer_org_ownership(p_org uuid, p_new_owner uuid) TO authenticated;
GRANT ALL ON FUNCTION public.transfer_org_ownership(p_org uuid, p_new_owner uuid) TO service_role;


--
-- Name: FUNCTION trash_team_okr(p_okr uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trash_team_okr(p_okr uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.trash_team_okr(p_okr uuid) TO authenticated;
GRANT ALL ON FUNCTION public.trash_team_okr(p_okr uuid) TO service_role;


--
-- Name: FUNCTION trash_team_task(p_task uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trash_team_task(p_task uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.trash_team_task(p_task uuid) TO authenticated;
GRANT ALL ON FUNCTION public.trash_team_task(p_task uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION validate_org_manager(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_org_manager() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_org_manager() TO service_role;


--
-- Name: FUNCTION validate_project_team(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_project_team() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_project_team() TO service_role;


--
-- Name: FUNCTION validate_task_dependency(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_task_dependency() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_task_dependency() TO service_role;


--
-- Name: FUNCTION validate_team_kr(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_kr() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_kr() TO service_role;


--
-- Name: FUNCTION validate_team_kr_contributors(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_kr_contributors() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_kr_contributors() TO service_role;


--
-- Name: FUNCTION validate_team_kr_project(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_kr_project() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_kr_project() TO service_role;


--
-- Name: FUNCTION validate_team_membership(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_membership() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_membership() TO service_role;


--
-- Name: FUNCTION validate_team_okr_parent(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_okr_parent() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_okr_parent() TO service_role;


--
-- Name: FUNCTION validate_team_okr_team(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_okr_team() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_okr_team() TO service_role;


--
-- Name: FUNCTION validate_team_task(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_task() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_task() TO service_role;


--
-- Name: FUNCTION validate_team_task_dependency(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.validate_team_task_dependency() FROM PUBLIC;
GRANT ALL ON FUNCTION public.validate_team_task_dependency() TO service_role;


--
-- Name: FUNCTION verify_payment_chain(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_payment_chain() FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_payment_chain() TO service_role;


--
-- Name: FUNCTION write_org_audit(p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_target_user uuid, p_meta jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.write_org_audit(p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_target_user uuid, p_meta jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.write_org_audit(p_org uuid, p_action text, p_target_type text, p_target_id uuid, p_target_user uuid, p_meta jsonb) TO service_role;


--
-- Name: TABLE account_inactivity_notices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.account_inactivity_notices TO service_role;


--
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_users TO anon;
GRANT ALL ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;


--
-- Name: TABLE affiliate_clicks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_clicks TO service_role;


--
-- Name: SEQUENCE affiliate_clicks_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.affiliate_clicks_id_seq TO service_role;


--
-- Name: TABLE affiliate_commissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_commissions TO service_role;


--
-- Name: SEQUENCE affiliate_commissions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.affiliate_commissions_id_seq TO service_role;


--
-- Name: TABLE affiliate_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_contacts TO service_role;


--
-- Name: TABLE affiliate_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_links TO service_role;


--
-- Name: TABLE affiliate_payouts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_payouts TO service_role;


--
-- Name: TABLE affiliate_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_settings TO service_role;


--
-- Name: TABLE affiliates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliates TO service_role;


--
-- Name: TABLE billing_acceptances; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_acceptances TO service_role;


--
-- Name: TABLE billing_flags; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_flags TO anon;
GRANT ALL ON TABLE public.billing_flags TO authenticated;
GRANT ALL ON TABLE public.billing_flags TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE cron_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cron_runs TO service_role;


--
-- Name: SEQUENCE cron_runs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.cron_runs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cron_runs_id_seq TO service_role;


--
-- Name: TABLE demo_devices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.demo_devices TO anon;
GRANT ALL ON TABLE public.demo_devices TO authenticated;
GRANT ALL ON TABLE public.demo_devices TO service_role;


--
-- Name: TABLE demo_conversion_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.demo_conversion_stats TO service_role;


--
-- Name: TABLE email_lookup_global; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_lookup_global TO service_role;


--
-- Name: TABLE email_lookup_quota; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_lookup_quota TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE friend_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.friend_requests TO anon;
GRANT ALL ON TABLE public.friend_requests TO authenticated;
GRANT ALL ON TABLE public.friend_requests TO service_role;


--
-- Name: TABLE habit_completions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.habit_completions TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.habit_completions TO authenticated;


--
-- Name: TABLE key_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.key_results TO anon;
GRANT ALL ON TABLE public.key_results TO authenticated;
GRANT ALL ON TABLE public.key_results TO service_role;


--
-- Name: TABLE kr_completions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kr_completions TO anon;
GRANT ALL ON TABLE public.kr_completions TO authenticated;
GRANT ALL ON TABLE public.kr_completions TO service_role;


--
-- Name: TABLE okrs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.okrs TO anon;
GRANT ALL ON TABLE public.okrs TO authenticated;
GRANT ALL ON TABLE public.okrs TO service_role;


--
-- Name: TABLE org_activity_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.org_activity_reports TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.org_activity_reports TO authenticated;
GRANT ALL ON TABLE public.org_activity_reports TO service_role;


--
-- Name: TABLE org_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_audit_log TO anon;
GRANT ALL ON TABLE public.org_audit_log TO authenticated;
GRANT ALL ON TABLE public.org_audit_log TO service_role;


--
-- Name: TABLE org_billing_contacts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_billing_contacts TO authenticated;
GRANT ALL ON TABLE public.org_billing_contacts TO service_role;


--
-- Name: TABLE org_invitations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_invitations TO anon;
GRANT ALL ON TABLE public.org_invitations TO authenticated;
GRANT ALL ON TABLE public.org_invitations TO service_role;


--
-- Name: TABLE org_invite_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_invite_links TO anon;
GRANT ALL ON TABLE public.org_invite_links TO authenticated;
GRANT ALL ON TABLE public.org_invite_links TO service_role;


--
-- Name: TABLE org_member_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_member_permissions TO anon;
GRANT ALL ON TABLE public.org_member_permissions TO authenticated;
GRANT ALL ON TABLE public.org_member_permissions TO service_role;


--
-- Name: TABLE org_member_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_member_roles TO authenticated;
GRANT ALL ON TABLE public.org_member_roles TO service_role;


--
-- Name: TABLE org_notification_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_notification_settings TO anon;
GRANT ALL ON TABLE public.org_notification_settings TO authenticated;
GRANT ALL ON TABLE public.org_notification_settings TO service_role;


--
-- Name: TABLE org_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_notifications TO anon;
GRANT ALL ON TABLE public.org_notifications TO authenticated;
GRANT ALL ON TABLE public.org_notifications TO service_role;


--
-- Name: TABLE org_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_roles TO authenticated;
GRANT ALL ON TABLE public.org_roles TO service_role;


--
-- Name: TABLE org_saved_views; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_saved_views TO anon;
GRANT ALL ON TABLE public.org_saved_views TO authenticated;
GRANT ALL ON TABLE public.org_saved_views TO service_role;


--
-- Name: TABLE org_seat_alerts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_seat_alerts TO service_role;


--
-- Name: SEQUENCE org_seat_alerts_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.org_seat_alerts_id_seq TO service_role;


--
-- Name: TABLE org_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_settings TO anon;
GRANT ALL ON TABLE public.org_settings TO authenticated;
GRANT ALL ON TABLE public.org_settings TO service_role;


--
-- Name: TABLE org_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_subscriptions TO service_role;
GRANT SELECT ON TABLE public.org_subscriptions TO authenticated;


--
-- Name: TABLE org_team_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_team_members TO anon;
GRANT ALL ON TABLE public.org_team_members TO authenticated;
GRANT ALL ON TABLE public.org_team_members TO service_role;


--
-- Name: TABLE org_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_teams TO anon;
GRANT ALL ON TABLE public.org_teams TO authenticated;
GRANT ALL ON TABLE public.org_teams TO service_role;


--
-- Name: TABLE org_verified_domains; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_verified_domains TO anon;
GRANT ALL ON TABLE public.org_verified_domains TO authenticated;
GRANT ALL ON TABLE public.org_verified_domains TO service_role;


--
-- Name: TABLE org_webhook_deliveries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_webhook_deliveries TO anon;
GRANT ALL ON TABLE public.org_webhook_deliveries TO authenticated;
GRANT ALL ON TABLE public.org_webhook_deliveries TO service_role;


--
-- Name: TABLE org_webhooks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_webhooks TO anon;
GRANT ALL ON TABLE public.org_webhooks TO authenticated;
GRANT ALL ON TABLE public.org_webhooks TO service_role;


--
-- Name: TABLE org_weekly_reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_weekly_reviews TO anon;
GRANT ALL ON TABLE public.org_weekly_reviews TO authenticated;
GRANT ALL ON TABLE public.org_weekly_reviews TO service_role;


--
-- Name: TABLE org_withdrawals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.org_withdrawals TO service_role;


--
-- Name: TABLE organization_join_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization_join_requests TO anon;
GRANT ALL ON TABLE public.organization_join_requests TO authenticated;
GRANT ALL ON TABLE public.organization_join_requests TO service_role;


--
-- Name: TABLE organization_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.organization_members TO anon;
GRANT ALL ON TABLE public.organization_members TO authenticated;
GRANT ALL ON TABLE public.organization_members TO service_role;


--
-- Name: SEQUENCE payment_records_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.payment_records_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_records_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_records_id_seq TO service_role;


--
-- Name: TABLE processed_stripe_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.processed_stripe_events TO anon;
GRANT ALL ON TABLE public.processed_stripe_events TO authenticated;
GRANT ALL ON TABLE public.processed_stripe_events TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(display_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(avatar_url) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rate_limits TO service_role;


--
-- Name: TABLE renewal_notices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.renewal_notices TO service_role;


--
-- Name: SEQUENCE renewal_notices_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.renewal_notices_id_seq TO anon;
GRANT ALL ON SEQUENCE public.renewal_notices_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.renewal_notices_id_seq TO service_role;


--
-- Name: TABLE share_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.share_links TO anon;
GRANT ALL ON TABLE public.share_links TO authenticated;
GRANT ALL ON TABLE public.share_links TO service_role;


--
-- Name: TABLE shared_lists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shared_lists TO anon;
GRANT ALL ON TABLE public.shared_lists TO authenticated;
GRANT ALL ON TABLE public.shared_lists TO service_role;


--
-- Name: TABLE shared_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.shared_tasks TO anon;
GRANT ALL ON TABLE public.shared_tasks TO authenticated;
GRANT ALL ON TABLE public.shared_tasks TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE support_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.support_reports TO anon;
GRANT ALL ON TABLE public.support_reports TO authenticated;
GRANT ALL ON TABLE public.support_reports TO service_role;


--
-- Name: TABLE task_dependencies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.task_dependencies TO anon;
GRANT ALL ON TABLE public.task_dependencies TO authenticated;
GRANT ALL ON TABLE public.task_dependencies TO service_role;


--
-- Name: TABLE tasks_pending_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tasks_pending_invites TO anon;
GRANT ALL ON TABLE public.tasks_pending_invites TO authenticated;
GRANT ALL ON TABLE public.tasks_pending_invites TO service_role;


--
-- Name: TABLE team_automations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_automations TO anon;
GRANT ALL ON TABLE public.team_automations TO authenticated;
GRANT ALL ON TABLE public.team_automations TO service_role;


--
-- Name: TABLE team_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_categories TO anon;
GRANT ALL ON TABLE public.team_categories TO authenticated;
GRANT ALL ON TABLE public.team_categories TO service_role;


--
-- Name: TABLE team_key_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_key_results TO anon;
GRANT ALL ON TABLE public.team_key_results TO authenticated;
GRANT ALL ON TABLE public.team_key_results TO service_role;


--
-- Name: TABLE team_kr_checkins; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_kr_checkins TO anon;
GRANT ALL ON TABLE public.team_kr_checkins TO authenticated;
GRANT ALL ON TABLE public.team_kr_checkins TO service_role;


--
-- Name: TABLE team_kr_projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_kr_projects TO anon;
GRANT ALL ON TABLE public.team_kr_projects TO authenticated;
GRANT ALL ON TABLE public.team_kr_projects TO service_role;


--
-- Name: TABLE team_labels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_labels TO anon;
GRANT ALL ON TABLE public.team_labels TO authenticated;
GRANT ALL ON TABLE public.team_labels TO service_role;


--
-- Name: TABLE team_list_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_list_tasks TO authenticated;
GRANT ALL ON TABLE public.team_list_tasks TO service_role;


--
-- Name: TABLE team_lists; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_lists TO authenticated;
GRANT ALL ON TABLE public.team_lists TO service_role;


--
-- Name: TABLE team_okr_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_okr_members TO authenticated;
GRANT ALL ON TABLE public.team_okr_members TO service_role;


--
-- Name: TABLE team_okr_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_okr_teams TO anon;
GRANT ALL ON TABLE public.team_okr_teams TO authenticated;
GRANT ALL ON TABLE public.team_okr_teams TO service_role;


--
-- Name: TABLE team_okrs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_okrs TO anon;
GRANT ALL ON TABLE public.team_okrs TO authenticated;
GRANT ALL ON TABLE public.team_okrs TO service_role;


--
-- Name: TABLE team_project_followers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_project_followers TO anon;
GRANT ALL ON TABLE public.team_project_followers TO authenticated;
GRANT ALL ON TABLE public.team_project_followers TO service_role;


--
-- Name: TABLE team_project_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_project_messages TO authenticated;
GRANT ALL ON TABLE public.team_project_messages TO service_role;


--
-- Name: TABLE team_project_statuses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_project_statuses TO anon;
GRANT ALL ON TABLE public.team_project_statuses TO authenticated;
GRANT ALL ON TABLE public.team_project_statuses TO service_role;


--
-- Name: TABLE team_project_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_project_teams TO authenticated;
GRANT ALL ON TABLE public.team_project_teams TO service_role;


--
-- Name: TABLE team_task_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_task_activity TO anon;
GRANT ALL ON TABLE public.team_task_activity TO authenticated;
GRANT ALL ON TABLE public.team_task_activity TO service_role;


--
-- Name: TABLE team_task_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_task_comments TO anon;
GRANT ALL ON TABLE public.team_task_comments TO authenticated;
GRANT ALL ON TABLE public.team_task_comments TO service_role;


--
-- Name: TABLE team_task_followers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_task_followers TO anon;
GRANT ALL ON TABLE public.team_task_followers TO authenticated;
GRANT ALL ON TABLE public.team_task_followers TO service_role;


--
-- Name: TABLE team_task_labels; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_task_labels TO anon;
GRANT ALL ON TABLE public.team_task_labels TO authenticated;
GRANT ALL ON TABLE public.team_task_labels TO service_role;


--
-- Name: TABLE team_task_subtasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_task_subtasks TO anon;
GRANT ALL ON TABLE public.team_task_subtasks TO authenticated;
GRANT ALL ON TABLE public.team_task_subtasks TO service_role;


--
-- Name: TABLE traffic_hits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.traffic_hits TO service_role;


--
-- Name: SEQUENCE traffic_hits_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.traffic_hits_id_seq TO anon;
GRANT ALL ON SEQUENCE public.traffic_hits_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.traffic_hits_id_seq TO service_role;


--
-- Name: TABLE traffic_salts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.traffic_salts TO service_role;


--
-- Name: TABLE user_activity_days; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_activity_days TO anon;
GRANT ALL ON TABLE public.user_activity_days TO authenticated;
GRANT ALL ON TABLE public.user_activity_days TO service_role;


--
-- Name: TABLE withdrawal_consents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.withdrawal_consents TO anon;
GRANT ALL ON TABLE public.withdrawal_consents TO authenticated;
GRANT ALL ON TABLE public.withdrawal_consents TO service_role;


--
-- Name: SEQUENCE withdrawal_consents_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.withdrawal_consents_id_seq TO anon;
GRANT ALL ON SEQUENCE public.withdrawal_consents_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.withdrawal_consents_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

-- ─── Objets poses hors du schema `public` par les migrations ───

-- Triggers hors `public` qui appellent une fonction de `public`

CREATE TRIGGER on_auth_user_created_seed_categories AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION seed_default_categories();
CREATE TRIGGER trg_create_profile_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
CREATE TRIGGER trg_sync_profile_email AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION sync_profile_email();
CREATE TRIGGER trg_sync_profile_on_update AFTER UPDATE ON auth.users FOR EACH ROW WHEN ((old.raw_user_meta_data IS DISTINCT FROM new.raw_user_meta_data)) EXECUTE FUNCTION handle_new_user_profile();

-- Policies hors `public`

CREATE POLICY "avatars_owner_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
CREATE POLICY "avatars_owner_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
CREATE POLICY "avatars_owner_update" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
CREATE POLICY "avatars_public_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));

-- storage.buckets (id, public, file_size_limit, allowed_mime_types)

-- avatars | public=true | limit=524288 | mime=image/jpeg,image/png,image/webp

-- pg_cron (nom, planning, commande)

SELECT cron.schedule('cosmo-activity-reports', '2 * * * *', 'SELECT public.generate_due_activity_reports();');
SELECT cron.schedule('cosmo-cron-runs-close', '*/5 * * * *', 'SELECT public.cron_runs_close();');
SELECT cron.schedule('cosmo-expire-org-roles', '7 * * * *', 'SELECT public.expire_org_member_roles();');
SELECT cron.schedule('cosmo-inactive-accounts', '37 6 * * *', 'SELECT public.cron_invoke(''inactive-accounts'');');
SELECT cron.schedule('cosmo-kr-due', '5 6 * * *', 'SELECT public.notify_kr_due();');
SELECT cron.schedule('cosmo-org-digest-daily', '41 7 * * *', 'SELECT public.cron_invoke(''org-digest-daily'');');
SELECT cron.schedule('cosmo-org-digest-hourly', '23 * * * *', 'SELECT public.cron_invoke(''org-digest-hourly'');');
SELECT cron.schedule('cosmo-org-webhook-dispatch', '7-59/10 * * * *', 'SELECT public.cron_invoke(''org-webhook-dispatch'');');
SELECT cron.schedule('cosmo-overdue-reminders', '0 7 * * *', 'SELECT public.run_overdue_reminders();');
SELECT cron.schedule('cosmo-prune-declined-invitations', '30 3 * * *', 'SELECT public.prune_declined_org_invitations();');
SELECT cron.schedule('cosmo-purge-email-invitations', '50 3 * * *', 'SELECT public.purge_expired_email_invitations();');
SELECT cron.schedule('cosmo-purge-org-audit-log', '55 3 * * *', 'SELECT public.purge_org_audit_log();');
SELECT cron.schedule('cosmo-purge-team-okr-trash', '47 3 * * *', 'SELECT public.purge_team_okr_trash();');
SELECT cron.schedule('cosmo-purge-team-task-trash', '45 3 * * *', 'SELECT public.purge_team_task_trash();');
SELECT cron.schedule('cosmo-purge-traffic', '17 0 * * *', 'SELECT public.purge_traffic();');
SELECT cron.schedule('cosmo-purge-webhook-deliveries', '35 4 * * *', 'DELETE FROM public.org_webhook_deliveries WHERE created_at < now() - interval ''7 days'';');
SELECT cron.schedule('cosmo-renewal-notice', '12 7 * * *', 'SELECT public.cron_invoke(''renewal-notice'');');
SELECT cron.schedule('cosmo-seat-alert', '14 7 * * *', 'SELECT public.cron_invoke(''seat-alert'');');
