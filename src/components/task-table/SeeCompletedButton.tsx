// ═══════════════════════════════════════════════════════════════════
// « Voir les N terminées », sous la fin de liste (maquette 50, V14.1)
//
// Le N vient du SERVEUR quand la page fournit la requête de l'archive : le jeu
// de travail ne garde que 35 jours de terminées, sa longueur mentirait.
//
// Composant à part, et non un `useTaskCount` dans la page : la réponse du
// compte ne redessine que ce bouton, pas les centaines de lignes au-dessus
// (mesuré : une passe de rendu de trop sur 300 tâches à chaque frappe).
// ═══════════════════════════════════════════════════════════════════
import { useTaskCount, type TaskQuery } from '@/modules/tasks';
import { useT } from '@/i18n/useT';

interface Props {
  /** Requête serveur des terminées masquées ; `null` : aucune ne peut répondre ; absente : `fallbackCount`. */
  query?: TaskQuery | null;
  /** Décompte en mémoire, quand l'appelant ne fournit pas de requête. */
  fallbackCount: number;
  onShow: () => void;
}

export function SeeCompletedButton({ query, fallbackCount, onShow }: Props) {
  const { tp } = useT('tasks');
  const { data: serverCount } = useTaskCount(query ?? { ids: [] }, { enabled: !!query });
  const count = query === undefined ? fallbackCount : query === null ? 0 : serverCount ?? 0;
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onShow}
      className="mt-1 min-h-touch px-3 text-label font-semibold text-[rgb(var(--color-accent))]"
    >
      {tp('table.seeCompleted', count)}
    </button>
  );
}
