import { OrgEmptyState } from './OrgPagePrimitives';
import { OrgTabSkeleton } from './OrgLoadingSkeletons';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Target } from 'lucide-react';
import {
  useTeamOKRs,
  useUpdateTeamKR,
  usePostKRCheckin,
  useDeleteTeamOKR,
  useKRProjects,
  type TeamOKR,
  type TeamKeyResult,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamCategories } from '@/modules/team-categories';
import { useTeamProjects, useTeamProjectTaskStats } from '@/modules/team-projects';
import { getColorHex } from '@/lib/category-colors';
import TeamCategoryFilterBar from './TeamCategoryFilterBar';
import TeamOKRModal from './TeamOKRModal';
import DeleteTeamOkrConfirm from './DeleteTeamOkrConfirm';
import TeamOKRCard from './TeamOKRCard';
import TeamTrashDialog from './TeamTrashDialog';
import { filterOkrs, OKR_STATES, type OkrState } from './okr-filters.helpers';
import OkrFilterBar from './OkrFilterBar';
import { useUrlFilters, anId, oneOf } from './use-url-filters';
import { useAuth } from '@/modules/auth/AuthContext';
import { readEntityParam } from './deep-link.helpers';
import { useMyOrgPermissions, useOrgMembers } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { PermissionGate, usePermissionHints } from './permission-hints';

interface TeamOKRTabProps {
  orgId: string;

}

// Filtres équipe · porteur · état (audit 2026-09-24), dans l'URL : un lien
// partage ce qu'on voit. Hors composant pour garder des spécifications stables.
const OKR_FILTER_SPECS = {
  team: { param: 'oTeam', defaultValue: '', parse: (raw: string) => (raw === 'org' ? 'org' : anId('')(raw) ?? '') },
  person: { param: 'oPerson', defaultValue: '', parse: (raw: string) => anId('')(raw) ?? '' },
  state: { param: 'oState', defaultValue: '' as OkrState | '', parse: oneOf<OkrState | ''>(['', ...OKR_STATES], '') },
};

// Résout une couleur : hex tel quel, sinon nom → hex (parité mode perso).
const resolveColor = (color: string) => (color.startsWith('#') ? color : getColorHex(color));

