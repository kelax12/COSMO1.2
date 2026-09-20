import { useEffect } from 'react';

/**
 * Maquette 122 — « N en retard » de l'en-tête mobile mène à la liste qu'il
 * compte.
 *
 * Relevé sur les captures du 2026-09-20 : la barre d'onglets affiche « 2 » et
 * « 1 », l'en-tête entreprise « 3 », la boîte de réception « 5 » sur /tasks et
 * « 8 » sur l'accueil, et le sous-titre de /tasks dit « 1 en retard ». Tous
 * ces compteurs portent DÉJÀ un libellé accessible complet, vérifié un par un
 * le 2026-09-21 (`MobileTabBar`, `TasksInboxMenu` avec son badge
 * `aria-hidden`, `OrgNotificationsBell`). La moitié accessibilité de la
 * maquette était donc faite avant elle.
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
