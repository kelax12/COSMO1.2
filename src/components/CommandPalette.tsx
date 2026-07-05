import { useState, useEffect, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  Sun,
  LogOut,
  Plus,
  CalendarPlus,
  Keyboard,
} from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/modules/auth/AuthContext';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import { useTasks } from '@/modules/tasks';
import { useHabits } from '@/modules/habits';
import { useEvents } from '@/modules/events';
import { useOkrs } from '@/modules/okrs';

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigation' | 'Actions' | 'Préférences';
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
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: events = [] } = useEvents();
  const { data: okrs = [] } = useOkrs();

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
        <CommandGroup heading="Événements">
          {matchedEvents.map((e) => (
            <CommandItem key={`event-${e.id}`} value={`event-${e.id}`} onSelect={() => go('/agenda')}>
              <Calendar size={16} aria-hidden="true" />
              <span className="flex-1">{e.title}</span>
              <span className="text-xs text-[rgb(var(--color-text-muted))]">
                {new Date(e.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useDarkMode();

  const commands: PaletteCommand[] = useMemo(() => {
    const nav = (path: string, state?: Record<string, boolean>) => () => {
      navigate(path, state ? { state } : undefined);
      setIsOpen(false);
    };
    const base: PaletteCommand[] = [
      { id: 'nav-dashboard', label: "Aller à l'accueil", group: 'Navigation', icon: <LayoutDashboard size={16} />, run: nav('/dashboard'), keywords: ['dashboard', 'accueil', 'home', 'tableau de bord'] },
      { id: 'nav-tasks', label: 'Aller aux tâches', group: 'Navigation', icon: <CheckSquare size={16} />, run: nav('/tasks'), keywords: ['tasks', 'todo', 'todolist'] },
      { id: 'nav-agenda', label: "Aller à l'agenda", group: 'Navigation', icon: <Calendar size={16} />, run: nav('/agenda'), keywords: ['calendar', 'événements', 'events'] },
      { id: 'nav-habits', label: 'Aller aux habitudes', group: 'Navigation', icon: <Repeat size={16} />, run: nav('/habits'), keywords: ['habits', 'routines'] },
      { id: 'nav-okr', label: 'Aller aux OKR', group: 'Navigation', icon: <Target size={16} />, run: nav('/okr'), keywords: ['objectives', 'key results', 'objectifs'] },
      { id: 'nav-statistics', label: 'Aller aux statistiques', group: 'Navigation', icon: <TrendingUp size={16} />, run: nav('/statistics'), keywords: ['stats', 'analytics', 'analyses'] },
      { id: 'nav-settings', label: 'Aller aux paramètres', group: 'Navigation', icon: <SettingsIcon size={16} />, run: nav('/settings'), keywords: ['settings', 'config', 'réglages'] },
      ...(PREMIUM_ENFORCED
        ? [{ id: 'nav-premium', label: 'Voir Premium', group: 'Navigation' as const, icon: <Crown size={16} />, run: nav('/premium'), keywords: ['premium', 'subscription', 'abonnement'] }]
        : []),
      { id: 'pref-theme-light', label: 'Thème clair', group: 'Préférences', icon: <Sun size={16} />, run: () => { setTheme('light'); setIsOpen(false); }, keywords: ['theme', 'light', 'jour', 'clair'] },
      { id: 'pref-theme-dark', label: 'Thème sombre', group: 'Préférences', icon: <Moon size={16} />, run: () => { setTheme('dark'); setIsOpen(false); }, keywords: ['theme', 'dark', 'nuit', 'sombre'] },
    ];
    if (isAuthenticated) {
      base.push(
        {
          id: 'action-quick-add',
          label: 'Créer une tâche rapide',
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
          label: 'Créer un événement',
          group: 'Actions',
          icon: <CalendarPlus size={16} />,
          run: nav('/agenda', { openCreate: true }),
          keywords: ['nouvel', 'evenement', 'event', 'rdv', 'rendez-vous', 'creer', 'ajouter'],
        },
        {
          id: 'action-create-habit',
          label: 'Créer une habitude',
          group: 'Actions',
          icon: <Repeat size={16} />,
          run: nav('/habits', { openCreate: true }),
          keywords: ['nouvelle', 'habitude', 'habit', 'routine', 'creer', 'ajouter'],
        },
        {
          id: 'action-create-okr',
          label: 'Créer un objectif',
          group: 'Actions',
          icon: <Target size={16} />,
          run: nav('/okr', { openCreate: true }),
          keywords: ['nouvel', 'objectif', 'okr', 'creer', 'ajouter'],
        },
        {
          id: 'action-shortcuts',
          label: 'Afficher les raccourcis clavier',
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
          label: 'Se déconnecter',
          group: 'Actions',
          icon: <LogOut size={16} />,
          run: () => { logout(); setIsOpen(false); },
          keywords: ['logout', 'signout', 'sortir', 'deconnexion'],
        },
      );
    }
    return base;
  }, [navigate, setTheme, logout, isAuthenticated]);

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
                placeholder="Rechercher une tâche, une page, une commande..."
                className="text-[rgb(var(--color-text-primary))]"
              />
              <CommandList className="max-h-none flex-1">
                <CommandEmpty>Aucun résultat</CommandEmpty>
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
                    naviguer
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">↵</kbd>
                    ouvrir
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]">ESC</kbd>
                    fermer
                  </span>
                </div>
                <span className="hidden sm:inline">
                  {theme === 'dark' ? 'Sombre' : 'Clair'}
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
