// Créneaux communs d'un groupe (reco UI n° 30) — fonction pure.
//
// Entrée : les événements DÉJÀ ÉTENDUS (récurrences dépliées) de chaque
// participant. Sortie : les premiers créneaux de `durationMin` où personne
// n'est occupé, en heures ouvrées, jours de semaine seulement.
//
// ⚠️ Un événement PRIVÉ d'un subordonné n'est pas lisible (RLS mig. 081) : il
// n'apparaît pas ici. L'écran le dit plutôt que de promettre un créneau sûr.

export interface Busy { start: Date; end: Date }

export interface SlotOptions {
  from: Date;
  days: number;
  durationMin: number;
  /** Heures ouvrées locales [dayStartHour, dayEndHour[. */
  dayStartHour?: number;
  dayEndHour?: number;
  stepMin?: number;
  limit?: number;
}

export interface Slot { start: Date; end: Date }

const MIN = 60_000;

export function findCommonSlots(busyByPerson: Busy[][], opts: SlotOptions): Slot[] {
  const {
    from, days, durationMin, dayStartHour = 9, dayEndHour = 18, stepMin = 30, limit = 5,
  } = opts;
  const busy = busyByPerson.flat().filter((b) => b.end > b.start);
  const out: Slot[] = [];

  // Premier pas aligné sur la grille, jamais dans le passé.
  const first = new Date(from);
  first.setSeconds(0, 0);
  const rem = first.getMinutes() % stepMin;
  if (rem) first.setMinutes(first.getMinutes() + (stepMin - rem));

  for (let d = 0; d < days && out.length < limit; d++) {
    const day = new Date(from);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    const open = new Date(day); open.setHours(dayStartHour, 0, 0, 0);
    const close = new Date(day); close.setHours(dayEndHour, 0, 0, 0);
    let cursor = new Date(Math.max(first.getTime(), open.getTime()));

    while (cursor.getTime() + durationMin * MIN <= close.getTime() && out.length < limit) {
      const end = new Date(cursor.getTime() + durationMin * MIN);
      const clash = busy.find((b) => b.start < end && b.end > cursor);
      if (!clash) {
        out.push({ start: new Date(cursor), end });
        // Un créneau par demi-journée au plus : cinq propositions le même
        // matin ne laissent aucun choix réel.
        const noon = new Date(day); noon.setHours(13, 0, 0, 0);
        cursor = cursor < noon ? noon : close;
        continue;
      }
      // Saute directement après l'occupation, recalé sur la grille.
      const next = new Date(Math.max(clash.end.getTime(), cursor.getTime() + stepMin * MIN));
      const r = next.getMinutes() % stepMin;
      if (r) next.setMinutes(next.getMinutes() + (stepMin - r), 0, 0);
      cursor = next;
    }
  }
  return out;
}

// ─── Occupations d'un agenda (récurrences dépliées) ───────────────────
//
// Volontairement PAS `expandRecurringEvents` (modules/events/recurrence) :
// l'importer depuis ce seul écran sortait `recurrence` en lot partagé, et
// chaque lot de plus s'ajoute aux préchargements de `OrganizationPage`, qui
// est à son plafond (mesuré le 2026-09-29). Ici on ne veut que des
// intervalles, pas des événements à afficher : quinze lignes suffisent.

export interface BusySource {
  start: string;
  end: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'custom';
  recurrenceDays?: number[];
  exceptions?: string[];
}

const DAY = 86_400_000;

export function busyFromEvents(events: BusySource[], from: Date, to: Date): Busy[] {
  const out: Busy[] = [];
  for (const ev of events) {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const kind = ev.recurrence ?? 'none';
    if (kind === 'none' || (kind === 'custom' && !ev.recurrenceDays?.length)) {
      if (end > from && start < to) out.push({ start, end });
      continue;
    }
    const duration = end.getTime() - start.getTime();
    const step = kind === 'weekly' ? 7 : 1;
    const cursor = new Date(start);
    // Saut direct près de `from` (un pas entier), puis marche jour par jour.
    const behind = Math.floor((from.getTime() - duration - cursor.getTime()) / (DAY * step));
    if (behind > 0) cursor.setDate(cursor.getDate() + behind * step);
    for (let guard = 0; cursor < to && guard < 400; guard++) {
      const s = new Date(cursor);
      const e = new Date(s.getTime() + duration);
      const key = s.toISOString().split('T')[0];
      const dayOk = kind !== 'custom' || ev.recurrenceDays!.includes(s.getDay());
      if (dayOk && e > from && !ev.exceptions?.includes(key)) out.push({ start: s, end: e });
      cursor.setDate(cursor.getDate() + step);
    }
  }
  return out;
}
