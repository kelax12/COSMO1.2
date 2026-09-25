import { useState } from 'react';
import { useUpdateOrgTeam, type OrgTeam } from '@/modules/org-teams';
import { TEAM_COLORS } from './CreateTeamModal';
import { TEAM_DESCRIPTION_MAX } from './team-page.helpers';
import { useT } from '@/i18n/useT';

interface TeamProfileEditorProps {
  orgId: string;
  team: OrgTeam;
  onDone: () => void;
}

/**
 * Fiche d'une équipe en édition : nom, couleur, description (mig. 163).
 * Affichée à la place de l'en-tête de la page, pas dans une modale : on
 * modifie ce qu'on a sous les yeux.
 */
const TeamProfileEditor = ({ orgId, team, onDone }: TeamProfileEditorProps) => {
  const { t } = useT('org');
  const update = useUpdateOrgTeam(orgId);
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [description, setDescription] = useState(team.description ?? '');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    update.mutate(
      { teamId: team.id, input: { name, color, description: description.trim() || null } },
      { onSuccess: onDone },
    );
  };

  const fieldClass =
    'w-full px-3 py-2 text-sm rounded-xl border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]';
  const labelClass = 'block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1';

  return (
    <form onSubmit={save} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 space-y-3">
      <div>
        <label htmlFor="team-name" className={labelClass}>{t('teamPage.nameLabel')}</label>
        <input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          className={fieldClass}
        />
      </div>
      <div>
        <span className={labelClass}>{t('team.color')}</span>
        <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={t('team.colorAria')}>
          {TEAM_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={color === c.value}
              aria-label={t('team.colorNamed', { name: t(c.labelKey) })}
              onClick={() => setColor(c.value)}
              className={`w-7 h-7 rounded-full transition-transform ${
                color === c.value ? 'ring-2 ring-offset-2 ring-offset-[rgb(var(--color-surface))] ring-[rgb(var(--color-text-primary))] scale-110' : ''
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="team-description" className={labelClass}>{t('teamPage.descriptionLabel')}</label>
        <textarea
          id="team-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={TEAM_DESCRIPTION_MAX}
          rows={3}
          placeholder={t('teamPage.descriptionPlaceholder')}
          className={`${fieldClass} resize-y`}
        />
        <p className="mt-1 text-caption text-right text-[rgb(var(--color-text-muted))]">
          {description.length}/{TEAM_DESCRIPTION_MAX}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={update.isPending}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={update.isPending || !name.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-60"
        >
          {update.isPending ? t('teamPage.saving') : t('teamPage.save')}
        </button>
      </div>
    </form>
  );
};

export default TeamProfileEditor;
