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
//
// 🔴 SOUS CONSENTEMENT depuis le 2026-10-13 (loi I&L art. 82). La source finit
// écrite sur le PROFIL : ce n'est pas une statistique anonyme, l'exemption
// CNIL de mesure d'audience ne la couvre pas. Rien n'est écrit sur l'appareil
// ni lu avant « Accepter » : la source de l'URL est gardée EN MÉMOIRE
// (`pending`) et posée seulement si le visiteur accepte pendant la visite
// (`persistPendingFirstTouch`). Refuser efface tout (`clearAttributionTraces`).
// ═══════════════════════════════════════════════════════════════════

import { hasConsented } from './cookie-consent';

export const FIRST_TOUCH_STORAGE_KEY = 'cosmo_first_touch';

/** Source lue dans l'URL avant toute réponse au bandeau. Jamais écrite sur l'appareil. */
let pending: FirstTouch | null = null;

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
  // Une valeur posée AVANT le 2026-10-13, sans consentement, ne doit pas
  // atteindre le profil : sans « Accepter », il n'y a pas d'attribution.
  if (!hasConsented()) return null;
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
    if (!hasConsented()) return;
    // `direct` dit seulement « aucun référent » : une source de repli plus
    // précise (la démo) le remplace. Toute autre attribution prime.
    const current = readFirstTouch();
    if (current && current.source !== 'direct') return;
    const clean = normalizeSourceValue(source);
    if (!clean) return;
    const entry: FirstTouch = { source: clean, ts: Date.now() };
    localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* localStorage indisponible — l'inscription doit aboutir quand même. */
  }
}

/** Familles de sites référents, reconnues à leur nom d'hôte. */
const REFERRER_SOURCES: ReadonlyArray<[RegExp, string]> = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)qwant\.com$/, 'qwant'],
  [/(^|\.)ecosia\.org$/, 'ecosia'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'chatgpt'],
  [/(^|\.)perplexity\.ai$/, 'perplexity'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)producthunt\.com$/, 'producthunt'],
];

/**
 * Hôtes qui ne sont PAS une arrivée : le retour d'une connexion Google ou de
 * Supabase Auth. Les compter étiquetterait « google » un compte qui revient
 * simplement de son écran de connexion.
 */
const NOT_A_SOURCE_RE = /(^|\.)(accounts\.google\.com|supabase\.co|stripe\.com)$/;

/**
 * Source déduite du site référent quand l'URL ne porte ni `?ref=` ni `utm_*` :
 *   • famille connue (Google, Instagram…) → son nom ;
 *   • autre site → son hôte, points remplacés par des tirets ;
 *   • aucun référent externe → `direct`.
 * `null` pour un retour d'authentification : on ne décide rien.
 * Seul l'HÔTE est lu : jamais le chemin ni la query string du référent.
 */
export function sourceFromReferrer(referrer: string, ownHost: string): string | null {
  if (!referrer) return 'direct';
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return 'direct';
  }
  if (!host || host === ownHost.toLowerCase()) return 'direct';
  if (NOT_A_SOURCE_RE.test(host)) return null;
  for (const [re, name] of REFERRER_SOURCES) {
    if (re.test(host)) return name;
  }
  return normalizeSourceValue(host.replace(/^www\./, '').replace(/\./g, '-'));
}

/**
 * Lit `?ref=` / `utm_*` dans l'URL courante, à défaut le site référent, et
 * stocke la source si — et seulement si — aucune attribution valide n'existe
 * déjà.
 *
 * 2026-10-18 : AVANT, sans `?ref=` ni `utm_*`, rien n'était retenu. Une arrivée
 * depuis une recherche Google ou un lien Instagram non balisé finissait donc
 * « Non attribuée » : 11 inscriptions sur 11 en 60 jours.
 *
 * À appeler une fois, avant le montage de React (`src/main.tsx`).
 */
export function captureFirstTouch(): void {
  try {
    // Une attribution vivante n'est jamais écrasée : c'est ce qui fait le
    // « first » de first-touch.
    if (readFirstTouch()) return;

    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('ref') ?? params.get('utm_source');
    // Un paramètre présent mais invalide n'est pas une arrivée directe : on ne
    // devine rien du référent, la source reste inconnue.
    const source = explicit !== null
      ? normalizeSourceValue(explicit)
      : sourceFromReferrer(document.referrer, window.location.hostname);
    if (!source) return;

    const campaign = normalizeSourceValue(
      params.get('utm_campaign') ?? params.get('utm_medium')
    );

    const entry: FirstTouch = { source, ts: Date.now(), ...(campaign ? { campaign } : {}) };
    if (!hasConsented()) {
      // Pas de réponse au bandeau (ou un refus) : on retient en mémoire, rien
      // n'est écrit. Perdu au rechargement, et c'est voulu.
      pending = entry;
      return;
    }
    localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* localStorage indisponible ou URL illisible — l'app doit démarrer quand même. */
  }
}

/**
 * À appeler quand le visiteur ACCEPTE : pose la source retenue en mémoire
 * depuis l'arrivée sur la page. No-op sans consentement ou sans source.
 */
export function persistPendingFirstTouch(): void {
  try {
    if (!pending || !hasConsented()) return;
    if (!readFirstTouch()) {
      localStorage.setItem(FIRST_TOUCH_STORAGE_KEY, JSON.stringify(pending));
    }
    pending = null;
  } catch {
    /* stockage indisponible : pas d'attribution, pas d'erreur. */
  }
}

/** Refus ou retrait du consentement : la source ne survit nulle part. */
export function clearAttributionTraces(storage: Pick<Storage, 'removeItem'>): void {
  pending = null;
  try { storage.removeItem(FIRST_TOUCH_STORAGE_KEY); } catch { /* stockage indisponible */ }
}

/** Réservé aux tests. */
export function _pendingFirstTouchForTests(): FirstTouch | null {
  return pending;
}
