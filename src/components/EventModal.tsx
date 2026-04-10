import React, { useState, useEffect, useRef } from "react";
import { X, Clock, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ColorSettingsModal from "./ColorSettingsModal";
import { DatePicker } from "./ui/date-picker";

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
  const [activeTimeAssistant, setActiveTimeAssistant] = useState<'start' | 'end' | null>(null);

  const startTimeRef = useRef<HTMLDivElement>(null);
  const endTimeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeTimeAssistant === 'start' && startTimeRef.current && !startTimeRef.current.contains(event.target as Node)) {
        setActiveTimeAssistant(null);
      }
      if (activeTimeAssistant === 'end' && endTimeRef.current && !endTimeRef.current.contains(event.target as Node)) {
        setActiveTimeAssistant(null);
      }
    };

    if (activeTimeAssistant) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeTimeAssistant]);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

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

    const start = new Date(`${startDate}T${startTime}`).toISOString();
    const end = new Date(`${endDate}T${endTime}`).toISOString();

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
        return "Enregistrer les modifications";
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

        <button
          onClick={onClose}
          type="button"
          className="p-2 rounded-lg transition-colors"
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
        </button>
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
              className="p-4 rounded-2xl border transition-colors relative bg-transparent"
              style={{
                borderColor: "rgb(var(--color-border))",
              }}
            >
              <div className="grid grid-cols-1 gap-4">
                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: "rgb(var(--color-text-primary))" }}
                      >
                        Début de l'événement
                      </span>
                    </div>
                    {startTime && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          isPrefilledMode && prefilledFields.has("startTime")
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600"
                        }`}
                      >
                        {formatTimeDisplay(startTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <DatePicker
                        value={startDate}
                        onChange={(date) =>
                          handleFieldChange("startDate", setStartDate, date)
                        }
                        placeholder="sélectionner une date"
                        className={`h-11 ${
                          isPrefilledMode && prefilledFields.has("startDate")
                            ? "border-blue-300 dark:border-blue-800"
                            : ""
                        }`}
                      />
                    </div>

                      <div className="relative w-full sm:w-40" ref={startTimeRef}>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) =>
                            handleFieldChange(
                              "startTime",
                              setStartTime,
                              e.target.value
                            )
                          }
                        className={`w-full pl-3 pr-10 py-2.5 h-11 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-blue-400 appearance-none cursor-pointer ${
                          isPrefilledMode && prefilledFields.has("startTime")
                            ? "border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-white/10"
                        }`}
                          style={{
                            backgroundColor:
                              isPrefilledMode && prefilledFields.has("startTime")
                                ? undefined
                                : "transparent",
                            color: "rgb(var(--color-text-primary))",
                            borderColor:
                              isPrefilledMode && prefilledFields.has("startTime")
                                ? undefined
                                : "rgb(var(--color-border))",
                          }}
                        required
                      />
                        <button
                          type="button"
                          onClick={() => setActiveTimeAssistant(activeTimeAssistant === 'start' ? null : 'start')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                          title="Choisir une heure"
                        >
                          <Clock
                            size={16}
                            className="text-blue-500"
                          />
                      </button>

                      <AnimatePresence>
                        {activeTimeAssistant === 'start' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                              className="absolute z-50 right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm"
                            style={{ 
                              backgroundColor: "rgb(var(--color-surface))",
                              borderColor: "rgb(var(--color-border))"
                            }}
                          >
                            <div className="flex h-64 overflow-hidden">
                              {/* Colonne Heures */}
                              <div className="flex-1 overflow-y-auto py-1 border-r" style={{ borderColor: "rgb(var(--color-border))" }}>
                                {hours.map((h) => {
                                  const isSelected = startTime.startsWith(h);
                                  return (
                                    <button
                                      key={h}
                                      type="button"
                                      onClick={() => {
                                        const currentMin = startTime.split(':')[1] || '00';
                                        handleFieldChange("startTime", setStartTime, `${h}:${currentMin}`);
                                      }}
                                      className={`w-full px-2 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                                        isSelected ? 'bg-blue-500/10 text-blue-600 font-bold' : ''
                                      }`}
                                      style={{ color: isSelected ? undefined : "rgb(var(--color-text-primary))" }}
                                    >
                                      {h}h
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Colonne Minutes */}
                              <div className="flex-1 overflow-y-auto py-1">
                                {minutes.map((m) => {
                                  const isSelected = startTime.endsWith(m);
                                  return (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => {
                                        const currentHour = startTime.split(':')[0] || '12';
                                        handleFieldChange("startTime", setStartTime, `${currentHour}:${m}`);
                                        setActiveTimeAssistant(null);
                                      }}
                                      className={`w-full px-2 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                                        isSelected ? 'bg-blue-500/10 text-blue-600 font-bold' : ''
                                      }`}
                                      style={{ color: isSelected ? undefined : "rgb(var(--color-text-primary))" }}
                                    >
                                      {m}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: "rgb(var(--color-text-primary))" }}
                      >
                        Fin de l'événement
                      </span>
                    </div>
                    {endTime && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          isPrefilledMode && prefilledFields.has("endTime")
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600"
                        }`}
                      >
                        {formatTimeDisplay(endTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <DatePicker
                        value={endDate}
                        onChange={(date) =>
                          handleFieldChange("endDate", setEndDate, date)
                        }
                        placeholder="sélectionner une date"
                        className={`h-11 ${
                          isPrefilledMode && prefilledFields.has("endDate")
                            ? "border-blue-300 dark:border-blue-800"
                            : ""
                        }`}
                      />
                    </div>

                      <div className="relative w-full sm:w-40" ref={endTimeRef}>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) =>
                            handleFieldChange(
                              "endTime",
                              setEndTime,
                              e.target.value
                            )
                          }
                        className={`w-full pl-3 pr-10 py-2.5 h-11 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-blue-400 appearance-none cursor-pointer ${
                          isPrefilledMode && prefilledFields.has("endTime")
                            ? "border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-white/10"
                        }`}
                          style={{
                            backgroundColor:
                              isPrefilledMode && prefilledFields.has("endTime")
                                ? undefined
                                : "transparent",
                            color: "rgb(var(--color-text-primary))",
                            borderColor:
                              isPrefilledMode && prefilledFields.has("endTime")
                                ? undefined
                                : "rgb(var(--color-border))",
                          }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setActiveTimeAssistant(activeTimeAssistant === 'end' ? null : 'end')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                        title="Choisir une heure"
                      >
                          <Clock
                            size={16}
                            className="text-blue-500"
                          />
                      </button>

                      <AnimatePresence>
                        {activeTimeAssistant === 'end' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                              className="absolute z-50 right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm"
                            style={{ 
                              backgroundColor: "rgb(var(--color-surface))",
                              borderColor: "rgb(var(--color-border))"
                            }}
                          >
                            <div className="flex h-64 overflow-hidden">
                              {/* Colonne Heures */}
                              <div className="flex-1 overflow-y-auto py-1 border-r" style={{ borderColor: "rgb(var(--color-border))" }}>
                                {hours.map((h) => {
                                  const isSelected = endTime.startsWith(h);
                                  return (
                                    <button
                                      key={h}
                                      type="button"
                                      onClick={() => {
                                        const currentMin = endTime.split(':')[1] || '00';
                                        handleFieldChange("endTime", setEndTime, `${h}:${currentMin}`);
                                      }}
                                      className={`w-full px-2 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                                        isSelected ? 'bg-blue-500/10 text-blue-600 font-bold' : ''
                                      }`}
                                      style={{ color: isSelected ? undefined : "rgb(var(--color-text-primary))" }}
                                    >
                                      {h}h
                                    </button>
                                  );
                                })}
                              </div>
                              {/* Colonne Minutes */}
                              <div className="flex-1 overflow-y-auto py-1">
                                {minutes.map((m) => {
                                  const isSelected = endTime.endsWith(m);
                                  return (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() => {
                                        const currentHour = endTime.split(':')[0] || '12';
                                        handleFieldChange("endTime", setEndTime, `${currentHour}:${m}`);
                                        setActiveTimeAssistant(null);
                                      }}
                                      className={`w-full px-2 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                                        isSelected ? 'bg-blue-500/10 text-blue-600 font-bold' : ''
                                      }`}
                                      style={{ color: isSelected ? undefined : "rgb(var(--color-text-primary))" }}
                                    >
                                      {m}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>

              {calculateDuration() && (
                <div
                  className="mt-3.5 pt-2.5 border-t border-dashed"
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

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 transform transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
              >
                {getSubmitButtonText()}
              </button>
              {mode === 'edit' ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    borderColor: "rgb(var(--color-border))",
                    color: "#DC2626",
                  }}
                >
                  Supprimer l'événement
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    borderColor: "rgb(var(--color-border))",
                    color: "rgb(var(--color-text-secondary))",
                  }}
                >
                  Annuler
                </button>
              )}
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg font-medium border transition-colors"
                  style={{
                    borderColor: "rgb(var(--color-border))",
                    color: "rgb(var(--color-text-primary))",
                  }}
                >
                  Annuler
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Supprimer
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EventModal;

