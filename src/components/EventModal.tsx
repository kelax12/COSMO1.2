import React, { useState, useEffect } from "react";
import { X, Clock, Plus, CalendarIcon, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { CalendarEvent } from '@/modules/events';

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
}) => {
  const { favoriteColors } = useFavoriteColors();
  const { data: categories = [] } = useCategories();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState(categories[0]?.color || "#3B82F6");
  const [prefilledFields, setPrefilledFields] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);


  useEffect(() => {
    if (!isOpen) return;

    const prefilled = new Set<string>();

    if (mode === 'edit' && event) {
      setTitle(event.title || "");
      setNotes(event.notes || "");
      setColor(event.color || "#3B82F6");

      const start = new Date(event.start);
      const end = new Date(event.end);

      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split("T")[0]);
      setEndTime(end.toTimeString().slice(0, 5));
    } else if (mode === 'add' && task) {
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
      });
    } else if (mode === 'convert' && onConvert) {
      onConvert({
        title: title.trim(),
        start,
        end,
        color,
        notes: notes.trim(),
      });
      onClose();
    }
  };

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setColor(categories[0]?.color || "#3B82F6");
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

  const formatTimeDisplay = (timeValue: string) => {
    if (!timeValue) return "";
    const [hours, minutes] = timeValue.split(":");
    return `${hours}h${minutes}`;
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
<div
        className="md:rounded-2xl shadow-2xl w-full md:max-w-4xl lg:max-w-5xl h-full md:h-auto md:max-h-[90vh] lg:max-h-[85vh] overflow-hidden opacity-0 scale-95 animate-modal-content"
      style={{ backgroundColor: "rgb(var(--color-surface))" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex justify-between items-center px-6 py-4 border-b bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-purple-50 dark:to-purple-900/20 transition-colors"
        style={{ borderColor: "rgb(var(--color-border))" }}
      >
        <h2
          className="text-xl font-bold"
          style={{ color: "rgb(var(--color-text-primary))" }}
        >
          {getHeaderTitle()}
        </h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          type="button"
          style={{ color: "rgb(var(--color-text-muted))" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgb(var(--color-text-primary))";
            e.currentTarget.style.backgroundColor = "rgb(var(--color-hover))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgb(var(--color-text-muted))";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label="Fermer"
        >
          <X size={20} />
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 md:p-5 overflow-y-auto h-[calc(100%-64px)] md:h-auto md:max-h-[calc(90vh-64px)]"
      >
        <div className="flex flex-col md:grid md:grid-cols-12 gap-5">
          <div className="md:col-span-7 space-y-3">
            <div>
              <label
                className="block text-sm font-semibold mb-1 !whitespace-pre-line"
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
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  isPrefilledMode && prefilledFields.has("title")
                    ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    : ""
                }`}
                  style={{
                    backgroundColor:
                      isPrefilledMode && prefilledFields.has("title")
                        ? undefined
                        : "transparent",
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
              className="p-4 rounded-2xl border transition-colors relative bg-transparent space-y-3"
              style={{ borderColor: "rgb(var(--color-border))" }}
            >
              {/* Sélecteur de date */}
              <div>
                <label
                  className="block text-sm font-semibold mb-1.5"
                  style={{ color: "rgb(var(--color-text-secondary))" }}
                >
                  Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                        isPrefilledMode && prefilledFields.has("startDate")
                          ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                          : ""
                      }`}
                      style={{
                        backgroundColor:
                          isPrefilledMode && prefilledFields.has("startDate")
                            ? undefined
                            : "transparent",
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

              {/* Sélecteurs d'heure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-sm font-semibold mb-1.5"
                    style={{ color: "rgb(var(--color-text-secondary))" }}
                  >
                    Début
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg ${
                      isPrefilledMode && prefilledFields.has("startTime")
                        ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                        : ""
                    }`}
                    style={{
                      borderColor:
                        isPrefilledMode && prefilledFields.has("startTime")
                          ? undefined
                          : "rgb(var(--color-border))",
                    }}
                  >
                    <Clock size={14} className="shrink-0" style={{ color: "rgb(var(--color-text-muted))" }} />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleFieldChange("startTime", setStartTime, e.target.value)}
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      style={{ color: "rgb(var(--color-text-primary))" }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold mb-1.5"
                    style={{ color: "rgb(var(--color-text-secondary))" }}
                  >
                    Fin
                  </label>
                  <div
                    className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg ${
                      isPrefilledMode && prefilledFields.has("endTime")
                        ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                        : ""
                    }`}
                    style={{
                      borderColor:
                        isPrefilledMode && prefilledFields.has("endTime")
                          ? undefined
                          : "rgb(var(--color-border))",
                    }}
                  >
                    <Clock size={14} className="shrink-0" style={{ color: "rgb(var(--color-text-muted))" }} />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => handleFieldChange("endTime", setEndTime, e.target.value)}
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                      style={{ color: "rgb(var(--color-text-primary))" }}
                    />
                  </div>
                </div>
              </div>

              {/* Durée calculée */}
              {calculateDuration() && (
                <div
                  className="pt-2.5 border-t border-dashed"
                  style={{ borderColor: "rgb(var(--color-border))" }}
                >
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
            </div>

            <div>
              <label
                className="block text-sm font-semibold mb-1"
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
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors text-sm ${
                  isPrefilledMode && prefilledFields.has("notes")
                    ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    : ""
                }`}
                  style={{
                    backgroundColor:
                      isPrefilledMode && prefilledFields.has("notes")
                        ? undefined
                        : "transparent",
                    color: "rgb(var(--color-text-primary))",
                    borderColor:
                      isPrefilledMode && prefilledFields.has("notes")
                        ? undefined
                        : "rgb(var(--color-border))",
                  }}
                  placeholder="description de l'événement"
              />
            </div>
          </div>

              <div className="md:col-span-5 space-y-3">
            <div>
              <label
                className="flex justify-between items-center text-sm font-semibold mb-2"
                style={{ color: "rgb(var(--color-text-secondary))" }}
              >
                <span>Couleur de l'événement</span>
                <Plus
                  className="w-6 h-6 text-blue-500 cursor-pointer hover:scale-125 transition-transform"
                  onClick={() => setIsColorSettingsOpen(true)}
                />
              </label>

                <div className="grid grid-cols-4 gap-1.5 mb-2 h-[92px] overflow-y-auto pr-1 custom-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        handleFieldChange("color", setColor, cat.color)
                      }
                      className="relative w-full h-10 rounded-lg border-2 transition-all hover:scale-105 group shrink-0"
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
                    <span
                      className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                      style={{ color: "rgb(var(--color-text-muted))" }}
                    >
                      {cat.name}
                    </span>
                  </button>
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

              <div
                className="hidden md:block p-3 rounded-xl border transition-colors bg-transparent"
                style={{ borderColor: "rgb(var(--color-border))" }}
              >
                <h4
                  className="text-xs font-semibold mb-2"
                  style={{ color: "rgb(var(--color-text-primary))" }}
                >
                  Aperçu
                </h4>
                <div
                  className="p-2.5 rounded-lg text-white text-center text-sm font-medium shadow-sm transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: color }}
                >
                    {title || "nom de l'événement"}
                </div>
                {calculateDuration() && (
                  <div
                    className="text-[12px] text-center mt-1.5"
                    style={{ color: "rgb(var(--color-text-muted))" }}
                  >
                    {calculateDuration()}
                  </div>
                )}
              </div>

            <div className={`pt-6 ${mode === 'edit' ? 'flex gap-2' : ''}`}>
              {mode === 'edit' && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  className="h-11 flex-1 text-sm font-semibold border-0 text-white bg-red-400 hover:bg-red-500 active:bg-red-600 transition-all"
                >
                  Supprimer
                </Button>
              )}
              <Button
                type="submit"
                className={`h-11 text-sm font-semibold border-0 text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-500/20 transition-all ${mode === 'edit' ? 'flex-1' : 'w-full'}`}
              >
                {getSubmitButtonText()}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:p-4 opacity-0 animate-modal-backdrop"
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="rounded-xl shadow-2xl w-full max-w-md p-6 transition-colors"
              style={{ backgroundColor: "rgb(var(--color-surface))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className="text-lg font-semibold mb-2"
                style={{ color: "rgb(var(--color-text-primary))" }}
              >
                Confirmer la suppression
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: "rgb(var(--color-text-secondary))" }}
              >
                Êtes-vous sûr de vouloir supprimer cet événement ? Cette action
                est irréversible.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                >
                  Supprimer
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EventModal;

