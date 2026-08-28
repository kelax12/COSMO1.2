// Cloudflare Turnstile — protection anti-robot des points d'entrée Auth.
//
// POURQUOI : l'audit du 2026-08-27 a trouvé qu'aucune protection anti-bot
// n'existait sur l'inscription (finding AM-3 de `docs/ROADMAP-60J.md`). Le
// risque n'est pas tant le faux compte que le **quota d'emails** : une vague de
// robots vide le plafond d'envoi du projet, et les inscriptions légitimes
// échouent alors avec « Trop de tentatives » sans que personne ne comprenne
// pourquoi. C'est le même mode de défaillance que AM-1, et les deux se
// corrigent ensemble ou pas du tout.
//
// 🔴 **INERTE tant que `VITE_TURNSTILE_SITE_KEY` n'est pas posée.** Aucun
// script tiers n'est chargé, aucun jeton n'est produit, aucun comportement ne
// change. C'est délibéré : le code peut partir en production avant que le
// compte Cloudflare existe, et il ne fait rien en attendant.
//
// ⚠️ **Le vrai interrupteur est côté Supabase, pas ici.** Poser la clé publique
// n'active rien : c'est le réglage « Enable CAPTCHA protection » du Dashboard
// (Authentication → Attack Protection), avec la clé SECRÈTE, qui fait exiger un
// jeton par GoTrue. Les deux vont ENSEMBLE, dans cet ordre :
//   1. déployer avec `VITE_TURNSTILE_SITE_KEY` posée → le widget produit des
//      jetons, que le serveur ignore encore ;
//   2. activer côté Supabase → le serveur se met à les exiger.
// Inverser les deux rend l'inscription ET la connexion impossibles pour tout le
// monde, parce que GoTrue exigerait un jeton que personne n'envoie encore.
//
// 🔴 **Activer le CAPTCHA côté Supabase CASSERA `npm run cosmo:login`.** La
// protection couvre aussi `signInWithOtp`, qu'utilise le CLI agent
// (`scripts/cosmo/login.mjs`) — un script Node ne peut pas résoudre un
// challenge. Il faut s'y attendre AVANT de basculer le réglage, pas le
// découvrir le jour où le CLI cesse de fonctionner. Détail dans
// `docs/DEPLOYMENT.md`.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Clé publique du site, ou `null` si la protection n'est pas configurée. */
export const turnstileSiteKey = (): string | null => {
  const raw = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  return key === '' ? null : key;
};

export const isTurnstileEnabled = (): boolean => turnstileSiteKey() !== null;

/**
 * API minimale du script Cloudflare, déclarée à la main.
 *
 * Pas de `as any` (règle du dépôt) et pas de paquet npm : Turnstile n'expose
 * qu'un objet global, l'envelopper dans une dépendance ajouterait du poids au
 * chemin critique pour trois signatures.
 */
interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'auto' | 'light' | 'dark';
      appearance?: 'always' | 'execute' | 'interaction-only';
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi | null> | null = null;

/**
 * Charge le script Cloudflare, une seule fois par page.
 *
 * ⚠️ Le chargement n'a lieu QUE si la clé est posée : sans elle, aucun visiteur
 * ne paie une requête vers un tiers. Un produit qui charge un script d'un
 * fournisseur qu'il n'utilise pas encore, c'est du poids et une dépendance
 * réseau pour rien.
 *
 * Résout `null` en cas d'échec (hors ligne, script bloqué par une extension) —
 * l'appelant doit alors laisser passer, pas bloquer le formulaire. Un CAPTCHA
 * injoignable ne doit jamais devenir une porte fermée : le serveur, lui,
 * refusera si la protection est réellement active.
 */
export const loadTurnstile = (): Promise<TurnstileApi | null> => {
  if (typeof window === 'undefined' || !isTurnstileEnabled()) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;

  loading = new Promise<TurnstileApi | null>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    const done = () => resolve(window.turnstile ?? null);
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return loading;
};

/** Réinitialise l'état du module — tests uniquement. */
export const resetTurnstileLoaderForTests = (): void => {
  loading = null;
};

/**
 * Réarme le widget après une soumission refusée.
 *
 * Le jeton est à **usage unique** : après un échec — mot de passe erroné,
 * adresse déjà prise — le suivant serait rejeté par le serveur pour une raison
 * qui n'a rien à voir avec ce que l'utilisateur vient de corriger. Sans ce
 * réarmement, la deuxième tentative échoue toujours, et la troisième aussi.
 */
export const resetTurnstile = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.turnstile?.reset();
  } catch {
    // Script absent ou widget déjà retiré — rien à réarmer.
  }
};
