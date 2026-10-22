// ═══════════════════════════════════════════════════════════════════
// SATURATION — pourquoi le shader du hero entreprise se dégrade tout seul.
//
// Finding C-68, corrigé le 2026-09-05. `LightRays` peint le viewport ENTIER
// dans un fragment shader, à chaque frame, indéfiniment. Quand la machine ne
// sait pas exécuter une frame dans son budget, les commandes s'empilent : le
// tampon de commandes se remplit, et le fil principal du rendu se met à
// BLOQUER dans `CommandBufferProxyImpl::WaitForGetOffset` en attendant qu'il
// se vide. Mesuré sur le build de prod, rastérisation logicielle : 3 637 ms
// bloquées sur 4 000 au repos, dont ~2 800 de pure attente — donc AUCUN de
// notre JavaScript. C'est pour ça que neutraliser les flous, les 23
// `ScrollTrigger` ou les 8 tweens infinis ne déplaçait pas la mesure d'un
// point : ce n'était pas nous qui tournions.
//
// Une file qui sature n'a pas un coût progressif, elle a deux états : elle
// draine, ou elle ne draine pas. C'est ce qui rendait la mesure BIMODALE, et
// c'est ce qu'aucune moyenne ne pouvait expliquer.
//
// La réponse n'est donc pas « moins de pixels » choisi une fois pour toutes.
// On MESURE la cadence réellement servie et le temps passé DANS `render`, et
// on descend d'un palier tant que ça ne tient pas.
//
// ❌ Ne jamais remplacer ça par une détection de rastériseur logiciel
//    (`SwiftShader`, `llvmpipe`) : ça verdirait la sonde sans rien rendre à un
//    téléphone d'entrée de gamme, qui a bien un GPU et n'en sature pas moins.
//    On mesure ce qui se passe, pas ce qu'on croit.
// ═══════════════════════════════════════════════════════════════════

/**
 * Les paliers, du moins cher au plus cher à quitter.
 *
 * ⚠️ ON PART BAS, ON NE DESCEND PAS DEPUIS LE HAUT. Mesuré le 2026-09-05 : une
 * échelle qui commence à 1 et se dégrade laisse un résidu STABLE de 315 à
 * 393 ms sur six passes, là où la même page sans canvas rend 0 sur six. Ce
 * résidu n'est ni du bruit ni le régime établi : c'est la DESCENTE elle-même.
 * Les quelques dizaines de frames payées à pleine résolution, le temps que le
 * détecteur se prononce, tombent dans les premières secondes — c'est-à-dire au
 * seul moment où quelqu'un regarde la page. Un détecteur ne peut pas être plus
 * rapide que la preuve qu'il attend ; il peut en revanche ne jamais avoir à la
 * payer.
 *
 * La demi-résolution est donc le point de DÉPART, pas une punition : ce shader
 * est un dégradé basse fréquence, à 0,5 l'upscale CSS ne se voit pas, et rien
 * ne justifie de faire payer quatre fois plus de pixels pour une différence
 * que personne ne peut percevoir.
 */
export const PALIERS = [
  { echelle: 0.5, intervalleVise: 0 },
  { echelle: 0.35, intervalleVise: 0 },
  { echelle: 0.35, intervalleVise: 50 },
] as const;

/** ms — en dessous de ~36 images par seconde, on descend. */
export const INTERVALLE_SAIN = 28;
/** ms passées DANS `render`, donc à bloquer sur la file. */
export const COUT_SAIN = 4;
/**
 * ms — une frame à ce prix est un accroc.
 *
 * ⚠️ Une médiane saine ne suffit PAS. Mesuré le 2026-09-05 : à demi-résolution
 * la médiane du coût passait sous le seuil, et la page rendait quand même 270 à
 * 545 ms de tâches longues sur 4 s — quelques frames rares mais énormes,
 * invisibles pour une médiane. Une tâche longue au sens du navigateur commence
 * à 50 ms : c'est ce qu'on compte ici.
 */
export const COUT_ACCROC = 25;
export const ACCROCS_TOLERES = 2;
export const ECHANTILLONS = 4;
/** Frames ignorées : compilation du shader, premiers paints. */
export const CHAUFFE = 3;

/** Ce que le palier courant demande à la boucle de rendu. */
export interface EchelleAdaptative {
  /** Facteur appliqué au `dpr` du renderer, donc à la taille du tampon. */
  readonly echelle: number;
  /** ms minimum entre deux frames RENDUES ; 0 = plein débit. */
  readonly intervalleVise: number;
  /** Vrai quand la boucle doit s'arrêter : la dernière frame reste affichée. */
  readonly gele: boolean;
  /**
   * À appeler pour CHAQUE frame rendue, jamais pour une frame sautée.
   *
   * ⚠️ Échantillonner l'écart entre deux `requestAnimationFrame` mesurerait la
   * mauvaise chose dès qu'on saute des frames : les frames sautées sont servies
   * vite, leur médiane resterait basse pendant que chaque frame réellement
   * soumise sature — la sonde dirait « ça tient » exactement quand ça ne tient
   * plus.
   *
   * @param t horodatage de la frame (celui de `requestAnimationFrame`).
   * @param cout ms passées dans l'appel de rendu.
   * @returns vrai si le palier vient de changer (le tampon est à redimensionner,
   *   ou la boucle à arrêter si `gele`).
   */
  observer(t: number, cout: number): boolean;
}

const median = (xs: number[]) => {
  const tri = [...xs].sort((a, b) => a - b);
  return tri[Math.floor(tri.length / 2)];
};

export const creerEchelleAdaptative = (): EchelleAdaptative => {
  let palier = 0;
  let precedent = 0;
  let vues = 0;
  let accrocs = 0;
  const intervalles: number[] = [];
  const couts: number[] = [];

  const etat = {
    echelle: PALIERS[0].echelle as number,
    intervalleVise: PALIERS[0].intervalleVise as number,
    gele: false,

    observer(t: number, cout: number): boolean {
      if (etat.gele) return false;

      if (precedent && vues > CHAUFFE) intervalles.push(t - precedent);
      precedent = t;
      vues += 1;

      if (vues <= CHAUFFE) return false;

      couts.push(cout);
      if (cout > COUT_ACCROC) accrocs += 1;
      if (accrocs > ACCROCS_TOLERES) return descendre();

      if (intervalles.length < ECHANTILLONS && couts.length < ECHANTILLONS) return false;

      const cadenceKo = intervalles.length >= ECHANTILLONS
        && median(intervalles) > Math.max(INTERVALLE_SAIN, etat.intervalleVise * 1.6);
      const coutKo = couts.length >= ECHANTILLONS && median(couts) > COUT_SAIN;
      intervalles.length = 0;
      couts.length = 0;
      return cadenceKo || coutKo ? descendre() : false;
    },
  };

  const descendre = (): boolean => {
    intervalles.length = 0;
    couts.length = 0;
    accrocs = 0;
    vues = 0;
    precedent = 0;
    palier += 1;
    if (palier >= PALIERS.length) {
      etat.gele = true;
      return true;
    }
    etat.echelle = PALIERS[palier].echelle;
    etat.intervalleVise = PALIERS[palier].intervalleVise;
    return true;
  };

  return etat;
};
