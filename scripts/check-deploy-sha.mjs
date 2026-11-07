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
//
// ── LA RÉFÉRENCE EST LE DERNIER COMMIT VERT, PLUS LA TÊTE DE `main` ─
//
// Depuis la porte de déploiement (CI-02, 2026-11-07), Vercel ne construit en
// production qu'un SHA portant le tag `ci-vert/<sha>` (`ci-vert.yml`,
// `scripts/vercel-ignore-build.mjs`). Un `main` rouge reste donc légitimement
// hors production : comparée à HEAD, la garde crierait au « retard » sur une
// production saine. La référence est le commit le plus récent de l'histoire
// de HEAD qui porte ce tag (`dernierShaVert`). Conséquences :
//   - `main` rouge, production sur le dernier vert        → À JOUR ;
//   - production DESCENDANTE du dernier vert              → un commit SANS
//     verdict vert est servi : porte contournée (redeploy d'urgence) ou tag
//     manquant. ROUGE, toujours ;
//   - aucun tag `ci-vert/*` dans les 500 derniers commits → ROUGE
//     (`aucun_vert`) : `CI vert` ne pose plus rien, donc plus rien ne part en
//     production. Une garde qui ne trouve pas sa référence échoue.
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
    return { ok: true, code: 'a_jour', message: `la production sert ${servi}, qui est le dernier commit vert du depot.` }
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
        `la production sert ${servi} alors que le dernier commit vert est ${head}, pousse il y a ` +
        `${Math.round(ageHeadMin)} min (tolerance ${TOLERANCE_RETARD_MIN} min). Le deploiement est BLOQUE ou a echoue : ` +
        'la CI est verte, le site repond, et personne ne voit que le correctif n\'est pas en ligne.',
    }
  }

  if (relation === 'descendant') {
    return {
      ok: false,
      code: 'prod_en_avance',
      message:
        `la production sert ${servi}, qui DESCEND du dernier commit vert ${head} : un commit SANS verdict ` +
        '`CI noyau` vert est servi (porte de deploiement contournee par un redeploy d urgence, ou tag ' +
        "`ci-vert` absent), ou du code a ete deploye sans passer par la branche par defaut. C'est plus grave " +
        "qu'un retard, jamais moins.",
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

/** Prefixe des tags poses par `ci-vert.yml` (lu aussi par la porte). */
export const PREFIXE_VERT = 'refs/tags/ci-vert/'

/** Profondeur de recherche du dernier commit vert dans l'histoire de HEAD. */
export const PROFONDEUR_VERT = 500

/**
 * Le commit le plus recent de l'histoire de HEAD qui porte `ci-vert/<sha>`,
 * en SHA complet, ou `null`. Seuls les tags dont le NOM et la CIBLE disent le
 * meme commit comptent : un tag deplace a la main ne fait pas un vert.
 *
 * ⚠️ Le clone doit porter les tags et l'historique (`fetch-depth: 0`).
 */
export function dernierShaVert(cwd = process.cwd()) {
  const verts = new Set(
    git(['for-each-ref', '--format=%(refname) %(objectname)', PREFIXE_VERT], cwd)
      .split('\n')
      .map((l) => l.trim().split(' '))
      .filter(([ref, cible]) => ref && cible && ref === PREFIXE_VERT + cible)
      .map(([, cible]) => cible),
  )
  if (verts.size === 0) return null
  const histoire = git(['rev-list', `--max-count=${PROFONDEUR_VERT}`, 'HEAD'], cwd).split('\n')
  return histoire.map((c) => c.trim()).find((c) => verts.has(c)) ?? null
}

/**
 * Relation entre le commit servi et la reference (HEAD par defaut ; le CLI
 * passe le dernier commit vert).
 *
 * ⚠️ Un clone SUPERFICIEL (`fetch-depth: 1`, le defaut d'actions/checkout) ne
 * contient pas l'ancetre : `merge-base` echouerait et la garde rendrait
 * « inconnu » sur une production parfaitement saine. Le workflow pose donc
 * `fetch-depth: 0`, et ce cas est distingue explicitement ci-dessous.
 */
export function relationAvecHead(servi, cwd = process.cwd(), reference = 'HEAD') {
  const head = git(['rev-parse', reference], cwd)
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

/** Age du commit de reference (HEAD par defaut), en minutes. */
export function ageHeadMinutes(cwd = process.cwd(), reference = 'HEAD') {
  const ts = Number(git(['log', '-1', '--format=%ct', reference], cwd))
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

  const vert = dernierShaVert()
  if (!vert) {
    console.error(
      `::error::[aucun_vert] aucun tag ci-vert/<sha> dans les ${PROFONDEUR_VERT} derniers commits de HEAD. ` +
        '`CI vert` (ci-vert.yml) ne pose plus le verdict du noyau, donc la porte de deploiement ne laisse plus ' +
        'rien partir en production. Une garde qui ne trouve pas sa reference ECHOUE (clone sans tags : fetch-depth 0).',
    )
    process.exit(1)
  }

  const { relation, head } =
    servi && servi !== 'dev' ? relationAvecHead(servi, process.cwd(), vert) : { relation: 'inconnu', head: 'n/a' }
  const v = verdict({ servi, head, relation, ageHeadMin: ageHeadMinutes(process.cwd(), vert) })

  console.log(`marqueur     : ${url}`)
  console.log(`servi        : ${servi ?? '(illisible)'}`)
  console.log(`dernier vert : ${vert.slice(0, 7)}`)
  console.log(`depot HEAD   : ${git(['rev-parse', '--short=7', 'HEAD'], process.cwd())}`)
  console.log(`relation     : ${relation}`)
  console.log('')

  if (!v.ok) {
    console.error(`::error::[${v.code}] ${v.message}`)
    process.exit(1)
  }
  console.log(`✅ ${v.message}`)
}
