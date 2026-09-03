// ═══════════════════════════════════════════════════════════════════
// CACHE OFFLINE-FIRST DE LA SESSION — tâches et habitudes
// ═══════════════════════════════════════════════════════════════════
//
// Persiste tâches et habitudes dans `localStorage` pour que l'application
// paraisse instantanée au démarrage à froid. Chaque entrée est clé par
// `userId` : sur un appareil partagé, aucun compte ne lit le cache d'un autre.
// Durée de vie 24 h — la donnée périmée s'affiche d'abord, puis est remplacée
// silencieusement par la lecture réseau.
//
// ⚠️ Extrait d'`AuthContext.tsx` le 2026-09-03, et c'est le cliquet de taille
// qui l'a imposé : le fichier repassait au-dessus de 600 lignes. La coupe suit
// une frontière réelle — d'un côté un cache de démarrage, quatre fonctions
// pures de tout React ; de l'autre le provider qui tient la session.
//
// ⚠️ Ces fonctions ne LÈVENT jamais : `localStorage` jette en navigation
// privée, en webview et quand les cookies tiers sont bloqués. Un cache
// d'agrément ne doit pas empêcher l'application de démarrer.

const PREFIX = 'cosmo:qcache:';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export function readLocalCache<T>(userId: string, key: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${userId}:${key}`);
    if (!raw) return null;
    const { data, at } = JSON.parse(raw) as { data: T; at: number };
    if (Date.now() - at > CACHE_MAX_AGE) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeLocalCache(userId: string, key: string, data: unknown): void {
  try {
    localStorage.setItem(`${PREFIX}${userId}:${key}`, JSON.stringify({ data, at: Date.now() }));
  } catch {
    // localStorage plein — on ignore, c'est un cache d'agrément.
  }
}

export function clearLocalCache(userId: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${userId}:tasks`);
    localStorage.removeItem(`${PREFIX}${userId}:habits`);
  } catch { /* ignore */ }
}

/**
 * L-11 — sur un appareil partagé, déconnecter quelqu'un ne doit pas laisser le
 * cache d'un AUTRE compte lisible depuis les devtools (les entrées survivent
 * 24 h). On balaie donc tout le préfixe au SIGNED_OUT, pas seulement le
 * `userId` courant.
 */
export function purgeAllLocalCache(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
