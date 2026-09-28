import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCreateCustomField, useCustomFields, useDeleteCustomField, type CustomFieldKind } from '@/modules/org-config';
import { useT } from '@/i18n/useT';
import { FIELD, BUTTON, ICON_BTN, LABEL } from './config-ui';
import MenuSelect from '@/components/organization/MenuSelect';

const KINDS: CustomFieldKind[] = ['text', 'number', 'date', 'select', 'checkbox'];

interface Props {
  orgId: string;
  /** null = champs de toute l'entreprise (admins) ; sinon ceux d'un projet. */
  projectId: string | null;
  canEdit: boolean;
}

/**
 * Liste et création des champs personnalisés (mig. 197), pour l'entreprise
 * (Paramètres) ou pour un projet (page projet). Le type d'un champ ne change
 * jamais : il rendrait les valeurs déjà saisies illisibles (la base le refuse).
 */
const CustomFieldsEditor = ({ orgId, projectId, canEdit }: Props) => {
  const { t } = useT('orgConfig');
  const { data: all = [], isSuccess: loaded } = useCustomFields(orgId);
  const create = useCreateCustomField(orgId);
  const remove = useDeleteCustomField(orgId);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CustomFieldKind>('text');
  const [options, setOptions] = useState('');
  const fields = all.filter((f) => f.projectId === projectId);
  const optionList = options.split('\n').map((o) => o.trim()).filter(Boolean);
  const valid = name.trim().length > 0 && (kind !== 'select' || optionList.length > 0);

  const submit = () => {
    if (!valid) return;
    create.mutate(
      { projectId, name: name.trim(), kind, options: kind === 'select' ? optionList : [] },
      { onSuccess: () => { setName(''); setOptions(''); setKind('text'); } },
    );
  };

  return (
    <div className="space-y-3">
      {!loaded ? null : fields.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('fields.empty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
          {fields.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{f.name}</span>
              <span className="text-caption text-[rgb(var(--color-text-muted))]">
                {t(`fields.kinds.${f.kind}` as 'fields.kinds.text')}
                {f.kind === 'select' ? ` · ${f.options.join(', ')}` : ''}
              </span>
              {canEdit && (
                <button type="button" className={ICON_BTN} aria-label={t('fields.remove', { name: f.name })}
                  disabled={remove.isPending} onClick={() => remove.mutate(f.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form className="grid sm:grid-cols-[1fr_160px_auto] gap-2 items-end" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className={LABEL}>
            {t('fields.name')}
            <input className={FIELD} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className={LABEL}>
            {t('fields.kind')}
            <MenuSelect className={FIELD} value={kind} onChange={(e) => setKind(e.target.value as CustomFieldKind)}>
              {KINDS.map((k) => <option key={k} value={k}>{t(`fields.kinds.${k}` as 'fields.kinds.text')}</option>)}
            </MenuSelect>
          </label>
          <button type="submit" className={BUTTON} disabled={!valid || create.isPending}>{t('fields.add')}</button>
          {kind === 'select' && (
            <label className={`${LABEL} sm:col-span-3`}>
              {t('fields.options')}
              <textarea className={`${FIELD} h-20 py-1.5`} value={options} onChange={(e) => setOptions(e.target.value)} />
            </label>
          )}
        </form>
      )}
    </div>
  );
};

export default CustomFieldsEditor;
