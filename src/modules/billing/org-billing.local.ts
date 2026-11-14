// ═══════════════════════════════════════════════════════════════════
// BILLING ORG, côté DÉMO (localStorage).
//
// Aucune organisation de démo ne paie : pas d'abonnement (palier gratuit), pas
// d'historique. Seul le contact de facturation est une préférence, donc il se
// range en `localStorage`. Ces fonctions jouent le même rôle que
// `org-billing.repository.ts` et `org-billing-account.repository.ts`, et la
// suite `src/test/contracts/__test__/org-billing.contract.ts` les confronte.
//
// 🔴 La règle du contact rejoue le CHECK de la mig. 180
// (`org_billing_contacts_email_ck`, `org_billing_contacts_name_ck`).
// ═══════════════════════════════════════════════════════════════════
import { safeParse } from '@/lib/safe-json';
import type { OrgBillingContact, OrgBillingHistoryEntry, OrgSubscription } from './org-billing.types';

const contactKey = (orgId: string) => `cosmo_demo_org_billing_contact_${orgId}`;

export async function getLocalOrgSubscription(): Promise<OrgSubscription | null> {
  return null;
}

export async function getLocalOrgBillingHistory(): Promise<OrgBillingHistoryEntry[]> {
  return [];
}

export async function getLocalOrgBillingContact(orgId: string): Promise<OrgBillingContact | null> {
  try {
    return safeParse<OrgBillingContact>(localStorage.getItem(contactKey(orgId)));
  } catch {
    return null;
  }
}

/** Rejoue `org_billing_contacts_email_ck` et `org_billing_contacts_name_ck` (mig. 180). */
function assertValidContact(input: { name: string | null; email: string }): void {
  if (input.email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
    throw new Error('invalid_billing_contact_email');
  }
  if (input.name !== null && input.name.length > 120) throw new Error('invalid_billing_contact_name');
}

export async function saveLocalOrgBillingContact(
  orgId: string,
  input: { name: string | null; email: string },
): Promise<OrgBillingContact> {
  assertValidContact(input);
  try {
    localStorage.setItem(contactKey(orgId), JSON.stringify({ orgId, ...input }));
  } catch { /* localStorage indisponible : l'écran garde la valeur du cache */ }
  return { orgId, ...input };
}

export async function deleteLocalOrgBillingContact(orgId: string): Promise<void> {
  try {
    localStorage.removeItem(contactKey(orgId));
  } catch { /* idem */ }
}
