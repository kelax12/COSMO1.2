-- ═══════════════════════════════════════════════════════════════════
-- 151, supprimer une équipe n'ouvre plus rien à toute l'entreprise (M5)
--
-- 🔴 CE QUE CETTE MIGRATION CORRIGE. Deux clés étrangères faisaient d'une
-- suppression d'équipe une PUBLICATION :
--
--   · `team_projects.team_id` était en `ON DELETE SET NULL`. Or `team_id NULL`
--     signifie « projet d'organisation, visible par tous les membres »
--     (`can_access_team_project`, mig. 068). Supprimer l'équipe « Direction »
--     rendait son projet « Plan social » lisible par toute l'entreprise, avec
--     toutes ses tâches et ses commentaires.
--   · `team_okr_teams.team_id` était en `ON DELETE CASCADE`. Un OKR rattaché à
--     cette SEULE équipe perdait son unique lien, soit `teamIds = []`, qui
--     signifie « objectif d'entreprise » (`can_access_team_okr`, mig. 073).
--
-- Et l'écran confirmait par un `window.confirm` qui n'annonçait rien de tout ça.
--
-- ── LE CHOIX : UNE CLÉ ÉTRANGÈRE, PAS UN TRIGGER ────────────────────
--
-- Un trigger `BEFORE DELETE` qui compterait les projets de l'équipe
-- s'exécuterait avec le rôle de l'appelant (une garde n'est JAMAIS
-- `SECURITY DEFINER`, cf. `CLAUDE.md` du dossier), donc sous RLS : il ne
-- verrait pas un projet que l'appelant ne voit pas, et laisserait passer
-- exactement le cas qu'on veut refuser. Une contrainte de clé étrangère, elle,
-- est vérifiée par le moteur SANS RLS. Elle refuse tout, y compris ce que
-- l'appelant ignore. C'est la seule garde qui échoue fermée.
--
-- 🔴 `NO ACTION`, jamais `RESTRICT`. `RESTRICT` vérifie ligne par ligne, avant
-- la fin de l'ordre, et ne voit pas que l'enfant part dans la MÊME requête :
-- la suppression d'une organisation (`DELETE FROM organizations`, qui emporte
-- en cascade ses équipes ET ses projets) deviendrait impossible, donc la
-- suppression de compte aussi (RGPD art. 17). `NO ACTION` vérifie en fin
-- d'ordre, quand projets et équipes sont partis ensemble.
--
-- ── LE CHEMIN DE SORTIE : `delete_team_with_transfer` ────────────────
--
-- Refuser sans chemin, c'est rendre une équipe impossible à supprimer. La RPC
-- déplace projets et rattachements d'OKR vers une équipe cible, archive les
-- projets si on le demande, puis supprime l'équipe, en UNE transaction.
--
-- 🔴 `SECURITY INVOKER`. Elle ne fait rien que l'appelant ne puisse faire lui-
-- même, requête par requête, sous RLS. Si un projet de l'équipe lui est
-- invisible, l'UPDATE ne le touche pas, la clé étrangère refuse le DELETE, et
-- TOUT est annulé : on ne déplace pas en aveugle un projet qu'on ne voit pas,
-- ce qui changerait son audience sans que personne l'ait lue.
--
-- ❌ Pas de cible NULL. « Réaffecter à l'organisation » est précisément la
-- fuite que cette migration ferme.
--
-- ⚠️ ORDRE DES OKR : on INSÈRE le lien vers la cible AVANT de retirer le lien
-- vers l'équipe supprimée. Dans l'ordre inverse, l'OKR passerait un instant par
-- « aucun lien », donc « objectif d'entreprise ».
--
-- ── CE QUI NE CHANGE PAS ────────────────────────────────────────────
--
-- `org_team_members.team_id` reste en CASCADE : une appartenance n'a aucun
-- sens sans son équipe, et sa disparition ne rend rien visible.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Les deux clés étrangères ────────────────────────────────────

ALTER TABLE public.team_projects
  DROP CONSTRAINT IF EXISTS team_projects_team_id_fkey,
  ADD CONSTRAINT team_projects_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.org_teams(id) ON DELETE NO ACTION;

ALTER TABLE public.team_okr_teams
  DROP CONSTRAINT IF EXISTS team_okr_teams_team_id_fkey,
  ADD CONSTRAINT team_okr_teams_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.org_teams(id) ON DELETE NO ACTION;

-- ── 2. Impact d'une suppression, pour la modale ────────────────────
--
-- INVOKER : l'appelant ne compte que ce qu'il voit. Le chiffre sert à
-- l'annoncer, pas à décider ; la décision reste à la clé étrangère.
-- `hidden_projects` n'est PAS calculable sans fuite, et n'est pas rendu :
-- l'écran dit simplement que le serveur refusera s'il en reste.

CREATE OR REPLACE FUNCTION public.get_team_deletion_impact(p_team UUID)
RETURNS TABLE (
  active_projects   INTEGER,
  archived_projects INTEGER,
  sole_okrs         INTEGER,
  shared_okrs       INTEGER
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.get_team_deletion_impact(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_deletion_impact(UUID) TO authenticated;

-- ── 3. Suppression avec transfert, atomique ────────────────────────

CREATE OR REPLACE FUNCTION public.delete_team_with_transfer(
  p_team            UUID,
  p_target          UUID,
  p_archive_projects BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.delete_team_with_transfer(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_team_with_transfer(UUID, UUID, BOOLEAN) TO authenticated;
