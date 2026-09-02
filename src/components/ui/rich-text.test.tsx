// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// RichText — le balisage minimal des catalogues
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI ces tests existent. `RichText` porte une allowlist de schémas
// d'URL présentée comme une frontière anti-XSS : rendre un `[libellé](url)`
// venu d'un catalogue, c'est rendre du texte dont on ne contrôlera plus la
// provenance le jour où une traduction est contribuée. Cette frontière est
// arrivée en production sans un seul cas vérifié. Un `javascript:` qui passe ne
// se voit pas à la relecture ; il se voit ici.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichText } from './rich-text';

afterEach(() => vi.restoreAllMocks());

describe('RichText — gras', () => {
  it('rend **texte** en <strong> et laisse le reste tel quel', () => {
    const { container } = render(<RichText>{'avant **gras** après'}</RichText>);
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('gras');
    expect(container.textContent).toBe('avant gras après');
  });

  it('ne transforme pas un `**` vide (pas de <strong> sans contenu)', () => {
    const { container } = render(<RichText>{'a ** b'}</RichText>);
    expect(container.querySelector('strong')).toBeNull();
  });
});

describe('RichText — liens', () => {
  it('rend un https:// en lien externe sûr', () => {
    render(<RichText>{'voir [la CNIL](https://www.cnil.fr) pour réclamer'}</RichText>);
    const a = screen.getByRole('link', { name: 'la CNIL' }) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('https://www.cnil.fr');
    expect(a.getAttribute('target')).toBe('_blank');
    // `noopener` : sans lui, la page ouverte peut réécrire l'onglet d'origine.
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('rend un mailto: sans target (ce n’est pas une page)', () => {
    render(<RichText>{'écrivez à [contact](mailto:a@b.fr)'}</RichText>);
    const a = screen.getByRole('link', { name: 'contact' });
    expect(a.getAttribute('href')).toBe('mailto:a@b.fr');
    expect(a.getAttribute('target')).toBeNull();
  });

  it('souligne les liens par défaut (WCAG 1.4.1 : jamais la couleur seule)', () => {
    render(<RichText>{'[x](https://a.fr)'}</RichText>);
    expect(screen.getByRole('link', { name: 'x' }).className).toContain('underline');
  });
});

describe('RichText — schémas refusés', () => {
  // Une URL refusée doit laisser la PHRASE lisible : on jette le lien, jamais
  // le libellé. Et elle ne doit jamais produire d'élément cliquable.
  it.each([
    'javascript:alert1',
    'JaVaScRiPt:alert1',
    'data:text/html;base64,PHNjcmlwdD4=',
    'http://exemple.fr',
    '/politique-confidentialite',
    'vbscript:msgbox1',
  ])('refuse %s et garde le libellé en texte brut', (url) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<RichText>{`a [libellé](${url}) b`}</RichText>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('a libellé b');
  });

  it('annonce le refus en développement au lieu de le taire', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<RichText>{'[x](javascript:alert1)'}</RichText>);
    // `import.meta.env.DEV` est vrai sous Vitest.
    expect(warn).toHaveBeenCalled();
  });

  it('rend une URL contenant une parenthèse SANS la tronquer', () => {
    // Regression : avec `\([^)]+\)`, le motif s'arretait a la premiere
    // parenthese fermante. Le lien partait vers une URL tronquee et le `)`
    // restant tombait dans la phrase. Un lien qui pointe silencieusement
    // ailleurs est pire qu'une absence de lien.
    const url = 'https://fr.wikipedia.org/wiki/Turing_(machine)';
    render(<RichText>{`a [x](${url}) b`}</RichText>);
    const a = screen.getByRole('link', { name: 'x' });
    expect(a.getAttribute('href')).toBe(url);
  });
});
