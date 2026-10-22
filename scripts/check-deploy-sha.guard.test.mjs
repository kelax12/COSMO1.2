// ═══════════════════════════════════════════════════════════════════
// check-deploy-sha.guard.test.mjs — le TEMOIN de la garde de déploiement (T-8)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `check-deploy-sha.mjs` répond « la production sert le bon commit » sur un
// déploiement sain. Une garde qui se trompe dans le sens rassurant est pire
// qu'une garde absente : elle donne une réponse, et on la croit. Quatre gardes
// de ce dépôt l'ont déjà fait en cinq jours.
//
// Deux niveaux ici, et les deux comptent :
//
//   1. `verdict()` est une fonction PURE, donc chaque situation est jouable
//      sans réseau ni git. C'est pour ça qu'elle a été sortie de l'entrypoint,
//      exactement comme l'arithmétique du remboursement (`refund-replay.ts`).
//   2. Le CLI est exécuté TEL QUEL, dans un dépôt git jetable, contre un
//      serveur HTTP local. Sans ce niveau, on ne testerait que la moitié
//      pure et jamais le câblage, qui est là où `check:edge` s'est trompé
//      pendant quatorze runs.
//
// Le premier cas de chaque groupe est le plus important : sans lui, une garde
// qui ne détecterait PLUS RIEN passerait tous les autres.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'

import { verdict, TOLERANCE_RETARD_MIN } from './check-deploy-sha.mjs'

const SCRIPT = resolve(process.cwd(), 'scripts/check-deploy-sha.mjs')

// 🔴 `execFile` ASYNCHRONE, jamais `spawnSync`, et ce n'est pas un detail de
// style : le serveur HTTP de ces cas vit dans CE process. `spawnSync` bloque
// l'event loop, donc le serveur ne peut PAS repondre au CLI enfant, qui
// attend indefiniment. Le premier jet de ce temoin s'est fige exactement
// ainsi. Un test qui interroge un serveur qu'il heberge lui-meme doit rendre
// la main.
const execFileAsync = promisify(execFile)

// ─── 1 · la fonction pure ────────────────────────────────────────────

