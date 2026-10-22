import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Circle, MoonStar } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { Theme } from '@/lib/theme';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface ThemeToggleProps {
  className?: string;
  /** true → segmented control (un bouton par thème) ; false (défaut) → bouton cyclique */
  showLabel?: boolean;
}

const THEMES: { id: Theme; icon: React.ElementType; labelKey: KeyOf<'common'> }[] = [
  // Libellés = CLÉS : constante de module, donc évaluée au premier import.
  { id: 'light', icon: Sun,      labelKey: 'theme.light' },
  { id: 'dark',  icon: Moon,     labelKey: 'theme.dark'  },
  { id: 'gris',  icon: Circle,   labelKey: 'theme.grey'  },
  { id: 'noir',  icon: MoonStar, labelKey: 'theme.black' },
];

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { t } = useT('common');
  const { theme, setTheme, toggleTheme } = useDarkMode();
  const visibleThemes = THEMES;

  /* ── Segmented control (4 options) ──
     Un seul indicateur (layoutId) glisse sous l'option active au lieu que
     chaque bouton porte son propre fond — lecture plus proche d'un
     segmented control natif que de 4 boutons qui s'allument indépendamment. */
  if (showLabel) {
    return (
      <div
        // `flex-wrap` : 4 thèmes × 60px ne tiennent pas sur un écran de 375px
        // dans le panneau Réglages — sans ça le 4ᵉ bouton déborde.
        className={`inline-flex flex-wrap items-center gap-0.5 p-1 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl ${className}`}
        role="radiogroup"
        aria-label={t('theme.label')}
      >
        {visibleThemes.map(({ id, labelKey }) => {
          const active = theme === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(id)}
              style={{ minHeight: '36px', minWidth: '60px' }}
              className="relative flex items-center justify-center px-3 py-1.5 rounded-lg"
            >
              {active && (
                <motion.span
                  layoutId="theme-toggle-active"
                  className="absolute inset-0 rounded-lg bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                />
              )}
              <span
                className={`relative text-xs font-semibold transition-colors duration-150 ${
                  active ? 'text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                }`}
              >
                {t(labelKey)}
              </span>
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
      title={t('theme.title', { name: t(current.labelKey) })}
      aria-label={t('theme.aria', { name: t(current.labelKey) })}
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
