// ═══════════════════════════════════════════════════════════════════
// DesktopDetailsFields — les champs de l'onglet « Détails » du TaskModal
// desktop, un composant par champ. Sortis de `DesktopDetailsStep`
// (ARCHITECTURE § 3) ; JSX inchangé.
// ═══════════════════════════════════════════════════════════════════
import type React from 'react';
import { AlertCircle, Bookmark, ChevronDown, Plus, Minus } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import DescriptionField from '@/components/DescriptionField';
import { useT } from '@/i18n/useT';
import type { DesktopDetailsStepProps } from './DesktopDetailsStep';

/** Ce que chaque champ lit du formulaire. */
export type DetailsFieldProps = Pick<
  DesktopDetailsStepProps,
  'formData' | 'handleInputChange' | 'errors' | 'okrFields' | 'dRegister' | 'dClear' | 'dInvalid'
>;

const labelClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const labelStyle = { color: 'rgb(var(--color-text-secondary))' };

/** Message d'erreur sous un champ. */
function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <div id={id} className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </div>
  );
}

/** Nom de la tâche (seul champ requis). */
export function TaskNameField({ formData, handleInputChange, errors, okrFields, dRegister, dClear, dInvalid }: DetailsFieldProps) {
  const { t } = useT('taskModal');
  const invalid = !!errors.name || dInvalid('name');
  return (
    <div ref={dRegister('name')} data-guide-id="perso-task-form-name">
      <label htmlFor="task-name" className={labelClass} style={labelStyle}>
        {t('form.nameRequired')}
      </label>
      <input
        id="task-name"
        type="text"
        value={formData.name}
        onChange={(e) => { handleInputChange('name', e.target.value); dClear('name'); }}
        className={`w-full px-[0.875425rem] h-[2.626275rem] border rounded-lg focus:outline-none hover:border-[rgb(var(--color-border-strong))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] transition-all text-[0.875425rem] ${
          invalid ? 'border-[rgb(var(--color-error))]' : 'border-[rgb(var(--color-border))]'
        } ${okrFields.name ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
        style={{
          backgroundColor: okrFields.name ? undefined : 'rgb(var(--color-surface))',
          color: 'rgb(var(--color-text-primary))',
          borderColor: invalid ? '#ef4444' : undefined,
        }}
        placeholder={t('desktop.namePlaceholder')}
        aria-describedby={errors.name ? 'name-error' : undefined}
        aria-invalid={!!errors.name}
      />
      <FieldError id="name-error" message={errors.name} />
    </div>
  );
}

/** Priorité 1 à 5 (0 = pas encore choisie). */
export function PriorityField({ formData, handleInputChange, errors, dRegister, dClear, dInvalid }: DetailsFieldProps) {
  const { t } = useT('taskModal');
  const invalid = dInvalid('priority');
  const optionStyle = { color: 'rgb(var(--color-text-primary))' };
  return (
    <div ref={dRegister('priority')} data-guide-id="perso-task-form-priority">
      <label htmlFor="task-priority" className={labelClass} style={labelStyle}>
        {t('fields.priority')}
      </label>
      <div className="relative">
        <select
          id="task-priority"
          value={formData.priority}
          onChange={(e) => { handleInputChange('priority', Number(e.target.value)); dClear('priority'); }}
          className={`w-full px-[0.875425rem] pr-12 h-[2.626275rem] border rounded-lg focus:outline-none hover:border-[rgb(var(--color-border-strong))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] transition-all text-[0.875425rem] appearance-none cursor-pointer ${
            invalid ? 'border-[rgb(var(--color-error))]' : 'border-[rgb(var(--color-border))]'
          }`}
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            color: formData.priority === 0 ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))',
            borderColor: invalid ? '#ef4444' : undefined,
          }}
          aria-label={t('fields.prioritySelect')}
        >
          <option value="0" disabled hidden>{t('fields.priorityPlaceholder')}</option>
          <option value="1" style={optionStyle}>{t('fields.priority1')}</option>
          <option value="2" style={optionStyle}>{t('fields.priority2')}</option>
          <option value="3" style={optionStyle}>{t('fields.priority3')}</option>
          <option value="4" style={optionStyle}>{t('fields.priority4')}</option>
          <option value="5" style={optionStyle}>{t('fields.priority5')}</option>
        </select>
        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
      </div>
      <FieldError message={errors.priority} />
    </div>
  );
}

/** Échéance, et la récurrence (#26) dès qu'une échéance est posée. */
export function DeadlineField({ formData, handleInputChange, errors, dRegister, dInvalid }: DetailsFieldProps) {
  const { t } = useT('taskModal');
  return (
    <div ref={dRegister('deadline')} data-guide-id="perso-task-form-deadline">
      <label htmlFor="task-deadline" className={labelClass} style={labelStyle}>
        {t('fields.deadline')} <span className="normal-case font-normal opacity-60">{t('common.optional')}</span>
      </label>
      <DatePicker
        value={formData.deadline}
        onChange={(date) => handleInputChange('deadline', date)}
        placeholder={t('fields.deadlinePlaceholder')}
        className={`h-[2.626275rem] w-full ${errors.deadline || dInvalid('deadline') ? 'border-[rgb(var(--color-error))]' : ''}`}
      />
      <FieldError id="deadline-error" message={errors.deadline} />
      {formData.deadline && (
        <div className="mt-2">
          <label htmlFor="task-recurrence" className="sr-only">{t('fields.recurrence')}</label>
          <select
            id="task-recurrence"
            value={formData.recurrence}
            onChange={(e) => handleInputChange('recurrence', e.target.value)}
            className="w-full h-10 px-3 border rounded-lg text-sm focus:outline-none hover:border-[rgb(var(--color-border-strong))] focus:border-[rgb(var(--color-accent))] transition-all"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              color: 'rgb(var(--color-text-primary))',
              borderColor: 'rgb(var(--color-border))',
            }}
          >
            <option value="none">{t('fields.recurrenceNone')}</option>
            <option value="daily">{t('fields.recurrenceDaily')}</option>
            <option value="weekly">{t('fields.recurrenceWeekly')}</option>
            <option value="monthly">{t('fields.recurrenceMonthly')}</option>
          </select>
        </div>
      )}
    </div>
  );
}

/** Durée estimée en minutes, saisie ou ±5. */
export function DurationField({ formData, handleInputChange, errors, okrFields, setFormData, setErrors }: DetailsFieldProps & Pick<DesktopDetailsStepProps, 'setFormData' | 'setErrors'>) {
  const { t } = useT('taskModal');
  const step = (next: (cur: number) => number) => {
    setFormData((prev) => {
      const cur = typeof prev.estimatedTime === 'number' ? prev.estimatedTime : 0;
      return { ...prev, estimatedTime: next(cur) };
    });
    if (errors.estimatedTime) setErrors((prev) => ({ ...prev, estimatedTime: '' }));
  };
  const stepClass = 'w-12 h-12 flex items-center justify-center border rounded-lg hover:border-[rgb(var(--color-border-strong))] transition-colors shrink-0';
  const stepStyle = { borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-surface))' };
  return (
    <div>
      <label htmlFor="task-time" className={labelClass} style={labelStyle}>
        {t('fields.durationMin')} <span className="normal-case font-normal opacity-60">{t('common.optional')}</span>
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id="task-time"
          type="number"
          value={formData.estimatedTime === 0 ? '' : formData.estimatedTime}
          onChange={(e) => handleInputChange('estimatedTime', e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={t('desktop.minuteEstimate')}
          className={`flex-1 min-w-0 px-[0.875425rem] h-[2.626275rem] border rounded-lg focus:outline-none hover:border-[rgb(var(--color-border-strong))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] transition-all text-[0.875425rem] ${
            errors.estimatedTime ? 'border-[rgb(var(--color-error))]' : 'border-[rgb(var(--color-border))]'
          } ${okrFields.estimatedTime ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
          style={{
            backgroundColor: okrFields.estimatedTime ? undefined : 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text-primary))',
            borderColor: errors.estimatedTime ? 'rgb(var(--color-error))' : undefined,
          }}
          aria-describedby={errors.estimatedTime ? 'time-error' : undefined}
          aria-invalid={!!errors.estimatedTime}
        />
        <button type="button" onClick={() => step((cur) => Math.max(0, cur - 5))} className={stepClass} style={stepStyle} aria-label={t('fields.decrease5')}>
          <Minus size={18} />
        </button>
        <button type="button" onClick={() => step((cur) => cur + 5)} className={stepClass} style={stepStyle} aria-label={t('fields.increase5')}>
          <Plus size={18} />
        </button>
      </div>
      <FieldError id="time-error" message={errors.estimatedTime} />
    </div>
  );
}

