// Granularité temporelle des vues « tableau de bord » — jour / semaine / mois.
//
// Ce type était déclaré trois fois (DashboardPage, DashboardChart,
// DashboardBarChart) avec des valeurs FRANÇAISES (`'jour' | 'semaine' | 'mois'`)
// qui étaient à la fois l'identifiant interne ET le libellé affiché
// (`mode.charAt(0).toUpperCase() + mode.slice(1)`).
//
// Deux conséquences, réglées ici :
//
//   1. Intraduisible. Un identifiant affiché tel quel ne peut pas passer par
//      `t()` — c'est la donnée elle-même qui portait la langue.
//   2. Couche d'interop absurde : `StatisticsPage` travaille déjà en
//      `'day' | 'week' | 'month'` et devait convertir vers le français
//      (`selectedPeriod === 'day' ? 'jour' : …`) juste pour parler aux
//      graphiques.
//
// Les identifiants sont donc en anglais, comme le reste du code, et les
// libellés visibles vivent dans les catalogues (`dashboard.viewMode.*`).

export type ViewMode = 'day' | 'week' | 'month';

/** Ordre d'affichage du sélecteur de granularité. */
export const VIEW_MODES: readonly ViewMode[] = ['day', 'week', 'month'];
