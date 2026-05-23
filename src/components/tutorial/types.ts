/**
 * Types du framework de tutoriel par page.
 *
 * Chaque tutoriel = un tableau de TutorialStep affichés en séquence.
 * Une étape peut :
 *   - cibler un élément (`target` = CSS selector), auquel cas il est mis en
 *     spotlight (le reste de la page est assombri)
 *   - ne rien cibler (`target` absent), auquel cas la carte est centrée
 *   - exécuter une action de démo automatique (`action`) — clic factice,
 *     ouverture de modal, simulation de drag, etc.
 *   - pointer une flèche animée depuis une direction (`arrowSide`)
 */

export type ArrowSide = 'top' | 'bottom' | 'left' | 'right';
export type CardPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'inside';

export interface TutorialStep {
  /** Titre court affiché dans la carte */
  title: string;
  /** Description (1-3 lignes) */
  description: string;
  /**
   * Sélecteur CSS de l'élément à mettre en avant. Le rect du 1er élément
   * matching est utilisé. Si absent → carte centrée plein écran.
   */
  target?: string;
  /**
   * Côté depuis lequel la flèche pointe vers la cible.
   * Si absent ET target présent → calculé automatiquement selon la position
   * de la carte.
   */
  arrowSide?: ArrowSide;
  /**
   * Position de la carte par rapport à la cible.
   * Défaut : 'bottom' si la cible est haut écran, 'top' sinon.
   */
  cardPlacement?: CardPlacement;
  /**
   * Action de démo auto. Déclenchée 800ms après l'apparition de l'étape.
   *   - 'click'         : simule un click sur target
   *   - 'pulse'         : juste un pulse visuel sur target (par défaut si action absent)
   *   - 'drag-ghost'    : anime un fantôme d'élément depuis target vers dragTo
   *   - 'drag-and-resize' : scénario complet — un fantôme « tâche » glisse de
   *                         target vers dragTo, se transforme en bloc événement,
   *                         puis le bloc s'étire vers le bas pour montrer le
   *                         resize. Idéal pour démontrer le drag + resize sur
   *                         FullCalendar sans toucher au DOM réel.
   *   - 'type'          : tape `typeText` dans target (input)
   *   - 'custom'        : appelle customAction(target)
   */
  action?: 'click' | 'pulse' | 'drag-ghost' | 'drag-and-resize' | 'type' | 'custom';
  /** Label affiché dans le fantôme de drag pour le rendre parlant (ex. « Réviser maths ») */
  ghostLabel?: string;
  /** Pour action='drag-ghost' : sélecteur de la cible du drag */
  dragTo?: string;
  /** Pour action='type' : texte à taper */
  typeText?: string;
  /** Pour action='custom' : fonction exécutée à l'arrivée de l'étape */
  customAction?: (target: HTMLElement | null) => Promise<void> | void;
  /**
   * Délai avant l'action auto (ms). Défaut 800ms pour laisser l'utilisateur
   * lire la description avant la démo.
   */
  actionDelay?: number;
  /**
   * Mobile only / Desktop only. Permet d'avoir des étapes qui ne s'affichent
   * pas sur certaines tailles. Défaut : 'both'.
   * Conservé pour compat ; désormais on fournit deux configs séparées (.desktop / .mobile).
   */
  visibility?: 'mobile' | 'desktop' | 'both';
  /**
   * Intensité du voile assombrissant.
   *   - 'normal' (défaut) : voile sombre standard ~0.72
   *   - 'light'           : voile très léger ~0.35 — utile quand l'action démontrée
   *                          implique une vue large (drag sur calendrier, calendrier complet)
   *   - 'none'            : pas de voile (la cible est sur fond transparent)
   * Le contour spotlight (anneau coloré + pulse + flèche) reste actif quoi qu'il arrive.
   */
  dimLevel?: 'normal' | 'light' | 'none';
}
