// Premier écran après inscription (T-23) — logique pure, sans React.
//
// POURQUOI CET ÉCRAN EXISTE. Mesuré en prod le 2026-08-28 sur 28 comptes :
// 36 % n'ont JAMAIS rien créé, et 50 % ne sont jamais revenus après leur
// session d'inscription. Ce que voyait un nouveau compte : `/dashboard`, soit
// sept sections toutes vides, plus trois tâches d'exemple créées sans écran,
// écrites en dur en français. Le produit agissait à la place de la personne,
// et dans une langue qui n'était pas forcément la sienne.
//
// Le parti pris est l'inverse : on pose trois questions, la personne répond ce
// qu'elle veut, et ce qu'elle a écrit devient ses vraies données. Chaque étape
// est passable, et l'écran entier l'est aussi — un onboarding qu'on ne peut pas
// quitter est un mur, pas un accueil.
import type { CreateTaskInput } from '@/modules/tasks/types';
import type { CreateHabitInput } from '@/modules/habits/types';
import type { CreateOKRInput } from '@/modules/okrs/types';

/** Vu une fois par appareil, comme le flag qu'il remplace. */
export const FIRST_RUN_FLAG = 'cosmo_first_run_done';

/**
 * Ancien drapeau des trois tâches d'exemple. Il reste lu, jamais écrit : un
 * compte qui a déjà eu l'ancien accueil puis supprimé ses tâches ne doit pas
 * se voir accueilli une seconde fois.
 */
export const LEGACY_EXAMPLES_FLAG = 'cosmo_onboarding_examples_created';

/** localStorage peut lever (Safari privé, cookies bloqués) — cf. garde-fou `safeParse`. */
export const readFirstRunDone = (): boolean => {
  try {
    return (
      localStorage.getItem(FIRST_RUN_FLAG) === '1' ||
      localStorage.getItem(LEGACY_EXAMPLES_FLAG) === '1'
    );
  } catch {
    // Illisible = on considère l'accueil déjà vu. Se tromper dans ce sens ne
    // coûte qu'un écran manqué ; l'inverse le ferait réapparaître à chaque
    // visite, sur l'appareil de quelqu'un qui ne peut rien y faire.
    return true;
  }
};

export const markFirstRunDone = (): void => {
  try {
    localStorage.setItem(FIRST_RUN_FLAG, '1');
  } catch {
    // Sans persistance l'écran reviendra ; il reste passable en un clic.
  }
};

export interface FirstRunGate {
  isDemo: boolean;
  isAuthenticated: boolean;
  /** La liste des tâches est chargée (sinon `taskCount` ne veut rien dire). */
  tasksLoaded: boolean;
  taskCount: number;
  alreadyDone: boolean;
}

/**
 * Le compte doit être VIDE, pas seulement nouveau : quelqu'un qui se connecte
 * sur un second appareil a déjà des tâches, et le drapeau, lui, est local.
 * Tant que les tâches ne sont pas chargées on ne montre rien — afficher puis
 * retirer serait pire que d'attendre.
 */
export const shouldOfferFirstRun = (gate: FirstRunGate): boolean =>
  !gate.isDemo &&
  gate.isAuthenticated &&
  gate.tasksLoaded &&
  gate.taskCount === 0 &&
  !gate.alreadyDone;

/**
 * AUCUNE échéance n'est posée. La personne a donné un intitulé, pas une date :
 * en inventer une ferait apparaître sa première tâche « en retard », et
 * traverserait la conversion jour ↔ instant que `src/lib/deadline.ts` existe
 * précisément pour tenir. On ne devine pas une donnée qu'on n'a pas demandée.
 */
export const buildTaskInput = (name: string): CreateTaskInput => ({
  name: name.trim(),
  description: '',
  priority: 0,
  category: '',
  deadline: '',
  estimatedTime: 0,
  bookmarked: false,
  completed: false,
});

/** Mêmes valeurs par défaut que `HabitModal`, pour qu'une habitude créée ici
 *  soit indiscernable d'une habitude créée dans l'application. */
export const buildHabitInput = (name: string): CreateHabitInput => ({
  name: name.trim(),
  description: '',
  frequency: 'daily',
  estimatedTime: 30,
  color: '#3B82F6',
  icon: '✓',
});

/**
 * L'objectif seul suffit : le résultat clé est facultatif, parce qu'exiger
 * une mesure chiffrée au premier écran est exactement le genre de friction
 * qui fait fermer l'onglet. Quand il est donné, il est binaire (cible 1) —
 * l'écran OKR permet de le chiffrer ensuite.
 */
export const buildOkrInput = (
  objective: string,
  keyResult: string,
  now: Date = new Date(),
): CreateOKRInput => {
  const start = now.toISOString();
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const kr = keyResult.trim();
  return {
    title: objective.trim(),
    description: '',
    category: '',
    progress: 0,
    completed: false,
    keyResults: kr
      ? [
          {
            id: `kr-${now.getTime()}`,
            title: kr,
            currentValue: 0,
            targetValue: 1,
            unit: '',
            completed: false,
            estimatedTime: 0,
            weight: 1,
          },
        ]
      : [],
    startDate: start,
    endDate: end,
  };
};
