// ═══════════════════════════════════════════════════════════════════
// FILET DU SPINNER DE DÉMARRAGE (`#boot-screen` d'index.html)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (2026-11-06). Axel est resté bloqué sur le spinner de démarrage,
// sur TOUTES les pages, en navigation classique ; en navigation privée tout
// marchait. Ce spinner vit DANS `#root` et seul le premier commit de React
// l'efface. Le script inline d'index.html ne le montre (au lieu du prérendu)
// que si une session `sb-*-auth-token` ou une démo est stockée : un état
// propre au navigateur, d'où l'écart avec la navigation privée.
//
// Si React ne monte jamais (import de `main` rejeté, promesse d'amorçage qui ne
// se résout pas, exception avant `createRoot`), rien ne retirait ce spinner :
// ni `RootErrorBoundary`, ni le watchdog d'`AuthContext`, qui vivent tous deux
// DANS l'arbre React, n'existent encore. L'utilisateur n'avait aucun geste, et
// recharger relisait le même stockage.
//
// Ce module tourne dans `boot.ts`, AVANT React : passé un délai, si le spinner
// est toujours là, il le remplace par deux sorties (recharger, ou purger la
// session locale via `hardSignOut`, la même sortie que les frontières
// d'erreur). Le premier commit de React vide `#root` et emporte ce panneau
// avec le spinner : rien à annuler quand l'app finit par monter.
//
// ❌ Aucun import lourd ici : `boot.ts` est sur le chemin critique
// (`check:bundle`). `hard-sign-out` n'a aucune dépendance.
// ⚠️ Un fil principal FIGÉ (boucle synchrone) n'est pas couvert : le minuteur
// ne s'exécuterait pas. Ce filet couvre l'attente, pas le gel.
//
// 🔴 LA CAUSE MESURÉE (2026-11-06, console d'Axel) : « Refused to apply style
// from /assets/main-DRISBFKc.css because its MIME type ('text/plain') is not a
// supported stylesheet MIME type ». Le serveur le sert en `text/css`, mais le
// navigateur en gardait une copie `text/plain`, sous `Cache-Control: immutable`
// d'un an : jamais redemandée, même au rechargement. Le CSS refusé fait rejeter
// `import('./main')` (préchargement Vite), React ne monte pas. La navigation
// privée, cache vide, marchait. Recharger ou purger le localStorage ne change
// RIEN à ce cache-là : seule une requête `cache: 'reload'` remplace l'entrée.
// D'où `repairAssetCache`, tentée UNE fois automatiquement par `boot.ts`, puis
// derrière les deux boutons.

import { hardSignOut } from './hard-sign-out';

/** Délai au-delà duquel un spinner de démarrage est tenu pour bloqué. */
export const BOOT_STALL_MS = 12_000;

/** Marqueur anti-boucle de la réparation automatique (par onglet). */
export const ASSET_REPAIR_FLAG = 'cosmo:boot-asset-repair';

const RESCUE_ID = 'boot-rescue';

/**
 * Les fichiers `/assets/` de l'origine que la page a demandés : ceux du
 * balisage (`<link>`, `<script>`) et ceux que l'amorçage a chargés depuis
 * (`performance`), CSS de `main` compris.
 */
export function collectAssetUrls(doc: Document, perf?: Pick<Performance, 'getEntriesByType'>): string[] {
  const origin = doc.location?.origin ?? '';
  const urls = new Set<string>();
  const keep = (raw: string | null) => {
    if (!raw) return;
    try {
      const u = new URL(raw, doc.baseURI);
      if (u.origin === origin && u.pathname.startsWith('/assets/')) urls.add(u.href);
    } catch { /* adresse illisible : ignorée */ }
  };
  doc.querySelectorAll('link[href]').forEach((l) => keep(l.getAttribute('href')));
  doc.querySelectorAll('script[src]').forEach((s) => keep(s.getAttribute('src')));
  try {
    (perf ?? performance).getEntriesByType('resource').forEach((e) => keep(e.name));
  } catch { /* Resource Timing indisponible */ }
  return [...urls];
}

/**
 * Redemande chaque fichier en contournant le cache HTTP : `cache: 'reload'`
 * REMPLACE l'entrée en cache par la réponse fraîche. Ne lève jamais.
 */
export async function repairAssetCache(
  doc: Document,
  fetchImpl: typeof fetch = fetch,
  perf?: Pick<Performance, 'getEntriesByType'>,
): Promise<number> {
  const urls = collectAssetUrls(doc, perf);
  await Promise.allSettled(urls.map((u) => fetchImpl(u, { cache: 'reload', credentials: 'same-origin' })));
  return urls.length;
}

