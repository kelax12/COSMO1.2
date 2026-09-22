// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — C-69 · la vitrine du hero doit pouvoir s'arrêter
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE QU'IL GARDE. Avant le 2026-09-21, `AppWindowShowcase` changeait de vue
// toutes les 2,5 s sans bouton de pause, sans arrêt au survol ni au focus, et
// sans égard pour `prefers-reduced-motion`. WCAG 2.2.2 (AA).
//
// ⚠️ **Ce témoin n'exerce PAS le composant**, et c'est un choix. Monter
// `AppWindowShowcase` en jsdom demanderait `IntersectionObserver`, `matchMedia`
// et une horloge, et le test mesurerait alors surtout la qualité de ces trois
// bouchons. La règle vit donc dans un module pur, et c'est elle qu'on exerce —
// sur les SIX combinaisons possibles, pas sur un échantillon.
//
// ❌ **Ce que ce témoin ne prouve pas** : que le bouton existe, qu'il porte un
// nom accessible et qu'il fait 44 × 44 px. Ça, c'est le rôle de
// `e2e/touch-targets.spec.ts` (qui mesure `/`) et de l'audit clavier. Un
// témoin qui prétendrait couvrir les deux mentirait sur l'un des deux.
//
// ── LES SABOTAGES QUE CE FICHIER DOIT REFUSER ──────────────────────
//
// Joués à la main avant commit, chacun vu ROUGE :
//   1. `rotationDemandee` qui ignore `mouvementReduit` (le défaut d'origine)
//      → « auto + mouvement réduit » tombe.
//   2. `etatApresAppui` qui rend toujours `'pause'`
//      → « relancer après une pause » tombe.
//   3. `etatApresAppui` branché sur « ça tourne à cet instant » plutôt que sur
//      `rotationDemandee` → le cas du survol tombe.
//   4. `'lecture'` qui n'outrepasse plus `mouvementReduit`
//      → « le mouvement DEMANDÉ reste permis » tombe, et avec lui la seule
//      raison d'avoir trois états.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { rotationDemandee, etatApresAppui, type EtatRotation } from './rotation-state';

describe('C-69 — rotationDemandee : les six combinaisons, pas un échantillon', () => {
  const cas: Array<[EtatRotation, boolean, boolean, string]> = [
    ['auto', false, true, 'défaut, machine ordinaire : ça tourne'],
    ['auto', true, false, "défaut + prefers-reduced-motion : ça NE tourne PAS"],
    ['pause', false, false, 'pause explicite : ça ne tourne pas'],
    ['pause', true, false, 'pause explicite, même en mouvement réduit'],
    ['lecture', false, true, 'lecture explicite : ça tourne'],
    ['lecture', true, true, 'lecture DEMANDÉE : ça tourne MALGRÉ le mouvement réduit'],
  ];

  for (const [etat, reduit, attendu, quoi] of cas) {
    it(quoi, () => {
      expect(rotationDemandee(etat, reduit)).toBe(attendu);
    });
  }

  it("le défaut d'origine est refusé : `auto` ne doit pas tourner en mouvement réduit", () => {
    // Sabotage 1. C'est LE défaut que C-69 décrit : la rotation ignorait
    // entièrement le réglage système.
    expect(rotationDemandee('auto', true)).toBe(false);
  });

  it("`lecture` outrepasse le mouvement réduit — sans quoi trois états n'auraient aucun sens", () => {
    // Sabotage 4. WCAG 2.3.3 interdit le mouvement NON DEMANDÉ, pas le
    // mouvement. Sans ce cas, une personne en mouvement réduit resterait sur
    // « Tâches » pour toujours et le hero ne dirait plus rien pour elle.
    expect(rotationDemandee('lecture', true)).toBe(true);
    expect(rotationDemandee('auto', true)).toBe(false);
  });
});

describe('C-69 — etatApresAppui : le bouton bascule, et ne se retourne pas sous le curseur', () => {
  it('ça tourne → un appui met en PAUSE', () => {
    expect(etatApresAppui('auto', false)).toBe('pause');
    expect(etatApresAppui('lecture', false)).toBe('pause');
    expect(etatApresAppui('lecture', true)).toBe('pause');
  });

  it('ça ne tourne pas → un appui demande la LECTURE', () => {
    // Sabotage 2 : un `etatApresAppui` qui rendrait toujours `'pause'`
    // condamnerait l'utilisateur à ne jamais relancer ce qu'il a arrêté.
    expect(etatApresAppui('pause', false)).toBe('lecture');
    expect(etatApresAppui('pause', true)).toBe('lecture');
  });

  it("en mouvement réduit, le premier appui LANCE au lieu de mettre en pause", () => {
    // Rien ne tourne au départ : le bouton doit proposer « lecture », pas
    // « pause ». C'est ce qui rend la fenêtre utilisable pour cette population.
    expect(rotationDemandee('auto', true)).toBe(false);
    expect(etatApresAppui('auto', true)).toBe('lecture');
  });

  it("un aller-retour rend l'état de départ, dans les deux régimes", () => {
    for (const reduit of [false, true]) {
      const un = etatApresAppui('auto', reduit);
      const deux = etatApresAppui(un, reduit);
      expect(rotationDemandee(deux, reduit)).toBe(rotationDemandee('auto', reduit));
    }
  });

  it("la SUSPENSION n'entre pas dans la décision du bouton", () => {
    // Sabotage 3. Le survol suspend la rotation ; si le bouton se décidait sur
    // « est-ce que ça tourne à cet instant », il afficherait « lecture » sous
    // le curseur et un clic RELANCERAIT ce qu'on croyait arrêter.
    //
    // La signature elle-même porte la garantie : `etatApresAppui` ne reçoit
    // pas `suspendu`, donc elle ne peut pas en dépendre. Ce cas fige cette
    // signature — la changer pour y faire entrer la suspension casse ici.
    expect(etatApresAppui.length).toBe(2);
    expect(etatApresAppui('auto', false)).toBe('pause');
  });
});
