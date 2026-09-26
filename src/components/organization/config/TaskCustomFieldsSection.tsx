import { useEffect, useState } from 'react';
import {
  useCustomFields, useSetTaskFieldValue, useTaskFieldValues, fieldValueIsValid,
  type CustomField, type FieldValue,
} from '@/modules/org-config';
import { DatePicker } from '@/components/ui/date-picker';
import { useT } from '@/i18n/useT';
import { FIELD, LABEL } from './config-ui';

interface Props {
  orgId: string;
  taskId: string;
  projectId: string;
  /** Faux pour un lecteur du projet : la base refuserait l'écriture (mig. 197). */
  canEdit: boolean;
}

/** Un champ texte ou nombre s'enregistre à la sortie du champ, pas à chaque frappe. */
const TextLike = ({ field, value, disabled, onSave }: { field: CustomField; value?: FieldValue; disabled: boolean; onSave: (v: FieldValue | null) => void }) => {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  useEffect(() => { setDraft(value === undefined ? '' : String(value)); }, [value]);
  const commit = () => {
    const raw = draft.trim();
    if (raw === (value === undefined ? '' : String(value))) return;
    if (raw === '') return onSave(null);
    const next = field.kind === 'number' ? Number(raw.replace(',', '.')) : raw;
    if (fieldValueIsValid(field, next)) onSave(next);
  };
  return (
    <input
      className={FIELD}
      disabled={disabled}
      inputMode={field.kind === 'number' ? 'decimal' : undefined}
      maxLength={field.kind === 'text' ? 500 : 30}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
};

/**
 * Champs personnalisés d'une tâche (mig. 197), dans l'onglet Détails de la
 * fiche. Seulement pour une tâche EXISTANTE : une valeur se rattache à un id.
 */
const TaskCustomFieldsSection = ({ orgId, taskId, projectId, canEdit }: Props) => {
  const { t } = useT('orgConfig');
  const { data: fields = [] } = useCustomFields(orgId);
  const { data: values = [] } = useTaskFieldValues(taskId);
  const setValue = useSetTaskFieldValue(taskId);
  const applicable = fields.filter((f) => f.projectId === null || f.projectId === projectId);
  if (applicable.length === 0) return null;
  const valueOf = (id: string) => values.find((v) => v.fieldId === id)?.value;
  const save = (fieldId: string, value: FieldValue | null) => setValue.mutate({ fieldId, value });
  const disabled = !canEdit || setValue.isPending;

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-1">{t('fields.inTask')}</legend>
      <div className="grid sm:grid-cols-2 gap-2">
        {applicable.map((f) => {
          const v = valueOf(f.id);
          return (
            <label key={f.id} className={LABEL}>
              {f.name}
              {f.kind === 'checkbox' ? (
                <input type="checkbox" className="w-4 h-4 accent-[rgb(var(--color-accent))]" disabled={disabled}
                  checked={v === true} onChange={(e) => save(f.id, e.target.checked ? true : null)} />
              ) : f.kind === 'select' ? (
                <select className={FIELD} disabled={disabled} value={typeof v === 'string' ? v : ''}
                  onChange={(e) => save(f.id, e.target.value || null)}>
                  <option value="">{t('fields.none')}</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.kind === 'date' ? (
                <DatePicker value={typeof v === 'string' ? v : ''} disabled={disabled} popoverClassName="z-[10001]"
                  onChange={(d) => save(f.id, d || null)} />
              ) : (
                <TextLike field={f} value={v} disabled={disabled} onSave={(nv) => save(f.id, nv)} />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default TaskCustomFieldsSection;
