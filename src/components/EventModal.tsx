import React, { useState, useEffect } from "react";
import { useInvalidShake } from "@/hooks/use-invalid-shake";
import ColorSettingsModal from "./ColorSettingsModal";

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Types (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { Task } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module events - Types (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { CalendarEvent, EventRecurrence } from '@/modules/events';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

import { useFavoriteColors } from '@/modules/ui-states';

export type EventModalMode = 'add' | 'edit' | 'convert';

// Logique pure extraite (cf. event-modal/helpers.ts).
import {
  formatEventDuration,
  headerTitle,
  submitButtonText,
  getMissingEventFields,
  validateEventRange,
} from './event-modal/helpers';
import RecurrenceDaysModal from './event-modal/RecurrenceDaysModal';
import EventModalForm from './event-modal/EventModalForm';

type EventData = {
  title: string;
  start: string;
  end: string;
  color: string;
  notes?: string;
  taskId?: string;
  recurrence?: EventRecurrence;
  recurrenceDays?: number[];
};

type EventModalProps = {
  isOpen: boolean;
  onClose: () => void;
  mode: EventModalMode;
  task?: Task | null;
  prefilledTimeSlot?: { start: string; end: string };
  event?: CalendarEvent | null;
  onAddEvent?: (event: EventData) => void;
  onUpdateEvent?: (eventId: string, eventData: Omit<EventData, 'taskId'>) => void;
  onDeleteEvent?: (eventId: string) => void;
  onDuplicateEvent?: (eventId: string) => void;
  onConvert?: (eventData: EventData) => void;
  /**
   * Liste des champs à verrouiller (lecture seule). Valeurs supportées :
   * 'title', 'startDate', 'endDate'. Permet à l'appelant de figer certains
   * champs pré-remplis (cas d'usage : planifier une habitude → titre +
   * date imposés, seuls horaires et catégorie restent éditables).
   */
  lockedFields?: ('title' | 'startDate' | 'endDate')[];
};

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  mode,
  task,
  prefilledTimeSlot,
  event,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onDuplicateEvent,
  onConvert,
  lockedFields = [],
}) => {
  // Set pour lookup O(1) — utilisé partout dans le rendu pour disabled/readOnly
  const lockedSet = new Set(lockedFields);
  const { register, trigger, clear, isInvalid } = useInvalidShake();

  // La section Description est masquée par défaut (UX épuré). Visible si :
  //   - mode edit + l'event a déjà des notes (sinon on perdrait visuellement le contenu)
  //   - l'utilisateur clique sur "+ Ajouter un commentaire"
  // Re-évaluée à chaque ouverture, mais PAS à chaque frappe (sinon le focus
  // sauterait quand l'user vide le textarea).
  const [showDescription, setShowDescription] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setShowDescription(Boolean(notes && notes.length > 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const { favoriteColors } = useFavoriteColors();
  const { data: categories = [] } = useCategories();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState(categories[0]?.color || "#3B82F6");
  const [recurrence, setRecurrence] = useState<EventRecurrence>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [showDaysModal, setShowDaysModal] = useState(false);
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);


  useEffect(() => {
    if (!isOpen) return;

    const prefilled = new Set<string>();

    if (mode === 'edit' && event) {
      setTitle(event.title || "");
      setNotes(event.notes || "");
      setColor(event.color || "#3B82F6");
      setRecurrence(event.recurrence ?? 'none');
      setRecurrenceDays(event.recurrenceDays ?? []);

      const start = new Date(event.start);
      const end = new Date(event.end);

      // Date LOCALE (en-CA) — l'heure vient de toTimeString() (locale) : mixer
      // avec une date UTC décalait l'événement d'un jour à la sauvegarde
      // quand date UTC ≠ date locale (ex. event à 00h30 en France).
      setStartDate(start.toLocaleDateString("en-CA"));
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toLocaleDateString("en-CA"));
      setEndTime(end.toTimeString().slice(0, 5));
    } else if (mode === 'add' && task) {
      setRecurrence('none');
      setRecurrenceDays([]);
      setTitle(task.name || "");
      if (task.name) prefilled.add("title");

      if (prefilledTimeSlot) {
        const start = new Date(prefilledTimeSlot.start);
        const end = new Date(prefilledTimeSlot.end);
        setStartDate(start.toLocaleDateString("en-CA"));
        setStartTime(start.toTimeString().slice(0, 5));
        setEndDate(end.toLocaleDateString("en-CA"));
        setEndTime(end.toTimeString().slice(0, 5));
        if (task.description) {
          setNotes(task.description || "");
          prefilled.add("notes");
        }
        prefilled.add("startDate");
        prefilled.add("startTime");
        prefilled.add("endDate");
        prefilled.add("endTime");
      } else if (task.id !== "") {
        const now = new Date();
        const todayStr = now.toLocaleDateString("en-CA");
        setStartDate(todayStr);
        setEndDate(todayStr);

        if (task.description) {
          setNotes(task.description || "");
          prefilled.add("notes");
        }

        if (task.estimatedTime) {
          const defaultStart = "12:00";
          setStartTime(defaultStart);
          const startTimeDate = new Date(`${todayStr}T${defaultStart}`);
          const endTimeDate = new Date(startTimeDate.getTime() + task.estimatedTime * 60000);
          setEndTime(endTimeDate.toTimeString().slice(0, 5));
          setEndDate(endTimeDate.toLocaleDateString("en-CA"));
          prefilled.add("endTime");
          prefilled.add("endDate");
          prefilled.add("startTime");
        }
      } else {
        setStartDate("");
        setStartTime("");
        setEndDate("");
        setEndTime("");
        setNotes("");
      }

      if (task.category) {
        const categoryColor = categories.find((cat) => cat.id === task.category)?.color;
        setColor(categoryColor || categories[0]?.color || "#3B82F6");
      } else {
        setColor(categories[0]?.color || "#3B82F6");
      }
    } else if (mode === 'convert' && task) {
      setTitle(task.name || "");
      setNotes("");
      setRecurrence('none');
      setRecurrenceDays([]);

      // Pré-remplir date + horaires (éditables) pour que la conversion ait des
      // valeurs par défaut sensées. Sans ça, les sélecteurs d'heure restaient
      // vides et la conversion échouait silencieusement (date/heure manquantes).
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA");
      setStartDate(todayStr);
      setEndDate(todayStr);

      const defaultStart = "12:00";
      setStartTime(defaultStart);
      const startTimeDate = new Date(`${todayStr}T${defaultStart}`);
      const durationMin = task.estimatedTime && task.estimatedTime > 0 ? task.estimatedTime : 60;
      const endTimeDate = new Date(startTimeDate.getTime() + durationMin * 60000);
      setEndTime(endTimeDate.toTimeString().slice(0, 5));
      setEndDate(endTimeDate.toLocaleDateString("en-CA"));

      if (task.category) {
        const categoryColor = categories.find((cat) => cat.id === task.category)?.color;
        setColor(categoryColor || categories[0]?.color || "#3B82F6");
      } else {
        setColor(categories[0]?.color || "#3B82F6");
      }
    }

    setPrefilledFields(prefilled);
  }, [isOpen, mode, task, event, prefilledTimeSlot, categories, favoriteColors]);

  const SHAKE_KEY: Record<string, string> = {
    title: 'title',
    startDate: 'date',
    endDate: 'date',
    startTime: 'startTime',
    endTime: 'endTime',
  };

  const handleFieldChange = <T,>(field: string, setter: (val: T) => void, value: T) => {
    setter(value);
    if (SHAKE_KEY[field]) clear(SHAKE_KEY[field]);
    if (mode === 'add') {
      setPrefilledFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const doSave = () => {
    const missing = getMissingEventFields({ title, startDate, endDate, startTime, endTime });
    if (missing.length) {
      trigger(missing);
      return;
    }

    const start = new Date(`${startDate}T${startTime}`).toISOString();
    const end = new Date(`${endDate}T${endTime}`).toISOString();

    const rangeStatus = validateEventRange(start, end);
    if (rangeStatus === 'invalid-date') {
      trigger(['date']);
      return;
    }
    if (rangeStatus === 'end-before-start') {
      trigger(['endTime']);
      return;
    }

    if (mode === 'add' && onAddEvent && task) {
      onAddEvent({
        title: title.trim(),
        start,
        end,
        color,
        notes: notes.trim(),
        taskId: task.id,
        recurrence,
        recurrenceDays: recurrence === 'custom' ? recurrenceDays : [],
      });
      onClose();
      resetForm();
    } else if (mode === 'edit' && onUpdateEvent && event) {
      onUpdateEvent(event.id, {
        title: title.trim(),
        start,
        end,
        color,
        notes: notes.trim(),
        recurrence,
        recurrenceDays: recurrence === 'custom' ? recurrenceDays : [],
      });
    } else if (mode === 'convert' && onConvert) {
      onConvert({
        title: title.trim(),
        start,
        end,
        color,
        notes: notes.trim(),
        recurrence,
        recurrenceDays: recurrence === 'custom' ? recurrenceDays : [],
      });
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSave();
  };

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setColor(categories[0]?.color || "#3B82F6");
    setRecurrence('none');
    setRecurrenceDays([]);
  };

  // Suppression directe sans popup de confirmation : le parent (AgendaPage)
  // affiche un toast « Annuler » (undo-toast) qui rend l'action réversible.
  const handleDelete = () => {
    if (event && onDeleteEvent) {
      onDeleteEvent(event.id);
    }
  };

  // Dupliquer (#3) : délégué au parent (création de la copie + toast).
  const handleDuplicate = event && onDuplicateEvent
    ? () => onDuplicateEvent(event.id)
    : undefined;

  const calculateDuration = () => formatEventDuration(startDate, startTime, endDate, endTime);
  const getHeaderTitle = () => headerTitle(mode);
  const getSubmitButtonText = () => submitButtonText(mode);

  if (!isOpen) return null;
  if (mode === 'edit' && !event) return null;
  if ((mode === 'add' || mode === 'convert') && !task) return null;

  const isPrefilledMode = mode === 'add';
  const duration = calculateDuration();
  const isMobileFormValid = Boolean(title.trim() && startDate && startTime && endDate && endTime);


  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-md md:p-4 opacity-0 animate-modal-backdrop"
        onClick={onClose}
      >
        <EventModalForm
          mode={mode}
          onClose={onClose}
          title={title}
          setTitle={setTitle}
          startDate={startDate}
          setStartDate={setStartDate}
          startTime={startTime}
          setStartTime={setStartTime}
          endDate={endDate}
          setEndDate={setEndDate}
          endTime={endTime}
          setEndTime={setEndTime}
          notes={notes}
          setNotes={setNotes}
          color={color}
          setColor={setColor}
          recurrence={recurrence}
          setRecurrence={setRecurrence}
          recurrenceDays={recurrenceDays}
          setShowDaysModal={setShowDaysModal}
          showDescription={showDescription}
          setShowDescription={setShowDescription}
          setIsColorSettingsOpen={setIsColorSettingsOpen}
          prefilledFields={prefilledFields}
          categories={categories}
          lockedSet={lockedSet}
          register={register}
          isInvalid={isInvalid}
          handleFieldChange={handleFieldChange}
          doSave={doSave}
          handleSubmit={handleSubmit}
          handleDelete={handleDelete}
          handleDuplicate={handleDuplicate}
          getHeaderTitle={getHeaderTitle}
          getSubmitButtonText={getSubmitButtonText}
          duration={duration}
          isMobileFormValid={isMobileFormValid}
          isPrefilledMode={isPrefilledMode}
        />
      </div>

      <ColorSettingsModal
        isOpen={isColorSettingsOpen}
        onClose={() => setIsColorSettingsOpen(false)}
      />

      {/* Modal de sélection des jours de répétition (récurrence personnalisée) */}
      <RecurrenceDaysModal
        isOpen={showDaysModal}
        onClose={() => setShowDaysModal(false)}
        recurrenceDays={recurrenceDays}
        setRecurrenceDays={setRecurrenceDays}
        setRecurrence={setRecurrence}
      />

    </>
  );
};

export default EventModal;
