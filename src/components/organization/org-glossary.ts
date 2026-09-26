// ═══════════════════════════════════════════════════════════════════
// Glossaire du mode entreprise (cohérence globale, 2026-09-25)
//
// « Manager », « responsable d'équipe », « admin », « propriétaire » ;
// « catégorie », « étiquette », « projet », « équipe » : des mots voisins,
// employés au hasard des écrans, pour des notions différentes (un RÔLE, une
// POSITION dans la pyramide, l'animation d'une équipe). Règle : un glossaire
// dans le produit, et une info-bulle au premier affichage de chaque rôle.
//
// Le glossaire s'ouvre du bouton d'en-tête (page) et de chaque info-bulle (`RoleTerm`).
// ═══════════════════════════════════════════════════════════════════

export const ROLE_TERMS = ['owner', 'admin', 'manager', 'teamLead', 'member'] as const;
export const OBJECT_TERMS = ['team', 'project', 'category', 'label'] as const;
export type OrgTerm = (typeof ROLE_TERMS)[number] | (typeof OBJECT_TERMS)[number];

export const termNameKey = (term: OrgTerm) => `glossary.names.${term}` as const;
/** Nom et définition : dans `orgAccount` (catalogue chargé à la demande), pas
 *  dans `org`, payé par toute visite de /entreprise (cliquet du chunk `org`). */
export const termDefKey = (term: OrgTerm) => `glossary.defs.${term}` as const;

const SEEN_KEY = 'cosmo_org_terms_seen_v1';

/**
 * Termes déjà revendiqués pendant ce chargement. Un annuaire de cent membres
 * monte cent badges « Membre » d'un coup : sans cette réservation synchrone,
 * tous liraient « pas encore vu » et cent info-bulles s'ouvriraient.
 */
const claimed = new Set<string>();

/**
 * Une info-bulle de premier affichage à la fois : l'annuaire montre Admin,
 * Manager et Membre d'un coup, et trois bulles ouvertes se recouvraient
 * (mesuré dans le navigateur, 2026-09-25). Les autres termes attendent un
 * prochain affichage ; ils ne sont PAS marqués vus.
 */
let showingFirstSight = false;
export const releaseFirstSight = () => { showingFirstSight = false; };

/**
 * Premier affichage de ce terme sur cet appareil ? Vrai UNE fois : l'appel le
 * marque comme vu. Sans stockage (navigation privée qui le bloque), jamais
 * vrai : une info-bulle qui reviendrait à chaque visite serait pire qu'aucune.
 */
export const claimFirstSight = (term: OrgTerm): boolean => {
  if (claimed.has(term) || showingFirstSight) return false;
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(seen) ? seen.filter((x): x is string => typeof x === 'string') : [];
    if (list.includes(term)) { claimed.add(term); return false; }
    localStorage.setItem(SEEN_KEY, JSON.stringify([...list, term]));
    claimed.add(term);
    showingFirstSight = true;
    return true;
  } catch {
    return false;
  }
};

/** Pour les tests : oublie les réservations de ce chargement. */
export const resetTermClaimsForTests = () => { claimed.clear(); showingFirstSight = false; };
