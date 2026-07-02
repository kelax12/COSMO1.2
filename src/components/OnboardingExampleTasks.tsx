// Onboarding par l'exemple (#49) — composant invisible monté dans Layout.
//
// Au premier login PROD avec un compte vide (0 tâche), crée 3 tâches
// d'exemple qui enseignent les gestes clés en les faisant : cocher,
// planifier dans l'agenda, partager. Une seule fois par appareil (flag
// localStorage), jamais en mode démo (les seeds démo suffisent).
import { useEffect, useRef } from 'react';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks, useCreateTask } from '@/modules/tasks';

const FLAG_KEY = 'cosmo_onboarding_examples_created';

const todayLocal = () => new Date().toLocaleDateString('en-CA');

const EXAMPLE_TASKS = [
  {
    name: '✓ Coche-moi pour valider ta première tâche',
    description: 'Clique sur le rond à gauche — un toast « Annuler » te permet toujours de revenir en arrière.',
    priority: 3,
  },
  {
    name: '🗓 Planifie-moi dans l\'agenda',
    description: 'Ouvre le menu « ⋯ » de cette tâche et choisis « Planifier », ou glisse-la sur l\'agenda depuis la barre latérale.',
    priority: 0,
  },
  {
    name: '👥 Partage-moi avec un ami',
    description: 'Ouvre cette tâche puis « Copier le lien » — toute personne avec le lien peut rejoindre la tâche.',
    priority: 0,
  },
];

const OnboardingExampleTasks = () => {
  const isDemo = useIsDemo();
  const { isAuthenticated } = useAuth();
  const { data: tasks = [], isSuccess } = useTasks({ enabled: isAuthenticated && !isDemo });
  const createTaskMutation = useCreateTask();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || isDemo || !isAuthenticated || !isSuccess) return;
    if (tasks.length > 0) return;
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') return;
      localStorage.setItem(FLAG_KEY, '1');
    } catch { return; }
    firedRef.current = true;

    EXAMPLE_TASKS.forEach((t, i) => {
      createTaskMutation.mutate({
        name: t.name,
        description: t.description,
        priority: t.priority,
        category: '',
        deadline: i === 0 ? todayLocal() : '',
        estimatedTime: 5,
        bookmarked: false,
        completed: false,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, isAuthenticated, isSuccess, tasks.length]);

  return null;
};

export default OnboardingExampleTasks;
