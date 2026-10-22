// ═══════════════════════════════════════════════════════════════════
// ORG-REPORTS MODULE - Dépôt de démonstration
// ═══════════════════════════════════════════════════════════════════
//
// En démo, aucun job ne tourne à minuit : les journées sont RECALCULÉES à la
// lecture depuis les données locales, avec les mêmes règles que la mig. 202
// (tâches terminées dans la journée, par projet et par personne ; avancement
// des projets ; KR terminés). Les événements de la démo sont ceux du compte
// perso, pas ceux des membres : le bloc reste vide, comme pour une entreprise
// dont personne n'a posé d'événement professionnel.

import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { LocalStorageOrganizationsRepository } from '@/modules/organizations/local.repository';
import type { IOrgReportsRepository } from './repository';
import type { ActivityReportPayload, DailyActivityReport, ReportScope } from './types';
import { addDays, toDayKey } from './aggregate';
import { MAX_REPORT_DAYS } from './constants';

const pct = (done: number, total: number) => (total > 0 ? Math.round((100 * done) / total) : 0);

export class LocalOrgReportsRepository implements IOrgReportsRepository {
  async getReports(orgId: string, scope: ReportScope, from: string, to: string): Promise<DailyActivityReport[]> {
    const [projects, tasks, teams, teamMembers, okrs, members] = await Promise.all([
      new LocalStorageTeamProjectsRepository().getProjects(orgId),
      new LocalStorageTeamProjectsRepository().getTasks(orgId),
      new LocalStorageOrgTeamsRepository().getTeams(orgId),
      new LocalStorageOrgTeamsRepository().getTeamMembers(orgId),
      new LocalStorageTeamOKRsRepository().getAll(orgId),
      new LocalStorageOrganizationsRepository().getMembers(orgId),
    ]);

    const nameOf = new Map(members.map((m) => [m.userId, m.displayName]));
    const projectOf = new Map(projects.map((p) => [p.id, p]));
    const today = toDayKey(new Date());

    const teamId = scope.kind === 'team' ? scope.teamId : null;
    const inTeam = (tid: string) => new Set(teamMembers.filter((tm) => tm.teamId === tid).map((tm) => tm.userId));
    const scopeMembers = teamId ? inTeam(teamId) : null;
    const scopeProjects = projects.filter((p) => !p.isTemplate && (!teamId || p.teamId === teamId));
    const scopeProjectIds = new Set(scopeProjects.map((p) => p.id));
    const scopeOkrs = okrs.filter((o) => !teamId || o.teamIds.includes(teamId));

    const byOf = (t: (typeof tasks)[number]) => t.assigneeIds[0] ?? t.createdBy;
    const dayOf = (iso: string | null | undefined) => (iso ? toDayKey(new Date(iso)) : null);

    const out: DailyActivityReport[] = [];
    // Jamais la journée en cours : elle n'est pas encore close.
    for (let day = from, n = 0; day <= to && day < today && n < MAX_REPORT_DAYS; day = addDays(day, 1), n++) {
      const done = tasks.filter((t) => t.completed && dayOf(t.completedAt) === day);
      const scoped = done.filter((t) => !teamId || scopeProjectIds.has(t.projectId) || scopeMembers?.has(byOf(t)));

      const payload: ActivityReportPayload = {
        version: 1,
        tasks: scoped.map((t) => {
          const p = projectOf.get(t.projectId);
          const by = byOf(t);
          return {
            id: t.id,
            name: t.name,
            projectId: t.projectId,
            projectName: p?.name ?? null,
            projectColor: p?.color ?? null,
            byId: by,
            byName: nameOf.get(by) ?? null,
            at: t.completedAt ?? `${day}T12:00:00`,
          };
        }),
        projects: scopeProjects.flatMap((p) => {
          const own = tasks.filter((t) => t.projectId === p.id);
          const completedToday = own.filter((t) => t.completed && dayOf(t.completedAt) === day).length;
          if (completedToday === 0 || own.length === 0) return [];
          // État à la fin de CETTE journée : une tâche terminée plus tard n'y compte pas.
          const doneAtEnd = own.filter((t) => t.completed && (dayOf(t.completedAt) ?? '') <= day).length;
          return [{
            id: p.id,
            name: p.name,
            color: p.color,
            done: doneAtEnd,
            total: own.length,
            completedToday,
            before: pct(doneAtEnd - completedToday, own.length),
            after: pct(doneAtEnd, own.length),
          }];
        }),
        krs: scopeOkrs.flatMap((o) => o.keyResults
          .filter((k) => k.completed && dayOf(k.completedAt) === day)
          .map((k) => ({
            id: k.id,
            title: k.title,
            okrTitle: o.title,
            unit: k.unit ?? null,
            value: k.currentValue,
            target: k.targetValue,
            before: null,
            after: 100,
            completed: true,
          }))),
        events: [],
        teams: teamId ? [] : teams.map((t) => {
          const ids = inTeam(t.id);
          const projectIds = new Set(projects.filter((p) => p.teamId === t.id).map((p) => p.id));
          return {
            id: t.id,
            name: t.name,
            color: t.color,
            tasksDone: done.filter((d) => projectIds.has(d.projectId) || ids.has(byOf(d))).length,
          };
        }),
        truncated: false,
      };
      out.push({ day, payload });
    }
    return out;
  }
}
