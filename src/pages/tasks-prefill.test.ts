import { describe, it, expect } from 'vitest';
import { lirePrefill } from './tasks-prefill';

describe('paramètres de l’extension « Ajouter à Cosmo »', () => {
  const p = (q: string) => lirePrefill(new URLSearchParams(q));
  it('rien à pré-remplir sans titre', () => {
    expect(p('')).toBeNull();
    expect(p('ajouter=%20%20')).toBeNull();
  });
  it('borne le titre et ne garde qu’une adresse web en source', () => {
    expect(p('ajouter=' + 'a'.repeat(300))!.name).toHaveLength(140);
    expect(p('ajouter=Lire&source=https%3A%2F%2Fex.com%2Fa')).toEqual({ name: 'Lire', source: 'https://ex.com/a' });
    expect(p('ajouter=Lire&source=javascript%3Aalert(1)')!.source).toBeNull();
  });
});
