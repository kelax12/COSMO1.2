> ⚠️ **ARCHIVE — instantané daté du 2026-11-02, non maintenu.**
> Ce document décrit un plan ou une conception **à cette date**. La fonctionnalité est livrée : le code fait foi.
> Sources vivantes : [`CLAUDE.md`](../../../../CLAUDE.md) · [`docs/MODULES.md`](../../../MODULES.md) · [`faille.md`](../../../../faille.md).

# Facturation entreprise, lot 1 : interface et états · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer le lot 1 de la spec
[`2026-11-02-facturation-experience-design.md`](../specs/2026-11-02-facturation-experience-design.md)
(§ 3, 4, 5) : carte forfait, pictos précontractuels, grille cliquable avec palier conseillé,
récapitulatif avant paiement, sortie vers Stripe, activation au retour, impayé, résiliation
programmée, invitation sans place. Front seul, aucun changement serveur.

**Architecture :** la logique pure (palier conseillé, dates, montants, intervalle de sondage) va
dans `org-billing.logic.ts` et se teste sans React. L'attente d'activation est un `refetchInterval`
**borné** sur `useOrgSubscription`, piloté par une trace `sessionStorage` écrite avant la
redirection. `OrgBillingTab` devient un assemblage de petits composants. La bannière d'impayé est
montée en `lazy` dans `OrganizationPage` (chunk plafonné).

**Tech :** React 19, TypeScript strict, TanStack Query 5, Framer Motion (`framer-motion`),
lucide-react (imports nominaux), date-fns 3, Vitest + Testing Library (jsdom), catalogues i18n
maison (`src/locales/{fr,en}/*.json`).

---

## Règles à tenir pendant tout le plan

- Imports par `@/`. Toasts par `@/lib/toast`. ❌ Jamais GSAP ici.
- ❌ **Aucune position finale portée par un `initial` de transform** (`src/components/CLAUDE.md`
  § Animations) : sous mouvement réduit, l'`initial` reste appliqué. Les entrées animent
  l'**opacité** ; les transforms (`scale`, `rotate`, `layoutId`) partent de leur état final ou
  d'un état neutre.
- Tailles de texte : classes de l'échelle (`text-caption`, `text-xs`, `text-sm`, `text-xl`…),
  jamais `text-[13px]` (`src/design-system.guard.test.ts`).
- ❌ Ne jamais passer `--maxWorkers` à Vitest. Lire `$?` après chaque commande, jamais une ligne
  de résumé seule.
- Checkout partagé : chaque commit nomme ses fichiers (`git commit -m "…" -- <chemins>`).
- Textes : tout libellé en fr **et** en, jamais identiques (`i18n:identical`). ❌ Aucun « — ».
- Les règles de `src/modules/billing/CLAUDE.md` ne bougent pas : case d'accès immédiat non cochée
  par défaut et obligatoire, montants dérivés, `retry: 0` sur les mutations d'abonnement.

## Décision déjà prise, à connaître

`src/modules/polling.guard.test.ts` dit de sa liste nominative qu'elle « ne doit que rétrécir ».
La spec validée par Axel le 2026-11-02 (§ 5.1) y ajoute **délibérément** un cinquième fichier,
`billing/org-billing.hooks.ts`, pour un sondage **conditionnel et borné à 20 s**. La tâche 3
modifie donc la garde et le commentaire, avec la raison écrite. Ce n'est pas un ajout pour faire
passer la CI : c'est la décision de la spec, et la borne est prouvée par un test.

## Fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/modules/billing/org-billing.logic.ts` | modifier | `recommendedTier`, `tierByQuota`, `chargedTodayEur`, `nextDueDate`, `withdrawalDeadline`, `isActivated`, `activationPollInterval`, `lastFailedPaymentAt` |
| `src/modules/billing/org-billing.logic.test.ts` | modifier | tests des fonctions ci-dessus |
| `src/modules/billing/pending-checkout.ts` | créer | trace `cosmo_pending_checkout` |
| `src/modules/billing/pending-checkout.test.ts` | créer | |
| `src/modules/billing/org-billing.hooks.ts` | modifier | option `awaitActivation` |
| `src/modules/polling.guard.test.ts` | modifier | cinquième fichier nommé |
| `src/modules/CLAUDE.md` | modifier | tableau des `refetchInterval` |
| `src/locales/{fr,en}/orgAdmin.json`, `src/locales/{fr,en}/orgAccount.json`, `src/locales/{fr,en}/org.json` | modifier | libellés |
| `src/components/organization/billing-ui.ts` | créer | tons de pastille, `useTierRangeLabel` |
| `src/components/organization/OrgPrecontractualPictos.tsx` (+ test) | créer | § 3.2 |
| `src/components/organization/OrgPlanCard.tsx` (+ test) | créer | § 3.1, animation 3 |
| `src/components/organization/EnterpriseTierGrid.tsx` (+ test) | modifier | carte cliquable, conseillé, fondu des prix |
| `src/components/organization/BillingIntervalToggle.tsx` | modifier | pastille qui glisse |
| `src/components/organization/OrgCheckoutRecap.tsx` (+ test) | créer | § 3.3, animations 1, 4, 5 |
| `src/components/organization/OrgActivationState.tsx` (+ test) | créer | § 5.1, animation 6 |
| `src/components/organization/OrgBillingTab.tsx` | modifier | assemblage, retour Stripe, `?tier=` |
| `src/components/organization/OrgBillingTab.retractation.parcours.test.tsx` | modifier | nouveaux libellés |
| `src/components/organization/OrgBillingHistory.tsx` | modifier | § 3.4 |
| `src/components/organization/OrgWithdrawCancel.tsx` | modifier | § 5.3 |
| `src/components/organization/OrgPastDueBanner.tsx` (+ test) | créer | § 5.2 |
| `src/pages/OrganizationPage.tsx` | modifier | montage lazy de la bannière |
| `src/components/organization/OrgInviteSection.tsx` | modifier | § 5.4 |

---

### Task 1 : logique pure

**Files :**
- Modify : `src/modules/billing/org-billing.logic.ts`
- Test : `src/modules/billing/org-billing.logic.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter en fin de `org-billing.logic.test.ts` (le fichier a déjà `sub()` et les imports de
`vitest`) :

```ts
import {
  recommendedTier,
  tierByQuota,
  chargedTodayEur,
  nextDueDate,
  withdrawalDeadline,
  isActivated,
  activationPollInterval,
  lastFailedPaymentAt,
  ACTIVATION_POLL_MS,
} from './org-billing.logic';
import type { OrgBillingHistoryEntry } from './org-billing.types';

describe('recommendedTier : le plus petit palier payant qui laisse une place', () => {
  it('organisation vide ou à 5 → premier palier payant', () => {
    expect(recommendedTier(0).key).toBe('t10');
    expect(recommendedTier(5).key).toBe('t10');
  });
  it('pile au plafond d un palier → le suivant', () => {
    expect(recommendedTier(10).key).toBe('t20');
    expect(recommendedTier(20).key).toBe('t50');
    expect(recommendedTier(100).key).toBe('tmax');
  });
  it('sous le plafond → ce palier', () => {
    expect(recommendedTier(14).key).toBe('t20');
    expect(recommendedTier(99).key).toBe('t100');
  });
});

describe('tierByQuota', () => {
  it('retrouve le palier par son plafond, illimité compris', () => {
    expect(tierByQuota(5).key).toBe('free');
    expect(tierByQuota(20).key).toBe('t20');
    expect(tierByQuota(null).key).toBe('tmax');
  });
});

describe('montants et dates', () => {
  it('chargedTodayEur : mensuel = tarif, annuel = total dérivé', () => {
    expect(chargedTodayEur(70, 'monthly')).toBe(70);
    expect(chargedTodayEur(70, 'yearly')).toBe(630);
  });
  it('nextDueDate : fin de mois et 29 février', () => {
    expect(nextDueDate(new Date(2026, 0, 31), 'monthly')).toEqual(new Date(2026, 1, 28));
    expect(nextDueDate(new Date(2028, 1, 29), 'yearly')).toEqual(new Date(2029, 1, 28));
  });
  it('withdrawalDeadline : quatorze jours', () => {
    expect(withdrawalDeadline(new Date(2026, 10, 2))).toEqual(new Date(2026, 10, 16));
  });
});

describe('activation après paiement', () => {
  it('isActivated : palier attendu, ou n importe quel payant sans attente précise', () => {
    expect(isActivated(sub({ tierKey: 't20' }), 't20')).toBe(true);
    expect(isActivated(sub({ tierKey: 't10' }), 't20')).toBe(false);
    expect(isActivated(sub({ tierKey: 't10' }), null)).toBe(true);
    expect(isActivated(sub({ tierKey: 'free' }), null)).toBe(false);
    expect(isActivated(sub({ status: 'past_due' }), 't20')).toBe(false);
    expect(isActivated(null, null)).toBe(false);
  });
  it('activationPollInterval : sonde avant l échéance, jamais après (la borne)', () => {
    const deadline = 10_000;
    expect(activationPollInterval(null, 't20', deadline, 9_999)).toBe(ACTIVATION_POLL_MS);
    expect(activationPollInterval(null, 't20', deadline, 10_000)).toBe(false);
    expect(activationPollInterval(sub({ tierKey: 't20' }), 't20', deadline, 0)).toBe(false);
  });
});

