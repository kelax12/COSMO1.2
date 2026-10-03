import { FolderKanban, LayoutDashboard, ListTodo, Network, Target, Users } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { ENT_CARD } from './ent-ui';

// Les lieux de l'espace entreprise, montrés par l'attente d'adhésion, la fin
// de la mise en place et l'accueil d'un membre.
//
// ⚠️ Module À PART, sans aucun hook de mutation : `MemberWelcome` l'importe,
// et tirer ici `SetupSteps` lui ferait déclarer `org`, `overlays` et
// `portfolio` (garde `lazy-namespaces`) pour une simple grille de textes.

export const ENT_PLACES = [
  { key: 'overview', Icon: LayoutDashboard },
  { key: 'tasks', Icon: ListTodo },
  { key: 'projects', Icon: FolderKanban },
  { key: 'okr', Icon: Target },
  { key: 'pyramid', Icon: Network },
  { key: 'members', Icon: Users },
] as const;

export type EntPlaceKey = (typeof ENT_PLACES)[number]['key'];

/** Grille des lieux, titre + une phrase chacun. */
export const PlacesGrid = ({
  keys,
  label,
  compact = false,
}: {
  keys: readonly EntPlaceKey[];
  label: string;
  /** Écran de fin : six lieux en tuiles, le bouton doit rester visible. */
  compact?: boolean;
}) => {
  const { t } = useT('onboarding');
  if (compact) {
    return (
      <ul aria-label={label} className={`grid grid-cols-2 gap-2 ${keys.length % 3 === 0 ? 'sm:grid-cols-3' : ''}`}>
        {ENT_PLACES.filter((p) => keys.includes(p.key)).map(({ key, Icon }) => (
          <li key={key} className={`p-3 ${ENT_CARD}`} title={t(`ent.places.${key}Body`)}>
            <span className="flex items-center gap-2 text-sm font-semibold text-[#EDF2F7]">
              <Icon size={15} className="shrink-0 text-[#8B96A8]" aria-hidden="true" />
              {t(`ent.places.${key}Title`)}
            </span>
            <span className="mt-1 block text-xs leading-snug text-[#8B96A8]">{t(`ent.places.${key}Body`)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul aria-label={label} className="grid gap-2.5 sm:grid-cols-2">
      {ENT_PLACES.filter((p) => keys.includes(p.key)).map(({ key, Icon }) => (
        <li key={key} className={`flex gap-3 p-4 ${ENT_CARD}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2D3542] text-[#EDF2F7]">
            <Icon size={17} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-body font-semibold text-[#EDF2F7]">{t(`ent.places.${key}Title`)}</span>
            <span className="mt-0.5 block text-label leading-snug text-[#8B96A8]">{t(`ent.places.${key}Body`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};
