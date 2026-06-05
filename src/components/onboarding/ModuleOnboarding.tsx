import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Repeat, Target, BarChart2, CheckSquare, Check } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  OPTIONAL_MODULES,
  type ModuleKey,
  setActiveModules,
  markModuleOnboardingDone,
  isModuleOnboardingDone,
} from '@/modules/ui-states';

// ─────────────────────────────────────────────────────────────────────────────
// AM10 — Onboarding progressif « Que voulez-vous gérer ? »
//
// Affiché UNE fois, au 1er login réel (pas en démo), si le flag
// `cosmo_onboarding_modules_done` est absent. L'utilisateur choisit les modules
// optionnels (Agenda / Habitudes / OKR / Statistiques) ; les onglets non cochés
// sont masqués (réactivables dans Réglages). Tâches + Dashboard = socle, toujours
// présents. La démo n'affiche jamais cet écran (tout reste actif).
//
// Monté au niveau App (survit aux changements de route).
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleCard {
  key: ModuleKey;
  label: string;
  description: string;
  icon: typeof Calendar;
  accent: string; // couleur d'accent (icône / sélection)
}

const MODULE_CARDS: ModuleCard[] = [
  { key: 'agenda',     label: 'Agenda',       description: 'Planifiez vos tâches en blocs horaires', icon: Calendar,  accent: '#ef4444' },
  { key: 'habits',     label: 'Habitudes',    description: 'Suivez vos routines quotidiennes',        icon: Repeat,    accent: '#eab308' },
  { key: 'okr',        label: 'OKR',          description: 'Objectifs & résultats clés',              icon: Target,    accent: '#22c55e' },
  { key: 'statistics', label: 'Statistiques', description: 'Analysez votre progression',              icon: BarChart2, accent: '#8b5cf6' },
];

const ModuleOnboarding: React.FC = () => {
  const { isAuthenticated, isDemo, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  // Par défaut, tout coché (parcours « tout-en-un » conservé si l'utilisateur valide direct).
  const [selected, setSelected] = useState<Record<ModuleKey, boolean>>({
    agenda: true,
    habits: true,
    okr: true,
    statistics: true,
  });

  useEffect(() => {
    if (isLoading) return;
    // Uniquement en mode réel (pas démo), une seule fois.
    if (isAuthenticated && !isDemo && !isModuleOnboardingDone()) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, isDemo, isLoading]);

  // Verrouille le scroll de fond quand ouvert.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const toggle = (key: ModuleKey) =>
    setSelected((s) => ({ ...s, [key]: !s[key] }));

  const finish = (modules: Record<ModuleKey, boolean>) => {
    setActiveModules(modules);
    markModuleOnboardingDone();
    setOpen(false);
  };

  const handleConfirm = () => finish(selected);
  const handleSkip = () =>
    finish({ agenda: true, habits: true, okr: true, statistics: true });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="module-onboarding-title"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] bg-[rgb(var(--color-background))]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle mobile */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            {/* Header */}
            <div className="px-5 sm:px-6 pt-4 pb-3 shrink-0">
              <h2
                id="module-onboarding-title"
                className="text-xl sm:text-2xl font-bold text-[rgb(var(--color-text-primary))]"
              >
                Que voulez-vous gérer&nbsp;?
              </h2>
              <p className="mt-1 text-sm text-[rgb(var(--color-text-secondary))]">
                Choisissez vos modules. Vous pourrez les réactiver à tout moment dans les Réglages.
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-2 space-y-2.5">
              {/* Module socle (toujours actif, non décochable) */}
              <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-3 opacity-90">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  <CheckSquare size={20} className="text-white" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                    Tâches &amp; Dashboard
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-secondary))]">
                    Toujours inclus
                  </p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                  Inclus
                </span>
              </div>

              {OPTIONAL_MODULES.map((key) => {
                const card = MODULE_CARDS.find((c) => c.key === key)!;
                const Icon = card.icon;
                const isOn = selected[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={isOn}
                    aria-label={`${card.label} — ${card.description}`}
                    onClick={() => toggle(key)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/50 ${
                      isOn
                        ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-surface))]'
                        : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]/40'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: isOn ? card.accent : 'rgb(var(--color-hover))' }}
                    >
                      <Icon
                        size={20}
                        className={isOn ? 'text-white' : 'text-[rgb(var(--color-text-muted))]'}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                        {card.label}
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">
                        {card.description}
                      </p>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                        isOn
                          ? 'border-transparent'
                          : 'border-[rgb(var(--color-border))]'
                      }`}
                      style={isOn ? { backgroundColor: card.accent } : undefined}
                    >
                      {isOn && <Check size={14} className="text-white" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 pt-3 pb-4 shrink-0 flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/50"
              >
                Tout activer
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                Commencer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModuleOnboarding;
