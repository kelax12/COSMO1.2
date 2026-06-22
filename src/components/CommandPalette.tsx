import { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search,
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
} from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useAuth } from '@/modules/auth/AuthContext';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigation' | 'Actions' | 'Préférences';
  icon: ReactNode;
  run: () => void;
  keywords?: string[];
}

/**
 * Command Palette — déclenchable via `Cmd+K` / `Ctrl+K`.
 *
 * Navigation rapide + actions globales. Filtre par sous-chaîne sur label +
 * keywords. Pas de fuzzy matching (V1) pour éviter une dépendance — substring
 * suffit pour les ~10 commandes actuelles.
 *
 * Pour ajouter une commande : éditer le `useMemo` ci-dessous.
 */
export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { theme, setTheme } = useDarkMode();

  const commands: Command[] = useMemo(() => {
    const nav = (path: string) => () => {
      navigate(path);
      setIsOpen(false);
    };
    const base: Command[] = [
      { id: 'nav-dashboard', label: 'Aller au tableau de bord', group: 'Navigation', icon: <LayoutDashboard size={18} />, run: nav('/dashboard'), keywords: ['dashboard', 'accueil', 'home'] },
      { id: 'nav-tasks', label: 'Aller aux tâches', group: 'Navigation', icon: <CheckSquare size={18} />, run: nav('/tasks'), keywords: ['tasks', 'todo', 'todolist'] },
      { id: 'nav-agenda', label: "Aller à l'agenda", group: 'Navigation', icon: <Calendar size={18} />, run: nav('/agenda'), keywords: ['calendar', 'événements', 'events'] },
      { id: 'nav-habits', label: 'Aller aux habitudes', group: 'Navigation', icon: <Repeat size={18} />, run: nav('/habits'), keywords: ['habits', 'routines'] },
      { id: 'nav-okr', label: 'Aller aux OKR', group: 'Navigation', icon: <Target size={18} />, run: nav('/okr'), keywords: ['objectives', 'key results'] },
      { id: 'nav-statistics', label: 'Aller aux statistiques', group: 'Navigation', icon: <TrendingUp size={18} />, run: nav('/statistics'), keywords: ['stats', 'analytics', 'analyses'] },
      { id: 'nav-settings', label: 'Aller aux paramètres', group: 'Navigation', icon: <SettingsIcon size={18} />, run: nav('/settings'), keywords: ['settings', 'config'] },
      // Premium masqué tant que PREMIUM_ENFORCED=false (gratuit pour tous).
      ...(PREMIUM_ENFORCED
        ? [{ id: 'nav-premium', label: 'Voir Premium', group: 'Navigation' as const, icon: <Crown size={18} />, run: nav('/premium'), keywords: ['premium', 'subscription', 'abonnement'] }]
        : []),
      // Préférences
      { id: 'pref-theme-light', label: 'Thème clair', group: 'Préférences', icon: <Sun size={18} />, run: () => { setTheme('light'); setIsOpen(false); }, keywords: ['theme', 'light', 'jour', 'clair'] },
      { id: 'pref-theme-dark', label: 'Thème sombre', group: 'Préférences', icon: <Moon size={18} />, run: () => { setTheme('dark'); setIsOpen(false); }, keywords: ['theme', 'dark', 'nuit', 'sombre'] },
    ];
    if (isAuthenticated) {
      base.push({
        id: 'action-logout',
        label: 'Se déconnecter',
        group: 'Actions',
        icon: <LogOut size={18} />,
        run: () => { logout(); setIsOpen(false); },
        keywords: ['logout', 'signout', 'sortir'],
      });
    }
    return base;
  }, [navigate, setTheme, logout, isAuthenticated]);

  // Filtrage : substring sur label + keywords (case-insensitive)
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.keywords?.some(k => k.toLowerCase().includes(q)) ?? false)
    );
  }, [commands, query]);

  // Groupage pour l'affichage
  const grouped = useMemo(() => {
    const g: Record<string, Command[]> = {};
    filtered.forEach(c => { (g[c.group] ||= []).push(c); });
    return g;
  }, [filtered]);

  // Reset selection quand query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Shortcut global Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd+K (Mac) ou Ctrl+K (Win/Linux)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Ouverture programmatique (boutons « Rechercher » sidebar desktop + sheet
  // mobile). Permet de découvrir la palette à la souris/au tactile, pas
  // seulement via le raccourci clavier.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('open-command-palette', open);
    return () => window.removeEventListener('open-command-palette', open);
  }, []);

  // Reset state à l'ouverture + focus input
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus après l'animation pour éviter le scroll jank iOS
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Navigation clavier dans la liste
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selectedIndex]?.run();
    }
  };

  // Track de l'index global pour mapper avec les groupes
  let runningIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Palette de commandes"
        >
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgb(var(--color-border))]">
              <Search size={18} className="text-[rgb(var(--color-text-muted))] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Rechercher une commande..."
                className="borderless-input flex-1 bg-transparent outline-none text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] text-sm py-1"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-hover))]">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-[rgb(var(--color-text-muted))]">
                  Aucune commande trouvée
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  <div key={group} className="py-1">
                    <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                      {group}
                    </div>
                    {items.map(cmd => {
                      runningIndex += 1;
                      const isSelected = runningIndex === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={cmd.run}
                          onMouseEnter={() => setSelectedIndex(filtered.findIndex(c => c.id === cmd.id))}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'
                              : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                          }`}
                        >
                          <span className="text-[rgb(var(--color-text-muted))]">{cmd.icon}</span>
                          <span className="flex-1">{cmd.label}</span>
                          {cmd.hint && (
                            <kbd className="text-xs text-[rgb(var(--color-text-muted))]">{cmd.hint}</kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hints */}
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
              </div>
              <span className="hidden sm:inline">
                {theme === 'dark' ? 'Sombre' : 'Clair'}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
