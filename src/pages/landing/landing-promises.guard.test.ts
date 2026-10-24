// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Garde · les promesses de la landing ont une preuve (UI-PATTERNS.md, AM-4).
//
// Lit le manifeste `__test__/landing-promises.manifest.ts` (données de test,
// hors du scan des chaînes en dur : ce ne sont pas des textes affichés) et le confronte :
//   1. au texte réellement publié (catalogues, SEO, cas d'usage, prérendu) ;
//   2. au code (chaque preuve : fichier + motif) ;
//   3. à des mesures (jeu de démo, droits, grille de paliers, remise annuelle).
//
// Et il balaie TOUS les chiffres de ces surfaces : un chiffre qu'aucune
// promesse n'autorise à cette clé fait échouer le test.
//
// Les surfaces sont lues comme du TEXTE (le prérendu est un script Node : on
// n'exécute pas le build statique).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LANDING_PROMISES, type LandingPromise, type PromiseProof } from '@/pages/landing/__test__/landing-promises.manifest';
import {
  ENTERPRISE_PRICING_TIERS,
  ENTERPRISE_YEARLY_DISCOUNT,
  ORG_FREE_SEATS,
} from '@/modules/billing/premium-config';
import { ORG_PERMISSION_KEYS } from '@/modules/organizations/permissions';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { LocalStorageEventsRepository } from '@/modules/events/repository';
import { LocalStorageOKRsRepository } from '@/modules/okrs/repository';
import { LocalStorageOrganizationsRepository, DEMO_ORG_ID } from '@/modules/organizations/local.repository';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf-8');

// ─── Chiffres : écrits en chiffres ou en lettres, fr et en ──────────
const WORDS: Record<string, string> = {
  deux: '2', two: '2', twice: '2', trois: '3', three: '3', quatre: '4', four: '4', cinq: '5', five: '5',
  six: '6', sept: '7', seven: '7', huit: '8', eight: '8', neuf: '9', nine: '9', dix: '10', ten: '10',
  onze: '11', eleven: '11', douze: '12', twelve: '12', treize: '13', thirteen: '13',
  quinze: '15', quinzaine: '15', fifteen: '15', vingt: '20', twenty: '20', trente: '30', thirty: '30',
  quarante: '40', forty: '40', cinquante: '50', fifty: '50', cent: '100', hundred: '100',
};
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join('|')})\\b`, 'gi');

/** Chiffres normalisés d'un texte, dans l'ordre. Années et numéros de section ignorés. */
export function figuresOf(text: string): string[] {
  const t = text.replace(/^\/\/ \d\d ·/, '').replace(/\b20\d\d\b/g, ' ');
  const out: string[] = [];
  for (const m of t.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(m[0]);
  for (const m of t.matchAll(WORD_RE)) out.push(WORDS[m[1].toLowerCase()]);
  for (const _m of t.matchAll(/\b(un an|one year)\b|(?<=for )a year\b/gi)) out.push('1an');
  return out;
}

// ─── Surfaces de texte ──────────────────────────────────────────────
interface Surface {
  fr: string;
  en?: string;
}

function flatten(o: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof o === 'string') out.set(prefix, o);
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
}

function catalog(locale: string, file: string, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  flatten(JSON.parse(read(`src/locales/${locale}/${file}.json`)), prefix, out);
  return out;
}

/** Pages écrites en dur dans le prérendu, découpées par chemin puis par langue. */
export function prerenderPages(source: string): Map<string, { fr: string; en: string }> {
  const a = source.indexOf('const ROUTES = [');
  const b = source.indexOf("path: '/blog',");
  const pages = new Map<string, { fr: string; en: string }>();
  const parts = source.slice(a, b).split(/^\s{4}path: '/m).slice(1);
  for (const part of parts) {
    const path = part.slice(0, part.indexOf("'"));
    const body = part
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\$\{PRIX_VISIBLES \? `/g, ' ')
      .replace(/` : ''\}/g, ' ');
    const lits = [...body.matchAll(/`([^`]*)`/g)].map((m) => m[1].replace(/<[^>]+>/g, ' '));
    if (lits.length !== 2) {
      throw new Error(`prérendu ${path} : ${lits.length} gabarits au lieu de 2 (fr, en), la garde ne sait plus le lire`);
    }
    pages.set(`prerender:${path}`, { fr: lits[0], en: lits[1] });
  }
  return pages;
}

