import React from 'react';
import { GraduationCap, RotateCcw } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { toast } from '@/lib/toast';
import { requestTutorialsReplay } from '@/components/tutorial/useTutorial';

// Relance les tutoriels des quatre pages (Tâches, Agenda, Habitudes, OKR) :
// chacun s'ouvre à la prochaine visite de sa page, mobile compris.
const ReplayTutorialsCard: React.FC = () => {
  const { t } = useT('settings');

  const handleReplay = () => {
    requestTutorialsReplay();
    toast.success(t('help.replayDone'));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[rgb(var(--color-accent-solid))] flex items-center justify-center shrink-0">
          <GraduationCap size={15} className="text-[rgb(var(--color-accent-solid-foreground))]" />
        </div>
        <div>
          <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('help.replayTitle')}</p>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('help.replayHint')}</p>
        </div>
      </div>
      <button type="button" onClick={handleReplay}
        className="inline-flex items-center justify-center gap-1.5 px-4 min-h-touch sm:min-h-[40px] rounded-xl text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] active:scale-[0.97] transition-all duration-150 shrink-0">
        <RotateCcw size={12} /> {t('help.replayAction')}
      </button>
    </div>
  );
};

export default ReplayTutorialsCard;
