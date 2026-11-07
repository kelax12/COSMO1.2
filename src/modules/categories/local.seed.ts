// ═══════════════════════════════════════════════════════════════════
// CATEGORIES - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { Category } from './types';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

// Deux racines subdivisées : la hiérarchie se VOIT sans avoir à la
// construire depuis la modale de gestion.
// 🔴 Les identifiants `cat-1` à `cat-5` sont CONSERVÉS : les ~100 tâches de
// démonstration (`src/modules/tasks/local.repository.ts`) les référencent.
// En créer de nouveaux orphelinerait tout le jeu de démonstration.
export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Travail',       color: '#3B82F6', parentId: null,    position: 0 },
  { id: 'cat-6', name: 'SEO',           color: '#3B82F6', parentId: 'cat-1', position: 0 },
  { id: 'cat-7', name: 'Backlinks',     color: '#3B82F6', parentId: 'cat-6', position: 0 },
  { id: 'cat-5', name: 'Projets',       color: '#F97316', parentId: 'cat-1', position: 1 },
  { id: 'cat-2', name: 'Personnel',     color: '#10B981', parentId: null,    position: 1 },
  { id: 'cat-3', name: 'Santé',         color: '#EF4444', parentId: 'cat-2', position: 0 },
  { id: 'cat-4', name: 'Apprentissage', color: '#8B5CF6', parentId: 'cat-2', position: 1 },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. Ces labels sont la source
// unique du nom de catégorie : task.category / habit ne stockent qu'un id.
// `cat-6` et `cat-7` y figurent même si le nom ne change pas : sans cette
// entrée, `npm run i18n:identical` ne les regarde pas (les seeds en sont
// exclus), mais la démo anglaise afficherait le français le jour où quelqu'un
// renommerait l'un des deux sans penser à l'overlay.
export const DEMO_CATEGORIES_EN: Record<string, Partial<Category>> = {
  'cat-1': { name: 'Work' },
  'cat-2': { name: 'Personal' },
  'cat-3': { name: 'Health' },
  'cat-4': { name: 'Learning' },
  'cat-5': { name: 'Projects' },
  'cat-6': { name: 'SEO' },
  'cat-7': { name: 'Backlinks' },
};
