// @vitest-environment node
// src/components/org-guide/guide-scenarios.guard.test.ts
import { SAVE_AS_TEMPLATE_ENABLED } from '@/components/organization/projectTemplatesFlag';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import fr from '@/locales/fr/orgGuide.json';
import en from '@/locales/en/orgGuide.json';
import { ORG_SECTIONS } from '@/components/organization/org-sections';
import { GUIDE_ACTIONS } from './scenarios';

/**
 * Garde des scénarios du guide entreprise.
 *
 * Chaque cible d'un scénario doit exister comme `data-guide-id` dans `src/`.
 * Trois formes d'ancrage sont reconnues, et aucune autre :
 *  1. littérale : `data-guide-id="x"` ;
 *  2. expression à littéraux : `data-guide-id={cond ? 'x' : 'y'}` donne x et y ;
 *  3. gabarit : `data-guide-id={`prefix-${...}`}` ; le préfixe doit être
 *     déclaré dans `TEMPLATE_SUFFIXES`, qui dit d'où viennent ses suffixes.
 * Un gabarit au préfixe inconnu fait échouer la garde : on ne devine pas.
 */
const SRC = join(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [p] : [];
  });

/** Suffixes `id: 'x'` (et `navButton('x'`) déclarés dans le MÊME fichier que le gabarit. */
const idLiteralsOf = (source: string): string[] => [
  ...[...source.matchAll(/\bid: '([A-Za-z0-9]+)'/g)].map((m) => m[1]),
  ...[...source.matchAll(/navButton\('([A-Za-z0-9]+)'/g)].map((m) => m[1]),
];

const TEMPLATE_SUFFIXES: Record<string, (source: string) => string[]> = {
  // Liens de section de `OrgSideNav` : une entrée par section non masquée.
  'nav-': () => ORG_SECTIONS.filter((s) => !s.hidden).map((s) => s.id),
  // Rubriques de Paramètres (`OrgSettingsSection`) et onglets d'invitation (`InviteModeDialog`).
  'settings-panel-': idLiteralsOf,
  'invite-mode-': idLiteralsOf,
};

const LITERAL_RE = /data-guide-id="([A-Za-z0-9-]+)"/g;
const EXPR_START_RE = /data-guide-id=\{/g;
const TEMPLATE_RE = /^`([a-z0-9-]+)\$\{[^`]*\}`$/;

/** Contenu entre l'accolade ouvrante `open` et sa fermante (accolades imbriquées comprises). */
const braced = (source: string, open: number): string => {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return '';
};

/**
 * Balise ouvrante JSX qui contient la position `at`, attributs compris. On
 * remonte au dernier `<Lettre`, puis on avance jusqu'au `>` hors accolades :
 * le `=>` d'un `onClick={() => ...}` ne coupe rien.
 */
const openingTagAround = (source: string, at: number): string => {
  let start = at;
  while (start > 0 && !(source[start] === '<' && /[A-Za-z]/.test(source[start + 1] ?? ''))) start--;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
};

const anchors = new Map<string, string>();
const unknownTemplates: string[] = [];
for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const where = relative(SRC, file);
  for (const m of source.matchAll(LITERAL_RE)) anchors.set(m[1], openingTagAround(source, m.index ?? 0));
  for (const m of source.matchAll(EXPR_START_RE)) {
    const at = m.index ?? 0;
    const expr = braced(source, at + m[0].length - 1).trim();
    const tag = openingTagAround(source, at);
    const template = TEMPLATE_RE.exec(expr);
    if (template) {
      const suffixes = TEMPLATE_SUFFIXES[template[1]];
      if (!suffixes) { unknownTemplates.push(`${where}: ${expr}`); continue; }
      for (const s of suffixes(source)) anchors.set(`${template[1]}${s}`, tag);
      continue;
    }
    const literals = [...expr.matchAll(/'([A-Za-z0-9-]+)'/g)].map((l) => l[1]);
    if (literals.length === 0) unknownTemplates.push(`${where}: ${expr}`);
    for (const id of literals) anchors.set(id, tag);
  }
}

const targets = GUIDE_ACTIONS.flatMap((a) => a.steps.map((s) => (s.kind === 'goto' ? s.via : s.kind === 'handoff' ? null : s.target)))
  .filter((t): t is string => !!t);

const lookup = (cat: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), cat);

describe('scénarios du guide entreprise', () => {
  it('ids d\'action uniques', () => {
    // 28 et non 30 : « Lier un KR à un projet » n'a plus d'écran, et « Lancer la revue
    // hebdomadaire » vivait dans Statistiques, page masquée (décision du 2026-10-13).
    // 28 tant que « Créer un projet depuis un modèle » est masqué (projectTemplatesFlag).
    expect(GUIDE_ACTIONS).toHaveLength(SAVE_AS_TEMPLATE_ENABLED ? 28 : 27);
    expect(new Set(GUIDE_ACTIONS.map((a) => a.id)).size).toBe(GUIDE_ACTIONS.length);
  });

  it('aucun ancrage dynamique illisible', () => {
    expect(unknownTemplates).toEqual([]);
  });

  it('témoin : la garde voit les trois formes d\'ancrage, et seulement elles', () => {
    expect(anchors.has('projects-new')).toBe(true);
    expect(anchors.get('projects-new')).toMatch(/^<button\b/);
    expect(anchors.has('task-detail-subtasks')).toBe(true);
    expect(anchors.has('nav-settings')).toBe(true);
    expect(anchors.has('nav-stats')).toBe(false);
    expect(anchors.has('settings-panel-danger')).toBe(true);
    expect(anchors.has('settings-panel-nexistepas')).toBe(false);
  });

  it.each([...new Set(targets)])('l\'ancrage %s existe dans src/', (id) => {
    expect(anchors.has(id), `data-guide-id="${id}" introuvable`).toBe(true);
  });

  it('aucun ancrage sur un bouton qui écrit', () => {
    const writes = [...anchors].filter(([, tag]) =>
      /type=["']submit["']/.test(tag) || /data-guide-forbid/.test(tag));
    expect(writes.map(([id]) => id)).toEqual([]);
  });

  it('les étapes `click` ne visent pas un id évoquant une écriture', () => {
    const risky = GUIDE_ACTIONS.flatMap((a) => a.steps)
      .filter((s) => s.kind === 'click' && /(save|submit|confirm|delete|remove|create-confirm)/.test(s.target));
    expect(risky).toEqual([]);
  });

  it.each(['fr', 'en'] as const)('toutes les clés existent en %s', (lang) => {
    const cat = lang === 'fr' ? fr : en;
    const keys = GUIDE_ACTIONS.flatMap((a) => [
      `actions.${a.id}.label`, `actions.${a.id}.synonyms`,
      ...a.steps.flatMap((s) => [
        'bubbleKey' in s ? s.bubbleKey : undefined,
        'emptyKey' in s ? s.emptyKey : undefined,
      ]),
    ]).filter((key): key is string => !!key);
    const missing = keys.filter((key) => typeof lookup(cat, key) !== 'string');
    expect(missing).toEqual([]);
  });
});
