// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Repository (interface seule)
// ═══════════════════════════════════════════════════════════════════
//
// ⚠️ CE FICHIER NE PORTE PLUS QUE L'INTERFACE, et c'est délibéré.
// L'implémentation LocalStorage vit dans `./local.repository.ts`, chargée à la
// demande par `src/lib/demo-repositories.ts`. Les remettre ensemble ferait
// repartir les seeds de démonstration dans le chunk d'entrée, payé par chaque
// visiteur. La raison complète est en tête de `local.repository.ts`.
//
// 🔴 N'ajouter ici QUE des méthodes asynchrones : le mandataire différé du
// factory suppose une interface 100 % asynchrone.

import { Category, CreateCategoryInput, UpdateCategoryInput } from './types';
import type { CreateOptions } from '@/lib/restore-id';

export interface ICategoriesRepository {
  // Read operations
  getAll(): Promise<Category[]>;
  // Write operations
  create(input: CreateCategoryInput, options?: CreateOptions): Promise<Category>;
  update(id: string, updates: UpdateCategoryInput): Promise<Category>;
  delete(id: string): Promise<void>;
}
