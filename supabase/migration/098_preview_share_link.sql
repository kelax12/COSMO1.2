-- ═══════════════════════════════════════════════════════════════════
-- Migration 098 — Aperçu public d'un lien d'invitation
--
-- `/invite/:token` redirigeait vers un formulaire d'inscription nu : l'invité
-- ne savait ni qui l'invitait, ni sur quoi, ni ce qu'est COSMO. Cette RPC
-- permet d'afficher ce contexte AVANT de demander la création de compte —
-- c'est le canal d'acquisition le plus qualifié du produit.
--
-- ⚠️ Exposée à `anon` : par construction l'appelant n'a pas de compte. Le
-- token UUID EST le secret (mig. 046), exactement comme pour `claim_share_link`.
-- Deux règles en découlent :
--
--   1. WHITELIST STRICTE du retour : `owner_name` (profiles.display_name,
--      jamais l'email) et `task_name`. Aucun id, aucun UUID, aucun email,
--      aucun avatar — tout champ superflu ici est une fuite publique.
--   2. AUCUN ORACLE : un token inexistant et un token expiré renvoient la
--      MÊME réponse `{"expired": true}`. Sans ça, la fonction confirmerait
--      l'existence d'un lien, et la latence différentielle deviendrait un
--      canal d'énumération.
--
-- Pas de quota d'appel : contrairement à `resolve_profile_by_email` (mig. 083),
-- il n'y a pas d'espace de recherche exploitable — deviner un UUIDv4 aléatoire
-- est hors de portée, et l'appelant anonyme n'a aucune identité à décompter.
-- La protection est l'entropie du token, pas le débit.
--
-- STABLE : aucune écriture, ne consomme pas le lien (le claim reste à
-- `claim_share_link`, réservé à `authenticated`).
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.preview_share_link(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
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

REVOKE EXECUTE ON FUNCTION public.preview_share_link(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.preview_share_link(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.preview_share_link(UUID) IS
  'Aperçu anonyme d''un lien d''invitation : owner_name + task_name uniquement. Ne consomme pas le lien.';
