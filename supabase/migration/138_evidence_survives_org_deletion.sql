-- ═══════════════════════════════════════════════════════════════════
-- 138 — les preuves L215-1 et L221-28 survivent à la suppression de l'org
-- ═══════════════════════════════════════════════════════════════════
--
-- 🔴 POURQUOI (findings C-30 et C-39).
--
-- `renewal_notices` (avis de reconduction tacite, Conso. art. L215-1) et
-- `withdrawal_consents` (renonciation au droit de rétractation, art. L221-28,
-- 13°) référençaient `organizations(id)` en **ON DELETE CASCADE**.
--
-- Les deux tables sont décrites partout dans ce dépôt comme « une pièce à
-- produire, jamais un cache », append-only et immuables par trigger. Le
-- trigger empêche de les MODIFIER ; il n'empêchait pas de les faire
-- DISPARAÎTRE par en dessous.
--
-- Deux chemins y menaient, et c'est ce qui rend le correctif urgent :
--   1. `delete-account` laisse volontairement la cascade agir quand le
--      propriétaire est le seul membre (C-30) ;
--   2. un bouton rouge dans `/entreprise`, atteignable par N'IMPORTE QUEL
--      admin, pas seulement le propriétaire (C-39) — chemin bien plus court.
--
-- Scénario d'échec : un client résilie, conteste la reconduction, puis
-- supprime son compte. La preuve qu'on lui a bien adressé l'avis a disparu
-- avec l'organisation. **La charge de la preuve est sur le professionnel.**
--
-- `payment_records` était déjà en `ON DELETE SET NULL` : c'est le bon motif,
-- appliqué à une seule des trois tables de preuve. Cette migration l'étend aux
-- deux autres.
--
-- ── CE QUI RESTE DANS UNE LIGNE ORPHELINE, ET POURQUOI ÇA SUFFIT ────
--
-- 🔴 Une preuve dont on efface l'objet ne prouve plus rien : la question n'est
-- pas rhétorique, elle décide si `SET NULL` est acceptable ici.
--
--   • `renewal_notices` garde `recipient` (l'adresse), `period_end` (le terme
--     concerné) et `sent_at`. Elle dit donc encore « cet avis, pour ce terme,
--     a été adressé à cette adresse, ce jour-là » — c'est exactement l'énoncé
--     que l'article L215-1 demande de pouvoir produire.
--   • `withdrawal_consents` garde `user_id`, `tier_key`, `billing_interval`,
--     les deux booléens et `consented_at`. Elle dit « cette personne a accepté
--     l'exécution immédiate ET renoncé à se rétracter, pour ce palier, ce
--     jour-là ».
--
-- Dans les deux cas l'organisation n'existe plus : c'est précisément la
-- situation où l'on produit la preuve, pas celle où on la range.
--
-- ── LES DEUX OBSTACLES TECHNIQUES, ET LEUR TRAITEMENT ───────────────
--
-- 1. `renewal_notices` a pour clé primaire `(org_id, period_end)`. `SET NULL`
--    est donc impossible en l'état : une colonne de PK ne peut pas être NULL.
--    On pose une clé de substitution et on redescend `(org_id, period_end)` en
--    contrainte UNIQUE. ⚠️ Une CONTRAINTE et pas un simple index : c'est elle
--    que vise l'`ON CONFLICT` implicite du `insert()` de la Edge Function, dont
--    l'idempotence garantit qu'on n'envoie pas deux fois le même avis. Le
--    `23505` que la fonction sait déjà ignorer continue donc d'arriver.
--    ⚠️ UNIQUE tolère plusieurs NULL : deux lignes orphelines du même terme
--    peuvent coexister. C'est voulu — ce sont des archives, plus des clés.
--
-- 2. `withdrawal_consents` porte un trigger `BEFORE UPDATE OR DELETE` qui
--    refuse TOUTE mutation. Or `ON DELETE SET NULL` est un UPDATE : sans
--    retouche, la suppression d'une organisation échouerait, et on aurait
--    remplacé une perte de preuve par un blocage.
--    Le trigger autorise donc EXACTEMENT UNE mutation : le détachement
--    `org_id: <uuid> → NULL`, **toutes les autres colonnes inchangées**. Tout
--    le reste, DELETE compris, reste refusé.
--    ❌ Ne jamais élargir cette exception à « les UPDATE qui ne touchent que
--       org_id » sans exiger la valeur NULL en cible : réaffecter une preuve à
--       une AUTRE organisation serait une falsification, pas un détachement.
--
-- ── VÉRIFICATION ATTENDUE (transaction ANNULÉE) ─────────────────────
--
--   • supprimer une organisation portant une ligne dans chaque table :
--     l'organisation part, les DEUX lignes restent, `org_id` à NULL ;
--   • un UPDATE qui change autre chose que `org_id` : toujours refusé ;
--   • un UPDATE qui met `org_id` à une AUTRE organisation : toujours refusé ;
--   • un DELETE direct sur `withdrawal_consents` : toujours refusé ;
--   • réinsérer le même `(org_id, period_end)` : toujours `23505`.
--
-- Exposition actuelle : NULLE (0 ligne dans les deux tables, 0
-- `org_subscriptions`, rien n'est encaissé). C'est le moment le moins cher, et
-- le jour d'après il est irrattrapable.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. renewal_notices : clé de substitution, puis SET NULL ────────

-- `BIGSERIAL` n'existe pas en ajout de colonne : on pose la séquence à la
-- main, ce qui rend aussi le bloc rejouable sans effet.
CREATE SEQUENCE IF NOT EXISTS public.renewal_notices_id_seq;

ALTER TABLE public.renewal_notices
  ADD COLUMN IF NOT EXISTS id BIGINT NOT NULL DEFAULT nextval('public.renewal_notices_id_seq');

ALTER SEQUENCE public.renewal_notices_id_seq OWNED BY public.renewal_notices.id;

DO $mig$
BEGIN
  -- La PK composite descend en contrainte UNIQUE, et `id` devient la PK.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.renewal_notices'::regclass
       AND contype  = 'p'
       AND array_length(conkey, 1) = 2
  ) THEN
    ALTER TABLE public.renewal_notices DROP CONSTRAINT renewal_notices_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.renewal_notices'::regclass
       AND contype  = 'p'
  ) THEN
    ALTER TABLE public.renewal_notices ADD PRIMARY KEY (id);
  END IF;

  -- ⚠️ Une CONTRAINTE, pas un simple index : c'est elle que vise l'`ON
  -- CONFLICT` implicite du `insert()` de `renewal-notice`, dont l'idempotence
  -- garantit qu'un même terme ne reçoit pas deux avis. Le `23505` que la
  -- fonction sait déjà ignorer continue donc d'arriver.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.renewal_notices'::regclass
       AND conname  = 'renewal_notices_org_period_key'
  ) THEN
    ALTER TABLE public.renewal_notices
      ADD CONSTRAINT renewal_notices_org_period_key UNIQUE (org_id, period_end);
  END IF;
