import { Activity, Tag, UserRound, Users, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import { useT } from '@/i18n/useT';
import MemberAvatar from './MemberAvatar';
import TeamColorDot from './TeamColorDot';
import { OKR_STATES, type OkrFilters, type OkrState } from './okr-filters.helpers';

interface OkrFilterBarProps {
  filters: OkrFilters;
  setFilters: (patch: Partial<OkrFilters>) => void;
  teams: OrgTeam[];
  members: OrgMember[];
  currentUserId?: string;
  /** Catégories de l'entreprise, à plat, avec leur profondeur dans l'arbre (mig. 148). */
  categories?: { id: string; name: string; color: string; depth: number }[];
  category?: string;
  setCategory?: (id: string) => void;
}

const trigger = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
const on = 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent)/0.1)] text-[rgb(var(--color-text-primary))]';
const off = 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]';

const STATE_DOT: Record<OkrState, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-red-500',
  no_checkin: 'bg-slate-400',
  done: 'bg-blue-500',
};

/** Filtres équipe · porteur · état de l'onglet OKR (audit 2026-09-24). */
const OkrFilterBar = ({ filters, setFilters, teams, members, currentUserId, categories = [], category = '', setCategory }: OkrFilterBarProps) => {
  const { t } = useT('portfolio');
  const stateLabel: Record<OkrState, string> = {
    on_track: t('okrFilters.stateOnTrack'),
    at_risk: t('okrFilters.stateAtRisk'),
    off_track: t('okrFilters.stateOffTrack'),
    no_checkin: t('okrFilters.stateNoCheckin'),
    done: t('okrFilters.stateDone'),
  };
  const team = teams.find((x) => x.id === filters.team);
  const person = members.find((m) => m.userId === filters.person);
  const personName = (m: OrgMember) => (m.userId === currentUserId ? t('taskTable.you') : m.displayName);
  const cat = categories.find((c) => c.id === category);
  const active = filters.team !== '' || filters.person !== '' || filters.state !== '' || category !== '';

  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={t('okrFilters.barAria')}>
      {setCategory && categories.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={t('okrFilters.categoryAria')} className={`${trigger} ${category ? on : off}`}>
            {cat ? <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden="true" /> : <Tag size={13} aria-hidden="true" />}
            <span className="max-w-[140px] truncate">{cat?.name ?? t('okrFilters.category')}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
            <DropdownMenuItem onClick={() => setCategory('')}>{t('okrFilters.allCategories')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => setCategory(c.id)} style={{ paddingLeft: 8 + c.depth * 14 }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                <span className="truncate">{c.name}</span>
                {c.id === category && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('okrFilters.teamAria')} className={`${trigger} ${filters.team ? on : off}`}>
          {team ? <TeamColorDot color={team.color} /> : <Users size={13} aria-hidden="true" />}
          <span className="max-w-[140px] truncate">
            {filters.team === 'org' ? t('okrFilters.orgWide') : team?.name ?? t('okrFilters.team')}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => setFilters({ team: '' })}>{t('okrFilters.allTeams')}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilters({ team: 'org' })}>{t('okrFilters.orgWide')}</DropdownMenuItem>
          {teams.length > 0 && <DropdownMenuSeparator />}
          {teams.map((tm) => (
            <DropdownMenuItem key={tm.id} onClick={() => setFilters({ team: tm.id })}>
              <TeamColorDot color={tm.color} />
              <span className="truncate">{tm.name}</span>
              {tm.id === filters.team && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('okrFilters.personAria')} className={`${trigger} ${filters.person ? on : off}`}>
          {person ? <MemberAvatar avatar={person.avatar} name={person.displayName} size={20} /> : <UserRound size={13} aria-hidden="true" />}
          <span className="max-w-[140px] truncate">{person ? personName(person) : t('okrFilters.person')}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
          <DropdownMenuItem onClick={() => setFilters({ person: '' })}>{t('okrFilters.anyone')}</DropdownMenuItem>
          {currentUserId && (
            <DropdownMenuItem onClick={() => setFilters({ person: currentUserId })}>{t('okrFilters.mine')}</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {members.map((m) => (
            <DropdownMenuItem key={m.userId} onClick={() => setFilters({ person: m.userId })}>
              <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
              <span className="truncate">{personName(m)}</span>
              {m.userId === filters.person && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('okrFilters.stateAria')} className={`${trigger} ${filters.state ? on : off}`}>
          {filters.state ? <span className={`w-2 h-2 rounded-full ${STATE_DOT[filters.state]}`} aria-hidden="true" /> : <Activity size={13} aria-hidden="true" />}
          {filters.state ? stateLabel[filters.state] : t('okrFilters.state')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => setFilters({ state: '' })}>{t('okrFilters.anyState')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          {OKR_STATES.map((s) => (
            <DropdownMenuItem key={s} onClick={() => setFilters({ state: s })}>
              <span className={`w-2 h-2 rounded-full ${STATE_DOT[s]}`} aria-hidden="true" />
              {stateLabel[s]}
              {s === filters.state && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {active && (
        <button
          type="button"
          onClick={() => { setFilters({ team: '', person: '', state: '' }); setCategory?.(''); }}
          className="inline-flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
        >
          <X size={12} aria-hidden="true" /> {t('filters.clearAll')}
        </button>
      )}
    </div>
  );
};

export default OkrFilterBar;
