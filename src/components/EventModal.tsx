import React, { useState, useEffect } from "react";
import { X, Clock, Plus, CalendarIcon, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBottomSheet } from "@/hooks/use-bottom-sheet";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ColorSettingsModal from "./ColorSettingsModal";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

type EventData = {
  title: string;
  start: string;
  end: string;
  color: string;
  notes?: string;
  taskId?: string;
  recurrence?: EventRecurrence;
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
  onConvert,
  lockedFields = [],
}) => {
  // Set pour lookup O(1) — utilisé partout dans le rendu pour disabled/readOnly
  const lockedSet = new Set(lockedFields);
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);

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
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);
  const { sheetRef: deleteSheetRef, handleBarWidth: deleteHandleBarWidth, sheetDragProps: deleteSheetDragProps } = useBottomSheet(() => setShowDeleteConfirm(false));


  useEffect(() => {
    if (!isOpen) return;

    const prefilled = new Set<string>();

    if (mode === 'edit' && event) {
      setTitle(event.title || "");
      setNotes(event.notes || "");
      setColor(event.color || "#3B82F6");
      setRecurrence(event.recurrence ?? 'none');

      const start = new Date(event.start);
      const end = new Date(event.end);

      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split("T")[0]);
      setEndTime(end.toTimeString().slice(0, 5));
    } else if (mode === 'add' && task) {
      setRecurrence('none');
      setTitle(task.name || "");
      if (task.name) prefilled.add("title");

      if (prefilledTimeSlot) {
        const start = new Date(prefilledTimeSlot.start);
        const end = new Date(prefilledTimeSlot.end);
        setStartDate(start.toISOString().split("T")[0]);
        setStartTime(start.toTimeString().slice(0, 5));
        setEndDate(end.toISOString().split("T")[0]);
        setEndTime(end.toTimeString().slice(0, 5));
        if (task.description || task.notes) {
          setNotes(task.description || task.notes || "");
          prefilled.add("notes");
        }
        prefilled.add("startDate");
        prefilled.add("startTime");
        prefilled.add("endDate");
        prefilled.add("endTime");
      } else if (task.id !== "") {
        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        setStartDate(todayStr);
        setEndDate(todayStr);

        if (task.description || task.notes) {
          setNotes(task.description || task.notes || "");
          prefilled.add("notes");
        }

        if (task.estimatedTime) {
          const defaultStart = "12:00";
          setStartTime(defaultStart);
          const startTimeDate = new Date(`${todayStr}T${defaultStart}`);
          const endTimeDate = new Date(startTimeDate.getTime() + task.estimatedTime * 60000);
          setEndTime(endTimeDate.toTimeString().slice(0, 5));
          setEndDate(endTimeDate.toISOString().split("T")[0]);
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
      setStartDate("");
      setStartTime("");
      setEndDate("");
      setEndTime("");

      if (task.category) {
        const categoryColor = categories.find((cat) => cat.id === task.category)?.color;
        setColor(categoryColor || categories[0]?.color || "#3B82F6");
      } else {
        setColor(categories[0]?.color || "#3B82F6");
      }
    }

    setPrefilledFields(prefilled);
  }, [isOpen, mode, task, event, prefilledTimeSlot, categories, favoriteColors]);

  const handleFieldChange = <T,>(field: string, setter: (val: T) => void, value: T) => {
    setter(value);
    if (mode === 'add') {
      setPrefilledFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Veuillez saisir un titre pour l'événement");
      return;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      alert("Veuillez sélectionner une date et des horaires");
      return;
    }

    const start = new Date(`${startDate}T${startTime}`).toISOString();
    const end = new Date(`${endDate}T${endTime}`).toISOString();

    if (isNaN(new Date(start).getTime()) || isNaN(new Date(end).getTime())) {
      alert("Les dates saisies sont invalides");
      return;
    }

    if (new Date(end) <= new Date(start)) {
      alert("La date de fin doit être après la date de début");
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
      });
    } else if (mode === 'convert' && onConvert) {
      onConvert({
        title: title.trim(),
        start,
        end,
        color,
        notes: notes.trim(),
        recurrence,
      });
      onClose();
    }
  };

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setColor(categories[0]?.color || "#3B82F6");
    setRecurrence('none');
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (event && onDeleteEvent) {
      onDeleteEvent(event.id);
      setShowDeleteConfirm(false);
    }
  };

  const calculateDuration = () => {
    if (!startDate || !startTime || !endDate || !endTime) return null;
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffMs <= 0) return "⚠️ Fin avant début";
    if (diffHours === 0) return `${diffMinutes} min`;
    if (diffMinutes === 0) return `${diffHours}h`;
    return `${diffHours}h${diffMinutes}min`;
  };

  const getHeaderTitle = () => {
    switch (mode) {
      case 'add':
        return "Ajouter un événement";
      case 'edit':
        return "Modifier l'événement";
      case 'convert':
        return "Convertir en événement";
    }
  };

  const getSubmitButtonText = () => {
    switch (mode) {
      case 'add':
        return "Valider";
      case 'edit':
        return "Enregistrer";
      case 'convert':
        return "Convertir en événement";
    }
  };

  if (!isOpen) return null;
  if (mode === 'edit' && !event) return null;
  if ((mode === 'add' || mode === 'convert') && !task) return null;

  const isPrefilledMode = mode === 'add';

  const renderContent = () => (
<motion.div
        ref={sheetRef}
        {...sheetDragProps}
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
        className="rounded-t-[28px] md:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:shadow-2xl w-full md:max-w-4xl lg:max-w-5xl h-[92vh] md:h-auto md:max-h-[90vh] lg:max-h-[85vh] overflow-hidden flex flex-col"
      style={{ backgroundColor: "rgb(var(--color-surface))", paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle — reacts to swipe on mobile */}
      <div className="md:hidden flex justify-center pt-3 pb-2 shrink-0">
        <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
      </div>
      <div
        className="flex justify-between items-center px-4 md:px-6 py-3 md:py-4 border-b transition-colors gap-2"
        style={{ borderColor: "rgb(var(--color-border))", backgroundColor: "rgb(var(--color-surface))" }}
      >
        <h2
          className="text-base md:text-xl font-bold truncate"
          style={{ color: "rgb(var(--color-text-primary))" }}
        >
          {getHeaderTitle()}
        </h2>

        <button
          onClick={onClose}
          type="button"
          aria-label="Fermer"
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          style={{ color: "rgb(var(--color-text-muted))" }}
        >
          <X size={22} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        data-scroll-area
        className="p-4 md:p-5 overflow-y-auto h-[calc(100%-64px)] md:h-auto md:max-h-[calc(90vh-64px)]"
      >
        <div className="flex flex-col md:grid md:grid-cols-12 gap-5">
          <div className="md:col-span-7 space-y-3">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5 !whitespace-pre-line"
                style={{ color: "rgb(var(--color-text-secondary))" }}
              >
                Titre de l'événement
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) =>
                  handleFieldChange("title", setTitle, e.target.value)
                }
                readOnly={lockedSet.has('title')}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  lockedSet.has('title')
                    ? 'cursor-not-allowed opacity-80 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    : isPrefilledMode && prefilledFields.has("title")
                    ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    : ""
                }`}
                  style={{
                    backgroundColor:
                      isPrefilledMode && prefilledFields.has("title")
                        ? undefined
                        : "rgb(var(--color-surface))",
                    color: "rgb(var(--color-text-primary))",
                    borderColor:
                      isPrefilledMode && prefilledFields.has("title")
                        ? undefined
                        : "rgb(var(--color-border))",
                  }}
                placeholder="nom de l'événement"
                required
              />
            </div>

            <div
              className="p-4 rounded-2xl transition-colors relative bg-transparent space-y-3"
            >
              {/* Sélecteur de date */}
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: "rgb(var(--color-text-secondary))" }}
                >
                  Date
                </label>
                {/* Mobile : input natif système (iOS/Android wheel picker) */}
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    handleFieldChange("startDate", setStartDate, e.target.value);
                    handleFieldChange("endDate", setEndDate, e.target.value);
                  }}
                  disabled={lockedSet.has('startDate')}
                  placeholder="Sélectionner une date"
                  className={`md:hidden w-full px-4 h-11 border rounded-lg text-sm transition-colors ${
                    lockedSet.has('startDate')
                      ? 'cursor-not-allowed opacity-80 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      : isPrefilledMode && prefilledFields.has("startDate")
                      ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                      : ""
                  }`}
                  style={{
                    color: "rgb(var(--color-text-primary))",
                    backgroundColor: "rgb(var(--color-surface))",
                    borderColor: isPrefilledMode && prefilledFields.has("startDate") ? undefined : "rgb(var(--color-border))",
                  }}
                />
                {/* Desktop : calendrier custom */}
                <div className="hidden md:block">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={lockedSet.has('startDate')}
                        className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                          lockedSet.has('startDate')
                            ? 'cursor-not-allowed opacity-80 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            : isPrefilledMode && prefilledFields.has("startDate")
                            ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                            : ""
                        }`}
                        style={{
                          backgroundColor:
                            isPrefilledMode && prefilledFields.has("startDate")
                              ? undefined
                              : "rgb(var(--color-surface))",
                          borderColor:
                            isPrefilledMode && prefilledFields.has("startDate")
                              ? undefined
                              : "rgb(var(--color-border))",
                          color: startDate
                            ? "rgb(var(--color-text-primary))"
                            : "rgb(var(--color-text-muted))",
                        }}
                      >
                        <span>
                          {startDate
                            ? format(new Date(startDate + "T12:00:00"), "dd MMMM yyyy", { locale: fr })
                            : "Choisir une date"}
                        </span>
                        <CalendarIcon size={16} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start" sideOffset={8}>
                      <Calendar
                        mode="single"
                        selected={startDate ? new Date(startDate + "T12:00:00") : undefined}
                        onSelect={(d) => {
                          if (!d) return;
                          const formatted = format(d, "yyyy-MM-dd");
                          handleFieldChange("startDate", setStartDate, formatted);
                          handleFieldChange("endDate", setEndDate, formatted);
                        }}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Sélecteurs d'heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: "rgb(var(--color-text-secondary))" }}
                  >
                    Début
                  </label>
                  {/* Mobile : input natif direct (pas de wrapper pour éviter conflits touch iOS) */}
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleFieldChange("startTime", setStartTime, e.target.value)}
                    className="md:hidden w-full px-3 h-11 border rounded-lg text-sm"
                    style={{
                      color: "rgb(var(--color-text-primary))",
                      borderColor: "rgb(var(--color-border))",
                      backgroundColor: "rgb(var(--color-surface))",
                    }}
                  />
                  {/* Desktop : wrapper avec icône */}
                  <div
                    className="hidden md:flex time-input-wrapper items-center gap-2 px-3 py-2.5 border rounded-lg"
                    style={{ borderColor: "rgb(var(--color-border))", backgroundColor: "rgb(var(--color-surface))" }}
                  >
                    <Clock size={14} className="shrink-0" style={{ color: "rgb(var(--color-text-muted))" }} />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleFieldChange("startTime", setStartTime, e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none focus:outline-none border-0 ring-0 shadow-none"
                      style={{ color: "rgb(var(--color-text-primary))", outline: "none" }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: "rgb(var(--color-text-secondary))" }}
                  >
                    Fin
                  </label>
                  {/* Mobile : input natif direct */}
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleFieldChange("endTime", setEndTime, e.target.value)}
                    className="md:hidden w-full px-3 h-11 border rounded-lg text-sm"
                    style={{
                      color: "rgb(var(--color-text-primary))",
                      borderColor: "rgb(var(--color-border))",
                      backgroundColor: "rgb(var(--color-surface))",
                    }}
                  />
                  {/* Desktop : wrapper avec icône */}
                  <div
                    className="hidden md:flex time-input-wrapper items-center gap-2 px-3 py-2.5 border rounded-lg"
                    style={{ borderColor: "rgb(var(--color-border))", backgroundColor: "rgb(var(--color-surface))" }}
                  >
                    <Clock size={14} className="shrink-0" style={{ color: "rgb(var(--color-text-muted))" }} />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => handleFieldChange("endTime", setEndTime, e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none focus:outline-none border-0 ring-0 shadow-none"
                      style={{ color: "rgb(var(--color-text-primary))", outline: "none" }}
                    />
                  </div>
                </div>
              </div>

              {/* Durée calculée */}
              {calculateDuration() && (
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-medium"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                    >
                      Durée totale
                    </span>
                    <div className="flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      <Clock size={12} />
                      <span>{calculateDuration()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Récurrence — sélecteur 3 états discret */}
              <div className="pt-1">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(var(--color-text-secondary))" }}
                  >
                    Récurrence
                  </span>
                  <div
                    className="inline-flex rounded-full p-0.5 border text-[11px]"
                    style={{
                      backgroundColor: "rgb(var(--color-chip-bg))",
                      borderColor: "rgb(var(--color-chip-border))",
                    }}
                    role="radiogroup"
                    aria-label="Récurrence de l'événement"
                  >
                    {([
                      { value: 'none', label: 'Non' },
                      { value: 'daily', label: 'Tous les jours' },
                      { value: 'weekly', label: 'Toutes les semaines' },
                    ] as { value: EventRecurrence; label: string }[]).map((opt) => {
                      const active = recurrence === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          role="radio"
                          aria-checked={active}
                          onClick={() => setRecurrence(opt.value)}
                          className="px-3 py-1 rounded-full font-medium transition-colors"
                          style={{
                            backgroundColor: active ? 'rgb(var(--color-accent))' : 'transparent',
                            color: active ? '#ffffff' : 'rgb(var(--color-text-secondary))',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Section Description — masquée par défaut pour épurer l'UI.
                Bouton "+ Ajouter un commentaire" pour la révéler. */}
            {showDescription ? (
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: "rgb(var(--color-text-secondary))" }}
                >
                  Description
                </label>
                <textarea
                  value={notes}
                  onChange={(e) =>
                    handleFieldChange("notes", setNotes, e.target.value)
                  }
                  rows={6}
                  autoFocus={!notes}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors text-sm ${
                    isPrefilledMode && prefilledFields.has("notes")
                      ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                      : ""
                  }`}
                    style={{
                      backgroundColor:
                        isPrefilledMode && prefilledFields.has("notes")
                          ? undefined
                          : "rgb(var(--color-surface))",
                      color: "rgb(var(--color-text-primary))",
                      borderColor:
                        isPrefilledMode && prefilledFields.has("notes")
                          ? undefined
                          : "rgb(var(--color-border))",
                    }}
                    placeholder="description de l'événement"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDescription(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 -mx-1"
              >
                + Ajouter un commentaire
              </button>
            )}
          </div>

              <div className="md:col-span-5 space-y-3">
            <div>
              <label
                className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "rgb(var(--color-text-secondary))" }}
              >
                <span>Couleur de l'événement</span>
                <Plus
                  className="w-6 h-6 text-blue-500 cursor-pointer hover:scale-125 transition-transform"
                  onClick={() => setIsColorSettingsOpen(true)}
                />
              </label>

                <div className="grid grid-cols-4 gap-1.5 mb-6 pb-1 pr-1">
                  {categories.map((cat) => (
                    <div key={cat.id} className="relative group" style={{ zIndex: 'auto' }}>
                      <button
                        type="button"
                        onClick={() =>
                          handleFieldChange("color", setColor, cat.color)
                        }
                        className="relative w-full h-10 rounded-lg border-2 transition-all hover:scale-105 shrink-0"
                        style={{
                          backgroundColor: cat.color,
                          borderColor:
                            color === cat.color
                              ? "rgb(var(--color-text-primary))"
                              : "rgb(var(--color-border))",
                          boxShadow:
                            color === cat.color
                              ? "0 4px 10px rgba(0,0,0,0.15)"
                              : "none",
                        }}
                        title={cat.name}
                      >
                        {color === cat.color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div
                              className="w-3.5 h-3.5 rounded-full"
                              style={{
                                backgroundColor: "rgb(var(--color-surface))",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                              }}
                            />
                          </div>
                        )}
                      </button>
                      <span
                        className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                        style={{ color: "rgb(var(--color-text-muted))", zIndex: 9999 }}
                      >
                        {cat.name}
                      </span>
                    </div>
                  ))}
                </div>

                {categories.length > 0 && (
                  <div
                    className="p-2.5 rounded-xl border bg-transparent transition-colors overflow-hidden"
                    style={{
                      borderColor: "rgb(var(--color-border))",
                    }}
                  >
                  <h4
                    className="text-[12px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "rgb(var(--color-text-muted))" }}
                  >
                    Légende des catégories
                  </h4>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                      {categories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-1.5 shrink-0">
                          <div
                            className="w-2 h-2 rounded-full shadow-sm"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span
                            className="text-[13px] font-medium truncate"
                            style={{ color: "rgb(var(--color-text-primary))" }}
                          >
                            {cat.name}
                          </span>
                        </div>
                      ))}
                    </div>
                </div>
              )}
            </div>

            {/* Section "Aperçu" retirée — l'UI est suffisamment claire
                sans : titre + couleur déjà visibles, durée affichée
                ailleurs si besoin. */}

            <div
              className={`sticky bottom-0 -mx-4 md:-mx-5 px-4 md:px-5 pt-4 pb-3 md:pb-4 mt-4 md:mt-6 border-t flex ${mode === 'edit' ? 'flex-col-reverse sm:flex-row gap-2 sm:gap-3' : ''}`}
              style={{
                borderColor: 'rgb(var(--color-border))',
                backgroundColor: 'rgb(var(--color-surface))',
                paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
              }}
            >
              {mode === 'edit' && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  className="min-h-11 sm:flex-1 text-sm font-bold border-0 text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-all"
                >
                  Supprimer
                </Button>
              )}
              <Button
                type="submit"
                className={`min-h-11 text-sm font-semibold border-0 text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-500/20 transition-all ${mode === 'edit' ? 'sm:flex-1' : 'w-full'}`}
              >
                {getSubmitButtonText()}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </motion.div>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-md md:p-4 opacity-0 animate-modal-backdrop"
        onClick={onClose}
      >
        {renderContent()}
      </div>

      <ColorSettingsModal
        isOpen={isColorSettingsOpen}
        onClose={() => setIsColorSettingsOpen(false)}
      />

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-end sm:items-center justify-center z-[60] sm:p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              ref={deleteSheetRef}
              {...deleteSheetDragProps}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              className="rounded-t-[28px] sm:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl w-full sm:max-w-md transition-colors"
              style={{
                backgroundColor: "rgb(var(--color-surface))",
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden flex justify-center pt-4 pb-3">
                <motion.div style={{ width: deleteHandleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              <div className="p-5 sm:p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Supprimer l'événement
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                  Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 min-h-11"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 min-h-11 bg-red-600 hover:bg-red-700 text-white"
                    onClick={confirmDelete}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EventModal;

