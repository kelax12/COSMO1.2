import { describe, it, expect } from 'vitest';
import { validateBugReport, BUG_REPORT_LIMITS } from './bug-report';

const validInput = {
  title: 'Le bouton envoyer ne repond pas',
  description: 'Sur la page Taches, cliquer sur Envoyer ne fait rien.',
};

function fakeFile(size: number, type: string): File {
  // `new File([blob])` avec un buffer de 3 Mo est inutilement couteux : on
  // ne teste que les deux champs lus par la validation.
  return { size, type, name: 'capture.png' } as File;
}

describe('validateBugReport', () => {
  it('accepte un rapport complet sans piece jointe', () => {
    expect(validateBugReport(validInput)).toBeNull();
  });

  it('refuse un titre trop court', () => {
    expect(validateBugReport({ ...validInput, title: 'ok' })).toBe('title');
  });

  it('refuse un titre trop long', () => {
    const title = 'a'.repeat(BUG_REPORT_LIMITS.titleMax + 1);
    expect(validateBugReport({ ...validInput, title })).toBe('title');
  });

  it('ignore les espaces de bordure', () => {
    expect(validateBugReport({ ...validInput, title: '   ab   ' })).toBe('title');
  });

  it('refuse une description trop courte', () => {
    expect(validateBugReport({ ...validInput, description: 'bug' })).toBe('description');
  });

  it('refuse une description trop longue', () => {
    const description = 'a'.repeat(BUG_REPORT_LIMITS.descriptionMax + 1);
    expect(validateBugReport({ ...validInput, description })).toBe('description');
  });

  it('accepte une capture PNG sous la limite', () => {
    const attachment = fakeFile(1024, 'image/png');
    expect(validateBugReport({ ...validInput, attachment })).toBeNull();
  });

  it('refuse une piece jointe trop lourde', () => {
    const attachment = fakeFile(BUG_REPORT_LIMITS.attachmentMaxBytes + 1, 'image/png');
    expect(validateBugReport({ ...validInput, attachment })).toBe('attachment');
  });

  it('refuse un type de fichier hors allowlist', () => {
    const attachment = fakeFile(1024, 'application/zip');
    expect(validateBugReport({ ...validInput, attachment })).toBe('attachment');
  });

  it('tolere l absence de piece jointe (null)', () => {
    expect(validateBugReport({ ...validInput, attachment: null })).toBeNull();
  });
});
