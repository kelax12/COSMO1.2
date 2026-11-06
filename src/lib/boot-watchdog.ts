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

import { hardSignOut } from './hard-sign-out';

/** Délai au-delà duquel un spinner de démarrage est tenu pour bloqué. */
export const BOOT_STALL_MS = 12_000;

const RESCUE_ID = 'boot-rescue';

interface BootWatchdogOptions {
  doc?: Document;
  delayMs?: number;
  onReload?: () => void;
  onReset?: () => void;
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

/** Remplace le spinner par le panneau de sortie. Idempotent. */
export function showBootRescue(
  doc: Document,
  onReload: () => void,
  onReset: () => void,
): boolean {
  if (!isBootScreenStuck(doc)) return false;
  const screen = doc.getElementById('boot-screen');
  if (!screen || doc.getElementById(RESCUE_ID)) return false;

  const en = (doc.documentElement.lang || '').toLowerCase().startsWith('en');
  const copy = en
    ? {
        title: 'Cosmo is taking too long to start.',
        body: 'Reload the page. If it happens again, reset the session saved in this browser: you will need to log in again, your data stays on your account.',
        reload: 'Reload',
        reset: 'Reset the session',
      }
    : {
        title: 'Cosmo met trop de temps à démarrer.',
        body: 'Rechargez la page. Si cela se reproduit, réinitialisez la session enregistrée dans ce navigateur : il faudra vous reconnecter, vos données restent sur votre compte.',
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
  const onReload = options.onReload ?? (() => window.location.reload());
  const onReset = options.onReset ?? hardSignOut;

  const rescue = () => {
    try {
      showBootRescue(doc, onReload, onReset);
    } catch {
      /* le filet ne doit jamais lever à son tour */
    }
  };

  const timer = setTimeout(rescue, delayMs);
  return {
    fail: () => {
      clearTimeout(timer);
      rescue();
    },
  };
}
