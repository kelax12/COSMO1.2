// ═══════════════════════════════════════════════════════════════════
// Affiliation par lien (mig. 236).
//
//   1. Tables `affiliate_*` fermées à `anon` et `authenticated`, rattachement
//      du profil définitif, slug contraint, suppression de compte.
//   2. Trigger de commission sur `payment_records` : montants de
//      `_shared/affiliation-math.ts` au centime, rejeu, échec, remboursement,
//      org, antériorité, panne, backfill.
//   3. Rattachement : `handle_new_user_profile`, `claim_affiliate`,
//      `affiliate_attach`.
//
// 🔴 Stack LOCALE seulement : ce fichier écrit dans `payment_records`, le
// journal fiscal scellé. Jamais contre la prod.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { admin, anonClient, createTestUser, deleteTestUsers, TestUser } from './helpers';

const TABLES = [
  'affiliates',
  'affiliate_links',
  'affiliate_clicks',
  'affiliate_contacts',
  'affiliate_commissions',
  'affiliate_payouts',
  'affiliate_settings',
] as const;

const stamp = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

async function newAffiliate(): Promise<{ id: string; slug: string }> {
  const { data, error } = await admin
    .from('affiliates')
    .insert({ name: 'Affiliateur test', email: 'aff@example.com' })
    .select('id')
    .single();
  if (error) throw error;
  const slug = `t-${stamp().replace(/_/g, '-')}`.slice(0, 40);
  const { error: e2 } = await admin.from('affiliate_links').insert({ slug, affiliate_id: data.id });
  if (e2) throw e2;
  return { id: data.id as string, slug };
}

/** Rattache un compte sous service_role, à une date choisie. */
async function attach(userId: string, aff: { id: string; slug: string }, at = '2020-01-01T00:00:00Z') {
  const { error } = await admin
    .from('profiles')
    .update({ affiliate_id: aff.id, affiliate_slug: aff.slug, affiliated_at: at })
    .eq('id', userId);
  if (error) throw error;
}

interface Payment {
  event_type: string;
  amount_cents: number;
  user_id?: string | null;
  org_id?: string | null;
  stripe_invoice_id?: string;
  stripe_event_id?: string;
  occurred_at?: string;
}

async function pay(p: Payment): Promise<number> {
  const { data, error } = await admin
    .from('payment_records')
    .insert({
      stripe_event_id: p.stripe_event_id ?? `evt_${stamp()}`,
      event_type: p.event_type,
      stripe_invoice_id: p.stripe_invoice_id ?? `in_${stamp()}`,
      user_id: p.user_id ?? null,
      org_id: p.org_id ?? null,
      amount_cents: p.amount_cents,
      currency: 'eur',
      occurred_at: p.occurred_at ?? new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as number;
}

async function commissionsOf(paymentId: number) {
  const { data, error } = await admin
    .from('affiliate_commissions')
    .select('*')
    .eq('payment_record_id', paymentId);
  if (error) throw error;
  return data;
}

describe('Affiliation — partie 1 : tables et verrous (mig. 236)', () => {
  let b: TestUser;
  let aff: { id: string; slug: string };

  beforeAll(async () => {
    b = await createTestUser();
    aff = await newAffiliate();
  });
  afterAll(async () => {
    await deleteTestUsers(b);
  });

  for (const table of TABLES) {
    it(`${table} : ni anon ni authenticated ne lisent ni n'écrivent`, async () => {
      for (const client of [anonClient, b.client]) {
        const read = await client.from(table).select('*').limit(1);
        expect(read.error).not.toBeNull();
        const write = await client.from(table).insert({});
        expect(write.error).not.toBeNull();
      }
    });
  }

  it('le propriétaire ne peut pas poser lui-même son rattachement', async () => {
    const { error } = await b.client
      .from('profiles')
      .update({ affiliate_id: aff.id, affiliate_slug: aff.slug, affiliated_at: new Date().toISOString() })
      .eq('id', b.id);
    expect(error).not.toBeNull();
  });

  it('une fois posé, le rattachement ne bouge plus, même sous service_role', async () => {
    await attach(b.id, aff);
    const other = await newAffiliate();
    const byOwner = await b.client.from('profiles').update({ affiliate_id: null }).eq('id', b.id);
    expect(byOwner.error).not.toBeNull();
    const byService = await admin.from('profiles').update({ affiliate_id: other.id }).eq('id', b.id);
    expect(byService.error).not.toBeNull();
    const { data } = await admin.from('profiles').select('affiliate_id').eq('id', b.id).single();
    expect(data?.affiliate_id).toBe(aff.id);
  });

  it('les autres colonnes du profil restent modifiables', async () => {
    const { error } = await b.client.from('profiles').update({ display_name: 'B renommé' }).eq('id', b.id);
    expect(error).toBeNull();
  });

  it.each(['A', 'a', 'avec espace', 'x'.repeat(41), 'accentué', 'under_score'])(
    'slug « %s » refusé',
    async (slug) => {
      const { error } = await admin.from('affiliate_links').insert({ slug, affiliate_id: aff.id });
      expect(error).not.toBeNull();
    },
  );

  it('supprimer B efface sa fiche et anonymise ses commissions sans toucher aux montants', async () => {
    const victim = await createTestUser();
    await attach(victim.id, aff);
    await admin.from('affiliate_contacts').insert({ user_id: victim.id, name: 'B', email: victim.email });
    const pid = await pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, user_id: victim.id });

    await deleteTestUsers(victim);

    const contacts = await admin.from('affiliate_contacts').select('user_id').eq('user_id', victim.id);
    expect(contacts.data).toEqual([]);
    const [c] = await commissionsOf(pid);
    expect(c.customer_id).toBeNull();
    expect(c.commission_cents).toBe(717);
  });
});

