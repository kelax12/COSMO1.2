// ═══════════════════════════════════════════════════════════════════
// TASKS - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul (V12.3) : aucune lecture ni écriture de stockage ici. Le
// dépôt de démo voisin l'ensemence au premier accès.

import { Task } from './types';

// Helper pour générer des dates
const getDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

// Raccourci pour créer une tâche rapidement
const t = (
  id: string, name: string, description: string,
  priority: number, category: string,
  createdDays: number, deadlineDays: number,
  completedDays: number | null,
  bookmarked = false, estimatedTime = 60,
  isCollaborative = false
): Task => ({
  id, name, description, priority, category,
  deadline: getDate(deadlineDays),
  estimatedTime,
  createdAt: getDate(createdDays),
  bookmarked,
  completed: completedDays !== null,
  completedAt: completedDays !== null ? getDate(completedDays) : undefined,
  isCollaborative,
  pendingInvites: [],
});

// 10 tâches — variété de statuts, priorités et catégories
// ⚠️ Les tâches auparavant rangées sous TRAVAIL (cat-1) sont réaffectées sur
// ses sous-catégories (cat-6 SEO, cat-7 Backlinks) : la hiérarchie doit se
// VOIR dans les données de démo, pas seulement dans l'arbre de gestion.
// Filtrer « Travail » remonte toujours ces tâches (descendants inclus).
export const DEMO_TASKS: Task[] = [
  // ── TRAVAIL / SEO (cat-6) ─────────────────────────────────────────────
  t('t002','Préparer présentation Q1 2026',   'Résultats 3 mois + projections',           5,'cat-6',-5,   3,  null, true, 90),

  // ── TRAVAIL / SEO / BACKLINKS (cat-7) ─────────────────────────────────
  t('t013','Envoyer facture client Dupont',   'Facture en retard, relance client',        4,'cat-7',-10,  -3, null, false, 30),

  // ── PROJETS (cat-5) ───────────────────────────────────────────────────
  t('t003','Audit sécurité Q1 2026',          'Pentest + correctifs CVE',                 5,'cat-5',-12,  5,  null),

  // ── APPRENTISSAGE (cat-4) ─────────────────────────────────────────────
  t('t005','Lire "Accelerate"',               'Forsgren, DevOps metrics DORA',           3,'cat-4',-28, -5,  -8, true, 360),

  // ── PERSONNEL (cat-2) ─────────────────────────────────────────────────
  t('t007','Préparer dossier crédit immo',    'Documents + simulation + banques',         5,'cat-2',-15,  10, null),
  t('t008','Chercher nouvel appartement',     'Critères + visites + budget max',          4,'cat-2',-2,   14, null, false, 120),

  // ── SANTÉ (cat-3) ─────────────────────────────────────────────────────
  t('t009','Rendez-vous médecin annuel 2026', 'Check-up + vaccins + renouvellements',     2,'cat-3',-5,   7,  null),
  t('t010','Programme stretching quotidien',  'Mobilité + récupération post-sport',       2,'cat-3',-2,   3,  null, false, 20),

  // ── TÂCHES ASSIGNÉES PAR D'AUTRES ─────────────────────────────────────
  { ...t('t011','Réviser le pitch deck',      'Intégrer les retours avant lundi',         4,'cat-5',-1,   3,  null, false, 60, true), sharedBy: 'Marie Dupont' },
  { ...t('t012','Tester le prototype mobile', 'Flow onboarding + feedback UX',            3,'cat-5',-2,   5,  null, false, 45, true),  sharedBy: 'Jean Martin'  },

  // ── TÂCHES PARTAGÉES (shared TO the demo user) ────────────────────────
  {
    id: 'shared-001',
    name: 'Réviser le rapport mensuel',
    description: 'Vérifier les chiffres et commenter',
    priority: 3,
    category: 'cat-6',
    deadline: getDate(5),
    estimatedTime: 45,
    createdAt: getDate(-1),
    bookmarked: false,
    completed: false,
    isCollaborative: true,
    pendingInvites: [],
    sharedBy: 'Marie Dupont',
  },
  {
    id: 'shared-002',
    name: 'Préparer la réunion de lancement',
    description: 'Agenda + présentation + invitations',
    priority: 2,
    category: 'cat-5',
    deadline: getDate(3),
    estimatedTime: 90,
    createdAt: getDate(-2),
    bookmarked: false,
    completed: false,
    isCollaborative: true,
    pendingInvites: [],
    sharedBy: 'Jean Martin',
  },
];

// Overlay anglais — cf. src/lib/seed-i18n.ts. `sharedBy` (nom de personne)
// n'est PAS traduit : un nom propre n'est pas une langue.
export const DEMO_TASKS_EN: Record<string, Partial<Task>> = {
  t002: { name: 'Prepare Q1 2026 presentation', description: '3-month results + projections' },
  t013: { name: 'Send invoice to Dupont client', description: 'Overdue invoice, follow up with client' },
  t003: { name: 'Q1 2026 security audit', description: 'Pentest + CVE fixes' },
  t005: { name: 'Read "Accelerate"', description: 'Forsgren, DORA DevOps metrics' },
  t007: { name: 'Prepare mortgage application', description: 'Documents + simulation + banks' },
  t008: { name: 'Look for a new apartment', description: 'Criteria + viewings + budget cap' },
  t009: { name: '2026 annual check-up', description: 'Check-up + vaccines + renewals' },
  t010: { name: 'Daily stretching routine', description: 'Mobility + post-workout recovery' },
  t011: { name: 'Review the pitch deck', description: 'Incorporate feedback before Monday' },
  t012: { name: 'Test the mobile prototype', description: 'Onboarding flow + UX feedback' },
  'shared-001': { name: 'Review the monthly report', description: 'Check figures and add comments' },
  'shared-002': { name: 'Prepare the kickoff meeting', description: 'Agenda + slides + invitations' },
};
