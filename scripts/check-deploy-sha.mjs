// ═══════════════════════════════════════════════════════════════════
// check-deploy-sha.mjs — le commit SERVI en production contre le dépôt (T-8)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// C'est le défaut `C-35` des Edge Functions, CÔTÉ FRONT, et il est resté sans
// nom jusqu'au 2026-09-16. `npm run check:edge` compare le code DÉPLOYÉ des
// Edge Functions au dépôt ; il n'existait AUCUN équivalent pour l'application
// elle-même, celle que tous les visiteurs exécutent.
//
// Ce que le dépôt savait dire avant ce script :
//   - `uptime.yml`  : « thecosmo.app répond HTTP 200 ». Une coquille SPA vide
//                     répond 200. Un build vieux de trois semaines aussi.
//   - `check:edge`  : les Edge Functions, jamais le front.
//   - la CI         : que `main` COMPILE, jamais qu'il soit SERVI.
//
// Entre les trois, personne ne pouvait dire QUEL COMMIT tourne en production.
// Un déploiement Vercel qui échoue en silence, une promotion oubliée, un
// rollback laissé en place : tout cela laissait la CI verte et le site debout.
//
// ── CE QU'IL MESURE, ET IL NE DEVINE RIEN ──────────────────────────
//
// `dist/version.json` est écrit AU BUILD par le plugin `cosmo-emit-version`
// (`vite.config.ts`) avec `VERCEL_GIT_COMMIT_SHA`, donc par Vercel lui-même,
// et il porte le MÊME identifiant que la release Sentry. Il est servi en
// `max-age=0, must-revalidate` (`vercel.json`), donc jamais depuis un cache.
//
// On lit ce fichier SUR LA PRODUCTION. C'est une mesure de ce qui est
// réellement servi, pas une déclaration d'API : c'est exactement la leçon de
// `C-35`, où le dépôt et le ledger décrivaient ce qu'on avait voulu écrire.
//
// ✅ AUCUN SECRET N'EST REQUIS. `/version.json` est public. La garde ne peut
// donc pas « sauter silencieusement faute de secret », qui est le défaut qui a
// fait échouer `Edge deploy drift` quatorze fois sans jamais rien comparer.
//
// ── TROIS SITUATIONS, ET UN `!=` LES CONFONDRAIT TOUTES ────────────
//
// Une garde qui compare bêtement deux chaînes serait ROUGE à chaque push, le
// temps que Vercel construise. Elle crierait au loup, on la désarmerait, et on
// aurait dépensé un job pour rien. Les trois cas se distinguent :
//
//   À JOUR    servi == HEAD                      → vert
//   RETARD    servi est un ANCÊTRE de HEAD       → vert si HEAD est récent
//                                                  (déploiement en vol),
//                                                  ROUGE au-delà de la
//                                                  tolérance : le déploiement
//                                                  est bloqué et personne ne
//                                                  le voit
//   DÉRIVE    servi est INCONNU du dépôt         → ROUGE, toujours. Ce qui
//             ou DESCEND de HEAD                   tourne ne vient pas de
//                                                  `main`
//
// 🔴 Le cas « DESCENDANT » n'est pas théorique et il est contre-intuitif : une
// production EN AVANCE sur `main` veut dire qu'on a déployé quelque chose qui
// n'a jamais été relu sur la branche par défaut. C'est plus grave qu'un retard,
// et un `!=` le rangerait avec lui.
//
// ❌ Ne JAMAIS relâcher `TOLERANCE_RETARD_MIN` pour faire passer la CI. Un
// retard qui dure veut dire qu'un déploiement est cassé, pas que la borne est
// trop basse.
// ═══════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process'

/** URL du marqueur de version servi en production. */
export const DEFAULT_VERSION_URL = 'https://thecosmo.app/version.json'

/**
 * Au-delà de ce retard, un déploiement n'est plus « en vol », il est bloqué.
 *
 * Un build Vercel de ce dépôt prend ~2 min (Vite + prerender). 20 minutes
 * laissent la place à une file d'attente ou à un build lent sans jamais
 * masquer un déploiement qui ne partira pas.
 */
export const TOLERANCE_RETARD_MIN = 20

/**
 * Le verdict, en fonction PURE.
 *
 * Elle ne fait aucune IO, donc elle est exécutable par un test, ce qui est la
 * raison d'être de la séparation : l'arithmétique du remboursement a dû être
 * sortie de son entrypoint Deno pour la même raison, après avoir passé des
 * semaines sans être couverte par un seul cas.
 *
 * @param {{servi: string|null, head: string, relation: 'egal'|'ancetre'|'descendant'|'inconnu', ageHeadMin: number}} e
 * @returns {{ok: boolean, code: string, message: string}}
 */
