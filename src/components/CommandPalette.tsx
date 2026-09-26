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
  Building2,
  Flag,
  Crosshair,
} from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/modules/auth/AuthContext';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';
import { parseISO } from 'date-fns';
import { useActiveOrganization } from '@/modules/organizations';
import { useOrgSearch } from '@/modules/organizations/search.hooks';
import type { OrgSearchKind, OrgSearchResult } from '@/modules/organizations/governance.types';
import {
  ORG_SEARCH_ORDER, groupOrgResults, orgSearchLink, isProjectDetail, isTaskDetail, isDayKey,
} from '@/components/organization/org-search.helpers';
import { buildOrgLink } from '@/components/organization/deep-link.helpers';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  run: () => void;
  keywords?: string[];
}

/** Icône de chaque groupe de la recherche d'entreprise. */
const ORG_SEARCH_ICON: Record<OrgSearchKind, typeof CheckSquare> = {
  project: FolderKanban,
  milestone: Flag,
  task: CheckSquare,
  okr: Target,
  kr: Crosshair,
  member: UserRound,
  team: UsersRound,
};

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
  const ov = useT('overlays');
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();
  // Périmètre entreprise : UNE recherche SERVEUR (mig. 191, `search_org`),
  // sous les droits de qui cherche. Projets, membres, équipes et OKR étaient
  // filtrés ici dans des caches que la palette faisait CHARGER EN ENTIER à la
  // première frappe (jusqu'à 1 000 tâches, 500 membres, 5 000 OKR) ; jalons et
  // résultats clés n'étaient pas cherchables du tout. 250 ms d'attente : une
  // requête par pause de frappe, pas une par touche.
  const { activeOrg } = useActiveOrganization();
  const [serverQuery, setServerQuery] = useState(query.trim());
  useEffect(() => {
    const id = window.setTimeout(() => setServerQuery(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);
  const { data: orgResults = [] } = useOrgSearch(activeOrg?.id, serverQuery);
  const orgGroups = useMemo(() => groupOrgResults(orgResults), [orgResults]);

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
  // Le détail vient du serveur : il n'est affiché que traduit, jamais brut
  // (un statut inconnu d'une base plus récente ne s'affiche pas).
  const orgDetail = (r: OrgSearchResult): string => {
    switch (r.kind) {
      case 'member': return r.detail ?? '';
      case 'milestone':
      case 'okr': return isDayKey(r.detail) ? formatDate(parseISO(r.detail), { day: 'numeric', month: 'short' }) : '';
      case 'project': return isProjectDetail(r.detail) ? ov.t(`palette.orgSearch.projectStatus.${r.detail}`) : '';
      case 'task': return isTaskDetail(r.detail) ? ov.t(`palette.orgSearch.taskStatus.${r.detail}`) : '';
      case 'kr': return ov.t('palette.orgSearch.keyResult');
      default: return '';
    }
  };

  const go = (path: string, state?: Record<string, string>) => {
    navigate(path, state ? { state } : undefined);
    onDone();
  };

  return (
    <>
      {matchedTasks.length > 0 && (
        <CommandGroup heading={ov.t('palette.tasks')}>
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
        <CommandGroup heading={ov.t('palette.events')}>
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
      {ORG_SEARCH_ORDER.map((kind) => {
        const rows = orgGroups.get(kind);
        if (!rows || rows.length === 0) return null;
        const Icon = ORG_SEARCH_ICON[kind];
        return (
          <CommandGroup key={kind} heading={ov.t(`palette.orgSearch.${kind}`)}>
            {rows.map((r) => (
              <CommandItem key={`org-${kind}-${r.id}`} value={`org-${kind}-${r.id}`} onSelect={() => go(orgSearchLink(r))}>
                <Icon size={16} className={r.detail === 'done' ? 'opacity-40' : ''} aria-hidden="true" />
                <span className={`flex-1 truncate ${r.detail === 'done' ? 'line-through opacity-60' : ''}`}>{r.label}</span>
                <span className="text-xs text-[rgb(var(--color-text-muted))] truncate max-w-[40%]">{orgDetail(r)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        );
      })}
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
  const ov = useT('overlays');
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useDarkMode();
  const { activeOrg } = useActiveOrganization();
  const hasOrg = isAuthenticated && !!activeOrg;

  const commands: PaletteCommand[] = useMemo(() => {
    const nav = (path: string, state?: Record<string, boolean>) => () => {
      navigate(path, state ? { state } : undefined);
      setIsOpen(false);
    };
    const base: PaletteCommand[] = [
      { id: 'nav-dashboard', label: ov.t('palette.goHome'), group: ov.t('palette.groupNavigation'), icon: <LayoutDashboard size={16} />, run: nav('/dashboard'), keywords: ['dashboard', 'accueil', 'home', 'tableau de bord'] },
      { id: 'nav-tasks', label: ov.t('palette.goTasks'), group: ov.t('palette.groupNavigation'), icon: <CheckSquare size={16} />, run: nav('/tasks'), keywords: ['tasks', 'todo', 'todolist'] },
      { id: 'nav-agenda', label: ov.t('palette.goAgenda'), group: ov.t('palette.groupNavigation'), icon: <Calendar size={16} />, run: nav('/agenda'), keywords: ['calendar', 'événements', 'events'] },
      { id: 'nav-habits', label: ov.t('palette.goHabits'), group: ov.t('palette.groupNavigation'), icon: <Repeat size={16} />, run: nav('/habits'), keywords: ['habits', 'routines'] },
      { id: 'nav-okr', label: ov.t('palette.goOkr'), group: ov.t('palette.groupNavigation'), icon: <Target size={16} />, run: nav('/okr'), keywords: ['objectives', 'key results', 'objectifs'] },
      { id: 'nav-statistics', label: ov.t('palette.goStats'), group: ov.t('palette.groupNavigation'), icon: <TrendingUp size={16} />, run: nav('/statistics'), keywords: ['stats', 'analytics', 'analyses'] },
      { id: 'nav-settings', label: ov.t('palette.goSettings'), group: ov.t('palette.groupNavigation'), icon: <SettingsIcon size={16} />, run: nav('/settings'), keywords: ['settings', 'config', 'réglages'] },
      ...(PREMIUM_ENFORCED
        ? [{ id: 'nav-premium', label: t('nav.seePremium'), group: 'Navigation' as const, icon: <Crown size={16} />, run: nav('/premium'), keywords: ['premium', 'subscription', 'abonnement'] }]
        : []),
      { id: 'pref-theme-light', label: ov.t('palette.themeLight'), group: ov.t('palette.groupPreferences'), icon: <Sun size={16} />, run: () => { setTheme('light'); setIsOpen(false); }, keywords: ['theme', 'light', 'jour', 'clair'] },
      { id: 'pref-theme-dark', label: ov.t('palette.themeDark'), group: ov.t('palette.groupPreferences'), icon: <Moon size={16} />, run: () => { setTheme('dark'); setIsOpen(false); }, keywords: ['theme', 'dark', 'nuit', 'sombre'] },
      { id: 'pref-theme-gris', label: ov.t('palette.themeGrey'), group: ov.t('palette.groupPreferences'), icon: <Circle size={16} />, run: () => { setTheme('gris'); setIsOpen(false); }, keywords: ['theme', 'gris', 'graphite', 'github'] },
      { id: 'pref-theme-noir', label: ov.t('palette.themeBlack'), group: ov.t('palette.groupPreferences'), icon: <MoonStar size={16} />, run: () => { setTheme('noir'); setIsOpen(false); }, keywords: ['theme', 'noir', 'oled', 'amoled', 'monochrome'] },
    ];
    // Sections de l'espace entreprise (M7) : atteignables au clavier depuis
    // n'importe quelle page, pour qui appartient à une organisation.
    if (hasOrg) {
      const org = ov.t('palette.groupOrg');
      base.push(
        { id: 'org-overview', label: ov.t('palette.goOrgOverview'), group: org, icon: <Building2 size={16} />, run: nav(buildOrgLink('overview')), keywords: ['entreprise', 'company', 'aperçu', 'overview', 'mon travail'] },
        { id: 'org-tasks', label: ov.t('palette.goOrgTasks'), group: org, icon: <CheckSquare size={16} />, run: nav(buildOrgLink('tasks')), keywords: ['entreprise', 'company', 'tâches', 'tasks'] },
        { id: 'org-projects', label: ov.t('palette.goOrgProjects'), group: org, icon: <FolderKanban size={16} />, run: nav(buildOrgLink('projects')), keywords: ['entreprise', 'company', 'projets', 'projects'] },
        { id: 'org-okr', label: ov.t('palette.goOrgOkr'), group: org, icon: <Target size={16} />, run: nav(buildOrgLink('okr')), keywords: ['entreprise', 'company', 'okr', 'objectifs'] },
        { id: 'org-members', label: ov.t('palette.goOrgMembers'), group: org, icon: <UsersRound size={16} />, run: nav(buildOrgLink('members')), keywords: ['entreprise', 'company', 'membres', 'members', 'équipes', 'teams', 'inviter'] },
        { id: 'org-settings', label: ov.t('palette.goOrgSettings'), group: org, icon: <SettingsIcon size={16} />, run: nav(buildOrgLink('settings')), keywords: ['entreprise', 'company', 'paramètres', 'settings', 'profil', 'quitter', 'supprimer'] },
      );
    }
    if (isAuthenticated) {
      base.push(
        {
          id: 'action-quick-add',
          label: ov.t('palette.quickTask'),
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
          label: ov.t('palette.createEvent'),
          group: 'Actions',
          icon: <CalendarPlus size={16} />,
          run: nav('/agenda', { openCreate: true }),
          keywords: ['nouvel', 'evenement', 'event', 'rdv', 'rendez-vous', 'creer', 'ajouter'],
        },
        {
          id: 'action-create-habit',
          label: ov.t('palette.createHabit'),
          group: 'Actions',
          icon: <Repeat size={16} />,
          run: nav('/habits', { openCreate: true }),
          keywords: ['nouvelle', 'habitude', 'habit', 'routine', 'creer', 'ajouter'],
        },
        {
          id: 'action-create-okr',
          label: ov.t('palette.createObjective'),
          group: 'Actions',
          icon: <Target size={16} />,
          run: nav('/okr', { openCreate: true }),
          keywords: ['nouvel', 'objectif', 'okr', 'creer', 'ajouter'],
        },
        {
          id: 'action-shortcuts',
          label: ov.t('palette.showShortcuts'),
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
          label: ov.t('palette.logout'),
          group: 'Actions',
          icon: <LogOut size={16} />,
          run: () => { logout(); setIsOpen(false); },
          keywords: ['logout', 'signout', 'sortir', 'deconnexion'],
        },
      );
    }
    return base;
    // `t` en dépendance : toutes les commandes portent un libellé traduit.
  }, [navigate, setTheme, logout, isAuthenticated, hasOrg, t]);

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

  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Cette surface n'en portait aucune.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: isOpen,
    onClose: () => setIsOpen(false),
    label: ov.t('palette.searchPlaceholder'),
  });
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={modalA11yRef}
          {...modalA11yProps}
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
                placeholder={ov.t('palette.searchPlaceholder')}
                className="text-[rgb(var(--color-text-primary))]"
              />
              <CommandList className="max-h-none flex-1">
                <CommandEmpty>{ov.t('palette.noResult')}</CommandEmpty>
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
                    {ov.t('palette.navigate')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">↵</kbd>
                    {ov.t('palette.open')}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">ESC</kbd>
                    {ov.t('palette.close')}
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