describe('Affiliation — partie 2 : trigger de commission', () => {
  let b: TestUser;
  let payer: TestUser;
  let stranger: TestUser;
  let aff: { id: string; slug: string };
  let orgPaid: string;
  let orgFree: string;

  async function newOrg(owner: TestUser, purchasedBy: string): Promise<string> {
    const { data, error } = await admin
      .from('organizations')
      .insert({ name: 'Org aff', owner_id: owner.id, join_code: `aff-${stamp()}` })
      .select('id')
      .single();
    if (error) throw error;
    const { error: e2 } = await admin.from('org_subscriptions').upsert({
      org_id: data.id,
      tier_key: 't10',
      max_members: 10,
      status: 'active',
      purchased_by: purchasedBy,
    });
    if (e2) throw e2;
    return data.id as string;
  }

  beforeAll(async () => {
    b = await createTestUser();
    payer = await createTestUser();
    stranger = await createTestUser();
    aff = await newAffiliate();
    await attach(b.id, aff);
    await attach(payer.id, aff);
    orgPaid = await newOrg(payer, payer.id);
    orgFree = await newOrg(stranger, stranger.id);
  });
  afterAll(async () => {
    await admin.from('organizations').delete().in('id', [orgPaid, orgFree]);
    await deleteTestUsers(b, payer, stranger);
  });

  it('Premium affilié payé 2000 → une commission de 717 (mig. 238)', async () => {
    const pid = await pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, user_id: b.id });
    const rows = await commissionsOf(pid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      affiliate_id: aff.id,
      customer_id: b.id,
      gross_cents: 2000,
      vat_cents: 0,
      deduction_bp: 2560,
      deduction_cents: 512,
      fee_cents: 55,
      base_cents: 1433,
      rate_bp: 5000,
      commission_cents: 717,
    });
  });

  it('même stripe_event_id rejoué → toujours une seule ligne', async () => {
    const evt = `evt_replay_${stamp()}`;
    const pid = await pay({
      event_type: 'invoice.payment_succeeded',
      amount_cents: 2000,
      user_id: b.id,
      stripe_event_id: evt,
    });
    await expect(
      pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, user_id: b.id, stripe_event_id: evt }),
    ).rejects.toBeTruthy();
    const { count } = await admin
      .from('affiliate_commissions')
      .select('id', { count: 'exact', head: true })
      .eq('payment_record_id', pid);
    expect(count).toBe(1);
  });

  it('invoice.payment_failed → aucune ligne', async () => {
    const pid = await pay({ event_type: 'invoice.payment_failed', amount_cents: 2000, user_id: b.id });
    expect(await commissionsOf(pid)).toHaveLength(0);
  });

  it('charge.refunded de −1000 sans user_id → −359, retrouvé par stripe_invoice_id', async () => {
    const inv = `in_refund_${stamp()}`;
    await pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, user_id: b.id, stripe_invoice_id: inv });
    const rid = await pay({ event_type: 'charge.refunded', amount_cents: -1000, user_id: null, stripe_invoice_id: inv });
    const [c] = await commissionsOf(rid);
    expect(c).toMatchObject({ affiliate_id: aff.id, customer_id: b.id, commission_cents: -359 });
  });

  it('org payée par un affilié → commission ; payée par un non-affilié → rien', async () => {
    const p1 = await pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, org_id: orgPaid });
    const [c] = await commissionsOf(p1);
    expect(c).toMatchObject({ affiliate_id: aff.id, customer_id: payer.id, org_id: orgPaid, commission_cents: 717 });
    const p2 = await pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, org_id: orgFree });
    expect(await commissionsOf(p2)).toHaveLength(0);
  });

  it('paiement antérieur à affiliated_at → rien', async () => {
    const pid = await pay({
      event_type: 'invoice.payment_succeeded',
      amount_cents: 2000,
      user_id: b.id,
      occurred_at: '2019-06-01T00:00:00Z',
    });
    expect(await commissionsOf(pid)).toHaveLength(0);
  });

  it('trigger cassé : le journal s écrit quand même, puis affiliate_backfill rattrape sans doublon', async () => {
    const { data: settings } = await admin.from('affiliate_settings').select('*').single();
    const { error: delError } = await admin.from('affiliate_settings').delete().eq('id', true);
    expect(delError).toBeNull();
    let pid: number;
    try {
      pid = await pay({ event_type: 'invoice.payment_succeeded', amount_cents: 2000, user_id: b.id });
      expect(await commissionsOf(pid)).toHaveLength(0);
    } finally {
      await admin.from('affiliate_settings').insert(settings);
    }

    const first = await admin.rpc('affiliate_backfill');
    expect(first.error).toBeNull();
    expect(first.data).toBeGreaterThanOrEqual(1);
    expect(await commissionsOf(pid)).toHaveLength(1);

    const second = await admin.rpc('affiliate_backfill');
    expect(second.error).toBeNull();
    expect(second.data).toBe(0);
    expect(await commissionsOf(pid)).toHaveLength(1);
  });

  it('affiliate_backfill refusée à un utilisateur ordinaire', async () => {
    const { error } = await b.client.rpc('affiliate_backfill');
    expect(error).not.toBeNull();
  });
});

