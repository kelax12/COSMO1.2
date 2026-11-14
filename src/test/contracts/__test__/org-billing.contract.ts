// Contrat de la facturation d'organisation, pour sa part qui ne passe pas par Stripe :
// abonnement lu, historique lu, contact de facturation, quota de sièges.
// Hors contrat (Edge Function ou Stripe) : voir `docs/TESTING.md` § Suites de contrat.
// Cadre et règle des divergences : `./harness.ts`.
import { describe, expect, beforeAll } from 'vitest';
import type { OrgBillingContact, OrgBillingHistoryEntry, OrgSubscription } from '@/modules/billing/org-billing.types';
import { contractCase, rejects, type ContractOptions } from './harness';

/** Le port que la démo et la base exposent l'une et l'autre. */
export interface OrgBillingPort {
  getSubscription(orgId: string): Promise<OrgSubscription | null>;
  getHistory(orgId: string): Promise<OrgBillingHistoryEntry[]>;
  getContact(orgId: string): Promise<OrgBillingContact | null>;
  saveContact(orgId: string, input: { name: string | null; email: string }): Promise<OrgBillingContact>;
  deleteContact(orgId: string): Promise<void>;
  /** « Le prochain ajout de membre sera-t-il accepté ? » : `org_seats_allowed` en base, `isQuotaReached` côté TS. */
  seatsAllowed(orgId: string): Promise<boolean>;
}

export interface OrgBillingScenario {
  /** Absent = aucune ligne `org_subscriptions`. */
  subscription?: {
    tierKey: 'free' | 't10' | 't20' | 't50' | 'tmax';
    maxMembers: number | null;
    status: 'active' | 'past_due' | 'cancelled';
    billingInterval?: 'monthly' | 'yearly';
    cancelAtPeriodEnd?: boolean;
    startedAt?: string;
  };
  /** Effectif total, propriétaire compris. */
  members: number;
}

export interface OrgBillingContractContext {
  port: OrgBillingPort;
  /** Crée une organisation dont le joueur est propriétaire, dans l'état voulu. */
  newOrg: (scenario?: OrgBillingScenario) => Promise<string>;
  /** Base seulement : écrit des lignes dans le journal fiscal (service_role, INSERT). */
  seedPayments?: (
    orgId: string,
    rows: { eventType: string; amountCents: number; daysAgo: number; number?: string; reason?: string }[],
  ) => Promise<void>;
  /** Base seulement : organisation d'un AUTRE propriétaire où le joueur est simple membre, avec un contact posé. */
  foreignOrg?: () => Promise<{ orgId: string; contactEmail: () => Promise<string | null> }>;
}

