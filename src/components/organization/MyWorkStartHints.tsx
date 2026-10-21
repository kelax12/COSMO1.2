import { useNavigate } from 'react-router';
import { CircleCheck, ChevronRight, FolderKanban, Target, Users } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';

// Sorti de `MyWorkTab` le 2026-10-20 et chargé à la demande : ces deux blocs
// ne s'affichent qu'à un admin d'une organisation jeune ou à un membre sans
// tâche. Les autres ne les téléchargent plus avec `OrganizationPage`.

/** Étape de la checklist de démarrage (reco #3, admins d'une org jeune). */
export interface StartStep { id: string; label: string; done: boolean; tab: string; }

/**
 * Accueil d'un membre qui vient d'arriver et à qui rien n'est encore assigné.
 *
 * La checklist de démarrage ne s'adresse qu'aux admins — un membre simple
 * atterrissait donc sur un écran vide sans savoir quoi en faire. Trois portes
 * d'entrée suffisent : ce que fait l'équipe, qui est qui, et où vont les
 * objectifs.
 */
const NewcomerHints = () => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  // Maquette 11 B (2026-10-02) : trois cartes à icône plutôt que trois liens,
  // la porte d'entrée se repère avant de se lire.
  const hints: { id: string; label: string; tab: string; Icon: typeof FolderKanban }[] = [
    { id: 'projects', label: tOrgAdmin('myWork.hintProjects'), tab: 'projects', Icon: FolderKanban },
    { id: 'members', label: tOrgAdmin('myWork.hintMembers'), tab: 'members', Icon: Users },
    { id: 'okr', label: tOrgAdmin('myWork.hintOkr'), tab: 'okr', Icon: Target },
  ];
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:py-2">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('myWork.welcomeTitle')}</h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 mb-3">{tOrgAdmin('myWork.welcomeIntro')}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {hints.map(({ id, label, tab, Icon }) => (
          <li key={id} className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(buildOrgLink(tab))}
              className="w-full h-full min-h-touch flex sm:flex-col items-center sm:justify-center gap-2.5 sm:gap-2 p-3 rounded-xl border border-[rgb(var(--color-border))] text-left sm:text-center transition-colors hover:bg-[rgb(var(--color-hover))] hover:border-[rgb(var(--color-accent))]"
            >
              <span className="w-9 h-9 rounded-xl bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))] flex items-center justify-center shrink-0">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="text-sm text-[rgb(var(--color-text-primary))]">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const StartChecklist = ({ steps }: { steps: StartStep[] }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:py-2">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('myWork.getStarted')}</h3>
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{doneCount}/{steps.length}</span>
      </div>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={s.done}
              onClick={() => navigate(buildOrgLink(s.tab))}
              className={`w-full flex items-center gap-2.5 py-2 px-2 rounded-xl text-left transition-colors ${
                s.done ? 'opacity-60' : 'hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              <CircleCheck
                size={17}
                className={s.done ? 'text-emerald-500 shrink-0' : 'text-[rgb(var(--color-text-muted))] shrink-0'}
                aria-hidden="true"
              />
              <span className={`flex-1 text-sm ${s.done ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                {s.label}
              </span>
              {!s.done && <ChevronRight size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const MyWorkStartHints = ({ steps, showChecklist, showNewcomerHints }: {
  steps: StartStep[];
  showChecklist: boolean;
  showNewcomerHints: boolean;
}) => (
  <>
    {showChecklist && <StartChecklist steps={steps} />}
    {showNewcomerHints && <NewcomerHints />}
  </>
);

export default MyWorkStartHints;
