-- ═══════════════════════════════════════════════════════════════════
-- 128_events_managed_ids_indexable.sql, `events` : la RLS hierarchique
-- cesse d'etre un predicat-fonction evalue LIGNE PAR LIGNE
-- ═══════════════════════════════════════════════════════════════════
--
-- TROISIEME occurrence de la meme classe de defaut, apres `tasks` (mig. 085)
-- et `team_tasks` / `team_projects` (mig. 113, 117) : une policy qui appelle
-- une fonction SUR UNE COLONNE ne peut pas utiliser d'index, et la fonction
-- est rappelee pour chaque ligne examinee.
--
--   USING ((SELECT auth.uid()) = user_id OR (manages_user(user_id) AND NOT is_private))
--
-- `manages_user(user_id)` depend de la ligne : Postgres l'appelle une fois PAR
-- LIGNE, et chaque appel balaie `organization_members` deux fois puis evalue la
-- CTE recursive `get_subtree`. Le cout d'une lecture d'agenda croit donc avec
-- le produit « nombre d'evenements lus × nombre d'adhesions de TOUTE la
-- plateforme », pas avec le volume de l'utilisateur.
--
-- ── MESURE EN PROD, 2026-08-26, plan chauffe, role `authenticated` ──
--
--   lire l'agenda d'un membre non gere (128 lignes examinees, 0 rendue)
--     avant : 17,19 ms , Bitmap Heap Scan, « Rows Removed by Filter: 128 »
--     apres :  0,61 ms , BitmapOr de deux Index Scan, 0 ligne remontee au tas
--   lire son propre agenda (97 lignes) : 0,25 ms avant, inchange apres
--     (la branche « own » court-circuitait deja le OR)
--
-- ── LE CORRECTIF ────────────────────────────────────────────────────
--
-- `my_managed_user_ids()` ne prend AUCUN argument : son perimetre vient de
-- `auth.uid()` seul. N'etant pas fonction de la ligne, elle est hissee en
-- InitPlan et evaluee UNE FOIS par requete, exactement comme
-- `(SELECT auth.uid())` depuis la mig. 043. `get_subtree` est alors appelee une
-- fois par organisation de l'appelant, au lieu d'une fois par ligne lue.
--
-- Effet de bord recherche : `user_id = ANY (my_managed_user_ids())` est une
-- condition d'INDEX, pas un filtre. Une ligne qui sera rejetee n'est plus
-- remontee du tas pour etre jetee ensuite.
--
-- ⚠️ `get_subtree` n'est plus executable par `authenticated` depuis la mig. 100.
-- L'appel reste legal ici parce qu'il se fait DANS une fonction SECURITY
-- DEFINER (role = proprietaire). Une policy qui l'appellerait en direct
-- echouerait en `permission denied` (finding B-1, mig. 107).
--
-- ── PARITE VERIFIEE EN PROD AVANT ECRITURE ──────────────────────────
--
--   1. booleen : `manages_user(cible)` vs `cible = ANY(my_managed_user_ids())`
--      pour CHAQUE couple (acteur, cible) de `organization_members` × acteurs
--      -> 0 divergence.
--   2. lignes  : l'ensemble des `events.id` visibles sous l'ancien predicat et
--      sous le nouveau, pour CHAQUE compte de `auth.users` -> identiques.
--
-- Aucune donnee n'est modifiee, aucune colonne ajoutee : c'est la LECTURE qui
-- change de plan. Rollback = recreer les deux policies de la mig. 084.

-- ─── Le perimetre hierarchique, calcule une fois par requete ────────

CREATE OR REPLACE FUNCTION public.my_managed_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.my_managed_user_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_managed_user_ids() FROM anon;
-- Citee par une policy : DOIT rester executable par `authenticated`, qui est le
-- role courant au moment ou la policy s'evalue (mig. 107, finding B-1).
GRANT EXECUTE ON FUNCTION public.my_managed_user_ids() TO authenticated;

-- ─── `manages_user` : meme reponse, une seule definition du perimetre ──
--
-- Conservee (elle reste citee par la policy INSERT et par du code existant),
-- mais redefinie EN FONCTION du nouvel helper : deux definitions concurrentes
-- de « qui je gere » finiraient par diverger.

CREATE OR REPLACE FUNCTION public.manages_user(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user IS NOT NULL
     AND p_user <> auth.uid()
     AND p_user = ANY (public.my_managed_user_ids());
$$;

REVOKE ALL ON FUNCTION public.manages_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manages_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.manages_user(UUID) TO authenticated;

-- ─── La policy de LECTURE, seule a payer le cout par ligne ──────────
--
-- Une seule policy PERMISSIVE par role + action (mig. 049) : on elargit le OR
-- existant, on n'en ajoute pas une seconde.

DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events"
  ON public.events FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR (NOT is_private AND user_id = ANY (public.my_managed_user_ids()))
  );

-- La policy INSERT juge UNE ligne : le cout par ligne n'y existe pas. Elle est
-- reecrite pour dire la meme chose que la lecture, pas pour gagner du temps.

DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
CREATE POLICY "Users can insert own events"
  ON public.events FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR (NOT is_private AND user_id = ANY (public.my_managed_user_ids()))
  );