export function orgBillingContract(
  side: string,
  make: () => Promise<OrgBillingContractContext>,
  opts?: ContractOptions,
): void {
  describe(`contrat facturation d'organisation (hors Stripe) · ${side}`, () => {
    let ctx: OrgBillingContractContext;
    beforeAll(async () => {
      ctx = await make();
    });
    const seats = async (s: OrgBillingScenario) => ctx.port.seatsAllowed(await ctx.newOrg(s));
    const sub = (
      tierKey: 't10' | 't20' | 'tmax',
      maxMembers: number | null,
      status: 'active' | 'past_due' | 'cancelled' = 'active',
    ): NonNullable<OrgBillingScenario['subscription']> => ({ tierKey, maxMembers, status });

    // ── Abonnement et historique ────────────────────────────────────
    contractCase(opts, 'une organisation sans abonnement se lit null (palier gratuit)', async () => {
      expect(await ctx.port.getSubscription(await ctx.newOrg())).toBeNull();
    });

    contractCase(opts, 'un abonnement actif se lit avec son palier, ses sièges et ses valeurs par défaut', async () => {
      const orgId = await ctx.newOrg({ subscription: sub('t20', 20), members: 1 });
      expect(await ctx.port.getSubscription(orgId)).toMatchObject({
        orgId,
        tierKey: 't20',
        maxMembers: 20,
        status: 'active',
        billingInterval: 'monthly',
        cancelAtPeriodEnd: false,
        discountCode: null,
      });
    });

    contractCase(opts, 'périodicité annuelle, résiliation programmée et date de conclusion se lisent', async () => {
      const startedAt = '2026-11-01T10:00:00.000Z';
      const orgId = await ctx.newOrg({
        subscription: { ...sub('t10', 10), billingInterval: 'yearly', cancelAtPeriodEnd: true, startedAt },
        members: 1,
      });
      const read = await ctx.port.getSubscription(orgId);
      expect(read && { i: read.billingInterval, c: read.cancelAtPeriodEnd, s: read.startedAt && Date.parse(read.startedAt) }).toEqual({
        i: 'yearly',
        c: true,
        s: Date.parse(startedAt),
      });
    });

    contractCase(opts, 'l’historique d’une organisation qui n’a jamais payé est vide', async () => {
      expect(await ctx.port.getHistory(await ctx.newOrg())).toEqual([]);
    });

    contractCase(opts, 'l’historique rend les lignes de l’organisation seule, du plus récent au plus ancien, remboursement négatif', async () => {
      const orgId = await ctx.newOrg();
      const other = await ctx.newOrg();
      await ctx.seedPayments!(orgId, [
        { eventType: 'invoice.payment_succeeded', amountCents: 7000, daysAgo: 30, number: 'F-1', reason: 'subscription_create' },
        { eventType: 'invoice.payment_succeeded', amountCents: 7000, daysAgo: 0, number: 'F-2', reason: 'subscription_cycle' },
        { eventType: 'charge.refunded', amountCents: -7000, daysAgo: 10 },
      ]);
      await ctx.seedPayments!(other, [{ eventType: 'invoice.payment_succeeded', amountCents: 999, daysAgo: 1, number: 'F-X' }]);
      const rows = await ctx.port.getHistory(orgId);
      expect(rows.map((r) => [r.eventType, r.amountCents, r.invoiceNumber, r.billingReason])).toEqual([
        ['invoice.payment_succeeded', 7000, 'F-2', 'subscription_cycle'],
        ['charge.refunded', -7000, null, null],
        ['invoice.payment_succeeded', 7000, 'F-1', 'subscription_create'],
      ]);
    });

    contractCase(opts, 'l’historique est refusé à un simple membre et à qui vise une organisation inconnue', async () => {
      const foreign = await ctx.foreignOrg!();
      expect(await rejects(ctx.port.getHistory(foreign.orgId))).toBe(true);
      expect(await rejects(ctx.port.getHistory(crypto.randomUUID()))).toBe(true);
    });

    // ── Contact de facturation ──────────────────────────────────────
    contractCase(opts, 'le contact se pose, se relit, se remplace et se retire', async () => {
      const orgId = await ctx.newOrg();
      expect(await ctx.port.getContact(orgId)).toBeNull();
      await ctx.port.saveContact(orgId, { name: 'Compta', email: 'compta@example.com' });
      expect(await ctx.port.getContact(orgId)).toMatchObject({ orgId, name: 'Compta', email: 'compta@example.com' });
      await ctx.port.saveContact(orgId, { name: null, email: 'autre@example.com' });
      expect(await ctx.port.getContact(orgId)).toMatchObject({ name: null, email: 'autre@example.com' });
      await ctx.port.deleteContact(orgId);
      expect(await ctx.port.getContact(orgId)).toBeNull();
    });

    contractCase(opts, 'une adresse mal formée est refusée et ne remplace pas le contact', async () => {
      const orgId = await ctx.newOrg();
      await ctx.port.saveContact(orgId, { name: null, email: 'bon@example.com' });
      for (const email of ['sans-arobase', 'a b@example.com', 'a@b', '']) {
        expect(await rejects(ctx.port.saveContact(orgId, { name: null, email }))).toBe(true);
      }
      expect((await ctx.port.getContact(orgId))?.email).toBe('bon@example.com');
    });

    contractCase(opts, 'une adresse de plus de 254 caractères et un nom de plus de 120 sont refusés', async () => {
      const orgId = await ctx.newOrg();
      const longEmail = `${'a'.repeat(250)}@example.com`;
      expect(await rejects(ctx.port.saveContact(orgId, { name: null, email: longEmail }))).toBe(true);
      expect(await rejects(ctx.port.saveContact(orgId, { name: 'n'.repeat(121), email: 'ok@example.com' }))).toBe(true);
      expect(await ctx.port.getContact(orgId)).toBeNull();
    });

    contractCase(opts, 'un simple membre ne lit ni n’écrit le contact du propriétaire', async () => {
      const foreign = await ctx.foreignOrg!();
      const before = await foreign.contactEmail();
      expect(await ctx.port.getContact(foreign.orgId)).toBeNull();
      expect(await rejects(ctx.port.saveContact(foreign.orgId, { name: null, email: 'intrus@example.com' }))).toBe(true);
      await ctx.port.deleteContact(foreign.orgId).catch(() => undefined);
      expect(await foreign.contactEmail()).toBe(before);
    });

    // ── Quota de sièges : la règle que la base porte en SQL et le TS rejoue ──
    contractCase(opts, 'sans abonnement, le quota est celui du gratuit : 4 membres acceptent un ajout, 5 non', async () => {
      expect(await seats({ members: 4 })).toBe(true);
      expect(await seats({ members: 5 })).toBe(false);
    });

    contractCase(opts, 'un abonnement actif donne son quota, pas celui du gratuit', async () => {
      expect(await seats({ subscription: sub('t10', 10), members: 5 })).toBe(true);
      expect(await seats({ subscription: sub('t10', 10), members: 9 })).toBe(true);
      expect(await seats({ subscription: sub('t10', 10), members: 10 })).toBe(false);
    });

    contractCase(opts, 'un palier sans plafond accepte toujours un ajout', async () => {
      expect(await seats({ subscription: sub('tmax', null), members: 6 })).toBe(true);
    });

    contractCase(opts, 'impayé ou résilié retombe au quota gratuit, sans rien retirer', async () => {
      for (const status of ['past_due', 'cancelled'] as const) {
        expect(await seats({ subscription: sub('t10', 10, status), members: 4 })).toBe(true);
        expect(await seats({ subscription: sub('t10', 10, status), members: 5 })).toBe(false);
        expect(await seats({ subscription: sub('t10', 10, status), members: 6 })).toBe(false);
      }
    });
  });
}
