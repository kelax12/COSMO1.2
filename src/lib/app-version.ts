// Détection d'un onglet qui exécute un bundle périmé — partie PURE.
//
// Le contexte, mesuré : le 2026-08-26, **91,5 % du trafic Supabase de la
// journée venait de deux onglets** qui exécutaient encore le bundle d'avant la
// suppression des sondes périodiques. Une SPA ne recharge pas son bundle toute
// seule : un onglet laissé ouvert exécute indéfiniment la version qu'il a
// téléchargée. Conséquence contre-intuitive, inscrite dans
// `docs/PERFORMANCE.md` : **un gain de performance n'atteint que les
// utilisateurs qui rouvrent l'application**, et les plus assidus sont les
// derniers servis.
//
// La décision d'afficher quoi que ce soit tient en trois lignes, isolées ici
// pour être testables sans DOM, sans réseau et sans horloge réelle.

/** Identifiant de build compilé dans le bundle courant (`vite.config.ts`). */
export const currentRelease = (): string =>
  typeof __APP_RELEASE__ === 'string' ? __APP_RELEASE__ : 'dev';

/**
 * Faut-il proposer un rechargement ?
 *
 * ⚠️ Trois refus délibérés, et chacun évite un faux positif :
 *
 * - `served` vide ou illisible → non. Le fichier peut être absent (dev, preview
 *   statique), ou une réponse HTML peut arriver à sa place si un jour une règle
 *   de réécriture l'avale. Dans le doute on ne dérange pas.
 * - `'dev'` de part et d'autre → non. En développement le build n'a pas de SHA,
 *   les deux valent `dev` en permanence.
 * - versions égales → non, évidemment.
 *
 * Le cas où l'on se trompe le plus cher n'est pas « on a raté une mise à
 * jour », c'est « on demande à quelqu'un de recharger sans raison, au milieu de
 * ce qu'il est en train d'écrire ».
 */
export const shouldOfferReload = (current: string, served: unknown): boolean => {
  if (typeof served !== 'string') return false;
  const next = served.trim();
  if (!next || next === 'dev' || current === 'dev') return false;
  return next !== current;
};

/** Délai minimal entre deux vérifications, quel que soit le nombre de retours d'onglet. */
export const VERSION_CHECK_MIN_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Vérifie-t-on maintenant ?
 *
 * ❌ **Pas de `setInterval`.** La règle du dépôt vaut ici comme ailleurs : rien
 * ne doit tourner en permanence dans l'onglet de tout le monde. La vérification
 * est déclenchée par un retour d'onglet, puis étranglée à une fois par
 * demi-heure — un aller-retour sur un fichier statique de quelques octets,
 * jamais une requête applicative.
 */
export const shouldCheckNow = (lastCheckedAt: number | null, now: number): boolean =>
  lastCheckedAt === null || now - lastCheckedAt >= VERSION_CHECK_MIN_INTERVAL_MS;
