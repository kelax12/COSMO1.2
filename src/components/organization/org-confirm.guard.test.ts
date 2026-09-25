// ═══════════════════════════════════════════════════════════════════
// Garde : plus de `window.confirm` dans le mode entreprise
//
// Audit du 2026-09-24, étape 3 : « trois styles de confirmation coexistent
// (window.confirm, dialogues maison, saisie du nom) ». `window.confirm` ne se
// met pas au thème, ne se traduit pas avec l'application et n'annonce aucun
// impact. Tout geste lourd passe par `OrgConfirmDialog`.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/components/organization', 'src/pages/organization'];
const files = ROOTS.flatMap((dir) => {
  try {
    return readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => join(dir, f));
  } catch {
    return [];
  }
}).concat('src/pages/OrganizationPage.tsx');

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('mode entreprise — une seule façon de confirmer', () => {
  it('TÉMOIN : le balayage voit les fichiers du mode entreprise', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(files).toContain(join('src/components/organization', 'OrgConfirmDialog.tsx'));
  });

  it('TÉMOIN : le détecteur voit un window.confirm', () => {
    expect(/\bwindow\.confirm\s*\(|(^|[^.\w])confirm\s*\(/.test(stripComments('if (window.confirm(t("x"))) go();'))).toBe(true);
  });

  it('aucun window.confirm ni confirm() nu', () => {
    const offenders = files.filter((f) =>
      /\bwindow\.confirm\s*\(|(^|[^.\w])confirm\s*\(/m.test(stripComments(readFileSync(f, 'utf8'))),
    );
    expect(offenders, 'Passer par OrgConfirmDialog (titre, impact, saisie du nom si irréversible).').toEqual([]);
  });
});
