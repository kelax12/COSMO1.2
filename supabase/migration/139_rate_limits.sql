-- ═══════════════════════════════════════════════════════════════════
-- 139 — plafond de débit serveur, par fenêtre glissante
-- ═══════════════════════════════════════════════════════════════════
--
-- 🔴 POURQUOI (finding C-31).
--
-- `report-bug` est un relais d'e-mail OUVERT. La fonction est en
-- `verify_jwt: true`, mais **la clé anon suffit** — elle est dans le bundle
-- client, donc publique — et c'est volontaire : on veut pouvoir signaler un
-- bug depuis un compte cassé. Il n'y avait ensuite ni CAPTCHA, ni throttle
-- client, ni compteur serveur, ni plafond par IP.
--
-- Mesuré le 2026-09-03 : `POST /functions/v1/report-bug` avec la seule clé
-- anon répond `400 invalid_body`. Le corps est donc atteint sans compte.
--
-- Scénario d'échec : une boucle de quelques lignes poste des rapports valides
-- avec 3 Mo de pièce jointe. Chaque appel est un e-mail réel expédié par notre
-- compte Resend. Quota épuisé, boîte de contact noyée, et surtout **réputation
-- d'expéditeur du domaine abîmée** — celle-là met des mois à se reconstruire,
-- et c'est le même domaine qui porte les e-mails d'authentification et les
-- avis de reconduction (Conso. L215-1). Un seul abus coupe l'inscription ET la
-- conformité, pour tout le monde.
--
-- ❌ Le CAPTCHA n'est PAS retenu (arbitrage du 2026-09-03) : il ne protège pas
--    d'un appel DIRECT à la fonction, qui est précisément le chemin de l'abus.
--
-- ── CE QUI EST STOCKÉ, ET CE QUI NE L'EST PAS ───────────────────────
--
-- 🔴 AUCUNE ADRESSE IP EN CLAIR. Une IP est une donnée à caractère personnel
-- (RGPD, et le registre art. 30 du dépôt n'en déclare aucune pour cette
-- fonction). La clé stockée est un HACHAGE tronqué de `<sel> || <ip>`, où le
-- sel est un secret d'environnement : sans lui, une IP ne se retrouve pas par
-- force brute sur les 4 milliards d'adresses IPv4.
--
-- La table ne contient donc qu'un opaque, un compteur et une fenêtre. Rien
-- n'y désigne quiconque, et elle se purge d'elle-même.
--
-- ── FENÊTRE GLISSANTE, PAS SEAU FIXE ────────────────────────────────
--
-- Un seau fixe (« N par heure calendaire ») laisse passer 2N à cheval sur deux
-- heures. On garde donc l'horodatage du DÉBUT de fenêtre et on la fait glisser
-- quand elle a expiré, ce qui est le comportement que l'abus contourne le
-- moins facilement pour un coût d'écriture identique.
--
-- ── POURQUOI UNE RPC ET PAS UN COMPTAGE DANS LA FONCTION ────────────
--
-- La lecture, la décision et l'incrément doivent être ATOMIQUES : deux appels
-- concurrents qui lisent « 2 » et écrivent « 3 » laissent passer un appel de
-- trop. `INSERT … ON CONFLICT DO UPDATE … RETURNING` fait les trois en une
-- instruction, sous le verrou de ligne de Postgres.
--
-- ── VÉRIFICATION ATTENDUE (transaction ANNULÉE) ─────────────────────
--
-- 🔴 LA FRONTIÈRE EST LE CAS INTÉRESSANT, et la première écriture de cette
-- migration s'y trompait (cf. le commentaire sur `> p_limit` plus bas). Avec
-- `p_limit = 3`, la séquence exacte à vérifier est :
--
--   appel 1 → TRUE  (hits = 1)
--   appel 2 → TRUE  (hits = 2)
--   appel 3 → TRUE  (hits = 3)   ← le dernier accepté
--   appel 4 → FALSE (hits = 4)   ← le premier refusé
--   appel 5 → FALSE (hits = 4)   ← le compteur NE monte plus
--
-- ❌ Ne PAS se contenter de « trois appels passent » : c'est vrai des deux
--    versions, fausse comprise. C'est le QUATRIÈME qui distingue.
--
-- Le reste :
--   • fenêtre expirée : le compteur repart à 1 ;
--   • deux clés différentes ne se gênent pas ;
--   • `authenticated` ne peut PAS appeler la fonction (`permission denied`) ;
--   • une clé vide ou un plafond < 1 rendent FALSE, pas TRUE.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rate_limits (
  -- Opaque : « <domaine>:<hachage tronqué> ». Jamais une IP, jamais un e-mail.
  bucket_key   TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits         INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rate_limits IS
  'Compteurs de debit, fenetre glissante. Le bucket_key est un opaque (hachage sale), JAMAIS une IP ni un email : rien ici ne designe quelqu un. Purgeable a volonte, c est un cache de defense, pas une preuve.';

-- Purge : une ligne dont la fenêtre est finie depuis longtemps ne sert plus.
CREATE INDEX IF NOT EXISTS idx_rate_limits_stale
  ON public.rate_limits (updated_at);

-- Personne d'autre que le propriétaire (donc les fonctions `SECURITY DEFINER`
-- et `service_role`) ne touche cette table. RLS active et AUCUNE policy : la
-- table est fermée par défaut, c'est le comportement voulu.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- ─── La décision, atomique ──────────────────────────────────────────
--
-- Rend TRUE si l'appel est autorisé, FALSE s'il dépasse le plafond.
--
-- ⚠️ En cas de dépassement, le compteur N'EST PAS incrémenté. Sinon un abus
--    qui continue de taper repousse indéfiniment sa propre fin de fenêtre :
--    la punition devient permanente, et un utilisateur légitime derrière la
--    même IP partagée (entreprise, université, opérateur mobile) ne repasse
--    jamais.
--
-- `SECURITY DEFINER` est ici légitime et nécessaire : la fonction ÉCRIT dans
-- une table à laquelle l'appelant n'a aucun droit. Ce n'est pas une garde de
-- validation (celles-là restent `INVOKER`, finding B-3) — c'est un compteur
-- partagé, la famille de `credit_premium_token_from_ad`.

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key    TEXT,
  p_limit  INTEGER,
  p_window INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTERVAL) FROM anon;
-- ❌ PAS de GRANT à `authenticated` : seul `service_role`, depuis une Edge
--    Function, décide d'un plafond. Un client qui pourrait appeler cette
--    fonction pourrait épuiser le compteur de quelqu'un d'autre en devinant sa
--    clé — un déni de service ciblé offert par la défense elle-même.

-- ─── Purge des compteurs morts ──────────────────────────────────────
--
-- Appelée opportunément par la Edge Function (une fois sur cent, sans bloquer
-- la réponse) : pas de cron à poser, et la table reste bornée.

CREATE OR REPLACE FUNCTION public.purge_stale_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.rate_limits WHERE updated_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.purge_stale_rate_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_stale_rate_limits() FROM anon;
REVOKE ALL ON FUNCTION public.purge_stale_rate_limits() FROM authenticated;
