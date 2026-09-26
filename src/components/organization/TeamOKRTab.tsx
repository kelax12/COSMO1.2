import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Target } from 'lucide-react';
import {
  useTeamOKRs,
  useUpdateTeamKR,
  useDeleteTeamOKR,
  type TeamOKR,
  type TeamKeyResult,
} from '@/modules/team-okrs';
import { useOkrCycles, useKRProjects, useProjectProgress } from '@/modules/team-okrs/execution.hooks';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamCategories } from '@/modules/team-categories';
import { useMyOrgPermissions, useOrgMembers } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import TeamCategoryFilterBar, { resolveCategoryColor } from './TeamCategoryFilterBar';
import TeamOKRModal from './TeamOKRModal';
import TeamOKRCard from './TeamOKRCard';
import OkrToolbar, { type OkrView } from './OkrToolbar';
import OkrCyclesDialog from './OkrCyclesDialog';
import KRCheckinDialog from './KRCheckinDialog';
import ConfirmActionDialog from './ConfirmActionDialog';
import { buildOkrTree, EMPTY_OKR_FILTERS, filterOkrs, type OkrFilters, type OkrNode } from './okr-execution.helpers';
import { buildOrgLink } from './deep-link.helpers';
import { useT } from '@/i18n/useT';

interface TeamOKRTabProps {
  orgId: string;
}

/**
 * Onglet OKR d'entreprise (audit 2026-09-23, M9).
 *
 * Un KR n'était qu'un chiffre saisi, coupé de l'exécution. Il peut désormais
 * se calculer à partir des tâches terminées de projets reliés, porter des
 * points d'étape datés et un état déclaré, et chaque objectif peut contribuer
 * à un objectif parent : la vue « Alignement » montre comment l'entreprise se
 * décompose en objectifs d'équipe.
 */
