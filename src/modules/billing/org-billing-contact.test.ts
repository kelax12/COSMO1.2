// Contact de facturation → customer Stripe (mig. 180). Le module est celui que
// les Edge Functions `stripe-org-checkout` et `stripe-org-portal` importent.
import { describe, expect, it } from 'vitest';
import { customerContactFields } from '../../../supabase/functions/_shared/org-billing-contact';

describe('customerContactFields', () => {
  it('sans contact, les factures vont au propriétaire, sans toucher au nom', () => {
    expect(customerContactFields(null, 'owner@acme.fr')).toEqual({ email: 'owner@acme.fr' });
  });

  it('un contact remplace l adresse du propriétaire et porte son nom', () => {
    expect(customerContactFields({ name: ' Service compta ', email: 'compta@acme.fr' }, 'owner@acme.fr'))
      .toEqual({ email: 'compta@acme.fr', name: 'Service compta' });
  });

  it('un nom vide n efface pas le nom du customer', () => {
    const fields = customerContactFields({ name: '  ', email: 'compta@acme.fr' }, 'owner@acme.fr');
    expect(fields).toEqual({ email: 'compta@acme.fr' });
    expect('name' in fields).toBe(false);
  });
});
