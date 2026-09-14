// ═══════════════════════════════════════════════════════════════════
// EventModalFormMobile — corps iOS bottom-sheet de EventModal
// ═══════════════════════════════════════════════════════════════════
// Extrait verbatim de EventModalForm (branche isMobile), piloté par props.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { EventRecurrence } from '@/modules/events';
import DescriptionField from '@/components/DescriptionField';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DAY_LABEL_KEYS } from './helpers';
import type { EventModalFormBodyProps } from './event-modal-form.types';
import { useT } from '@/i18n/useT';

const EventModalFormMobile: React.FC<EventModalFormBodyProps> = ({
  mode, onClose, handleBarWidth,
  title, setTitle, startDate, setStartDate, startTime, setStartTime,
  setEndDate, endTime, setEndTime, notes, setNotes, color, setColor,
  recurrence, setRecurrence, recurrenceDays, setShowDaysModal,
  showDescription, setShowDescription, setIsColorSettingsOpen,
  categories, lockedSet, register, isInvalid,
  handleFieldChange, doSave, handleDelete, handleDuplicate,
  getHeaderTitle, getSubmitButtonText, duration, isMobileFormValid,
}) => {
  const { t } = useT('eventModal');
  const { t: tCommon } = useT('common');
  // Bulle de sous-catégories — même comportement que EventModalFormDesktop :
  // ouverte pour au plus une racine, sur sélection (pas au survol, absent au
  // toucher). Grille RACINES seules : une sous-catégorie n'apparaît que dans
  // la bulle de sa racine, jamais dans la grille elle-même.
  const [openSubcategoriesFor, setOpenSubcategoriesFor] = useState<string | null>(null);
  const rootCategories = categories.filter((cat) => !cat.parentId);
  const subcategoriesOf = (parentId: string) => categories.filter((cat) => cat.parentId === parentId);
  return (
  <div className="flex flex-col bg-[rgb(var(--color-background))] h-full">
    {/* Drag handle */}
    <div className="flex justify-center pt-2.5 shrink-0">
      <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-[rgb(var(--color-border-strong))]" />
    </div>

    {/* iOS Header */}
    <div className="flex items-center justify-between px-4 h-14 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))]/95 shrink-0">
      <button
        type="button"
        onClick={onClose}
        className="text-blue-500 text-[15px] min-w-16 min-h-11 flex items-center"
      >
        {tCommon('actions.cancel')}
      </button>
      <span className="text-[17px] font-semibold text-[rgb(var(--color-text-primary))] truncate mx-2">
        {getHeaderTitle()}
      </span>
      <button
        type="button"
        onClick={doSave}
        className={`text-[15px] font-semibold min-w-16 min-h-11 flex items-center justify-end shrink-0 ${
          isMobileFormValid ? 'text-blue-500' : 'text-blue-300'
        }`}
      >
        {mode === 'convert' ? t('create') : getSubmitButtonText()}
      </button>
    </div>

    {/* Scroll area */}
    <div data-scroll-area className="flex-1 overflow-y-auto px-4 py-4 min-h-0">

      {/* Groupe 1 — Titre (sans overflow-hidden) */}
      <div
        ref={register('title')}
        className={`bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm transition-[box-shadow] ${
          isInvalid('title') ? 'ring-2 ring-red-500' : ''
        }`}
      >
        {lockedSet.has('title') ? (
          <div className="w-full px-4 min-h-12 flex items-center text-[17px] text-[rgb(var(--color-text-muted))] cursor-not-allowed opacity-80">
            {title || t('titlePlaceholderMobile')}
          </div>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => handleFieldChange("title", setTitle, e.target.value)}
            placeholder={t('titlePlaceholderMobile')}
            autoFocus={!lockedSet.has('title')}
            className="w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
            style={{ border: 'none' }}
          />
        )}
      </div>

      {/* Section HORAIRES */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
        Horaires
      </p>
      <div
        ref={(el) => { register('date')(el); register('startTime')(el); register('endTime')(el); }}
        className={`bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden transition-[box-shadow] ${
          isInvalid('date') || isInvalid('startTime') || isInvalid('endTime') ? 'ring-2 ring-red-500' : ''
        }`}
      >

        {/* Date */}
        <div className={`flex items-center px-4 min-h-11 relative ${lockedSet.has('startDate') ? 'opacity-60' : ''}`}>
          <span className="flex-1 text-[15px] text-[rgb(var(--color-text-primary))]">{t('date')}</span>
          <span className={`text-[15px] ${startDate ? 'text-blue-500' : 'text-[rgb(var(--color-text-muted))]'}`}>
            {startDate
              ? format(new Date(startDate + "T12:00:00"), "d MMM yyyy", { locale: getDateLocale() })
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

        <div className="h-px bg-[rgb(var(--color-border))] ml-4" />

        {/* Début */}
        <div className="flex items-center px-4 min-h-11 gap-3">
          <span className="flex-1 text-[15px] text-[rgb(var(--color-text-primary))]">{t('start')}</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => handleFieldChange("startTime", setStartTime, e.target.value)}
            className="text-[15px] text-blue-500 bg-transparent focus:outline-none text-right"
            style={{ border: 'none', minWidth: 0 }}
          />
        </div>

        <div className="h-px bg-[rgb(var(--color-border))] ml-4" />

        {/* Fin */}
        <div className="flex items-center px-4 min-h-11 gap-3">
          <span className="flex-1 text-[15px] text-[rgb(var(--color-text-primary))]">{t('end')}</span>
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
            <div className="h-px bg-[rgb(var(--color-border))] ml-4" />
            <div className="flex items-center px-4 min-h-11">
              <span className="flex-1 text-[15px] text-[rgb(var(--color-text-primary))]">{t('duration')}</span>
              <span className={`text-[15px] ${duration.kind === 'invalid' ? 'text-red-500' : 'text-blue-500'}`}>
                {duration.kind === 'invalid' ? t('endBeforeStart') : duration.text}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Section OPTIONS */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
        Options
      </p>
      <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
        {/* Récurrence */}
        <div className="flex items-center px-4 min-h-11 gap-3">
          <span className="flex-1 text-[15px] text-[rgb(var(--color-text-primary))]">{t('recurrence')}</span>
          <div
            className="inline-flex rounded-full p-0.5 border text-[11px]"
            style={{
              backgroundColor: "rgb(var(--color-chip-bg))",
              borderColor: "rgb(var(--color-chip-border))",
            }}
            role="radiogroup"
            aria-label={t('recurrenceAria')}
          >
            {([
              { value: 'none', label: t('form.recurrenceShortNone') },
              { value: 'daily', label: t('form.recurrenceShortDaily') },
              { value: 'weekly', label: t('form.recurrenceShortWeekly') },
              { value: 'custom', label: t('form.recurrenceShortCustom') },
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
                    // Jamais de blanc en dur sur --color-accent : en thème Noir cet
                    // accent vaut 240,240,240 (quasi-blanc), donc la puce active
                    // devenait illisible. Le duo prévu est accent-solid-foreground.
                    color: active ? 'rgb(var(--color-accent-solid-foreground))' : 'rgb(var(--color-text-secondary))',
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
            <div className="h-px bg-[rgb(var(--color-border))] ml-4" />
            <button
              type="button"
              onClick={() => setShowDaysModal(true)}
              className="w-full flex items-center px-4 min-h-11 gap-3 active:bg-[rgb(var(--color-hover))]"
            >
              <span className="flex-1 text-left text-[15px] text-[rgb(var(--color-text-primary))]">{t('days')}</span>
              <span className="text-[15px] text-blue-500">
                {recurrenceDays.length > 0
                  ? [...recurrenceDays].sort().map((d) => t(DAY_LABEL_KEYS[d])).join(', ')
                  : t('choose')}
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
            Couleur
          </p>
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {rootCategories.map((cat) => {
                const subs = subcategoriesOf(cat.id);
                const hasSubs = subs.length > 0;
                const isSelected = color === cat.color || subs.some((s) => s.color === color);
                return (
                  <Popover
                    key={cat.id}
                    open={openSubcategoriesFor === cat.id}
                    onOpenChange={(next) => setOpenSubcategoriesFor(next ? cat.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange("color", setColor, cat.color);
                          setOpenSubcategoriesFor(hasSubs ? cat.id : null);
                        }}
                        aria-label={cat.name}
                        aria-pressed={isSelected}
                        className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all active:scale-95 ${
                          isSelected
                            ? 'border-[rgb(var(--color-accent-solid))] bg-blue-50 dark:bg-blue-900/20'
                            : 'border-[rgb(var(--color-border))]'
                        }`}
                      >
                        <span
                          className="relative w-6 h-6 rounded-lg shrink-0"
                          style={{ backgroundColor: cat.color }}
                        >
                          {hasSubs && (
                            <span
                              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2"
                              style={{ backgroundColor: 'rgb(59 130 246)', borderColor: 'rgb(var(--color-surface))' }}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="flex-1 text-left text-[13px] font-medium text-[rgb(var(--color-text-primary))] truncate">
                          {cat.name}
                        </span>
                      </button>
                    </PopoverTrigger>
                    {hasSubs && (
                      <PopoverContent
                        align="start"
                        className="w-auto p-2 z-[100]"
                        aria-label={t('subcategoriesOf', { name: cat.name })}
                      >
                        <p
                          className="text-[10px] font-bold uppercase tracking-widest mb-1.5 px-0.5"
                          style={{ color: "rgb(var(--color-text-muted))" }}
                        >
                          {cat.name}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {/* « Aucune » — reste sur la couleur simple de la racine,
                              sans se raffiner vers une sous-catégorie. Toujours en
                              premier : c'est le choix le moins engageant. */}
                          {(() => {
                            const noneSelected = color === cat.color;
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  handleFieldChange("color", setColor, cat.color);
                                  setOpenSubcategoriesFor(null);
                                }}
                                aria-label={t('subcategoryNoneAria', { name: cat.name })}
                                aria-pressed={noneSelected}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all active:scale-95 ${
                                  noneSelected
                                    ? 'border-[rgb(var(--color-accent-solid))] bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-[rgb(var(--color-border))]'
                                }`}
                              >
                                <span className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center" style={{ backgroundColor: "rgb(var(--color-hover))" }}>
                                  <Ban size={12} style={{ color: "rgb(var(--color-text-muted))" }} aria-hidden="true" />
                                </span>
                                <span className="flex-1 text-left text-[12px] font-medium text-[rgb(var(--color-text-primary))] truncate">
                                  {t('subcategoryNone')}
                                </span>
                              </button>
                            );
                          })()}
                          {subs.map((sub) => {
                            const subSelected = color === sub.color;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => {
                                  handleFieldChange("color", setColor, sub.color);
                                  setOpenSubcategoriesFor(null);
                                }}
                                aria-label={sub.name}
                                aria-pressed={subSelected}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all active:scale-95 ${
                                  subSelected
                                    ? 'border-[rgb(var(--color-accent-solid))] bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-[rgb(var(--color-border))]'
                                }`}
                              >
                                <span className="w-5 h-5 rounded-md shrink-0" style={{ backgroundColor: sub.color }} />
                                <span className="flex-1 text-left text-[12px] font-medium text-[rgb(var(--color-text-primary))] truncate">
                                  {sub.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
              <button
                type="button"
                onClick={() => setIsColorSettingsOpen(true)}
                aria-label={t('form.customizeColors')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-[rgb(var(--color-border-strong))] text-blue-500 text-[13px] font-medium"
              >
                <Plus className="w-4 h-4" />
                Personnaliser
              </button>
            </div>
          </div>
        </>
      )}

      {/* Description */}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
        Commentaire
      </p>
      <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
        {showDescription ? (
          <div className="px-4 py-3">
            <DescriptionField
              value={notes}
              onChange={(value) => handleFieldChange("notes", setNotes, value)}
              rows={4}
              autoFocus={!notes}
              placeholder={t('descriptionTitle')}
              expandedTitle={t('descriptionTitle')}
              className="w-full text-[15px] bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] resize-none"
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
              {t('form.addComment')}
            </span>
          </button>
        )}
      </div>

      {/* Dupliquer (#3) — mode édition uniquement */}
      {mode === 'edit' && handleDuplicate && (
        <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden mt-5">
          <button
            type="button"
            onClick={handleDuplicate}
            className="flex items-center justify-center px-4 min-h-11 w-full active:bg-blue-50 dark:active:bg-blue-950/20"
          >
            <span className="text-[15px] text-blue-600 dark:text-blue-400 font-medium">{t('duplicate')}</span>
          </button>
        </div>
      )}

      {/* Supprimer — mode édition uniquement */}
      {mode === 'edit' && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
            Zone dangereuse
          </p>
          <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center px-4 min-h-11 w-full active:bg-red-50 dark:active:bg-red-950/20"
            >
              <span className="text-[15px] text-red-500 font-medium">{t('delete')}</span>
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
};

export default EventModalFormMobile;