async function loadSurfaces(): Promise<Map<string, Surface>> {
  const s = new Map<string, Surface>();
  for (const file of ['landing', 'landingEnterprise']) {
    const en = catalog('en', file);
    for (const [k, v] of catalog('fr', file)) s.set(k, { fr: v, en: en.get(k) });
  }
  const seoEn = catalog('en', 'seo', 'seo');
  for (const [k, v] of catalog('fr', 'seo', 'seo')) s.set(k, { fr: v, en: seoEn.get(k) });

  const mod = (await import(pathToFileURL(join(ROOT, 'src/content/use-cases.mjs')).href)) as {
    USE_CASES: { routeId: string; locales: Record<string, Record<string, unknown>> }[];
  };
  for (const u of mod.USE_CASES) {
    const fr = new Map<string, string>();
    const en = new Map<string, string>();
    flatten(u.locales.fr, `usecase.${u.routeId}`, fr);
    if (u.locales.en) flatten(u.locales.en, `usecase.${u.routeId}`, en);
    for (const [k, v] of fr) s.set(k, { fr: v, en: en.get(k) });
  }
  for (const [k, v] of prerenderPages(read('prerender.mjs'))) s.set(k, v);
  return s;
}

const matchesKey = (pattern: string, key: string): boolean =>
  pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : pattern === key;

/** Les chiffres de ces clés ne sont pas des textes à parité mot pour mot (cas d'usage : prose longue). */
const multiset = (xs: string[]): string => [...xs].sort().join(',');

// ─── Preuves ────────────────────────────────────────────────────────
export function proofFailure(p: PromiseProof, reader: (rel: string) => string | null): string | null {
  const text = reader(p.file);
  if (text === null) return `${p.file} : fichier absent`;
  if (p.has !== undefined && !text.includes(p.has)) return `${p.file} : ne contient plus « ${p.has} »`;
  if (p.re !== undefined && !new RegExp(p.re, 'm').test(text)) return `${p.file} : motif /${p.re}/ introuvable`;
  if (p.lacks !== undefined && text.includes(p.lacks)) return `${p.file} : contient « ${p.lacks} », interdit`;
  return null;
}
const fsReader = (rel: string): string | null => (existsSync(join(ROOT, rel)) ? read(rel) : null);

const surfaces = await loadSurfaces();

describe('manifeste des promesses de la landing', () => {
  it('identifiants uniques, et toute promesse a une ancre', () => {
    const ids = LANDING_PROMISES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of LANDING_PROMISES) expect(p.anchors.length, p.id).toBeGreaterThan(0);
  });

  it('une promesse produit ou limite a au moins une preuve ; les autres disent pourquoi non', () => {
    for (const p of LANDING_PROMISES) {
      if (p.kind === 'produit' || p.kind === 'limite') expect(p.proofs.length, p.id).toBeGreaterThan(0);
      else expect(p.reason, p.id).toBeTruthy();
    }
  });

  it('chaque ancre est toujours écrite dans le texte publié', () => {
    const manquantes: string[] = [];
    for (const p of LANDING_PROMISES) {
      for (const a of p.anchors) {
        const text = surfaces.get(a.key)?.fr;
        if (text === undefined) manquantes.push(`${p.id} : clé ${a.key} introuvable`);
        else if (!text.includes(a.includes)) manquantes.push(`${p.id} : « ${a.includes} » absent de ${a.key}`);
      }
    }
    expect(manquantes, 'texte modifié ou retiré : revoir la promesse dans le manifeste').toEqual([]);
  });

  it('chaque promesse tenue a toutes ses preuves dans le code', () => {
    const echecs: string[] = [];
    for (const p of LANDING_PROMISES.filter((x) => x.verdict !== 'fausse')) {
      for (const pr of p.proofs) {
        const f = proofFailure(pr, fsReader);
        if (f) echecs.push(`${p.id} → ${f}`);
      }
    }
    expect(echecs).toEqual([]);
  });
});

