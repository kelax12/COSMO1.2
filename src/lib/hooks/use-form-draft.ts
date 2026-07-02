// Brouillons de formulaires (#47) — ne jamais perdre la saisie.
//
// Persiste l'état d'un formulaire dans localStorage pendant la frappe ;
// à la réouverture du modal, le brouillon est restauré. `clear()` au submit
// ou à l'abandon volontaire. JSON.parse protégé (règle B14 — safeParse).

import { useCallback } from 'react';

const DRAFT_PREFIX = 'cosmo_draft_';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useFormDraft<T>(key: string) {
  const storageKey = DRAFT_PREFIX + key;

  const readDraft = useCallback((): T | null => {
    try {
      return safeParse<T>(localStorage.getItem(storageKey));
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveDraft = useCallback((data: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch { /* ignore (quota, mode privé) */ }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [storageKey]);

  return { readDraft, saveDraft, clearDraft };
}
