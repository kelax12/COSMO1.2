// Feuille de sélection des jours de récurrence d'un évènement. Le corps vit
// dans `WeekDaysSheet` (partagé avec les jours prévus d'une habitude).
import React from 'react';
import type { EventRecurrence } from '@/modules/events';
import { useT } from '@/i18n/useT';
import WeekDaysSheet from '@/components/WeekDaysSheet';

interface RecurrenceDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurrenceDays: number[];
  setRecurrenceDays: React.Dispatch<React.SetStateAction<number[]>>;
  setRecurrence: React.Dispatch<React.SetStateAction<EventRecurrence>>;
}

const RecurrenceDaysModal: React.FC<RecurrenceDaysModalProps> = ({
  isOpen, onClose, recurrenceDays, setRecurrenceDays, setRecurrence,
}) => {
  const { t } = useT('eventModal');
  return (
    <WeekDaysSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('repeatDays')}
      hint={t('repeatDaysHint')}
      days={recurrenceDays}
      onToggle={(d) =>
        setRecurrenceDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
      }
      onConfirm={() => {
        // Si aucun jour coché en sortie, on revient à 'none' pour éviter
        // une récurrence custom vide silencieuse.
        if (recurrenceDays.length === 0) setRecurrence('none');
        onClose();
      }}
    />
  );
};

export default RecurrenceDaysModal;
