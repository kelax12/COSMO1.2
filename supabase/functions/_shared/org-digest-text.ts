// ═══════════════════════════════════════════════════════════════════
// Textes du courriel `org-digest`, dans la LANGUE et le FUSEAU réglés par
// l'organisation (mig. 195, `hr` admis par la mig. 251). Module PUR : testé
// par vitest.
//
// Une table par locale (`TEXTS`) : ajouter une langue, c'est ajouter une
// entrée, jamais un `if`. Sans réglage, ou valeur inconnue : français et
// Europe/Paris, exactement le courriel d'avant.
// ═══════════════════════════════════════════════════════════════════

export const DIGEST_LOCALES = ['fr', 'en', 'hr'] as const
export type DigestLocale = (typeof DIGEST_LOCALES)[number]

/** Valeur lue en base (`org_settings.locale`) : toute valeur inconnue retombe sur `fr`. */
export function toDigestLocale(value: string | null | undefined): DigestLocale {
  return (DIGEST_LOCALES as readonly string[]).includes(value ?? '') ? (value as DigestLocale) : 'fr'
}

type PluralForm = 'one' | 'few' | 'other'

interface DigestTexts {
  intl: string
  /** Séparateur entre le libellé et l'objet (« : » insécable en français). */
  sep: string
  labels: Record<string, string>
  /** Sujet du résumé quotidien, accordé au nombre par `Intl.PluralRules`. */
  dailySubject: (orgName: string, count: number, form: PluralForm) => string
  seeAll: string
  footer: string
}

const TEXTS: Record<DigestLocale, DigestTexts> = {
  fr: {
    intl: 'fr-FR',
    sep: ' : ',
    labels: {
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
    dailySubject: (org, n) => `Votre résumé ${org} : ${n} notification(s) non lue(s)`,
    seeAll: 'Tout voir',
    footer: 'Vous recevez ce message parce que vous l\'avez choisi dans les préférences de notification de l\'organisation.',
  },
  en: {
    intl: 'en-GB',
    sep: ': ',
    labels: {
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
    dailySubject: (org, n) => `Your ${org} summary: ${n} unread notification(s)`,
    seeAll: 'See everything',
    footer: 'You receive this message because you chose it in the organisation notification preferences.',
  },
  hr: {
    intl: 'hr-HR',
    sep: ': ',
    labels: {
      task_assigned: 'Dodijeljen vam je zadatak',
      mention: 'Netko vas je spomenuo',
      task_overdue: 'Zadatak kasni',
      comment: 'Novi komentar',
      status_changed: 'Promjena statusa',
      unblocked: 'Zadatak više ništa ne čeka',
      project_at_risk: 'Projekt je označen kao rizičan',
      kr_due: 'Ključnom rezultatu uskoro ističe rok',
      event_scheduled: 'Termin je dodan u vaš kalendar',
      _default: 'Obavijest',
    },
    dailySubject: (org, n, form) => {
      const tail = {
        one: 'nepročitana obavijest',
        few: 'nepročitane obavijesti',
        other: 'nepročitanih obavijesti',
      }[form]
      return `Vaš sažetak za ${org}: ${n} ${tail}`
    },
    seeAll: 'Prikaži sve',
    footer: 'Ovu poruku primate jer ste je odabrali u postavkama obavijesti organizacije.',
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
  const intl = TEXTS[locale].intl
  try {
    return new Intl.DateTimeFormat(intl, { ...opts, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat(intl, { ...opts, timeZone: 'Europe/Paris' }).format(new Date(iso))
  }
}

export function describeRow(r: DigestRow, locale: DigestLocale, timeZone: string): string {
  const { labels, sep } = TEXTS[locale]
  const label = labels[r.kind] ?? labels._default
  const subject = r.task_name ?? r.project_name
  const who = r.actor_name ? ` (${r.actor_name})` : ''
  return `${subject ? `${label}${sep}${subject}` : label}${who} · ${digestTime(r.created_at, locale, timeZone)}`
}

function pluralForm(locale: DigestLocale, count: number): PluralForm {
  const f = new Intl.PluralRules(TEXTS[locale].intl).select(count)
  return f === 'one' || f === 'few' ? f : 'other'
}

export function digestSubject(mode: 'hourly' | 'daily', orgName: string, count: number, firstLine: string, locale: DigestLocale): string {
  const t = TEXTS[locale]
  return mode === 'daily' ? t.dailySubject(orgName, count, pluralForm(locale, count)) : `${orgName}${t.sep}${firstLine}`
}

export const digestSeeAll = (locale: DigestLocale) => TEXTS[locale].seeAll
export const digestFooter = (locale: DigestLocale) => TEXTS[locale].footer
