import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';

type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  className?: string;
  /** true → 2-button segmented control; false (default) → single cycling icon button */
  showLabel?: boolean;
}

const THEMES: { id: Theme; icon: React.ElementType; label: string }[] = [
  { id: 'light', icon: Sun,  label: 'Clair'  },
  { id: 'dark',  icon: Moon, label: 'Sombre' },
];

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, setTheme, toggleTheme } = useDarkMode();

  /* ── Segmented control (3 buttons) ── */
  if (showLabel) {
    return (
      <div
        className={`inline-flex items-center gap-0.5 p-1 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl ${className}`}
        role="radiogroup"
        aria-label="Thème de l'interface"
      >
        {THEMES.map(({ id, icon: Icon, label }) => {
          const active = theme === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(id)}
              title={label}
              style={{ minHeight: '36px', minWidth: '64px' }}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                active
                  ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] shadow-sm border border-[rgb(var(--color-border))]'
                  : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              <Icon
                size={13}
                className={
                  id === 'light'
                    ? active ? 'text-amber-500' : ''
                    : id === 'dark'
                    ? active ? 'text-[rgb(var(--color-accent))]' : ''
                    : active ? 'text-[rgb(var(--color-text-primary))]' : ''
                }
                fill="none"
              />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Single cycling icon button ── */
  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];
  const Icon = current.icon;

  return (
    <button
      onClick={toggleTheme}
      title={`Thème : ${current.label} — cliquer pour changer`}
      aria-label={`Thème actuel : ${current.label}. Cliquer pour changer.`}
      className={`p-3 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40 ${className}`}
    >
      <Icon
        size={18}
        className={theme === 'light' ? 'text-amber-500' : 'text-[rgb(var(--color-accent))]'}
        fill="none"
      />
    </button>
  );
};

export default ThemeToggle;
