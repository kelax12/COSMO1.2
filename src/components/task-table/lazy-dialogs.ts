import { lazy } from 'react';

/**
 * C-117 · les fenêtres de `TaskTable` qui ne s'ouvrent qu'à la demande.
 *
 * Importées ici en `lazy`, elles sortent du chunk `TasksPage` : leur code
 * n'est téléchargé qu'à la première ouverture. À monter sous un
 * `React.Suspense`, et avec `useLazyMount` quand la fenêtre anime sa sortie.
 */
export const BulkAddToListModal = lazy(() => import('../add-to-list/BulkAddToListModal'));
export const ScheduleEventModal = lazy(() => import('../ScheduleEventModal'));
