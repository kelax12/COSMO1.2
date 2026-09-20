-- ═══════════════════════════════════════════════════════════════════
-- 150, un COMPTEUR pour le support (C-110)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. `report-bug` est en ligne depuis le
-- 2026-09-12. Elle envoie un e-mail, et c'est tout : aucun compteur, aucune
-- trace, aucune date. On ne sait donc dire NI combien de rapports arrivent,
-- NI en combien de temps on y répond, NI combien sont résolus.
--
-- Un canal de support qu'on n'instrumente pas ne se distingue pas d'un canal
-- que personne n'utilise. Les deux rendent le même silence, et les deux
-- appellent des décisions opposées : dans un cas on améliore le produit, dans
-- l'autre on rend le bouton plus visible.
--
-- ── CE QUE CETTE TABLE NE CONTIENT PAS, ET C'EST L'ESSENTIEL ────────
--
-- 🔴 AUCUNE DONNÉE À CARACTÈRE PERSONNEL. Pas d'`user_id`, pas d'e-mail, pas
-- de titre, pas de corps de message, pas d'adresse IP ni de haché d'adresse.
-- C'est un COMPTEUR, pas une boîte de réception : le contenu du rapport vit
-- dans la boîte mail d'Axel, qui est le destinataire déclaré au registre
-- art. 30 (traitement T7).
--
-- Cette décision n'est pas une précaution de style, elle a trois effets
-- concrets :
--   · rien à purger à la suppression d'un compte (RGPD art. 17), donc aucune
--     ligne à ajouter à `delete-account` ni à `check:erasure` ;
--   · rien à exporter (art. 20), donc aucune ligne à
--     `check:portability` ;
--   · rien à déclarer de neuf au registre : le traitement T7 existe déjà, et
--     ce compteur n'élargit pas ses données, il les compte.
-- ❌ NE JAMAIS AJOUTER `user_id`, `email`, `title` OU `body` À CETTE TABLE.
--    Ce serait créer une seconde copie des données de support, hors du
--    registre, sans durée de conservation et sans chemin d'effacement.
--
-- ── CE QUI EST STOCKÉ, ET POURQUOI CHAQUE COLONNE ───────────────────
--
--   `received_at`       — le volume, et sa date. C'est le premier des trois
--                         chiffres que C-110 demande.
--   `category`          — la catégorie choisie dans le formulaire. Une valeur
--                         d'énumération fermée, jamais du texte libre : du
--                         texte libre redeviendrait du contenu.
--   `first_response_at` — le DÉLAI DE PREMIÈRE RÉPONSE, deuxième chiffre.
--                         ⚠️ Il reste NULL tant que personne ne le pose : il
--                         se pose à la main, parce que la réponse part d'une
--                         boîte mail que ce dépôt ne lit pas. Le NULL est
--                         donc une information, pas un trou.
--   `resolved_at`       — le TAUX DE RÉSOLUTION, troisième chiffre. Même
--                         remarque.
--
-- ── LES DEUX RPC ────────────────────────────────────────────────────
--
--   `record_support_report(p_category)` — appelée par la Edge Function, en
--     `service_role`. `SECURITY DEFINER` parce que la table n'accorde
--     l'écriture à personne d'autre.
--   `get_support_stats()` — lue par `/admin`. GARDÉE PAR `is_admin()`, pas
--     par `admin_allowlisted()` : la première dit « cette requête est
--     autorisée » (allowlist ET session `aal2`), la seconde dit « ce compte
--     est admin » et sert à l'AFFICHAGE. Les intervertir annulerait la
--     mig. 131 (cf. `CLAUDE.md` § Sécurité).
--
-- ⚠️ RLS ACTIVÉE, AUCUNE POLICY, ET C'EST VOULU : personne ne lit ni n'écrit
-- cette table en direct. Tout passe par les deux fonctions ci-dessus. Cela
-- ajoutera une ligne à l'advisor `rls_enabled_no_policy`, qui en compte déjà
-- neuf pour la même raison — la référence de `check:supabase-posture` devra
-- donc être recalée à l'application, et c'est écrit dans le bloc de
-- vérification ci-dessous.
--
-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION, à jouer DANS UNE TRANSACTION ANNULÉE avant d'appliquer :
--
--   BEGIN;
--   \i supabase/migration/150_support_reports_counter.sql
--   -- 1. un rapport s'enregistre, et rien d'autre n'est écrit
--   SELECT public.record_support_report('bug');
--   SELECT count(*) = 1 AS un_seul FROM public.support_reports;
--   -- 2. une catégorie inconnue est REFUSÉE (contrainte, pas du texte libre)
--   SELECT public.record_support_report('n-importe-quoi');  -- doit LEVER
--   -- 3. un non-admin ne lit rien
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<un compte non admin>","role":"authenticated"}';
--   SELECT public.get_support_stats();  -- doit lever 42501
--   ROLLBACK;
--
-- APRÈS APPLICATION : recaler la référence de posture Supabase —
--   SUPABASE_ACCESS_TOKEN=… node scripts/check-supabase-posture.mjs --update
-- puis committer `scripts/supabase-posture.reference.json`.
-- ═══════════════════════════════════════════════════════════════════

-- ── La table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Énumération FERMÉE. ❌ Ne jamais remplacer par du texte libre : ce serait
  -- rouvrir la porte au contenu du rapport, donc à des données personnelles
  -- dans une table qui n'en déclare aucune.
  category          TEXT NOT NULL
                      CHECK (category IN ('bug', 'idea', 'question', 'other')),
  first_response_at TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  CONSTRAINT support_reports_ordre_chrono
    CHECK (
      (first_response_at IS NULL OR first_response_at >= received_at)
      AND (resolved_at IS NULL OR resolved_at >= received_at)
    )
);

COMMENT ON TABLE public.support_reports IS
  'Compteur du support (C-110). AUCUNE donnee a caractere personnel : ni user_id, ni email, ni contenu. Le rapport lui-meme vit dans la boite mail du destinataire (registre art. 30, traitement T7).';

CREATE INDEX IF NOT EXISTS idx_support_reports_received_at
  ON public.support_reports (received_at DESC);

-- ── RLS : activée, sans policy ─────────────────────────────────────
-- Personne n'y touche en direct. Les deux fonctions ci-dessous sont le seul
-- chemin, et elles sont SECURITY DEFINER.
ALTER TABLE public.support_reports ENABLE ROW LEVEL SECURITY;

-- ── Enregistrer un rapport ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_support_report(p_category TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
-- `search_path` vide : une fonction DEFINER qui laisse le chemin de recherche
-- de l'appelant peut être détournée vers un objet homonyme. Tous les noms
-- ci-dessous sont donc qualifiés.
SET search_path = ''
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

-- 🔴 `anon` et `authenticated` ne peuvent PAS l'appeler. Sinon n'importe qui
-- gonflerait le compteur depuis le navigateur, et la seule métrique de
-- support du produit deviendrait du bruit. Seul `service_role` — c'est-à-dire
-- la Edge Function `report-bug`, APRÈS son plafond de débit (mig. 139) — y a
-- accès.
-- ⚠️ REVOKE explicite : l'ACL par défaut du schéma `public` accorde EXECUTE
-- NOMMÉMENT à anon/authenticated/service_role à la création. Ne pas accorder
-- n'est pas retirer.
REVOKE ALL ON FUNCTION public.record_support_report(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_support_report(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.record_support_report(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_support_report(TEXT) TO service_role;

-- ── Lire les compteurs ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_support_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.get_support_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_support_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_support_stats() TO authenticated;
