// ═══════════════════════════════════════════════════════════════════
// Glossaire du mode entreprise (cohérence globale, 2026-09-25)
//
// « Manager », « responsable d'équipe », « admin », « propriétaire » ;
// « catégorie », « étiquette », « projet », « équipe » : des mots voisins,
// employés au hasard des écrans, pour des notions différentes (un RÔLE, une
// POSITION dans la pyramide, l'animation d'une équipe). Règle : un glossaire
// dans le produit, et une info-bulle au premier affichage de chaque rôle.
//
// Aucun import lourd : la page lit ce module (bouton « Glossaire »).
// ═══════════════════════════════════════════════════════════════════

export const ROLE_TERMS = ['owner', 'admin', 'manager', 'teamLead', 'member'] as const;
export const OBJECT_TERMS = ['team', 'project', 'category', 'label'] as const;
export type OrgTerm = (typeof ROLE_TERMS)[number] | (typeof OBJECT_TERMS)[number];

export const termNameKey = (term: OrgTerm) => `glossary.terms.${term}.name` as const;
export const termDefKey = (term: OrgTerm) => `glossary.terms.${term}.def` as const;

/** Ouvre le glossaire, d'où qu'on soit dans /entreprise (écouté par `OrganizationPage`). */
export const OPEN_GLOSSARY_EVENT = 'open-org-glossary';
export const openOrgGlossary = (term?: OrgTerm) =>
  window.dispatchEvent(new CustomEvent(OPEN_GLOSSARY_EVENT, { detail: term }));

const SEEN_KEY = 'cosmo_org_terms_seen_v1';

/**
 * Termes déjà revendiqués pendant ce chargement. Un annuaire de cent membres
 * monte cent badges « Membre » d'un coup : sans cette réservation synchrone,
 * tous liraient « pas encore vu » et cent info-bulles s'ouvriraient.
 */
const claimed = new Set<string>();

/**
 * Premier affichage de ce terme sur cet appareil ? Vrai UNE fois : l'appel le
 * marque comme vu. Sans stockage (navigation privée qui le bloque), jamais
 * vrai : une info-bulle qui reviendrait à chaque visite serait pire qu'aucune.
 */
export const claimFirstSight = (term: OrgTerm): boolean => {
  if (claimed.has(term)) return false;
  claimed.add(term);
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(seen) ? seen.filter((x): x is string => typeof x === 'string') : [];
    if (list.includes(term)) return false;
    localStorage.setItem(SEEN_KEY, JSON.stringify([...list, term]));
    return true;
  } catch {
    return false;
  }
};

/** Pour les tests : oublie les réservations de ce chargement. */
export const resetTermClaimsForTests = () => claimed.clear();