describe('chiffres de la landing', () => {
  it('tout chiffre écrit est autorisé, à cette clé, par une promesse', () => {
    const interdits: string[] = [];
    for (const [key, surf] of surfaces) {
      for (const [lang, text] of [['fr', surf.fr], ['en', surf.en]] as const) {
        if (text === undefined) continue;
        for (const token of new Set(figuresOf(text))) {
          const ok = LANDING_PROMISES.some((p) => p.figures?.[token]?.some((pat) => matchesKey(pat, key)));
          if (!ok) interdits.push(`${key} [${lang}] : « ${token} » sans promesse`);
        }
      }
    }
    expect(interdits, 'chiffre nouveau : ajouter la promesse (et sa preuve) au manifeste').toEqual([]);
  });

  it('tout chiffre déclaré dans le manifeste est encore écrit à cette clé (rien d’obsolète)', () => {
    const obsoletes: string[] = [];
    for (const p of LANDING_PROMISES) {
      for (const [token, patterns] of Object.entries(p.figures ?? {})) {
        for (const pat of patterns) {
          const keys = [...surfaces.keys()].filter((k) => matchesKey(pat, k));
          const vu = keys.some((k) => {
            const s = surfaces.get(k)!;
            return figuresOf(s.fr).includes(token) || (s.en !== undefined && figuresOf(s.en).includes(token));
          });
          if (!vu) obsoletes.push(`${p.id} : « ${token} » n'est plus écrit à ${pat}`);
        }
      }
    }
    expect(obsoletes).toEqual([]);
  });

  it('le français et l’anglais portent les mêmes chiffres, clé par clé', () => {
    const ecarts: string[] = [];
    for (const [key, surf] of surfaces) {
      if (surf.en === undefined || key.startsWith('usecase.')) continue;
      const fr = multiset(figuresOf(surf.fr));
      const en = multiset(figuresOf(surf.en));
      if (fr !== en) ecarts.push(`${key} : fr [${fr}] ≠ en [${en}]`);
    }
    expect(ecarts).toEqual([]);
  });
});

