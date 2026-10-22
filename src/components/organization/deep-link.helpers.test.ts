import { describe, it, expect } from 'vitest';
import {
  readEntityParam,
  buildOrgLink,
  isOrgPath,
  legacyOrgTabRedirect,
  orgSectionPath,
} from './deep-link.helpers';
import { entityRedirect } from './entity-redirect';

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
    expect(isOrgPath('/entreprise//evil.com')).toBe(false);
    // Page d'équipe : un seul segment d'id, jamais un chemin libre.
    expect(isOrgPath('/entreprise/teams')).toBe(true);
    expect(isOrgPath('/entreprise/settings')).toBe(true);
    expect(isOrgPath('/entreprise/teams/0b6c1f1e-9d2a-4b1e-9f4e-2d1c0a9b8e7f')).toBe(true);
    expect(isOrgPath('/entreprise/teams/a/b')).toBe(false);
    expect(isOrgPath('/entreprise/teams/')).toBe(false);
    expect(isOrgPath('/entreprise/teams//evil.com')).toBe(false);
    expect(isOrgPath('/entreprise/teams/%2F%2Fevil.com')).toBe(false);
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

describe('entityRedirect (une URL d objet ouvre sa fiche depuis toute section)', () => {
  const p = (q: string) => new URLSearchParams(q);

  it('une équipe mène toujours à sa page', () => {
    expect(entityRedirect('tasks', p('?team=t1'))).toBe('/entreprise/teams/t1');
  });

  it('un projet demandé hors de Projets y mène, avec son id', () => {
    expect(entityRedirect('overview', p('?project=p1'))).toBe('/entreprise/projects?project=p1');
    expect(entityRedirect('okr', p('?project=p1'))).toBe('/entreprise/projects?project=p1');
  });

  it('un projet demandé DANS Projets ne redirige pas (la page projet s y ouvre)', () => {
    expect(entityRedirect('projects', p('?project=p1'))).toBeNull();
  });

  it('un objectif mène à la section OKR, sauf si on y est déjà', () => {
    expect(entityRedirect('tasks', p('?okr=o1'))).toBe('/entreprise/okr?okr=o1');
    expect(entityRedirect('okr', p('?okr=o1'))).toBeNull();
  });

  it('une tâche et un membre s ouvrent sur place : aucune redirection', () => {
    expect(entityRedirect('tasks', p('?task=x'))).toBeNull();
    expect(entityRedirect('stats', p('?member=m'))).toBeNull();
  });

  it('un id malformé est ignoré, comme partout', () => {
    expect(entityRedirect('tasks', p('?team=../x'))).toBeNull();
  });
});
