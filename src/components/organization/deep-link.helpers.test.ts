import { describe, it, expect } from 'vitest';
import {
  orgItemPath,
  readEntityParam,
  buildOrgLink,
  isOrgPath,
  legacyOrgTabRedirect,
  orgSectionPath,
} from './deep-link.helpers';

describe('readEntityParam', () => {
  it('lit un id de tâche', () => {
    expect(readEntityParam(new URLSearchParams('?task=abc'), 'task')).toBe('abc');
  });

  it('lit un UUID Supabase complet', () => {
    const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    expect(readEntityParam(new URLSearchParams(`?member=${uuid}`), 'member')).toBe(uuid);
  });

  it('retourne null quand le paramètre est absent', () => {
    expect(readEntityParam(new URLSearchParams('?tab=okr'), 'task')).toBeNull();
  });

  it('retourne null sur une valeur vide', () => {
    expect(readEntityParam(new URLSearchParams('?task='), 'task')).toBeNull();
  });

  it('rejette une valeur trop longue (garde anti-URL forgée)', () => {
    const long = 'x'.repeat(100);
    expect(readEntityParam(new URLSearchParams(`?task=${long}`), 'task')).toBeNull();
  });

  it('rejette une valeur avec des caractères hors id', () => {
    expect(readEntityParam(new URLSearchParams('?task=<script>'), 'task')).toBeNull();
  });
});

describe('buildOrgLink', () => {
  it("construit un lien de section seul", () => {
    expect(buildOrgLink('projects')).toBe('/entreprise/projects');
  });

  it('construit un lien vers une entité', () => {
    expect(buildOrgLink('projects', { task: 'abc' })).toBe('/entreprise/projects?task=abc');
  });

  it("omet l'onglet par défaut", () => {
    expect(buildOrgLink('overview')).toBe('/entreprise');
  });

  it("garde l'entité même sur l'onglet par défaut", () => {
    expect(buildOrgLink('overview', { task: 'abc' })).toBe('/entreprise?task=abc');
  });

  it('ignore une entité vide', () => {
    expect(buildOrgLink('projects', { task: '' })).toBe('/entreprise/projects');
  });

  it('construit le lien de fiche membre attendu par la pyramide', () => {
    // Contrat entre `MemberProfileSheet` (qui produit le lien) et `PyramidTab`
    // (qui le consomme) : si l'onglet ou le nom du paramètre change ici, le
    // lien partagé ouvre une page vide.
    expect(buildOrgLink('pyramid', { member: 'u1' })).toBe('/entreprise/pyramid?member=u1');
  });

  it('produit un lien que readEntityParam sait relire', () => {
    const link = buildOrgLink('pyramid', { member: 'abc-123' });
    const params = new URLSearchParams(link.split('?')[1]);
    expect(readEntityParam(params, 'member')).toBe('abc-123');
  });
});

describe('orgSectionPath / isOrgPath', () => {
  it('renvoie l\x27aperçu pour une section inconnue, vide ou « overview »', () => {
    expect(orgSectionPath('overview')).toBe('/entreprise');
    expect(orgSectionPath('')).toBe('/entreprise');
    expect(orgSectionPath('../admin')).toBe('/entreprise');
    expect(orgSectionPath('billing')).toBe('/entreprise/billing');
  });

  it('ne reconnaît que les sections connues, jamais un préfixe libre', () => {
    expect(isOrgPath('/entreprise')).toBe(true);
    expect(isOrgPath('/entreprise/okr')).toBe(true);
    expect(isOrgPath('/entreprise/onboarding')).toBe(false);
    expect(isOrgPath('/entreprise/okr/x')).toBe(false);
    // Pages par objet (M7) : projets et équipes seulement, id bien formé.
    expect(isOrgPath('/entreprise/projects/abc-123')).toBe(true);
    expect(isOrgPath('/entreprise/teams/t1')).toBe(true);
    expect(isOrgPath('/entreprise/projects/a/b')).toBe(false);
    expect(isOrgPath('/entreprise/projects/<x>')).toBe(false);
    expect(isOrgPath('/entreprise/teams')).toBe(true);
    expect(isOrgPath('/entreprise/settings')).toBe(true);
    expect(isOrgPath('/entreprise//evil.com')).toBe(false);
  });
});

describe('legacyOrgTabRedirect', () => {
  it('ne fait rien sans ?tab=', () => {
    expect(legacyOrgTabRedirect(new URLSearchParams('?task=abc'))).toBeNull();
  });

  it('garde le retour de Stripe (checkout) en passant à la route', () => {
    // Contrat avec stripe-org-checkout / stripe-org-portal / renewal-notice :
    // ces URLs sont déjà dans des e-mails envoyés, elles ne changeront jamais.
    expect(legacyOrgTabRedirect(new URLSearchParams('?tab=billing&checkout=success'))).toBe(
      '/entreprise/billing?checkout=success',
    );
  });

  it('garde les paramètres d\x27entité', () => {
    expect(
      legacyOrgTabRedirect(new URLSearchParams('?tab=pyramid&member=u1&memberTab=contribution')),
    ).toBe('/entreprise/pyramid?member=u1&memberTab=contribution');
  });

  it('renvoie un onglet inconnu ou « overview » sur l\x27aperçu', () => {
    expect(legacyOrgTabRedirect(new URLSearchParams('?tab=overview'))).toBe('/entreprise');
    expect(legacyOrgTabRedirect(new URLSearchParams('?tab=nope&task=a'))).toBe('/entreprise?task=a');
  });
});

describe('orgItemPath', () => {
  it('construit la page d un projet ou d une equipe', () => {
    expect(orgItemPath('projects', 'p1')).toBe('/entreprise/projects/p1');
    expect(orgItemPath('teams', 'team-dev')).toBe('/entreprise/teams/team-dev');
  });

  it('refuse un identifiant qui serait un chemin', () => {
    expect(orgItemPath('projects', '../admin')).toBe('/entreprise/projects');
  });
});
