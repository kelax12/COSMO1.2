// Bouton « Jours prévus » d'une habitude + sa feuille de sélection.
// Utilisé par `HabitModal` (desktop et mobile) et l'étape habitude de
// l'onboarding. La valeur est un tableau `Date.getDay()` ; 7 jours = tous.
import React, { useState } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import WeekDaysSheet from '@/components/WeekDaysSheet';
import { isEveryDay, normalizeScheduledDays } from '@/modules/habits/schedule';
import { scheduledDaysLabel } from '@/lib/week-days';

interface HabitDaysPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
  /** `row` : ligne de réglage iOS (mobile) ; `button` : bouton compact (desktop). */
  variant?: 'row' | 'button';
}

const HabitDaysPicker: React.FC<HabitDaysPickerProps> = ({ value, onChange, variant = 'button' }) => {
  const { t } = useT('habits');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(value);
  const label = scheduledDaysLabel(value, t('modal.everyDay'));

  const openSheet = () => {
    setDraft(isEveryDay(value) ? [0, 1, 2, 3, 4, 5, 6] : normalizeScheduledDays(value));
    setOpen(true);
  };

  return (
    <>
      {variant === 'row' ? (
        <button
          type="button"
          onClick={openSheet}
          aria-label={t('modal.daysAria', { days: label })}
          data-testid="habit-days-button"
          className="w-full flex items-center justify-between gap-3 px-4 min-h-11 text-left"
        >
          <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{t('modal.days')}</span>
          <span className="flex items-center gap-2 min-w-0 text-[15px] text-[rgb(var(--color-text-secondary))]">
            <span className="truncate">{label}</span>
            <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openSheet}
          aria-label={t('modal.daysAria', { days: label })}
          data-testid="habit-days-button"
          className="inline-flex items-center gap-1.5 h-[2.407419rem] px-3 rounded-lg border text-[0.765997rem] font-medium transition-colors hover:bg-[rgb(var(--color-hover))] max-w-full"
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text-primary))',
            borderColor: 'rgb(var(--color-border))',
          }}
        >
          <CalendarDays size={14} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </button>
      )}
      <WeekDaysSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('modal.daysTitle')}
        hint={t('modal.daysHint')}
        days={draft}
        onToggle={(d) => setDraft((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
        confirmDisabled={draft.length === 0}
        onConfirm={() => {
          if (draft.length === 0) return;
          onChange(normalizeScheduledDays(draft));
          setOpen(false);
        }}
      />
    </>
  );
};

export default HabitDaysPicker;
