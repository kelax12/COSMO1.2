> ⚠️ **ARCHIVE — instantané daté du 2026-11-02, non maintenu.**
> Ce document décrit un plan ou une conception **à cette date**. La fonctionnalité est livrée : le code fait foi.
> Sources vivantes : [`CLAUDE.md`](../../../../CLAUDE.md) · [`docs/MODULES.md`](../../../MODULES.md) · [`faille.md`](../../../../faille.md).

# Facturation entreprise, lot 2 : gabarit et e-mails · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer le lot 2 de la spec
[`2026-11-02-facturation-experience-design.md`](../specs/2026-11-02-facturation-experience-design.md)
(§ 6.1, § 6.2) : un gabarit HTML commun aux e-mails de facturation (logo Cosmo, aucune icône),
l'e-mail de bienvenue qui remplace la confirmation de commande, la suppression du reçu en double à
la souscription, et l'habillage des autres e-mails (reçu, résiliation, rétractation,
remboursement, rappel annuel). L'alerte 80 % des sièges est le lot 3.

**Architecture :** un module pur `_shared/billing-mail-layout.ts` rend `{ subject, text, html }`
à partir d'un contenu structuré (titre, accroche, lignes clé-valeur, bouton, lien secondaire,
paragraphes légaux). Les fonctions de `_shared/billing-mail-text.ts` et
`_shared/renewal-notice-text.ts` gardent leur signature (sauf la bienvenue, qui reçoit trois
données de plus) et construisent ce contenu. Tout reste testé par Vitest, qui importe déjà ces
modules Deno purs. Le webhook ne change qu'à deux endroits.

**Tech :** Edge Functions Deno (`npm:stripe@14.21.0`), envoi Resend existant
(`_shared/billing-mail.ts`, inchangé), Vitest.

---

## Règles à tenir pendant tout le plan

- **Le fond légal ne bouge pas.** Chaque phrase légale d'un e-mail actuel reste présente (accents
  rétablis, ponctuation corrigée, mots identiques). Les tests existants de
  `src/modules/billing/billing-mail-text.test.ts` et `src/edge-audit-serveur.guard.test.ts` en
  sont la preuve : on adapte leurs chaînes aux accents, on ne retire aucune assertion.
- **SV-5 :** toute valeur insérée dans le HTML passe par `escapeHtml`. Un lien n'est émis que s'il
  commence par `https://`.
- **Aucune icône** dans les e-mails. Logo : `${appUrl}/icon-192.png` affiché en 40 × 40
  (`public/icon-192.png` est le logo actuel, net sur écran haute densité). ❌ Jamais de SVG ni de
  webp dans un e-mail.
- ❌ Aucun « — » dans un texte. Accents français rétablis partout (UTF-8 de bout en bout).
- ❌ Ne jamais lever depuis un envoi d'e-mail (règle de `billing-mail.ts`, inchangé).
- **Pas de déploiement** dans ce plan. Les Edge Functions modifiées sont déployées à la fin, sur
  accord explicite d'Axel (Stripe est en live), et `npm run check:edge` mesure la dérive.
- Checkout partagé : chaque commit nomme ses fichiers (`git commit -m "…" -- <chemins>`). Une autre
  session peut modifier `supabase/functions/stripe-org-checkout/index.ts` et
  `src/modules/billing/org-billing.mutations.ts` : ne pas y toucher.
- ❌ Jamais `--maxWorkers`. Lire `$?` après chaque commande.

## Écarts assumés par rapport à la spec § 6

- Logo servi par `icon-192.png` (existant) plutôt qu'un nouveau `email/logo-80.png` : même dessin,
  aucun outil d'image dans le dépôt pour en produire un autre.
- Objet de la bienvenue sans le nom de l'organisation (« Votre abonnement COSMO Entreprise est
  actif ») : un nom écrit par un admin n'a rien à faire dans un en-tête de message.

## Fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `supabase/functions/_shared/billing-mail-layout.ts` | créer | gabarit pur : `renderBillingMail`, `escapeHtml`, type `BillingMail` |
| `src/modules/billing/billing-mail-layout.test.ts` | créer | |
| `supabase/functions/_shared/billing-mail-text.ts` | modifier | six e-mails sur le gabarit, bienvenue enrichie |
| `src/modules/billing/billing-mail-text.test.ts` | modifier | accents, nouvelles données |
| `supabase/functions/_shared/renewal-notice-text.ts` | modifier | rappel annuel sur le gabarit |
| `src/edge-audit-serveur.guard.test.ts` | vérifier | SV-5 doit rester vert sans changement |
| `supabase/functions/stripe-webhook/index.ts` | modifier | données de la bienvenue, reçu de souscription supprimé |
| `src/billing-welcome-mail.guard.test.ts` | créer | garde de source sur le webhook |
| `src/modules/billing/billing-mail.preview.test.ts` | créer | écrit les HTML pour l'œil, seulement si `MAIL_PREVIEW_DIR` est posé |

