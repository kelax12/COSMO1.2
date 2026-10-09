-- ═══════════════════════════════════════════════════════════════════
-- 216 · Supprimer une entreprise ne bute plus sur son propre journal d'audit
-- ═══════════════════════════════════════════════════════════════════
--
-- 🔴 SYMPTÔME (2026-10-09) : « Impossible de supprimer l'entreprise : Action
-- impossible en raison de dépendances existantes » (23503).
--
-- CAUSE, rejouée en prod dans un bloc annulé : `DELETE FROM organizations`
-- cascade vers `organization_members`, `org_teams`, `team_projects`… dont les
-- triggers d'audit appellent `write_org_audit`. À ce moment la ligne
-- `organizations` n'existe déjà plus, donc l'INSERT dans `org_audit_log` viole
-- `org_audit_log_org_id_fkey`, et toute la suppression est annulée.
--
-- CORRECTIF : `write_org_audit` n'écrit que si l'organisation existe encore.
-- Une entrée de journal pour une entreprise en cours de suppression partirait
-- de toute façon dans la même cascade (`ON DELETE CASCADE`) : on ne perd rien.
-- Signature, propriétaire, SECURITY DEFINER et ACL inchangés (CREATE OR REPLACE).
-- Preuve jouée avant application : suppression de l'org « jj » réussie, rollback.

CREATE OR REPLACE FUNCTION public.write_org_audit(
  p_org uuid, p_action text, p_target_type text,
  p_target_id uuid, p_target_user uuid, p_meta jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  INSERT INTO public.org_audit_log (org_id, actor_id, action, target_type, target_id, target_user_id, meta)
  SELECT p_org, auth.uid(), p_action, p_target_type, p_target_id, p_target_user, p_meta
   WHERE EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org);
$function$;
