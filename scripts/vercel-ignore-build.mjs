// ═══════════════════════════════════════════════════════════════════
// vercel-ignore-build.mjs · la PORTE de deploiement (CI-02, vague 3.2,
// 2026-11-07). Lancee par Vercel comme `ignoreCommand` (`vercel.json`).
//
// 🔴 POURQUOI
//
// Vercel construisait et mettait en production chaque poussee sur `main`
// en ~40 s, AVANT que `CI noyau` (~5 min) ne rende son verdict. Un commit
// rouge partait donc en production, et le retour arriere etait le seul filet.
//
// ── CE QUE FAIT CE SCRIPT ─────────────────────────────────────────
//
// Pour un build de PRODUCTION (`VERCEL_ENV=production` ou branche `main`), il
// attend que le depot porte le tag `ci-vert/<sha>`, pose par `ci-vert.yml`
// apres un `CI noyau` vert sur ce SHA. Sondage toutes les 20 s, plafond
// 15 min. Tag present : on construit. Tag `ci-rouge/<sha>` present (noyau
// rouge sur `main`), delai depasse, reseau en panne, SHA illisible : on NE
// construit PAS, avec la raison dans le journal du build.
// Les builds d'apercu (branches `noyau/*` et autres) construisent tout de
// suite, comme avant.
//
// ── POURQUOI `git ls-remote` ET PAS L'API REST ────────────────────
//
// L'API GitHub sans jeton est limitee a 60 requetes par heure et par IP, et
// les IP de build de Vercel sont partagees entre clients : un sondage toutes
// les 20 s y brulerait le quota d'un inconnu, ou se ferait refuser. Le
// protocole git smart HTTP d'un depot public n'a pas ce plafond, et ne
// demande AUCUN jeton : ni Vercel ni GitHub n'ont de secret a fournir.
//
// ── ECHEC FERME, Y COMPRIS SI CE FICHIER PLANTE ───────────────────
//
// Vercel lit le code de sortie de `ignoreCommand` : 1 = construire,
// 0 = ignorer (deploiement `CANCELED`). Or Node sort en 1 sur une exception
// non rattrapee, un module introuvable ou une erreur de syntaxe : brancher
// ce script tel quel ferait CONSTRUIRE sur un plantage. Il sort donc en
// `CODE_CONSTRUIRE` (78) pour construire, et `vercel.json` traduit :
//     node scripts/vercel-ignore-build.mjs; test $? -ne 78
// 78 -> `test` faux -> 1 -> construire ; tout autre code -> 0 -> ignorer.
// Temoin : `scripts/porte-deploiement.guard.test.mjs`, qui joue la commande
// de `vercel.json` sous `sh`, y compris avec un Node qui plante.
//
// ⚠️ Pas de dependance : ce script tourne AVANT `npm install`.
// ⚠️ Pas de shebang : le temoin l'importe (cf. `scripts/CLAUDE.md`).
// ❌ Ne jamais faire de « delai depasse » un feu vert : un noyau lent ou un
// GitHub en panne ne sont pas des verdicts verts.
// Urgence (deployer sans tag) : `docs/DEPLOYMENT.md` § 1, « Porte de
// deploiement ».
// ═══════════════════════════════════════════════════════════════════
import { execFile } from 'node:child_process'

/** Code de sortie qui demande a Vercel de CONSTRUIRE (cf. en-tete). */
export const CODE_CONSTRUIRE = 78
/** Code de sortie qui demande a Vercel d'IGNORER le build. */
export const CODE_IGNORER = 0

/** Le depot canonique. Ses tags sont la seule source du verdict. */
export const DEPOT_URL = 'https://github.com/kelax12/COSMO1.2'
export const PREFIXE_VERT = 'refs/tags/ci-vert/'
export const PREFIXE_ROUGE = 'refs/tags/ci-rouge/'

export const INTERVALLE_MS = 20_000
export const PLAFOND_MS = 15 * 60_000

/** Un build de production, au sens de la porte. */
export function estProduction(env) {
  // Deux signaux, un seul suffit : si Vercel cessait un jour de poser l'un,
  // la porte resterait fermee plutot que de laisser passer la production.
  return env.VERCEL_ENV === 'production' || env.VERCEL_GIT_COMMIT_REF === 'main'
}

/** Les refs presentes dans une sortie `git ls-remote` (`<sha>\t<ref>`). */
export function refsPresentes(sortie) {
  return new Set(
    String(sortie)
      .split('\n')
      .map((l) => l.trim().split(/\s+/)[1])
      .filter(Boolean),
  )
}