const TeamOKRTab = ({ orgId }: TeamOKRTabProps) => {
  const { can } = useMyOrgPermissions(orgId);
  const { t } = useT('org');
  const { user } = useAuth();
  const { data: okrs = [], isLoading } = useTeamOKRs(orgId, { live: true });
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: cycles = [] } = useOkrCycles(orgId);
  const { data: members = [] } = useOrgMembers(orgId);
  const hasComputedKr = okrs.some((o) => o.keyResults.some((k) => k.progressMode === 'tasks'));
  const { data: links = [] } = useKRProjects(hasComputedKr ? orgId : undefined);
  const { data: progress = [] } = useProjectProgress(orgId, hasComputedKr);
  const updateKR = useUpdateTeamKR(orgId);
  const deleteOKR = useDeleteTeamOKR(orgId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingOKR, setEditingOKR] = useState<TeamOKR | null>(null);
  const [deleting, setDeleting] = useState<TeamOKR | null>(null);
  const [checkinKr, setCheckinKr] = useState<TeamKeyResult | null>(null);
  const [managingCycles, setManagingCycles] = useState(false);
  const [filters, setFilters] = useState<OkrFilters>(EMPTY_OKR_FILTERS);
  const [view, setView] = useState<OkrView>('list');
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());

  const ctx = useMemo(() => ({ links, progress }), [links, progress]);
  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? t('okrTab.fallbackTeam');
  const byId = useMemo(() => new Map(okrs.map((o) => [o.id, o])), [okrs]);
  const cycleById = useMemo(() => new Map(cycles.map((c) => [c.id, c])), [cycles]);
  const categoryById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const c of categories) m.set(c.id, { name: c.name, color: resolveCategoryColor(c.color) });
    return m;
  }, [categories]);
  const childCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of okrs) if (o.parentOkrId) m.set(o.parentOkrId, (m.get(o.parentOkrId) ?? 0) + 1);
    return m;
  }, [okrs]);

  const visible = useMemo(() => {
    const byCategory = activeCategoryIds.size === 0
      ? okrs
      : okrs.filter((o) => !!o.categoryId && activeCategoryIds.has(o.categoryId));
    return filterOkrs(byCategory, filters, user?.id);
  }, [okrs, activeCategoryIds, filters, user?.id]);

  const tree = useMemo(() => (view === 'tree' ? buildOkrTree(visible) : []), [view, visible]);
  const filtered = activeCategoryIds.size > 0 || filters !== EMPTY_OKR_FILTERS;

  const card = (okr: TeamOKR, depth = 0) => (
    <TeamOKRCard
      key={okr.id}
      okr={okr}
      ctx={ctx}
      depth={depth}
      parentTitle={view === 'list' && okr.parentOkrId ? byId.get(okr.parentOkrId)?.title ?? null : null}
      childCount={childCount.get(okr.id) ?? 0}
      cycle={okr.cycleId ? cycleById.get(okr.cycleId) ?? null : null}
      teamName={teamName}
      category={okr.categoryId ? categoryById.get(okr.categoryId) : undefined}
      canEdit={can['okr.create']}
      canDelete={can['okr.delete']}
      onEdit={() => setEditingOKR(okr)}
      onDelete={() => setDeleting(okr)}
      onCommitValue={(kr, value) => updateKR.mutate({ krId: kr.id, input: { currentValue: value } })}
      onCheckin={setCheckinKr}
    />
  );
  const renderNode = (node: OkrNode, depth: number): React.ReactNode[] => [
    card(node.okr, depth),
    ...node.children.flatMap((c) => renderNode(c, depth + 1)),
  ];

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">{t('okrTab.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <OkrToolbar
        filters={filters}
        onFilters={setFilters}
        cycles={cycles}
        teams={teams}
        view={view}
        onView={setView}
        onManageCycles={() => setManagingCycles(true)}
        canCreate={can['okr.create']}
        onCreate={() => setShowCreate(true)}
      />

      {/* Filtre par catégorie seulement : leur gestion vit dans Paramètres
          (M13), elles classent aussi projets et tâches. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TeamCategoryFilterBar
          orgId={orgId}
          activeCategoryIds={activeCategoryIds}
          setActiveCategoryIds={setActiveCategoryIds}
          canManage={false}
        />
        {can['category.manage'] && (
          <Link
            to={buildOrgLink('settings', undefined, { tab: 'categories' })}
            className="text-xs font-semibold text-[rgb(var(--color-accent))] hover:underline"
          >
            {t('okrExec.manageCategories')}
          </Link>
        )}
      </div>

      {okrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <Target size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('okrTab.empty')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            {can['okr.create'] ? t('okrTab.emptyManager') : t('okrTab.emptyMember')}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('okrExec.emptyFiltered')}</p>
          {filtered && (
            <button
              type="button"
              onClick={() => { setFilters(EMPTY_OKR_FILTERS); setActiveCategoryIds(new Set()); }}
              className="mt-2 text-xs font-semibold text-blue-500 hover:text-blue-600"
            >
              {t('okrTab.seeAll')}
            </button>
          )}
        </div>
      ) : view === 'tree' ? (
        <div className="space-y-3">{tree.flatMap((n) => renderNode(n, 0))}</div>
      ) : (
        <div className="space-y-4">{visible.map((o) => card(o))}</div>
      )}

      {showCreate && <TeamOKRModal orgId={orgId} allOkrs={okrs} onClose={() => setShowCreate(false)} />}
      {editingOKR && (
        <TeamOKRModal orgId={orgId} allOkrs={okrs} editingOKR={editingOKR} onClose={() => setEditingOKR(null)} />
      )}
      {checkinKr && (
        <KRCheckinDialog orgId={orgId} kr={checkinKr} members={members} onClose={() => setCheckinKr(null)} />
      )}
      {managingCycles && (
        <OkrCyclesDialog orgId={orgId} canManage={can['okr.create']} onClose={() => setManagingCycles(false)} />
      )}
      {deleting && (
        <ConfirmActionDialog
          title={t('okrExec.deleteTitle', { title: deleting.title })}
          description={
            <>
              <p>{t('okrExec.deleteBody')}</p>
              {(childCount.get(deleting.id) ?? 0) > 0 && (
                <p className="mt-2 font-semibold">{t('okrExec.deleteChildren', { count: childCount.get(deleting.id) ?? 0 })}</p>
              )}
            </>
          }
          confirmLabel={t('okrExec.deleteConfirm')}
          pending={deleteOKR.isPending}
          onConfirm={() => deleteOKR.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
};

export default TeamOKRTab;
