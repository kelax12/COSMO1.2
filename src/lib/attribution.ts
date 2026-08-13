// ═══════════════════════════════════════════════════════════════════
// attribution — source d'acquisition en FIRST-TOUCH.
//
// Capture `?ref=` (ou `utm_source`) au tout premier chargement de l'app, la
// conserve 30 jours, et la transmet à `signUp` en metadata. Le trigger
// `handle_new_user_profile` (mig. 097) la recopie sur `profiles`, ce qui
// permet d'agréger « inscriptions par canal et par jour ».
//
// FIRST-touch et non last-touch : le canal qui a fait DÉCOUVRIR le produit
// mérite le crédit, pas le dernier lien cliqué avant l'inscription (souvent
// un retour direct ou un signet).
//
// Deux invariants tiennent tout le module :
//   - La valeur vient de l'URL, donc d'un inconnu. Elle est normalisée puis
//     validée sur une whitelist stricte AVANT stockage : ce qui ne matche pas
//     n'est jamais stocké, donc jamais transmis à Supabase.
//   - L'analytics ne doit JAMAIS casser un rendu ni une auth. Tout accès à
//     localStorage est sous try/catch (Safari privé, navigation stricte) et
//     tout échec dégrade silencieusement vers « pas d'attribution ».
//
// ⚠️ La clé est dans `PRESERVE_KEYS` (repository.factory.ts) : sans ça, un
// visiteur arrivé via `?ref=tiktok` qui clique sur « Essayer la démo » perd
// son attribution instantanément — le parcours le plus fréquent du plan
// d'acquisition.
// ═══════════════════════════════════════════════════════════════════

export const FIRST_TOUCH_STORAGE_KEY = 'cosmo_first_touch';

/** 30 jours — au-delà, la visite d'origine n'explique plus l'inscription. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Aligné sur le CHECK de longueur côté SQL (mig. 097). */
const MAX_LENGTH = 40;

/** Whitelist stricte : rien d'autre ne peut atteindre la base. */
const VALID_RE = /^[a-z0-9_-]+$/;

export type FirstTouch = {
  source: string;
  campaign?: string;
  /** Epoch ms de la capture. */
  ts: number;
};

/**
 * Normalise une valeur brute d'URL. Renvoie `null` si elle n'est pas
 * exploitable — on préfère perdre une attribution que stocker n'importe quoi.
 */
export function normalizeSourceValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase().slice(0, MAX_LENGTH);
  if (!value) return null;
  return VALID_RE.test(value) ? value : null;
}

function readRaw(): FirstTouch | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(FIRST_TOUCH_STORAGE_KEY);
  } catch {
    return null; // localStorage indisponible — pas d'attribution, pas d'erreur.
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { source, campaign, ts } = parsed as Record<string, unknown>;
    if (typeof source !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) return null;
    // Re-valide à la LECTURE : le contenu de localStorage est modifiable par
    // l'utilisateur ; une valeur posée à la main ne doit pas franchir la
    // frontière vers `signUp`.
    const cleanSource = normalizeSourceValue(source);
    if (!cleanSource) return null;
    const cleanCampaign = typeof campaign === 'string' ? normalizeSourceValue(campaign) : null;
    return { source: cleanSource, ts, ...(cleanCampaign ? { campaign: cleanCampaign } : {}) };
  } catch {
    return null; // JSON corrompu — on repart de zéro.
  }
}

/**
 * Renvoie l'attribution first-touch encore valide, ou `null`.
 * Une entrée expirée est traitée comme absente (et laisse la place à une
 * nouvelle capture).
 */
export function readFirstTouch(): FirstTouch | null {
  const stored = readRaw();
  if (!stored) return null;
  if (Date.now() - stored.ts > TTL_MS) return null;
  return stored;
}

/**
 * Pose une source de repli si — et seulement si — aucune attribution valide
 * n'existe déjà.
 *
 * Sert aux canaux qui ne passent pas par une URL trackée : typiquement une
 * inscription lancée depuis le mode démo (`'demo'`). Une vraie campagne
 * (`?ref=tiktok`) prime TOUJOURS — c'est elle qui a amené le visiteur, la démo
 * n'est qu'une étape de son parcours.
 */
export function recordFallbackSource(source: string): void {
  try {
    if (readFirstTouch()) return;
    const clean = normalizeSourceValue(source);
    if (!clean) return;
    const entry: FirstTouch = { source: clean, ts: Date.now() };
    localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* localStorage indisponible — l'inscription doit aboutir quand même. */
  }
}

/**
 * Lit `?ref=` / `utm_*` dans l'URL courante et stocke la source si — et
 * seulement si — aucune attribution valide n'existe déjà.
 *
 * À appeler une fois, avant le montage de React (`src/main.tsx`).
 */
export function captureFirstTouch(): void {
  try {
    // Une attribution vivante n'est jamais écrasée : c'est ce qui fait le
    // « first » de first-touch.
    if (readFirstTouch()) return;

    const params = new URLSearchParams(window.location.search);
    const source = normalizeSourceValue(params.get('ref') ?? params.get('utm_source'));
    if (!source) return;

    const campaign = normalizeSourceValue(
      params.get('utm_campaign') ?? params.get('utm_medium')
    );

    const entry: FirstTouch = { source, ts: Date.now(), ...(campaign ? { campaign } : {}) };
    localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* localStorage indisponible ou URL illisible — l'app doit démarrer quand même. */
  }
}
