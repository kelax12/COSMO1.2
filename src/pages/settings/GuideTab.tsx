import { motion } from 'framer-motion';
import { HelpCircle, ChevronRight, BarChart3 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import ReplayTutorialsCard from './ReplayTutorialsCard';
import { tabMotion } from './tab-motion';

interface GuideTabProps {
  reduced: boolean | null;
  /** Allowlist `admin_users` (affichage) ; le vrai gate reste la RPC serveur de la console. */
  isAdmin: boolean;
  onOpenGuide: () => void;
  onOpenAdmin: () => void;
  onOpenSupport: () => void;
}

/** Onglet Aide : guide, tutoriels, support, console admin. */
export default function GuideTab({ reduced, isAdmin, onOpenGuide, onOpenAdmin, onOpenSupport }: GuideTabProps) {
  const { t } = useT('settings');
  return (
    <motion.div {...tabMotion(reduced)} className="max-w-3xl flex flex-col gap-4">

      <div>
        <h2 className="text-xl font-extrabold text-[rgb(var(--color-text-primary))] mb-1">
          {t('help.heading')}
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {t('help.intro')}
        </p>
      </div>

      <div
        className="flex flex-col gap-6 p-6 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)' }}
      >
        <div>
          <p className="text-base font-bold text-[rgb(var(--color-text-primary))]">{t('help.guideTitle')}</p>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-0.5">{t('help.guideHint')}</p>
        </div>
        <button
          onClick={onOpenGuide}
          style={{ minHeight: '48px' }}
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] rounded-xl text-sm font-semibold active:scale-[0.97] transition-all duration-150"
        >
          {t('help.openGuide')} <ChevronRight size={15} />
        </button>
      </div>

      <ReplayTutorialsCard />

      {/* support card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[rgb(var(--color-accent-solid))] flex items-center justify-center shrink-0">
            <HelpCircle size={15} className="text-[rgb(var(--color-accent-solid-foreground))]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('help.supportTitle')}</p>
            <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('help.supportHint')}</p>
          </div>
        </div>
        <button onClick={onOpenSupport}
          className="inline-flex items-center justify-center gap-1.5 px-4 min-h-touch sm:min-h-[40px] rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
          {t('help.contactSupport')} <ChevronRight size={12} />
        </button>
      </div>

      {/* admin card — visible uniquement pour l'allowlist admin_users
          (useIsAdmin). Le vrai gate reste la RPC get_admin_stats. */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <BarChart3 size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('help.adminTitle')}</p>
              <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('help.adminHint')}</p>
            </div>
          </div>
          <button onClick={onOpenAdmin}
            className="inline-flex items-center justify-center gap-1.5 px-4 min-h-touch sm:min-h-[40px] rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
            {t('help.openDashboard')} <ChevronRight size={12} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
