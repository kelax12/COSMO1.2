import { useState, useEffect, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Target,
  TrendingUp,
  Settings as SettingsIcon,
  Crown,
  Repeat,
  Moon,
  MoonStar,
  Circle,
  Sun,
  LogOut,
  Plus,
  CalendarPlus,
  Keyboard,
  FolderKanban,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/modules/auth/AuthContext';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamOKRs } from '@/modules/team-okrs';
import { buildOrgLink } from '@/components/organization/deep-link.helpers';
import { useTeamTasks, useTeamProjects } from '@/modules/team-projects';
import { formatDate } from '@/i18n/format';
import { useActiveModules } from '@/modules/ui-states';
import { useT } from '@/i18n/useT';

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  run: () => void;
  keywords?: string[];
}

/** Normalisation accent/casse-insensible pour la recherche. */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const MAX_DATA_RESULTS = 8;

/**
 * Résultats « données » de la palette (#17) : tâches, habitudes, événements,
 * OKR — lus depuis le cache React Query (déjà chargé par les pages). Monté
 * uniquement quand l'utilisateur est authentifié ET tape une requête ≥ 2
 * caractères, pour ne pas alourdir le DOM ni déclencher de fetch hors session.
 */
const DataResults: React.FC<{ query: string; onDone: () => void }> = ({ query, onDone }) => {
  const { t } = useT('common');
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  // Périmètre équipe (#8 v2) : tâches et projets de l'org active — hooks
  // no-op (enabled: !!orgId) pour un utilisateur sans entreprise.
  const { activeOrg } = useActiveOrganization();
  const { data: teamTasks = [] } = useTeamTasks(activeOrg?.id);
  const { data: teamProjects = [] } = useTeamProjects(activeOrg?.id);
  // Périmètre entreprise élargi : membres, équipes et OKR d'équipe étaient les
  // seules entités de /entreprise introuvables au clavier.
  const { data: orgMembers = [] } = useOrgMembers(activeOrg?.id);
  const { data: orgTeams = [] } = useOrgTeams(activeOrg?.id);
  const { data: teamOkrs = [] } = useTeamOKRs(activeOrg?.id);

  const q = normalize(query);

  const matchedTasks = useMemo(
    () => tasks.filter((t) => normalize(t.name).includes(q)).slice(0, MAX_DATA_RESULTS),
    [tasks, q]
  );
  const matchedHabits = useMemo(
    () => habits.filter((h) => normalize(h.name).includes(q)).slice(0, MAX_DATA_RESULTS),
    [habits, q]
  );
  const matchedEvents = useMemo(
    () => events.filter((e) => normalize(e.title).includes(q)).slice(0, MAX_DATA_RESULTS),
    [events, q]
  );
  const matchedOkrs = useMemo(
    () => okrs.filter((o) => normalize(o.title).includes(q)).slice(0, MAX_DATA_RESULTS),
    [okrs, q]
  );
  const matchedTeamTasks = useMemo(
    () => teamTasks.filter((t) => normalize(t.name).includes(q)).slice(0, MAX_DATA_RESULTS),
    [teamTasks, q]
  );
  const matchedTeamProjects = useMemo(
    () => teamProjects.filter((p) => !p.archivedAt && normalize(p.name).includes(q)).slice(0, MAX_DATA_RESULTS),
    [teamProjects, q]
  );
  // Un membre se cherche aussi par email : c'est souvent la seule chose qu'on
  // connaisse de quelqu'un qu'on vient d'inviter.
  const matchedMembers = useMemo(
    () => orgMembers
      .filter((m) => normalize(m.displayName).includes(q) || normalize(m.email ?? '').includes(q))
      .slice(0, MAX_DATA_RESULTS),
    [orgMembers, q]
  );
  const matchedTeams = useMemo(
    () => orgTeams.filter((tm) => normalize(tm.name).includes(q)).slice(0, MAX_DATA_RESULTS),
    [orgTeams, q]
  );
  const matchedTeamOkrs = useMemo(
    () => teamOkrs.filter((o) => normalize(o.title).includes(q)).slice(0, MAX_DATA_RESULTS),
    [teamOkrs, q]
  );

  const go = (path: string, state?: Record<string, string>) => {
    navigate(path, state ? { state } : undefined);
    onDone();
  };

  return (
    <>
      {matchedTasks.length > 0 && (
        <CommandGroup heading="Tâches">
          {matchedTasks.map((t) => (
            <CommandItem key={`task-${t.id}`} value={`task-${t.id}`} onSelect={() => go('/tasks', { openTaskId: t.id })}>
              <CheckSquare size={16} className={t.completed ? 'opacity-40' : ''} aria-hidden="true" />
              <span className={t.completed ? 'line-through opacity-60' : ''}>{t.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedHabits.length > 0 && (
        <CommandGroup heading="Habitudes">
          {matchedHabits.map((h) => (
            <CommandItem key={`habit-${h.id}`} value={`habit-${h.id}`} onSelect={() => go('/habits')}>
              <Repeat size={16} aria-hidden="true" />
              <span>{h.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedEvents.length > 0 && (
        <CommandGroup heading={t('palette.events')}>
          {matchedEvents.map((e) => (
            <CommandItem key={`event-${e.id}`} value={`event-${e.id}`} onSelect={() => go('/agenda')}>
              <Calendar size={16} aria-hidden="true" />
              <span className="flex-1">{e.title}</span>
              <span className="text-xs text-[rgb(var(--color-text-muted))]">
                {formatDate(new Date(e.start), { day: 'numeric', month: 'short' })}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedOkrs.length > 0 && (
        <CommandGroup heading="Objectifs">
          {matchedOkrs.map((o) => (
            <CommandItem key={`okr-${o.id}`} value={`okr-${o.id}`} onSelect={() => go('/okr', { selectedOKRId: o.id })}>
              <Target size={16} aria-hidden="true" />
              <span>{o.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedTeamTasks.length > 0 && (
        <CommandGroup heading={t('palette.teamTasks')}>
          {matchedTeamTasks.map((teamTask) => (
            <CommandItem key={`team-task-${teamTask.id}`} value={`team-task-${teamTask.id}`} onSelect={() => go(buildOrgLink('projects', { task: teamTask.id }))}>
              <CheckSquare size={16} className={teamTask.completed ? 'opacity-40' : ''} aria-hidden="true" />
              <span className={`flex-1 ${teamTask.completed ? 'line-through opacity-60' : ''}`}>{teamTask.name}</span>
              <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('palette.team')}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedTeamProjects.length > 0 && (
        <CommandGroup heading={t('palette.teamProjects')}>
          {matchedTeamProjects.map((p) => (
            <CommandItem key={`team-project-${p.id}`} value={`team-project-${p.id}`} onSelect={() => go(buildOrgLink('projects', { project: p.id }))}>
              <FolderKanban size={16} aria-hidden="true" />
              <span>{p.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedMembers.length > 0 && (
        <CommandGroup heading={t('palette.orgMembers')}>
          {matchedMembers.map((m) => (
            <CommandItem key={`org-member-${m.userId}`} value={`org-member-${m.userId}`} onSelect={() => go(buildOrgLink('members', { member: m.userId }))}>
              <UserRound size={16} aria-hidden="true" />
              <span className="flex-1">{m.displayName}</span>
              <span className="text-xs text-[rgb(var(--color-text-muted))]">{t('palette.member')}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedTeams.length > 0 && (
        <CommandGroup heading={t('palette.orgTeams')}>
          {matchedTeams.map((tm) => (
            <CommandItem key={`org-team-${tm.id}`} value={`org-team-${tm.id}`} onSelect={() => go(buildOrgLink('members'))}>
              <UsersRound size={16} aria-hidden="true" />
              <span>{tm.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {matchedTeamOkrs.length > 0 && (
        <CommandGroup heading={t('palette.teamOkrs')}>
          {matchedTeamOkrs.map((o) => (
            <CommandItem key={`team-okr-${o.id}`} value={`team-okr-${o.id}`} onSelect={() => go(buildOrgLink('okr'))}>
              <Target size={16} aria-hidden="true" />
              <span>{o.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
};

/**
 * Command Palette — `Cmd+K` / `Ctrl+K`.
 *
 * Refonte sur cmdk (#18) : focus trap, aria listbox, scroll-into-view et
 * navigation clavier gérés par la lib (déjà dans le bundle via ui/command).
 * Recherche globale (#17) : au-delà des commandes, la palette cherche dans
 * les tâches, habitudes, événements et OKR de l'utilisateur.
 * Le filtrage est manuel (substring insensible aux accents, shouldFilter
 * désactivé) pour contrôler le nombre de résultats par groupe.
 */
export function CommandPalette() {
  const { t } = useT('common');
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useDarkMode();
  const activeModules = useActiveModules();

  const commands: PaletteCommand[] = useMemo(() => {
    const nav = (path: string, state?: Record<string, boolean>) => () => {
      navigate(path, state ? { state } : undefined);
      setIsOpen(false);
    };
    const base: PaletteCommand[] = [
      { id: 'nav-dashboard', label: t('palette.goHome'), group: t('palette.groupNavigation'), icon: <LayoutDashboard size={16} />, run: nav('/dashboard'), keywords: ['dashboard', 'accueil', 'home', 'tableau de bord'] },
      { id: 'nav-tasks', label: t('palette.goTasks'), group: t('palette.groupNavigation'), icon: <CheckSquare size={16} />, run: nav('/tasks'), keywords: ['tasks', 'todo', 'todolist'] },
      // Modules optionnels (AM10) — masqués de la palette si désactivés, sinon
      // l'entrée serait une impasse (RequireModule redirige vers le dashboard).
      ...(activeModules.agenda ? [{ id: 'nav-agenda', label: t('palette.goAgenda'), group: t('palette.groupNavigation'), icon: <Calendar size={16} />, run: nav('/agenda'), keywords: ['calendar', 'événements', 'events'] }] : []),
      ...(activeModules.habits ? [{ id: 'nav-habits', label: t('palette.goHabits'), group: t('palette.groupNavigation'), icon: <Repeat size={16} />, run: nav('/habits'), keywords: ['habits', 'routines'] }] : []),
      ...(activeModules.okr ? [{ id: 'nav-okr', label: t('palette.goOkr'), group: t('palette.groupNavigation'), icon: <Target size={16} />, run: nav('/okr'), keywords: ['objectives', 'key results', 'objectifs'] }] : []),
      ...(activeModules.statistics ? [{ id: 'nav-statistics', label: t('palette.goStats'), group: t('palette.groupNavigation'), icon: <TrendingUp size={16} />, run: nav('/statistics'), keywords: ['stats', 'analytics', 'analyses'] }] : []),
      { id: 'nav-settings', label: t('palette.goSettings'), group: t('palette.groupNavigation'), icon: <SettingsIcon size={16} />, run: nav('/settings'), keywords: ['settings', 'config', 'réglages'] },
      ...(PREMIUM_ENFORCED
        ? [{ id: 'nav-premium', label: 'Voir Premium', group: 'Navigation' as const, icon: <Crown size={16} />, run: nav('/premium'), keywords: ['premium', 'subscription', 'abonnement'] }]
        : []),
      { id: 'pref-theme-light', label: t('palette.themeLight'), group: t('palette.groupPreferences'), icon: <Sun size={16} />, run: () => { setTheme('light'); setIsOpen(false); }, keywords: ['theme', 'light', 'jour', 'clair'] },
      { id: 'pref-theme-dark', label: t('palette.themeDark'), group: t('palette.groupPreferences'), icon: <Moon size={16} />, run: () => { setTheme('dark'); setIsOpen(false); }, keywords: ['theme', 'dark', 'nuit', 'sombre'] },
      { id: 'pref-theme-gris', label: t('palette.themeGrey'), group: t('palette.groupPreferences'), icon: <Circle size={16} />, run: () => { setTheme('gris'); setIsOpen(false); }, keywords: ['theme', 'gris', 'graphite', 'github'] },
      { id: 'pref-theme-noir', label: t('palette.themeBlack'), group: t('palette.groupPreferences'), icon: <MoonStar size={16} />, run: () => { setTheme('noir'); setIsOpen(false); }, keywords: ['theme', 'noir', 'oled', 'amoled', 'monochrome'] },
    ];
    if (isAuthenticated) {
      base.push(
        {
          id: 'action-quick-add',
          label: t('palette.quickTask'),
          hint: 'N',
          group: 'Actions',
          icon: <Plus size={16} />,
          run: () => {
            setIsOpen(false);
            window.dispatchEvent(new CustomEvent('open-quick-add'));
          },
          keywords: ['nouvelle', 'tache', 'quick add', 'creer', 'ajouter'],
        },
        // Créations par type (#19) : navigation + ouverture du modal de
        // création via location.state.openCreate, lu par chaque page.
        {
          id: 'action-create-event',
          label: t('palette.createEvent'),
          group: 'Actions',
          icon: <CalendarPlus size={16} />,
          run: nav('/agenda', { openCreate: true }),
          keywords: ['nouvel', 'evenement', 'event', 'rdv', 'rendez-vous', 'creer', 'ajouter'],
        },
        {
          id: 'action-create-habit',
          label: t('palette.createHabit'),
          group: 'Actions',
          icon: <Repeat size={16} />,
          run: nav('/habits', { openCreate: true }),
          keywords: ['nouvelle', 'habitude', 'habit', 'routine', 'creer', 'ajouter'],
        },
        {
          id: 'action-create-okr',
          label: t('palette.createObjective'),
          group: 'Actions',
          icon: <Target size={16} />,
          run: nav('/okr', { openCreate: true }),
          keywords: ['nouvel', 'objectif', 'okr', 'creer', 'ajouter'],
        },
        {
          id: 'action-shortcuts',
          label: t('palette.showShortcuts'),
          hint: '?',
          group: 'Actions',
          icon: <Keyboard size={16} />,
          run: () => {
            setIsOpen(false);
            window.dispatchEvent(new CustomEvent('open-shortcuts-help'));
          },
          keywords: ['raccourcis', 'clavier', 'aide', 'shortcuts', 'help'],
        },
        {
          id: 'action-logout',
          label: t('palette.logout'),
          group: 'Actions',
          icon: <LogOut size={16} />,
          run: () => { logout(); setIsOpen(false); },
          keywords: ['logout', 'signout', 'sortir', 'deconnexion'],
        },
      );
    }
    return base;
    // `t` en dépendance : toutes les commandes portent un libellé traduit.
  }, [navigate, setTheme, logout, isAuthenticated, activeModules, t]);

  // Filtrage manuel : substring insensible aux accents sur label + keywords.
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = normalize(query);
    return commands.filter(c =>
      normalize(c.label).includes(q) ||
      (c.keywords?.some(k => normalize(k).includes(q)) ?? false)
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const g: Record<string, PaletteCommand[]> = {};
    filteredCommands.forEach(c => { (g[c.group] ||= []).push(c); });
    return g;
  }, [filteredCommands]);

  // Shortcut global Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Ouverture programmatique (boutons « Rechercher » sidebar + headers mobiles).
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('open-command-palette', open);
    return () => window.removeEventListener('open-command-palette', open);
  }, []);

  // Reset de la requête à l'ouverture.
  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const showDataResults = isAuthenticated && query.trim().length >= 2;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl"
          >
            <Command
              shouldFilter={false}
              loop
              className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
              }}
            >
              <CommandInput
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={t('palette.searchPlaceholder')}
                className="text-[rgb(var(--color-text-primary))]"
              />
              <CommandList className="max-h-none flex-1">
                <CommandEmpty>{t('palette.noResult')}</CommandEmpty>
                {showDataResults && (
                  <DataResults query={query} onDone={() => setIsOpen(false)} />
                )}
                {Object.entries(groupedCommands).map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((cmd) => (
                      <CommandItem key={cmd.id} value={cmd.id} onSelect={cmd.run}>
                        <span className="text-[rgb(var(--color-text-muted))]">{cmd.icon}</span>
                        <span className="flex-1">{cmd.label}</span>
                        {cmd.hint && (
                          <kbd className="text-xs text-[rgb(var(--color-text-muted))]">{cmd.hint}</kbd>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
              <div className="border-t border-[rgb(var(--color-border))] px-4 py-2 flex items-center justify-between text-xs text-[rgb(var(--color-text-muted))]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">↑↓</kbd>
                    {t('palette.navigate')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">↵</kbd>
                    {t('palette.open')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">ESC</kbd>
                    {t('palette.close')}
                  </span>
                </div>
                <span className="hidden sm:inline">
                  {t(`theme.${({ dark: 'dark', gris: 'grey', noir: 'black', light: 'light' } as const)[theme]}`)}
                </span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
