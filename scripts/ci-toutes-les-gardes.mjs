// ═══════════════════════════════════════════════════════════════════
// ci-toutes-les-gardes.mjs · chaque garde de `lint-test-build` joue, et
// aucun rouge ne se perd
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Le 2026-10-12, l'étape 2 sur 23 du job (`check:docs`) est
// passée au rouge. Un job GitHub s'arrête au premier échec : les 21 étapes
// suivantes n'ont plus été jouées pendant TROIS JOURS, et dix d'entre elles
// étaient rouges elles aussi (effacement, portabilité, sept gardes unitaires,
// budget de bundle). Un job qui s'arrête au premier rouge ne mesure que le
// premier rouge.
//
// ── LE DISPOSITIF, ÉCRIT DANS `ci.yml` ──────────────────────────────
//
//   · `npm ci` porte `id: deps` et reste BLOQUANT : sans dépendances, aucune
//     garde ne mesure rien, et dix rouges de `module introuvable` ne diraient
//     rien de plus qu'un seul ;
//   · chaque étape suivante porte exactement `CONDITION` : elle joue même si
//     une précédente a échoué ;
//   · aucune ne porte `continue-on-error` : un échec garde le job rouge ;
//   · une étape qui lit la sortie d'une autre (`dist/`, `coverage/`) ÉCHOUE
//     en le disant quand cette sortie manque, jamais à vide ;
//   · la dernière étape (ce script) liste TOUTES les étapes rouges, dans le
//     résumé du job et en UNE annotation, et sort en 1 s'il y en a une.
//
// Deux usages :
//   · importé par `ci-toutes-les-gardes.guard.test.mjs`, qui refuse un
//     `ci.yml` qui contredit une de ces règles ;
//   · `node scripts/ci-toutes-les-gardes.mjs --job lint-test-build`, dernière
//     étape du job, avec `STEPS_JSON: ${{ toJSON(steps) }}`.
//
// ⚠️ Node seul, aucune dépendance : le résumé doit tourner même quand
// `npm ci` a échoué, pour le dire.
// ⚠️ Pas de shebang : le témoin importe ce module (cf. `scripts/CLAUDE.md`).
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, appendFileSync } from 'node:fs';
import { sep } from 'node:path';

/** La condition de chaque étape après `npm ci` : jouer malgré un rouge précédent. */
export const CONDITION = "${{ !cancelled() && steps.deps.outcome == 'success' }}";

/** Le résumé joue même si `npm ci` a échoué : c'est lui qui le dit. */
export const CONDITION_RESUME = '${{ !cancelled() }}';

export const SCRIPT_RESUME = 'scripts/ci-toutes-les-gardes.mjs';

/**
 * Les étapes qui lisent la sortie d'une autre. Si l'étape productrice n'est
 * pas verte, l'entrée est absente ou partielle : la lectrice doit ÉCHOUER en
 * le disant, et pour ça elle doit recevoir l'issue de la productrice.
 */
export const ENTREES = [{ commande: 'npm run check:bundle', productrice: 'build' }];

/** Lève une erreur nommée : un parseur qui ignore ce qu'il ne comprend pas finit par ne plus rien voir. */
function refuser(ligne, message) {
  throw new Error(`ci.yml, ligne ${ligne} : ${message}`);
}

