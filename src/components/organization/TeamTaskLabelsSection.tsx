import { useMemo, useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useTeamLabels, useTeamTaskLabels, useToggleTaskLabel, useCreateTeamLabel,
} from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

interface TeamTaskLabelsSectionProps {
  orgId: string;
  taskId: string;
  /** Seul un manager peut créer un label (policy `team_labels_insert`, mig. 093). */
  isManager: boolean;
}

/**
 * Labels d'une tâche (mig. 093).
 *
 * Le projet était le SEUL axe de classement : « tout ce qui concerne le client
 * X », « tous les bugs », « ce qui est engagé pour le Q3 » traversent les
 * projets et n'avaient aucun moyen d'être exprimés.
 */
const TeamTaskLabelsSection = ({ orgId, taskId, isManager }: TeamTaskLabelsSectionProps) => {
  const { t } = useT('org');
  const [query, setQuery] = useState('');

  const { data: labels = [] } = useTeamLabels(orgId);
  const { data: junctions = [] } = useTeamTaskLabels(orgId);
  const toggleLabel = useToggleTaskLabel(orgId);
  const createLabel = useCreateTeamLabel(orgId);

  const attachedIds = useMemo(
    () => new Set(junctions.filter((j) => j.taskId === taskId).map((j) => j.labelId)),
    [junctions, taskId],
  );
  const attached = labels.filter((l) => attachedIds.has(l.id));

  const trimmed = query.trim();
  const filtered = trimmed
    ? labels.filter((l) => l.name.toLowerCase().includes(trimmed.toLowerCase()))
    : labels;

  // Proposer la création seulement si le nom n'existe pas déjà — la base a un
  // index unique insensible à la casse, proposer un doublon mènerait à une
  // erreur que l'utilisateur ne pourrait pas comprendre.
  const canCreate =
    isManager &&
    trimmed.length > 0 &&
    !labels.some((l) => l.name.trim().toLowerCase() === trimmed.toLowerCase());

  const handleCreate = () => {
    createLabel.mutate(
      { name: trimmed },
      {
        onSuccess: (label) => {
          toggleLabel.mutate({ taskId, labelId: label.id, attached: false });
          setQuery('');
        },
      },
    );
  };

  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[rgb(var(--color-text-secondary))]">
        {t('taskModal.labelsTitle')}
      </span>

      <div className="flex items-center gap-1.5 flex-wrap">
        {attached.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium"
            // Couleur de fond dérivée du hex du label : `color-mix` évite de
            // stocker une seconde couleur « fond » à maintenir en cohérence.
            style={{
              backgroundColor: `color-mix(in srgb, ${label.color} 15%, transparent)`,
              color: label.color,
            }}
          >
            {label.name}
            <button
              type="button"
              onClick={() => toggleLabel.mutate({ taskId, labelId: label.id, attached: true })}
              aria-label={`${t('taskModal.labelsTitle')} : ${label.name}`}
              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X size={10} aria-hidden="true" />
            </button>
          </span>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('taskModal.labelsPick')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:border-[rgb(var(--color-accent))] transition-colors"
          >
            {attached.length === 0 ? (
              <>
                <Tag size={11} aria-hidden="true" /> {t('taskModal.labelsNone')}
              </>
            ) : (
              <Plus size={11} aria-hidden="true" />
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-60">
            <div className="p-1.5">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Le modal parent valide sur Entrée : sans stopPropagation,
                  // créer un label enregistrerait et fermerait la tâche.
                  e.stopPropagation();
                  if (e.key === 'Enter' && canCreate) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                placeholder={t('taskModal.labelsSearch')}
                aria-label={t('taskModal.labelsSearch')}
                maxLength={40}
                className="w-full h-8 px-2 rounded-md border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40"
              />
            </div>

            <div className="max-h-56 overflow-y-auto">
              {filtered.map((label) => {
                const isOn = attachedIds.has(label.id);
                return (
                  <DropdownMenuItem
                    key={label.id}
                    onSelect={(e) => {
                      // Garder le menu ouvert : on pose souvent plusieurs labels.
                      e.preventDefault();
                      toggleLabel.mutate({ taskId, labelId: label.id, attached: isOn });
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{label.name}</span>
                    {isOn && <span className="text-xs text-[rgb(var(--color-text-muted))]">✓</span>}
                  </DropdownMenuItem>
                );
              })}
            </div>

            {canCreate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleCreate(); }}>
                  <Plus size={13} aria-hidden="true" />
                  <span className="truncate">{t('taskModal.labelsCreate', { name: trimmed })}</span>
                </DropdownMenuItem>
              </>
            )}

            {!isManager && trimmed.length > 0 && filtered.length === 0 && (
              <p className="px-2 py-2 text-xs text-[rgb(var(--color-text-muted))]">
                {t('taskModal.labelsManagerOnly')}
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default TeamTaskLabelsSection;
