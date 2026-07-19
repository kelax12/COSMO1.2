// ═══════════════════════════════════════════════════════════════════
// EventModalFormMobile — corps iOS bottom-sheet de EventModal
// ═══════════════════════════════════════════════════════════════════
// Extrait verbatim de EventModalForm (branche isMobile), piloté par props.
import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { EventRecurrence } from '@/modules/events';
import { DAY_LABELS } from './helpers';
import type { EventModalFormBodyProps } from './event-modal-form.types';

const EventModalFormMobile: React.FC<EventModalFormBodyProps> = ({
  mode, onClose, handleBarWidth,
  title, setTitle, startDate, setStartDate, startTime, setStartTime,
  setEndDate, endTime, setEndTime, notes, setNotes, color, setColor,
  recurrence, setRecurrence, recurrenceDays, setShowDaysModal,
  isPrivate, setIsPrivate, showPrivacy,
  showDescription, setShowDescription, setIsColorSettingsOpen,
  categories, lockedSet, register, isInvalid,
  handleFieldChange, doSave, handleDelete, handleDuplicate,
  getHeaderTitle, getSubmitButtonText, duration, isMobileFormValid,
}) => (
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
        {/* Privé (F-1) — membre d'une organisation uniquement */}
        {showPrivacy && (
          <>
            <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-4" />
            <div className="flex items-center px-4 min-h-11 gap-3">
              <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Privé</span>
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                aria-label="Événement privé — invisible pour votre hiérarchie"
                onClick={() => setIsPrivate((v) => !v)}
                className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
                style={{ backgroundColor: isPrivate ? 'rgb(var(--color-accent))' : 'rgb(var(--color-chip-bg))' }}
              >
                <span
                  className="inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
                  style={{ transform: isPrivate ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
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

      {/* Dupliquer (#3) — mode édition uniquement */}
      {mode === 'edit' && handleDuplicate && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden mt-5">
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex items-center justify-center px-4 min-h-11 w-full active:bg-blue-50 dark:active:bg-blue-950/20"
          >
            <span className="text-[15px] text-blue-600 dark:text-blue-400 font-medium">Dupliquer l'événement</span>
          </button>
        </div>
      )}

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
);

export default EventModalFormMobile;
