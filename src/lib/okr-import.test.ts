// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { article as etudiant } from '@/content/blog/modele-okr-etudiant.mjs';
import { article as startup } from '@/content/blog/modele-okr-startup.mjs';
import { article as marketing } from '@/content/blog/modele-okr-equipe-marketing.mjs';
import { article as freelance } from '@/content/blog/modele-okr-freelance.mjs';
import { createOKRSchema } from '@/modules/okrs/okr.schema';
import {
  OKR_IMPORT_KEY,
  brouillonsDepuisLignes,
  lignesDuTableau,
  mettreDeCote,
  nombreAbsolu,
  reprendre,
  versCreateInput,
} from './okr-import';

const tableauDe = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return brouillonsDepuisLignes(lignesDuTableau(div));
};

beforeEach(() => sessionStorage.clear());

describe('nombreAbsolu', () => {
  it('lit le premier nombre, virgule décimale comprise', () => {
    expect(nombreAbsolu('1,8 %')).toBe(1.8);
    expect(nombreAbsolu('40')).toBe(40);
  });
  it('refuse le relatif et le non chiffré', () => {
    expect(nombreAbsolu('+20 %')).toBeNull();
    expect(nombreAbsolu('−20 %')).toBeNull();
    expect(nombreAbsolu('mesurée')).toBeNull();
  });
});

describe('modèles de la galerie → OKR', () => {
  it.each([etudiant, startup, marketing, freelance])('$slug : 3 objectifs valides au schéma de création', (a) => {
    const okrs = tableauDe(a.locales.fr!.html);
    expect(okrs).toHaveLength(3);
    for (const o of okrs) {
      expect(o.krs.length).toBeGreaterThanOrEqual(1);
      expect(createOKRSchema.safeParse(versCreateInput(o)).success).toBe(true);
    }
  });

  it('forme « départ → cible » : valeurs lues dans la 4e colonne', () => {
    const [premier] = tableauDe(startup.locales.fr!.html);
    const input = versCreateInput(premier);
    expect(input.title).toBe('Prouver que le marché veut le produit');
    expect(input.keyResults[0]).toMatchObject({ title: 'Clients payants actifs', currentValue: 12, targetValue: 30 });
    expect(input.keyResults[1]).toMatchObject({ unit: '%', currentValue: 45, targetValue: 60 });
  });

  it('cible relative : gardée lisible dans le titre, cible 0', () => {
    const okrs = tableauDe(freelance.locales.fr!.html);
    const kr = versCreateInput(okrs[1]).keyResults[0];
    expect(kr.title).toContain('+20 %');
    expect(kr.targetValue).toBe(0);
  });
});

describe('mise de côté', () => {
  it('un seul import : reprendre() efface le brouillon', () => {
    mettreDeCote([{ objectif: 'O', krs: [{ texte: 'K', unite: '', depart: '0', cible: '3' }] }]);
    expect(reprendre()).toHaveLength(1);
    expect(reprendre()).toEqual([]);
  });
  it('borne et filtre un brouillon forgé', () => {
    sessionStorage.setItem(
      OKR_IMPORT_KEY,
      JSON.stringify([{ objectif: 'x'.repeat(500), krs: [{ texte: '' }, { texte: 'ok', cible: 5 }] }, { objectif: '' }, 'brut']),
    );
    const [o, ...reste] = reprendre();
    expect(reste).toEqual([]);
    expect(o.objectif).toHaveLength(140);
    expect(o.krs).toEqual([{ texte: 'ok', unite: '', depart: '', cible: '' }]);
  });
  it('JSON invalide : rien', () => {
    sessionStorage.setItem(OKR_IMPORT_KEY, '{');
    expect(reprendre()).toEqual([]);
  });
});