describe('Affiliation — partie 3 : rattachement', () => {
  let aff: { id: string; slug: string };
  const created: string[] = [];

  beforeAll(async () => {
    aff = await newAffiliate();
  });
  afterAll(async () => {
    for (const id of created) await admin.auth.admin.deleteUser(id);
  });

  async function signUp(meta: Record<string, string>): Promise<string> {
    const email = `aff_${stamp()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `Pw_${stamp()}_aA1!`,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error || !data.user) throw error ?? new Error('no user');
    created.push(data.user.id);
    return data.user.id;
  }

  async function profile(id: string) {
    const { data } = await admin
      .from('profiles')
      .select('affiliate_id, affiliate_slug, affiliated_at')
      .eq('id', id)
      .single();
    return data;
  }

  it('signUp avec un slug valide → profil rattaché', async () => {
    const id = await signUp({ affiliate_slug: aff.slug });
    const p = await profile(id);
    expect(p?.affiliate_id).toBe(aff.id);
    expect(p?.affiliate_slug).toBe(aff.slug);
    expect(p?.affiliated_at).not.toBeNull();
  });

  it('signUp avec un slug inconnu ou invalide → rien, l inscription passe', async () => {
    for (const slug of ['inconnu-zz-999', 'Pas Valide']) {
      const id = await signUp({ affiliate_slug: slug });
      const p = await profile(id);
      expect(p).not.toBeNull();
      expect(p?.affiliate_id).toBeNull();
    }
  });

  it('claim_affiliate : compte neuf → true, second appel → false', async () => {
    const u = await createTestUser();
    created.push(u.id);
    const first = await u.client.rpc('claim_affiliate', { p_slug: aff.slug });
    expect(first.error).toBeNull();
    expect(first.data).toBe(true);
    const second = await u.client.rpc('claim_affiliate', { p_slug: aff.slug });
    expect(second.data).toBe(false);
    expect((await profile(u.id))?.affiliate_id).toBe(aff.id);
  });

  it('claim_affiliate : slug inconnu → false ; anon → false', async () => {
    const u = await createTestUser();
    created.push(u.id);
    expect((await u.client.rpc('claim_affiliate', { p_slug: 'inconnu-zz-999' })).data).toBe(false);
    const asAnon = await anonClient.rpc('claim_affiliate', { p_slug: aff.slug });
    expect(asAnon.data === false || asAnon.error !== null).toBe(true);
  });

  // L'API REST ne permet pas de vieillir `auth.users.created_at` : la garde
  // « compte de plus d'1 h → false » se prouve en SQL (BEGIN / UPDATE
  // auth.users / SELECT claim_affiliate / ROLLBACK) avant l'application.
  it.todo('claim_affiliate : compte vieux de plus d 1 h → false');

  it('affiliate_attach : refusé sans is_admin()', async () => {
    const u = await createTestUser();
    created.push(u.id);
    const { error } = await u.client.rpc('affiliate_attach', { p_affiliate_id: aff.id, p_email: u.email });
    expect(error).not.toBeNull();
    expect((await profile(u.id))?.affiliate_id).toBeNull();
  });

  it('affiliate_attach : rattache un compte existant, puis refuse un second rattachement', async () => {
    const u = await createTestUser();
    created.push(u.id);
    const ok = await admin.rpc('affiliate_attach', { p_affiliate_id: aff.id, p_email: u.email });
    expect(ok.error).toBeNull();
    expect((await profile(u.id))?.affiliate_id).toBe(aff.id);
    const other = await newAffiliate();
    const again = await admin.rpc('affiliate_attach', { p_affiliate_id: other.id, p_email: u.email });
    expect(again.error).not.toBeNull();
    expect((await profile(u.id))?.affiliate_id).toBe(aff.id);
  });
});
