// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import { CalendarEvent } from './types';
import { isEnglishSeed, localizeSeed } from '@/lib/seed-i18n';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════════════════════

// Helper pour créer une date avec heure précise
const eventDate = (daysFromNow: number, h: number, m = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// Génère les réunions d'équipe hebdomadaires — 62 semaines passées (>14 mois)
const weeklyMeetings = (): CalendarEvent[] => {
  const en = isEnglishSeed();
  return Array.from({ length: 62 }, (_, i) => {
    const week = 62 - i;
    return {
      id: `event-mtg-${week}`,
      title: en ? 'Team meeting' : "Réunion d'équipe",
      start: eventDate(-week * 7, 10, 0),
      end:   eventDate(-week * 7, 11, 0),
      color: '#3B82F6',
      description: en ? 'Weekly sync with the team' : "Point hebdomadaire avec l'équipe",
    };
  });
};

// Génère les rétrospectives mensuelles — 14 mois passés
const monthlyRetros = (): CalendarEvent[] => {
  const en = isEnglishSeed();
  return Array.from({ length: 14 }, (_, i) => {
    const month = 14 - i;
    const d = new Date();
    d.setMonth(d.getMonth() - month);
    d.setDate(Math.min(28, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    d.setHours(14, 0, 0, 0);
    const e = new Date(d); e.setHours(16, 0, 0, 0);
    return {
      id: `event-retro-${month}`,
      title: en ? 'Monthly retrospective' : 'Rétrospective mensuelle',
      start: d.toISOString(),
      end: e.toISOString(),
      color: '#F97316',
      description: en ? 'Review of the month and planning ahead' : 'Bilan du mois et planification suivante',
    };
  });
};

// Génère les 1:1 manager bimensuels — 28 occurrences passées
const biweekly1on1 = (): CalendarEvent[] => {
  const en = isEnglishSeed();
  return Array.from({ length: 28 }, (_, i) => {
    const weeks = 28 - i;
    return {
      id: `event-1on1-${weeks}`,
      title: en ? '1:1 with manager' : '1:1 avec le manager',
      start: eventDate(-weeks * 14 + 2, 9, 0),
      end:   eventDate(-weeks * 14 + 2, 9, 30),
      color: '#10B981',
      description: en ? 'Individual check-in + feedback' : 'Point individuel + feedback',
    };
  });
};

// Événements ponctuels notables. `createdBy` renseigné (≠ propriétaire) sur
// quelques-uns pour démontrer la distinction perso / pro : un événement ajouté
// par un manager affiche son avatar dans l'agenda perso.
const ONE_TIME_EVENTS: CalendarEvent[] = [
  // Aujourd'hui — « Réunion d'équipe » ajoutée par un collaborateur (avatar visible).
  { id: 'event-1', title: "Réunion d'équipe",    start: eventDate(0, 10, 0),  end: eventDate(0, 11, 0),  color: '#3B82F6', description: "Point hebdomadaire", createdBy: 'friend-1' },
  { id: 'event-2', title: 'Déjeuner client',      start: eventDate(0, 12, 30), end: eventDate(0, 14, 0),  color: '#10B981', description: 'Restaurant Le Petit Bistrot' },
  { id: 'event-4', title: 'Sport',                start: eventDate(0, 18, 30), end: eventDate(0, 19, 30), color: '#EF4444', description: 'Séance de running' },
  // À venir
  { id: 'event-fut-2', title: 'Entretien candidat',   start: eventDate(8, 10, 0),  end: eventDate(8, 11, 0),  color: '#F97316', description: 'Poste développeur front-end' },
  // Conférences passées
  { id: 'event-conf-1', title: 'DevFest Paris 2025',  start: eventDate(-370, 9, 0), end: eventDate(-370, 18, 0), color: '#8B5CF6', description: 'Talk React architecture — 300 participants' },
  { id: 'event-conf-2', title: 'React Summit 2025',   start: eventDate(-310, 9, 0), end: eventDate(-310, 18, 0), color: '#3B82F6', description: 'Amsterdam — remote' },
  { id: 'event-conf-3', title: 'Paris Web 2025',      start: eventDate(-200, 9, 0), end: eventDate(-200, 18, 0), color: '#10B981', description: 'Conférence accessibilité + perf' },
  // Lancements produit
  { id: 'event-launch-1', title: '🚀 Lancement COSMO v1.0', start: eventDate(-212, 11, 0), end: eventDate(-212, 12, 30), color: '#10B981', description: 'Premier déploiement public — 67 beta users' },
  { id: 'event-launch-2', title: '🚀 Lancement COSMO v2.0', start: eventDate(-55, 11, 0),  end: eventDate(-55, 12, 30),  color: '#10B981', description: 'Nouvelles fonctionnalités majeures' },
  // Team buildings
  { id: 'event-tb-1', title: 'Team Building Q2 2025', start: eventDate(-340, 14, 0), end: eventDate(-340, 20, 0), color: '#EC4899', description: 'Escape room + dîner' },
  { id: 'event-tb-2', title: 'Team Building Q4 2025', start: eventDate(-136, 14, 0), end: eventDate(-136, 20, 0), color: '#EC4899', description: 'Karting + restaurant' },
  // Formations
  { id: 'event-train-1', title: 'Formation SQL avancé',       start: eventDate(-248, 9, 0),  end: eventDate(-247, 17, 0), color: '#F97316', description: 'Window functions + optimisation' },
  { id: 'event-train-2', title: 'Workshop Design Thinking',   start: eventDate(-142, 9, 0),  end: eventDate(-141, 17, 0), color: '#F97316', description: '2 jours avec l\'équipe produit' },
  { id: 'event-train-3', title: 'Formation Sécurité OWASP',   start: eventDate(-92, 9, 0),   end: eventDate(-91, 17, 0),  color: '#EF4444', description: 'Top 10 vulnérabilités web' },
  // Rendez-vous santé
  { id: 'event-health-1', title: 'Bilan médecin annuel',  start: eventDate(-380, 9, 30), end: eventDate(-380, 10, 15), color: '#EF4444', description: 'Check-up complet' },
  { id: 'event-health-2', title: 'Dentiste',              start: eventDate(-201, 14, 0), end: eventDate(-201, 14, 45), color: '#EF4444', description: 'Détartrage + contrôle' },
  { id: 'event-health-3', title: 'Bilan médecin annuel',  start: eventDate(-14, 9, 30),  end: eventDate(-14, 10, 15), color: '#EF4444', description: 'Check-up annuel 2026' },
  // Planning sessions importantes
  { id: 'event-plan-1', title: 'Définition OKRs 2026',       start: eventDate(-128, 10, 0), end: eventDate(-128, 12, 0), color: '#8B5CF6', description: 'Session stratégique annuelle' },
  { id: 'event-plan-2', title: 'Présentation investisseurs',  start: eventDate(-270, 10, 0), end: eventDate(-270, 11, 30),color: '#8B5CF6', description: 'Pitch + métriques croissance' },
];

// Overlay anglais des événements ponctuels — cf. src/lib/seed-i18n.ts.
// `createdBy` (id d'ami) n'a pas besoin de traduction.
const ONE_TIME_EVENTS_EN: Record<string, Partial<CalendarEvent>> = {
  'event-1': { title: 'Team meeting', description: 'Weekly sync' },
  'event-2': { title: 'Client lunch', description: 'Le Petit Bistrot restaurant' },
  'event-4': { title: 'Workout', description: 'Running session' },
  'event-fut-2': { title: 'Candidate interview', description: 'Front-end developer role' },
  'event-conf-1': { title: 'DevFest Paris 2025', description: 'React architecture talk — 300 attendees' },
  'event-conf-2': { title: 'React Summit 2025', description: 'Amsterdam — remote' },
  'event-conf-3': { title: 'Paris Web 2025', description: 'Accessibility + perf conference' },
  'event-launch-1': { title: '🚀 COSMO v1.0 launch', description: 'First public release — 67 beta users' },
  'event-launch-2': { title: '🚀 COSMO v2.0 launch', description: 'Major new features' },
  'event-tb-1': { title: 'Team building Q2 2025', description: 'Escape room + dinner' },
  'event-tb-2': { title: 'Team building Q4 2025', description: 'Karting + restaurant' },
  'event-train-1': { title: 'Advanced SQL training', description: 'Window functions + optimization' },
  'event-train-2': { title: 'Design Thinking workshop', description: '2 days with the product team' },
  'event-train-3': { title: 'OWASP security training', description: 'Top 10 web vulnerabilities' },
  'event-health-1': { title: 'Annual check-up', description: 'Full check-up' },
  'event-health-2': { title: 'Dentist', description: 'Cleaning + check-up' },
  'event-health-3': { title: 'Annual check-up', description: '2026 annual check-up' },
  'event-plan-1': { title: '2026 OKR planning', description: 'Annual strategy session' },
  'event-plan-2': { title: 'Investor presentation', description: 'Pitch + growth metrics' },
};

export const DEMO_EVENTS: CalendarEvent[] = [
  ...localizeSeed(ONE_TIME_EVENTS, ONE_TIME_EVENTS_EN),
  ...weeklyMeetings(),
  ...monthlyRetros(),
  ...biweekly1on1(),
];

// ═══════════════════════════════════════════════════════════════════
// DEMO — AGENDAS DES MEMBRES (mode entreprise)
// ═══════════════════════════════════════════════════════════════════
// Agenda propre à chaque subordonné, consultable par sa hiérarchie. Seed
// déterministe (pas de Math.random) pour que la démo du manager montre un
// vrai planning. Clé localStorage séparée de l'agenda personnel.


const memberEvent = (uid: string, n: number, day: number, h: number, dur: number, title: string, color: string): CalendarEvent => {
  const s = new Date(); s.setDate(s.getDate() + day); s.setHours(h, 0, 0, 0);
  const e = new Date(s); e.setMinutes(e.getMinutes() + dur);
  return { id: `member-${uid}-${n}`, title, start: s.toISOString(), end: e.toISOString(), color };
};

// Planning type par membre (ids = DEMO_MEMBERS du module organizations).
export const seedMemberEvents = (uid: string): CalendarEvent[] => [
  memberEvent(uid, 1, 0, 9, 30, 'Point équipe', '#3B82F6'),
  memberEvent(uid, 2, 0, 14, 90, 'Session de travail', '#8B5CF6'),
  memberEvent(uid, 3, 1, 11, 60, 'Revue de code', '#10B981'),
  memberEvent(uid, 4, 2, 10, 60, 'Atelier design', '#EC4899'),
  memberEvent(uid, 5, 3, 15, 45, '1:1 manager', '#F97316'),
  memberEvent(uid, 6, -2, 10, 60, 'Rétro sprint', '#EF4444'),
];

export const KNOWN_DEMO_MEMBER_IDS = [
  'friend-1', 'friend-2', 'friend-3', 'user-lucas', 'user-camille',
  'user-nina', 'user-theo', 'user-hugo',
  'user-manon', 'user-chloe', 'user-emma', 'user-ines', 'user-antoine',
  'user-paul', 'user-lea', 'user-karim', 'user-yanis',
];
