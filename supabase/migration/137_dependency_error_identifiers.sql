-- ═══════════════════════════════════════════════════════════════════
-- 137 — les refus de dépendance parlent par IDENTIFIANT, pas par phrase
-- ═══════════════════════════════════════════════════════════════════
--
-- 🔴 POURQUOI (finding C-48).
--
-- Les triggers de dépendance refusaient par des PHRASES anglaises :
-- « This dependency would create a cycle », « Both tasks must exist »… Le
-- client ne peut rien en faire, et les deux modes se cassaient chacun à sa
-- façon :
--
--   • EN PRODUCTION, `normalizeApiError` ne promeut un message serveur en code
--     métier que s'il matche `BUSINESS_CODE_RE` (`^[a-z][a-z0-9_]{2,49}$`). Une
--     phrase avec des espaces et des majuscules ne matche pas : le refus
--     retombait sur le message générique. Ce qu'on voulait surtout ne pas
--     perdre — « c'est un cycle, tu peux agir dessus » — était exactement ce
--     qui était perdu.
--   • EN MODE DÉMO, le repository local levait la MÊME phrase anglaise en dur
--     (par souci de parité) et elle arrivait telle quelle dans un gabarit
--     français : « Dépendance impossible : This dependency would create a
--     cycle ».
--
-- La convention du dépôt est déjà celle-ci partout ailleurs (`expired_link`,
-- `own_link`, `seat_limit_reached`…) : `RAISE EXCEPTION '<identifiant>'`, que
-- `promoteBusinessCode` relaie et que le catalogue `errors.api.*` traduit.
--
-- ── CE QUE CETTE MIGRATION NE CHANGE PAS ────────────────────────────
--
-- 🔴 La CONVERGENCE des messages de la mig. 109 est une propriété de SÉCURITÉ,
-- pas un hasard de rédaction. Une tâche inexistante et une tâche hors
-- périmètre doivent produire le MÊME refus, sinon l'écart est un oracle
-- d'existence sur `team_tasks` hors organisation. Les deux branches
-- convergent donc ici encore, vers le même identifiant
-- `dependency_task_missing`. ❌ Ne jamais les séparer « pour un meilleur
-- message ».
--
-- Aucune logique n'est touchée : mêmes conditions, mêmes `SECURITY INVOKER`,
-- mêmes `search_path`, mêmes bornes de récursion. Seul le TEXTE du refus
-- change. Les fonctions sont recréées à l'identique du reste pour rester
-- lisibles d'un bloc, plutôt que patchées.
--
-- ── LES QUATRE IDENTIFIANTS ─────────────────────────────────────────
--
--   dependency_task_missing    une des deux tâches est introuvable (ou hors
--                              périmètre — voir la convergence ci-dessus)
--   dependency_cross_account   les deux tâches n'appartiennent pas au même
--                              compte (dépendances PERSONNELLES, mig. 132)
--   dependency_cross_project   les deux tâches ne sont pas dans le même projet
--                              (dépendances d'ÉQUIPE, mig. 108/109)
--   dependency_cycle           l'arête refermerait une boucle
--
-- Ils sont catalogués dans `src/locales/{fr,en}/errors.json`, section `api`.
-- Un identifiant non catalogué retombe sur le message générique : ajouter un
-- `RAISE` ici sans sa clé là-bas ne casse rien, mais ne dit plus rien non plus.
--
-- Vérification attendue après application (transaction ANNULÉE) :
--   • auto-dépendance, doublon, cycle direct et indirect toujours refusés ;
--   • arête inter-comptes toujours refusée ;
--   • le message rendu est bien l'identifiant, pas la phrase ;
--   • une tâche inexistante et une tâche hors périmètre rendent le MÊME texte.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Dépendances PERSONNELLES (mig. 132) ────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.prevent_task_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
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

-- ─── Dépendances d'ÉQUIPE (mig. 108, durcies par la 109) ────────────
--
-- ⚠️ `SECURITY INVOKER` est REPOSÉ explicitement : c'est ce que la mig. 109 a
-- corrigé (un trigger BEFORE en DEFINER lit `team_tasks` hors RLS, et l'écart
-- entre ses deux messages devenait un oracle d'existence). Le recréer sans
-- cette ligne le ferait retomber au défaut, et rouvrirait le finding B-3.

CREATE OR REPLACE FUNCTION public.validate_team_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
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
$fn$;

CREATE OR REPLACE FUNCTION public.prevent_team_task_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
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
$fn$;

-- ─── Privilèges : règle 064b / 094b, reposée après CREATE OR REPLACE ─
-- `CREATE OR REPLACE` remet les privilèges par défaut du schéma : sans ces
-- REVOKE, les quatre fonctions redeviendraient exécutables par `anon` et
-- `authenticated`, ce que la mig. 109 avait justement fermé.
REVOKE ALL ON FUNCTION public.validate_task_dependency()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_task_dependency_cycle()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_team_task_dependency()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_team_task_dependency_cycle()  FROM PUBLIC, anon, authenticated;
