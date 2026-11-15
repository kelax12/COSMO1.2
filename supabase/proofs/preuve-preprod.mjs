// Rejoue le schéma du dépôt puis UNE preuve sur la PRÉPRODUCTION (CI-04).
//   npm run preuve:preprod -- <num> [--avancer]
// Cible : SUPABASE_PREPROD_DB_URL, seule variable. Absente, ou pointant le projet de
// production : échec, jamais de repli. La production ne reçoit aucune preuve.
// Préprod : migrations < n appliquées dans l'ordre (suivi dans preprod_outil.ledger, car
// certaines ne se rejouent pas), puis la preuve, qui doit rendre `PREUVE-ANNULEE 0 ECHEC |`.
// `--avancer` applique ensuite la migration n à la préprod (après son application en prod).
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

export const REF_PROD = 'ykeugqfgklejcdbrmawy'
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

export function cible(env) {
  const url = env.SUPABASE_PREPROD_DB_URL
  if (!url) throw new Error('SUPABASE_PREPROD_DB_URL absent : aucune preuve ne se joue sans préprod (docs/DEPLOYMENT.md § Préproduction).')
  if (url.includes(REF_PROD)) throw new Error('SUPABASE_PREPROD_DB_URL pointe la production : refus.')
  return url
}

export function numero(f) {
  return Number(/^(\d+)/.exec(f)?.[1])
}

export function trouverPreuve(dossier, num) {
  for (const f of readdirSync(dossier)) {
    const m = /^(\d+)(?:-(\d+))?\.proof\.sql$/.exec(f)
    if (m && num >= Number(m[1]) && num <= Number(m[2] ?? m[1])) return { fichier: f, debut: Number(m[1]) }
  }
  throw new Error(`Aucune preuve pour ${num} dans supabase/proofs/.`)
}

async function main() {
  const num = Number(process.argv[2])
  if (!Number.isInteger(num)) throw new Error('Usage : npm run preuve:preprod -- <num> [--avancer]')
  const url = cible(process.env)
  const preuve = trouverPreuve(join(RACINE, 'proofs'), num)
  const { default: pg } = await import('pg')
  const c = new pg.Client({ connectionString: url })
  await c.connect()
  try {
    await c.query('create schema if not exists preprod_outil; create table if not exists preprod_outil.ledger (f text primary key)')
    const faits = new Set((await c.query('select f from preprod_outil.ledger')).rows.map((r) => r.f))
    const dossier = join(RACINE, 'migration')
    const tous = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()
    const dejaAuDela = [...faits].filter((f) => numero(f) >= preuve.debut)
    if (dejaAuDela.length) throw new Error(`Préprod déjà au-delà de ${preuve.debut} (${dejaAuDela[0]}) : la recréer (docs/DEPLOYMENT.md § Préproduction).`)
    const appliquer = async (f) => {
      process.stdout.write(`→ ${f} ... `)
      await c.query(readFileSync(join(dossier, f), 'utf8'))
      await c.query('insert into preprod_outil.ledger values ($1) on conflict do nothing', [f])
      console.log('ok')
    }
    for (const f of tous.filter((x) => numero(x) < preuve.debut && !faits.has(x))) await appliquer(f)
    let verdict = ''
    try {
      await c.query(readFileSync(join(RACINE, 'proofs', preuve.fichier), 'utf8'))
    } catch (e) {
      verdict = String(e.message)
    }
    console.log(verdict || '(la preuve ne s\'est pas annulée)')
    if (!verdict.startsWith('PREUVE-ANNULEE 0 ECHEC |')) throw new Error(`Preuve ${preuve.fichier} : verdict non vert, on n'applique pas.`)
    if (process.argv.includes('--avancer')) for (const f of tous.filter((x) => numero(x) >= preuve.debut && numero(x) <= num)) await appliquer(f)
  } finally {
    await c.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`✖ ${e.message}`)
    process.exit(1)
  })
}