/** `cle: valeur` en YAML plat, commentaire de fin et guillemets retirés. */
function paire(texte, ligne) {
  const m = texte.match(/^([A-Za-z0-9_-]+):(?:\s+(.*))?$/);
  if (!m) refuser(ligne, `ligne non reconnue : « ${texte.trim()} »`);
  let valeur = (m[2] ?? '').trim();
  if (/^'.*'$/.test(valeur) || /^".*"$/.test(valeur)) valeur = valeur.slice(1, -1);
  else valeur = valeur.replace(/\s+#.*$/, '');
  return [m[1], valeur];
}

const indentation = (l) => l.match(/^ */)[0].length;

/**
 * Un identifiant de job GitHub : une lettre ou `_`, puis lettres, chiffres,
 * `-` ou `_`. 🔴 CodeQL n° 14 (2026-10-15) : le nom venait de `--job` et
 * entrait tel quel dans une `RegExp`, où `.` valait « n'importe quel job ».
 * Le script lisait alors un autre job que celui demandé, sans le dire.
 */
export const IDENTIFIANT_JOB = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Lit les étapes d'un job dans un workflow GitHub Actions.
 *
 * Parseur volontairement ÉTROIT : il ne connaît que la forme des workflows de
 * ce dépôt (deux espaces par niveau, étapes en `      - ` à six espaces), et
 * il REFUSE ce qu'il ne reconnaît pas au lieu de l'ignorer. Une étape qu'il
 * aurait sautée serait une étape que ni le témoin ni le résumé ne verraient.
 *
 * @returns {Array<{ligne:number, name?:string, id?:string, if?:string, run?:string,
 *   uses?:string, 'continue-on-error'?:string, with:Record<string,string>,
 *   env:Record<string,string>}>}
 */
export function lireEtapes(yaml, job) {
  if (typeof job !== 'string' || !IDENTIFIANT_JOB.test(job)) {
    throw new Error(`ci.yml : identifiant de job invalide : « ${job} »`);
  }
  const lignes = yaml.replace(/\r\n/g, '\n').split('\n');
  const iJobs = lignes.findIndex((l) => /^jobs:\s*$/.test(l));
  if (iJobs < 0) throw new Error('ci.yml : aucun bloc `jobs:`');
  // Une égalité de chaînes, pas une `RegExp` : l'argument n'est jamais un motif.
  const entete = `  ${job}:`;
  const iJob = lignes.findIndex((l, k) => k > iJobs && l.trimEnd() === entete);
  if (iJob < 0) throw new Error(`ci.yml : job \`${job}\` introuvable`);

  let iSteps = -1;
  for (let k = iJob + 1; k < lignes.length; k++) {
    const l = lignes[k];
    if (/^\s*(#.*)?$/.test(l)) continue;
    if (indentation(l) <= 2) break;
    if (/^ {4}steps:\s*$/.test(l)) { iSteps = k; break; }
  }
  if (iSteps < 0) throw new Error(`ci.yml : job \`${job}\` sans \`steps:\``);

  const etapes = [];
  let etape = null;
  let carte = null; // `with` ou `env` en cours
  let bloc = null; // scalaire de bloc en cours : { cible, cle, base, plie }

  for (let k = iSteps + 1; k < lignes.length; k++) {
    const l = lignes[k];
    const n = k + 1;
    if (bloc) {
      if (/^\s*$/.test(l) || indentation(l) > bloc.base) {
        const contenu = l.slice(Math.min(indentation(l), bloc.base + 2));
        const avant = bloc.cible[bloc.cle];
        bloc.cible[bloc.cle] = avant === '' ? contenu : avant + (bloc.plie ? ' ' : '\n') + contenu;
        continue;
      }
      bloc.cible[bloc.cle] = bloc.cible[bloc.cle].trimEnd();
      bloc = null;
    }
    if (/^\s*(#.*)?$/.test(l)) continue;
    const ind = indentation(l);
    if (ind < 6) break;

    let texte;
    let base;
    if (ind === 6) {
      if (!l.startsWith('      - ')) refuser(n, 'une étape doit commencer par `      - `');
      etape = { ligne: n, with: {}, env: {} };
      etapes.push(etape);
      carte = null;
      texte = l.slice(8);
      base = 8;
    } else if (ind === 8) {
      if (!etape) refuser(n, 'clé hors étape');
      carte = null;
      texte = l.slice(8);
      base = 8;
    } else if (ind === 10) {
      if (!carte) refuser(n, 'indentation de 10 hors d’un `with:` ou d’un `env:`');
      texte = l.slice(10);
      base = 10;
    } else {
      refuser(n, `indentation inattendue (${ind})`);
    }

    const [cle, valeur] = paire(texte, n);
    const cible = base === 10 ? carte : etape;
    if (base === 8 && (cle === 'with' || cle === 'env')) {
      if (valeur !== '') refuser(n, `\`${cle}:\` doit ouvrir une carte`);
      carte = etape[cle];
      continue;
    }
    if (valeur === '|' || valeur === '>-' || valeur === '>' || valeur === '|-') {
      cible[cle] = '';
      bloc = { cible, cle, base, plie: valeur.startsWith('>') };
      continue;
    }
    cible[cle] = valeur;
  }
  if (bloc) bloc.cible[bloc.cle] = bloc.cible[bloc.cle].trimEnd();
  return etapes;
}

const nomDe = (e) => e.name ?? e.run ?? e.uses ?? `étape de la ligne ${e.ligne}`;

/**
 * Les règles du dispositif, appliquées aux étapes d'un job.
 * @param {{ resume?: boolean, entrees?: typeof ENTREES }} options `resume` : le
 *   job doit finir par ce script ; `entrees` : les lectrices à vérifier.
 * @returns {string[]} une ligne par violation, vide si le job est conforme.
 */
export function verifierJob(etapes, { resume = true, entrees = ENTREES } = {}) {
  const fautes = [];
  const iDeps = etapes.findIndex((e) => e.run === 'npm ci');
  if (iDeps < 0) return ['aucune étape `npm ci`'];
  const deps = etapes[iDeps];
  if (deps.id !== 'deps') fautes.push(`\`npm ci\` (ligne ${deps.ligne}) doit porter \`id: deps\``);
  if (deps.if !== undefined) fautes.push(`\`npm ci\` (ligne ${deps.ligne}) doit rester bloquant : pas de \`if:\``);
  if (deps['continue-on-error'] !== undefined) {
    fautes.push(`\`npm ci\` (ligne ${deps.ligne}) ne doit pas porter \`continue-on-error\``);
  }
  for (const e of etapes.slice(0, iDeps)) {
    if (e.run !== undefined) {
      fautes.push(`« ${nomDe(e)} » (ligne ${e.ligne}) tourne AVANT \`npm ci\` : hors du dispositif`);
    }
  }

  const fin = resume ? etapes.length - 1 : etapes.length;
  const gardes = etapes.slice(iDeps + 1, Math.max(fin, iDeps + 1));
  const ids = new Map();
  for (const e of gardes) {
    const nom = `« ${nomDe(e)} » (ligne ${e.ligne})`;
    if (!e.id) fautes.push(`${nom} sans \`id\` : le résumé ne la verrait pas`);
    else if (ids.has(e.id)) fautes.push(`${nom} : \`id: ${e.id}\` déjà pris ligne ${ids.get(e.id)}`);
    else ids.set(e.id, e.ligne);
    if (e.if !== CONDITION) {
      fautes.push(`${nom} : \`if:\` doit valoir exactement \`${CONDITION}\` (vu : \`${e.if ?? 'absent'}\`)`);
    }
    if (e['continue-on-error'] !== undefined) {
      fautes.push(`${nom} porte \`continue-on-error\` : son rouge ne rougirait plus le job`);
    }
    if (e.uses?.startsWith('actions/upload-artifact@') && e.with['if-no-files-found'] !== 'error') {
      fautes.push(`${nom} : \`if-no-files-found: error\` manquant, un envoi sans fichier passerait à vide`);
    }
  }

  for (const { commande, productrice } of entrees) {
    const lectrice = gardes.find((e) => e.run?.includes(commande));
    if (!lectrice) {
      fautes.push(`aucune étape ne lance \`${commande}\` : retirer la ligne de \`ENTREES\` si c'est voulu`);
      continue;
    }
    const prod = gardes.find((e) => e.id === productrice);
    const nom = `« ${nomDe(lectrice)} » (ligne ${lectrice.ligne})`;
    if (!prod || prod.ligne > lectrice.ligne) {
      fautes.push(`${nom} lit la sortie de l'étape \`${productrice}\`, absente ou placée après elle`);
      continue;
    }
    const issue = `\${{ steps.${productrice}.outcome }}`;
    const variable = Object.keys(lectrice.env).find((v) => lectrice.env[v] === issue);
    const lignesRun = lectrice.run.split('\n').map((l) => l.trim());
    const iTest = variable
      ? lignesRun.findIndex((l) => l.includes(`"$${variable}" != success`))
      : -1;
    const iCommande = lignesRun.findIndex((l) => l.includes(commande));
    if (!variable || iTest < 0 || iTest > iCommande || !lectrice.run.includes('exit 1')) {
      fautes.push(
        `${nom} lit la sortie de \`${productrice}\` sans vérifier qu'elle existe : `
          + `il faut \`env: { X: ${issue} }\` et \`if [ "$X" != success ]; then … exit 1\` AVANT \`${commande}\``,
      );
    }
  }

  if (resume) {
    const r = etapes[etapes.length - 1];
    const nom = `la dernière étape « ${nomDe(r)} » (ligne ${r.ligne})`;
    if (!r.run?.includes(SCRIPT_RESUME)) fautes.push(`${nom} doit lancer \`${SCRIPT_RESUME}\``);
    if (r.if !== CONDITION_RESUME) fautes.push(`${nom} : \`if:\` doit valoir \`${CONDITION_RESUME}\``);
    if (r.env.STEPS_JSON !== '${{ toJSON(steps) }}') {
      fautes.push(`${nom} : \`STEPS_JSON: \${{ toJSON(steps) }}\` manquant`);
    }
    if (r['continue-on-error'] !== undefined) fautes.push(`${nom} ne doit pas porter \`continue-on-error\``);
  }
  return fautes;
}

/**
 * Confronte les étapes déclarées à ce que le run en a fait (`toJSON(steps)`).
 *
 * Rouge : une étape en `failure` ou `cancelled`. Anomalie : une étape
 * déclarée absente du contexte, une étape SAUTÉE alors que `npm ci` est vert
 * (sa condition la masque), ou un contexte qui nomme une étape inconnue (le
 * script lit alors le mauvais job). Les deux font sortir en 1.
 */
export function resumer(etapes, contexte, job) {
  const suivies = etapes.filter((e) => e.id);
  const anomalies = [];
  const rouges = [];
  const vertes = [];
  if (!contexte || typeof contexte !== 'object' || Object.keys(contexte).length === 0) {
    anomalies.push('contexte `steps` vide : aucune étape n’a pu être lue, le résumé ne mesure rien');
  } else {
    const depsVert = contexte.deps?.outcome === 'success';
    for (const e of suivies) {
      const issue = contexte[e.id]?.outcome;
      if (issue === undefined) anomalies.push(`« ${nomDe(e)} » (\`${e.id}\`) absente du contexte \`steps\``);
      else if (issue === 'failure' || issue === 'cancelled') rouges.push({ e, issue });
      else if (issue === 'skipped' && depsVert) {
        anomalies.push(`« ${nomDe(e)} » (\`${e.id}\`) SAUTÉE alors que \`npm ci\` est vert : sa condition la masque`);
      } else if (issue === 'success') vertes.push(e);
    }
    const connus = new Set(suivies.map((e) => e.id));
    for (const id of Object.keys(contexte)) {
      if (!connus.has(id)) anomalies.push(`le contexte nomme \`${id}\`, que le job \`${job}\` ne déclare pas`);
    }
    if (!depsVert && contexte.deps) {
      anomalies.push('`npm ci` n’est pas vert : aucune garde n’a tourné, ce run ne mesure rien');
    }
  }

  const md = [`### ${job} · ${rouges.length} étape(s) rouge(s) sur ${suivies.length}`, ''];
  if (rouges.length) {
    md.push('| Étape | Issue |', '|---|---|');
    for (const { e, issue } of rouges) md.push(`| ✖ ${nomDe(e)} | ${issue} |`);
    md.push('');
  }
  if (anomalies.length) {
    md.push('**Anomalies :**', '');
    for (const a of anomalies) md.push(`- ${a}`);
    md.push('');
  }
  md.push(`✔ ${vertes.length} étape(s) verte(s).`);

  return {
    rouges: rouges.map(({ e, issue }) => ({ id: e.id, nom: nomDe(e), issue })),
    anomalies,
    vertes: vertes.length,
    markdown: md.join('\n') + '\n',
    code: rouges.length || anomalies.length ? 1 : 0,
  };
}

/** Échappement d'une annotation GitHub (`::error title=…::message`). */
const echapper = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

/**
 * Point d'entrée, entrées et sorties injectées pour le témoin.
 * @returns {number} le code de sortie
 */
export function run({
  argv = process.argv.slice(2),
  env = process.env,
  lire = (p) => readFileSync(p, 'utf8'),
  ajouterResume = (p, texte) => appendFileSync(p, texte),
  log = console.log,
} = {}) {
  const arg = (nom, defaut) => {
    const i = argv.indexOf(nom);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : defaut;
  };
  const job = arg('--job');
  const workflow = arg('--workflow', '.github/workflows/ci.yml');
  if (!job) {
    log('::error title=ci-toutes-les-gardes::--job manquant');
    return 1;
  }
  if (!env.STEPS_JSON) {
    log('::error title=ci-toutes-les-gardes::STEPS_JSON absent : passer `STEPS_JSON: ${{ toJSON(steps) }}`, sinon ce résumé ne mesure rien');
    return 1;
  }
  let contexte;
  let etapes;
  try {
    contexte = JSON.parse(env.STEPS_JSON);
    etapes = lireEtapes(lire(workflow), job);
  } catch (e) {
    log(`::error title=ci-toutes-les-gardes::${echapper(e.message)}`);
    return 1;
  }
  const r = resumer(etapes, contexte, job);
  log(r.markdown);
  if (env.GITHUB_STEP_SUMMARY) ajouterResume(env.GITHUB_STEP_SUMMARY, r.markdown);
  if (r.code) {
    // UNE annotation, tout dedans : GitHub en plafonne le NOMBRE à dix par
    // étape, en silence, jamais la longueur. Les annotations se lisent sans
    // compte sur un dépôt public, le résumé du job non.
    const lignes = [
      ...r.rouges.map((x) => `ROUGE · ${x.nom} (${x.issue})`),
      ...r.anomalies.map((a) => `ANOMALIE · ${a}`),
    ];
    log(`::error title=${job} · ${r.rouges.length} étape(s) rouge(s)::${echapper(lignes.join('\n'))}`);
  }
  return r.code;
}

const estPrincipal = process.argv[1]
  && import.meta.url.endsWith(process.argv[1].split(sep).join('/'));
if (estPrincipal) process.exit(run());
