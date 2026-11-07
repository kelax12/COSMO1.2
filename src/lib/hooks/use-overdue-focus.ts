import { useEffect } from 'react';

/**
 * Maquette 122 — « N en retard » de l'en-tête mobile mène à la liste qu'il
 * compte.
 *
 * Les compteurs de l'application (barre d'onglets, en-tête entreprise, boîte de
 * réception) portent DÉJÀ un libellé accessible complet : la moitié
 * accessibilité de la maquette était faite avant elle.
 *
 * Ce qui manquait : un nombre qui ne mène nulle part oblige à chercher
 * soi-même ce qu'il désigne. `TasksHeader` émet donc `focus-overdue-tasks`,
 * et la table applique son filtre rapide « Retard », qui existait déjà.
 *
 * ⚠️ Un évènement, et pas un état remonté : le filtre vit dans `TaskTable`,
 * deux niveaux sous l'en-tête, et c'est la convention du dépôt pour traverser
 * une hiérarchie pour UN appui (`open-task-create`, `open-quick-add`,
 * `open-invite-join`). Le hook existe à part parce que `TaskTable` est à trois
 * lignes de son plafond de 600 : le budget se respecte en déplaçant, jamais en
 * relevant la borne.
 */
export const OVERDUE_FOCUS_EVENT = 'focus-overdue-tasks';

export function useOverdueFocus(onFocus: () => void): void {
  useEffect(() => {
    const handler = () => onFocus();
    window.addEventListener(OVERDUE_FOCUS_EVENT, handler);
    return () => window.removeEventListener(OVERDUE_FOCUS_EVENT, handler);
  }, [onFocus]);
}
