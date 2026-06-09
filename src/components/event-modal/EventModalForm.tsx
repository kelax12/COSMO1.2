// ═══════════════════════════════════════════════════════════════════
// EventModalForm — corps (mobile iOS + desktop) de EventModal
// ═══════════════════════════════════════════════════════════════════
// Extrait verbatim de EventModal.tsx, piloté par props. Possède son propre
// useBottomSheet(onClose) + useIsMobile() (sheetRef/handleBarWidth/sheetDragProps/
// isMobile gardent leurs noms → JSX inchangé).
import React from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import type { EventRecurrence } from '@/modules/events';
import type { EventModalMode } from '../EventModal';
import { DAY_LABELS, formatEventDuration } from './helpers';

interface EventModalFormProps {
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
  getHeaderTitle: () => string;
  getSubmitButtonText: () => string;
  duration: string | null;
  isMobileFormValid: boolean;
  isPrefilledMode: boolean;
}

const EventModalForm: React.FC<EventModalFormProps> = ({
  mode, onClose,
  title, setTitle, startDate, setStartDate, startTime, setStartTime,
  endDate, setEndDate, endTime, setEndTime, notes, setNotes, color, setColor,
  recurrence, setRecurrence, recurrenceDays, setShowDaysModal,
  showDescription, setShowDescription, setIsColorSettingsOpen,
  prefilledFields, categories, lockedSet, register, isInvalid,
  handleFieldChange, doSave, handleSubmit, handleDelete,
  getHeaderTitle, getSubmitButtonText, duration, isMobileFormValid, isPrefilledMode,
}) => {
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const isMobile = useIsMobile();
  const calculateDuration = () => formatEventDuration(startDate, startTime, endDate, endTime);

  return (
    <motion.div
      ref={sheetRef}
      {...sheetDragProps}
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
      className="rounded-t-[28px] md:rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:shadow-2xl w-full md:max-w-4xl lg:max-w-5xl h-[92vh] md:h-auto md:max-h-[90vh] lg:max-h-[85vh] overflow-hidden flex flex-col"
      style={{ backgroundColor: "rgb(var(--color-surface))", paddingBottom: isMobile ? 0 : 'env(safe-area-inset-bottom)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {isMobile ? (
        /* ── MOBILE iOS ── */
        <div className="flex flex-col bg-gray-50 dark:bg-gray-950 h-full">
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 shrink-0">
            <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
          </div>

          {/* iOS Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200/80 dark:border-gray-800 bg-gray-50/95 dark:bg-gray-950/95 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="text-blue-500 text-[15px] min-w-16 min-h-11 flex items-center"
            >
              Annuler
            </button>
            <span className="text-[17px] font-semibold text-gray-900 dark:text-gray-100 truncate mx-2">
              {getHeaderTitle()}
            </span>
            <button
              type="button"
              onClick={doSave}
              className={`text-[15px] font-semibold min-w-16 min-h-11 flex items-center justify-end shrink-0 ${
                isMobileFormValid ? 'text-blue-500' : 'text-blue-300'
              }`}
            >
              {mode === 'convert' ? 'Créer' : getSubmitButtonText()}
            </button>
          </div>

          {/* Scroll area */}
          <div data-scroll-area className="flex-1 overflow-y-auto px-4 py-4 min-h-0">

            {/* Groupe 1 — Titre (sans overflow-hidden) */}
            <div
              ref={register('title')}
              className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm transition-[box-shadow] ${
                isInvalid('title') ? 'ring-2 ring-red-500' : ''
              }`}
            >
              {lockedSet.has('title') ? (
                <div className="w-full px-4 min-h-12 flex items-center text-[17px] text-gray-500 cursor-not-allowed opacity-80">
                  {title || "Titre de l'événement"}
                </div>
              ) : (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleFieldChange("title", setTitle, e.target.value)}
                  placeholder="Titre de l'événement"
                  autoFocus={!lockedSet.has('title')}
                  className="w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                  style={{ border: 'none' }}
                />
              )}
            </div>

            {/* Section HORAIRES */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
              Horaires
            </p>
            <div
              ref={(el) => { register('date')(el); register('startTime')(el); register('endTime')(el); }}
              className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden transition-[box-shadow] ${
                isInvalid('date') || isInvalid('startTime') || isInvalid('endTime') ? 'ring-2 ring-red-500' : ''
              }`}
            >

              {/* Date */}
              <div className={`flex items-center px-4 min-h-11 relative ${lockedSet.has('startDate') ? 'opacity-60' : ''}`}>
                <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Date</span>
                <span className={`text-[15px] ${startDate ? 'text-blue-500' : 'text-gray-400'}`}>
                  {startDate
                    ? format(new Date(startDate + "T12:00:00"), "d MMM yyyy", { locale: fr })
                    : 'Aucune'}
                </span>
                {!lockedSet.has('startDate') && (
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      handleFieldChange("startDate", setStartDate, e.target.value);
                      handleFieldChange("endDate", setEndDate, e.target.value);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    style={{ border: 'none' }}
                  />
                )}
              </div>

              <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />

              {/* Début */}
              <div className="flex items-center px-4 min-h-11 gap-3">
                <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Début</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => handleFieldChange("startTime", setStartTime, e.target.value)}
                  className="text-[15px] text-blue-500 bg-transparent focus:outline-none text-right"
                  style={{ border: 'none', minWidth: 0 }}
                />
              </div>

              <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />

              {/* Fin */}
              <div className="flex items-center px-4 min-h-11 gap-3">
                <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Fin</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleFieldChange("endTime", setEndTime, e.target.value)}
                  className="text-[15px] text-blue-500 bg-transparent focus:outline-none text-right"
                  style={{ border: 'none', minWidth: 0 }}
                />
              </div>

              {/* Durée calculée */}
              {duration && (
                <>
                  <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />
                  <div className="flex items-center px-4 min-h-11">
                    <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Durée</span>
                    <span className={`text-[15px] ${duration.startsWith('⚠️') ? 'text-red-500' : 'text-blue-500'}`}>
                      {duration}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Section OPTIONS */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
              Options
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
              {/* Récurrence */}
              <div className="flex items-center px-4 min-h-11 gap-3">
                <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Récurrence</span>
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
                    { value: 'daily', label: 'Jour' },
                    { value: 'weekly', label: 'Sem.' },
                    { value: 'custom', label: 'Perso' },
                  ] as { value: EventRecurrence; label: string }[]).map((opt) => {
                    const active = recurrence === opt.value;
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        role="radio"
                        aria-checked={active}
                        onClick={() => { setRecurrence(opt.value); if (opt.value === 'custom') setShowDaysModal(true); }}
                        className="px-2.5 py-1 rounded-full font-medium transition-colors text-[11px]"
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
              {/* Jours personnalisés — visible uniquement en récurrence 'custom' */}
              {recurrence === 'custom' && (
                <>
                  <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />
                  <button
                    type="button"
                    onClick={() => setShowDaysModal(true)}
                    className="w-full flex items-center px-4 min-h-11 gap-3 active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <span className="flex-1 text-left text-[15px] text-gray-900 dark:text-gray-100">Jours</span>
                    <span className="text-[15px] text-blue-500">
                      {recurrenceDays.length > 0
                        ? [...recurrenceDays].sort().map((d) => DAY_LABELS[d]).join(', ')
                        : 'Choisir'}
                    </span>
                  </button>
                </>
              )}
            </div>

            {/* Section COULEUR — chip nominée par catégorie pour que
                l'utilisateur identifie quelle couleur correspond à quelle
                catégorie (le swatch seul est ambigu). */}
            {categories.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
                  Couleur
                </p>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden px-4 py-4">
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => {
                      const isSelected = color === cat.color;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleFieldChange("color", setColor, cat.color)}
                          aria-label={cat.name}
                          aria-pressed={isSelected}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all active:scale-95 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <span
                            className="w-6 h-6 rounded-lg shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="flex-1 text-left text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">
                            {cat.name}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setIsColorSettingsOpen(true)}
                      aria-label="Personnaliser les couleurs"
                      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-blue-500 text-[13px] font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Personnaliser
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
              Commentaire
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
              {showDescription ? (
                <div className="px-4 py-3">
                  <textarea
                    value={notes}
                    onChange={(e) => handleFieldChange("notes", setNotes, e.target.value)}
                    rows={4}
                    autoFocus={!notes}
                    placeholder="Description de l'événement"
                    className="w-full text-[15px] bg-transparent focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 resize-none"
                    style={{ border: 'none' }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDescription(true)}
                  className="flex items-center px-4 min-h-11 w-full"
                >
                  <span className="text-[15px] text-blue-600 dark:text-blue-400">
                    + Ajouter un commentaire
                  </span>
                </button>
              )}
            </div>

            {/* Supprimer — mode édition uniquement */}
            {mode === 'edit' && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
                  Zone dangereuse
                </p>
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center justify-center px-4 min-h-11 w-full active:bg-red-50 dark:active:bg-red-950/20"
                  >
                    <span className="text-[15px] text-red-500 font-medium">Supprimer l'événement</span>
                  </button>
                </div>
              </>
            )}

            {/* Espace bas pour libérer la zone safe-area iOS (le bouton de
                validation footer a été retiré — la validation se fait via le
                bouton en haut à droite). */}
            <div style={{ height: 'max(env(safe-area-inset-bottom), 1rem)' }} />
          </div>
        </div>
      ) : (
        /* ── DESKTOP (inchangé) ── */
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
        </>
      )}
    </motion.div>
  );
};

export default EventModalForm;
