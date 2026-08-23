import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useT } from '@/i18n/useT';

interface OrgTabBadgeProps {
  /** Compteur affiché. Le composant n'est jamais monté à 0 par l'appelant. */
  count: number;
  /** Libellés composant le compteur, déjà tronqués par `computeOrgBadges`. */
  items: string[];
  /** Titre de l'aperçu : dit de quelle nature sont les items. */
  title: string;
  /** Nom accessible du compteur (« 3 nouveautés »). */
  ariaLabel: string;
}

/**
 * Pastille de compteur d'un onglet entreprise, avec aperçu de son contenu.
 *
 * Un chiffre seul répond « quelque chose a changé » mais pas « quoi », et
 * obligeait à ouvrir l'onglet juste pour le découvrir. L'aperçu nomme les
 * premiers items pour qu'on puisse décider sans naviguer.
 *
 * C'est un `Tooltip` et non un `Popover` : la pastille vit DANS le bouton
 * d'onglet, or un déclencheur interactif imbriqué dans un bouton est du HTML
 * invalide et casse la navigation clavier. Le tooltip Radix s'ouvre aussi au
 * focus, donc l'aperçu reste atteignable au clavier ; l'`aria-label` porte le
 * compteur pour les lecteurs d'écran, qui n'ont pas besoin du survol.
 */
const OrgTabBadge = ({ count, items, title, ariaLabel }: OrgTabBadgeProps) => {
  const { tp } = useT('org');
  // Les notifications serveur donnent le compte sans les libellés : dans ce
  // cas on n'affiche aucun aperçu plutôt qu'un « et 3 autres » sans rien avant.
  const hidden = Math.max(0, count - items.length);

  const badge = (
    <span
      className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] text-caption font-bold inline-flex items-center justify-center"
      aria-label={ariaLabel}
    >
      {count}
    </span>
  );

  if (items.length === 0) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px]">
        <p className="font-semibold mb-1">{title}</p>
        <ul className="space-y-0.5">
          {items.map((label) => (
            <li key={label} className="truncate">· {label}</li>
          ))}
        </ul>
        {hidden > 0 && (
          <p className="mt-1 opacity-70">{tp('page.badgePreviewMore', hidden)}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default OrgTabBadge;
