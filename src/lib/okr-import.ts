import type { CreateOKRInput } from '@/modules/okrs';
import { safeParse } from '@/lib/safe-json';

// « Ouvrir ce modèle dans Cosmo » (plan SEO C5) et générateur d'OKR (C7) : la
// page publique met de côté un brouillon d'OKR, ouvre l'app (démo ou compte),
// et la page OKR le crée par `useCreateOkr` : même chemin que la saisie, donc
// les deux modes. sessionStorage et non localStorage : `loginDemo()` balaie
// les clés `cosmo_*` du localStorage (B21), et le brouillon ne doit pas
// survivre à l'onglet.

export const OKR_IMPORT_KEY = 'cosmo_import_okr';
const MAX_OBJECTIFS = 5;
const MAX_KR = 6;

export interface KrBrouillon { texte: string; unite: string; depart: string; cible: string }
export interface OkrBrouillon { objectif: string; krs: KrBrouillon[] }

const borne = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Premier nombre d'une cellule (« 1,8 % », « 40 »), `null` s'il n'y en a pas ou s'il est relatif (« +20 % »). */
export function nombreAbsolu(brut: string): number | null {
  const s = brut.trim();
  if (/^[+\-−]/.test(s)) return null;
  const m = s.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Lignes d'un tableau de modèle → brouillons. Deux formes rédigées dans
 * `src/content/blog/modele-okr-*.mjs` : [objectif, KR, départ, cible] et
 * [objectif, KR, responsable, « départ → cible »]. Cellule objectif vide =
 * même objectif que la ligne précédente.
 */
export function brouillonsDepuisLignes(lignes: string[][]): OkrBrouillon[] {
  const okrs: OkrBrouillon[] = [];
  for (const cellules of lignes) {
    if (cellules.length < 4) continue;
    const [objectif, texte, a, b] = cellules.map((c) => c.trim());
    if (!texte) continue;
    const [depart, cible] = b.includes('→') ? b.split('→').map((x) => x.trim()) : [a, b];
    if (objectif) okrs.push({ objectif, krs: [] });
    const courant = okrs[okrs.length - 1];
    if (courant && courant.krs.length < MAX_KR) {
      const unite = texte.match(/\(([^)]{1,12})\)\s*$/)?.[1] ?? (/%/.test(cible) ? '%' : '');
      courant.krs.push({ texte, unite, depart, cible });
    }
  }
  return okrs.slice(0, MAX_OBJECTIFS);
}

/** Lit les lignes du premier tableau sous `racine` (DOM de l'article rendu). */
export function lignesDuTableau(racine: ParentNode): string[][] {
  return Array.from(racine.querySelectorAll('table tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent ?? ''),
  );
}

export function mettreDeCote(okrs: OkrBrouillon[]): void {
  if (okrs.length === 0) return;
  try {
    window.sessionStorage.setItem(OKR_IMPORT_KEY, JSON.stringify(okrs.slice(0, MAX_OBJECTIFS)));
  } catch {
    // Stockage refusé : l'app s'ouvre sans le modèle.
  }
}

/** Rend le brouillon en attente (borné, revalidé) et l'efface : un seul import. */
export function reprendre(): OkrBrouillon[] {
  let brut: string | null;
  try {
    brut = window.sessionStorage.getItem(OKR_IMPORT_KEY);
    window.sessionStorage.removeItem(OKR_IMPORT_KEY);
  } catch {
    return [];
  }
  const lu = safeParse<unknown>(brut);
  if (!Array.isArray(lu)) return [];
  return lu
    .slice(0, MAX_OBJECTIFS)
    .map((o) => ({
      objectif: borne(o?.objectif, 140),
      krs: Array.isArray(o?.krs)
        ? o.krs.slice(0, MAX_KR).map((k: Partial<KrBrouillon> | null) => ({
            texte: borne(k?.texte, 120),
            unite: borne(k?.unite, 12),
            depart: borne(k?.depart, 24),
            cible: borne(k?.cible, 24),
          })).filter((k: KrBrouillon) => k.texte)
        : [],
    }))
    .filter((o) => o.objectif);
}

const idKr = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `kr-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Brouillon → entrée de création. Une cible relative ou non chiffrée
 * (« +20 % », « actuel → −20 % ») reste lisible dans le titre du KR, cible 0
 * à préciser par l'utilisateur.
 */
export function versCreateInput(o: OkrBrouillon, now: Date = new Date()): CreateOKRInput {
  const fin = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return {
    title: o.objectif,
    description: '',
    category: '',
    progress: 0,
    completed: false,
    startDate: now.toISOString(),
    endDate: fin.toISOString(),
    keyResults: o.krs.map((k) => {
      const cible = nombreAbsolu(k.cible);
      return {
        id: idKr(),
        title: cible === null && k.cible ? `${k.texte} (${k.cible})`.slice(0, 500) : k.texte,
        currentValue: nombreAbsolu(k.depart) ?? 0,
        targetValue: cible ?? 0,
        unit: k.unite,
        completed: false,
        estimatedTime: 0,
        weight: 1,
      };
    }),
  };
}
