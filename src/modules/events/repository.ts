// ═══════════════════════════════════════════════════════════════════
// EVENTS MODULE - Repository Pattern Implementation
// ═══════════════════════════════════════════════════════════════════

import { CalendarEvent, CreateEventInput, UpdateEventInput, EventFilters } from './types';
import { EVENTS_STORAGE_KEY } from './constants';
import { PaginationParams, PaginatedResult, DEFAULT_PAGE_SIZE } from '@/lib/pagination.types';
import { selectEventsInWindow } from './window';

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
const weeklyMeetings = (): CalendarEvent[] =>
  Array.from({ length: 62 }, (_, i) => {
    const week = 62 - i;
    return {
      id: `event-mtg-${week}`,
      title: "Réunion d'équipe",
      start: eventDate(-week * 7, 10, 0),
      end:   eventDate(-week * 7, 11, 0),
      color: '#3B82F6',
      description: "Point hebdomadaire avec l'équipe",
    };
  });

// Génère les rétrospectives mensuelles — 14 mois passés
const monthlyRetros = (): CalendarEvent[] =>
  Array.from({ length: 14 }, (_, i) => {
    const month = 14 - i;
    const d = new Date();
    d.setMonth(d.getMonth() - month);
    d.setDate(Math.min(28, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    d.setHours(14, 0, 0, 0);
    const e = new Date(d); e.setHours(16, 0, 0, 0);
    return {
      id: `event-retro-${month}`,
      title: 'Rétrospective mensuelle',
      start: d.toISOString(),
      end: e.toISOString(),
      color: '#F97316',
      description: 'Bilan du mois et planification suivante',
    };
  });

// Génère les 1:1 manager bimensuels — 28 occurrences passées
const biweekly1on1 = (): CalendarEvent[] =>
  Array.from({ length: 28 }, (_, i) => {
    const weeks = 28 - i;
    return {
      id: `event-1on1-${weeks}`,
      title: '1:1 avec le manager',
      start: eventDate(-weeks * 14 + 2, 9, 0),
      end:   eventDate(-weeks * 14 + 2, 9, 30),
      color: '#10B981',
      description: 'Point individuel + feedback',
    };
  });

// Événements ponctuels notables
const ONE_TIME_EVENTS: CalendarEvent[] = [
  // Aujourd'hui
  { id: 'event-1', title: "Réunion d'équipe",    start: eventDate(0, 10, 0),  end: eventDate(0, 11, 0),  color: '#3B82F6', description: "Point hebdomadaire" },
  { id: 'event-2', title: 'Déjeuner client',      start: eventDate(0, 12, 30), end: eventDate(0, 14, 0),  color: '#10B981', description: 'Restaurant Le Petit Bistrot' },
  { id: 'event-3', title: 'Formation React',      start: eventDate(0, 15, 0),  end: eventDate(0, 17, 0),  color: '#8B5CF6', description: 'Module avancé sur les hooks' },
  { id: 'event-4', title: 'Sport',                start: eventDate(0, 18, 30), end: eventDate(0, 19, 30), color: '#EF4444', description: 'Séance de running' },
  // À venir
  { id: 'event-fut-1', title: 'Sprint Review Q2',     start: eventDate(5, 14, 0),  end: eventDate(5, 16, 0),  color: '#8B5CF6', description: 'Démo des fonctionnalités du sprint' },
  { id: 'event-fut-2', title: 'Entretien candidat',   start: eventDate(8, 10, 0),  end: eventDate(8, 11, 0),  color: '#F97316', description: 'Poste développeur front-end' },
  { id: 'event-fut-3', title: 'DevFest 2026',          start: eventDate(18, 9, 0),  end: eventDate(19, 18, 0), color: '#EF4444', description: 'Conférence tech — talk React' },
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
  { id: 'event-train-4', title: 'Formation Leadership',       start: eventDate(-197, 9, 0),  end: eventDate(-196, 17, 0), color: '#F97316', description: 'Communication et gestion d\'équipe' },
  // Rendez-vous santé
  { id: 'event-health-1', title: 'Bilan médecin annuel',  start: eventDate(-380, 9, 30), end: eventDate(-380, 10, 15), color: '#EF4444', description: 'Check-up complet' },
  { id: 'event-health-2', title: 'Dentiste',              start: eventDate(-201, 14, 0), end: eventDate(-201, 14, 45), color: '#EF4444', description: 'Détartrage + contrôle' },
  { id: 'event-health-3', title: 'Bilan médecin annuel',  start: eventDate(-14, 9, 30),  end: eventDate(-14, 10, 15), color: '#EF4444', description: 'Check-up annuel 2026' },
  // Planning sessions importantes
  { id: 'event-plan-1', title: 'Définition OKRs 2026',       start: eventDate(-128, 10, 0), end: eventDate(-128, 12, 0), color: '#8B5CF6', description: 'Session stratégique annuelle' },
  { id: 'event-plan-2', title: 'Présentation investisseurs',  start: eventDate(-270, 10, 0), end: eventDate(-270, 11, 30),color: '#8B5CF6', description: 'Pitch + métriques croissance' },
  { id: 'event-plan-3', title: 'Kickoff projet COSMO',        start: eventDate(-427, 9, 0),  end: eventDate(-427, 17, 0), color: '#8B5CF6', description: 'Lancement officiel du projet' },
];

const DEMO_EVENTS: CalendarEvent[] = [
  ...ONE_TIME_EVENTS,
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
const MEMBER_EVENTS_STORAGE_KEY = 'cosmo_demo_member_events';

const memberEvent = (uid: string, n: number, day: number, h: number, dur: number, title: string, color: string): CalendarEvent => {
  const s = new Date(); s.setDate(s.getDate() + day); s.setHours(h, 0, 0, 0);
  const e = new Date(s); e.setMinutes(e.getMinutes() + dur);
  return { id: `member-${uid}-${n}`, title, start: s.toISOString(), end: e.toISOString(), color };
};

// Planning type par membre (ids = DEMO_MEMBERS du module organizations).
const seedMemberEvents = (uid: string): CalendarEvent[] => [
  memberEvent(uid, 1, 0, 9, 30, 'Point équipe', '#3B82F6'),
  memberEvent(uid, 2, 0, 14, 90, 'Session de travail', '#8B5CF6'),
  memberEvent(uid, 3, 1, 11, 60, 'Revue de code', '#10B981'),
  memberEvent(uid, 4, 2, 10, 60, 'Atelier design', '#EC4899'),
  memberEvent(uid, 5, 3, 15, 45, '1:1 manager', '#F97316'),
  memberEvent(uid, 6, -2, 10, 60, 'Rétro sprint', '#EF4444'),
];

const KNOWN_DEMO_MEMBER_IDS = [
  'friend-1', 'friend-2', 'friend-3', 'user-lucas', 'user-camille',
  'user-nina', 'user-theo', 'user-hugo',
];

// ═══════════════════════════════════════════════════════════════════
// REPOSITORY INTERFACE
// ═══════════════════════════════════════════════════════════════════

export interface IEventsRepository {
  // Read operations
  getAll(): Promise<CalendarEvent[]>;
  getById(id: string): Promise<CalendarEvent | null>;
  getByTaskId(taskId: string): Promise<CalendarEvent[]>;
  getFiltered(filters: EventFilters): Promise<CalendarEvent[]>;
  getPage(params?: PaginationParams): Promise<PaginatedResult<CalendarEvent>>;
  /** Événements de la fenêtre [startISO, endISO] + TOUS les récurrents (cf. window.ts). */
  getWindow(startISO: string, endISO: string): Promise<CalendarEvent[]>;
  /**
   * Agenda d'un AUTRE membre (mode entreprise) : réservé à sa hiérarchie
   * (RLS `events_manager_select`, mig. 077). Même sémantique que getWindow.
   */
  getWindowForUser(userId: string, startISO: string, endISO: string): Promise<CalendarEvent[]>;

  // Write operations
  create(input: CreateEventInput): Promise<CalendarEvent>;
  /** Crée un événement DANS l'agenda d'un subordonné (manager — RLS mig. 077). */
  createForUser(userId: string, input: CreateEventInput): Promise<CalendarEvent>;
  update(id: string, updates: UpdateEventInput): Promise<CalendarEvent>;
  delete(id: string): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════
// LOCAL STORAGE REPOSITORY IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class LocalStorageEventsRepository implements IEventsRepository {
  /**
   * Get all events from localStorage (or initialize with demo data)
   */
  private getEvents(): CalendarEvent[] {
    const data = localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!data) {
      this.saveEvents(DEMO_EVENTS);
      return DEMO_EVENTS;
    }
    return JSON.parse(data);
  }

  /**
   * Save events to localStorage
   */
  private saveEvents(events: CalendarEvent[]): void {
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async getAll(): Promise<CalendarEvent[]> {
    return this.getEvents();
  }

  async getById(id: string): Promise<CalendarEvent | null> {
    const events = this.getEvents();
    return events.find(e => e.id === id) || null;
  }

  async getByTaskId(taskId: string): Promise<CalendarEvent[]> {
    const events = this.getEvents();
    return events.filter(e => e.taskId === taskId);
  }

  async getWindow(startISO: string, endISO: string): Promise<CalendarEvent[]> {
    return selectEventsInWindow(this.getEvents(), startISO, endISO);
  }

  // ── Agendas des membres (mode entreprise démo) ─────────────────────
  private getMemberStore(): Record<string, CalendarEvent[]> {
    const raw = localStorage.getItem(MEMBER_EVENTS_STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveMemberStore(store: Record<string, CalendarEvent[]>): void {
    localStorage.setItem(MEMBER_EVENTS_STORAGE_KEY, JSON.stringify(store));
  }

  /** Agenda d'un membre (seedé à la première lecture pour les subordonnés démo connus). */
  private getMemberEvents(userId: string): CalendarEvent[] {
    const store = this.getMemberStore();
    if (store[userId]) return store[userId];
    const seeded = KNOWN_DEMO_MEMBER_IDS.includes(userId) ? seedMemberEvents(userId) : [];
    store[userId] = seeded;
    this.saveMemberStore(store);
    return seeded;
  }

  async getWindowForUser(userId: string, startISO: string, endISO: string): Promise<CalendarEvent[]> {
    return selectEventsInWindow(this.getMemberEvents(userId), startISO, endISO);
  }

  async createForUser(userId: string, input: CreateEventInput): Promise<CalendarEvent> {
    const store = this.getMemberStore();
    const list = store[userId] ?? this.getMemberEvents(userId);
    const newEvent: CalendarEvent = { ...input, id: crypto.randomUUID() };
    store[userId] = [...list, newEvent];
    this.saveMemberStore(store);
    return newEvent;
  }

  async getFiltered(filters: EventFilters): Promise<CalendarEvent[]> {
    let events = this.getEvents();

    if (filters.taskId) {
      events = events.filter(e => e.taskId === filters.taskId);
    }

    if (filters.startAfter) {
      events = events.filter(e => e.start >= filters.startAfter!);
    }

    if (filters.startBefore) {
      events = events.filter(e => e.start <= filters.startBefore!);
    }

    if (filters.endAfter) {
      events = events.filter(e => e.end >= filters.endAfter!);
    }

    if (filters.endBefore) {
      events = events.filter(e => e.end <= filters.endBefore!);
    }

    return events;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WRITE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  async create(input: CreateEventInput): Promise<CalendarEvent> {
    const events = this.getEvents();
    const newEvent: CalendarEvent = {
      ...input,
      id: crypto.randomUUID(),
    };
    this.saveEvents([...events, newEvent]);
    return newEvent;
  }

  async update(id: string, updates: UpdateEventInput): Promise<CalendarEvent> {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);

    if (index === -1) {
      // Peut-être un événement d'un membre géré (mode entreprise démo).
      return this.updateMemberEvent(id, updates);
    }

    const updatedEvent: CalendarEvent = { ...events[index], ...updates };
    events[index] = updatedEvent;
    this.saveEvents(events);
    return updatedEvent;
  }

  private updateMemberEvent(id: string, updates: UpdateEventInput): CalendarEvent {
    const store = this.getMemberStore();
    for (const uid of Object.keys(store)) {
      const idx = store[uid].findIndex(e => e.id === id);
      if (idx !== -1) {
        const updated: CalendarEvent = { ...store[uid][idx], ...updates };
        store[uid][idx] = updated;
        this.saveMemberStore(store);
        return updated;
      }
    }
    throw new Error(`Event with id ${id} not found`);
  }

  async delete(id: string): Promise<void> {
    const events = this.getEvents();
    const filtered = events.filter(e => e.id !== id);

    if (filtered.length === events.length) {
      // Peut-être un événement d'un membre géré (mode entreprise démo).
      const store = this.getMemberStore();
      for (const uid of Object.keys(store)) {
        const next = store[uid].filter(e => e.id !== id);
        if (next.length !== store[uid].length) {
          store[uid] = next;
          this.saveMemberStore(store);
          return;
        }
      }
      throw new Error(`Event with id ${id} not found`);
    }

    this.saveEvents(filtered);
  }

  async getPage(params: PaginationParams = {}): Promise<PaginatedResult<CalendarEvent>> {
    const events = this.getEvents();
    const limit = params.limit ?? DEFAULT_PAGE_SIZE;
    let startIndex = 0;
    if (params.cursor) {
      const cursorIndex = events.findIndex(e => e.id === params.cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }
    const slice = events.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    const items = hasMore ? slice.slice(0, limit) : slice;
    return {
      data: items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      nextCursorDate: null,
    };
  }
}
