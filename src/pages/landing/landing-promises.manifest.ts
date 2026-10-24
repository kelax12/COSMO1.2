// ═══════════════════════════════════════════════════════════════════
// Manifeste des promesses de la landing (docs/UI-PATTERNS.md, AM-4).
//
// La landing promet : des fonctionnalités, des limites chiffrées (sièges,
// gratuit/payant, durées de rétention), des garanties (résiliable, isolation,
// export). Chaque promesse listée ici porte :
//
//   - `anchors`  : où elle est écrite (clé du catalogue ou du prérendu + un
//                  extrait EXACT en français). Si le texte change ou disparaît,
//                  la garde casse : la promesse doit alors être revue ici.
//   - `proofs`   : où elle est tenue dans le code (fichier + motif).
//   - `figures`  : les chiffres que ce texte est autorisé à porter, par clé.
//
// Un chiffre écrit sur la landing qui n'est dans aucun `figures` fait échouer
// `landing-promises.guard.test.ts`, de même qu'une preuve qui disparaît.
//
// `kind` :
//   produit      fonctionnalité ou garantie, prouvée dans le code ;
//   limite       plafond ou durée chiffrés, prouvés et, quand c'est possible,
//                mesurés par la garde ;
//   indicatif    durée ou effort annoncés, non mesurables (dit pourquoi) ;
//   editorial    chiffre de méthode, d'exemple ou de récit, pas une promesse
//                sur le produit ;
//   illustration donnée fictive d'une maquette (jamais une mesure).
//
// `verdict: 'fausse'` : la promesse ne tient plus. Le texte n'est PAS corrigé
// ici (la copie marketing est une décision d'Axel) : `constat` dit ce que le
// code fait réellement, et `proofs` y pointe. La garde vérifie que la
// promesse est TOUJOURS fausse ; dès qu'elle devient vraie ou que le texte
// change, elle casse et demande de rebasculer l'entrée.
//
// ⚠️ Les chiffres sont comparés écrits en chiffres OU en lettres (« cinq » vaut
// « 5 »), en français comme en anglais. Les années (20xx) et les numéros de
// section (« // 01 · ») sont ignorés.
// ⚠️ Hors périmètre : les articles de blog (`src/content/blog/`), éditoriaux.
// ═══════════════════════════════════════════════════════════════════

import type { LandingPromise } from './landing-promises.types';
import { PROMISES_PERSO } from './landing-promises.perso';
import { PROMISES_ENTREPRISE } from './landing-promises.entreprise';
import { PROMISES_SUITE } from './landing-promises.suite';

export type { LandingPromise, PromiseAnchor, PromiseProof } from './landing-promises.types';

export const LANDING_PROMISES: LandingPromise[] = [...PROMISES_PERSO, ...PROMISES_ENTREPRISE, ...PROMISES_SUITE];
