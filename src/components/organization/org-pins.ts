// ═══════════════════════════════════════════════════════════════════
// Projets épinglés et récents de l'espace entreprise (audit du 2026-09-24)
//
// Au-delà d'une vingtaine de projets, on refaisait le même chemin à chaque
// fois. Le panneau de droite porte donc un groupe « Épinglés » (choisis) et,
// tant qu'on n'a rien épinglé, les « Récents » (ouverts dernièrement).
//
// ⚠️ C'est une PRÉFÉRENCE D'AFFICHAGE, par personne et par appareil : sa place
// est le stockage local, pas la base. Chaque lecture passe par un try/catch
// (navigation privée, stockage bloqué) et l'écran vit très bien sans.
// ═══════════════════════════════════════════════════════════════════
import { useCallback, useMemo, useSyncExternalStore } from 'react';

const MAX_PINS = 8;
const MAX_RECENTS = 4;
const EVENT = 'cosmo-org-pins-change';

export interface OrgPinsState {
  pinned: string[];
  recent: string[];
}

const EMPTY: OrgPinsState = { pinned: [], recent: [] };

const storageKey = (orgId: string, userId: string) => `cosmo_org_pins_${orgId}_${userId}`;

const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Lecture tolérante : une valeur corrompue vaut « rien d'épinglé ». */
export const readPins = (orgId: string, userId: string): OrgPinsState => {
  try {
    const raw = localStorage.getItem(storageKey(orgId, userId));
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY;
    const { pinned, recent } = parsed as Record<string, unknown>;
    return {
      pinned: isIdList(pinned) ? pinned.slice(0, MAX_PINS) : [],
      recent: isIdList(recent) ? recent.slice(0, MAX_RECENTS) : [],
    };
  } catch {
    return EMPTY;
  }
};

const write = (orgId: string, userId: string, next: OrgPinsState) => {
  try {
    localStorage.setItem(storageKey(orgId, userId), JSON.stringify(next));
  } catch { /* stockage indisponible : la préférence ne survit pas, l'écran si */ }
  // Le même onglet ne reçoit pas l'évènement `storage` : on prévient ses
  // propres abonnés (panneau de droite, cartes de l'Aperçu).
  window.dispatchEvent(new Event(EVENT));
};

/**
 * Épingle ou désépingle. Un projet épinglé sort des récents (pas de doublon) ;
 * désépinglé, il y revient en tête : le retirer ne doit pas le faire
 * disparaître du panneau d'un coup.
 */
export const togglePin = (orgId: string, userId: string, projectId: string): void => {
  const cur = readPins(orgId, userId);
  if (cur.pinned.includes(projectId)) {
    write(orgId, userId, {
      pinned: cur.pinned.filter((id) => id !== projectId),
      recent: [projectId, ...cur.recent.filter((id) => id !== projectId)].slice(0, MAX_RECENTS),
    });
    return;
  }
  const pinned = [...cur.pinned, projectId].slice(-MAX_PINS);
  write(orgId, userId, { pinned, recent: cur.recent.filter((id) => !pinned.includes(id)) });
};

/** Note une ouverture de projet. Rien à faire si le projet est déjà épinglé. */
export const recordRecent = (orgId: string, userId: string, projectId: string): void => {
  const cur = readPins(orgId, userId);
  if (cur.pinned.includes(projectId) || cur.recent[0] === projectId) return;
  write(orgId, userId, {
    pinned: cur.pinned,
    recent: [projectId, ...cur.recent.filter((id) => id !== projectId)].slice(0, MAX_RECENTS),
  });
};

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};

/**
 * État courant, stable entre deux écritures : `useSyncExternalStore` exige un
 * instantané identique tant que rien n'a changé, sinon il boucle.
 */
export const useOrgPins = (orgId: string | undefined, userId: string | undefined) => {
  const key = orgId && userId ? storageKey(orgId, userId) : null;
  const getSnapshot = useCallback(() => {
    if (!key) return '';
    try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
  }, [key]);
  // L'instantané est la chaîne brute (comparable par valeur) ; le parse suit.
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const state = useMemo(
    () => (raw && orgId && userId ? readPins(orgId, userId) : EMPTY),
    [raw, orgId, userId],
  );
  const toggle = useCallback(
    (projectId: string) => { if (orgId && userId) togglePin(orgId, userId, projectId); },
    [orgId, userId],
  );
  return { ...state, toggle };
};
