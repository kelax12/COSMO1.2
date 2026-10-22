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
import type { CreateEventInput } from '@/modules/events/types';

/** Vu une fois par appareil, comme le flag qu'il remplace. */
export const FIRST_RUN_FLAG = 'cosmo_first_run_done';

/** Cinq tâches pour commencer : au-delà, l'accueil deviendrait une saisie. */
export const MAX_FIRST_TASKS = 5;

/**
 * Le prénom de l'accueil (« Bonjour Axel. »), pris au premier mot du nom de
 * profil. Une adresse e-mail n'est pas un prénom : quand le nom n'est que
 * l'adresse (inscription sans nom), on ne salue personne plutôt que de
 * saluer « axel@exemple.fr ».
 */
export const firstName = (fullName: string | null | undefined): string => {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  return first.includes('@') ? '' : first.slice(0, 40);
};

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

/** Durées proposées pour une habitude, en minutes. */
export const HABIT_MINUTES = [10, 20, 30, 45, 60] as const;

/** Mêmes valeurs par défaut que `HabitModal`, pour qu'une habitude créée ici
 *  soit indiscernable d'une habitude créée dans l'application. La durée est
 *  CHOISIE par la personne (2026-10-05) : « Se coucher avant 23 h » ne dure
 *  pas trente minutes, et l'imposer faussait ses statistiques de temps. */
export const buildHabitInput = (name: string, minutes = 30): CreateHabitInput => ({
  name: name.trim(),
  description: '',
  frequency: 'daily',
  estimatedTime: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 30,
  color: '#3B82F6',
  icon: '✓',
});

/**
 * Une cible saisie en texte (« 10 », « 2,5 ») : un nombre strictement positif,
 * sinon 1 (résultat clé binaire). On ne devine jamais une cible : on divise
 * par elle (garde B17).
 */
export const parseTarget = (raw: string): number => {
  const n = Number(raw.replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : 1;
};

export type SlotDay = 'today' | 'tomorrow';
export const SLOT_HOURS = [9, 14, 18] as const;

/**
 * Le créneau proposé à l'étape Agenda : une heure, aujourd'hui ou demain,
 * relié à la tâche (`taskId`), exactement ce que fait un glisser-déposer
 * depuis la liste latérale de l'agenda. Choisi par la personne, jamais posé
 * à sa place.
 */
export const buildSlotEvent = (
  taskName: string,
  taskId: string | undefined,
  day: SlotDay,
  hour: number,
  now: Date = new Date(),
): CreateEventInput => {
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  if (day === 'tomorrow') start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: taskName.trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    ...(taskId ? { taskId } : {}),
  };
};

/**
 * Compte entreprise remis à plus tard (« Plus tard » sur `/entreprise/onboarding`) :
 * l'accueil perso le rappelle, sinon plus rien ne ramène la personne vers
 * l'entreprise qu'elle était venue créer. Effacé à la création ou à
 * l'adhésion.
 */
export const BUSINESS_PENDING_FLAG = 'cosmo_business_onboarding_pending';

export const readBusinessPending = (): boolean => {
  try {
    return localStorage.getItem(BUSINESS_PENDING_FLAG) === '1';
  } catch {
    return false;
  }
};

export const setBusinessPending = (pending: boolean): void => {
  try {
    if (pending) localStorage.setItem(BUSINESS_PENDING_FLAG, '1');
    else localStorage.removeItem(BUSINESS_PENDING_FLAG);
  } catch {
    /* stockage indisponible : le rappel ne s'affichera pas */
  }
};

/**
 * L'objectif seul suffit : le résultat clé est facultatif, parce qu'exiger
 * une mesure chiffrée au premier écran est exactement le genre de friction
 * qui fait fermer l'onglet. Sa cible chiffrée est facultative aussi : sans
 * nombre, le résultat clé est binaire (cible 1).
 *
 * 🔴 L'id du résultat clé est un UUID, jamais `kr-<horodatage>`. Le dépôt
 * Supabase refuse tout id de KR qui n'en est pas un avant de l'interpoler
 * dans un filtre PostgREST (M-1, `syncKRsToTable` → `invalid_input`) : cet
 * accueil insérait l'objectif puis échouait sur son résultat clé, et la
 * personne lisait « Impossible de créer l'OKR » à sa toute première minute.
 * Trouvé le 2026-10-03 en rejouant l'accueil hors démo ; le parcours e2e ne
 * le voyait pas, il comptait les écritures parties, pas la réponse.
 */
/** Même repli que `OKRModalSheet` pour un navigateur sans `randomUUID`. */
const newKeyResultId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const buildOkrInput = (
  objective: string,
  keyResult: string,
  now: Date = new Date(),
  target = '',
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
            id: newKeyResultId(),
            title: kr,
            currentValue: 0,
            targetValue: parseTarget(target),
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
