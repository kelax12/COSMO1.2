// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// GARDE — un depot de demo survit a un navigateur qui refuse le stockage
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-46).
//
// La regle B14 disait « proteger le `JSON.parse` ». Elle l etait partout. Mais
// le `getItem` qui le PRECEDE ne l etait pas, et c est LUI qui leve en
// navigation privee stricte, en webview, et quand les donnees de site sont
// bloquees. Exemple exact, `org-teams/local.repository.ts` : le `getItem`
// etait AVANT le `try`, donc tout le mode entreprise en demo tombait avant
// d atteindre la garde censee le sauver.
//
// Soixante appels nus vivaient dans quatorze depots.
//
// ── L ECRITURE N EST PAS DU CABLAGE ─────────────────────────────────
//
// Cabler `safeSetItem` partout aurait AVALE l echec. Pour un seed c est le bon
// comportement ; pour une donnee que la personne vient de creer, c est une
// perte SANS SIGNAL — l ecran affiche la ligne (React Query l a en cache), le
// rechargement ne la retrouve pas, et rien n a jamais dit qu elle n etait pas
// enregistree. Les ecritures sont donc classees : seed silencieux,
// persistance qui LEVE. Ce fichier verifie les deux.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';
import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { ApiError } from '@/lib/normalizeApiError';

const realGetItem = Storage.prototype.getItem;
const realSetItem = Storage.prototype.setItem;

afterEach(() => {
  Storage.prototype.getItem = realGetItem;
  Storage.prototype.setItem = realSetItem;
  vi.restoreAllMocks();
});

beforeEach(() => localStorage.clear());

describe('lecture — un stockage qui JETTE ne fait pas tomber le mode demo', () => {
  it('TEMOIN : la sonde fait bien lever `getItem`', () => {
    Storage.prototype.getItem = () => { throw new DOMException('refuse', 'SecurityError'); };
    expect(() => localStorage.getItem('x')).toThrow();
  });

  it('org-teams se re-seme au lieu de tomber', async () => {
    Storage.prototype.getItem = () => { throw new DOMException('refuse', 'SecurityError'); };
    const repo = new LocalStorageOrgTeamsRepository();
    // Avant le correctif : `getItem` levait AVANT le `try` de `readOrSeed`,
    // et l exception traversait tout le mode entreprise en demo.
    const teams = await repo.getTeams('org-demo');
    expect(Array.isArray(teams)).toBe(true);
  });

  it('tasks se re-seme au lieu de tomber', async () => {
    Storage.prototype.getItem = () => { throw new DOMException('refuse', 'SecurityError'); };
    const repo = new LocalStorageTasksRepository();
    const tasks = await repo.getAll();
    expect(Array.isArray(tasks)).toBe(true);
  });
});

describe('ecriture — une donnee de l utilisateur ne se perd pas en silence', () => {
  it('TEMOIN : la sonde fait bien lever `setItem` sur un quota', () => {
    Storage.prototype.setItem = () => { throw new DOMException('plein', 'QuotaExceededError'); };
    expect(() => localStorage.setItem('x', 'y')).toThrow();
  });

  it('une creation en demo LEVE une ApiError catalogue quand le quota est plein', async () => {
    const repo = new LocalStorageTasksRepository();
    await repo.getAll(); // seme d abord, stockage sain
    Storage.prototype.setItem = () => { throw new DOMException('plein', 'QuotaExceededError'); };

    const err = await repo.create({ name: 'Ma tache', completed: false } as never).catch((e) => e);
    // Le message vient du CATALOGUE, jamais du moteur JS : c est lui qui sera
    // interpole dans le toast `mutation.*` de l appelant.
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('storage_full');
    expect(err.message).not.toContain('QuotaExceededError');
  });

  it('un stockage indisponible se distingue d un quota plein', async () => {
    const repo = new LocalStorageTasksRepository();
    await repo.getAll();
    Storage.prototype.setItem = () => { throw new DOMException('refuse', 'SecurityError'); };

    const err = await repo.create({ name: 'Ma tache', completed: false } as never).catch((e) => e);
    expect((err as ApiError).code).toBe('storage_unavailable');
  });
});

describe('aucun appel nu ne revient dans les depots', () => {
  it('plus un seul `localStorage.` direct dans src/modules/**/*repository.ts', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(process.cwd(), 'src/modules');

    const offenders: string[] = [];
    for (const mod of readdirSync(root)) {
      const dir = join(root, mod);
      if (!statSync(dir).isDirectory()) continue;
      for (const file of readdirSync(dir)) {
        if (!/repository[.]ts$/.test(file)) continue;
        const source = readFileSync(join(dir, file), 'utf-8');
        // Les commentaires citent le nom de l API : on ne lit que le code.
        const code = source
          .split(String.fromCharCode(10))
          .map((line) => {
            const at = line.indexOf('//');
            return at === -1 ? line : line.slice(0, at);
          })
          .join(String.fromCharCode(10))
          .replace(/[/][*][^]*?[*][/]/g, ' ');
        if (/localStorage[.](getItem|setItem|removeItem)/.test(code)) {
          offenders.push(`${mod}/${file}`);
        }
      }
    }

    expect(
      offenders,
      [
        'Passer par `@/lib/safe-json` : `safeGetItem` en lecture ;',
        'en ecriture, `safeSetItem` pour un SEED (perte sans consequence) et',
        '`writeJsonOrThrow` pour une donnee de l utilisateur (perte a signaler).',
      ].join(String.fromCharCode(10)),
    ).toEqual([]);
  });
});
