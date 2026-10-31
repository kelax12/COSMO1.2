// ═══════════════════════════════════════════════════════════════════
// QUI A PAYÉ L'ORGANISATION (affiliation, tâche B4)
// ═══════════════════════════════════════════════════════════════════
//
// `stripe-org-checkout` pose `payer_uid` dans les metadata ; le webhook le
// recopie dans `org_subscriptions.purchased_by` (mig. 236), que le trigger de
// `payment_records` lit pour rattacher la commission. TS pur, sans `Deno.*`,
// pour être verrouillé par vitest (`src/modules/billing/org-payer.test.ts`).
//
// 🔴 Jamais d'écrasement : le premier payeur reste celui qui a ouvert la
// relation commerciale. Une valeur invalide est ignorée, pas journalisée.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** L'uuid à écrire dans `purchased_by`, ou `null` s'il ne faut rien écrire. */
export function payerToRecord(
  metadata: Record<string, string | undefined> | null | undefined,
  currentPurchasedBy: string | null,
): string | null {
  if (currentPurchasedBy) return null
  const raw = metadata?.payer_uid
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return null
  return raw.toLowerCase()
}
