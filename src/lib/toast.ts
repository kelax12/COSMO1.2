// Façade différée sur Sonner — pourquoi elle existe.
//
// `sonner` pesait 66,6 ko bruts dans le chunk d'ENTRÉE, donc dans le chemin
// critique, donc payés par tout visiteur qui arrive sur la landing et repart.
// Il y entrait par deux chemins :
//   • le `<Toaster>` monté dans `App.tsx` ;
//   • quatre modules du shell qui appellent `toast.*` dans des callbacks de
//     mutation (`friends/hooks`, `organizations/hooks`, `AuthContext`,
//     `ShareInviteClaimer`).
//
// Or AUCUN de ces appels ne peut partir avant que la personne agisse : ce sont
// des `onSuccess` / `onError` de mutation, ou des gestionnaires d'évènement.
// Le module peut donc être chargé après le premier rendu.
//
// ❌ Ne jamais réimporter `sonner` directement, **y compris depuis une page
// lazy**. C'est contre-intuitif et c'est mesuré : tant qu'une seule page garde
// l'import statique, Rollup place le module dans l'ANCÊTRE COMMUN des chunks
// qui le partagent, c'est-à-dire l'entrée. Un `manualChunks` l'en sort, mais
// Vite émet alors un `<link rel="modulepreload">` dans index.html et le chemin
// critique ne bouge pas d'un octet — le piège documenté au paragraphe @sentry
// de `vite.config.ts`. La seule forme qui gagne vraiment est celle-ci :
// l'`import()` dynamique de ce fichier, et lui seul.
//
// ⚠️ Les appels émis avant que le module soit chargé ne sont pas perdus : ils
// sont rejoués dans le `then` du même import, donc dans l'ordre d'émission.

import type { ExternalToast } from 'sonner';

type SonnerModule = typeof import('sonner');

let loaded: SonnerModule | null = null;
let loading: Promise<SonnerModule> | null = null;

/**
 * Charge Sonner une seule fois. `App.tsx` s'en sert aussi pour son `<Toaster>`
 * différé : un seul import dynamique, donc un seul chunk.
 */
export function loadSonner(): Promise<SonnerModule> {
  if (!loading) {
    loading = import('sonner').then((m) => {
      loaded = m;
      return m;
    });
  }
  return loading;
}

type Variant = 'success' | 'error' | 'info' | 'warning' | 'message' | 'loading';

/** Rendu libre d'un toast : la signature de `sonner`, reprise telle quelle. */
type CustomRender = Parameters<SonnerModule['toast']['custom']>[0];

function run(call: (m: SonnerModule) => void): void {
  if (loaded) {
    call(loaded);
    return;
  }
  void loadSonner().then(call);
}

function defer(variant: Variant) {
  return (message: string, data?: ExternalToast): void => {
    run((m) => m.toast[variant](message, data));
  };
}

/**
 * ⚠️ Les variantes ne rendent RIEN, là où `sonner` rend un identifiant.
 *
 * Avant chargement il n'y a pas d'identifiant à rendre, et en inventer un
 * obligerait à tenir une table de correspondance pour `dismiss`. Aucun appelant
 * n'en lisait un : le seul usage de l'identifiant est `toast.custom`, dont le
 * rendu le reçoit en argument (`showUndoToast`), et ce chemin-là est intact.
 */
export const toast = Object.assign(
  (message: string, data?: ExternalToast): void => {
    run((m) => m.toast(message, data));
  },
  {
    success: defer('success'),
    error: defer('error'),
    info: defer('info'),
    warning: defer('warning'),
    message: defer('message'),
    loading: defer('loading'),
    custom: (jsx: CustomRender, data?: ExternalToast): void => {
      run((m) => m.toast.custom(jsx, data));
    },
    dismiss: (id?: string | number): void => {
      run((m) => m.toast.dismiss(id));
    },
  }
);
