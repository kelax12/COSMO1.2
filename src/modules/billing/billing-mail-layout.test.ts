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

  it('aucun tiret cadratin dans le rendu', () => {
    const m = renderBillingMail(base);
    expect(m.html + m.text).not.toContain(String.fromCharCode(0x2014));
  });
});
