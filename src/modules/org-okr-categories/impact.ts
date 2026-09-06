// ═══════════════════════════════════════════════════════════════════
// IMPACT D'UNE SUPPRESSION DE CATÉGORIE D'ÉQUIPE — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (item C-02, jumeau entreprise du risque R-02).
//
// Le versant personnel a été refermé le 2026-09-02 : `categoryImpact()` annonce
// ce qui va devenir orphelin, et la réaffectation précède la suppression. Le
// versant entreprise, lui, supprimait une `org_okr_categories` sans rien
// compter, avec une confirmation qui DÉCRIVAIT le défaut (« les OKR associés
// conserveront leur catégorie mais ne seront plus filtrables »).
//
// Mesuré en production le 2026-09-04, en lecture seule :
//
//     catégories d'OKR d'équipe :  2
//     OKR d'équipe              :  1, dont 1 porte une catégorie
//     déjà orphelins            :  0
//
// ⚠️ Ce zéro ne dit pas que le défaut est inoffensif, il dit que l'usage
// entreprise est encore minuscule (un seul OKR d'équipe en base). Le versant
// personnel, lui, avait déjà 13 tâches et 2 objectifs orphelins sur 611 et 14.
// La même suppression produit le même trou dès le premier vrai client.
//
// 🔴 LE RATTACHEMENT SE FAIT PAR NOM, PAS PAR IDENTIFIANT. `team_okrs.category`
// est une colonne texte qui porte le NOM de la catégorie (mig. 078, « aucune
// modif de team_okrs ») — contrairement à `team_categories` (mig. 111) qui est
// un vrai FK `ON DELETE SET NULL`, donc déjà sans danger. Compter par
// identifiant rendrait toujours zéro, c'est-à-dire un « aucun impact » faux
// affiché juste avant la suppression.

import type { TeamOKR } from '@/modules/team-okrs';

export interface OrgOKRCategoryImpact {
  /** OKR d'équipe qui portent cette catégorie. */
  okrs: number;
  /**
   * Somme, pour décider s'il y a lieu de proposer une réaffectation.
   *
   * Rien d'autre ne vise `org_okr_categories` aujourd'hui : `team_tasks` et
   * `team_projects` pointent vers `team_categories`, qui est une autre table.
   * Le total existe pour que l'ajout d'un second dépendant ne change pas la
   * forme de la réponse — et le test le rappellera.
   */
  total: number;
}

export const EMPTY_ORG_OKR_IMPACT: OrgOKRCategoryImpact = { okrs: 0, total: 0 };

/** Ce que la suppression de la catégorie nommée `categoryName` laisserait orphelin. */
export function orgOkrCategoryImpact(
  categoryName: string | null | undefined,
  okrs: readonly TeamOKR[],
): OrgOKRCategoryImpact {
  if (!categoryName) return EMPTY_ORG_OKR_IMPACT;
  const count = okrs.filter((o) => o.category === categoryName).length;
  return { okrs: count, total: count };
}

/**
 * Identifiants des OKR à réaffecter.
 *
 * Rendus séparément des compteurs parce que l'appel qui répare a besoin des
 * identifiants, pas des totaux, et qu'il ne doit pas re-filtrer la liste une
 * seconde fois avec une condition qui pourrait diverger.
 */
export function orgOkrCategoryDependents(
  categoryName: string | null | undefined,
  okrs: readonly TeamOKR[],
): string[] {
  if (!categoryName) return [];
  return okrs.filter((o) => o.category === categoryName).map((o) => o.id);
}

/**
 * Valeur écrite quand on choisit « aucune catégorie ».
 *
 * Chaîne vide et non `null` : c'est déjà ce que le modèle utilise pour
 * l'absence de catégorie côté équipe (`TeamOKR.category?: string`), et
 * introduire un second marqueur d'absence rendrait les deux à vérifier partout.
 */
export const NO_ORG_OKR_CATEGORY = '';
