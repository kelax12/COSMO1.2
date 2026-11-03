// ═══════════════════════════════════════════════════════════════════
// Gabarit commun des e-mails de facturation (spec 2026-11-02 § 6.1).
// Module PUR, exécuté par vitest (`src/modules/billing/billing-mail-layout.test.ts`).
// ═══════════════════════════════════════════════════════════════════
//
// En-tête logo + « Cosmo » + « Entreprise », titre, accroche, encadré
// clé-valeur, bouton, lien secondaire, mentions légales, pied. AUCUNE icône.
// HTML en tableaux et styles en ligne : c'est ce que lisent Gmail et Outlook.
// Thème clair seul : la plupart des clients mail ignorent les jetons sombres.
//
// 🔴 SV-5 : toute valeur passe par `escapeHtml` (un nom d'organisation est
// écrit par n'importe quel admin). Un lien n'est émis que s'il est `https://`.

export interface BillingMail {
  subject: string
  text: string
  html: string
}

export interface MailLink {
  label: string
  url: string
}

export interface MailContent {
  subject: string
  title: string
  intro: string
  rows: Array<[string, string]>
  cta?: MailLink
  secondary?: MailLink
  /** Phrase courte sous le bouton (« Possible jusqu'au … »). */
  afterCta?: string
  /** Paragraphes légaux, rendus en petit sous un filet. */
  legal: string[]
  orgName: string
  appUrl: string
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

const safeLink = (l?: MailLink): MailLink | undefined => (l && l.url.startsWith('https://') ? l : undefined)

const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#18181b'
const MUTED = '#52525b'
const FAINT = '#71717a'
const LINE = '#e4e4e7'
const PANEL = '#f4f4f5'
const BRAND = '#4f46e5'

export function renderBillingMail(c: MailContent): BillingMail {
  const e = escapeHtml
  const cta = safeLink(c.cta)
  const secondary = safeLink(c.secondary)
  const footer = [
    "L'équipe COSMO · contact@thecosmo.app",
    `Vous recevez cet e-mail en tant que propriétaire de l'organisation « ${c.orgName} ».`,
  ]

  const text = [
    c.title,
    '',
    c.intro,
    '',
    ...c.rows.map(([k, v]) => `${k} : ${v}`),
    ...(cta || secondary || c.afterCta ? [''] : []),
    ...(cta ? [`${cta.label} : ${cta.url}`] : []),
    ...(secondary ? [`${secondary.label} : ${secondary.url}`] : []),
    ...(c.afterCta ? [c.afterCta] : []),
    '',
    ...c.legal.flatMap((l) => [l, '']),
    ...footer,
  ].join('\n')

  const rows = c.rows.length
    ? `<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border-radius:8px">${c.rows
        .map(
          ([k, v], i) =>
            `<tr><td style="padding:9px 14px;font-size:14px;color:${MUTED};${i ? `border-top:1px solid ${LINE};` : ''}">${e(k)}</td>`
            + `<td align="right" style="padding:9px 14px;font-size:14px;font-weight:600;color:${INK};${i ? `border-top:1px solid ${LINE};` : ''}">${e(v)}</td></tr>`,
        )
        .join('')}</table></td></tr>`
    : ''

  const actions = cta || secondary
    ? `<tr><td style="padding:20px 28px 0">${
        cta
          ? `<a style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px" href="${e(cta.url)}">${e(cta.label)}</a>`
          : ''
      }${
        secondary
          ? `<a style="${cta ? 'margin-left:14px;' : ''}font-size:13px;color:${BRAND};text-decoration:underline" href="${e(secondary.url)}">${e(secondary.label)}</a>`
          : ''
      }</td></tr>`
    : ''

  const after = c.afterCta
    ? `<tr><td style="padding:10px 28px 0;font-size:13px;color:${MUTED}">${e(c.afterCta)}</td></tr>`
    : ''

  const legal = c.legal.length
    ? `<tr><td style="padding:20px 28px 0"><div style="border-top:1px solid ${LINE};padding-top:14px;font-size:12px;line-height:1.6;color:${FAINT}">${c.legal
        .map((l) => `<p style="margin:0 0 8px">${e(l)}</p>`)
        .join('')}</div></td></tr>`
    : ''

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.subject)}</title></head>`
    + `<body style="margin:0;padding:0;background:${PANEL}">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL}"><tr><td align="center" style="padding:24px 12px">`
    + `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;${FONT};color:${INK}">`
    + `<tr><td style="padding:24px 28px 0">`
    + `<table role="presentation" cellpadding="0" cellspacing="0"><tr>`
    + `<td style="vertical-align:middle"><img src="${e(`${c.appUrl}/icon-192.png`)}" width="40" height="40" alt="Cosmo" style="display:block;border:0;border-radius:10px"></td>`
    + `<td style="vertical-align:middle;padding-left:10px;font-size:16px;font-weight:600">Cosmo</td>`
    + `<td style="vertical-align:middle;padding-left:8px"><span style="font-size:12px;color:${MUTED};border:1px solid ${LINE};border-radius:6px;padding:1px 8px">Entreprise</span></td>`
    + `</tr></table>`
    + `<h1 style="margin:20px 0 4px;font-size:22px;line-height:1.3;font-weight:600;color:${INK}">${e(c.title)}</h1>`
    + `<p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED}">${e(c.intro)}</p>`
    + `</td></tr>`
    + rows
    + actions
    + after
    + legal
    + `<tr><td style="padding:16px 28px 24px;font-size:12px;line-height:1.6;color:${FAINT}">${footer.map(e).join('<br>')}</td></tr>`
    + `</table></td></tr></table></body></html>`

  return { subject: c.subject, text, html }
}
