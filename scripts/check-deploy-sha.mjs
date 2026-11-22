// check-deploy-sha.mjs : le commit SERVI en production contre le depot (T-8)
//
// Defaut C-35 cote front : uptime.yml dit « HTTP 200 » (une coquille SPA vide aussi), check:edge ne
// regarde que les Edge Functions, la CI dit que main COMPILE. Rien ne disait QUEL COMMIT tourne.
// dist/version.json, ecrit au build par cosmo-emit-version (VERCEL_GIT_COMMIT_SHA, meme id que la
// release Sentry), est lu SUR LA PRODUCTION (public, sans secret : la garde ne saute jamais faute de secret).
//
// Trois situations, qu'un `!=` confondrait :
//   A JOUR   servi == reference                 → vert
//   RETARD   servi est un ANCETRE de reference  → vert si recent (deploiement en vol), ROUGE au-dela de la tolerance
//   DERIVE   servi INCONNU ou DESCENDANT        → ROUGE, toujours (une production en AVANCE a deploye du code jamais relu)
// ❌ Ne jamais relacher TOLERANCE_RETARD_MIN pour faire passer la CI.
//
// Reference (CI-02) : Vercel ne construit qu'un SHA tague `ci-vert/<sha>` ; un main rouge reste hors
// production sans etre un retard. La reference est le commit le plus recent de HEAD portant ce tag
// (dernierShaVert). Production descendante du dernier vert = porte contournee, ROUGE. Aucun tag
// `ci-vert/*` dans les 500 derniers commits = ROUGE (`aucun_vert`) : une garde sans reference echoue.
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
