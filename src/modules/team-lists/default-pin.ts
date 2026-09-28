// ═══════════════════════════════════════════════════════════════════
// Liste épinglée par défaut : préférence de CHACUN, par organisation.
//
// Une liste d'entreprise est partagée ; une colonne `is_default` en base
// ferait qu'épingler pour soi épingle pour toute l'organisation. On garde
// donc l'épingle sur l'appareil, comme la chip « Aujourd'hui » masquée.
// ═══════════════════════════════════════════════════════════════════

import { safeGetItem, safeSetItem } from '@/lib/safe-json';

const keyOf = (orgId: string) => `cosmo_team_lists_default:${orgId}`;

export function readDefaultTeamListId(orgId: string): string | null {
  return safeGetItem(keyOf(orgId)) || null;
}

export function writeDefaultTeamListId(orgId: string, listId: string | null): void {
  try {
    if (listId) safeSetItem(keyOf(orgId), listId);
    else localStorage.removeItem(keyOf(orgId));
  } catch { /* stockage indisponible : l'épingle ne survit simplement pas */ }
}
