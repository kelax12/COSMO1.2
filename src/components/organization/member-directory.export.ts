// ═══════════════════════════════════════════════════════════════════
// Export CSV de l'annuaire (admins seulement)
//
// ⚠️ C'est un export de DONNÉES PERSONNELLES de tiers (nom, e-mail, place dans
// l'organigramme). Il est décrit au registre, traitement T4
// (`docs/RGPD-REGISTRE.md`), et réservé aux admins : ce sont eux que
// l'organisation, co-responsable du traitement, désigne pour administrer ses
// membres. Il n'est PAS l'export de portabilité (art. 20), qui ne porte que
// sur les données de la personne elle-même (`src/lib/csv-export.ts`).
//
// Colonnes fermées : nom, e-mail, rôle, manager, équipes, date d'arrivée.
// ❌ Ne pas y ajouter la dernière activité ni un identifiant interne : un
// fichier qui sort de l'application n'emporte que ce dont un annuaire a besoin.
// L'échappement anti-formule (faille N11) est celui de `csv-export.ts`.
// ═══════════════════════════════════════════════════════════════════

import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import { directoryRoleOf, type DirectoryRole } from './member-directory.filters';

export interface DirectoryCsvLabels {
  headers: { name: string; email: string; role: string; manager: string; teams: string; joinedAt: string };
  roles: Record<DirectoryRole, string>;
}

/** Jour d'arrivée `YYYY-MM-DD` : un tableur le reconnaît comme une date, quelle que soit la langue. */
const dayOf = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
};

export function buildDirectoryCsv(
  rows: OrgMember[],
  allMembers: OrgMember[],
  teamsByUser: Map<string, OrgTeam[]>,
  labels: DirectoryCsvLabels,
): { headers: string[]; rows: string[][] } {
  const nameOf = new Map(allMembers.map((m) => [m.userId, m.displayName]));
  const h = labels.headers;
  return {
    headers: [h.name, h.email, h.role, h.manager, h.teams, h.joinedAt],
    rows: rows.map((m) => [
      m.displayName,
      m.email ?? '',
      labels.roles[directoryRoleOf(m, allMembers)],
      m.managerId ? nameOf.get(m.managerId) ?? '' : '',
      (teamsByUser.get(m.userId) ?? []).map((t) => t.name).sort((a, b) => a.localeCompare(b)).join(' | '),
      dayOf(m.joinedAt),
    ]),
  };
}
