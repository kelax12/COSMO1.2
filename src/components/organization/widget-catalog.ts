import type { CatalogDef } from './apercu-widgets';

/** Ce qu'un écran fournit à la grille de widgets : ses widgets, leur nom, leur description. */
export interface WidgetCatalog<Id extends string = string> {
  defs: readonly CatalogDef<Id>[];
  name: (id: Id) => string;
  desc: (id: Id) => string;
  /**
   * Sections de la fenêtre « Ajouter un widget », dans l'ordre. Absent = une
   * section par format. Chaque définition s'y range par son `group`.
   */
  groups?: readonly { id: string; label: string; hint?: string }[];
}
