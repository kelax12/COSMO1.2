// Durée d'une tâche dans la fiche MOBILE (maquette 153, 2026-10-10).
//
// « 01:00 » avec une horloge et sans chevron se lisait comme une HEURE de la
// journée. La ligne affiche désormais « 1 h » et un chevron, comme ses
// voisines, et ouvre des durées courantes ; « Autre durée » garde la roue
// native pour une valeur hors liste.
import React, { useState } from 'react';
import { CellSeparator, Cell } from './primitives';
import { MobileChoiceSheet } from './MobileActionSheet';
import { formatDurationMinutes } from '@/lib/duration';
import { useT } from '@/i18n/useT';

const DURATION_PRESETS = [0, 15, 30, 45, 60, 90, 120, 180, 240];
const DURATION_OTHER = -1;

/** Minutes → `HH:MM` pour l'input natif `type="time"` (roue OS). */
const minutesToTimeValue = (minutes: number): string => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const timeValueToMinutes = (value: string): number => {
  const [h, m] = value.split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
};

interface Props {
  value: number | string;
  onChange: (minutes: number) => void;
}

const TaskDurationField: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useT('taskModal');
  const minutes = Number(value) || 0;
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(() => minutes > 0 && !DURATION_PRESETS.includes(minutes));

  return (
    <>
      <Cell
        label={t('fields.duration')}
        value={
          <span className="text-[rgb(var(--color-text-secondary))]">
            {minutes > 0 ? formatDurationMinutes(minutes) : t('common.none')}
          </span>
        }
        onTap={() => setOpen(true)}
      />
      {custom && (
        <>
          <CellSeparator />
          <div className="flex items-center justify-between px-4 min-h-11">
            <span className="text-body text-[rgb(var(--color-text-secondary))]">{t('form.durationOther')}</span>
            <input
              type="time"
              value={minutesToTimeValue(minutes)}
              onChange={(e) => onChange(timeValueToMinutes(e.target.value))}
              aria-label={t('form.durationOther')}
              className="text-body text-[rgb(var(--color-text-primary))] bg-transparent focus:outline-none text-right"
              style={{ border: 'none', minWidth: 0 }}
            />
          </div>
        </>
      )}
      <MobileChoiceSheet
        open={open}
        title={t('fields.duration')}
        onClose={() => setOpen(false)}
        options={[
          ...DURATION_PRESETS.map((m) => ({ value: m, label: m === 0 ? t('common.none') : formatDurationMinutes(m) })),
          { value: DURATION_OTHER, label: t('form.durationOther') },
        ]}
        selected={custom ? DURATION_OTHER : minutes}
        onSelect={(picked) => {
          if (picked === DURATION_OTHER) setCustom(true);
          else { setCustom(false); onChange(picked); }
          setOpen(false);
        }}
      />
    </>
  );
};

export default TaskDurationField;
