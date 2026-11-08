// ═══════════════════════════════════════════════════════════════════
// Historique des focus, partage par `useModalA11y` (surfaces maison) et `useRadixFocusReturn`
// (enveloppes Radix de `components/ui`).
//
// Installe au demarrage de l'application (`src/main.tsx`), PAS au premier rendu d'une
// modale : `TaskModal` n'est montee qu'a l'ouverture, donc le premier `useRadixFocusReturn`
// tournerait APRES le `focusin` du bouton declencheur, et l'historique serait vide. Les tests
// jsdom ne le voient pas si un test precedent a deja installe l'ecouteur au niveau du module.
// ═══════════════════════════════════════════════════════════════════

/**
 * Les derniers elements qui ont eu le focus, le plus recent en dernier.
 *
 * Pourquoi un historique, et pas `document.activeElement` a l'ouverture : un `autoFocus` React
 * est applique AU COMMIT, donc AVANT l'effet passif qui capture le declencheur. A ce moment
 * `document.activeElement` est deja le champ de la modale, et le bouton d'origine est perdu
 * (cas de `HabitModal`, que `EventModal`, sans `autoFocus`, ne montre pas).
 *
 * On remonte donc l'historique jusqu'au dernier element qui n'est PAS dans la
 * modale. Borne a 10 : c'est un cache de reprise, pas un journal.
 */
const focusHistory: HTMLElement[] = [];
let historyInstalled = false;

export function installFocusHistory(): void {
  if (historyInstalled || typeof document === 'undefined') return;
  historyInstalled = true;
  document.addEventListener(
    'focusin',
    () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return;
      const seen = focusHistory.indexOf(el);
      if (seen !== -1) focusHistory.splice(seen, 1);
      focusHistory.push(el);
      if (focusHistory.length > 10) focusHistory.shift();
    },
    true,
  );
}

/**
 * Le dernier element focalise qui vit HORS de `root`.
 *
 * `allowDetached` garde un element que React a deja RETIRE du DOM : a l'ouverture d'une surface,
 * le bouton qui l'a ouverte est parfois recree par le meme rendu (cas de « Nouvelle tache » de
 * `/tasks`). Il faut alors le CAPTURER detache, puis lui retrouver un equivalent
 * (`reconnected`) : le sauter ferait choisir un element sans rapport, ou aucun.
 */
export function lastFocusedOutside(root: HTMLElement | null, allowDetached = false): HTMLElement | null {
  for (let i = focusHistory.length - 1; i >= 0; i--) {
    const el = focusHistory[i];
    if (!allowDetached && !el.isConnected) continue;
    if (root && root.contains(el)) continue;
    return el;
  }
  return null;
}

/**
 * Un element encore monte, ou, s'il a ete recree par un rendu, son EQUIVALENT : meme `id`, a defaut
 * meme `aria-label` ou `data-testid` sur la meme balise. Rien de plus vague : mieux vaut ne
 * rien restituer que rendre le focus a un element sans rapport.
 */
export function reconnected(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  if (el.isConnected) return el;
  const q = (attr: string, value: string | null) =>
    value ? document.querySelector<HTMLElement>(`${el.tagName.toLowerCase()}[${attr}="${value.replace(/"/g, '\\"')}"]`) : null;
  const byId = el.id ? document.getElementById(el.id) : null;
  return byId ?? q('aria-label', el.getAttribute('aria-label')) ?? q('data-testid', el.getAttribute('data-testid'));
}

/**
 * Une modale ouverte depuis l'entrée d'un menu Radix a pour déclencheur cette
 * entrée, qui disparaît avec le menu. Le vrai déclencheur est le bouton qui a
 * ouvert le menu : Radix le désigne par l'`aria-labelledby` du menu.
 */
export function menuTriggerOf(el: HTMLElement | null): HTMLElement | null {
  const menu = el?.closest('[role="menu"][aria-labelledby]');
  const id = menu?.getAttribute('aria-labelledby');
  return (id && document.getElementById(id)) || el;
}
