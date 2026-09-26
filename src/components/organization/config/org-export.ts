// ═══════════════════════════════════════════════════════════════════
// Export complet d'une organisation et flux .ics (audit du 2026-09-24,
// étape 6 : « intégrations, export CSV complet »). Logique PURE pour les
// fichiers ; la lecture passe par les dépôts, donc sous la RLS de l'admin.
//
// ⚠️ Export de DONNÉES DE TIERS (noms, e-mails des membres) : réservé aux
// admins (l'écran n'est monté que pour eux), traitement T4 du registre
// (`docs/RGPD-REGISTRE.md`). Ce n'est PAS l'export de portabilité (art. 20).
// Aucun identifiant interne, aucune description ni commentaire.
// ═══════════════════════════════════════════════════════════════════

import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam, OrgTeamMember } from '@/modules/org-teams';
import type { TeamOKR } from '@/modules/team-okrs';
import type { TeamProject, TeamTask } from '@/modules/team-projects';

export interface OrgExportData {
  members: OrgMember[];
  teams: OrgTeam[];
  memberships: OrgTeamMember[];
  projects: TeamProject[];
  tasks: TeamTask[];
  okrs: TeamOKR[];
}

export interface CsvFile { name: string; headers: string[]; rows: string[][] }

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

/** Cinq fichiers, en-têtes fournis déjà traduits (`h(clé)`). */
export function buildOrgExport(d: OrgExportData, h: (key: string) => string): CsvFile[] {
  const nameOf = new Map(d.members.map((m) => [m.userId, m.displayName]));
  const person = (id?: string | null) => (id ? nameOf.get(id) ?? '' : '');
  const teamName = new Map(d.teams.map((t) => [t.id, t.name]));
  const projectName = new Map(d.projects.map((p) => [p.id, p.name]));
  return [
    {
      name: 'members',
      headers: [h('name'), h('email'), h('role'), h('manager'), h('teams'), h('joined')],
      rows: d.members.map((m) => [
        m.displayName, m.email ?? '', m.role, person(m.managerId),
        d.memberships.filter((x) => x.userId === m.userId).map((x) => teamName.get(x.teamId) ?? '').filter(Boolean).join(' | '),
        day(m.joinedAt),
      ]),
    },
    {
      name: 'teams',
      headers: [h('name'), h('description'), h('members'), h('leads')],
      rows: d.teams.map((t) => {
        const ms = d.memberships.filter((x) => x.teamId === t.id);
        return [t.name, t.description ?? '', String(ms.length), ms.filter((x) => x.isLead).map((x) => person(x.userId)).join(' | ')];
      }),
    },
    {
      name: 'projects',
      headers: [h('name'), h('team'), h('owner'), h('status'), h('start'), h('due'), h('archived')],
      rows: d.projects.map((p) => [
        p.name, p.teamId ? teamName.get(p.teamId) ?? '' : '', person(p.ownerId), p.status ?? 'active',
        p.startDate ?? '', p.dueDate ?? '', day(p.archivedAt),
      ]),
    },
    {
      name: 'tasks',
      headers: [h('name'), h('project'), h('status'), h('priority'), h('start'), h('due'), h('duration'), h('assignees'), h('created')],
      rows: d.tasks.map((t) => [
        t.name, projectName.get(t.projectId) ?? '', t.status, `P${t.priority}`, t.startDate ?? '', t.deadline ?? '',
        String(t.estimatedTime ?? 0), t.assigneeIds.map(person).filter(Boolean).join(' | '), day(t.createdAt),
      ]),
    },
    {
      name: 'okrs',
      headers: [h('objective'), h('keyResult'), h('current'), h('target'), h('unit'), h('teams'), h('owner')],
      rows: d.okrs.flatMap((o) => o.keyResults.map((k) => [
        o.title, k.title, String(k.currentValue), String(k.targetValue), k.unit ?? '',
        o.teamIds.map((id) => teamName.get(id) ?? '').filter(Boolean).join(' | '), person(k.assigneeId),
      ])),
    },
  ];
}

// ─── Flux .ics ──────────────────────────────────────────────────────

/** Échappement RFC 5545 d'un texte (virgule, point-virgule, antislash, saut de ligne). */
export const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Découpe à 75 octets (ici : caractères, suffisant pour l'ASCII dominant), continuation par une espace. */
const fold = (line: string) => line.match(/.{1,74}/g)?.join('\r\n ') ?? line;

/**
 * Événements « toute la journée » à la date d'échéance. `UID` stable par
 * tâche : réimporter le fichier met à jour au lieu de dupliquer.
 */
export function buildTasksIcs(tasks: readonly TeamTask[], projectName: (id: string) => string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cosmo//Entreprise//FR', 'CALSCALE:GREGORIAN'];
  for (const t of tasks) {
    if (!t.deadline) continue;
    const d = t.deadline.replace(/-/g, '');
    const next = new Date(`${t.deadline}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const end = next.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:team-task-${t.id}@thecosmo.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${end}`,
      fold(`SUMMARY:${icsEscape(t.name)}`),
      fold(`DESCRIPTION:${icsEscape(projectName(t.projectId))}`),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
