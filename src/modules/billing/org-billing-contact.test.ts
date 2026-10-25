// Contact de facturation → customer Stripe (mig. 180). Le module est celui que
// les Edge Functions `stripe-org-checkout` et `stripe-org-portal` importent.
import { describe, expect, it } from 'vitest';
import { customerContactFields, INVOICE_FOOTER } from '../../../supabase/functions/_shared/org-billing-contact';

describe('customerContactFields', () => {
  it('sans contact, les factures vont au propriétaire, sans toucher au nom', () => {
    expect(customerContactFields(null, 'owner@acme.fr')).toEqual({ email: 'owner@acme.fr', invoice_settings: { footer: INVOICE_FOOTER } });
  });

  it('un contact remplace l adresse du propriétaire et porte son nom', () => {
    expect(customerContactFields({ name: ' Service compta ', email: 'compta@acme.fr' }, 'owner@acme.fr'))
      .toEqual({ email: 'compta@acme.fr', name: 'Service compta', invoice_settings: { footer: INVOICE_FOOTER } });
  });

  it('un nom vide n efface pas le nom du customer', () => {
    const fields = customerContactFields({ name: '  ', email: 'compta@acme.fr' }, 'owner@acme.fr');
    expect(fields).toEqual({ email: 'compta@acme.fr', invoice_settings: { footer: INVOICE_FOOTER } });
    expect('name' in fields).toBe(false);
  });

  it('un nom absent (null en base) n efface pas non plus le nom du customer, sans lever', () => {
    const fields = customerContactFields({ name: null, email: 'compta@acme.fr' }, 'owner@acme.fr');
    expect(fields).toEqual({ email: 'compta@acme.fr', invoice_settings: { footer: INVOICE_FOOTER } });
  });

  it('🔴 chaque customer porte la mention de franchise en base (CGI art. 293 B)', () => {
    expect(INVOICE_FOOTER).toBe('TVA non applicable, art. 293 B du CGI');
    for (const f of [customerContactFields(null, 'o@a.fr'), customerContactFields({ name: 'X', email: 'c@a.fr' }, 'o@a.fr')]) {
      expect(f.invoice_settings.footer).toBe(INVOICE_FOOTER);
    }
  });
});
