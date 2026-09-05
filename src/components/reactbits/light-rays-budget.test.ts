import { describe, it, expect } from 'vitest';
import {
  creerEchelleAdaptative,
  PALIERS,
  COUT_ACCROC,
  COUT_SAIN,
  INTERVALLE_SAIN,
} from './light-rays-budget';

/**
 * Finding C-68 — l'échelle adaptative du shader du hero entreprise.
 *
 * Ce que ces tests protègent tient en une phrase : une page qui bloque le fil
 * principal 3 637 ms sur 4 000 au repos ne le bloquait pas en EXÉCUTANT du
 * JavaScript, elle ATTENDAIT un tampon de commandes GPU plein. La seule chose
 * qui l'en empêche est cette échelle-là ; si elle cesse de descendre, plus rien
 * ne le voit, et la mesure ne repart pas toute seule.
 */

/** Joue `n` frames à un coût et une cadence donnés. Rend le nombre de descentes. */
const jouer = (
  echelle: ReturnType<typeof creerEchelleAdaptative>,
  n: number,
  cout: number,
  intervalle: number,
  t0 = 0,
) => {
  let descentes = 0;
  let t = t0;
  for (let i = 0; i < n; i += 1) {
    t += intervalle;
    if (echelle.observer(t, cout)) descentes += 1;
  }
  return descentes;
};

describe('C-68 — échelle adaptative de LightRays', () => {
  it('part à demi-résolution, jamais à pleine résolution', () => {
    // Descendre depuis le haut coûte la descente : mesuré, un résidu stable de
    // 315 à 393 ms sur six passes. Le départ EST le correctif.
    expect(creerEchelleAdaptative().echelle).toBe(0.5);
    expect(PALIERS[0].echelle).toBe(0.5);
  });

  it('ne bouge pas quand la machine tient la cadence', () => {
    const e = creerEchelleAdaptative();
    expect(jouer(e, 200, COUT_SAIN - 2, 16)).toBe(0);
    expect(e.echelle).toBe(0.5);
    expect(e.intervalleVise).toBe(0);
    expect(e.gele).toBe(false);
  });

  it('descend puis gèle quand chaque frame sature, et rend les rayons immobiles, pas absents', () => {
    const e = creerEchelleAdaptative();
    // 40 ms par frame, donc une cadence sous les 36 img/s ET un coût de rendu
    // au-dessus du seuil : les deux détecteurs sont d'accord.
    jouer(e, 400, 40, 40);
    expect(e.gele).toBe(true);
    // Le gel est un ARRÊT de la boucle, pas un démontage : rien n'efface le
    // canvas, la dernière frame reste affichée. C'est ce qui permet de traiter
    // C-68 sans arbitrage de direction artistique.
    expect(e.echelle).toBeGreaterThan(0);
  });

  it('descend sur des accrocs rares que la médiane ne verrait pas', () => {
    // Le piège mesuré le 2026-09-05 : à demi-résolution la médiane du coût
    // passait sous le seuil pendant que la page rendait encore 270 à 545 ms de
    // tâches longues. Trois frames chères sur vingt suffisent à descendre.
    const e = creerEchelleAdaptative();
    let descentes = 0;
    let t = 0;
    for (let i = 0; i < 20; i += 1) {
      t += 16;
      const cout = i % 6 === 0 ? COUT_ACCROC + 20 : 1;
      if (e.observer(t, cout)) descentes += 1;
    }
    expect(descentes).toBeGreaterThan(0);
    expect(e.echelle).toBeLessThan(0.5);
  });

  it('une fois gelée, ne redescend plus et ne redemande plus rien', () => {
    const e = creerEchelleAdaptative();
    jouer(e, 400, 40, 40);
    expect(e.gele).toBe(true);
    expect(jouer(e, 100, 999, 999)).toBe(0);
  });

  it('TÉMOIN — un détecteur qui ne détecterait plus rien fait ROUGIR ce fichier', () => {
    // Sans ce témoin, les tests ci-dessus passeraient encore si `observer`
    // rendait toujours `false` : « ne bouge pas quand ça tient » serait vert
    // pour la mauvaise raison. On vérifie donc qu'une saturation FRANCHE est
    // bien vue, et qu'une cadence saine ne l'est pas — les deux sens.
    const sature = creerEchelleAdaptative();
    expect(jouer(sature, 60, COUT_SAIN * 10, INTERVALLE_SAIN * 3)).toBeGreaterThan(0);

    const sain = creerEchelleAdaptative();
    expect(jouer(sain, 60, 0.2, 16)).toBe(0);
  });
});
