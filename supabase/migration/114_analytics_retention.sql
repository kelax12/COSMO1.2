-- ═══════════════════════════════════════════════════════════════════
-- Migration 114 — rétention des tables analytiques (RGPD art. 5.1.e)
--
-- CONTEXTE. `docs/RGPD.md` §3 listait DEUX tables analytiques sans expiration :
-- `demo_devices` et `user_activity_days`. Vérification faite en production le
-- 2026-08-24, une seule des deux l'était réellement :
--
--   • `demo_devices`      ✅ purge 90 j DÉJÀ EN PLACE, en ligne dans
--                            `record_demo_visit` (mig. 084) — vérifié sur
--                            `pg_get_functiondef` en prod. La doc avait tort.
--   • `user_activity_days` ❌ aucune rétention. C'est le seul écart réel.
--
-- Cette migration ferme le second cas, et resserre une exception du premier.
--
-- POURQUOI PAS pg_cron. Le précédent du dossier est `prune_processed_stripe_events`
-- (mig. 089) : la purge est portée par l'écriture elle-même, donc elle suit le
-- trafic réel et ne demande aucune extension à activer ni aucun ordonnanceur à
-- surveiller. On garde ce motif — une purge qui dépend d'un cron qu'on a oublié
-- d'activer n'est pas une rétention, c'est une intention.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- 1) user_activity_days — rétention 400 jours, purge par l'appelant
-- ═══════════════════════════════════════════════════════════════════
--
-- La table alimente les courbes de croissance et de rétention de
-- `get_admin_stats`. 400 jours (13 mois) est le plus petit seuil qui préserve
-- une comparaison d'une année sur l'autre — en dessous, la purge détruirait la
-- mesure qu'elle est censée borner.
--
-- La purge ne vise QUE les lignes de l'appelant (`user_id = auth.uid()`), donc
-- un Index Scan sur le pkey `(user_id, day)` : coût constant, aucune montée en
-- charge cachée. Une purge globale à chaque `touch_last_seen()` aurait scanné
-- la table pour tout le monde, à chaque visite de chaque utilisateur.
--
-- ⚠️ Le corps reste identique à la mig. 056 pour tout le reste. En particulier :
-- la fonction n'écrit QUE la ligne de l'appelant et le jour SERVEUR
-- (`CURRENT_DATE`). Ne JAMAIS y ajouter de paramètre client — c'est ce qui la
-- rend sûre en `SECURITY DEFINER` alors que la table n'a aucune policy.
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
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

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

COMMENT ON FUNCTION public.touch_last_seen() IS
  'Marque l activite du jour (profiles.last_seen_at + user_activity_days) et '
  'purge les jours de plus de 400 j POUR L APPELANT (RGPD art. 5.1.e, mig. 114). '
  '400 j = le plus petit seuil preservant une comparaison annee sur annee dans '
  'get_admin_stats. N ecrit que la ligne de auth.uid() et le jour serveur : ne '
  'JAMAIS y ajouter de parametre client.';


-- ═══════════════════════════════════════════════════════════════════
-- 2) demo_devices — la purge existante avait une exception illimitée
-- ═══════════════════════════════════════════════════════════════════
--
-- `record_demo_visit` purge à 90 jours, mais UNIQUEMENT `converted_at IS NULL`.
-- Autrement dit : l'identifiant d'appareil d'un visiteur qui NE s'inscrit pas
-- disparaît au bout de 90 jours, tandis que celui d'un visiteur qui S'INSCRIT
-- est conservé indéfiniment — avec, dans la même ligne, le `converted_user_id`
-- auquel il est rattaché. C'est le cas le plus sensible des deux qui bénéficie
-- de la rétention la plus longue, exactement à l'envers.
--
-- Ce `device_id` est posé AVANT tout consentement à un compte. On lui applique
-- la même borne de 400 jours qu'au journal d'activité.
--
-- CE QU'ON NE PERD PAS : l'attribution d'acquisition ne vit pas ici. Elle est
-- portée par `profiles.acquisition_source` (mig. 097), qui n'est pas touchée.
-- Cette ligne ne sert qu'à calculer un TAUX de conversion démo → inscription ;
-- au-delà de 13 mois, ce taux ne se recalcule plus, il se lit dans l'historique.
--
-- POUR REVENIR EN ARRIÈRE : re-déployer le corps de la mig. 084 (la clause
-- `AND converted_at IS NULL` seule suffit à restaurer l'ancien comportement).
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

-- Droits INCHANGÉS (mig. 055/083/084) : appelable par anon, c'est le compteur
-- de visites de la démo — il s'exécute avant toute connexion. L'argument est un
-- UUID non devinable, et le cap par minute borne l'écriture anonyme.
REVOKE EXECUTE ON FUNCTION public.record_demo_visit(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_demo_visit(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.record_demo_visit(uuid) IS
  'Compteur de visites de la demo. Purge 90 j (non converties) et 400 j '
  '(converties, mig. 114 — l exception illimitee etait le cas le plus sensible). '
  'Cap de 60 insertions/minute : ecriture anonyme bornee, jamais bruyante.';


-- ═══════════════════════════════════════════════════════════════════
-- 3) Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
--   select p.proname,
--          pg_get_functiondef(p.oid) like '%400%' as has_400d_retention
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('touch_last_seen','record_demo_visit');
--   Attendu : t / t
--
-- Aucune ligne ne doit disparaître aujourd'hui (la plus ancienne donnée a
-- quelques mois) — la purge est préventive :
--
--   select min(day), max(day), count(*) from public.user_activity_days;
--   select min(first_seen_at), count(*) filter (where converted_at is not null)
--     from public.demo_devices;
