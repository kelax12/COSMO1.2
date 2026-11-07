// Témoin du générateur de faits (DOC-03) : chaque chiffre vient de la source, et le fichier
// commité doit être exactement ce que la génération produit.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { calculerFaits, rendre, CHEMIN_FAITS } from './generer-faits.mjs'

const ecrire = (racine, chemin, texte = '') => {
  const p = join(racine, ...chemin.split('/'))
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, texte)
}

function arbre() {
  const racine = mkdtempSync(join(tmpdir(), 'faits-'))
  ecrire(racine, 'supabase/functions/alpha/index.ts')
  ecrire(racine, 'supabase/functions/beta/index.ts')
  ecrire(racine, 'supabase/functions/_shared/cors.ts')
  ecrire(racine, 'supabase/functions/sans-index/note.md')
  ecrire(racine, 'supabase/migration/001_a.sql')
  ecrire(racine, 'supabase/migration/002_b.sql')
  ecrire(racine, 'supabase/migration/README.md')
  ecrire(racine, '.github/workflows/a.yml', 'on:\n  schedule:\n    - cron: "0 0 * * *"\n')
  ecrire(racine, '.github/workflows/b.yml', '# schedule: en commentaire\non:\n  push:\n')
  ecrire(racine, 'src/modules/tasks/index.ts')
  ecrire(racine, 'src/modules/CLAUDE.md')
  ecrire(racine, 'src/locales/fr/common.json', '{}')
  ecrire(racine, 'src/locales/fr/tasks.json', '{}')
  ecrire(racine, 'docs/adr/0001-x.md')
  ecrire(racine, 'docs/adr/README.md')
  ecrire(racine, 'package.json', JSON.stringify({ scripts: { 'check:a': 'x', 'i18n:b': 'x', 'validate:c': 'x', build: 'x' } }))
  ecrire(racine, 'supabase/schema.sql', [
    'CREATE TABLE public.t1 (id int);',
    'CREATE TABLE public.t2 (id int);',
    'ALTER TABLE public.t1 ENABLE ROW LEVEL SECURITY;',
    'CREATE POLICY "p" ON public.t1 USING (true);',
    'CREATE FUNCTION public.f() RETURNS void',
  ].join('\r\n'))
  return racine
}

describe('calculerFaits : chaque chiffre vient de la source', () => {
  it('compte ce que la source contient, et rien d\'autre', () => {
    const racine = arbre()
    try {
      expect(calculerFaits(racine)).toEqual({
        edgeFunctions: 2, migrations: 2, derniereMigration: '002', workflows: 2, workflowsPlanifies: 1,
        modules: 1, namespaces: 2, gardes: 3, adr: 1,
        tables: 2, tablesRls: 1, policies: 1, fonctionsSql: 1,
      })
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('TÉMOIN : ajouter une Edge Function change le fait, donc le fichier rendu', () => {
    const racine = arbre()
    try {
      const avant = rendre(calculerFaits(racine))
      ecrire(racine, 'supabase/functions/gamma/index.ts')
      const apres = rendre(calculerFaits(racine))
      expect(apres).not.toBe(avant)
      expect(apres).toContain('| Edge Functions déployables | **3** |')
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })

  it('le rendu est déterministe', () => {
    const racine = arbre()
    try {
      const f = calculerFaits(racine)
      expect(rendre(f)).toBe(rendre({ ...f }))
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })
})

describe('le dépôt', () => {
  it('TÉMOIN : docs/FAITS.md est exactement ce que la génération produit', () => {
    const attendu = rendre(calculerFaits(process.cwd()))
    const actuel = readFileSync(join(process.cwd(), ...CHEMIN_FAITS), 'utf8').replace(/\r\n/g, '\n')
    expect(actuel, 'lancer `npm run faits:generer` et commiter docs/FAITS.md').toBe(attendu)
  })

  it('le fichier généré porte le marqueur de note et la phrase que check:docs-scored exige', () => {
    const texte = rendre(calculerFaits(process.cwd()))
    expect(texte).toMatch(/<!-- note-audit: couvert-par=ARCHITECTURE\.md -->/)
    expect(texte).toMatch(/^> \*\*Note d'audit\*\* : .{20,}$/m)
  })
})