---

### Task 1 : gabarit commun

**Files :**
- Create : `supabase/functions/_shared/billing-mail-layout.ts`
- Test : `src/modules/billing/billing-mail-layout.test.ts`

- [ ] **Step 1 : écrire le test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { renderBillingMail } from '../../../supabase/functions/_shared/billing-mail-layout';

const base = {
  subject: 'Objet',
  title: 'Votre abonnement est actif',
  intro: 'Merci.',
  rows: [['Palier', '5 à 10 membres'], ['Montant', '70,00 € TTC / mois']] as Array<[string, string]>,
  legal: ['Droit de rétractation : 14 jours.'],
  orgName: 'Acme',
  appUrl: 'https://thecosmo.app',
};

describe('renderBillingMail', () => {
  it('en-tête : le logo Cosmo en PNG, aucune icône, aucun SVG', () => {
    const m = renderBillingMail(base);
    expect(m.html).toContain('src="https://thecosmo.app/icon-192.png"');
    expect(m.html).toContain('alt="Cosmo"');
    expect(m.html).not.toMatch(/<svg|\.webp/i);
  });

  it('SV-5 : le nom d organisation et les valeurs sont échappés', () => {
    const m = renderBillingMail({ ...base, orgName: 'Acme <a href="https://x.test">ici</a>', rows: [['Palier', '<b>x</b>']] });
    expect(m.html).not.toContain('<a href="https://x.test">');
    expect(m.html).toContain('&lt;a href=&quot;https://x.test&quot;&gt;');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('un lien non https n est jamais émis, ni en HTML ni en texte', () => {
    const m = renderBillingMail({
      ...base,
      cta: { label: 'Payer', url: 'javascript:alert(1)' },
      secondary: { label: 'Facture', url: 'http://x.test/f' },
    });
    expect(m.html).not.toContain('javascript:');
    expect(m.html).not.toContain('http://x.test');
    expect(m.text).not.toContain('javascript:');
  });

  it('bouton et lien secondaire https rendus, et repris dans la partie texte', () => {
    const m = renderBillingMail({
      ...base,
      cta: { label: 'Inviter des membres', url: 'https://thecosmo.app/entreprise/members' },
      secondary: { label: 'Télécharger la facture', url: 'https://invoice.stripe.com/i/x' },
    });
    expect(m.html).toContain('href="https://thecosmo.app/entreprise/members"');
    expect(m.html).toContain('href="https://invoice.stripe.com/i/x"');
    expect(m.text).toContain('Inviter des membres : https://thecosmo.app/entreprise/members');
    expect(m.text).toContain('Télécharger la facture : https://invoice.stripe.com/i/x');
  });

  it('la partie texte porte titre, lignes, mentions légales et pied', () => {
    const m = renderBillingMail(base);
    expect(m.text).toContain('Votre abonnement est actif');
    expect(m.text).toContain('Palier : 5 à 10 membres');
    expect(m.text).toContain('Droit de rétractation : 14 jours.');
    expect(m.text).toContain('contact@thecosmo.app');
    expect(m.text).toContain('« Acme »');
  });

  it('aucun « — » dans le rendu', () => {
    const m = renderBillingMail(base);
    expect(m.html + m.text).not.toContain('—');
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/modules/billing/billing-mail-layout.test.ts ; echo "exit=$?"`
Expected : FAIL (module introuvable), `exit=1`.

- [ ] **Step 3 : implémenter**

```ts
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
          ? `<a href="${e(cta.url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px">${e(cta.label)}</a>`
          : ''
      }${
        secondary
          ? `<a href="${e(secondary.url)}" style="${cta ? 'margin-left:14px;' : ''}font-size:13px;color:${BRAND};text-decoration:underline">${e(secondary.label)}</a>`
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
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/modules/billing/billing-mail-layout.test.ts ; echo "exit=$?"`
Expected : 6 PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add supabase/functions/_shared/billing-mail-layout.ts src/modules/billing/billing-mail-layout.test.ts
git commit -m "feat(billing): gabarit commun des e-mails de facturation, logo Cosmo sans icone" -- supabase/functions/_shared/billing-mail-layout.ts src/modules/billing/billing-mail-layout.test.ts
```

---

### Task 2 : les e-mails de facturation sur le gabarit

**Files :**
- Modify : `supabase/functions/_shared/billing-mail-text.ts`
- Test : `src/modules/billing/billing-mail-text.test.ts`

- [ ] **Step 1 : adapter et compléter les tests**

Dans `billing-mail-text.test.ts` :

1. Les chaînes sans accents des assertions existantes prennent leurs accents :
   `'acces immediat'` → `'accès immédiat'`, `'integralement'` → `'intégralement'`, et toute autre
   chaîne du fichier écrite sans accent qui ne correspond plus. Ne retirer **aucune** assertion.
2. Les appels à `subscriptionConfirmationMail` reçoivent les nouveaux champs :
   `tierKey: 't10', paidAt: Date.parse('2026-11-02T10:00:00Z') / 1000, nextDueAt: Date.parse('2026-12-02T10:00:00Z') / 1000, invoiceUrl: null`.
3. Ajouter :

```ts
describe('e-mails sur le gabarit commun', () => {
  const APP = 'https://thecosmo.app';

  it('bienvenue : encadré, bouton vers les membres, lien de facture https seul', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme', amountCents: 7000, interval: 'monthly', tierKey: 't10',
      paidAt: Date.parse('2026-11-02T10:00:00Z') / 1000, nextDueAt: Date.parse('2026-12-02T10:00:00Z') / 1000,
      immediateAccessAt: '2026-11-02T10:00:00Z', withdrawalDeadline: Date.parse('2026-11-16T10:00:00Z') / 1000,
      invoiceUrl: 'https://invoice.stripe.com/i/abc', appUrl: APP,
    });
    expect(m.subject).toBe('Votre abonnement COSMO Entreprise est actif');
    expect(m.text).toContain('Palier : 5 à 10 membres');
    expect(m.text).toContain('Montant : 70,00 € TTC / mois');
    expect(m.text).toContain('Prochaine échéance : 02/12/2026');
    expect(m.html).toContain('href="https://thecosmo.app/entreprise/members"');
    expect(m.html).toContain('href="https://invoice.stripe.com/i/abc"');
    // La date limite reste dans le paragraphe légal, pas dans l'encadré.
    expect(m.text).not.toMatch(/Changer d.avis :/);
    expect(m.text).toContain('16/11/2026');
  });

  it('bienvenue : une facture non https est ignorée', () => {
    const m = subscriptionConfirmationMail({
      orgName: 'Acme', amountCents: 7000, interval: 'yearly', tierKey: 't10', paidAt: 0, nextDueAt: null,
      immediateAccessAt: null, withdrawalDeadline: 0, invoiceUrl: 'javascript:alert(1)', appUrl: APP,
    });
    expect(m.html).not.toContain('javascript:');
    expect(m.text).toContain('Montant : 70,00 € TTC / an');
  });

  it('résiliation : fin d accès, aucun prélèvement, reprise possible, aucun remboursement', () => {
    const m = cancellationMail({ orgName: 'Acme', accessUntil: '2026-12-02T00:00:00Z', appUrl: APP });
    expect(m.text).toContain('Fin d’accès : 02/12/2026');
    expect(m.html).toContain('href="https://thecosmo.app/entreprise/billing"');
    expect(m.text).toContain('Aucun remboursement');
  });

  it('chaque e-mail porte le logo et le nom d organisation échappé', () => {
    const evil = 'Acme <img src=x onerror=alert(1)>';
    for (const m of [
      receiptMail({ orgName: evil, amountCents: 7000, paidAt: 0, appUrl: APP, invoiceUrl: null }),
      cancellationMail({ orgName: evil, accessUntil: '2026-12-02T00:00:00Z', appUrl: APP }),
      withdrawalAckMail({ orgName: evil, withdrawnAt: '2026-11-03T10:00:00Z', amountCents: 1933 }),
      refundDoneMail({ orgName: evil, amountCents: 1933, refundedAt: '2026-11-04T10:00:00Z' }),
    ]) {
      expect(m.html).toContain('alt="Cosmo"');
      expect(m.html).not.toContain('<img src=x');
    }
  });
});
```

(Ajouter `refundDoneMail` à l'import du fichier.)

Run : `npx vitest run src/modules/billing/billing-mail-text.test.ts ; echo "exit=$?"`
Expected : FAIL, `exit=1`.

- [ ] **Step 2 : réécrire `billing-mail-text.ts`**

Garder `CGV_VERSION`, `euros`, `frDate`, `frDateTime` tels quels. Remplacer le reste :

```ts
import { renderBillingMail, type BillingMail } from './billing-mail-layout.ts'
import { tierByKey } from './org-tiers.ts'

export type { BillingMail } from './billing-mail-layout.ts'

/** Les URLs que les e-mails ouvrent. `?tab=billing` reste redirigé pour les e-mails déjà partis. */
const billingUrl = (appUrl: string) => `${appUrl}/entreprise/billing`
const membersUrl = (appUrl: string) => `${appUrl}/entreprise/members`

/** Le palier comme l'écran l'écrit : l'effectif, ou « Illimité ». */
function tierLabel(key: string | null): string | null {
  const tier = key ? tierByKey(key) : undefined
  if (!tier) return null
  return tier.maxMembers === null ? 'Illimité' : `${tier.minMembers} à ${tier.maxMembers} membres`
}

const VAT = 'TVA non applicable, art. 293 B du CGI.'

export function subscriptionConfirmationMail(p: {
  orgName: string
  amountCents: number
  interval: 'monthly' | 'yearly'
  tierKey: string | null
  /** Conclusion du contrat, secondes epoch. */
  paidAt: number
  /** Fin de la première période, secondes epoch. */
  nextDueAt: number | null
  immediateAccessAt: string | null
  withdrawalDeadline: number
  invoiceUrl?: string | null
  appUrl: string
}): BillingMail {
  const label = tierLabel(p.tierKey)
  const max = p.tierKey ? tierByKey(p.tierKey)?.maxMembers ?? null : null
  const rows: Array<[string, string]> = [
    ...(label ? [['Palier', label] as [string, string]] : []),
    ['Montant', `${euros(p.amountCents)} TTC / ${p.interval === 'yearly' ? 'an' : 'mois'}`],
    ['Payé le', frDate(p.paidAt)],
    ...(p.nextDueAt ? [['Prochaine échéance', frDate(p.nextDueAt)] as [string, string]] : []),
  ]
  return renderBillingMail({
    subject: 'Votre abonnement COSMO Entreprise est actif',
    title: 'Votre abonnement est actif',
    intro: max
      ? `Merci, ${p.orgName}. Vos membres ont accès à tout, et vous pouvez inviter jusqu'à ${max} personnes.`
      : `Merci, ${p.orgName}. Vos membres ont accès à tout, sans limite de places.`,
    rows,
    cta: { label: 'Inviter des membres', url: membersUrl(p.appUrl) },
    secondary: p.invoiceUrl ? { label: 'Télécharger la facture', url: p.invoiceUrl } : undefined,
    legal: [
      `Nous confirmons votre commande : abonnement COSMO Entreprise pour l'organisation « ${p.orgName} », ${euros(p.amountCents)} TTC par ${p.interval === 'yearly' ? 'an' : 'mois'}. ${VAT}`,
      p.interval === 'yearly'
        ? "L'abonnement annuel est reconduit automatiquement à chaque échéance. Nous vous rappellerons la date de renouvellement 45 jours avant."
        : "L'abonnement mensuel est sans engagement et résiliable à tout moment.",
      `Conditions générales de vente (version ${CGV_VERSION}) : ${p.appUrl}/cgu`,
      `Droit de rétractation. Vous disposez de 14 jours à compter de la souscription, soit jusqu'au ${frDate(p.withdrawalDeadline)}, pour vous rétracter sans motif. Le plus simple : le bouton « Se rétracter du contrat ici » de la page Facturation, ${billingUrl(p.appUrl)}. Toute déclaration sans ambiguïté (e-mail à contact@thecosmo.app, courrier) est aussi acceptée, et le formulaire type figure dans les CGV.`,
      p.immediateAccessAt
        ? `Vous avez demandé expressément l'accès immédiat au service le ${frDateTime(p.immediateAccessAt)} et reconnu qu'en cas de rétractation, la période déjà utilisée vous sera facturée au prorata. Nous vous confirmons cette demande.`
        : 'En cas de rétractation, le montant payé vous sera remboursé intégralement.',
      'Le remboursement intervient au plus tard 14 jours après la rétractation, avec le même moyen de paiement, sans frais.',
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}

export function withdrawalAckMail(p: { orgName: string; withdrawnAt: string; amountCents: number; appUrl?: string }): BillingMail {
  return renderBillingMail({
    subject: 'Accusé de réception de votre rétractation COSMO',
    title: 'Votre rétractation est enregistrée',
    intro: `L'abonnement COSMO Entreprise de « ${p.orgName} » est arrêté.`,
    rows: [
      ['Rétractation le', `${frDateTime(p.withdrawnAt)} (heure de Paris)`],
      ['Montant remboursé', euros(p.amountCents)],
    ],
    legal: [
      `Nous accusons réception de votre rétractation du contrat d'abonnement COSMO Entreprise de l'organisation « ${p.orgName} », le ${frDateTime(p.withdrawnAt)} (heure de Paris).`,
      `Montant qui vous sera remboursé : ${euros(p.amountCents)}, sur le moyen de paiement utilisé, au plus tard 14 jours après cette date, sans frais.`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl ?? 'https://thecosmo.app',
  })
}

export function refundDoneMail(p: { orgName: string; amountCents: number; refundedAt: string; appUrl?: string }): BillingMail {
  return renderBillingMail({
    subject: 'Votre remboursement COSMO',
    title: 'Votre remboursement est parti',
    intro: 'Le montant apparaît sous quelques jours ouvrés sur le moyen de paiement utilisé.',
    rows: [
      ['Montant', euros(p.amountCents)],
      ['Remboursé le', frDate(p.refundedAt)],
    ],
    legal: [
      `Nous avons remboursé ${euros(p.amountCents)} le ${frDate(p.refundedAt)} pour l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ».`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl ?? 'https://thecosmo.app',
  })
}

export function cancellationMail(p: { orgName: string; accessUntil: string; appUrl: string }): BillingMail {
  const until = frDate(p.accessUntil)
  return renderBillingMail({
    subject: 'Confirmation de résiliation de votre abonnement COSMO',
    title: 'Votre résiliation est enregistrée',
    intro: `« ${p.orgName} » garde tout son accès jusqu'à la fin de la période payée. Aucun prélèvement n'aura lieu ensuite.`,
    rows: [
      ['Fin d’accès', until],
      ['Prochain prélèvement', 'aucun'],
      ['Après cette date', 'palier gratuit, 5 places'],
    ],
    cta: { label: 'Reprendre mon abonnement', url: billingUrl(p.appUrl) },
    afterCta: `Possible jusqu'au ${until}, même palier, même prix.`,
    legal: [
      `Nous confirmons la résiliation de l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ».`,
      `L'accès continue jusqu'au ${until}, fin de la période déjà payée. Aucun prélèvement n'aura lieu ensuite. Aucun remboursement n'est effectué.`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}

export function receiptMail(p: { orgName: string; amountCents: number; paidAt: number; appUrl: string; invoiceUrl?: string | null }): BillingMail {
  return renderBillingMail({
    subject: 'Reçu de paiement COSMO',
    title: 'Paiement reçu',
    intro: `Merci, ${p.orgName}. Votre abonnement COSMO Entreprise continue.`,
    rows: [
      ['Montant', `${euros(p.amountCents)} TTC`],
      ['Payé le', frDate(p.paidAt)],
    ],
    cta: { label: 'Gérer mon abonnement', url: billingUrl(p.appUrl) },
    secondary: p.invoiceUrl ? { label: 'Télécharger la facture', url: p.invoiceUrl } : undefined,
    legal: [
      `Nous avons reçu votre paiement de ${euros(p.amountCents)} TTC le ${frDate(p.paidAt)} pour l'abonnement COSMO Entreprise de l'organisation « ${p.orgName} ». ${VAT}`,
      `Gérer ou résilier mon abonnement : ${billingUrl(p.appUrl)}`,
    ],
    orgName: p.orgName,
    appUrl: p.appUrl,
  })
}
```

⚠️ `withdrawalAckMail` et `refundDoneMail` gagnent un `appUrl?` **optionnel** (le logo en a
besoin) : leurs appels actuels restent valides. Les passer réellement aux appelants est fait à la
tâche 4.

- [ ] **Step 3 : vérifier**

Run : `npx vitest run src/modules/billing/billing-mail-text.test.ts src/modules/billing/billing-mail-layout.test.ts ; echo "exit=$?"`
Expected : tous PASS, `exit=0`.

Run : `npm run typecheck ; echo "exit=$?"`
Expected : une erreur attendue dans `stripe-webhook/index.ts` **si** le projet type-check les
fonctions Deno (nouveaux champs requis de `subscriptionConfirmationMail`). Elle est corrigée à la
tâche 3. Si `tsc -b` ne couvre pas `supabase/functions`, `exit=0`.

- [ ] **Step 4 : commit**

```bash
git commit -m "feat(billing): e-mails de facturation sur le gabarit commun, accents retablis, fond legal inchange" -- supabase/functions/_shared/billing-mail-text.ts src/modules/billing/billing-mail-text.test.ts
```

---

### Task 3 : le webhook envoie la bienvenue complète, sans reçu en double

**Files :**
- Modify : `supabase/functions/stripe-webhook/index.ts`
- Test : `src/billing-welcome-mail.guard.test.ts`

- [ ] **Step 1 : écrire la garde qui échoue**

Garde de source, sur le modèle de `src/edge-audit-serveur.guard.test.ts` (lire ce fichier pour
reprendre son helper `read` qui normalise les fins de ligne, et retirer les commentaires avant de
chercher) :

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LF = String.fromCharCode(10);
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').split('\r\n').join(LF);
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const webhook = codeOnly(read('supabase/functions/stripe-webhook/index.ts'));

describe('e-mail de bienvenue (spec 2026-11-02 § 6.2)', () => {
  it('la bienvenue reçoit palier, échéance et facture', () => {
    expect(webhook).toMatch(/subscriptionConfirmationMail\(\{[\s\S]*tierKey[\s\S]*nextDueAt[\s\S]*invoiceUrl/);
  });

  it('le premier prélèvement n envoie PAS de reçu : la bienvenue le remplace', () => {
    expect(webhook).toMatch(/billing_reason\s*!==\s*'subscription_create'/);
  });

  it('témoin : la garde voit bien un reçu non conditionné', () => {
    const sabotage = "if (owner?.email && (invoice.amount_paid ?? 0) > 0) { await sendBillingMail('x', owner.email, receiptMail({})) }";
    expect(sabotage).not.toMatch(/billing_reason\s*!==\s*'subscription_create'/);
  });
});
```

Run : `npx vitest run src/billing-welcome-mail.guard.test.ts ; echo "exit=$?"`
Expected : les deux premiers FAIL.

- [ ] **Step 2 : implémenter dans `handleOrgCheckoutCompleted` (bloc « Confirmation de commande »)**

Dans le `try` qui envoie `subscriptionConfirmationMail`, juste après la lecture de
`billing_acceptances`, ajouter la lecture du palier enregistré et de la facture, puis compléter
l'appel :

```ts
      // Palier tel que `applyOrgSubscription` vient de l'enregistrer (dérivé du
      // price ID, jamais des metadata), et lien de la première facture. Une
      // lecture ratée retire seulement la ligne ou le lien, jamais l'e-mail.
      const { data: saved } = await supabaseAdmin
        .from('org_subscriptions')
        .select('tier_key')
        .eq('org_id', orgId)
        .maybeSingle()
      let invoiceUrl: string | null = null
      if (session.invoice) {
        try {
          const invoice = await stripe.invoices.retrieve(session.invoice as string)
          invoiceUrl = invoice.hosted_invoice_url ?? null
        } catch (err) {
          console.error('org welcome: invoice read failed:', err)
        }
      }
      await sendBillingMail('stripe-webhook', owner.email, subscriptionConfirmationMail({
        orgName: owner.orgName,
        amountCents: session.amount_total ?? 0,
        interval: subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly',
        tierKey: saved?.tier_key ?? null,
        paidAt: subscription.start_date,
        nextDueAt: subscription.current_period_end ?? null,
        immediateAccessAt: acceptance?.immediate_access_at ?? null,
        withdrawalDeadline: withdrawalDeadline(subscription.start_date),
        invoiceUrl,
        appUrl: APP_URL,
      }))
```

(Remplacer l'ancien appel, ne pas en garder deux.)

- [ ] **Step 3 : implémenter dans `handleOrgInvoicePaid`**

Remplacer la condition d'envoi du reçu :

```ts
    // La première facture (souscription) est déjà dans l'e-mail de bienvenue,
    // avec son lien : un reçu en plus ferait deux e-mails pour un seul achat.
    if (owner?.email && (invoice.amount_paid ?? 0) > 0 && invoice.billing_reason !== 'subscription_create') {
```

- [ ] **Step 4 : vérifier**

Run : `npx vitest run src/billing-welcome-mail.guard.test.ts src/edge-audit-serveur.guard.test.ts ; echo "exit=$?"`
Expected : tous PASS, `exit=0`.

Run : `npm run lint ; echo "exit=$?"` (les fonctions Deno sont lintées, C-102) puis
`npm run typecheck ; echo "exit=$?"`.
Expected : `exit=0` les deux.

- [ ] **Step 5 : commit**

```bash
git add src/billing-welcome-mail.guard.test.ts
git commit -m "feat(billing): bienvenue avec palier, echeance et facture, plus de recu en double a la souscription" -- supabase/functions/stripe-webhook/index.ts src/billing-welcome-mail.guard.test.ts
```

---

### Task 4 : rappel annuel sur le gabarit, et `appUrl` passé partout

**Files :**
- Modify : `supabase/functions/_shared/renewal-notice-text.ts`
- Modify : `supabase/functions/stripe-org-subscription/index.ts` (appel `withdrawalAckMail`)
- Modify : `supabase/functions/stripe-org-refund/index.ts` (appel `refundDoneMail`)
- Test : `src/edge-audit-serveur.guard.test.ts` (doit rester vert sans modification) et
  `src/modules/billing/billing-mail-text.test.ts`

- [ ] **Step 1 : test du rappel**

Ajouter dans `billing-mail-text.test.ts` (importer `renewalNoticeMail` depuis
`../../../supabase/functions/_shared/renewal-notice-text`) :

```ts
describe('rappel annuel L215-1 sur le gabarit', () => {
  it('garde l article, la date, le dernier jour et le lien de résiliation', () => {
    const m = renewalNoticeMail({ org_name: 'Acme', period_end: '2026-12-17', tier_key: 't20' }, 'https://thecosmo.app');
    expect(m.subject).toBe('Votre abonnement COSMO sera renouvelé le 17/12/2026');
    expect(m.text).toContain('L215-1');
    expect(m.text).toContain('Renouvellement : 17/12/2026');
    expect(m.text).toContain('Montant débité : 1 350,00 € TTC pour un an');
    expect(m.text).toContain('16/12/2026');
    expect(m.html).toContain('href="https://thecosmo.app/entreprise/billing"');
    expect(m.html).toContain('alt="Cosmo"');
  });
});
```

⚠️ Le format du montant : `yearlyTotalEur(150)` vaut `1350`. Le code actuel l'écrit
`toFixed(2).replace('.', ',')` (« 1350,00 »). Utiliser `euros(Math.round(total * 100))` de
`billing-mail-text.ts` **seulement** s'il rend « 1 350,00 € » ; sinon garder le format actuel et
écrire l'assertion sur « 1350,00 € TTC pour un an ». Ne pas inventer un formateur.

Run : `npx vitest run src/modules/billing/billing-mail-text.test.ts ; echo "exit=$?"` → FAIL.

- [ ] **Step 2 : réécrire `renewalNoticeMail`**

Garder `frenchDate`, `dayBefore` et la signature. Le corps devient :

```ts
export function renewalNoticeMail(org: RenewalNoticeOrg, appUrl: string): { subject: string; text: string; html: string } {
  const date = frenchDate(org.period_end)
  const lastDay = frenchDate(dayBefore(org.period_end))
  const manage = `${appUrl}/entreprise/billing`
  const tier = org.tier_key ? tierByKey(org.tier_key) : undefined
  const amount = tier ? `${yearlyTotalEur(tier.priceEurPerMonth).toFixed(2).replace('.', ',')} € TTC` : null
  const range = tier ? (tier.maxMembers === null ? 'Illimité' : `${tier.minMembers} à ${tier.maxMembers} membres`) : null

  return renderBillingMail({
    subject: `Votre abonnement COSMO sera renouvelé le ${date}`,
    title: 'Renouvellement dans 45 jours',
    intro: `L'abonnement annuel de « ${org.org_name} » sera reconduit automatiquement le ${date}. Rien à faire si vous souhaitez continuer.`,
    rows: [
      ['Renouvellement', date],
      ...(amount ? [['Montant débité', `${amount} pour un an`] as [string, string]] : []),
      ...(range ? [['Palier', range] as [string, string]] : []),
    ],
    cta: { label: 'Gérer mon abonnement', url: manage },
    secondary: { label: `Résilier avant le ${lastDay} inclus`, url: manage },
    legal: [
      `Conformément à l'article L215-1 du Code de la consommation, voici le rappel de renouvellement de l'abonnement COSMO Entreprise de l'organisation « ${org.org_name} ».`,
      `Votre abonnement sera renouvelé automatiquement le ${date}${amount ? `, pour un montant de ${amount}` : ''}.`,
      `Vous pouvez refuser ce renouvellement en résiliant depuis la page Facturation, jusqu'au ${lastDay} inclus : ${manage}`,
      `Sans résiliation, le montant sera prélevé le ${date}.`,
      'La résiliation prend effet au terme de la période déjà payée, sans frais ni justification.',
    ],
    orgName: org.org_name,
    appUrl,
  })
}
```

Supprimer l'`escapeHtml` local (celui du gabarit l'échappe), importer `renderBillingMail` depuis
`./billing-mail-layout.ts`.

- [ ] **Step 3 : passer `appUrl` aux deux appels restants**

- `stripe-org-subscription/index.ts`, appel `withdrawalAckMail({ … })` : ajouter `appUrl: APP_URL`
  (la constante existe dans ce fichier : la chercher ; si elle n'existe pas, la déclarer comme dans
  `stripe-webhook` : `Deno.env.get('APP_URL') ?? 'https://thecosmo.app'`).
- `stripe-org-refund/index.ts`, appel `refundDoneMail({ … })` : idem.

- [ ] **Step 4 : vérifier**

Run : `npx vitest run src/modules/billing src/edge-audit-serveur.guard.test.ts src/billing-welcome-mail.guard.test.ts ; echo "exit=$?"`
Expected : tous PASS. La garde SV-5 (`edge-audit-serveur`) passe sans modification : échappement
du nom, appel `renewalNoticeMail(org, APP_URL)` inchangé.

Run : `npm run lint ; echo "exit=$?"` et `npm run typecheck ; echo "exit=$?"`.

- [ ] **Step 5 : commit**

```bash
git commit -m "feat(billing): rappel annuel L215-1 sur le gabarit, logo dans tous les e-mails" -- supabase/functions/_shared/renewal-notice-text.ts supabase/functions/stripe-org-subscription/index.ts supabase/functions/stripe-org-refund/index.ts src/modules/billing/billing-mail-text.test.ts
```

---

### Task 5 : aperçu visuel des e-mails

**Files :**
- Create : `src/modules/billing/billing-mail.preview.test.ts`

- [ ] **Step 1 : écrire l'aperçu**

```ts
// Aperçu des e-mails pour l'œil, jamais en CI : ne tourne que si
// MAIL_PREVIEW_DIR est posé. `MAIL_PREVIEW_DIR=<dossier> npx vitest run <ce fichier>`
// écrit un .html par e-mail dans ce dossier.
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cancellationMail,
  receiptMail,
  refundDoneMail,
  subscriptionConfirmationMail,
  withdrawalAckMail,
} from '../../../supabase/functions/_shared/billing-mail-text';
import { renewalNoticeMail } from '../../../supabase/functions/_shared/renewal-notice-text';

const dir = process.env.MAIL_PREVIEW_DIR;
const APP = 'https://thecosmo.app';
const s = (iso: string) => Date.parse(iso) / 1000;

describe.skipIf(!dir)('aperçu des e-mails de facturation', () => {
  it('écrit les fichiers', () => {
    mkdirSync(dir as string, { recursive: true });
    const mails = {
      bienvenue: subscriptionConfirmationMail({
        orgName: 'Acme', amountCents: 7000, interval: 'monthly', tierKey: 't10', paidAt: s('2026-11-02T10:42:00Z'),
        nextDueAt: s('2026-12-02T10:42:00Z'), immediateAccessAt: '2026-11-02T10:42:00Z',
        withdrawalDeadline: s('2026-11-16T10:42:00Z'), invoiceUrl: 'https://invoice.stripe.com/i/exemple', appUrl: APP,
      }),
      recu: receiptMail({ orgName: 'Acme', amountCents: 7000, paidAt: s('2026-12-02T10:42:00Z'), appUrl: APP, invoiceUrl: 'https://invoice.stripe.com/i/exemple' }),
      resiliation: cancellationMail({ orgName: 'Acme', accessUntil: '2026-12-02T10:42:00Z', appUrl: APP }),
      retractation: withdrawalAckMail({ orgName: 'Acme', withdrawnAt: '2026-11-05T09:00:00Z', amountCents: 1933, appUrl: APP }),
      remboursement: refundDoneMail({ orgName: 'Acme', amountCents: 1933, refundedAt: '2026-11-06T09:00:00Z', appUrl: APP }),
      rappel: renewalNoticeMail({ org_name: 'Acme', period_end: '2026-12-17', tier_key: 't20' }, APP),
    };
    for (const [name, m] of Object.entries(mails)) {
      writeFileSync(join(dir as string, `${name}.html`), m.html, 'utf8');
      writeFileSync(join(dir as string, `${name}.txt`), `${m.subject}\n\n${m.text}`, 'utf8');
    }
  });
});
```

- [ ] **Step 2 : vérifier qu'il est inerte en CI**

Run : `npx vitest run src/modules/billing/billing-mail.preview.test.ts ; echo "exit=$?"`
Expected : 1 test **skipped**, `exit=0`.

- [ ] **Step 3 : commit**

```bash
git add src/modules/billing/billing-mail.preview.test.ts
git commit -m "test(billing): apercu des e-mails de facturation, inerte sans MAIL_PREVIEW_DIR" -- src/modules/billing/billing-mail.preview.test.ts
```

---

### Task 6 : vérification finale, aperçu, livraison

- [ ] **Step 1 : gardes**

Chacune avec `; echo "exit=$?"` : `npm run lint`, `npm run typecheck`,
`npx vitest run src/modules/billing src/edge-audit-serveur.guard.test.ts src/billing-welcome-mail.guard.test.ts`,
`npm run check:edge-coverage`, `npm run check:docs`. Expected : `exit=0` partout.

- [ ] **Step 2 : aperçu**

`MAIL_PREVIEW_DIR=<scratchpad>/mails npx vitest run src/modules/billing/billing-mail.preview.test.ts`,
puis ouvrir chaque `.html` dans le navigateur intégré (servi en local) : logo net, aucune icône,
encadré lisible, bouton indigo, mentions légales complètes, largeur 375 px sans défilement
horizontal. Lire chaque `.txt` : tout le contenu y est.

- [ ] **Step 3 : pousser**

`git fetch origin`, intégrer `origin/main` (fusion si des fichiers d'autres sessions bloquent un
rebase, sans jamais les remiser), `git push origin main`. Hook `pre-push` rouge pour une cause
étrangère : suivre la mémoire « Hook pre-push main rouge », jamais `--no-verify`.

- [ ] **Step 4 : déploiement, sur accord d'Axel seulement**

Fonctions touchées : `stripe-webhook`, `stripe-org-subscription`, `stripe-org-refund`,
`renewal-notice`. Demander l'accord explicite d'Axel avant tout déploiement (Stripe live). Après
accord : déployer par la voie du runbook (`docs/DEPLOYMENT.md`), puis `npm run check:edge` pour
prouver l'absence de dérive.
