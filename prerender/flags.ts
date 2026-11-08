// Drapeaux du prérendu, dans un module SANS effet de bord : les gardes qui
// importent les gabarits de `content/` (jsdom, sans URL de fichier) ne doivent
// pas charger `config.ts`, qui lit le disque.

/**
 * Miroir de `PRICES_VISIBLE` (src/modules/billing/premium-config.ts) : ce script
 * Node ne lit pas le TypeScript de l'application. Garde de parité :
 * src/modules/billing/prices-visible.guard.test.ts.
 */
export const PRIX_VISIBLES = true;