describe('lastFailedPaymentAt', () => {
  const entry = (eventType: string, occurredAt: string): OrgBillingHistoryEntry => ({
    id: 1, eventType, invoiceNumber: null, hostedInvoiceUrl: null, amountCents: 0, currency: 'eur', occurredAt,
  });
  it('rend le plus récent échec, quel que soit l ordre', () => {
    expect(
      lastFailedPaymentAt([
        entry('invoice.payment_failed', '2026-10-02T10:00:00Z'),
        entry('invoice.payment_succeeded', '2026-11-03T10:00:00Z'),
        entry('invoice.payment_failed', '2026-11-02T10:00:00Z'),
      ]),
    ).toBe('2026-11-02T10:00:00Z');
  });
  it('null sans échec', () => {
    expect(lastFailedPaymentAt([entry('invoice.payment_succeeded', '2026-11-02T10:00:00Z')])).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/modules/billing/org-billing.logic.test.ts ; echo "exit=$?"`
Expected : FAIL, `recommendedTier is not a function` (ou erreur d'export), `exit=1`.

- [ ] **Step 3 : implémenter**

En tête de `org-billing.logic.ts`, remplacer les imports par :

```ts
import { addDays, addMonths, addYears } from 'date-fns';
import { ENTERPRISE_PRICING_TIERS, ORG_FREE_SEATS, yearlyTotalEur } from './premium-config';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';
import type { OrgBillingHistoryEntry, OrgSubscription } from './org-billing.types';
```

Puis ajouter en fin de fichier :

```ts
/**
 * Le palier à CONSEILLER : le plus petit palier payant qui laisse au moins une
 * place libre à l'effectif actuel. Distinct de `tierForMemberCount`, qui rend
 * le palier qui COUVRE l'effectif (pile au plafond compris) : conseiller un
 * palier déjà plein ferait payer pour ne rien pouvoir inviter.
 */
export function recommendedTier(memberCount: number): Tier {
  return (
    ENTERPRISE_PRICING_TIERS.find(
      (t) => t.priceEurPerMonth > 0 && (t.maxMembers === null || t.maxMembers > memberCount),
    ) ?? ENTERPRISE_PRICING_TIERS[ENTERPRISE_PRICING_TIERS.length - 1]
  );
}

/** Le palier dont le plafond vaut `quota` (`null` = illimité). */
export function tierByQuota(quota: number | null): Tier {
  return ENTERPRISE_PRICING_TIERS.find((t) => t.maxMembers === quota) ?? ENTERPRISE_PRICING_TIERS[0];
}

/** Montant débité au paiement : le mois, ou l'année entière dérivée du mensuel. */
export function chargedTodayEur(priceEurPerMonth: number, interval: OrgBillingInterval): number {
  return interval === 'yearly' ? yearlyTotalEur(priceEurPerMonth) : priceEurPerMonth;
}

/** Échéance suivante d'un abonnement pris à `from`. date-fns gère fin de mois et 29 février. */
export function nextDueDate(from: Date, interval: OrgBillingInterval): Date {
  return interval === 'yearly' ? addYears(from, 1) : addMonths(from, 1);
}

/** Fin du délai de rétractation (L221-18), pour l'AFFICHAGE du récapitulatif. */
export function withdrawalDeadline(from: Date): Date {
  return addDays(from, 14);
}

export const ACTIVATION_POLL_MS = 1500;
export const ACTIVATION_TIMEOUT_MS = 20_000;

/**
 * L'abonnement lu est-il celui qu'on vient de payer ? Sans palier attendu (la
 * trace `sessionStorage` a été perdue), tout palier payant actif compte.
 */
export function isActivated(sub: OrgSubscription | null | undefined, tierKey: OrgTierKey | null): boolean {
  if (!sub || sub.status !== 'active') return false;
  return tierKey ? sub.tierKey === tierKey : sub.tierKey !== 'free';
}

/**
 * Intervalle du sondage d'activation au retour de Stripe. BORNÉ : `false` dès
 * que l'abonnement correspond ou que l'échéance est passée. C'est cette borne
 * qui justifie la place du hook dans `polling.guard.test.ts`.
 */
export function activationPollInterval(
  sub: OrgSubscription | null | undefined,
  tierKey: OrgTierKey | null,
  deadline: number,
  now = Date.now(),
): number | false {
  if (isActivated(sub, tierKey)) return false;
  return now < deadline ? ACTIVATION_POLL_MS : false;
}

/** Date du dernier paiement échoué du journal, quel que soit son ordre. */
export function lastFailedPaymentAt(entries: OrgBillingHistoryEntry[]): string | null {
  let last: string | null = null;
  for (const e of entries) {
    if (e.eventType !== 'invoice.payment_failed') continue;
    if (!last || new Date(e.occurredAt).getTime() > new Date(last).getTime()) last = e.occurredAt;
  }
  return last;
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/modules/billing/org-billing.logic.test.ts ; echo "exit=$?"`
Expected : tous PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add src/modules/billing/org-billing.logic.ts src/modules/billing/org-billing.logic.test.ts
git commit -m "feat(billing): logique pure du parcours (palier conseille, echeances, activation bornee)" -- src/modules/billing/org-billing.logic.ts src/modules/billing/org-billing.logic.test.ts
```

---

### Task 2 : trace du paiement en cours

**Files :**
- Create : `src/modules/billing/pending-checkout.ts`
- Test : `src/modules/billing/pending-checkout.test.ts`

- [ ] **Step 1 : écrire le test qui échoue**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PENDING_CHECKOUT_KEY,
  clearPendingCheckout,
  readPendingCheckout,
  writePendingCheckout,
} from './pending-checkout';

describe('pending-checkout', () => {
  beforeEach(() => sessionStorage.clear());

  it('relit ce qui a été écrit pour la même organisation', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't20', interval: 'yearly', at: 1_000 });
    expect(readPendingCheckout('org-1', 2_000)).toEqual({ orgId: 'org-1', tierKey: 't20', interval: 'yearly', at: 1_000 });
  });

  it('ignore une autre organisation, un palier inconnu, une trace de plus de 30 min', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't20', interval: 'monthly', at: 0 });
    expect(readPendingCheckout('org-2', 1)).toBeNull();
    expect(readPendingCheckout('org-1', 30 * 60 * 1000 + 1)).toBeNull();
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ orgId: 'org-1', tierKey: 'gold', interval: 'monthly', at: 0 }));
    expect(readPendingCheckout('org-1', 1)).toBeNull();
  });

  it('survit à une valeur corrompue', () => {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, '{pas du json');
    expect(readPendingCheckout('org-1')).toBeNull();
  });

  it('clear efface la trace', () => {
    writePendingCheckout({ orgId: 'org-1', tierKey: 't10', interval: 'monthly', at: Date.now() });
    clearPendingCheckout();
    expect(sessionStorage.getItem(PENDING_CHECKOUT_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/modules/billing/pending-checkout.test.ts ; echo "exit=$?"`
Expected : FAIL (module introuvable), `exit=1`.

- [ ] **Step 3 : implémenter**

```ts
// ═══════════════════════════════════════════════════════════════════
// BILLING ORG · trace du paiement en cours (spec 2026-11-02 § 5.1)
//
// Écrite juste avant la redirection vers Stripe, relue au retour
// (`?checkout=success`) pour savoir QUEL palier attendre pendant que le
// webhook arrive. `sessionStorage` : la trace ne doit pas survivre à l'onglet.
// Ce n'est pas une donnée de facturation : la perdre fait seulement attendre
// « n'importe quel palier payant » au lieu du palier précis.
// ═══════════════════════════════════════════════════════════════════
import { safeParse } from '@/lib/safe-json';
import { ENTERPRISE_PRICING_TIERS } from './premium-config';
import type { OrgBillingInterval, OrgTierKey } from './premium-config';

export const PENDING_CHECKOUT_KEY = 'cosmo_pending_checkout';
const MAX_AGE_MS = 30 * 60 * 1000;
const TIER_KEYS = new Set<string>(ENTERPRISE_PRICING_TIERS.map((t) => t.key));

export interface PendingCheckout {
  orgId: string;
  tierKey: OrgTierKey;
  interval: OrgBillingInterval;
  at: number;
}

export function writePendingCheckout(pending: PendingCheckout): void {
  try {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le retour attendra
    // n'importe quel palier payant, ce qui reste juste.
  }
}

export function readPendingCheckout(orgId: string, now = Date.now()): PendingCheckout | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
  } catch {
    return null;
  }
  const p = safeParse<PendingCheckout>(raw);
  if (!p || p.orgId !== orgId || !TIER_KEYS.has(p.tierKey) || typeof p.at !== 'number') return null;
  if (now - p.at > MAX_AGE_MS) return null;
  return p;
}

export function clearPendingCheckout(): void {
  try {
    sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // Rien à effacer si le stockage est inaccessible.
  }
}
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/modules/billing/pending-checkout.test.ts ; echo "exit=$?"`
Expected : 4 PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add src/modules/billing/pending-checkout.ts src/modules/billing/pending-checkout.test.ts
git commit -m "feat(billing): trace sessionStorage du paiement en cours" -- src/modules/billing/pending-checkout.ts src/modules/billing/pending-checkout.test.ts
```

---

### Task 3 : sondage d'activation borné

**Files :**
- Modify : `src/modules/billing/org-billing.hooks.ts`
- Modify : `src/modules/polling.guard.test.ts`
- Modify : `src/modules/CLAUDE.md`

- [ ] **Step 1 : faire échouer la garde**

Remplacer `useOrgSubscription` dans `org-billing.hooks.ts` :

```ts
import { activationPollInterval } from './org-billing.logic';
import type { OrgTierKey } from './premium-config';

/** Attente d'activation au retour de Stripe (spec 2026-11-02 § 5.1). */
export interface AwaitActivation {
  tierKey: OrgTierKey | null;
  deadline: number;
}

export const useOrgSubscription = (
  orgId: string | undefined,
  options?: { awaitActivation?: AwaitActivation | null },
) => {
  const isDemo = useIsDemo();
  const awaiting = options?.awaitActivation ?? null;
  return useQuery<OrgSubscription | null>({
    queryKey: orgBillingKeys.subscription(orgId ?? ''),
    queryFn: () => (isDemo ? Promise.resolve(null) : getOrgSubscription(orgId as string)),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    // Sondage BORNÉ, seulement pendant l'attente d'activation : 1,5 s, arrêt dès
    // que l'abonnement correspond ou 20 s après le retour. Hors attente : aucun.
    refetchInterval: awaiting
      ? (query) => activationPollInterval(query.state.data, awaiting.tierKey, awaiting.deadline)
      : false,
  });
};
```

Run : `npx vitest run src/modules/polling.guard.test.ts ; echo "exit=$?"`
Expected : FAIL sur « aucun NOUVEAU fichier n'introduit de sondage », qui nomme
`src/modules/billing/org-billing.hooks.ts`. Le test « chaque `refetchInterval` est conditionnel »
reste PASS (ternaire sur deux lignes).

- [ ] **Step 2 : déclarer le cinquième sondage**

Dans `polling.guard.test.ts`, remplacer le bloc `ALLOWED` et son commentaire :

```ts
/**
 * Les cinq sondages autorisés, NOMMÉS. Un total ne prouve rien : c'est la
 * leçon écrite trois fois dans ce dépôt. Cette liste ne grandit que par
 * décision écrite.
 *
 * Le cinquième (`billing/org-billing.hooks.ts`, 2026-11-02) n'existe que
 * pendant l'attente d'activation au retour de Stripe, et il est BORNÉ à 20 s
 * par `activationPollInterval`, dont la borne est testée dans
 * `org-billing.logic.test.ts`. Décision de la spec
 * `docs/superpowers/specs/2026-11-02-facturation-experience-design.md` § 5.1.
 */
const ALLOWED = new Set([
  'src/modules/billing/org-billing.hooks.ts',
  'src/modules/organizations/hooks.ts',
  'src/modules/team-okrs/hooks.ts',
  'src/modules/team-projects/hooks.ts',
  'src/modules/tasks/hooks.ts',
]);
```

Run : `npx vitest run src/modules/polling.guard.test.ts src/modules/billing/org-billing.hooks.test.tsx ; echo "exit=$?"`
Expected : tous PASS, `exit=0`.

- [ ] **Step 3 : documenter**

Dans `src/modules/CLAUDE.md`, § « Synchronisation de la collaboration » :
- remplacer « **Il reste QUATRE déclarations de `refetchInterval`, et aucune n'est permanente** »
  par « **Il reste CINQ déclarations de `refetchInterval`, et aucune n'est permanente** » ;
- ajouter cette ligne au tableau, en dernier :

```md
| `billing/org-billing.hooks.ts` · `useOrgSubscription` | bornée : 1,5 s pendant 20 s au plus, au retour de Stripe seulement |
```

- dans la puce « Le décompte nominatif est MÉCANISÉ », remplacer « nomme les quatre fichiers » par
  « nomme les cinq fichiers ».

Run : `npm run check:docs ; echo "exit=$?"`
Expected : `exit=0`.

- [ ] **Step 4 : commit**

```bash
git commit -m "feat(billing): sondage d'activation borne au retour de Stripe, declare dans la garde" -- src/modules/billing/org-billing.hooks.ts src/modules/polling.guard.test.ts src/modules/CLAUDE.md
```

---

### Task 4 : libellés fr et en

**Files :**
- Modify : `src/locales/fr/orgAdmin.json`, `src/locales/en/orgAdmin.json` (objet `billing`)
- Modify : `src/locales/fr/orgAccount.json`, `src/locales/en/orgAccount.json` (racine)
- Modify : `src/locales/fr/org.json`, `src/locales/en/org.json` (objet `invite`)

- [ ] **Step 1 : ajouter les clés `billing.*` (orgAdmin)**

Ajouter dans l'objet `billing` de `fr/orgAdmin.json` :

```json
"planCardLabel": "Votre forfait",
"pillActive": "Actif",
"pillPastDue": "Paiement en attente",
"pillEnds": "Se termine le {{date}}",
"pillTrial": "Palier d'essai",
"seatsGaugeLabel": "Sièges occupés",
"seatsGauge": "{{count}} sur {{quota}}",
"seatsFullHint": "Complet. Le prochain membre invité demandera un palier payant.",
"seatsNearHint": "Bientôt complet : {{left}} places libres sur {{quota}}.",
"nextDue": "Prochaine échéance le {{date}}, {{amount}} TTC",
"changeTierTitle": "Changer de palier",
"pictosLabel": "L'essentiel du contrat",
"pictoNoCommitment": "Sans engagement",
"pictoYearly": "Un an, rappel 45 jours avant",
"pictoWithdrawal": "14 jours pour changer d'avis",
"pictoCancel": "Résiliable en 1 clic",
"pictoTax": "Prix TTC, sans TVA",
"recommended": "Conseillé pour votre équipe",
"chooseTierAria": "Choisir ce palier : {{range}}, {{price}}",
"recapTitle": "Vérifier avant de payer",
"recapTier": "Palier",
"recapInterval": "Périodicité",
"recapMonthly": "Mensuelle",
"recapYearly": "Annuelle",
"recapToday": "Débité aujourd'hui",
"recapNext": "Prochaine échéance",
"recapNextValue": "{{date}}, même montant",
"recapWithdrawal": "Changer d'avis",
"recapWithdrawalValue": "jusqu'au {{date}}",
"payWith": "Payer {{amount}} avec Stripe",
"checkBoxRequired": "Cochez la case pour continuer.",
"redirectTitle": "Direction Stripe, paiement sécurisé",
"redirectBody": "Votre carte ne transite jamais par COSMO.",
"activationWaitTitle": "Paiement reçu, activation en cours…",
"activationWaitBody": "Stripe nous confirme l'abonnement. Cette page se met à jour seule.",
"activationTimeout": "Votre paiement est bien reçu. L'activation prend plus de temps que prévu : rechargez la page dans une minute, ou écrivez à contact@thecosmo.app.",
"welcomeTitle": "Bienvenue dans le palier {{tier}}",
"welcomeBody": "La confirmation part par e-mail au propriétaire.",
"welcomeInvite": "Inviter des membres",
"welcomeClose": "Fermer",
"pastDueTitle": "Le paiement du {{date}} n'est pas passé",
"pastDueTitleNoDate": "Le dernier paiement n'est pas passé",
"pastDueBody": "Vos {{count}} membres gardent tous leurs accès. Les nouvelles invitations sont en pause jusqu'à la mise à jour de la carte. Stripe retente automatiquement dans les prochains jours.",
"pastDueCta": "Mettre à jour ma carte",
"endsTitle": "Votre abonnement s'arrête le {{date}}",
"endsBody": "Aucun nouveau prélèvement. Tout reste accessible jusque-là.",
"timelineLabel": "Fin de l'abonnement",
"timelineToday": "Aujourd'hui",
"timelineEnd": "Fin d'accès le {{date}}",
"timelineFree": "Palier gratuit",
"endsOverQuota": "Après le {{date}}, le palier gratuit compte {{quota}} places. Vos {{count}} membres restent, mais vous ne pourrez plus en inviter.",
"resumeHint": "Même palier, même prix, aucune démarche de plus."
```

Et dans `en/orgAdmin.json` :

```json
"planCardLabel": "Your plan",
"pillActive": "Active",
"pillPastDue": "Payment pending",
"pillEnds": "Ends on {{date}}",
"pillTrial": "Trial tier",
"seatsGaugeLabel": "Seats in use",
"seatsGauge": "{{count}} of {{quota}}",
"seatsFullHint": "Full. The next invited member will require a paid tier.",
"seatsNearHint": "Almost full: {{left}} of {{quota}} seats left.",
"nextDue": "Next payment on {{date}}, {{amount}} incl. VAT",
"changeTierTitle": "Change tier",
"pictosLabel": "Contract at a glance",
"pictoNoCommitment": "No commitment",
"pictoYearly": "One year, reminder 45 days before",
"pictoWithdrawal": "14 days to change your mind",
"pictoCancel": "Cancel in one click",
"pictoTax": "All taxes included",
"recommended": "Recommended for your team",
"chooseTierAria": "Choose this tier: {{range}}, {{price}}",
"recapTitle": "Review before paying",
"recapTier": "Tier",
"recapInterval": "Billing",
"recapMonthly": "Monthly",
"recapYearly": "Yearly",
"recapToday": "Charged today",
"recapNext": "Next payment",
"recapNextValue": "{{date}}, same amount",
"recapWithdrawal": "Change your mind",
"recapWithdrawalValue": "until {{date}}",
"payWith": "Pay {{amount}} with Stripe",
"checkBoxRequired": "Tick the box to continue.",
"redirectTitle": "Heading to Stripe for secure payment",
"redirectBody": "Your card details never pass through COSMO.",
"activationWaitTitle": "Payment received, activating…",
"activationWaitBody": "Stripe is confirming your subscription. This page updates by itself.",
"activationTimeout": "Your payment went through. Activation is taking longer than usual: reload the page in a minute, or write to contact@thecosmo.app.",
"welcomeTitle": "Welcome to the {{tier}} tier",
"welcomeBody": "The confirmation is on its way to the owner by email.",
"welcomeInvite": "Invite members",
"welcomeClose": "Close",
"pastDueTitle": "The payment of {{date}} didn't go through",
"pastDueTitleNoDate": "The last payment didn't go through",
"pastDueBody": "Your {{count}} members keep full access. New invitations are paused until the card is updated. Stripe retries automatically over the next few days.",
"pastDueCta": "Update my card",
"endsTitle": "Your subscription ends on {{date}}",
"endsBody": "No further charges. Everything stays available until then.",
"timelineLabel": "End of subscription",
"timelineToday": "Today",
"timelineEnd": "Access ends on {{date}}",
"timelineFree": "Free tier",
"endsOverQuota": "After {{date}}, the free tier has {{quota}} seats. Your {{count}} members stay, but you won't be able to invite more.",
"resumeHint": "Same tier, same price, nothing else to do."
```

Modifier aussi la valeur de `billing.resumeCta` : fr « Reprendre mon abonnement », en « Resume my
subscription ».

- [ ] **Step 2 : ajouter les clés `orgAccount` (racine)**

fr :

```json
"historySentTo": "Envoyées à {{email}}",
"historyEdit": "Modifier",
"historyPillPaid": "Payée",
"historyPillFailed": "Échouée",
"historyPillRefund": "Remboursée",
"historyPillOther": "Autre"
```

en :

```json
"historySentTo": "Sent to {{email}}",
"historyEdit": "Edit",
"historyPillPaid": "Paid",
"historyPillFailed": "Failed",
"historyPillRefund": "Refunded",
"historyPillOther": "Other"
```

- [ ] **Step 3 : ajouter les clés `invite.*` (org)**

fr :

```json
"seatsFullOwner": "Les {{quota}} places sont prises. Pour inviter {{who}}, passez au palier {{tier}} : {{price}} TTC par mois, au lieu de {{current}}.",
"seatsFullOwnerFromFree": "Les {{quota}} places sont prises. Pour inviter {{who}}, passez au palier {{tier}} : {{price}} TTC par mois.",
"someoneMore": "une personne de plus",
"upgradeCta": "Passer au palier supérieur",
"freeSeatCta": "Libérer une place",
"seatsFullMember": "Les places sont prises. Seul le propriétaire peut changer de palier."
```

en :

```json
"seatsFullOwner": "All {{quota}} seats are taken. To invite {{who}}, move to the {{tier}} tier: {{price}} per month incl. VAT, instead of {{current}}.",
"seatsFullOwnerFromFree": "All {{quota}} seats are taken. To invite {{who}}, move to the {{tier}} tier: {{price}} per month incl. VAT.",
"someoneMore": "one more person",
"upgradeCta": "Upgrade tier",
"freeSeatCta": "Free up a seat",
"seatsFullMember": "All seats are taken. Only the owner can change the tier."
```

- [ ] **Step 4 : vérifier**

Run : `npm run i18n:check ; echo "exit=$?"` puis `npm run i18n:identical ; echo "exit=$?"`
Expected : `exit=0` les deux (`i18n:check` contrôle la parité fr/en et les variables, pas les
clés inutilisées). Les clés devenues inutiles sont retirées à la tâche 13, une fois le code qui les
lisait supprimé.

- [ ] **Step 5 : commit**

```bash
git commit -m "i18n(billing): libelles du parcours de facturation, fr et en" -- src/locales/fr/orgAdmin.json src/locales/en/orgAdmin.json src/locales/fr/orgAccount.json src/locales/en/orgAccount.json src/locales/fr/org.json src/locales/en/org.json
```

---

### Task 5 : utilitaires d'affichage partagés

**Files :**
- Create : `src/components/organization/billing-ui.ts`

- [ ] **Step 1 : créer le fichier**

```ts
import { useT } from '@/i18n/useT';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgTierKey } from '@/modules/billing/premium-config';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';

/** Tons des pastilles de l'onglet Abonnement : une seule table, quatre usages. */
export const PILL_TONE = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-300',
  neutral: 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]',
} as const;

export type PillTone = keyof typeof PILL_TONE;

export const PILL_BASE = 'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold';

/**
 * Le libellé d'un palier tel que la grille l'écrit : l'effectif (« 5 à 10
 * membres »), ou « Illimité » pour le dernier. Le récapitulatif et l'écran de
 * bienvenue disent le MÊME mot que la carte cliquée.
 */
export function useTierRangeLabel(): (key: OrgTierKey) => string {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { t: tc } = useT('common');
  return (key) => {
    const tier = ENTERPRISE_PRICING_TIERS.find((x) => x.key === key);
    if (!tier || tier.maxMembers === null) return tc(ORG_TIER_LABEL_KEYS[key]);
    return tOrgAdmin('billing.rangeUpTo', { min: tier.minMembers, max: tier.maxMembers });
  };
}
```

- [ ] **Step 2 : vérifier les types**

Run : `npm run typecheck ; echo "exit=$?"`
Expected : `exit=0`.

- [ ] **Step 3 : commit**

```bash
git add src/components/organization/billing-ui.ts
git commit -m "feat(billing): tons de pastille et libelle de palier partages" -- src/components/organization/billing-ui.ts
```

---

### Task 6 : pictos précontractuels

**Files :**
- Create : `src/components/organization/OrgPrecontractualPictos.tsx`
- Test : `src/components/organization/OrgPrecontractualPictos.test.tsx`

- [ ] **Step 1 : écrire le test qui échoue**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrgPrecontractualPictos } from './OrgPrecontractualPictos';

describe('OrgPrecontractualPictos', () => {
  it('quatre pictos et le texte légal COMPLET, sans repli', () => {
    render(<OrgPrecontractualPictos interval="monthly" />);
    const zone = screen.getByRole('region', { name: /l'essentiel du contrat/i });
    expect(within(zone).getAllByRole('listitem')).toHaveLength(4);
    expect(within(zone).getByText('Sans engagement')).toBeTruthy();
    expect(within(zone).getByText(/reconduit automatiquement à chaque échéance/i)).toBeTruthy();
    expect(within(zone).getByText(/droit de rétractation de 14 jours/i)).toBeTruthy();
  });

  it('en annuel, le premier picto annonce l engagement et le rappel', () => {
    render(<OrgPrecontractualPictos interval="yearly" />);
    expect(screen.getByText('Un an, rappel 45 jours avant')).toBeTruthy();
    expect(screen.queryByText('Sans engagement')).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/components/organization/OrgPrecontractualPictos.test.tsx ; echo "exit=$?"`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

```tsx
import { CalendarClock, CalendarOff, LogOut, Receipt, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { OrgBillingInterval } from '@/modules/billing/premium-config';

interface Props {
  interval: OrgBillingInterval;
}

/**
 * Information précontractuelle (L111-1, L221-5 ; LEGAL.md E2) posée AVANT le
 * choix d'un palier. Les pictos la rendent lisible ; ils ne la remplacent pas :
 * `billing.precontractual` reste affiché en entier juste dessous.
 * ❌ Ni repli, ni info-bulle, ni « en savoir plus ».
 */
export function OrgPrecontractualPictos({ interval }: Props) {
  const { t } = useT('orgAdmin');
  const items = [
    interval === 'yearly'
      ? { Icon: CalendarClock, label: t('billing.pictoYearly') }
      : { Icon: CalendarOff, label: t('billing.pictoNoCommitment') },
    { Icon: Undo2, label: t('billing.pictoWithdrawal') },
    { Icon: LogOut, label: t('billing.pictoCancel') },
    { Icon: Receipt, label: t('billing.pictoTax') },
  ];

  return (
    <section aria-label={t('billing.pictosLabel')} className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {items.map(({ Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-2 rounded-lg bg-[rgb(var(--color-hover))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
          >
            <Icon size={16} aria-hidden className="shrink-0 text-[rgb(var(--color-accent))]" />
            {label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.precontractual')}</p>
    </section>
  );
}

export default OrgPrecontractualPictos;
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/components/organization/OrgPrecontractualPictos.test.tsx ; echo "exit=$?"`
Expected : 2 PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add src/components/organization/OrgPrecontractualPictos.tsx src/components/organization/OrgPrecontractualPictos.test.tsx
git commit -m "feat(billing): pictos precontractuels au-dessus de la grille, texte legal complet" -- src/components/organization/OrgPrecontractualPictos.tsx src/components/organization/OrgPrecontractualPictos.test.tsx
```

---

### Task 7 : carte « Votre forfait »

**Files :**
- Create : `src/components/organization/OrgPlanCard.tsx`
- Test : `src/components/organization/OrgPlanCard.test.tsx`

- [ ] **Step 1 : écrire le test qui échoue**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgPlanCard } from './OrgPlanCard';
import type { OrgSubscription } from '@/modules/billing/org-billing.types';

const sub = (over: Partial<OrgSubscription> = {}): OrgSubscription => ({
  orgId: 'org-1', tierKey: 't20', maxMembers: 20, status: 'active', billingInterval: 'monthly',
  currentPeriodEnd: '2026-12-02T00:00:00.000Z', discountCode: null, startedAt: null, cancelAtPeriodEnd: false,
  ...over,
});

describe('OrgPlanCard', () => {
  it('palier gratuit plein : pastille d essai, jauge 5 sur 5, phrase « Complet »', () => {
    render(<OrgPlanCard subscription={null} memberCount={5} />);
    expect(screen.getByText("Palier d'essai")).toBeTruthy();
    expect(screen.getByText('5 sur 5')).toBeTruthy();
    expect(screen.getByRole('meter', { name: /sièges occupés/i }).getAttribute('aria-valuenow')).toBe('5');
    expect(screen.getByText(/complet\. le prochain membre/i)).toBeTruthy();
  });

  it('payant actif : pastille Actif et prochaine échéance au montant dérivé', () => {
    render(<OrgPlanCard subscription={sub()} memberCount={14} />);
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getByText(/prochaine échéance le .*150,00 €/i)).toBeTruthy();
  });

  it('impayé : pastille Paiement en attente, pas d échéance annoncée', () => {
    render(<OrgPlanCard subscription={sub({ status: 'past_due' })} memberCount={14} />);
    expect(screen.getByText('Paiement en attente')).toBeTruthy();
    expect(screen.queryByText(/prochaine échéance/i)).toBeNull();
  });

  it('résiliation programmée : pastille de fin, pas d échéance', () => {
    render(<OrgPlanCard subscription={sub({ cancelAtPeriodEnd: true })} memberCount={14} />);
    expect(screen.getByText(/se termine le/i)).toBeTruthy();
    expect(screen.queryByText(/prochaine échéance/i)).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/components/organization/OrgPlanCard.test.tsx ; echo "exit=$?"`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '@/i18n/useT';
import { formatCurrency, formatDate } from '@/i18n/format';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import { chargedTodayEur, effectiveQuota, effectiveTierKey } from '@/modules/billing/org-billing.logic';
import { ORG_TIER_LABEL_KEYS } from '@/modules/billing/org-tier-labels';
import type { OrgSubscription } from '@/modules/billing/org-billing.types';
import { PILL_BASE, PILL_TONE, type PillTone } from './billing-ui';

interface Props {
  subscription: OrgSubscription | null;
  memberCount: number;
}

/**
 * En tête de l'onglet Abonnement (spec 2026-11-02 § 3.1) : tout l'état en un
 * coup d'œil. Le nom du forfait est celui de la pastille de l'en-tête : les
 * deux doivent dire le même mot.
 *
 * La jauge anime sa LARGEUR (pas un transform) : sous mouvement réduit, elle
 * part directement de sa valeur (`initial={false}`), elle ne reste jamais à 0.
 */
export function OrgPlanCard({ subscription, memberCount }: Props) {
  const { t } = useT('orgAdmin');
  const { t: tc } = useT('common');
  const reduce = useReducedMotion();

  const quota = effectiveQuota(subscription);
  const planName = t('billing.planNamed', { name: tc(ORG_TIER_LABEL_KEYS[effectiveTierKey(subscription)]) });
  const ratio = quota === null ? 0 : Math.min(1, memberCount / Math.max(quota, 1));
  const full = quota !== null && memberCount >= quota;
  const near = !full && quota !== null && ratio >= 0.8;
  const tier = ENTERPRISE_PRICING_TIERS.find((x) => x.key === subscription?.tierKey);
  const showNextDue =
    subscription?.status === 'active' &&
    subscription.tierKey !== 'free' &&
    !subscription.cancelAtPeriodEnd &&
    !!subscription.currentPeriodEnd &&
    !!tier;

  let pill: { tone: PillTone; label: string };
  if (subscription?.status === 'past_due') pill = { tone: 'warning', label: t('billing.pillPastDue') };
  else if (subscription?.status === 'active' && subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd)
    pill = { tone: 'neutral', label: t('billing.pillEnds', { date: formatDate(new Date(subscription.currentPeriodEnd)) }) };
  else if (subscription?.status === 'active' && subscription.tierKey !== 'free') pill = { tone: 'success', label: t('billing.pillActive') };
  else pill = { tone: 'neutral', label: t('billing.pillTrial') };

  return (
    <section
      aria-labelledby="org-plan-card-title"
      className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <p id="org-plan-card-title" className="text-xs text-[rgb(var(--color-text-secondary))]">
            {t('billing.planCardLabel')}
          </p>
          <p className="text-xl font-semibold text-[rgb(var(--color-text-primary))]">{planName}</p>
        </div>
        <span className={`${PILL_BASE} ${PILL_TONE[pill.tone]}`}>{pill.label}</span>
      </div>

      {quota === null ? (
        <p className="text-sm text-[rgb(var(--color-text-primary))]">
          {t('billing.seatsUnlimited', { count: memberCount })}
        </p>
      ) : (
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-[rgb(var(--color-text-secondary))]">
            <span>{t('billing.seatsGaugeLabel')}</span>
            <span className="tabular-nums">{t('billing.seatsGauge', { count: memberCount, quota })}</span>
          </div>
          <div
            role="meter"
            aria-label={t('billing.seatsGaugeLabel')}
            aria-valuemin={0}
            aria-valuemax={quota}
            aria-valuenow={Math.min(memberCount, quota)}
            className="h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
          >
            <motion.div
              className={`h-full rounded-full ${full || near ? 'bg-amber-500' : 'bg-[rgb(var(--color-accent))]'}`}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${ratio * 100}%` }}
              transition={{ duration: reduce ? 0 : 1, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          {full && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t('billing.seatsFullHint')}</p>
          )}
          {near && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {t('billing.seatsNearHint', { left: quota - memberCount, quota })}
            </p>
          )}
        </div>
      )}

      {subscription?.discountCode && (
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          {t('billing.discountApplied', { code: subscription.discountCode })}
        </p>
      )}

      {showNextDue && subscription?.currentPeriodEnd && tier && (
        <p className="border-t border-[rgb(var(--color-border))] pt-3 text-sm text-[rgb(var(--color-text-secondary))]">
          {t('billing.nextDue', {
            date: formatDate(new Date(subscription.currentPeriodEnd)),
            amount: formatCurrency(chargedTodayEur(tier.priceEurPerMonth, subscription.billingInterval)),
          })}
        </p>
      )}
    </section>
  );
}

export default OrgPlanCard;
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/components/organization/OrgPlanCard.test.tsx ; echo "exit=$?"`
Expected : 4 PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add src/components/organization/OrgPlanCard.tsx src/components/organization/OrgPlanCard.test.tsx
git commit -m "feat(billing): carte Votre forfait, jauge de sieges et prochaine echeance" -- src/components/organization/OrgPlanCard.tsx src/components/organization/OrgPlanCard.test.tsx
```

---

### Task 8 : grille cliquable, palier conseillé, fondu des prix

**Files :**
- Modify : `src/components/organization/EnterpriseTierGrid.tsx`
- Test : `src/components/organization/EnterpriseTierGrid.test.tsx`

Les libellés de prix existants (`billing.perMonth`, `billing.perMonthBilledYearly`) sont
**conservés** : ils disent déjà ce que la spec demande, et leurs tests restent valides.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter dans `EnterpriseTierGrid.test.tsx` (le fichier rend déjà la grille ; réutiliser son
helper de rendu s'il existe, sinon `render(<EnterpriseTierGrid … />)`) :

```tsx
import { fireEvent } from '@testing-library/react';

describe('carte cliquable et palier conseillé', () => {
  it('la carte entière choisit le palier, nommée pour un lecteur d écran', () => {
    const onSelect = vi.fn();
    render(<EnterpriseTierGrid onSelect={onSelect} interval="monthly" />);
    fireEvent.click(screen.getByRole('button', { name: /choisir ce palier : 10 à 20 membres/i }));
    expect(onSelect).toHaveBeenCalledWith('t20');
  });

  it('la pastille « Conseillé » suit recommendedKey, jamais le palier actif', () => {
    const { rerender } = render(<EnterpriseTierGrid onSelect={vi.fn()} recommendedKey="t20" />);
    expect(screen.getAllByText('Conseillé pour votre équipe')).toHaveLength(1);
    rerender(<EnterpriseTierGrid onSelect={vi.fn()} recommendedKey="t20" currentTier="t20" />);
    expect(screen.queryByText('Conseillé pour votre équipe')).toBeNull();
  });

  it('sans onSelect (non propriétaire), aucune carte n est un bouton', () => {
    render(<EnterpriseTierGrid />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
```

(Ajouter `vi` à l'import `vitest` du fichier s'il n'y est pas.)

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/components/organization/EnterpriseTierGrid.test.tsx ; echo "exit=$?"`
Expected : les trois nouveaux FAIL, les anciens PASS.

- [ ] **Step 3 : implémenter**

Remplacer tout `EnterpriseTierGrid.tsx` par :

```tsx
import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ENTERPRISE_PRICING_TIERS, displayedMonthlyEur, yearlyTotalEur } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { formatCurrency, formatPrice } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useTierRangeLabel, PILL_BASE } from './billing-ui';

interface Props {
  /** Palier actuellement actif, mis en avant. */
  currentTier?: OrgTierKey;
  /** Absent = grille purement informative (pas propriétaire, ou flag dormant). */
  onSelect?: (tier: OrgTierKey) => void;
  isPending?: boolean;
  /**
   * Périodicité affichée. Elle ne change QUE le montant : les bornes d'effectif
   * et le quota de sièges sont portés par le palier seul, dans les deux cas.
   */
  interval?: OrgBillingInterval;
  /**
   * La facturation est-elle éteinte pour TOUT LE MONDE
   * (`ENTERPRISE_BILLING_ENFORCED === false`) ? Distinct de `!onSelect` : un
   * membre non propriétaire n'a pas de `onSelect` alors que son organisation
   * peut très bien être facturée.
   */
  dormant?: boolean;
  /** Palier conseillé (`recommendedTier`). Sans pastille s'il est déjà actif. */
  recommendedKey?: OrgTierKey;
}

/**
 * Grille des paliers. Montants issus de `ENTERPRISE_PRICING_TIERS`, rendus par
 * `formatCurrency` : jamais de montant en dur, et ❌ JAMAIS de compteur animé
 * sur un prix (il passerait par 48 € avant de se poser sur 50 €). Au changement
 * de périodicité, le bloc prix se remplace en FONDU, rien ne défile.
 *
 * Depuis le 2026-11-02, la carte entière se clique (spec § 3.2) et porte un
 * `layoutId` : le récapitulatif reprend le même, la carte s'y déploie.
 *
 * Facturation éteinte (`dormant`) : le prix d'un palier payant est REMPLACÉ par
 * « Gratuit », le tarif d'après barré dessous, comme sur la landing.
 */
export function EnterpriseTierGrid({
  currentTier,
  onSelect,
  isPending,
  dormant,
  interval = 'monthly',
  recommendedKey,
}: Props) {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const rangeLabel = useTierRangeLabel();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ENTERPRISE_PRICING_TIERS.map((tier) => {
        const isCurrent = currentTier === tier.key;
        const isFree = tier.priceEurPerMonth === 0;
        const isPromo = dormant && !isFree;
        const monthlyShown = displayedMonthlyEur(tier.priceEurPerMonth, interval);
        const label = rangeLabel(tier.key);
        const isRecommended = recommendedKey === tier.key && !isCurrent;
        const clickable = !isFree && !isCurrent && !dormant && !!onSelect;

        const body = (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{label}</span>
              {isCurrent && <Check size={16} className="shrink-0 text-[rgb(var(--color-accent))]" aria-hidden />}
            </div>
            {isRecommended && (
              <span className={`${PILL_BASE} bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]`}>
                {tOrgAdmin('billing.recommended')}
              </span>
            )}

            {isFree || isPromo ? (
              <>
                <div className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{tOrgAdmin('billing.free')}</div>
                {isPromo && (
                  <s className="text-xs text-[rgb(var(--color-text-muted))] decoration-[rgb(var(--color-border-strong))]">
                    {tOrgAdmin('billing.insteadOf', { price: formatPrice(monthlyShown) })}
                  </s>
                )}
              </>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={interval}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold tabular-nums text-[rgb(var(--color-text-primary))]">
                      {formatCurrency(monthlyShown)}{' '}
                      <span className="text-sm font-medium text-[rgb(var(--color-text-secondary))]">
                        {tOrgAdmin('billing.vatSuffix')}
                      </span>
                    </span>
                    {interval === 'yearly' && (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        {tOrgAdmin('billing.intervalSave')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[rgb(var(--color-text-secondary))]">
                    {interval === 'yearly'
                      ? tOrgAdmin('billing.perMonthBilledYearly', {
                          total: `${formatCurrency(yearlyTotalEur(tier.priceEurPerMonth))} ${tOrgAdmin('billing.vatSuffix')}`,
                        })
                      : tOrgAdmin('billing.perMonth')}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </>
        );

        const frame = `rounded-xl p-4 flex flex-col gap-2 text-left ${
          isCurrent
            ? 'border border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)]'
            : isRecommended
              ? 'border-2 border-[rgb(var(--color-accent))]'
              : 'border border-[rgb(var(--color-border))]'
        }`;

        return clickable ? (
          <motion.button
            key={tier.key}
            type="button"
            layoutId={`org-tier-${tier.key}`}
            disabled={isPending}
            onClick={() => onSelect?.(tier.key)}
            aria-label={tOrgAdmin('billing.chooseTierAria', {
              range: label,
              price: `${formatCurrency(monthlyShown)} ${tOrgAdmin('billing.vatSuffix')}`,
            })}
            className={`${frame} transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[rgb(var(--color-border-strong))] motion-reduce:hover:translate-y-0 disabled:opacity-60`}
          >
            {body}
          </motion.button>
        ) : (
          <motion.div key={tier.key} layoutId={`org-tier-${tier.key}`} className={frame}>
            {body}
          </motion.div>
        );
      })}
    </div>
  );
}

export default EnterpriseTierGrid;
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/components/organization/EnterpriseTierGrid.test.tsx ; echo "exit=$?"`
Expected : tous PASS (anciens et nouveaux), `exit=0`.

- [ ] **Step 5 : commit**

```bash
git commit -m "feat(billing): carte de palier cliquable, palier conseille, prix en fondu" -- src/components/organization/EnterpriseTierGrid.tsx src/components/organization/EnterpriseTierGrid.test.tsx
```

---

### Task 9 : sélecteur mensuel/annuel, pastille qui glisse

**Files :**
- Modify : `src/components/organization/BillingIntervalToggle.tsx`

- [ ] **Step 1 : implémenter**

Ajouter `import { motion } from 'framer-motion';`, puis remplacer le `<button>` de la boucle :

```tsx
<button
  key={interval}
  type="button"
  role="radio"
  aria-checked={isActive}
  disabled={disabled}
  onClick={() => onChange(interval)}
  className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
    isActive
      ? 'text-[rgb(var(--color-accent-solid-foreground))]'
      : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
  }`}
>
  {/* Pastille partagée (`layoutId`) : elle glisse d'une option à l'autre.
      Sous mouvement réduit, Framer coupe l'animation de layout et la pastille
      se pose directement : aucune position ne dépend du mouvement. */}
  {isActive && (
    <motion.span
      layoutId="billing-interval-pill"
      aria-hidden
      className="absolute inset-0 rounded-full bg-[rgb(var(--color-accent-solid))]"
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
    />
  )}
  <span className="relative">
    {interval === 'monthly' ? tOrgAdmin('billing.intervalMonthly') : tOrgAdmin('billing.intervalYearly')}
  </span>
  {interval === 'yearly' && (
    <span
      className={`relative rounded-full px-1.5 py-0.5 text-caption font-semibold ${
        isActive
          ? 'bg-[rgb(var(--color-accent-solid-foreground)/0.2)]'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
      }`}
    >
      {tOrgAdmin('billing.intervalSave')}
    </span>
  )}
</button>
```

- [ ] **Step 2 : vérifier**

Run : `npx vitest run src/components/organization ; echo "exit=$?"`
Expected : `exit=0` (le sélecteur garde `role="radiogroup"` et ses `aria-checked`).

- [ ] **Step 3 : commit**

```bash
git commit -m "feat(billing): selecteur de periodicite a pastille glissante" -- src/components/organization/BillingIntervalToggle.tsx
```

---

### Task 10 : récapitulatif avant paiement et sortie vers Stripe

**Files :**
- Create : `src/components/organization/OrgCheckoutRecap.tsx`
- Test : `src/components/organization/OrgCheckoutRecap.test.tsx`

- [ ] **Step 1 : écrire le test qui échoue**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrgCheckoutRecap } from './OrgCheckoutRecap';

const base = {
  tierKey: 't10' as const,
  interval: 'monthly' as const,
  now: new Date(2026, 10, 2),
  isPending: false,
  isRedirecting: false,
  onCancel: vi.fn(),
};

describe('OrgCheckoutRecap', () => {
  it('dit le montant débité aujourd hui, l échéance et la fin du délai de rétractation', () => {
    render(<OrgCheckoutRecap {...base} immediateAccess={false} onImmediateAccessChange={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText('70,00 € TTC')).toBeTruthy();
    expect(screen.getByText(/même montant/i)).toBeTruthy();
    expect(screen.getByText(/jusqu'au/i)).toBeTruthy();
  });

  it('annuel : débité aujourd hui = total de l année', () => {
    render(<OrgCheckoutRecap {...base} interval="yearly" immediateAccess={false} onImmediateAccessChange={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText('630,00 € TTC')).toBeTruthy();
  });

  it('case non cochée : le bouton reste cliquable, explique, et ne paie pas', () => {
    const onPay = vi.fn();
    render(<OrgCheckoutRecap {...base} immediateAccess={false} onImmediateAccessChange={vi.fn()} onPay={onPay} />);
    const box = screen.getByRole('checkbox', { name: /je demande l'accès immédiat au service/i }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /payer 70,00 € avec stripe/i }));
    expect(onPay).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/cochez la case/i);
  });

  it('case cochée : un clic paie une fois', () => {
    const onPay = vi.fn();
    render(<OrgCheckoutRecap {...base} immediateAccess onImmediateAccessChange={vi.fn()} onPay={onPay} />);
    fireEvent.click(screen.getByRole('button', { name: /payer 70,00 € avec stripe/i }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });

  it('pendant la redirection : panneau Stripe, plus de bouton de paiement', () => {
    render(<OrgCheckoutRecap {...base} isPending immediateAccess onImmediateAccessChange={vi.fn()} onPay={vi.fn()} />);
    expect(screen.getByText(/direction stripe/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /payer/i })).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/components/organization/OrgCheckoutRecap.test.tsx ; echo "exit=$?"`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatCurrency, formatDate } from '@/i18n/format';
import { ENTERPRISE_PRICING_TIERS } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { chargedTodayEur, nextDueDate, withdrawalDeadline } from '@/modules/billing/org-billing.logic';
import { PILL_BASE, useTierRangeLabel } from './billing-ui';

interface Props {
  tierKey: OrgTierKey;
  interval: OrgBillingInterval;
  /** Injecté par les tests ; sinon l'instant du rendu. */
  now?: Date;
  /** Appel à `stripe-org-checkout` en cours. */
  isPending: boolean;
  /** L'URL Stripe est reçue, la navigation part. */
  isRedirecting: boolean;
  immediateAccess: boolean;
  onImmediateAccessChange: (checked: boolean) => void;
  onPay: () => void;
  onCancel: () => void;
}

/**
 * Récapitulatif avant paiement (spec 2026-11-02 § 3.3). La carte de la grille
 * s'y déploie : même `layoutId` (`org-tier-<palier>`).
 *
 * La case d'accès immédiat ne change pas sur le fond (L221-13, L221-25) : non
 * cochée par défaut, obligatoire, revérifiée par le serveur. Ce qui change :
 * le bouton n'est plus grisé en silence, il dit pourquoi il ne part pas.
 *
 * La pulsation du bouton est un `scale` qui part de 1 et y revient : sous
 * mouvement réduit elle ne joue pas, et rien ne reste décalé.
 */
export function OrgCheckoutRecap({
  tierKey,
  interval,
  now = new Date(),
  isPending,
  isRedirecting,
  immediateAccess,
  onImmediateAccessChange,
  onPay,
  onCancel,
}: Props) {
  const { t } = useT('orgAdmin');
  const rangeLabel = useTierRangeLabel();
  const [showRequired, setShowRequired] = useState(false);
  const tier = ENTERPRISE_PRICING_TIERS.find((x) => x.key === tierKey);
  if (!tier) return null;

  const today = `${formatCurrency(chargedTodayEur(tier.priceEurPerMonth, interval))} ${t('billing.vatSuffix')}`;
  const amount = formatCurrency(chargedTodayEur(tier.priceEurPerMonth, interval));

  if (isPending || isRedirecting) {
    return (
      <motion.div
        role="status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] px-4 py-8 text-center"
      >
        <ShieldCheck size={24} aria-hidden className="text-[rgb(var(--color-accent))]" />
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.redirectTitle')}</p>
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.redirectBody')}</p>
        <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-[rgb(var(--color-hover))]">
          <div className="h-full w-1/3 rounded-full bg-[rgb(var(--color-accent))] animate-pulse motion-reduce:animate-none" />
        </div>
      </motion.div>
    );
  }

  const rows: Array<[string, string]> = [
    [t('billing.recapInterval'), interval === 'yearly' ? t('billing.recapYearly') : t('billing.recapMonthly')],
    [t('billing.recapToday'), today],
    [t('billing.recapNext'), t('billing.recapNextValue', { date: formatDate(nextDueDate(now, interval)) })],
    [t('billing.recapWithdrawal'), t('billing.recapWithdrawalValue', { date: formatDate(withdrawalDeadline(now)) })],
  ];

  return (
    <motion.section
      layoutId={`org-tier-${tierKey}`}
      role="region"
      aria-label={t('billing.recapTitle')}
      className="flex flex-col gap-3 rounded-xl border-2 border-[rgb(var(--color-accent))] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.recapTitle')}</h3>
        <span className={`${PILL_BASE} bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]`}>
          {rangeLabel(tierKey)}
        </span>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm tabular-nums">
        {rows.map(([label, value], i) => (
          <div key={label} className="contents">
            <dt className="text-[rgb(var(--color-text-secondary))]">{label}</dt>
            <dd className={`text-right text-[rgb(var(--color-text-primary))] ${i === 1 ? 'text-base font-semibold' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <label className="flex items-start gap-2 rounded-lg bg-[rgb(var(--color-hover))] p-3 text-sm text-[rgb(var(--color-text-primary))]">
        <input
          type="checkbox"
          checked={immediateAccess}
          onChange={(e) => {
            onImmediateAccessChange(e.target.checked);
            setShowRequired(false);
          }}
          className="mt-1"
        />
        <span>
          {t('billing.immediateAccessLabel')}{' '}
          <a href="/cgu" target="_blank" rel="noreferrer" className="underline">
            {t('billing.cgvLink')}
          </a>
        </span>
      </label>

      {showRequired && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {t('billing.checkBoxRequired')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          type="button"
          onClick={() => (immediateAccess ? onPay() : setShowRequired(true))}
          animate={immediateAccess ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={{ duration: 0.6 }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            immediateAccess
              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))]'
              : 'border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]'
          }`}
        >
          <Lock size={14} aria-hidden /> {t('billing.payWith', { amount })}
        </motion.button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-[rgb(var(--color-text-secondary))]">
          {t('billing.confirmTierCancel')}
        </button>
      </div>
    </motion.section>
  );
}

export default OrgCheckoutRecap;
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/components/organization/OrgCheckoutRecap.test.tsx ; echo "exit=$?"`
Expected : 5 PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add src/components/organization/OrgCheckoutRecap.tsx src/components/organization/OrgCheckoutRecap.test.tsx
git commit -m "feat(billing): recapitulatif avant paiement et sortie vers Stripe" -- src/components/organization/OrgCheckoutRecap.tsx src/components/organization/OrgCheckoutRecap.test.tsx
```

---

### Task 11 : activation au retour de Stripe

**Files :**
- Create : `src/components/organization/OrgActivationState.tsx`
- Test : `src/components/organization/OrgActivationState.test.tsx`

- [ ] **Step 1 : écrire le test qui échoue**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OrgActivationState } from './OrgActivationState';

const renderPhase = (phase: 'waiting' | 'timeout' | 'welcome', onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <OrgActivationState phase={phase} tierLabel="5 à 10 membres" membersHref="/entreprise/members" onClose={onClose} />
    </MemoryRouter>,
  );

describe('OrgActivationState', () => {
  it('attente : message d activation, annoncé', () => {
    renderPhase('waiting');
    expect(screen.getByRole('status').textContent).toMatch(/activation en cours/i);
  });

  it('délai dépassé : rassure sur le paiement et donne un recours', () => {
    renderPhase('timeout');
    expect(screen.getByText(/votre paiement est bien reçu/i)).toBeTruthy();
    expect(screen.getByText(/contact@thecosmo\.app/)).toBeTruthy();
  });

  it('bienvenue : nomme le palier, mène aux membres, se ferme', () => {
    const onClose = vi.fn();
    renderPhase('welcome', onClose);
    expect(screen.getByText('Bienvenue dans le palier 5 à 10 membres')).toBeTruthy();
    expect(screen.getByRole('link', { name: /inviter des membres/i }).getAttribute('href')).toBe('/entreprise/members');
    fireEvent.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/components/organization/OrgActivationState.test.tsx ; echo "exit=$?"`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

```tsx
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, UserPlus } from 'lucide-react';
import { useT } from '@/i18n/useT';

export type ActivationPhase = 'waiting' | 'timeout' | 'welcome';

interface Props {
  phase: ActivationPhase;
  tierLabel: string;
  membersHref: string;
  onClose: () => void;
}

/** Couleurs du logo (`public/logo-128.webp`), pas des jetons de thème : c'est la marque. */
const PLANET = '#4f46e5';
const RING = '#2dd4bf';
const OUTLINE = '#1a1744';

/**
 * Orbite de bienvenue (animation 6). Une seule révolution, pas de boucle : rien
 * à mettre en pause (WCAG 2.2.2 ne s'applique qu'au mouvement qui dure).
 *
 * Le `motion.g` contient un cercle invisible de la taille de l'orbite : Framer
 * fait tourner un élément SVG autour du centre de sa boîte (`fill-box`), ce
 * cercle met ce centre sur la planète. Rotation de 0 à 360 : sous mouvement
 * réduit elle ne joue pas et le satellite reste à sa place finale.
 */
function Orbit() {
  const reduce = useReducedMotion();
  return (
    <svg width="96" height="96" viewBox="0 0 120 120" aria-hidden className="shrink-0">
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgb(var(--color-border-strong))" strokeDasharray="3 5" />
      <motion.g initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 2.4, ease: [0.4, 0, 0.2, 1] }}>
        <circle cx="60" cy="60" r="38" fill="none" />
        <circle cx="98" cy="60" r="7" fill={RING} stroke={OUTLINE} strokeWidth="2" />
      </motion.g>
      <circle cx="60" cy="60" r="18" fill={PLANET} stroke={OUTLINE} strokeWidth="3" />
      {[
        [18, 22, 2],
        [104, 18, 1.5],
        [22, 100, 1.5],
      ].map(([cx, cy, r], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="rgb(var(--color-text-muted))"
          animate={reduce ? undefined : { opacity: [1, 0.2, 1, 0.2, 1] }}
          transition={{ duration: 3.2, delay: i * 0.4 }}
        />
      ))}
    </svg>
  );
}

export function OrgActivationState({ phase, tierLabel, membersHref, onClose }: Props) {
  const { t } = useT('orgAdmin');

  if (phase === 'waiting') {
    return (
      <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] px-4 py-8 text-center">
        <Loader2 size={24} aria-hidden className="animate-spin motion-reduce:animate-none text-[rgb(var(--color-accent))]" />
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.activationWaitTitle')}</p>
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.activationWaitBody')}</p>
      </div>
    );
  }

  if (phase === 'timeout') {
    return (
      <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
        {t('billing.activationTimeout')}
      </div>
    );
  }

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-[rgb(var(--color-border))] p-4"
    >
      <Orbit />
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <p className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">{t('billing.welcomeTitle', { tier: tierLabel })}</p>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('billing.welcomeBody')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to={membersHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))]"
          >
            <UserPlus size={14} aria-hidden /> {t('billing.welcomeInvite')}
          </Link>
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-[rgb(var(--color-text-secondary))]">
            {t('billing.welcomeClose')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default OrgActivationState;
```

- [ ] **Step 4 : vérifier le succès**

Run : `npx vitest run src/components/organization/OrgActivationState.test.tsx ; echo "exit=$?"`
Expected : 3 PASS, `exit=0`.

- [ ] **Step 5 : commit**

```bash
git add src/components/organization/OrgActivationState.tsx src/components/organization/OrgActivationState.test.tsx
git commit -m "feat(billing): activation au retour de Stripe, delai depasse et bienvenue en orbite" -- src/components/organization/OrgActivationState.tsx src/components/organization/OrgActivationState.test.tsx
```

---

### Task 12 : résiliation programmée

**Files :**
- Modify : `src/components/organization/OrgWithdrawCancel.tsx`

- [ ] **Step 1 : ajouter `memberCount` et réécrire la branche `cancelAtPeriodEnd`**

Ajouter aux imports : `import { ORG_FREE_SEATS } from '@/modules/billing/premium-config';`.
Ajouter à `Props` : `memberCount: number;` et le déstructurer dans la signature.

Remplacer la branche `subscription.cancelAtPeriodEnd ? ( <div …> … </div> )` par :

```tsx
<div className="flex flex-col gap-3">
  <div>
    <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
      {t('billing.endsTitle', { date: periodEnd })}
    </h3>
    <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.endsBody')}</p>
  </div>
  {/* Frise en liste ordonnée : lisible sans le dessin. La date de
      résiliation n'est pas lue (aucune colonne), le jalon est omis. */}
  <ol
    aria-label={t('billing.timelineLabel')}
    className="relative grid grid-cols-3 gap-2 text-xs before:absolute before:left-0 before:right-0 before:top-[5px] before:h-0.5 before:bg-[rgb(var(--color-border))]"
  >
    {[
      { label: t('billing.timelineToday'), dot: 'bg-[rgb(var(--color-accent))]', text: 'text-[rgb(var(--color-accent))]' },
      { label: t('billing.timelineEnd', { date: periodEnd }), dot: 'bg-[rgb(var(--color-text-primary))]', text: 'text-[rgb(var(--color-text-primary))]' },
      { label: t('billing.timelineFree'), dot: 'bg-[rgb(var(--color-border-strong))]', text: 'text-[rgb(var(--color-text-secondary))]' },
    ].map((step) => (
      <li key={step.label} className={`relative flex flex-col gap-1.5 ${step.text}`}>
        <span aria-hidden className={`h-3 w-3 rounded-full ${step.dot}`} />
        {step.label}
      </li>
    ))}
  </ol>
  {memberCount > ORG_FREE_SEATS && (
    <p className="rounded-lg bg-[rgb(var(--color-hover))] p-3 text-xs text-[rgb(var(--color-text-secondary))]">
      {t('billing.endsOverQuota', { date: periodEnd, quota: ORG_FREE_SEATS, count: memberCount })}
    </p>
  )}
  <div className="flex flex-wrap items-center gap-3">
    <button
      type="button"
      disabled={action.isPending}
      onClick={() => action.mutate({ orgId, action: 'resume' })}
      className="rounded-lg border-2 border-[rgb(var(--color-accent))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-accent))] disabled:opacity-60"
    >
      {t('billing.resumeCta')}
    </button>
    <span className="text-xs text-[rgb(var(--color-text-secondary))]">{t('billing.resumeHint')}</span>
  </div>
</div>
```

🔴 Ne pas toucher aux branches « rétractation » et « résiliation » : une page, un bouton, ni case
ni questionnaire (L215-1-1).

- [ ] **Step 2 : vérifier les types**

Run : `npm run typecheck ; echo "exit=$?"`
Expected : une erreur dans `OrgBillingTab.tsx` (`memberCount` manquant). Elle est corrigée à la
tâche 13, qui passe la prop. Ne pas commiter avant.

---

### Task 13 : assemblage de l'onglet

**Files :**
- Modify : `src/components/organization/OrgBillingTab.tsx`
- Modify : `src/components/organization/OrgBillingTab.retractation.parcours.test.tsx`
- Modify : `src/locales/{fr,en}/orgAdmin.json` (clés devenues inutiles)

- [ ] **Step 1 : adapter les tests du parcours aux libellés de la spec**

Dans `OrgBillingTab.retractation.parcours.test.tsx` :

1. Test « résiliation programmée : on peut l annuler » : remplacer
   `{ name: /annuler la résiliation/i }` par `{ name: /reprendre mon abonnement/i }`.
2. Remplacer `const PAY = /continuer vers le paiement/i;` par `const PAY = /payer .* avec stripe/i;`.
3. Dans « aucune case avant le choix du palier… », remplacer la ligne
   `expect((screen.getByRole('button', { name: PAY }) as HTMLButtonElement).disabled).toBe(true);` par :

```tsx
    // Le bouton n'est plus grisé en silence : il explique, et ne paie pas.
    fireEvent.click(screen.getByRole('button', { name: PAY }));
    expect(screen.getByRole('alert').textContent).toMatch(/cochez la case/i);
```

4. Ajouter dans le `describe('paiement …')` :

```tsx
  it('avant la redirection, la trace du palier attendu est écrite', async () => {
    invoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/x' }, error: null });
    renderTab();
    const choose = await screen.findAllByRole('button', { name: /choisir ce palier/i });
    fireEvent.click(choose[0]);
    fireEvent.click(await screen.findByRole('checkbox', { name: BOX }));
    fireEvent.click(screen.getByRole('button', { name: PAY }));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const trace = JSON.parse(sessionStorage.getItem('cosmo_pending_checkout') ?? 'null');
    expect(trace?.orgId).toBe('org-1');
  });
```

5. Ajouter un `describe` pour le retour de Stripe, en tête de fichier après `renderTab` :

```tsx
function renderTabAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={qc}>
        <OrgBillingTab orgId="org-1" isOwner />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('retour de Stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appModeStore.setDemo(false);
    sessionStorage.clear();
    startedAt = new Date(Date.now() - 2 * DAY).toISOString();
    cancelAtPeriodEnd = false;
  });

  it('abonnement déjà actif sur le palier attendu : bienvenue, sans toast', async () => {
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't10', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=success');
    expect(await screen.findByText(/bienvenue dans le palier/i)).toBeTruthy();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('cosmo_pending_checkout')).toBeNull();
  });

  it('palier attendu pas encore actif : activation en cours', async () => {
    sessionStorage.setItem('cosmo_pending_checkout', JSON.stringify({ orgId: 'org-1', tierKey: 't50', interval: 'monthly', at: Date.now() }));
    renderTabAt('/?checkout=success');
    expect(await screen.findByText(/activation en cours/i)).toBeTruthy();
  });
});
```

Run : `npx vitest run src/components/organization/OrgBillingTab.retractation.parcours.test.tsx ; echo "exit=$?"`
Expected : FAIL sur les libellés et le retour de Stripe, `exit=1`.

- [ ] **Step 2 : réécrire `OrgBillingTab.tsx`**

Remplacer tout le fichier par :

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { toast } from '@/lib/toast';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { ENTERPRISE_BILLING_ENFORCED, ENTERPRISE_PRICING_TIERS, PRICES_VISIBLE } from '@/modules/billing/premium-config';
import type { OrgBillingInterval, OrgTierKey } from '@/modules/billing/premium-config';
import { useOrgSubscription, type AwaitActivation } from '@/modules/billing/org-billing.hooks';
import { useStartOrgCheckout, useOpenOrgPortal } from '@/modules/billing/org-billing.mutations';
import { ACTIVATION_TIMEOUT_MS, effectiveQuota, effectiveTierKey, isActivated, recommendedTier } from '@/modules/billing/org-billing.logic';
import { clearPendingCheckout, readPendingCheckout, writePendingCheckout } from '@/modules/billing/pending-checkout';
import { OrgWithdrawCancel } from './OrgWithdrawCancel';
import { EnterpriseTierGrid } from './EnterpriseTierGrid';
import { BillingIntervalToggle } from './BillingIntervalToggle';
import { OrgBillingSeats } from './OrgBillingSeats';
import { OrgBillingHistory } from './OrgBillingHistory';
import { OrgBillingContactCard } from './OrgBillingContactCard';
import { OrgPlanCard } from './OrgPlanCard';
import { OrgPrecontractualPictos } from './OrgPrecontractualPictos';
import { OrgCheckoutRecap } from './OrgCheckoutRecap';
import { OrgActivationState, type ActivationPhase } from './OrgActivationState';
import { useTierRangeLabel } from './billing-ui';
import { buildOrgLink } from './deep-link.helpers';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';

interface Props {
  orgId: string;
  isOwner: boolean;
  /** Retour à l'espace entreprise : cette vue n'a plus d'onglet actif. */
  onBack?: () => void;
}

const PAID_TIER_KEYS = new Set<string>(
  ENTERPRISE_PRICING_TIERS.filter((t) => t.priceEurPerMonth > 0).map((t) => t.key),
);

/**
 * Onglet Abonnement de l'espace entreprise (spec 2026-11-02, lot 1).
 *
 * Tant que `ENTERPRISE_BILLING_ENFORCED` est `false`, la grille reste visible
 * (elle informe) mais AUCUN CTA de paiement n'est monté. Le flag est la seule
 * condition : on doit pouvoir dire d'un coup d'œil si le produit facture.
 *
 * Retour de Stripe (`?checkout=success`) : plus de toast. L'onglet attend que
 * l'abonnement lu soit celui qu'on vient de payer (sondage BORNÉ, § 5.1), parce
 * que le webhook peut arriver après le client.
 */
export function OrgBillingTab({ orgId, isOwner, onBack }: Props) {
  // Membres lus depuis le cache que la page a déjà rempli : aucune requête de plus.
  const { data: members = [] } = useOrgMembers(orgId);
  const memberCount = members.length;
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const ownerId = activeOrg?.ownerId ?? '';
  const { t: tOrgAdmin } = useT('orgAdmin');
  const rangeLabel = useTierRangeLabel();
  const [searchParams, setSearchParams] = useSearchParams();

  const [awaiting, setAwaiting] = useState<AwaitActivation | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const { data: subscription } = useOrgSubscription(orgId, {
    awaitActivation: awaiting && !timedOut ? awaiting : null,
  });
  const checkout = useStartOrgCheckout();
  const portal = useOpenOrgPortal();

  // Périodicité affichée : état LOCAL, jamais persisté. Celle qui compte après
  // coup vient de Stripe via le webhook (`subscription.billingInterval`).
  const [billingInterval, setBillingInterval] = useState<OrgBillingInterval>('monthly');
  // Demande expresse d'accès immédiat (L221-13, L221-25) : NON cochée par
  // défaut, posée une fois le palier choisi, obligatoire pour payer.
  const [selectedTier, setSelectedTier] = useState<OrgTierKey | null>(null);
  const [immediateAccess, setImmediateAccess] = useState(false);

  const canPay = ENTERPRISE_BILLING_ENFORCED && isOwner;
  const showPrices = PRICES_VISIBLE || ENTERPRISE_BILLING_ENFORCED;

  // Paramètres consommés une fois, pour qu'un rafraîchissement ne rejoue rien :
  // `checkout` (retour de Stripe) et `tier` (lien « Passer au palier
  // supérieur » du flux d'invitation, qui ouvre le récapitulatif).
  const checkoutResult = searchParams.get('checkout');
  const tierParam = searchParams.get('tier');
  useEffect(() => {
    if (!checkoutResult && !tierParam) return;
    if (checkoutResult === 'success') {
      const pending = readPendingCheckout(orgId);
      setAwaiting({ tierKey: pending?.tierKey ?? null, deadline: Date.now() + ACTIVATION_TIMEOUT_MS });
      setTimedOut(false);
    }
    if (checkoutResult === 'cancelled') {
      clearPendingCheckout();
      toast.info(tOrgAdmin('billing.checkoutCancelled'));
    }
    if (tierParam && canPay && PAID_TIER_KEYS.has(tierParam)) {
      setSelectedTier(tierParam as OrgTierKey);
      setImmediateAccess(false);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    next.delete('tier');
    setSearchParams(next, { replace: true });
  }, [checkoutResult, tierParam, canPay, orgId, searchParams, setSearchParams, tOrgAdmin]);

  // La borne de 20 s : passé ce délai, plus de sondage, un message.
  useEffect(() => {
    if (!awaiting) return;
    const id = window.setTimeout(() => setTimedOut(true), Math.max(0, awaiting.deadline - Date.now()));
    return () => window.clearTimeout(id);
  }, [awaiting]);

  const activated = awaiting ? isActivated(subscription, awaiting.tierKey) : false;
  useEffect(() => {
    if (activated) clearPendingCheckout();
  }, [activated]);

  const phase: ActivationPhase | null = !awaiting ? null : activated ? 'welcome' : timedOut ? 'timeout' : 'waiting';

  const pay = () => {
    if (!selectedTier) return;
    writePendingCheckout({ orgId, tierKey: selectedTier, interval: billingInterval, at: Date.now() });
    checkout.mutate(
      { orgId, tierKey: selectedTier, interval: billingInterval, immediateAccess },
      {
        onError: (err: Error) => {
          clearPendingCheckout();
          // Le CODE de l'erreur, jamais son texte traduit (C-62) : l'annuel
          // indisponible ramène la grille sur le mensuel, qui fonctionne.
          if ('code' in err && err.code === 'yearly_unavailable') setBillingInterval('monthly');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="self-start -ml-1 mb-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
          >
            <ArrowLeft size={15} aria-hidden /> {tOrgAdmin('billing.back')}
          </button>
        )}
        <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('billing.title')}</h2>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.subtitle')}</p>
      </header>

      {phase && (
        <OrgActivationState
          phase={phase}
          tierLabel={rangeLabel(subscription?.tierKey ?? awaiting?.tierKey ?? 'free')}
          membersHref={buildOrgLink('members')}
          onClose={() => setAwaiting(null)}
        />
      )}

      <OrgPlanCard subscription={subscription ?? null} memberCount={memberCount} />

      <OrgBillingSeats
        members={members}
        ownerId={ownerId}
        quota={effectiveQuota(subscription ?? null)}
        orgId={orgId}
        currentUserId={user?.id}
        isAdmin={isOwner || members.some((m) => m.userId === user?.id && m.role === 'admin')}
      />

      {showPrices && (
        <section aria-labelledby="org-change-tier" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="org-change-tier" className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
              {tOrgAdmin('billing.changeTierTitle')}
            </h3>
            {ENTERPRISE_BILLING_ENFORCED && (
              <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} disabled={checkout.isPending} />
            )}
          </div>

          {!ENTERPRISE_BILLING_ENFORCED && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                {tOrgAdmin('billing.promoBadge')}
              </span>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.dormant')}</p>
            </div>
          )}
          {ENTERPRISE_BILLING_ENFORCED && !isOwner && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.ownerOnly')}</p>
          )}
          {ENTERPRISE_BILLING_ENFORCED && billingInterval === 'yearly' && (
            <p className="-mt-1 text-xs text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.intervalYearlyHint')}</p>
          )}

          {canPay && <OrgPrecontractualPictos interval={billingInterval} />}

          <LayoutGroup>
            <AnimatePresence initial={false}>
              {canPay && selectedTier ? (
                <OrgCheckoutRecap
                  key="recap"
                  tierKey={selectedTier}
                  interval={billingInterval}
                  isPending={checkout.isPending}
                  isRedirecting={checkout.isSuccess}
                  immediateAccess={immediateAccess}
                  onImmediateAccessChange={setImmediateAccess}
                  onPay={pay}
                  onCancel={() => setSelectedTier(null)}
                />
              ) : (
                <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EnterpriseTierGrid
                    currentTier={subscription?.tierKey}
                    recommendedKey={canPay ? recommendedTier(memberCount).key : undefined}
                    onSelect={
                      canPay
                        ? (tierKey) => {
                            // Choisir n'envoie PAS au paiement : le récapitulatif s'ouvre.
                            setSelectedTier(tierKey);
                            setImmediateAccess(false);
                          }
                        : undefined
                    }
                    isPending={checkout.isPending}
                    dormant={!ENTERPRISE_BILLING_ENFORCED}
                    interval={billingInterval}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </section>
      )}

      {canPay && subscription && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={portal.isPending}
            onClick={() => portal.mutate({ orgId })}
            className="self-start rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm disabled:opacity-60"
          >
            {tOrgAdmin('billing.manage')}
          </button>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">{tOrgAdmin('billing.manageHint')}</p>
        </div>
      )}

      {/* Rétractation (14 jours) et résiliation (fin de période, sans
          remboursement) : REMBOURSEMENT-RESILIATION.md §2 et §4. */}
      {canPay && subscription && effectiveTierKey(subscription) !== 'free' && (
        <OrgWithdrawCancel orgId={orgId} subscription={subscription} memberCount={memberCount} />
      )}

      {/* Historique et destinataire des factures : propriétaire seul (mig. 180). */}
      {isOwner && (
        <div className="grid gap-4 md:grid-cols-2 items-start">
          <OrgBillingHistory orgId={orgId} ownerEmail={user?.email} />
          <OrgBillingContactCard orgId={orgId} ownerEmail={user?.email} userId={user?.id} />
        </div>
      )}
    </div>
  );
}

export default OrgBillingTab;
```

`OrgBillingSeats` reçoit le même quota qu'avant (`effectiveQuota`) : seul son emplacement change.

- [ ] **Step 3 : retirer les clés devenues inutiles**

Run : `grep -rnE "billing\.(checkoutSuccess|goToPayment|confirmTierTitle|renewsOn|currentTier|billedMonthly|billedYearly|seatsUsed|statusPastDue|statusCancelled|subscribe|precontractual)\b" src --include=*.ts --include=*.tsx`

Supprimer de `fr/orgAdmin.json` **et** `en/orgAdmin.json` chaque clé **sans aucun résultat** dans
cette recherche (attendu : `checkoutSuccess`, `goToPayment`, `confirmTierTitle`, `renewsOn`,
`currentTier`, `billedMonthly`, `billedYearly`, `seatsUsed`, `statusPastDue`, `statusCancelled`,
`subscribe`). `precontractual` reste lu par les pictos : ne pas le supprimer.

- [ ] **Step 4 : vérifier**

Run : `npx vitest run src/components/organization src/modules/billing ; echo "exit=$?"`
Expected : tous PASS, `exit=0`. Compter les fichiers annoncés contre le nombre de
`*.test.ts(x)` des deux dossiers (`ls src/components/organization/*.test.tsx src/modules/billing/*.test.ts* | wc -l`).

Run : `npm run typecheck ; echo "exit=$?"` puis `npm run lint ; echo "exit=$?"` puis `npm run i18n:check ; echo "exit=$?"`
Expected : `exit=0` les trois.

- [ ] **Step 5 : commit**

```bash
git commit -m "feat(billing): onglet Abonnement reassemble, retour Stripe sans toast, resiliation programmee en frise" -- src/components/organization/OrgBillingTab.tsx src/components/organization/OrgBillingTab.retractation.parcours.test.tsx src/components/organization/OrgWithdrawCancel.tsx src/locales/fr/orgAdmin.json src/locales/en/orgAdmin.json
```

---

### Task 14 : historique des factures

**Files :**
- Modify : `src/components/organization/OrgBillingHistory.tsx`
- Test : `src/components/organization/OrgBillingTab.seats-history.test.tsx`

- [ ] **Step 1 : écrire le test qui échoue**

Dans le test « liste les paiements du journal… » de `OrgBillingTab.seats-history.test.tsx`,
après l'attente de `ACME-0001`, ajouter :

```tsx
    expect(within(section).getByText('Remboursée')).toBeTruthy();
    expect(within(section).getByText(/envoyées à/i)).toBeTruthy();
```

Run : `npx vitest run src/components/organization/OrgBillingTab.seats-history.test.tsx ; echo "exit=$?"`
Expected : FAIL sur « Remboursée ».

- [ ] **Step 2 : implémenter**

Dans `OrgBillingHistory.tsx` :

1. Imports à ajouter :

```tsx
import { Download } from 'lucide-react';
import { useOrgBillingContact } from '@/modules/billing/org-billing-account.hooks';
import { PILL_BASE, PILL_TONE, type PillTone } from './billing-ui';
```

2. Table des pastilles, sous `EVENT_KEYS` :

```tsx
const PILLS: Record<string, { key: KeyOf<'orgAccount'>; tone: PillTone }> = {
  'invoice.payment_succeeded': { key: 'historyPillPaid', tone: 'success' },
  'invoice.payment_failed': { key: 'historyPillFailed', tone: 'danger' },
  'charge.refunded': { key: 'historyPillRefund', tone: 'neutral' },
};
```

3. `Props` reçoit `ownerEmail?: string` ; dans le composant :

```tsx
  const { data: contact } = useOrgBillingContact(orgId, true);
  const recipient = contact?.email ?? ownerEmail;
```

4. Remplacer le `<h3 …>{t('historyTitle')}</h3>` par :

```tsx
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="org-billing-history" className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {t('historyTitle')}
        </h3>
        {recipient && (
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            {t('historySentTo', { email: recipient })} ·{' '}
            <a href="#org-billing-contact" className="underline">{t('historyEdit')}</a>
          </p>
        )}
      </div>
```

5. Dans chaque `<li>`, juste avant le `<span … tabular-nums>` du montant, ajouter :

```tsx
                {(() => {
                  const pill = PILLS[e.eventType] ?? { key: 'historyPillOther' as const, tone: 'neutral' as const };
                  return <span className={`${PILL_BASE} ${PILL_TONE[pill.tone]}`}>{t(pill.key)}</span>;
                })()}
```

6. Dans le lien de facture, remplacer `{t('historyInvoice')}` par
   `<Download size={14} aria-hidden /> {t('historyInvoice')}`.

- [ ] **Step 3 : vérifier le succès**

Run : `npx vitest run src/components/organization/OrgBillingTab.seats-history.test.tsx ; echo "exit=$?"`
Expected : tous PASS, `exit=0` (le lien non `https://` reste refusé par le test existant).

- [ ] **Step 4 : commit**

```bash
git commit -m "feat(billing): historique des factures en pastilles, destinataire affiche" -- src/components/organization/OrgBillingHistory.tsx src/components/organization/OrgBillingTab.seats-history.test.tsx
```

---

### Task 15 : bannière d'impayé dans l'espace entreprise

**Files :**
- Create : `src/components/organization/OrgPastDueBanner.tsx`
- Test : `src/components/organization/OrgPastDueBanner.test.tsx`
- Modify : `src/pages/OrganizationPage.tsx`

- [ ] **Step 1 : écrire le test qui échoue**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mutate = vi.fn();
vi.mock('@/modules/billing/org-billing.mutations', () => ({
  useOpenOrgPortal: () => ({ mutate, isPending: false }),
}));
vi.mock('@/modules/billing/org-billing-account.repository', () => ({
  getOrgBillingHistory: async () => [
    { id: 1, eventType: 'invoice.payment_failed', invoiceNumber: 'F-1', hostedInvoiceUrl: null, amountCents: 15000, currency: 'eur', occurredAt: '2026-11-02T10:00:00Z' },
  ],
  getOrgBillingContact: async () => null,
}));

import { appModeStore } from '@/lib/app-mode.store';
import { OrgPastDueBanner } from './OrgPastDueBanner';

describe('OrgPastDueBanner', () => {
  it('date de l échec, membres rassurés, bouton vers le portail', async () => {
    appModeStore.setDemo(false);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <OrgPastDueBanner orgId="org-1" memberCount={14} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/le paiement du .* n'est pas passé/i)).toBeTruthy();
    expect(screen.getByText(/vos 14 membres gardent tous leurs accès/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /mettre à jour ma carte/i }));
    expect(mutate).toHaveBeenCalledWith({ orgId: 'org-1' });
  });
});
```

Run : `npx vitest run src/components/organization/OrgPastDueBanner.test.tsx ; echo "exit=$?"`
Expected : FAIL (module introuvable).

- [ ] **Step 2 : implémenter le composant**

```tsx
import { CreditCard } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { useOrgBillingHistory } from '@/modules/billing/org-billing-account.hooks';
import { useOpenOrgPortal } from '@/modules/billing/org-billing.mutations';
import { lastFailedPaymentAt } from '@/modules/billing/org-billing.logic';

interface Props {
  orgId: string;
  memberCount: number;
}

/**
 * Impayé (spec 2026-11-02 § 5.2), en tête de TOUT l'espace entreprise, pour
 * le propriétaire seul. Monté en `lazy` par `OrganizationPage` et seulement
 * quand l'abonnement est `past_due` : son code ne pèse pas dans le chunk de la
 * page. Aucune date de nouvelle tentative : elle n'est pas lue (v1).
 */
export function OrgPastDueBanner({ orgId, memberCount }: Props) {
  const { t } = useT('orgAdmin');
  const { data: history = [] } = useOrgBillingHistory(orgId, true);
  const portal = useOpenOrgPortal();
  const failedAt = lastFailedPaymentAt(history);

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700/60 dark:bg-amber-900/20"
    >
      <CreditCard size={18} aria-hidden className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {failedAt ? t('billing.pastDueTitle', { date: formatDate(new Date(failedAt)) }) : t('billing.pastDueTitleNoDate')}
        </p>
        <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">{t('billing.pastDueBody', { count: memberCount })}</p>
      </div>
      <button
        type="button"
        disabled={portal.isPending}
        onClick={() => portal.mutate({ orgId })}
        className="shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60 dark:border-amber-700 dark:bg-transparent dark:text-amber-300"
      >
        {t('billing.pastDueCta')}
      </button>
    </div>
  );
}

export default OrgPastDueBanner;
```

Run : `npx vitest run src/components/organization/OrgPastDueBanner.test.tsx ; echo "exit=$?"`
Expected : 1 PASS, `exit=0`.

- [ ] **Step 3 : monter la bannière dans la page**

Dans `src/pages/OrganizationPage.tsx` :
1. sous la ligne `const OrgBillingTab = lazyWithRetry(…)`, ajouter :

```tsx
const OrgPastDueBanner = lazyWithRetry(() => import('@/components/organization/OrgPastDueBanner'));
```

2. ajouter `needsPaymentAttention` à l'import existant de `@/modules/billing/org-billing.logic`
   (celui qui fournit `effectiveQuota` et `isQuotaReached`) ;
3. juste **avant** le commentaire `{/* Bannière sièges : affichée UNIQUEMENT quand il faut changer de plan`, ajouter :

```tsx
      {/* Impayé : propriétaire seul, au-dessus de tout (spec 2026-11-02 § 5.2).
          Chunk chargé seulement quand l'abonnement est `past_due`. */}
      {isOwner && !isDemo && needsPaymentAttention(orgSubscription ?? null) && (
        <Suspense fallback={null}>
          <OrgPastDueBanner orgId={myOrg.id} memberCount={members.length} />
        </Suspense>
      )}
```

- [ ] **Step 4 : vérifier le chunk**

Run : `npm run build ; echo "exit=$?"` puis `npm run check:bundle ; echo "exit=$?"`
Expected : `exit=0` les deux, chunk `OrganizationPage` sous son cliquet. ❌ Si le cliquet est
dépassé, ne pas le relever : trouver l'import qui pèse (`OrganizationPage` ne doit importer que
le `lazyWithRetry` ci-dessus).

- [ ] **Step 5 : commit**

```bash
git add src/components/organization/OrgPastDueBanner.tsx src/components/organization/OrgPastDueBanner.test.tsx
git commit -m "feat(billing): banniere d'impaye en tete de l'espace entreprise, proprietaire seul" -- src/components/organization/OrgPastDueBanner.tsx src/components/organization/OrgPastDueBanner.test.tsx src/pages/OrganizationPage.tsx
```

---

### Task 16 : invitation sans place

**Files :**
- Modify : `src/components/organization/OrgInviteSection.tsx`

- [ ] **Step 1 : implémenter**

Imports à ajouter :

```tsx
import { formatCurrency } from '@/i18n/format';
import { recommendedTier, tierByQuota } from '@/modules/billing/org-billing.logic';
import { useTierRangeLabel } from './billing-ui';
```

Dans le composant, après les `useState` :

```tsx
  const rangeLabel = useTierRangeLabel();
  const nextTier = recommendedTier(memberCount);
  const currentTier = tierByQuota(seatsQuota);
  const who = quickEmails.trim() || t('invite.someoneMore');
```

Juste après la fermeture `)}` du bloc `{canInviteByEmail && ( <form …> … </form> )}`, ajouter :

```tsx
          {/* Plus de place (spec 2026-11-02 § 5.4) : la solution sur place,
              palier suivant présélectionné dans l'onglet Abonnement. Le champ
              reste saisissable, seul l'envoi est retenu. */}
          {seatsFull && seatsQuota !== null && (
            isOwner ? (
              <div role="status" className="rounded-2xl border border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)] p-4">
                <p className="text-sm text-[rgb(var(--color-text-primary))]">
                  {currentTier.priceEurPerMonth > 0
                    ? t('invite.seatsFullOwner', {
                        quota: seatsQuota,
                        who,
                        tier: rangeLabel(nextTier.key),
                        price: formatCurrency(nextTier.priceEurPerMonth),
                        current: formatCurrency(currentTier.priceEurPerMonth),
                      })
                    : t('invite.seatsFullOwnerFromFree', {
                        quota: seatsQuota,
                        who,
                        tier: rangeLabel(nextTier.key),
                        price: formatCurrency(nextTier.priceEurPerMonth),
                      })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={buildOrgLink('billing', undefined, { tier: nextTier.key })}
                    className="inline-flex items-center rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))]"
                  >
                    {t('invite.upgradeCta')}
                  </Link>
                  <Link to={buildOrgLink('members')} className="inline-flex items-center px-3 py-2 text-sm text-[rgb(var(--color-accent))] hover:underline">
                    {t('invite.freeSeatCta')}
                  </Link>
                </div>
              </div>
            ) : (
              <p role="status" className="rounded-2xl bg-[rgb(var(--color-hover))] p-4 text-sm text-[rgb(var(--color-text-secondary))]">
                {t('invite.seatsFullMember')}
              </p>
            )
          )}
```

- [ ] **Step 2 : vérifier**

Run : `npx vitest run src/components/organization ; echo "exit=$?"` puis `npm run typecheck ; echo "exit=$?"` puis `npm run lint ; echo "exit=$?"`
Expected : `exit=0` les trois.

- [ ] **Step 3 : commit**

```bash
git commit -m "feat(billing): invitation sans place, palier superieur propose sur place" -- src/components/organization/OrgInviteSection.tsx
```

---

### Task 17 : vérification finale et livraison

- [ ] **Step 1 : gardes globales**

Run, chacune avec `; echo "exit=$?"` :
`npm run lint`, `npm run typecheck`, `npx vitest run src/components/organization src/modules`,
`npx vitest run src/design-system.guard.test.ts src/architecture.guard.test.ts src/modules/polling.guard.test.ts`,
`npm run i18n:check`, `npm run i18n:identical`, `npm run check:cycles`, `npm run build`,
`npm run check:bundle`, `npm run check:docs`.
Expected : `exit=0` partout. Lire `$?`, puis comparer le nombre de fichiers de test annoncé au
nombre de fichiers du périmètre.

- [ ] **Step 2 : coup d'œil au preview**

`preview_start` sur la config `dev-org-guide` (mode démo, port 5577), connexion démo, ouvrir
`/entreprise/billing`. Vérifier, captures à l'appui :
1. carte forfait, jauge animée, pictos au-dessus de la grille, texte légal entier dessous ;
2. bascule mensuel/annuel : pastille qui glisse, prix en fondu, aucun chiffre qui défile ;
3. clic sur une carte : déploiement en récapitulatif, case non cochée, clic sur « Payer » sans
   case → message ; case cochée → pulsation ;
4. `/entreprise/billing?checkout=success` : « activation en cours », puis message de délai après
   20 s (la démo n'a pas d'abonnement) ;
5. largeur 375 px, thème sombre, et `prefers-reduced-motion: reduce` : rien ne reste décalé.

⚠️ En démo, aucun paiement ne doit partir : ne pas cocher la case puis payer sur une config
reliée à Supabase.

- [ ] **Step 3 : pousser**

```bash
git fetch origin && git rebase origin/main && git push origin HEAD:main
```

Hook `pre-push` rouge pour une cause étrangère : suivre la mémoire « Hook pre-push main rouge »
(pousser avec `COSMO_PUSH_ON_RED=1` et le signaler), jamais `--no-verify`.

- [ ] **Step 4 : rendre compte**

Dire à Axel : commits poussés, gardes passées avec leurs codes de sortie, captures du preview, et
ce qui n'a pas été vérifié (paiement réel, webhook réel : couverts par l'E2E de la CI et à
regarder au premier achat).
