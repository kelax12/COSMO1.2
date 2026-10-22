// ═══════════════════════════════════════════════════════════════════
// La SURFACE de Sentry que ce produit utilise, et rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER DE SIX LIGNES EXISTE.
//
// La première version de la mise en différé faisait, dans `monitoring.ts` :
//
//     const mod = await import('@sentry/react');
//     ...
//     mod.captureException(err)      // accès par NAMESPACE
//
// Rollup ne peut pas élaguer un namespace dont les propriétés sont lues à
// l'exécution : il doit tout garder. MESURÉ — `vendor-sentry` est passé de
// **49,3 ko à 155,9 ko gzip** (470 ko bruts), soit le paquet entier,
// intégrations de replay comprises.
//
// Comme ce chunk est chargé à la première inactivité pour TOUT visiteur muni
// d'un DSN, la mise en différé serait alors devenue un RECUL NET : 106 ko de
// plus expédiés à tout le monde, juste plus tard. L'arbitrage disait
// « 49,3 ko sortent du chemin critique », pas « triplent en changeant de
// chunk ».
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
} from '@sentry/react';
