// ═══════════════════════════════════════════════════════════════════
// MOCK DATA - Données de démonstration
// Types importés depuis les modules (source unique de vérité)
// ═══════════════════════════════════════════════════════════════════

import { Task } from '@/modules/tasks';
import { Habit } from '@/modules/habits';
import { OKR } from '@/modules/okrs';
import { Category } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// Types locaux (non exportés par les modules)
// ═══════════════════════════════════════════════════════════════════

interface OKRCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Personnel', color: '#3B82F6' },
  { id: 'cat-2', name: 'Travail', color: '#EF4444' },
  { id: 'cat-3', name: 'Santé', color: '#10B981' },
  { id: 'cat-4', name: 'Loisirs', color: '#F59E0B' },
  { id: 'cat-5', name: 'Finance', color: '#8B5CF6' },
];

export const INITIAL_OKR_CATEGORIES: OKRCategory[] = [
  { id: 'okrcat-1', name: 'Carrière', color: '#3B82F6', icon: 'Briefcase' },
  { id: 'okrcat-2', name: 'Santé', color: '#10B981', icon: 'Heart' },
  { id: 'okrcat-3', name: 'Apprentissage', color: '#8B5CF6', icon: 'Book' },
  { id: 'okrcat-4', name: 'Finance', color: '#F59E0B', icon: 'TrendingUp' },
];

// ═══════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    name: 'Finaliser le rapport mensuel Cosmo',
    priority: 5,
    category: 'cat-2',
    deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    estimatedTime: 120,
    createdAt: new Date().toISOString(),
    bookmarked: true,
    completed: false
  },
  {
    id: 'task-2',
    name: 'Séance de HIIT intense',
    priority: 4,
    category: 'cat-3',
    deadline: new Date().toISOString().split('T')[0],
    estimatedTime: 45,
    createdAt: new Date().toISOString(),
    bookmarked: false,
    completed: true,
    completedAt: new Date().toISOString()
  },
  {
    id: 'task-3',
    name: 'Préparer la présentation roadmap Q1',
    priority: 5,
    category: 'cat-2',
    deadline: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    estimatedTime: 180,
    createdAt: new Date().toISOString(),
    bookmarked: true,
    completed: false
  },
  {
    id: 'task-4',
    name: 'Appeler la banque (prêt immo)',
    priority: 3,
    category: 'cat-5',
    deadline: new Date().toISOString().split('T')[0],
    estimatedTime: 20,
    createdAt: new Date().toISOString(),
    bookmarked: false,
    completed: false
  },
  {
    id: 'task-5',
    name: 'Lecture : "Atomic Habits"',
    priority: 2,
    category: 'cat-1',
    deadline: new Date().toISOString().split('T')[0],
    estimatedTime: 30,
    createdAt: new Date().toISOString(),
    bookmarked: false,
    completed: false
  }
];

// ═══════════════════════════════════════════════════════════════════
// HABITS - Conformes au type Habit du module
// ═══════════════════════════════════════════════════════════════════

export const INITIAL_HABITS: Habit[] = [
  {
    id: 'habit-1',
    name: 'Méditation Matinale',
    description: '15 minutes de méditation guidée',
    frequency: 'daily',
    estimatedTime: 15,
    color: '#3B82F6',
    icon: '🧘',
    completions: { [new Date().toISOString().split('T')[0]]: true },
    createdAt: new Date().toISOString()
  },
  {
    id: 'habit-2',
    name: 'Lecture du soir',
    description: '30 minutes de lecture avant de dormir',
    frequency: 'daily',
    estimatedTime: 30,
    color: '#8B5CF6',
    icon: '📚',
    completions: { [new Date().toISOString().split('T')[0]]: false },
    createdAt: new Date().toISOString()
  },
  {
    id: 'habit-3',
    name: 'Hydratation (2L/jour)',
    description: 'Boire au moins 2 litres d'eau par jour',
    frequency: 'daily',
    estimatedTime: 5,
    color: '#10B981',
    icon: '💧',
    completions: { [new Date().toISOString().split('T')[0]]: true },
    createdAt: new Date().toISOString()
  }
];

// ═══════════════════════════════════════════════════════════════════
// OKRS - Conformes au type OKR du module
// ═══════════════════════════════════════════════════════════════════

export const INITIAL_OKRS: OKR[] = [
  {
    id: 'okr-1',
    title: 'Devenir Senior Developer Cosmo',
    description: 'Atteindre un niveau d'expertise exceptionnel sur la stack technique.',
    category: 'okrcat-3',
    progress: 45,
    completed: false,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    keyResults: [
      { 
        id: 'kr-1', 
        title: 'Maîtriser TypeScript & Design Patterns', 
        currentValue: 80, 
        targetValue: 100, 
        unit: '%', 
        completed: false, 
        estimatedTime: 40 
      },
      { 
        id: 'kr-2', 
        title: 'Lancer 2 features majeures', 
        currentValue: 1, 
        targetValue: 2, 
        unit: 'features', 
        completed: false, 
        estimatedTime: 80 
      }
    ]
  },
  {
    id: 'okr-2',
    title: 'Liberté Financière',
    description: 'Optimiser les investissements et épargner pour le futur.',
    category: 'okrcat-4',
    progress: 25,
    completed: false,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    keyResults: [
      { 
        id: 'kr-3', 
        title: 'Épargner 10k€', 
        currentValue: 2500, 
        targetValue: 10000, 
        unit: '€', 
        completed: false, 
        estimatedTime: 0 
      }
    ]
  }
];
