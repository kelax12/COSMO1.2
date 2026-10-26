import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getDateLocale, loadDateLocale } from './format';

// AM-6 de docs/PERFORMANCE.md (2026-10-24) : la locale date-fns anglaise ne vit
// plus dans `vendor-utils`, chunk du chemin critique chargé par TOUT visiteur.
// Elle se charge au démarrage, et seulement en anglais.
describe('locale date-fns anglaise chargée à la demande', () => {
  it('loadDateLocale("en") rend la vraie locale anglaise', async () => {
    await loadDateLocale('en');
    expect(getDateLocale('en').code).toBe('en-US');
    expect(getDateLocale('fr').code).toBe('fr');
  });

  it('format.ts ne l’importe plus statiquement, main.tsx l’attend avant le montage', () => {
    const format = readFileSync('src/i18n/format.ts', 'utf8');
    expect(format).not.toMatch(/import\s*\{[^}]*\benUS\b[^}]*\}\s*from/);
    expect(format).toContain("import('date-fns/locale/en-US')");
    expect(readFileSync('src/main.tsx', 'utf8')).toContain('Promise.all([loadCatalogs(activeLocale), loadDateLocale(activeLocale)])');
  });

  it('vite.config.ts la sort de vendor-utils AVANT la règle date-fns', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    const sortie = config.indexOf("if (id.includes('node_modules/date-fns/locale/en-US')) return undefined;");
    const regle = config.indexOf("if (id.includes('node_modules/date-fns') ||");
    expect(sortie).toBeGreaterThan(-1);
    expect(sortie).toBeLessThan(regle);
  });
});
