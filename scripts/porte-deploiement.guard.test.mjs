// ═══════════════════════════════════════════════════════════════════
// porte-deploiement.guard.test.mjs · TEMOIN de la porte de deploiement
// (CI-02, vague 3.2, 2026-11-07).
//
// La porte tient en trois pieces, et une seule qui lache rouvre CI-02 sans
// qu'aucun build ne rougisse :
//   1. `vercel.json` → `ignoreCommand` lance le script ET traduit son code ;
//   2. `scripts/vercel-ignore-build.mjs` attend `ci-vert/<sha>` ;
//   3. `.github/workflows/ci-vert.yml` pose ce tag apres un noyau vert.
// Ce fichier tient les trois, et la commande de `vercel.json` est jouee
// TELLE QUELLE sous `sh`, y compris avec un Node qui plante : c'est le cas
// ou une porte naive (`node script.mjs` seul) construirait.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import {
  decider,
  estProduction,
  refsPresentes,
  CODE_CONSTRUIRE,
  CODE_IGNORER,
  DEPOT_URL,
  PREFIXE_VERT,
  PREFIXE_ROUGE,
  INTERVALLE_MS,
  PLAFOND_MS,
} from './vercel-ignore-build.mjs'

const RACINE = process.cwd()
const lire = (f) => readFileSync(join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')

const SHA = 'a'.repeat(40)
const PROD = { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: SHA }
const ligne = (ref) => `${SHA}\t${ref}\n`

/** Horloge factice : `attendre` avance le temps, rien ne dort vraiment. */
function harnais(reponses) {
  let t = 0
  const appels = []
  const journal = []
  let i = 0
  return {
    appels,
    journal,
    o: {
      lsRemote: async (url, refs) => {
        appels.push({ url, refs })
        const r = reponses[Math.min(i++, reponses.length - 1)]
        if (r instanceof Error) throw r
        return r
      },
      attendre: async (ms) => {
        t += ms
      },
      maintenant: () => t,
      journal: (l) => journal.push(l),
    },
    temps: () => t,
  }
}

// ─── 1 · la decision ────────────────────────────────────────────────

describe('porte · decider()', () => {
  it('CONSTRUIT quand le tag ci-vert est present (sans ce cas, le reste ne vaut rien)', async () => {
    const h = harnais([ligne(PREFIXE_VERT + SHA)])
    const r = await decider({ env: PROD, ...h.o })
    expect(r).toEqual({ code: CODE_CONSTRUIRE, raison: 'vert' })
    expect(h.appels[0].url).toBe(DEPOT_URL)
    expect(h.appels[0].refs).toEqual([PREFIXE_VERT + SHA, PREFIXE_ROUGE + SHA])
  })

  it('ATTEND puis construit quand le tag arrive apres plusieurs sondages', async () => {
    const h = harnais(['', '', '', ligne(PREFIXE_VERT + SHA)])
    const r = await decider({ env: PROD, ...h.o })
    expect(r.code).toBe(CODE_CONSTRUIRE)
    expect(h.appels).toHaveLength(4)
    expect(h.temps()).toBe(3 * INTERVALLE_MS)
    expect(h.journal.join('\n')).toMatch(/tentative 4/)
  })

  it('IGNORE au plafond quand le tag n arrive jamais : un delai n est pas un vert', async () => {
    const h = harnais([''])
    const r = await decider({ env: PROD, ...h.o })
    expect(r).toEqual({ code: CODE_IGNORER, raison: 'delai' })
    expect(h.temps()).toBeLessThanOrEqual(PLAFOND_MS)
    // 15 min a 20 s : un sondage a t = 0 puis un toutes les 20 s jusqu'a
    // 15 min pile, soit 46. Pas un de moins (sinon le plafond ment).
    expect(h.appels).toHaveLength(Math.floor(PLAFOND_MS / INTERVALLE_MS) + 1)
    expect(h.journal.at(-1)).toMatch(/delai de 15 min depasse/)
  })

  it('IGNORE quand GitHub reste injoignable, et le dit', async () => {
    const h = harnais([new Error('Could not resolve host: github.com')])
    const r = await decider({ env: PROD, ...h.o })
    expect(r).toEqual({ code: CODE_IGNORER, raison: 'reseau' })
    expect(h.journal.at(-1)).toMatch(/injoignable.*Could not resolve host/)
  })

  it('une panne passagere ne ferme pas la porte si le tag arrive ensuite', async () => {
    const h = harnais([new Error('timeout'), new Error('timeout'), ligne(PREFIXE_VERT + SHA)])
    const r = await decider({ env: PROD, ...h.o })
    expect(r.code).toBe(CODE_CONSTRUIRE)
  })

  it('IGNORE tout de suite sur ci-rouge, sans sonder jusqu au plafond', async () => {
    const h = harnais([ligne(PREFIXE_ROUGE + SHA)])
    const r = await decider({ env: PROD, ...h.o })
    expect(r).toEqual({ code: CODE_IGNORER, raison: 'rouge' })
    expect(h.appels).toHaveLength(1)
  })

  it('ci-vert l emporte sur un ci-rouge reste (vert apres Re-run)', async () => {
    const h = harnais([ligne(PREFIXE_ROUGE + SHA) + ligne(PREFIXE_VERT + SHA)])
    expect((await decider({ env: PROD, ...h.o })).code).toBe(CODE_CONSTRUIRE)
  })

  it('un tag d un AUTRE commit ne vaut rien', async () => {
    const autre = 'b'.repeat(40)
    const h = harnais([`${autre}\t${PREFIXE_VERT}${autre}\n`])
    expect((await decider({ env: PROD, ...h.o, plafondMs: INTERVALLE_MS })).code).toBe(CODE_IGNORER)
  })

  it('build d APERCU : construit sans attendre ni appeler GitHub', async () => {
    const h = harnais([''])
    const r = await decider({
      env: { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'noyau/x', VERCEL_GIT_COMMIT_SHA: SHA },
      ...h.o,
    })
    expect(r).toEqual({ code: CODE_CONSTRUIRE, raison: 'apercu' })
    expect(h.appels).toHaveLength(0)
  })

  it('la branche `main` suffit a fermer la porte, meme sans VERCEL_ENV', async () => {
    const h = harnais([''])
    const r = await decider({ env: { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: SHA }, ...h.o, plafondMs: INTERVALLE_MS })
    expect(r.code).toBe(CODE_IGNORER)
    expect(estProduction({ VERCEL_ENV: 'production' })).toBe(true)
    expect(estProduction({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'noyau/x' })).toBe(false)
  })

  it('IGNORE un build de production sans SHA lisible', async () => {
    for (const sha of [undefined, '', 'HEAD', 'abc1234', `${SHA};rm -rf /`]) {
      const h = harnais([ligne(PREFIXE_VERT + SHA)])
      const r = await decider({ env: { ...PROD, VERCEL_GIT_COMMIT_SHA: sha }, ...h.o })
      expect(r, String(sha)).toEqual({ code: CODE_IGNORER, raison: 'sha_illisible' })
      expect(h.appels).toHaveLength(0)
    }
  })

  it('refsPresentes lit la sortie de ls-remote, lignes vides comprises', () => {
    const s = refsPresentes(`${SHA}\trefs/tags/x\n\n${SHA}\trefs/tags/y\n`)
    expect([...s]).toEqual(['refs/tags/x', 'refs/tags/y'])
    expect(refsPresentes('').size).toBe(0)
  })
})

// ─── 2 · la commande de vercel.json, jouee telle quelle ─────────────

const vercel = JSON.parse(lire('vercel.json'))
const shDispo = spawnSync('sh', ['-c', 'exit 0']).status === 0
// En CI (Linux), `sh` existe toujours : le cas ne peut pas y etre saute.
const sauter = !shDispo && !process.env.CI

describe('porte · vercel.json', () => {
  it('porte l ignoreCommand qui lance la porte et traduit son code', () => {
    expect(vercel.ignoreCommand).toBe(`node scripts/vercel-ignore-build.mjs; test $? -ne ${CODE_CONSTRUIRE}`)
    expect(CODE_CONSTRUIRE).not.toBe(0)
    expect(CODE_CONSTRUIRE).not.toBe(1) // 1 = code d'un Node qui plante
  })

  const jouer = (commande, env) =>
    spawnSync('sh', ['-c', commande], {
      cwd: RACINE,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    })

  it.skipIf(sauter)('sous sh : un apercu sort en 1 (Vercel CONSTRUIT)', () => {
    const r = jouer(vercel.ignoreCommand, { VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'noyau/x' })
    expect(r.status, r.stdout + r.stderr).toBe(1)
    expect(r.stdout).toMatch(/build d'apercu/)
  })

  it.skipIf(sauter)('sous sh : une production sans SHA lisible sort en 0 (Vercel IGNORE)', () => {
    const r = jouer(vercel.ignoreCommand, { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'pas-un-sha' })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/SHA illisible/)
  })

  it.skipIf(sauter)('sous sh : un Node qui PLANTE sort en 0, jamais en build', () => {
    const plante = vercel.ignoreCommand.replace('node scripts/vercel-ignore-build.mjs', 'node -e "throw new Error(1)"')
    expect(plante).not.toBe(vercel.ignoreCommand)
    const r = jouer(plante, { VERCEL_ENV: 'production' })
    expect(r.status).toBe(0)
    const absent = vercel.ignoreCommand.replace('vercel-ignore-build.mjs', 'fichier-absent.mjs')
    expect(jouer(absent, { VERCEL_ENV: 'production' }).status).toBe(0)
  })
})

// ─── 3 · le workflow qui pose le tag ────────────────────────────────

describe('porte · ci-vert.yml', () => {
  const wf = lire('.github/workflows/ci-vert.yml')

  it('part apres CHAQUE CI noyau termine, sur main et noyau/**', () => {
    expect(wf).toMatch(/^name: CI vert$/m)
    expect(wf).toMatch(/^ {4}workflows: \[CI noyau\]$/m)
    expect(wf).toMatch(/^ {4}types: \[completed\]$/m)
    expect(wf).toMatch(/^ {4}branches: \[main, 'noyau\/\*\*'\]$/m)
  })

  it('pose ci-vert sur un succes, ci-rouge sur un echec de main SEULEMENT', () => {
    expect(wf).toMatch(/conclusion == 'success' \|\|/)
    expect(wf).toMatch(/conclusion == 'failure' &&\s+github\.event\.workflow_run\.head_branch == 'main'/)
    expect(wf).toMatch(/workflow_run\.event == 'push'/)
    expect(wf).toMatch(/head_repository\.full_name == github\.repository/)
  })

  it('les prefixes de tag sont ceux que la porte lit', () => {
    expect(PREFIXE_VERT).toBe('refs/tags/ci-vert/')
    expect(PREFIXE_ROUGE).toBe('refs/tags/ci-rouge/')
    expect(wf).toMatch(/SORTE=ci-vert; else SORTE=ci-rouge/)
    expect(wf).toContain('REF="refs/tags/$SORTE/$SHA"')
  })

  it('contents: write sur le seul job, read au niveau du workflow', () => {
    expect(wf).toMatch(/^permissions:\n {2}contents: read$/m)
    expect(wf.match(/^ +contents: write$/gm)).toEqual(['      contents: write'])
  })

  it('le depot de la porte est celui que GitHub Actions tague', () => {
    expect(DEPOT_URL).toBe('https://github.com/kelax12/COSMO1.2')
  })

  it('un rouge de CI vert sonne (ci-alert.yml)', () => {
    const alerte = lire('.github/workflows/ci-alert.yml')
    expect(alerte).toMatch(/^ {6}- CI vert$/m)
  })
})