export function verdict(e) {
  const { servi, head, relation, ageHeadMin } = e

  if (!servi) {
    return {
      ok: false,
      code: 'illisible',
      message:
        'aucun identifiant de build lisible en production. `/version.json` est absent, vide ou ' +
        'malforme : le front deploye est alors INVERIFIABLE, ce qui est le defaut que cette garde existe pour fermer.',
    }
  }

  if (servi === 'dev') {
    return {
      ok: false,
      code: 'build_local',
      message:
        "la production sert un build marque `dev`, c'est-a-dire construit SANS `VERCEL_GIT_COMMIT_SHA`. " +
        "Le commit servi est alors inconnaissable, et la release Sentry l'est aussi.",
    }
  }

  if (relation === 'egal') {
    return { ok: true, code: 'a_jour', message: `la production sert ${servi}, qui est le commit du depot.` }
  }

  if (relation === 'ancetre') {
    if (ageHeadMin <= TOLERANCE_RETARD_MIN) {
      return {
        ok: true,
        code: 'deploiement_en_vol',
        message:
          `la production sert ${servi}, un ancetre de ${head}, qui n'a que ${Math.round(ageHeadMin)} min. ` +
          'Un deploiement est vraisemblablement en cours.',
      }
    }
    return {
      ok: false,
      code: 'retard',
      message:
        `la production sert ${servi} alors que le depot est a ${head}, pousse il y a ` +
        `${Math.round(ageHeadMin)} min (tolerance ${TOLERANCE_RETARD_MIN} min). Le deploiement est BLOQUE ou a echoue : ` +
        'la CI est verte, le site repond, et personne ne voit que le correctif n\'est pas en ligne.',
    }
  }

  if (relation === 'descendant') {
    return {
      ok: false,
      code: 'prod_en_avance',
      message:
        `la production sert ${servi}, qui DESCEND de ${head} : du code a ete deploye sans passer par la branche ` +
        "par defaut, donc sans y avoir ete relu. C'est plus grave qu'un retard, jamais moins.",
    }
  }

  return {
    ok: false,
    code: 'derive',
    message:
      `la production sert ${servi}, INCONNU du depot. Ce qui tourne ne vient pas de \`main\` : rollback laisse en ` +
      "place, deploiement depuis une branche, ou arbre de travail non commite. C'est le defaut C-35, cote front.",
  }
}

// ── IO ─────────────────────────────────────────────────────────────

/** Lit l'identifiant de build servi. `null` si illisible. */
export async function lireVersionServie(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`${url} repond HTTP ${res.status}`)
  const brut = await res.text()
  try {
    const v = JSON.parse(brut).release
    return typeof v === 'string' && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

/**
 * Relation entre le commit servi et HEAD.
 *
 * ⚠️ Un clone SUPERFICIEL (`fetch-depth: 1`, le defaut d'actions/checkout) ne
 * contient pas l'ancetre : `merge-base` echouerait et la garde rendrait
 * « inconnu » sur une production parfaitement saine. Le workflow pose donc
 * `fetch-depth: 0`, et ce cas est distingue explicitement ci-dessous.
 */
export function relationAvecHead(servi, cwd = process.cwd()) {
  const head = git(['rev-parse', 'HEAD'], cwd)
  const court = head.slice(0, servi.length)
  if (court === servi) return { relation: 'egal', head: head.slice(0, 7) }

  let plein
  try {
    plein = git(['rev-parse', '--verify', `${servi}^{commit}`], cwd)
  } catch {
    return { relation: 'inconnu', head: head.slice(0, 7) }
  }

  const estAncetre = (a, b) => {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd })
      return true
    } catch {
      return false
    }
  }

  if (estAncetre(plein, head)) return { relation: 'ancetre', head: head.slice(0, 7) }
  if (estAncetre(head, plein)) return { relation: 'descendant', head: head.slice(0, 7) }
  return { relation: 'inconnu', head: head.slice(0, 7) }
}

/** Age du commit HEAD, en minutes. */
export function ageHeadMinutes(cwd = process.cwd()) {
  const ts = Number(git(['log', '-1', '--format=%ct'], cwd))
  return (Date.now() / 1000 - ts) / 60
}

// ── CLI ────────────────────────────────────────────────────────────
const lanceDirectement =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').join('/'))

if (lanceDirectement) {
  const url = process.env.DEPLOY_VERSION_URL || DEFAULT_VERSION_URL
  let servi
  try {
    servi = await lireVersionServie(url)
  } catch (err) {
    console.error(`::error::${url} est injoignable : ${err.message}`)
    console.error(
      "Une garde qui ne peut pas mesurer ECHOUE, elle ne rend jamais un vert prudent : c'est la regle " +
        'posee apres les quatorze echecs muets de `Edge deploy drift`.',
    )
    process.exit(1)
  }

  const { relation, head } =
    servi && servi !== 'dev' ? relationAvecHead(servi) : { relation: 'inconnu', head: 'n/a' }
  const v = verdict({ servi, head, relation, ageHeadMin: ageHeadMinutes() })

  console.log(`marqueur   : ${url}`)
  console.log(`servi      : ${servi ?? '(illisible)'}`)
  console.log(`depot HEAD : ${head}`)
  console.log(`relation   : ${relation}`)
  console.log('')

  if (!v.ok) {
    console.error(`::error::[${v.code}] ${v.message}`)
    process.exit(1)
  }
  console.log(`✅ ${v.message}`)
}