/**
 * La decision, avec ses effets injectes : jouable sans reseau ni horloge.
 *
 * @param {{
 *   env: Record<string, string|undefined>,
 *   lsRemote: (url: string, refs: string[]) => Promise<string>,
 *   attendre?: (ms: number) => Promise<void>,
 *   maintenant?: () => number,
 *   journal?: (ligne: string) => void,
 *   intervalleMs?: number,
 *   plafondMs?: number,
 * }} o
 * @returns {Promise<{code: number, raison: string}>}
 */
export async function decider(o) {
  const {
    env,
    lsRemote,
    attendre = (ms) => new Promise((r) => setTimeout(r, ms)),
    maintenant = () => Date.now(),
    journal = (l) => console.log(l),
    intervalleMs = INTERVALLE_MS,
    plafondMs = PLAFOND_MS,
  } = o

  if (!estProduction(env)) {
    journal(`[porte] build d'apercu (VERCEL_ENV=${env.VERCEL_ENV ?? 'absent'}, branche ${env.VERCEL_GIT_COMMIT_REF ?? 'absente'}) : construit sans attendre la CI.`)
    return { code: CODE_CONSTRUIRE, raison: 'apercu' }
  }

  const sha = String(env.VERCEL_GIT_COMMIT_SHA ?? '').trim().toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    journal(`[porte] ❌ build de production IGNORE : VERCEL_GIT_COMMIT_SHA illisible ('${sha}'). Sans SHA, aucun verdict CI ne peut etre lu.`)
    return { code: CODE_IGNORER, raison: 'sha_illisible' }
  }

  const vert = PREFIXE_VERT + sha
  const rouge = PREFIXE_ROUGE + sha
  const debut = maintenant()
  journal(`[porte] production ${sha} : attente du tag ${vert} sur ${DEPOT_URL} (sondage ${intervalleMs / 1000} s, plafond ${plafondMs / 60_000} min).`)

  let tentative = 0
  let derniereErreur = null
  for (;;) {
    tentative++
    try {
      const refs = refsPresentes(await lsRemote(DEPOT_URL, [vert, rouge]))
      derniereErreur = null
      if (refs.has(vert)) {
        const s = Math.round((maintenant() - debut) / 1000)
        journal(`[porte] ✅ CI noyau VERT sur ${sha} (tag vu a la tentative ${tentative}, apres ${s} s) : construction.`)
        return { code: CODE_CONSTRUIRE, raison: 'vert' }
      }
      if (refs.has(rouge)) {
        journal(`[porte] ❌ build de production IGNORE : CI noyau ROUGE sur ${sha} (tag ${rouge}). La production reste sur le dernier deploiement vert.`)
        return { code: CODE_IGNORER, raison: 'rouge' }
      }
      journal(`[porte] tentative ${tentative} : pas encore de verdict vert.`)
    } catch (err) {
      derniereErreur = err
      journal(`[porte] tentative ${tentative} : git ls-remote en echec (${String(err?.message ?? err).split('\n')[0]}).`)
    }

    if (maintenant() - debut + intervalleMs > plafondMs) {
      const pourquoi = derniereErreur
        ? `GitHub injoignable a la derniere tentative (${String(derniereErreur?.message ?? derniereErreur).split('\n')[0]})`
        : 'aucun tag ci-vert ni ci-rouge'
      journal(`[porte] ❌ build de production IGNORE : delai de ${plafondMs / 60_000} min depasse, ${pourquoi}. Echec FERME : un verdict absent n'est pas un vert. Deployer quand meme : docs/DEPLOYMENT.md, « Porte de deploiement ».`)
      return { code: CODE_IGNORER, raison: derniereErreur ? 'reseau' : 'delai' }
    }
    await attendre(intervalleMs)
  }
}

/** `git ls-remote` reel, borne a 30 s par appel. */
export function lsRemoteGit(url, refs) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['ls-remote', url, ...refs],
      { timeout: 30_000, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    )
  })
}

// ── CLI ────────────────────────────────────────────────────────────
const lanceDirectement =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].split('\\').join('/'))

if (lanceDirectement) {
  try {
    const { code } = await decider({ env: process.env, lsRemote: lsRemoteGit })
    process.exit(code)
  } catch (err) {
    console.log(`[porte] ❌ build IGNORE : erreur inattendue de la porte (${err?.message ?? err}).`)
    process.exit(CODE_IGNORER)
  }
}
