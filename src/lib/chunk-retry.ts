// Détecte un chunk périmé (déploiement récent : le hash référencé par l'ancien
// `index.html` n'existe plus sur le CDN) et recharge la page UNE fois pour
// repartir sur un bundle frais, au lieu de remonter une erreur générique
// (« Failed to fetch dynamically imported module ») à l'appelant.
//
// Même mécanique que `lazyWithRetry` (`@/lib/lazy-with-retry`), extraite pour
// être réutilisable par un `import()` dynamique qui n'est PAS un composant
// React.lazy — ex. `validateAsync` (`@/lib/validation/lazy.ts`), dont le chunk
// `validate-*.js` casse « Créer la tâche » avec le même symptôme.
//
// 🔴 `lazyWithRetry` garde SA propre copie de cette logique (couplée à
// `Suspense`/i18n) : ne pas fusionner les deux sans relire ses garanties.

const STORAGE_KEY = 'cosmo:chunk-reload-attempt';

function isChunkLoadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

// 🔴 `sessionStorage` JETTE dans plusieurs contextes réels (webview, mode
// privé, cookies tiers bloqués) — même garde que `lazyWithRetry` : un confort
// anti-boucle, jamais une condition de rendu.
function readFlag(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeFlag() {
  try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* stockage indisponible */ }
}
function clearFlag() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* stockage indisponible */ }
}

/**
 * Enveloppe un `import()` dynamique : sur une erreur de chunk périmé, recharge
 * la page une seule fois (garde anti-boucle) au lieu de faire échouer
 * l'action en cours avec un message technique.
 */
export async function withChunkRetry<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const result = await loader();
    clearFlag();
    return result;
  } catch (err) {
    if (isChunkLoadError(err) && !readFlag()) {
      writeFlag();
      window.location.reload();
      // Promise jamais résolue : la page va recharger.
      return new Promise<T>(() => {});
    }
    throw err;
  }
}
