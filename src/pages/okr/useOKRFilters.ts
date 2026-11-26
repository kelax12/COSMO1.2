import { useState } from 'react';
import { useActiveOrganization } from '@/modules/organizations/ActiveOrgContext';
import { filterObjectivesByCategories, type Objective } from './okr-page-logic';
import type { OKRScope } from './OKRFilterBar';

/**
 * Filtres de la page Objectifs : catégorie, nom, portée. Extrait de `OKRPage`
 * (cliquet de complexité) ; la page ne fait que lire le résultat.
 */
export function useOKRFilters(objectives: Objective[], categories: readonly { id: string }[]) {
  // Filtre hiérarchique (une racine emporte ses sous-catégories) : vide = tous.
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<OKRScope>('all');
  const { organizations } = useActiveOrganization();

  // Une catégorie supprimée depuis la popup de gestion sort du filtre d'elle-même.
  const liveCategoryIds = new Set([...activeCategoryIds].filter((id) => categories.some((c) => c.id === id)));
  const needle = query.trim().toLocaleLowerCase();
  const filteredObjectives = filterObjectivesByCategories(objectives, liveCategoryIds)
    .filter((o) => !needle || o.title.toLocaleLowerCase().includes(needle));

  return {
    query, setQuery, needle,
    liveCategoryIds, setActiveCategoryIds,
    /** Objectifs perso à afficher : vides sous la portée « Entreprise ». */
    visibleObjectives: scope !== 'entreprise' ? filteredObjectives : [],
    /** État vide perso (jamais sous « Entreprise », qui n'en montre aucun). */
    personalEmpty: scope !== 'entreprise' && filteredObjectives.length === 0,
    /** Les deux listes sont là : la section pro titre la liste perso. */
    hasPersonal: scope !== 'entreprise' && filteredObjectives.length > 0,
    /** Aucun filtre posé : l'état vide dit « aucun objectif », pas « aucun résultat ». */
    unfiltered: liveCategoryIds.size === 0 && !needle,
    /** Sans organisation, le sélecteur de portée n'a rien à trier : absent. */
    scope: organizations.length > 0 ? scope : undefined,
    setScope,
    showPro: scope !== 'perso',
  };
}
