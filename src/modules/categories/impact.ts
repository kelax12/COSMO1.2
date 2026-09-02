// ═══════════════════════════════════════════════════════════════════
// IMPACT D'UNE SUPPRESSION DE CATÉGORIE — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02, risque R-02).
//
// Aucune clé étrangère ne pointe vers `categories` (vérifié en production :
// zéro contrainte enfant). `delete(id)` retirait donc la ligne, et tout ce qui
// la référençait gardait un identifiant mort, sans avertissement et sans
// réparation possible. Mesuré avant correctif :
//
//     tâches avec catégorie : 611, dont 13 orphelines
//     OKR   avec catégorie :  14, dont  2 orphelines
//
// Ces éléments restent visibles — une pastille grise et un tiret à la place du
// nom — donc rien n'était perdu au sens des données. C'est le CLASSEMENT qui
// disparaissait, définitivement, et sans que personne ne le voie passer.
//
// Ce module répond à une seule question, sans React et sans réseau : « qu'est-ce
// qui casse si je supprime cette catégorie ? ». La réponse est affichée dans la
// confirmation, et sert à proposer une réaffectation.
//
// ⚠️ Les habitudes ne portent PAS de catégorie (elles ont une couleur propre) :
//    les compter donnerait un chiffre faux. Si un jour elles en portent une,
//    c'est ici qu'il faut l'ajouter, et le test le rappellera.

import type { Task } from '@/modules/tasks/types';
import type { OKR } from '@/modules/okrs/types';

export interface CategoryImpact {
  /** Tâches qui portent cette catégorie. */
  tasks: number;
  /** Objectifs qui portent cette catégorie. */
  okrs: number;
  /** Somme, pour décider s'il y a lieu de proposer une réaffectation. */
  total: number;
}

export const EMPTY_IMPACT: CategoryImpact = { tasks: 0, okrs: 0, total: 0 };

/** Ce que la suppression de `categoryId` laisserait orphelin. */
export function categoryImpact(
  categoryId: string | null | undefined,
  tasks: readonly Task[],
  okrs: readonly OKR[],
): CategoryImpact {
  if (!categoryId) return EMPTY_IMPACT;
  const taskCount = tasks.filter((t) => t.category === categoryId).length;
  const okrCount = okrs.filter((o) => o.category === categoryId).length;
  return { tasks: taskCount, okrs: okrCount, total: taskCount + okrCount };
}

/**
 * Identifiants à réaffecter, par entité.
 *
 * Rendu séparément des compteurs parce que l'appel qui répare a besoin des
 * identifiants, pas des totaux, et qu'il ne doit pas re-filtrer la liste une
 * seconde fois avec une condition qui pourrait diverger.
 */
export interface CategoryDependents {
  taskIds: string[];
  okrIds: string[];
}

export function categoryDependents(
  categoryId: string | null | undefined,
  tasks: readonly Task[],
  okrs: readonly OKR[],
): CategoryDependents {
  if (!categoryId) return { taskIds: [], okrIds: [] };
  return {
    taskIds: tasks.filter((t) => t.category === categoryId).map((t) => t.id),
    okrIds: okrs.filter((o) => o.category === categoryId).map((o) => o.id),
  };
}

/**
 * Valeur écrite quand on choisit « aucune catégorie ».
 *
 * Chaîne vide et non `null` : c'est déjà ce que le modèle utilise pour
 * l'absence de catégorie (`Task.category: string`), et introduire un second
 * marqueur d'absence rendrait les deux à vérifier partout.
 */
export const NO_CATEGORY = '';

/**
 * Destination FINALE de chaque catégorie supprimée dans un même lot.
 *
 * 🔴 POURQUOI. La modale des couleurs met les suppressions en attente : on peut
 * donc en retirer deux d'un coup, et choisir la seconde comme destination de la
 * première. Réaffecter naïvement, catégorie par catégorie, déplaçait alors des
 * éléments vers une catégorie supprimée une ligne plus bas — exactement les
 * orphelins que R-02 existe pour empêcher, avec en plus l'illusion d'avoir
 * choisi.
 *
 * On suit donc la chaîne A → B → C jusqu'à une catégorie qui SURVIT, et une
 * chaîne qui boucle (A → B → A, possible en deux décisions successives) retombe
 * sur « aucune catégorie » : c'est le seul état qui ne ment pas.
 *
 * Chaque élément ne portant qu'une catégorie, résoudre les destinations AVANT
 * d'écrire suffit à ce qu'aucun élément ne soit déplacé deux fois — donc à ce
 * qu'un instantané des tâches pris avant la première écriture reste valable
 * pour toutes les suivantes.
 */
export function resolveReassignTargets(
  removedIds: readonly string[],
  chosen: Readonly<Record<string, string>>,
): Record<string, string> {
  const removed = new Set(removedIds);
  const resolved: Record<string, string> = {};

  for (const id of removedIds) {
    const seen = new Set<string>([id]);
    let target = chosen[id] ?? NO_CATEGORY;
    while (target !== NO_CATEGORY && removed.has(target)) {
      if (seen.has(target)) {
        // Cycle : aucune des catégories de la boucle ne survit.
        target = NO_CATEGORY;
        break;
      }
      seen.add(target);
      target = chosen[target] ?? NO_CATEGORY;
    }
    resolved[id] = target;
  }

  return resolved;
}