/**
 * Description — masquée par défaut pour épurer l'UI (même système que
 * EventModal, cf. docs/UI-PATTERNS.md). Visible d'emblée seulement si la
 * tâche a déjà une description.
 */
export function DescriptionSection({ formData, handleInputChange, showDescription, setShowDescription }: Pick<DesktopDetailsStepProps, 'formData' | 'handleInputChange' | 'showDescription' | 'setShowDescription'>) {
  const { t } = useT('taskModal');
  if (!showDescription) {
    return (
      <button
        type="button"
        onClick={() => setShowDescription(true)}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 -mx-1"
      >
        {t('form.addDescription')}
      </button>
    );
  }
  return (
    <div>
      <label htmlFor="task-description" className={labelClass} style={labelStyle}>
        {t('fields.description')} <span className="normal-case font-normal opacity-60">{t('common.optional')}</span>
      </label>
      <DescriptionField
        id="task-description"
        value={formData.description}
        onChange={(value) => handleInputChange('description', value)}
        rows={3}
        autoFocus={!formData.description}
        placeholder={t('fields.descriptionPlaceholder')}
        className="w-full px-[0.875425rem] py-3 border rounded-lg focus:outline-none hover:border-[rgb(var(--color-border-strong))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] transition-all text-[0.875425rem] resize-none border-[rgb(var(--color-border))]"
        style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
      />
    </div>
  );
}

/** Favori — les listes sont dans « Options avancées ». */
export function BookmarkToggle({ bookmarked, onToggle }: { bookmarked: boolean; onToggle: () => void }) {
  const { t } = useT('taskModal');
  const style: React.CSSProperties = bookmarked ? {} : { backgroundColor: 'rgb(var(--color-hover))' };
  return (
    <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label={bookmarked ? t('form.bookmarkRemove') : t('form.bookmarkAdd')}
        className={`p-2.5 rounded-lg border transition-all ${
          bookmarked
            ? 'bg-yellow-500/15 border-yellow-500/40'
            : 'border-[rgb(var(--color-border))] hover:border-yellow-400/50 hover:bg-yellow-500/10'
        }`}
        style={style}
      >
        <Bookmark
          size={20}
          className={bookmarked ? 'text-yellow-500' : 'text-yellow-500/60'}
          fill={bookmarked ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  );
}
