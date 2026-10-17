// Mesure d'audience maison (remplace Veske / vesk.dev, mig. 222).
//
// Envoie trois sortes d'évènements à `/api/collect` (même origine) :
//   • `view`  à chaque page affichée (arrivée et navigation SPA) ;
//   • `leave` quand on quitte une page : durée et profondeur de scroll ;
//   • `cta`   au clic sur un élément portant `data-cta="Nom du bouton"`.
//
// Conditions, reprises de l'ancien `audience.ts` et vérifiées AVANT CHAQUE
// envoi (pas seulement au démarrage, ce qui corrige sa limite assumée : se
// connecter sans recharger coupe désormais la mesure tout de suite) :
//   1. consentement « accepted » (lu par `cookie-consent.ts`, jamais ailleurs) ;
//   2. page publique, hors de l'app authentifiée ;
//   3. jamais sur un formulaire d'identifiants (signup, login…) ;
//   4. aucune session Supabase persistée.
//
// Rien n'est déposé sur l'appareil : ni cookie, ni localStorage, ni
// sessionStorage. L'empreinte du visiteur est calculée côté serveur.
import { ALL_LOCALES } from '@/i18n/locale';
import { getSnapshot, subscribe } from '@/lib/cookie-consent';

export const COLLECT_URL = '/api/collect';

/** Premiers segments des routes protégées (cf. `<ProtectedRoute />` dans `src/App.tsx`). */
export const AUTHENTICATED_SEGMENTS: readonly string[] = [
  'dashboard', 'tasks', 'agenda', 'habits', 'okr',
  'statistics', 'settings', 'entreprise', 'admin', 'premium',
];

/** Pages publiques avec un formulaire d'identifiants : jamais mesurées. */
export const CREDENTIAL_FORM_SEGMENTS: readonly string[] = [
  'signup', 'login', 'forgot-password', 'reset-password', 'invite', 'org-invite',
];

/** Retire un éventuel préfixe de locale (`/en/tasks` → `/tasks`). */
export function stripLocale(pathname: string): string {
  const [, first = '', ...rest] = pathname.split('/');
  if ((ALL_LOCALES as readonly string[]).includes(first)) return `/${rest.join('/')}`;
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function firstSegment(pathname: string): string {
  return stripLocale(pathname).split('/')[1] ?? '';
}

export function isPublicPath(pathname: string): boolean {
  return !AUTHENTICATED_SEGMENTS.includes(firstSegment(pathname));
}

export function hasCredentialForm(pathname: string): boolean {
  return CREDENTIAL_FORM_SEGMENTS.includes(firstSegment(pathname));
}

/** Une session Supabase est-elle persistée ? Lit les NOMS de clés, jamais les valeurs. */
export function hasPersistedSession(storage: Pick<Storage, 'key' | 'length'>): boolean {
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && /^sb-.+-auth-token$/.test(key)) return true;
    }
  } catch {
    return true; // dans le doute, on ne mesure pas
  }
  return false;
}

export function shouldMeasure(
  pathname: string,
  storage: Pick<Storage, 'key' | 'length'>,
  consent: string | null,
): boolean {
  return consent === 'accepted'
    && isPublicPath(pathname)
    && !hasCredentialForm(pathname)
    && !hasPersistedSession(storage);
}

/** Hôte du référent, seulement s'il vient d'un autre site. */
export function referrerHost(referrer: string, ownHost: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).host;
    return host && host !== ownHost ? host.replace(/^www\./, '') : undefined;
  } catch {
    return undefined;
  }
}

/** Seuls les paramètres `utm_*` sont retenus de la query string. */
export function utmParams(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(search);
  for (const name of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(name);
    if (value) out[name] = value.slice(0, 100);
  }
  return out;
}

export interface TrafficEnv {
  win: Window;
  doc: Document;
  send?: (body: string) => void;
  now?: () => number;
}

/**
 * Démarre la mesure. Idempotent ; renvoie une fonction d'arrêt (tests).
 * Ne lève jamais : la mesure ne doit pas empêcher l'app de démarrer.
 */
export function startTrafficMeasurement(env: TrafficEnv): () => void {
  const { win, doc } = env;
  const now = env.now ?? (() => Date.now());
  const send = env.send ?? ((body: string) => {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (!win.navigator.sendBeacon?.(COLLECT_URL, blob)) {
        void win.fetch(COLLECT_URL, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
          .catch(() => {});
      }
    } catch { /* jamais d'erreur visible */ }
  });

  let currentPath: string | null = null;
  let enteredAt = 0;
  let maxScroll = 0;
  let firstView = true;

  const eligible = () => {
    try {
      return shouldMeasure(win.location.pathname, win.localStorage, getSnapshot());
    } catch {
      return false;
    }
  };

  const emit = (event: Record<string, unknown>): boolean => {
    if (!eligible()) return false;
    send(JSON.stringify(event));
    return true;
  };

  const trackScroll = () => {
    const el = doc.documentElement;
    const scrollable = el.scrollHeight - win.innerHeight;
    const pct = scrollable <= 0 ? 100 : Math.round((win.scrollY / scrollable) * 100);
    if (pct > maxScroll) maxScroll = Math.min(100, Math.max(0, pct));
  };

  const leave = () => {
    if (currentPath === null) return;
    emit({ kind: 'leave', path: currentPath, duration_ms: Math.max(0, now() - enteredAt), scroll_pct: maxScroll });
    currentPath = null;
  };

  const view = () => {
    const path = win.location.pathname;
    if (path === currentPath) return;
    leave();
    currentPath = path;
    enteredAt = now();
    maxScroll = 0;
    trackScroll();
    const sent = emit({
      kind: 'view',
      path,
      lang: win.navigator.language,
      // Le référent ne vaut que pour l'arrivée ; ensuite, la navigation est interne.
      referrer_host: firstView ? referrerHost(doc.referrer, win.location.host) : undefined,
      ...(firstView ? utmParams(win.location.search) : {}),
    });
    if (sent) firstView = false;
    else currentPath = null; // rien n'a été compté : la page ne doit pas produire de `leave`
  };

  const onClick = (e: Event) => {
    const target = (e.target as Element | null)?.closest?.('[data-cta]');
    const name = target?.getAttribute('data-cta');
    if (name && currentPath) emit({ kind: 'cta', path: currentPath, cta: name.slice(0, 80) });
  };
  const onVisibility = () => { if (doc.visibilityState === 'hidden') leave(); else view(); };

  // La SPA navigue par l'History API : on observe pushState / replaceState.
  const history = win.history;
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args: Parameters<History['pushState']>) {
    origPush.apply(this, args);
    win.setTimeout(view, 0);
  };
  history.replaceState = function (...args: Parameters<History['replaceState']>) {
    origReplace.apply(this, args);
    win.setTimeout(view, 0);
  };
  win.addEventListener('popstate', view);
  win.addEventListener('scroll', trackScroll, { passive: true });
  win.addEventListener('pagehide', leave);
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('click', onClick, true);

  // Un accord donné après coup démarre la mesure sans recharger ; un retrait l'arrête aussitôt.
  const unsubscribe = subscribe(() => {
    if (getSnapshot() === 'accepted') view();
    else currentPath = null;
  });

  view();

  return () => {
    history.pushState = origPush;
    history.replaceState = origReplace;
    win.removeEventListener('popstate', view);
    win.removeEventListener('scroll', trackScroll);
    win.removeEventListener('pagehide', leave);
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.removeEventListener('click', onClick, true);
    unsubscribe();
  };
}
