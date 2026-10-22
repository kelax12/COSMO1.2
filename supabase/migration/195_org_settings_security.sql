-- ═══════════════════════════════════════════════════════════════════
-- 195 · Réglages propres à l'organisation et rubrique Sécurité
--       (audit du mode Entreprise, 2026-09-24 : « aucun réglage propre à
--       l'organisation », M13 « pas de rubrique Sécurité »)
--
-- ⚠️ ÉCRITE LE 2026-09-26, NON APPLIQUÉE. Ordre : APRÈS 164, 181, 190-194.
--
-- ── CE QUE CETTE MIGRATION AJOUTE ──────────────────────────────────
--
-- 1. `org_settings` : une ligne par organisation (absente = défauts).
--      · langue et fuseau de l'organisation (e-mails, résumé quotidien) ;
--      · premier jour de semaine et jours ouvrés (frise, capacité, résumé) ;
--      · règles par défaut : priorité d'une tâche neuve, audience proposée
--        pour un projet neuf, durée d'accès proposée pour un invité ;
--      · sécurité : invitations nominatives limitées aux domaines vérifiés.
-- 2. `org_verified_domains` : domaines de l'organisation. Un domaine se
--    DÉCLARE (admin) puis se VÉRIFIE par un enregistrement DNS TXT, lu par
--    l'Edge Function `verify-org-domain` (service role). Le client ne peut
--    jamais écrire `verified_at` : ni policy UPDATE, et un INSERT le refuse.
-- 3. Trigger sur `org_invite_links` : si l'organisation limite ses
--    invitations, une invitation NOMINATIVE hors domaine vérifié est refusée
--    (`email_domain_not_allowed`), quel que soit le chemin d'écriture (RPC
--    `create_org_email_invitations` ou insertion directe d'un manager).
--
-- ── RÈGLES ─────────────────────────────────────────────────────────
--
--   · Lecture : tout membre actif (la langue, les jours ouvrés, les domaines
--     servent l'affichage de tous). Un domaine n'est pas un secret, son jeton
--     non plus : il est PUBLIÉ dans le DNS.
--   · Écriture : admins seulement (`is_org_admin`).
--   · Triggers `SECURITY INVOKER`, révoqués à anon/authenticated.
--   · Aucune colonne `user_id` : rien à effacer avec un compte ; `created_by`
--     passe à NULL quand son auteur disparaît.
--   · Les liens OUVERTS et le code d'accès ne portent pas d'adresse : la
--     limitation ne les couvre pas, et l'écran le dit.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Réglages ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_settings (
  org_id                   UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  locale                   TEXT NOT NULL DEFAULT 'fr',
  timezone                 TEXT NOT NULL DEFAULT 'Europe/Paris',
  week_start               SMALLINT NOT NULL DEFAULT 1,
  work_days                SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  default_task_priority    SMALLINT NOT NULL DEFAULT 3,
  default_project_audience TEXT NOT NULL DEFAULT 'team',
  default_guest_days       SMALLINT,
  invite_domain_only       BOOLEAN NOT NULL DEFAULT false,
  updated_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_settings_locale CHECK (locale IN ('fr', 'en')),
  CONSTRAINT org_settings_week_start CHECK (week_start BETWEEN 0 AND 6),
  CONSTRAINT org_settings_work_days CHECK (
    cardinality(work_days) BETWEEN 1 AND 7 AND work_days <@ '{0,1,2,3,4,5,6}'::smallint[]
  ),
  CONSTRAINT org_settings_priority CHECK (default_task_priority BETWEEN 1 AND 5),
  CONSTRAINT org_settings_audience CHECK (default_project_audience IN ('org', 'team')),
  CONSTRAINT org_settings_guest_days CHECK (default_guest_days IS NULL OR default_guest_days BETWEEN 1 AND 365)
);

-- Fuseau : un nom IANA connu de Postgres, sinon une date du résumé tomberait
-- n'importe où. Auteur et horodatage posés par la base, jamais par le client.
CREATE OR REPLACE FUNCTION public.org_settings_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = NEW.timezone) THEN
    RAISE EXCEPTION 'invalid_timezone' USING ERRCODE = '22023';
  END IF;
  NEW.work_days := ARRAY(SELECT DISTINCT d FROM unnest(NEW.work_days) d ORDER BY d);
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_settings_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_settings_before_write ON public.org_settings;
CREATE TRIGGER trg_org_settings_before_write
  BEFORE INSERT OR UPDATE ON public.org_settings
  FOR EACH ROW EXECUTE FUNCTION public.org_settings_before_write();

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_settings_select" ON public.org_settings;
CREATE POLICY "org_settings_select" ON public.org_settings FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_settings_insert" ON public.org_settings;
CREATE POLICY "org_settings_insert" ON public.org_settings FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_settings_update" ON public.org_settings;
CREATE POLICY "org_settings_update" ON public.org_settings FOR UPDATE
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

-- ── 2. Domaines vérifiés ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_verified_domains (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain             TEXT NOT NULL,
  verification_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  verified_at        TIMESTAMPTZ,
  last_checked_at    TIMESTAMPTZ,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_verified_domains_shape CHECK (
    domain = lower(domain)
    AND char_length(domain) BETWEEN 4 AND 253
    AND domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  CONSTRAINT org_verified_domains_unique UNIQUE (org_id, domain)
);

-- Un domaine VÉRIFIÉ n'appartient qu'à une organisation : deux entreprises
-- ne peuvent pas revendiquer la même adresse.
CREATE UNIQUE INDEX IF NOT EXISTS ux_org_verified_domains_owner
  ON public.org_verified_domains (domain) WHERE verified_at IS NOT NULL;

-- 20 domaines au plus ; jamais de vérification posée par le client.
CREATE OR REPLACE FUNCTION public.org_verified_domain_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.org_verified_domain_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_verified_domain_before_insert ON public.org_verified_domains;
CREATE TRIGGER trg_org_verified_domain_before_insert
  BEFORE INSERT ON public.org_verified_domains
  FOR EACH ROW EXECUTE FUNCTION public.org_verified_domain_before_insert();

ALTER TABLE public.org_verified_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_verified_domains_select" ON public.org_verified_domains;
CREATE POLICY "org_verified_domains_select" ON public.org_verified_domains FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_verified_domains_insert" ON public.org_verified_domains;
CREATE POLICY "org_verified_domains_insert" ON public.org_verified_domains FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_verified_domains_delete" ON public.org_verified_domains;
CREATE POLICY "org_verified_domains_delete" ON public.org_verified_domains FOR DELETE
  USING (public.is_org_admin(org_id));
-- Pas de policy UPDATE : `verified_at` ne s'écrit que par `verify-org-domain`.

-- ── 3. Invitations limitées aux domaines vérifiés ─────────────────

CREATE OR REPLACE FUNCTION public.enforce_org_invite_domain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;  -- lien ouvert : sans adresse, rien à comparer
  END IF;
  IF EXISTS (SELECT 1 FROM public.org_settings s WHERE s.org_id = NEW.org_id AND s.invite_domain_only)
     AND NOT EXISTS (
       SELECT 1 FROM public.org_verified_domains d
        WHERE d.org_id = NEW.org_id
          AND d.verified_at IS NOT NULL
          AND d.domain = lower(split_part(NEW.email, '@', 2))
     ) THEN
    RAISE EXCEPTION 'email_domain_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_org_invite_domain() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_org_invite_domain ON public.org_invite_links;
CREATE TRIGGER trg_enforce_org_invite_domain
  BEFORE INSERT ON public.org_invite_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_org_invite_domain();

COMMIT;
