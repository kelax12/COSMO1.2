import { describe, expect, it } from 'vitest';
import { extractFParams, hasAnyFParam, rememberedFiltersKey } from './remembered-task-filters';

describe('remembered-task-filters — helpers purs', () => {
  it('extrait seulement les paramètres `f*`, une adresse d objet (`project=`) reste hors', () => {
    const params = new URLSearchParams('fStatus=overdue&fQ=devis&project=p1&other=x');
    expect(extractFParams(params)).toEqual({ fStatus: 'overdue', fQ: 'devis' });
  });

  it('aucun paramètre f* : objet vide', () => {
    expect(extractFParams(new URLSearchParams('project=p1'))).toEqual({});
  });

  it('détecte la présence d au moins un paramètre f*', () => {
    expect(hasAnyFParam(new URLSearchParams('fStatus=overdue'))).toBe(true);
    expect(hasAnyFParam(new URLSearchParams('project=p1'))).toBe(false);
  });

  it('la clé de stockage est scopée par écran et par organisation', () => {
    expect(rememberedFiltersKey('tasks', 'org1')).toBe('cosmo_org_filters:tasks:org1');
    expect(rememberedFiltersKey('projects', 'org2')).toBe('cosmo_org_filters:projects:org2');
  });
});
