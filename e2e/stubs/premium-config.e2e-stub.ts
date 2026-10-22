// ═══════════════════════════════════════════════════════════════════
// `premium-config` du mode Vite `e2e-stub` — UN booléen change, rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE FICHIER N'EST JAMAIS DANS LE PRODUIT. Il est substitué au module réel
// par un alias de `vite.config.ts` conditionné à `mode === 'e2e-stub'`, servi
// uniquement par le serveur du project Playwright `supabase-stub` (port 3210).
// `npm run build`, `npm run dev` et `npm start` voient le module du produit.
//
// POURQUOI IL EXISTE. `ENTERPRISE_BILLING_ENFORCED` vaut `false` dans le
// produit, donc le bouton « Résilier et être remboursé de la période en cours »
// n'est monté nulle part : aucun parcours de bout en bout ne peut cliquer un
// contrôle qui n'existe pas. C-27 exige pourtant que C-65, qui déplace de
// l'argent, ne parte pas sans son parcours. Le drapeau est retourné ICI, pour
// ce serveur-là seulement — le même geste que le `vi.mock(…, importOriginal)`
// de `OrgBillingTab.refund.parcours.test.tsx`, au niveau du bundler.
//
// ❌ Ne JAMAIS recopier ici une valeur du produit. `export *` réexporte les
//    paliers, les montants et `ORG_FREE_SEATS` tels quels : une grille de
//    tarifs recopiée serait une seconde grille, exactement ce que
//    `org-tiers.parity.test.ts` existe pour empêcher.
// ❌ Ne JAMAIS ajouter un second drapeau retourné ici sans dire pourquoi : ce
//    qui est retourné ici est ce qu'un parcours ne mesure PAS dans le produit.
//
// ⚠️ Le nom local l'emporte sur le `export *` (règle ESM : une réexportation
//    étoilée exclut les noms exportés explicitement). Le reste du module passe
//    donc intact, et un export ajouté au produit arrive ici tout seul.
export * from '../../src/modules/billing/premium-config';

/** Retourné pour ce mode UNIQUEMENT. Le produit vaut `false`. */
export const ENTERPRISE_BILLING_ENFORCED = true;