interface BootWatchdogOptions {
  doc?: Document;
  delayMs?: number;
  onReload?: () => void;
  onReset?: () => void;
  /** Réparation du cache (injectable pour les tests). */
  repair?: () => Promise<unknown>;
  /** Rechargement de la page (injectable pour les tests). */
  reloadPage?: () => void;
  /** Stockage du marqueur anti-boucle (injectable pour les tests). */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

interface BootWatchdog {
  /** L'amorçage a échoué : afficher la sortie sans attendre le délai. */
  fail: () => void;
}

/** Le spinner de démarrage est-il encore À L'ÉCRAN ? */
export function isBootScreenStuck(doc: Document): boolean {
  const screen = doc.getElementById('boot-screen');
  if (!screen || !screen.isConnected) return false;
  // Page prérendue : le spinner est masqué en CSS et le contenu SEO est peint.
  // L'utilisateur voit une page lisible, pas une impasse.
  if (doc.documentElement.hasAttribute('data-prerendered')) return false;
  return true;
}

/**
 * Remplace le spinner par le panneau de sortie. Idempotent.
 * `force` (échec d'amorçage certain) : aussi sur une page prérendue, dont la
 * copie peinte avant React resterait sinon affichée mais inerte, sans aucun
 * bouton qui réponde (vécu le 2026-11-06 après « Réinitialiser la session »).
 */
export function showBootRescue(
  doc: Document,
  onReload: () => void,
  onReset: () => void,
  force = false,
): boolean {
  const screen = doc.getElementById('boot-screen');
  if (!screen || !screen.isConnected || doc.getElementById(RESCUE_ID)) return false;
  if (!force && !isBootScreenStuck(doc)) return false;
  if (force) {
    // Le spinner redevient visible (CSS `html[data-prerendered]`), la copie du
    // hero (calque au-dessus de `#root`) disparaît.
    doc.documentElement.removeAttribute('data-prerendered');
    doc.getElementById('lp-hero')?.remove();
  }

  const en = (doc.documentElement.lang || '').toLowerCase().startsWith('en');
  const copy = en
    ? {
        title: 'Cosmo cannot start.',
        body: 'Reload the page: Cosmo downloads its files again first. If it happens again, reset the session saved in this browser: you will need to log in again, your data stays on your account.',
        reload: 'Reload',
        reset: 'Reset the session',
      }
    : {
        title: 'Cosmo ne parvient pas à démarrer.',
        body: 'Rechargez la page : Cosmo retélécharge d’abord ses fichiers. Si cela se reproduit, réinitialisez la session enregistrée dans ce navigateur : il faudra vous reconnecter, vos données restent sur votre compte.',
        reload: 'Recharger',
        reset: 'Réinitialiser la session',
      };

  const panel = doc.createElement('div');
  panel.id = RESCUE_ID;
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'max-width:420px;margin:0 16px;padding:24px;border-radius:16px;text-align:center;' +
    'font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'color:var(--bs-accent);background:transparent';

  const title = doc.createElement('p');
  title.textContent = copy.title;
  title.style.cssText = 'margin:0 0 8px;font-weight:600;font-size:17px';

  const body = doc.createElement('p');
  body.textContent = copy.body;
  body.style.cssText = 'margin:0 0 20px;opacity:.8';

  const actions = doc.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';

  const button = (label: string, primary: boolean, onClick: () => void) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'padding:10px 16px;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;' +
      (primary
        ? 'background:var(--bs-accent);color:var(--bs-bg);border:1px solid var(--bs-accent)'
        : 'background:transparent;color:var(--bs-accent);border:1px solid var(--bs-ring)');
    b.addEventListener('click', onClick);
    return b;
  };

  actions.append(button(copy.reload, true, onReload), button(copy.reset, false, onReset));
  panel.append(title, body, actions);
  screen.replaceChildren(panel);
  screen.setAttribute('aria-label', copy.title);
  return true;
}

/**
 * Arme le filet. À appeler dans `boot.ts`, avant `import('./main')`.
 */
export function installBootWatchdog(options: BootWatchdogOptions = {}): BootWatchdog {
  const doc = options.doc ?? document;
  const delayMs = options.delayMs ?? BOOT_STALL_MS;
  const repair = options.repair ?? (() => repairAssetCache(doc));
  const reloadPage = options.reloadPage ?? (() => window.location.reload());
  const storage = options.storage !== undefined ? options.storage : safeSessionStorage();
  // Chaque sortie répare d'abord le cache : recharger seul resservirait la
  // même copie périmée, et la déconnexion ne la toucherait pas davantage.
  const onReload = options.onReload ?? (() => { void repair().finally(reloadPage); });
  const onReset = options.onReset ?? (() => { void repair().finally(hardSignOut); });

  const rescue = (force: boolean) => {
    try {
      showBootRescue(doc, onReload, onReset, force);
    } catch {
      /* le filet ne doit jamais lever à son tour */
    }
  };

  const timer = setTimeout(() => rescue(false), delayMs);
  return {
    fail: () => {
      clearTimeout(timer);
      // Première fois dans cet onglet : réparation SILENCIEUSE puis
      // rechargement, l'utilisateur ne voit qu'un spinner un peu plus long.
      // Déjà tentée (le marqueur survit au rechargement, pas à l'onglet) :
      // la cause est ailleurs, on montre les sorties.
      let alreadyTried = true;
      try {
        alreadyTried = storage?.getItem(ASSET_REPAIR_FLAG) === '1';
        if (!alreadyTried) storage?.setItem(ASSET_REPAIR_FLAG, '1');
      } catch { /* stockage indisponible : pas de réparation automatique */ }
      if (!alreadyTried && storage) {
        void repair().finally(reloadPage);
        return;
      }
      rescue(true);
    },
  };
}

/** L'amorçage a réussi : la prochaine panne aura droit à sa réparation. */
export function clearAssetRepairFlag(storage: Pick<Storage, 'removeItem'> | null = safeSessionStorage()): void {
  try { storage?.removeItem(ASSET_REPAIR_FLAG); } catch { /* stockage indisponible */ }
}

function safeSessionStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}
