// ═══════════════════════════════════════════════════════════════════
// EventModalFormDesktop — corps desktop de EventModal
// ═══════════════════════════════════════════════════════════════════
// Extrait verbatim de EventModalForm (branche desktop), piloté par props.
import React from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { EventRecurrence } from '@/modules/events';
import { DAY_LABELS, formatEventDuration } from './helpers';
import type { EventModalFormBodyProps } from './event-modal-form.types';

const EventModalFormDesktop: React.FC<EventModalFormBodyProps> = ({
  mode, onClose, handleBarWidth,
  title, setTitle, startDate, setStartDate, startTime, setStartTime,
  endDate, setEndDate, endTime, setEndTime, notes, setNotes, color, setColor,
  recurrence, setRecurrence, recurrenceDays, setShowDaysModal,
  showDescription, setShowDescription, setIsColorSettingsOpen,
  prefilledFields, categories, lockedSet, register, isInvalid,
  handleFieldChange, handleSubmit, handleDelete, handleDuplicate,
  getHeaderTitle, getSubmitButtonText, isPrefilledMode,
}) => {
  const calculateDuration = () => formatEventDuration(startDate, startTime, endDate, endTime);

  return (
    <>
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
        style={{ backgroundColor: 'rgb(var(--color-background))' }}
      >
        <div className="flex flex-col md:grid md:grid-cols-12 gap-5">
          <div className="md:col-span-7 space-y-3">
            <div ref={register('title')}>
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
                  isInvalid('title')
                    ? 'border-red-400 dark:border-red-500'
                    : lockedSet.has('title')
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
                    borderColor: isInvalid('title')
                      ? '#ef4444'
                      : isPrefilledMode && prefilledFields.has("title")
                        ? undefined
                        : "rgb(var(--color-border))",
                  }}
                placeholder="nom de l'événement"
              />
            </div>

            <div className="space-y-3">
              {/* Sélecteur de date */}
              <div ref={register('date')}>
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
                          isInvalid('date')
                            ? 'border-red-400 dark:border-red-500'
                            : lockedSet.has('startDate')
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
                          borderColor: isInvalid('date')
                            ? '#ef4444'
                            : isPrefilledMode && prefilledFields.has("startDate")
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
                <div ref={register('startTime')}>
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
                      borderColor: isInvalid('startTime') ? '#ef4444' : "rgb(var(--color-border))",
                      backgroundColor: "rgb(var(--color-surface))",
                    }}
                  />
                  {/* Desktop : wrapper avec icône */}
                  <div
                    className="hidden md:flex time-input-wrapper items-center gap-2 px-3 py-2.5 border rounded-lg"
                    style={{ borderColor: isInvalid('startTime') ? '#ef4444' : "rgb(var(--color-border))", backgroundColor: "rgb(var(--color-surface))" }}
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

                <div ref={register('endTime')}>
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
                      borderColor: isInvalid('endTime') ? '#ef4444' : "rgb(var(--color-border))",
                      backgroundColor: "rgb(var(--color-surface))",
                    }}
                  />
                  {/* Desktop : wrapper avec icône */}
                  <div
                    className="hidden md:flex time-input-wrapper items-center gap-2 px-3 py-2.5 border rounded-lg"
                    style={{ borderColor: isInvalid('endTime') ? '#ef4444' : "rgb(var(--color-border))", backgroundColor: "rgb(var(--color-surface))" }}
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
                      { value: 'custom', label: 'Personnaliser' },
                    ] as { value: EventRecurrence; label: string }[]).map((opt) => {
                      const active = recurrence === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          role="radio"
                          aria-checked={active}
                          onClick={() => { setRecurrence(opt.value); if (opt.value === 'custom') setShowDaysModal(true); }}
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
                {/* Jours personnalisés (récurrence 'custom') */}
                {recurrence === 'custom' && (
                  <div className="flex items-center justify-between gap-3 mt-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--color-text-secondary))" }}>
                      Jours
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDaysModal(true)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {recurrenceDays.length > 0
                        ? [...recurrenceDays].sort().map((d) => DAY_LABELS[d]).join(', ')
                        : 'Choisir les jours'}
                    </button>
                  </div>
                )}
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

          <div className="md:col-span-5 space-y-3 md:flex md:flex-col">
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
                  className="p-2.5 rounded-xl border transition-colors overflow-hidden"
                  style={{
                    borderColor: "rgb(var(--color-border))",
                    backgroundColor: "rgb(var(--color-surface))",
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
              className={`sticky bottom-0 -mx-4 md:-mx-5 px-4 md:px-5 pt-4 pb-3 md:pb-4 mt-4 md:mt-auto border-t flex ${mode === 'edit' ? 'flex-col-reverse sm:flex-row gap-2 sm:gap-3' : ''}`}
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
              {mode === 'edit' && handleDuplicate && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDuplicate}
                  className="min-h-11 sm:flex-1 text-sm font-semibold rounded-lg transition-all"
                >
                  Dupliquer
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
    </>
  );
};

export default EventModalFormDesktop;
