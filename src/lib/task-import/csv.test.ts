import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from './csv';

describe('parseCsv', () => {
  it('champs simples', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('guillemets, guillemet doublé, virgule et retour à la ligne dans un champ', () => {
    expect(parseCsv('a,b\n"x ""y"", z","1\n2"\n')).toEqual([['a', 'b'], ['x "y", z', '1\n2']]);
  });

  it('BOM, CRLF et CR seuls', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('champs vides et ligne terminée par un séparateur', () => {
    expect(parseCsv('a,,c\n1,2,')).toEqual([['a', '', 'c'], ['1', '2', '']]);
  });

  it('lignes vides ignorées, y compris en fin de fichier', () => {
    expect(parseCsv('a\n\n1\n\n')).toEqual([['a'], ['1']]);
  });

  it('séparateur imposé', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('détecte le séparateur sur la ligne d en-tête, hors guillemets', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('"a,1";b;c')).toBe(';');
    expect(detectDelimiter('\n\nTitre;Date\n')).toBe(';');
    expect(detectDelimiter('seul')).toBe(',');
  });

  it('sans séparateur imposé, détecte tout seul', () => {
    expect(parseCsv('Nom;Échéance\nCourses;2026-10-09')).toEqual([['Nom', 'Échéance'], ['Courses', '2026-10-09']]);
  });
});
