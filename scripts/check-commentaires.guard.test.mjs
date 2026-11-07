// Témoin du cliquet des commentaires (COD-01) : le compteur lit les COMMENTAIRES par le parseur,
// refuse une hausse, et sa référence ne se relève pas.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compterDans, juger, mesurer, recaler, lireReference } from './check-commentaires.mjs'

const ROUGE = '\u{1F534}'

describe('compterDans : ce qui est un commentaire', () => {
  it('compte une date ISO et un marqueur dans un commentaire de ligne, de bloc et JSX', () => {
    const src = [
      '// vu le 2026-10-15',
      '/** ligne 1',
      ` * ${ROUGE} marqueur`,
      ' * et 2026-11-01 encore',
      ' */',
      'export const a = <div>{/* depuis 2026-09-02 */}</div>',
    ].join('\n')
    expect(compterDans(src, 'x.tsx')).toEqual({ dates: 3, rouges: 1 })
  })

  it('TÉMOIN : une date dans une chaîne, un gabarit ou une URL n\'est pas un commentaire', () => {
    const src = [
      "export const a = '2026-10-15'",
      'export const b = `${x} 2026-10-15 // pas un commentaire`',
      "export const c = 'https://exemple.test/2026-10-15'",
      `export const d = '${ROUGE}'`,
    ].join('\n')
    expect(compterDans(src, 'x.ts')).toEqual({ dates: 0, rouges: 0 })
  })

  it('TÉMOIN : ajouter une date dans un commentaire fait monter le compte, la retirer le ramène', () => {
    const propre = 'const a = 1 // pourquoi : invariant\n'
    const sale = 'const a = 1 // pourquoi : invariant (2026-10-15)\n'
    expect(compterDans(propre, 'x.ts').dates).toBe(0)
    expect(compterDans(sale, 'x.ts').dates).toBe(1)
    expect(compterDans(sale.replace(' (2026-10-15)', ''), 'x.ts').dates).toBe(0)
  })

  it('ne confond pas un numéro qui ressemble à une date avec une date', () => {
    expect(compterDans('// run 12345-67-89 et 2026-13-45\n', 'x.ts').dates).toBe(0)
  })
})

describe('juger et recaler : le cliquet', () => {
  const ref = { dates: 10, rouges: 5 }

  it('rouge si un compteur dépasse la référence', () => {
    expect(juger({ dates: 11, rouges: 5 }, ref).erreurs).toHaveLength(1)
    expect(juger({ dates: 10, rouges: 6 }, ref).erreurs).toHaveLength(1)
  })

  it('vert à égalité, et signale une baisse sans échouer', () => {
    expect(juger({ dates: 10, rouges: 5 }, ref)).toEqual({ erreurs: [], baisses: [] })
    const j = juger({ dates: 7, rouges: 5 }, ref)
    expect(j.erreurs).toHaveLength(0)
    expect(j.baisses).toHaveLength(1)
  })

  it('TÉMOIN : la référence ne se relève pas, elle ne fait que baisser', () => {
    expect(recaler({ dates: 12, rouges: 5 }, ref).refus).toEqual(['dates'])
    expect(recaler({ dates: 8, rouges: 3 }, ref)).toEqual({ refus: [], nouveau: { dates: 8, rouges: 3 } })
    expect(recaler({ dates: 10, rouges: 5 }, ref).nouveau).toEqual(ref)
  })
})

describe('mesurer : le périmètre', () => {
  it('compte la production, met les tests à part, ignore les .d.ts', () => {
    const racine = mkdtempSync(join(tmpdir(), 'commentaires-'))
    try {
      mkdirSync(join(racine, 'src', 'lib'), { recursive: true })
      writeFileSync(join(racine, 'src', 'lib', 'a.ts'), '// vu le 2026-10-15\nexport const a = 1\n')
      writeFileSync(join(racine, 'src', 'lib', 'a.test.ts'), '// témoin du 2026-10-16\nexport const t = 1\n')
      writeFileSync(join(racine, 'src', 'lib', 'types.d.ts'), '// 2026-10-17\nexport type T = 1\n')
      const m = mesurer(racine)
      expect(m.prod).toEqual({ dates: 1, rouges: 0 })
      expect(m.tests).toEqual({ dates: 1, rouges: 0 })
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  })
})

describe('le dépôt', () => {
  it('la référence commitée est un couple d\'entiers positifs', () => {
    const r = lireReference()
    expect(Number.isInteger(r.dates) && r.dates >= 0).toBe(true)
    expect(Number.isInteger(r.rouges) && r.rouges >= 0).toBe(true)
    expect(readFileSync(join(process.cwd(), 'scripts', 'commentaires.reference.json'), 'utf8')).toContain('dates')
  })
})
