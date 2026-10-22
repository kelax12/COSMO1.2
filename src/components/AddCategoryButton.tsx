import { Plus } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { TAP_AREA_44_Y } from '@/components/mobile/tap-area';

/**
 * Bouton « + Ajouter » à côté d'un label « Catégorie » / « Couleur » dans les
 * modals (TaskModal, OKRModalSheet, EventModal). Pattern unique — audit UI
 * 2026-07-14 §5 : trois rendus différents coexistaient pour la même action.
 *
 * - vrai <button> (focus clavier + aria-label), jamais une icône nue cliquable
 * - hover dark : blue-300 (et non blue-700 qui BAISSE le contraste en dark)
 */
interface AddCategoryButtonProps {
  onClick: () => void;
  /** Libellé accessible. Défaut traduit : « Créer une catégorie ». */
  ariaLabel?: string;
}

const AddCategoryButton = ({ onClick, ariaLabel }: AddCategoryButtonProps) => {
  const { t } = useT('common');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? t('actions.createCategory')}
      // 16 px de haut mesurés (C-70). Ce bouton est monté par TaskModal,
      // OKRModalSheet, EventModal et la modale d'équipe : la cible se corrige
      // ici une fois, pour les quatre. Vertical seulement — il vit au bout
      // d'une ligne de label, un débord horizontal mordrait sur le label.
      className={`flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ${TAP_AREA_44_Y}`}
    >
      <Plus size={12} aria-hidden="true" />
      {t('actions.add')}
    </button>
  );
};

export default AddCategoryButton;
