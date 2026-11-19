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

  it('loadDateLocale("hr") rend la locale croate, sans toucher aux autres', async () => {
    expect(getDateLocale('hr').code).toBe('fr');
    await loadDateLocale('hr');
    expect(getDateLocale('hr').code).toBe('hr');
    expect(getDateLocale('en').code).toBe('en-US');
  });

  it('une locale sans chargeur (es) retombe sur le français', async () => {
    await loadDateLocale('es');
    expect(getDateLocale('es').code).toBe('fr');
  });

  it('format.ts ne l’importe plus statiquement, main.tsx l’attend avant le montage', () => {
    const format = readFileSync('src/i18n/format.ts', 'utf8');
    expect(format).not.toMatch(/import\s*\{[^}]*\benUS\b[^}]*\}\s*from/);
    expect(format).not.toMatch(/import\s*\{[^}]*\bhr\b[^}]*\}\s*from/);
    expect(format).toContain("import('date-fns/locale/en-US')");
    expect(format).toContain("import('date-fns/locale/hr')");
    expect(format).not.toContain("locale !== 'en'");
    expect(readFileSync('src/main.tsx', 'utf8')).toContain('Promise.all([loadCatalogs(activeLocale), loadDateLocale(activeLocale)])');
  });

  it('vite.config.ts sort les locales paresseuses de vendor-utils AVANT la règle date-fns', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain(String.raw`const LAZY_DATE_FNS_LOCALE = /node_modules\/date-fns\/locale\/(en-US|hr)[/.]/;`);
    const sortie = config.indexOf('if (LAZY_DATE_FNS_LOCALE.test(id)) return undefined;');
    const regle = config.indexOf("if (id.includes('node_modules/date-fns') ||");
    expect(sortie).toBeGreaterThan(-1);
    expect(sortie).toBeLessThan(regle);
  });
});
