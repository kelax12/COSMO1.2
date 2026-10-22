// Correspondance des colonnes d'un CSV quelconque (Notion, Excel…).
// Pré-remplie par `guessMapping` d'après les noms d'en-tête ; la personne
// corrige ce qui est faux. Seul le titre est obligatoire.
import { COLUMN_ROLES, type ColumnMapping, type ColumnRole } from '@/lib/task-import/generic';
import { useT } from '@/i18n/useT';

interface ImportColumnMappingProps {
  fileName: string;
  rows: string[][];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

const SAMPLE_ROWS = 3;

const ImportColumnMapping = ({ fileName, rows, mapping, onChange }: ImportColumnMappingProps) => {
  const { t } = useT('settings');
  const header = rows[0] ?? [];
  const sample = rows.slice(1, 1 + SAMPLE_ROWS);

  const setRole = (role: ColumnRole, value: string) => {
    const next: ColumnMapping = { ...mapping };
    if (value === '') delete next[role];
    else next[role] = Number(value);
    onChange(next);
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('import.mappingTitle', { name: fileName })}</h3>
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('import.mappingHint')}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {COLUMN_ROLES.map((role) => {
          const id = `map-${fileName}-${role}`;
          return (
            <label key={role} htmlFor={id} className="flex flex-col gap-1 text-xs text-[rgb(var(--color-text-secondary))]">
              {t(`import.role.${role}`)}
              <select
                id={id}
                value={mapping[role] ?? ''}
                onChange={(e) => setRole(role, e.target.value)}
                className="min-h-11 sm:min-h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))]"
              >
                {role !== 'title' && <option value="">{t('import.noColumn')}</option>}
                {header.map((name, i) => <option key={i} value={i}>{name || `#${i + 1}`}</option>)}
              </select>
            </label>
          );
        })}
      </div>
      {sample.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[rgb(var(--color-text-muted))] mb-1">{t('import.sample')}</p>
          <div className="overflow-x-auto rounded-lg border border-[rgb(var(--color-border))]">
            <table className="text-xs w-full">
              <thead>
                <tr>{header.map((h, i) => <th key={i} scope="col" className="px-2 py-1 text-left font-semibold whitespace-nowrap text-[rgb(var(--color-text-secondary))]">{h}</th>)}</tr>
              </thead>
              <tbody>
                {sample.map((row, r) => (
                  <tr key={r} className="border-t border-[rgb(var(--color-border))]">
                    {header.map((_, i) => <td key={i} className="px-2 py-1 whitespace-nowrap max-w-[12rem] truncate text-[rgb(var(--color-text-primary))]">{row[i] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default ImportColumnMapping;
