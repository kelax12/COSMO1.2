// Garde statique : AUCUN module du SHELL n'importe `sonner` directement.
//
// POURQUOI CE FICHIER EXISTE
// Sonner pesait 10,1 ko gzip dans le chunk d'ENTRÉE, donc dans le chemin
// critique, donc payés par tout visiteur qui arrive sur la landing et repart.
// Il y entrait par le `<Toaster>` d'`App.tsx` et par une poignée de modules du
// shell qui appellent `toast.*` dans des callbacks de mutation.
//
// 🔴 CE QUI REND CETTE GARDE NON ÉVIDENTE, et qui a coûté trois mesures :
// retirer les imports du seul shell NE SUFFIT PAS. Tant qu'une page lazy garde
// `import { toast } from 'sonner'`, Rollup place le module dans l'ANCÊTRE
// COMMUN des chunks qui le partagent, c'est-à-dire l'entrée. Mesuré :
//
//     57 pages importent sonner, shell nettoyé   → entrée 77,0 ko
//     idem + `manualChunks` vers `vendor-toast`  → entrée 66,9 ko, MAIS Vite
//       émet `<link rel="modulepreload">` dans index.html : chemin critique
//       316,4 → 316,2 ko, soit 162 octets. Sortir un module de l'entrée sans
//       le sortir du chemin critique ne gagne rien.
//     zéro import statique, `import()` unique    → entrée 66,9 ko ET chemin
//       critique 306,3 ko. −10,1 ko pour TOUT LE MONDE.
//
// D'où la règle que ce fichier tient : `sonner` ne s'importe que dans
// `src/lib/toast.ts`, et uniquement en `import()` dynamique. Partout ailleurs,
// `import { toast } from '@/lib/toast'`.
//
// ⚠️ La garde balaie tout `src/`, pas seulement le graphe du shell : un import
// dans une page lazy suffit à faire remonter le module dans l'entrée, et c'est
// exactement l'erreur qu'on ferait en relisant « le shell est propre ».
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const SRC = path.join(process.cwd(), 'src');

/** Le SEUL fichier autorisé à connaître `sonner`, et seulement en `import()`. */
const FACADE = path.join('src', 'lib', 'toast.ts');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Un import STATIQUE de valeur depuis `sonner` (les `import type` sont erasés). */
const STATIC_SONNER = /(?:^|\n)\s*import\s+(?!type\b)[^;]*?from\s+['"]sonner['"]/;

/** Les fichiers de `src/` qui importent statiquement `sonner`. */
function offenders(): string[] {
  return sourceFiles(SRC)
    .map((f) => path.relative(process.cwd(), f))
    .filter((rel) => rel !== FACADE)
    .filter((rel) => STATIC_SONNER.test(readFileSync(rel, 'utf8')));
}

describe('sonner reste hors du chemin critique', () => {
  it("aucun fichier de src/ n'importe `sonner` statiquement", () => {
    expect(offenders()).toEqual([]);
  });

  it('la façade charge sonner par `import()`, jamais statiquement', () => {
    const facade = readFileSync(FACADE, 'utf8');
    expect(facade).toContain("import('sonner')");
    expect(STATIC_SONNER.test(facade)).toBe(false);
  });

  it("`App.tsx` ne monte pas `<Toaster>` par un import statique de sonner", () => {
    const app = readFileSync(path.join('src', 'App.tsx'), 'utf8');
    expect(STATIC_SONNER.test(app)).toBe(false);
    // Le `<Toaster>` passe par `loadSonner()`, le MÊME import dynamique que la
    // façade : un second `import('sonner')` ailleurs ferait deux chunks et deux
    // stores de toasts.
    expect(app).toContain('loadSonner');
  });

  // TÉMOIN — sans lui, un détecteur qui ne détecte plus rien passerait vert,
  // et c'est le défaut que ce dépôt a attrapé quatre fois en cinq jours.
  it('le détecteur reconnaît bien un import fautif', () => {
    expect(STATIC_SONNER.test("import { toast } from 'sonner';")).toBe(true);
    expect(STATIC_SONNER.test("import { Toaster } from 'sonner';")).toBe(true);
    expect(STATIC_SONNER.test('const x = 1;\nimport { toast } from "sonner";')).toBe(true);
    // Et il ne se déclenche NI sur la forme autorisée, NI sur un `import type`.
    expect(STATIC_SONNER.test("await import('sonner')")).toBe(false);
    expect(STATIC_SONNER.test("import type { ExternalToast } from 'sonner';")).toBe(false);
  });
});
