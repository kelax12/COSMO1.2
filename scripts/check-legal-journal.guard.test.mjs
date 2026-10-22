// ═══════════════════════════════════════════════════════════════════
// Témoin de `check-legal-journal.mjs` (C-107), posé le 2026-10-01
//
// La garde n'en avait pas. Elle a changé ce jour-là : l'empreinte d'une langue
// porte désormais sur la RÉUNION de trois catalogues (`legal`, `legalTerms`,
// `legalPrivacy`), découpés pour tenir le budget de bundle. Ce témoin vérifie
// les deux moitiés de la promesse : un découpage ne change pas l'empreinte,
// une modification de texte la change.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { empreinte, empreintesActuelles, empreintesDuJournal, DOCUMENTS } from './check-legal-journal.mjs';

const dir = mkdtempSync(join(tmpdir(), 'legal-journal-'));
const ecrire = (nom, obj) => {
  const p = join(dir, nom);
  writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
};

const DOC = {
  back: 'Retour',
  notice: { title: 'Mentions légales' },
  terms: { s1: { p1: 'Le service est fourni tel quel.' } },
  privacy: { s1: { p1: 'Nous ne vendons aucune donnée.' } },
};

describe('check-legal-journal : empreinte d un document découpé', () => {
  it('un découpage en plusieurs catalogues ne change PAS l empreinte', () => {
    const entier = empreinte(ecrire('entier.json', DOC));
    const decoupe = empreinte([
      ecrire('a.json', { back: DOC.back, notice: DOC.notice }),
      ecrire('b.json', { terms: DOC.terms }),
      ecrire('c.json', { privacy: DOC.privacy }),
    ]);
    expect(decoupe).toBe(entier);
  });

  it('TÉMOIN : un seul mot changé dans un seul catalogue change l empreinte', () => {
    const avant = empreinte([ecrire('a1.json', { terms: DOC.terms }), ecrire('b1.json', { privacy: DOC.privacy })]);
    const apres = empreinte([
      ecrire('a2.json', { terms: { s1: { p1: 'Le service est fourni tel quel, sans garantie.' } } }),
      ecrire('b2.json', { privacy: DOC.privacy }),
    ]);
    expect(apres).not.toBe(avant);
  });

  it('une section présente dans deux catalogues du même document est refusée', () => {
    expect(() => empreinte([ecrire('d1.json', { terms: DOC.terms }), ecrire('d2.json', { terms: DOC.terms })]))
      .toThrow(/deux fois/);
  });

  it('les deux documents du dépôt, trois catalogues chacun, sont cités par le journal', () => {
    expect(Object.values(DOCUMENTS).map((c) => c.length)).toEqual([3, 3]);
    const cites = empreintesDuJournal(readFileSync(join(process.cwd(), 'docs/LEGAL-JOURNAL.md'), 'utf8'));
    for (const [doc, h] of Object.entries(empreintesActuelles())) {
      expect(cites.has(h), `${doc} → ${h} absente du journal`).toBe(true);
    }
  });
});
