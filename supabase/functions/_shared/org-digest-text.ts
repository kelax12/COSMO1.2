// ═══════════════════════════════════════════════════════════════════
// Textes du courriel `org-digest`, dans la LANGUE et le FUSEAU réglés par
// l'organisation (mig. 195, audit entreprise du 2026-09-24 : « aucun réglage
// propre à l'organisation »). Module PUR : testé par vitest.
//
// Sans réglage (mig. 195 non appliquée, ou organisation qui n'a rien choisi) :
// français et Europe/Paris, exactement le courriel d'avant.
// ═══════════════════════════════════════════════════════════════════

export type DigestLocale = 'fr' | 'en'

const LABELS: Record<DigestLocale, Record<string, string>> = {
  fr: {
    task_assigned: 'Une tâche vous a été assignée',
    mention: 'Vous avez été mentionné',
    task_overdue: 'Une tâche est en retard',
    comment: 'Nouveau commentaire',
    status_changed: 'Changement de statut',
    unblocked: 'Une tâche n\'attend plus rien',
    project_at_risk: 'Projet signalé à risque',
    kr_due: 'Résultat clé bientôt à échéance',
    event_scheduled: 'Créneau ajouté à votre agenda',
    _default: 'Notification',
  },
  en: {
    task_assigned: 'A task was assigned to you',
    mention: 'You were mentioned',
    task_overdue: 'A task is overdue',
    comment: 'New comment',
    status_changed: 'Status changed',
    unblocked: 'A task is no longer waiting',
    project_at_risk: 'Project flagged at risk',
    kr_due: 'Key result due soon',
    event_scheduled: 'Slot added to your calendar',
    _default: 'Notification',
  },
}

export interface DigestRow {
  kind: string
  task_name: string | null
  project_name: string | null
  actor_name: string | null
  created_at: string
}

/** Heure de l'évènement, dans le fuseau de l'organisation. Fuseau invalide : Europe/Paris. */
export function digestTime(iso: string, locale: DigestLocale, timeZone: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { ...opts, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { ...opts, timeZone: 'Europe/Paris' }).format(new Date(iso))
  }
}

export function describeRow(r: DigestRow, locale: DigestLocale, timeZone: string): string {
  const labels = LABELS[locale]
  const label = labels[r.kind] ?? labels._default
  const subject = r.task_name ?? r.project_name
  const who = r.actor_name ? ` (${r.actor_name})` : ''
  const sep = locale === 'en' ? ': ' : ' : '
  return `${subject ? `${label}${sep}${subject}` : label}${who} · ${digestTime(r.created_at, locale, timeZone)}`
}

export function digestSubject(mode: 'hourly' | 'daily', orgName: string, count: number, firstLine: string, locale: DigestLocale): string {
  if (locale === 'en') return mode === 'daily' ? `Your ${orgName} summary: ${count} unread notification(s)` : `${orgName}: ${firstLine}`
  return mode === 'daily' ? `Votre résumé ${orgName} : ${count} notification(s) non lue(s)` : `${orgName} : ${firstLine}`
}

export const digestSeeAll = (locale: DigestLocale) => (locale === 'en' ? 'See everything' : 'Tout voir')
export const digestFooter = (locale: DigestLocale) => (locale === 'en'
  ? 'You receive this message because you chose it in the organisation notification preferences.'
  : 'Vous recevez ce message parce que vous l\'avez choisi dans les préférences de notification de l\'organisation.')