describe('verdict · les trois situations qu un `!=` confondrait', () => {
  const base = { servi: 'aaaaaaa', head: 'bbbbbbb', relation: 'inconnu', ageHeadMin: 1 }

  it('VERT quand le commit servi EST celui du depot', () => {
    const v = verdict({ ...base, servi: 'abc1234', head: 'abc1234', relation: 'egal' })
    expect(v.ok).toBe(true)
    expect(v.code).toBe('a_jour')
  })

  it('VERT sur un ancetre RECENT : un deploiement en vol n est pas une derive', () => {
    const v = verdict({ ...base, relation: 'ancetre', ageHeadMin: 3 })
    expect(v.ok).toBe(true)
    expect(v.code).toBe('deploiement_en_vol')
  })

  it('ROUGE sur un ancetre trop VIEUX : le deploiement est bloque', () => {
    const v = verdict({ ...base, relation: 'ancetre', ageHeadMin: TOLERANCE_RETARD_MIN + 1 })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('retard')
    expect(v.message).toMatch(/BLOQUE|echoue/)
  })

  it('la tolerance est une BORNE INCLUSIVE, et la limite se joue des deux cotes', () => {
    // Une borne `>` ecrite `>=` (ou l'inverse) est un defaut deja rencontre
    // dans ce depot. On fixe le comportement plutot que de le supposer.
    expect(verdict({ ...base, relation: 'ancetre', ageHeadMin: TOLERANCE_RETARD_MIN }).ok).toBe(true)
    expect(verdict({ ...base, relation: 'ancetre', ageHeadMin: TOLERANCE_RETARD_MIN + 0.1 }).ok).toBe(false)
  })

  it('ROUGE quand la prod est EN AVANCE sur le depot, et ce n est pas un retard', () => {
    // Contre-intuitif : une production descendante veut dire qu on a deploye
    // du code qui n a jamais ete relu sur la branche par defaut. Un `!=` le
    // rangerait avec le retard, qui est benin.
    const v = verdict({ ...base, relation: 'descendant' })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('prod_en_avance')
    expect(v.message).toMatch(/plus grave qu'un retard/)
  })

  it('ROUGE quand le commit servi est INCONNU du depot', () => {
    const v = verdict({ ...base, relation: 'inconnu' })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('derive')
  })

  it('ROUGE quand le marqueur est illisible : une mesure absente n est pas un succes', () => {
    const v = verdict({ ...base, servi: null })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('illisible')
  })

  it('ROUGE sur un build `dev`, construit sans le SHA de Vercel', () => {
    const v = verdict({ ...base, servi: 'dev' })
    expect(v.ok).toBe(false)
    expect(v.code).toBe('build_local')
  })

  it('un ancetre RECENT et un ancetre VIEUX ne rendent pas le meme code', () => {
    // Temoin du temoin : si `ageHeadMin` cessait d etre lu, les deux cas
    // ci-dessus rendraient le meme verdict et personne ne le verrait.
    const jeune = verdict({ ...base, relation: 'ancetre', ageHeadMin: 1 })
    const vieux = verdict({ ...base, relation: 'ancetre', ageHeadMin: 999 })
    expect(jeune.code).not.toBe(vieux.code)
  })
})

// ─── 2 · le CLI, execute tel quel ────────────────────────────────────

describe('CLI · contre un depot git et un serveur HTTP jetables', () => {
  let dir
  let serveur
  let url
  let corps

  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'deploy-sha-'))
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'temoin@example.invalid')
    git('config', 'user.name', 'temoin')
    writeFileSync(join(dir, 'a.txt'), 'un')
    git('add', '.')
    git('commit', '-q', '-m', 'premier')
    writeFileSync(join(dir, 'a.txt'), 'deux')
    git('add', '.')
    git('commit', '-q', '-m', 'second')

    corps = '{"release":"inconnu"}'
    serveur = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(corps)
    })
    await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
    url = `http://127.0.0.1:${serveur.address().port}/version.json`
  })

  afterEach(async () => {
    await new Promise((r) => serveur.close(r))
    rmSync(dir, { recursive: true, force: true })
  })

  /** Rend toujours {status, stdout, stderr}, y compris quand le CLI sort en 1. */
  const run = async () => {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [SCRIPT], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, DEPLOY_VERSION_URL: url },
      })
      return { status: 0, stdout, stderr }
    } catch (err) {
      return { status: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' }
    }
  }

  it('VERT quand le serveur annonce le commit HEAD (sans ce cas, le reste ne vaut rien)', async () => {
    corps = JSON.stringify({ release: git('rev-parse', '--short=7', 'HEAD') })
    const r = await run()
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/relation\s+: egal/)
  })

  it('VERT sur le commit PRECEDENT, qui vient d etre fait : deploiement en vol', async () => {
    corps = JSON.stringify({ release: git('rev-parse', '--short=7', 'HEAD~1') })
    const r = await run()
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/relation\s+: ancetre/)
  })

  it('ROUGE sur un SHA que le depot ne connait pas', async () => {
    corps = JSON.stringify({ release: '0123456' })
    const r = await run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/derive/)
    expect(r.stderr).toMatch(/C-35/)
  })

  it('ROUGE sur un commit qui DESCEND de HEAD (prod en avance)', async () => {
    const avant = git('rev-parse', '--short=7', 'HEAD')
    writeFileSync(join(dir, 'a.txt'), 'trois')
    git('add', '.')
    git('commit', '-q', '-m', 'troisieme')
    corps = JSON.stringify({ release: git('rev-parse', '--short=7', 'HEAD') })
    git('reset', '-q', '--hard', avant) // le depot revient en arriere, la prod non
    const r = await run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/prod_en_avance/)
  })

  it('ROUGE quand le marqueur est un JSON sans champ `release`', async () => {
    corps = '{"autre":"chose"}'
    const r = await run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/illisible/)
  })

  it('ROUGE quand le marqueur n est meme pas du JSON', async () => {
    corps = '<!doctype html><title>404</title>'
    const r = await run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/illisible/)
  })

  it('ROUGE quand le marqueur est INJOIGNABLE, jamais un vert prudent', async () => {
    await new Promise((r) => serveur.close(r))
    const r = await run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/injoignable/)
    // La regle posee apres les 14 echecs muets de `Edge deploy drift` : une
    // garde qui ne peut pas mesurer ECHOUE.
    expect(r.stderr).toMatch(/ECHOUE/)
    serveur = createServer((_q, s) => s.end(corps)) // afterEach doit pouvoir fermer
    await new Promise((r) => serveur.listen(0, '127.0.0.1', r))
  })

  it('ROUGE sur un build `dev` (construit sans VERCEL_GIT_COMMIT_SHA)', async () => {
    corps = '{"release":"dev"}'
    const r = await run()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/build_local/)
  })
})
