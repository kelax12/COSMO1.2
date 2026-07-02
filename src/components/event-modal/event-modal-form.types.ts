// Types partagés entre EventModalForm (wrapper) et ses deux corps
// (EventModalFormMobile / EventModalFormDesktop).
import type React from 'react';
import type { MotionValue } from 'framer-motion';
import type { EventRecurrence } from '@/modules/events';
import type { EventModalMode } from '../EventModal';

export interface EventModalFormProps {
  mode: EventModalMode;
  onClose: () => void;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  startTime: string;
  setStartTime: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  endTime: string;
  setEndTime: React.Dispatch<React.SetStateAction<string>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  color: string;
  setColor: React.Dispatch<React.SetStateAction<string>>;
  recurrence: EventRecurrence;
  setRecurrence: React.Dispatch<React.SetStateAction<EventRecurrence>>;
  recurrenceDays: number[];
  setShowDaysModal: React.Dispatch<React.SetStateAction<boolean>>;
  showDescription: boolean;
  setShowDescription: React.Dispatch<React.SetStateAction<boolean>>;
  setIsColorSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  prefilledFields: Set<string>;
  categories: Array<{ id: string; name: string; color: string }>;
  lockedSet: Set<string>;
  register: (name: string) => (el: HTMLElement | null) => void;
  isInvalid: (name: string) => boolean;
  handleFieldChange: <T,>(field: string, setter: (val: T) => void, value: T) => void;
  doSave: () => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleDelete: () => void;
  /** Dupliquer l'événement (#3) — visible en mode édition si fourni. */
  handleDuplicate?: () => void;
  getHeaderTitle: () => string;
  getSubmitButtonText: () => string;
  duration: string | null;
  isMobileFormValid: boolean;
  isPrefilledMode: boolean;
}

/** Props du corps (mobile/desktop) : tout EventModalFormProps + la largeur animée du drag handle. */
export interface EventModalFormBodyProps extends EventModalFormProps {
  handleBarWidth: MotionValue<number>;
}
