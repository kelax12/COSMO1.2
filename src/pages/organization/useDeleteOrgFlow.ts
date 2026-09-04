// ═══════════════════════════════════════════════════════════════════
// Supprimer une entreprise : résilier, rembourser, PUIS supprimer
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI MAINTENANT.
//
// L'arbitrage du 2026-09-03 décide, pour C-39 : « la suppression résilie et
// rembourse. Le chemin de suppression appelle celui de C-65 : on résilie, on
// rembourse la période en cours, puis on supprime. **Un seul geste, aucun
// débit orphelin.** »
//
// Cet enchaînement vivait dans `OrganizationPage`, qui a franchi les 600
// lignes en l'accueillant. Le cliquet d'architecture est GELÉ (arbitrage C-09)
// et sa règle est explicite : « un fichier se découpe quand on a de toute
// façon à le modifier ». C'est exactement ce cas, et c'est une frontière
// réelle — ce flux ne connaît rien de la page, seulement un identifiant
// d'organisation. Même patron que `pages/okr/useDeleteCategoryFlow.ts`.
//
// ── L'ORDRE, ET CE QUI SE PASSE QUAND UNE ÉTAPE ÉCHOUE ──────────────
//
// 🔴 REMBOURSER PUIS SUPPRIMER, et jamais l'inverse. La suppression emporte
// `org_subscriptions` en CASCADE : supprimer d'abord ferait perdre
// l'identifiant Stripe, et l'abonnement continuerait de courir sur une
// organisation qui n'existe plus. C'est précisément le débit orphelin que
// l'arbitrage nomme.
//
// ⚠️ Si le remboursement ÉCHOUE, on ne supprime PAS. Mieux vaut une
//    organisation encore là et un message d'erreur qu'une organisation
//    détruite et un débit qui continue : la première situation se rattrape,
//    la seconde emporte les données de tous les membres.
//
// ⚠️ Le serveur applique la MÊME règle, indépendamment de cet écran :
//    `delete_organization` (mig. 138) refuse tant qu'un abonnement est actif.
//    Un contrôle qui ne vit que dans l'écran n'est pas un contrôle — la RPC
//    est la seule porte vers un DELETE sur `organizations`.

import { useCancelAndRefundOrg } from '@/modules/billing/org-billing.hooks';
import { useDeleteOrganization } from '@/modules/organizations';

export interface DeleteOrgFlow {
  /** Enchaîne résiliation + remboursement + suppression, dans cet ordre. */
  run: (orgId: string) => void;
  /** Vrai pendant n'importe laquelle des deux étapes. */
  isPending: boolean;
}

/**
 * @param onDeleted appelé une fois l'organisation réellement supprimée — sert
 *   à refermer le dialogue de confirmation. N'est PAS appelé si le
 *   remboursement a échoué.
 */
export function useDeleteOrgFlow(onDeleted: () => void): DeleteOrgFlow {
  const refund = useCancelAndRefundOrg();
  const remove = useDeleteOrganization();

  return {
    run: (orgId: string) => {
      refund.mutate(
        { orgId },
        { onSuccess: () => remove.mutate(orgId, { onSuccess: onDeleted }) },
      );
    },
    isPending: refund.isPending || remove.isPending,
  };
}
