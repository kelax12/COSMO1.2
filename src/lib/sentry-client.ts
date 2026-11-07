// ═══════════════════════════════════════════════════════════════════
// La SURFACE de Sentry que ce produit utilise, et rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// Pourquoi ce fichier : accéder à `@sentry/react` par NAMESPACE
// (`mod.captureException(err)`) empêche Rollup d'élaguer le paquet, qui passe de
// 49,3 ko à 155,9 ko gzip (replay compris) : un recul net pour tout visiteur muni
// d'un DSN, chargé à la première inactivité.
//
// Ce module réexporte donc NOMMÉMENT les six fonctions utilisées. Rollup voit
// six liaisons statiques au lieu d'un namespace opaque, et élague le reste.
//
// ❌ Ne jamais y ajouter `export * from '@sentry/react'` : ça rétablit
//    exactement le namespace opaque que ce fichier existe pour éviter.
// ✅ Ajouter une fonction ici quand le produit en a besoin — une par une, et
//    en remesurant `check:bundle` derrière.

export {
  init,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  browserTracingIntegration,
  addIntegration,
} from '@sentry/react';