END;
$mig$;

ALTER TABLE public.renewal_notices ALTER COLUMN org_id DROP NOT NULL;

ALTER TABLE public.renewal_notices
  DROP CONSTRAINT IF EXISTS renewal_notices_org_id_fkey;
ALTER TABLE public.renewal_notices
  ADD CONSTRAINT renewal_notices_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.renewal_notices.org_id IS
  'NULL = organisation supprimee depuis. La preuve SURVIT : recipient, period_end et sent_at disent encore a qui, pour quel terme et quand l avis a ete adresse. Etait ON DELETE CASCADE jusqu a la mig. 138 (finding C-30).';

-- ─── 2. withdrawal_consents : SET NULL, et le trigger l'autorise ────

ALTER TABLE public.withdrawal_consents ALTER COLUMN org_id DROP NOT NULL;

ALTER TABLE public.withdrawal_consents
  DROP CONSTRAINT IF EXISTS withdrawal_consents_org_id_fkey;
ALTER TABLE public.withdrawal_consents
  ADD CONSTRAINT withdrawal_consents_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.withdrawal_consents.org_id IS
  'NULL = organisation supprimee depuis. La preuve SURVIT : user_id, tier_key, billing_interval, les deux booleens et consented_at disent encore qui a renonce, a quoi et quand. Etait ON DELETE CASCADE jusqu a la mig. 138 (finding C-30).';

-- Le trigger d'immuabilité refusait TOUTE mutation, donc aussi le `SET NULL`
-- de la FK ci-dessus — la suppression d'une organisation aurait ÉCHOUÉ, et on
-- aurait remplacé une perte de preuve par un blocage.
--
-- Il autorise désormais EXACTEMENT UNE mutation : le détachement
-- `org_id -> NULL`, toutes les autres colonnes inchangées.
--
-- ❌ Ne jamais élargir à « les UPDATE qui ne touchent que org_id » sans exiger
--    NULL en cible : réaffecter une preuve à une AUTRE organisation serait une
--    falsification, pas un détachement.
--
-- SECURITY INVOKER (défaut) : une garde ne doit jamais être DEFINER, sinon ses
-- messages d'erreur deviennent un oracle sur des lignes non lisibles
-- (mig. 064b, 094b, 108).

CREATE OR REPLACE FUNCTION public.forbid_consent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.forbid_consent_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.forbid_consent_mutation() FROM anon;
-- `REVOKE FROM PUBLIC` ne retire PAS un droit accordé explicitement à
-- `authenticated` : les deux révocations sont nécessaires (mig. 094b).
REVOKE EXECUTE ON FUNCTION public.forbid_consent_mutation() FROM authenticated;

-- ─── 3. C-39 : supprimer l'entreprise est un geste de PROPRIÉTAIRE ──
--
-- `delete_organization` n'exigeait que `is_org_admin`, pas le propriétaire.
-- Scénario d'échec : une entreprise a deux admins ; le second, qui ne paie
-- rien, supprime l'organisation. Le propriétaire continue d'être débité (la
-- cascade emporte `org_subscriptions`, l'abonnement Stripe lui continue de
-- courir), n'a plus d'organisation, et la preuve de sa renonciation au droit
-- de rétractation a disparu avec.
--
-- Le bouton « Transférer la propriété », juste à côté dans le même écran,
-- était DÉJÀ réservé au propriétaire : la restriction existait, elle n'avait
-- pas été portée sur le geste destructeur.
--
-- ❌ Ne pas se contenter de masquer le bouton côté client : `organizations`
--    n'a aucune policy DELETE, cette RPC est la seule porte, c'est donc ici
--    que la règle doit vivre.

CREATE OR REPLACE FUNCTION public.delete_organization(p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
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

  -- Un abonnement encore vivant se résilie AVANT. Sans cette garde, on
  -- supprime la ligne que le webhook Stripe vient mettre à jour : le prochain
  -- event tenterait un upsert sur une clé étrangère morte, et le client
  -- continuerait d'être débité pour une organisation qui n'existe plus.
  IF EXISTS (
    SELECT 1 FROM public.org_subscriptions
     WHERE org_id = p_org
       AND status IN ('active', 'trialing', 'past_due')
  ) THEN
    RAISE EXCEPTION 'org_has_active_subscription';
  END IF;

  DELETE FROM public.organizations WHERE id = p_org;
END;
$fn$;

REVOKE ALL ON FUNCTION public.delete_organization(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_organization(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_organization(UUID) TO authenticated;