const TeamOKRTab = ({ orgId }: TeamOKRTabProps) => {
  const { can } = useMyOrgPermissions(orgId);
  const hints = usePermissionHints(orgId);
  const { t } = useT('org');
  const [showCreate, setShowCreate] = useState(false);
  const [editingOKR, setEditingOKR] = useState<TeamOKR | null>(null);
  const [deletingOKR, setDeletingOKR] = useState<TeamOKR | null>(null);
  // `live` : c'est l'écran où l'on regarde les OKR (cf. useTeamOKRs).
  const { data: okrs = [], isLoading } = useTeamOKRs(orgId, { live: true });
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const updateKR = useUpdateTeamKR(orgId);
  const postCheckin = usePostKRCheckin(orgId);
  const deleteOKR = useDeleteTeamOKR(orgId);
  // Exécution (mig. 160) : KR reliés à des projets, avancement serveur.
  const { data: krLinks = [] } = useKRProjects(orgId);
  const { data: allProjects = [] } = useTeamProjects(orgId);
  const { data: statsRows = [] } = useTeamProjectTaskStats(orgId);
  const { data: members = [] } = useOrgMembers(orgId);
  const statsById = useMemo(() => new Map(statsRows.map((r) => [r.projectId, r])), [statsRows]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const { user } = useAuth();
  const { values: okrFilters, setFilters: setOkrFilters } = useUrlFilters(OKR_FILTER_SPECS);
  // Lien profond `?okr=<id>` (recherche globale, mig. 191) : la carte est
  // amenée à l'écran et soulignée.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedOkrId = readEntityParam(searchParams, 'okr');
  const openOkr = (okrId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('okr', okrId);
    setSearchParams(next, { replace: true });
  };

  // ── Filtre + gestion des catégories (UI identique au mode perso) ────
  // `team_categories` est hiérarchique depuis la mig. 148 : le filtre cascade
  // désormais réellement sur les sous-catégories (cf. CategoryFilterBar).
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());

  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? t('okrTab.fallbackTeam');
  const teamColor = (id: string) => teams.find((x) => x.id === id)?.color;
  // Couleur d'une catégorie par son id (badge coloré, parité mode perso).
  const colorById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const c of categories) m.set(c.id, { name: c.name, color: resolveColor(c.color) });
    return m;
  }, [categories]);

  const setCurrent = (kr: TeamKeyResult, value: number) =>
    updateKR.mutate({ krId: kr.id, input: { currentValue: value } });

  // Filtrage par catégories actives, par id — plus de détour par le nom
  // depuis que `team_okrs.category_id` est un vrai FK (mig. 148).
  const visibleOKRs = useMemo(() => {
    const byCategory = activeCategoryIds.size === 0 ? okrs : okrs.filter((o) => !!o.categoryId && activeCategoryIds.has(o.categoryId));
    return filterOkrs(byCategory, okrFilters, krLinks, statsById);
  }, [okrs, activeCategoryIds, okrFilters, krLinks, statsById]);

  // L'objectif demandé par l'URL : un filtre de catégorie qui le cacherait est
  // levé, puis on l'amène à l'écran une fois les données arrivées.
  const focusedLoaded = !!focusedOkrId && okrs.some((o) => o.id === focusedOkrId);
  const focusedHidden = focusedLoaded && !visibleOKRs.some((o) => o.id === focusedOkrId);
  useEffect(() => {
    if (!focusedHidden) return;
    setActiveCategoryIds(new Set());
    setOkrFilters({ team: '', person: '', state: '' });
  }, [focusedHidden, setOkrFilters]);
  useEffect(() => {
    if (!focusedLoaded || focusedHidden) return;
    document.getElementById(`okr-${focusedOkrId}`)?.scrollIntoView({ block: 'center' });
  }, [focusedLoaded, focusedHidden, focusedOkrId]);

  if (isLoading) {
    // Squelette (reco UI n° 47) : la forme de l'écran, pas une phrase.
    return <OrgTabSkeleton label={t('okrTab.loading')} />;
  }

  return (
    <div className="space-y-4">
      {/* Filtre par catégorie — UI identique à la page OKR perso.
          Les actions de gestion (créer/éditer/supprimer) sont réservées aux
          managers ; un simple membre ne voit que « Tous » + les chips.
          Toujours rendu (même sans catégorie) pour que la barre occupe sa place
          normale : sinon les boutons/cartes en dessous remontaient (#4). */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Filtre seulement : créer, renommer ou supprimer une catégorie se
            fait dans Paramètres → Catégories (M13). Elles classent aussi
            projets et tâches, leur gestion n'avait rien à faire ici. */}
        <TeamCategoryFilterBar
          orgId={orgId}
          activeCategoryIds={activeCategoryIds}
          setActiveCategoryIds={setActiveCategoryIds}
          canManage={false}
        />
        <PermissionGate reason={hints.deniedReason('okr.create')}>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] shadow-sm transition-colors"
          >
            <Plus size={15} aria-hidden="true" /> {t('okrTab.newObjective')}
          </button>
        </PermissionGate>
      </div>

      {/* Filtres et corbeille des objectifs (mig. 193). */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <OkrFilterBar filters={okrFilters} setFilters={setOkrFilters} teams={teams} members={members} currentUserId={user?.id} />
        <TeamTrashDialog orgId={orgId} projects={allProjects} members={members} />
      </div>

      {okrs.length === 0 ? (
        <OrgEmptyState
          Icon={Target}
          title={t('okrTab.empty')}
          body={can['okr.create'] ? t('okrTab.emptyManager') : t('okrTab.emptyMember')}
          action={can['okr.create'] ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-sm font-semibold"
            >
              <Plus size={15} aria-hidden="true" /> {t('okrTab.newObjective')}
            </button>
          ) : undefined}
        />
      ) : visibleOKRs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('okrTab.emptyCategory')}</p>
          <button
            type="button"
            onClick={() => {
              setActiveCategoryIds(new Set());
              setOkrFilters({ team: '', person: '', state: '' });
            }}
            className="mt-2 text-xs font-semibold text-blue-500 hover:text-blue-600"
          >
            {t('okrTab.seeAll')}
          </button>
        </div>
      ) : (
        visibleOKRs.map((okr) => (
          <TeamOKRCard
            key={okr.id}
            okr={okr}
            okrs={okrs}
            links={krLinks}
            statsById={statsById}
            category={okr.categoryId ? colorById.get(okr.categoryId) : undefined}
            teamName={teamName}
            teamColor={teamColor}
            editDeniedReason={hints.deniedReason('okr.create')}
            deleteDeniedReason={hints.deniedReason('okr.delete')}
            highlighted={focusedOkrId === okr.id}
            onEdit={() => setEditingOKR(okr)}
            onDelete={() => setDeletingOKR(okr)}
            onCommitKR={setCurrent}
            onSetKRHealth={(kr, status, value) => postCheckin.mutate({ krId: kr.id, value, status })}
            onOpenOkr={openOkr}
            personOf={(id) => memberById.get(id)}
          />
        ))
      )}


      {showCreate && (
        <TeamOKRModal orgId={orgId} onClose={() => setShowCreate(false)} />
      )}
      {deletingOKR && (
        <DeleteTeamOkrConfirm
          orgId={orgId}
          okr={deletingOKR}
          okrs={okrs}
          pending={deleteOKR.isPending}
          onConfirm={() => deleteOKR.mutate(deletingOKR.id, { onSuccess: () => setDeletingOKR(null) })}
          onCancel={() => setDeletingOKR(null)}
        />
      )}
      {editingOKR && (
        <TeamOKRModal orgId={orgId} editingOKR={editingOKR} onClose={() => setEditingOKR(null)} />
      )}
    </div>
  );
};

export default TeamOKRTab;