describe('mesures : les chiffres de limite tiennent', () => {
  const fausse = (id: string): LandingPromise => LANDING_PROMISES.find((p) => p.id === id)!;

  it('le palier gratuit s’arrête à 5 membres, partout', () => {
    expect(ENTERPRISE_PRICING_TIERS[0]).toMatchObject({ key: 'free', maxMembers: 5, priceEurPerMonth: 0 });
    expect(ORG_FREE_SEATS).toBe(5);
  });

  it('la grille écrite dans le prérendu est celle des paliers', () => {
    const [fr, en] = ['fr', 'en'].map((l) => {
      const page = prerenderPages(read('prerender.mjs')).get('prerender:/entreprise-presentation')!;
      const text = l === 'fr' ? page.fr : page.en;
      const i = text.search(l === 'fr' ? /gratuit jusqu'à/ : /free up to/);
      return multiset(figuresOf(text.slice(i, i + 220).split('</p>')[0].split(/\. /)[0]));
    });
    const attendu = multiset(
      ENTERPRISE_PRICING_TIERS.flatMap((t) => [t.minMembers, t.maxMembers, t.priceEurPerMonth])
        .filter((n) => n !== null && n !== 0)
        .map(String),
    );
    // Chaque borne et prix attendus sont écrits, ni plus ni moins (une borne sert deux fois).
    const dedoublonne = (s: string): string => [...new Set(s.split(','))].sort().join(',');
    expect(dedoublonne(fr)).toBe(dedoublonne(attendu));
    expect(dedoublonne(en)).toBe(dedoublonne(attendu));
  });

  it('« 20 € par mois pour dix personnes » est le palier t10', () => {
    const t10 = ENTERPRISE_PRICING_TIERS.find((t) => t.key === 't10')!;
    expect([t10.priceEurPerMonth, t10.maxMembers]).toEqual([20, 10]);
  });

  it('la remise annuelle écrite (30 %) est celle du produit', () => {
    expect(ENTERPRISE_YEARLY_DISCOUNT).toBe(0.3);
  });

  it('« 20 fonctionnalités en plus » : vingt cartes, ni dix-neuf ni vingt et une', () => {
    for (const l of ['fr', 'en']) {
      const cards = [...catalog(l, 'landingEnterprise').keys()].filter((k) => /^enterprise\.more\.f\d+t$/.test(k));
      expect(cards, l).toHaveLength(20);
    }
  });

  it('démo : la promesse « 100 tâches, 100 habitudes, 150 événements, 8 OKR » est TOUJOURS fausse', async () => {
    localStorage.clear();
    const mesure = [
      (await new LocalStorageTasksRepository().getAll()).length,
      (await new LocalStorageHabitsRepository().fetchHabits()).length,
      (await new LocalStorageEventsRepository().getAll()).length,
      (await new LocalStorageOKRsRepository().getAll()).length,
    ];
    expect(fausse('demo-volume').verdict).toBe('fausse');
    expect(mesure, 'le jeu de démo a changé : rebasculer demo-volume').not.toEqual([100, 100, 150, 8]);
  });

  it('droits : « treize droits » est TOUJOURS faux', () => {
    expect(ORG_PERMISSION_KEYS.length).not.toBe(13);
  });

  it('démo entreprise : « six personnes » est TOUJOURS faux', async () => {
    localStorage.clear();
    const members = await new LocalStorageOrganizationsRepository().getMembers(DEMO_ORG_ID);
    expect(members.length).not.toBe(6);
  });

  it('chaque promesse fausse a un constat et une preuve du constat dans le code', () => {
    for (const p of LANDING_PROMISES.filter((x) => x.verdict === 'fausse')) {
      expect(p.constat, p.id).toBeTruthy();
      expect(p.proofs.length, p.id).toBeGreaterThan(0);
      for (const pr of p.proofs) expect(proofFailure(pr, fsReader), `${p.id} : le constat ne tient plus, rebasculer`).toBeNull();
    }
  });

  it('cliquet : le nombre de promesses fausses connues ne bouge qu’en le disant', () => {
    expect(LANDING_PROMISES.filter((p) => p.verdict === 'fausse').map((p) => p.id).sort()).toEqual([
      'demo-volume',
      'entreprise-demo-effectif',
      'entreprise-droits-reglables',
      'habitudes-frequence',
    ]);
  });
});

describe('TÉMOINS : la garde voit ce qu’elle doit voir', () => {
  it('un chiffre nouveau dans un texte est détecté (chiffres et lettres, fr et en)', () => {
    expect(figuresOf('Jusqu\'à 7 membres')).toEqual(['7']);
    expect(figuresOf('jusqu’à sept membres')).toEqual(['7']);
    expect(figuresOf('up to seven members')).toEqual(['7']);
    expect(figuresOf('conservé un an')).toEqual(['1an']);
    expect(figuresOf('billed once a year')).toEqual([]);
    expect(figuresOf('© 2026 // 01')).toEqual(['01']);
    expect(figuresOf('// 01 · Time blocking')).toEqual([]);
  });

  it('un chiffre introduit hors du manifeste ferait échouer le balayage', () => {
    const faux = new Map(surfaces);
    faux.set('faq.a1', { fr: `${surfaces.get('faq.a1')!.fr} Et 7 projets offerts.` });
    const interdits: string[] = [];
    for (const [key, surf] of faux) {
      for (const token of new Set(figuresOf(surf.fr))) {
        if (!LANDING_PROMISES.some((p) => p.figures?.[token]?.some((pat) => matchesKey(pat, key)))) {
          interdits.push(`${key}:${token}`);
        }
      }
    }
    expect(interdits).toEqual(['faq.a1:7']);
  });

  it('une preuve qui disparaît est détectée (motif, fichier, interdit)', () => {
    const lecteur = (t: string | null) => () => t;
    expect(proofFailure({ file: 'x', has: 'a' }, lecteur('abc'))).toBeNull();
    expect(proofFailure({ file: 'x', has: 'zzz' }, lecteur('abc'))).toMatch(/ne contient plus/);
    expect(proofFailure({ file: 'x', re: 'z+' }, lecteur('abc'))).toMatch(/introuvable/);
    expect(proofFailure({ file: 'x', lacks: 'b' }, lecteur('abc'))).toMatch(/interdit/);
    expect(proofFailure({ file: 'x', has: 'a' }, lecteur(null))).toMatch(/absent/);
  });

  it('une promesse dont l’extrait a changé est détectée', () => {
    const text = surfaces.get('enterprise.pricing.i5')!.fr;
    expect(text.includes('Sans engagement, résiliable à tout moment')).toBe(true);
    expect(text.replace('résiliable à tout moment', 'résiliable sous préavis').includes('résiliable à tout moment')).toBe(false);
  });

  it('le lecteur du prérendu échoue au lieu de se taire si la structure change', () => {
    expect(() => prerenderPages("const ROUTES = [\n    path: '/x',\n    content: `a`,\n    path: '/blog',")).toThrow(/2 \(fr, en\)|au lieu de 2/);
  });
});
