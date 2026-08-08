import { describe, it, expect } from 'vitest';
import { readEntityParam, buildOrgLink } from './deep-link.helpers';

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
  it("construit un lien d'onglet seul", () => {
    expect(buildOrgLink('projects')).toBe('/entreprise?tab=projects');
  });

  it('construit un lien vers une entité', () => {
    expect(buildOrgLink('projects', { task: 'abc' })).toBe('/entreprise?tab=projects&task=abc');
  });

  it("omet l'onglet par défaut", () => {
    expect(buildOrgLink('overview')).toBe('/entreprise');
  });

  it("garde l'entité même sur l'onglet par défaut", () => {
    expect(buildOrgLink('overview', { task: 'abc' })).toBe('/entreprise?task=abc');
  });

  it('ignore une entité vide', () => {
    expect(buildOrgLink('projects', { task: '' })).toBe('/entreprise?tab=projects');
  });
});
