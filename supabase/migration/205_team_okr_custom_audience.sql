-- ═══════════════════════════════════════════════════════════════════
-- 205, visibilité « Personnaliser » d'un OKR d'équipe : équipes ET personnes
--
-- Jusqu'ici un OKR était visible par toute l'entreprise (aucun lien dans
-- `team_okr_teams`) ou par des équipes. La fiche OKR propose désormais une
-- troisième option qui mélange équipes et personnes nommées.
--
-- ── CE QUI EST AJOUTÉ ───────────────────────────────────────────────
--
--   · `team_okrs.audience` : 'org' | 'teams' | 'custom', le choix fait à
--     l'écran. Rempli à 'teams' pour les OKR déjà rattachés.
--   · `team_okr_members` : les personnes nommées d'un OKR 'custom'.
--   · `can_access_team_okr` : une branche de plus pour ces personnes.
--
-- ── 🔴 L'INVARIANT : RETIRER UN LIEN NE PUBLIE JAMAIS RIEN ─────────
--
-- Leçon de la mig. 151 : quand « aucun lien » veut dire « tout le monde »,
-- chaque suppression en cascade est une publication. Une personne quitte
-- l'organisation ou supprime son compte, son lien part en cascade ; si
-- c'était la seule personne d'un OKR confidentiel, il s'ouvrirait à toute
-- l'entreprise.
--
-- D'où la règle : un OKR n'est ouvert à toute l'entreprise que si
-- `audience = 'org'` ET qu'il n'a AUCUN lien, ni équipe ni personne. Un OKR
-- 'teams' ou 'custom' qui perd tous ses liens se REFERME (admins seulement),
-- il ne s'ouvre pas.
--
-- `audience` ne sert donc qu'à fermer. On ne s'en sert jamais pour ouvrir un
-- OKR qui a encore des liens : un onglet resté sur l'ancien bundle, qui ne
-- connaît pas la colonne, crée des OKR à 'org' (le défaut) avec des liens
-- d'équipe, et ils doivent rester fermés. C'est pourquoi la condition « aucun
-- lien » est gardée, et qu'aucun trigger ne recopie `audience` depuis les liens.
--
-- ── RATTACHEMENTS PAR CLÉS ÉTRANGÈRES, PAS PAR TRIGGER ─────────────
--
-- Une garde en trigger s'exécute avec le rôle de l'appelant, donc sous RLS
-- (une fonction de trigger n'est jamais `SECURITY DEFINER`, cf. le CLAUDE.md
-- de ce dossier). Un manager qui crée un OKR 'custom' sans s'y inclure ne le
-- voit déjà plus ; un trigger qui relirait l'OKR refuserait son propre lien.
-- Les clés étrangères sont vérifiées par le moteur, sans RLS :
--   · (okr_id, org_id) → team_okrs(id, org_id) : même organisation que l'OKR ;
--   · (org_id, user_id) → organization_members : la personne en est membre,
--     et son lien part en CASCADE quand elle quitte l'organisation (l'OKR se
--     referme, cf. l'invariant).
--
-- ── LECTURE DES LIENS ───────────────────────────────────────────────
--
-- `team_okr_teams` se lit par tout membre (mig. 073). Pour les personnes on
-- est plus strict : seul qui voit l'OKR voit qui y a accès, sinon la liste
-- des personnes d'un OKR confidentiel fuiterait.
--
-- Retour arrière : `pg_get_functiondef` de `can_access_team_okr` capturé le
-- 2026-09-29 avant écriture, recopié dans `supabase/proofs/205.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Le choix d'audience ─────────────────────────────────────────

ALTER TABLE public.team_okrs
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'org';

ALTER TABLE public.team_okrs
  DROP CONSTRAINT IF EXISTS team_okrs_audience_check,
  ADD CONSTRAINT team_okrs_audience_check CHECK (audience IN ('org', 'teams', 'custom'));

-- Les OKR déjà rattachés deviennent 'teams' : supprimer ensuite leur dernière
-- équipe les refermera au lieu de les publier.
UPDATE public.team_okrs o
   SET audience = 'teams'
 WHERE o.audience = 'org'
   AND EXISTS (SELECT 1 FROM public.team_okr_teams l WHERE l.okr_id = o.id);

-- Cible de la clé étrangère composite (id est déjà unique, ceci l'expose
-- avec org_id).
ALTER TABLE public.team_okrs
  DROP CONSTRAINT IF EXISTS team_okrs_id_org_key,
  ADD CONSTRAINT team_okrs_id_org_key UNIQUE (id, org_id);

-- ── 2. Les personnes nommées ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_okr_members (
  okr_id   UUID NOT NULL,
  org_id   UUID NOT NULL,
  user_id  UUID NOT NULL,
  added_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (okr_id, user_id),
  CONSTRAINT team_okr_members_okr_fkey
    FOREIGN KEY (okr_id, org_id) REFERENCES public.team_okrs(id, org_id) ON DELETE CASCADE,
  CONSTRAINT team_okr_members_member_fkey
    FOREIGN KEY (org_id, user_id) REFERENCES public.organization_members(org_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_okr_members_user ON public.team_okr_members (user_id);
CREATE INDEX IF NOT EXISTS idx_team_okr_members_org ON public.team_okr_members (org_id);
CREATE INDEX IF NOT EXISTS idx_team_okr_members_added_by ON public.team_okr_members (added_by);

-- ── 3. Accès ───────────────────────────────────────────────────────
--
-- Reprise EXACTE de la version en production (relue au catalogue le
-- 2026-09-29, `deleted_at` de la mig. 193 compris), plus :
--   · la branche « toute l'entreprise » exige audience = 'org' ET aucun lien ;
--   · la branche personnes, réservée aux OKR 'custom', exige que l'appelant
--     soit encore membre actif de l'organisation (`is_org_member` écarte les
--     comptes suspendus ou expirés, que la cascade ne retire pas).
-- `get_subtree` reste appelable ici : fonction DEFINER, rôle propriétaire.

CREATE OR REPLACE FUNCTION public.can_access_team_okr(p_okr UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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

REVOKE ALL ON FUNCTION public.can_access_team_okr(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_team_okr(UUID) TO authenticated;

-- ── 4. RLS : team_okr_members ──────────────────────────────────────
--
-- Écriture : managers de l'org, comme `team_okr_teams` (mig. 073). Pas de
-- `can_access_team_okr` à l'insertion : l'OKR 'custom' vient d'être créé
-- sans lien, il n'est donc visible que des admins, et le manager qui le crée
-- doit pouvoir poser ses premiers liens.

ALTER TABLE public.team_okr_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.team_okr_members FROM anon;
GRANT SELECT, INSERT, DELETE ON public.team_okr_members TO authenticated;

DROP POLICY IF EXISTS "team_okr_members_select" ON public.team_okr_members;
CREATE POLICY "team_okr_members_select"
  ON public.team_okr_members FOR SELECT
  TO authenticated
  USING (public.can_access_team_okr(okr_id));

DROP POLICY IF EXISTS "team_okr_members_insert" ON public.team_okr_members;
CREATE POLICY "team_okr_members_insert"
  ON public.team_okr_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_okr_members_delete" ON public.team_okr_members;
CREATE POLICY "team_okr_members_delete"
  ON public.team_okr_members FOR DELETE
  TO authenticated
  USING (public.is_org_manager(org_id));
