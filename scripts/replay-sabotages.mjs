// ═══════════════════════════════════════════════════════════════════
// C-81 · AM-1 — LES TÉMOINS NE SONT JAMAIS REJOUÉS
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT, ET IL EST STRUCTUREL. Un témoin est un cas de test qui prouve
// qu'une garde mord encore. Chacun est arrivé avec la même phrase : « vu rouge
// sur N sabotages ». Ce sabotage a été joué UNE FOIS, à la main, le jour de
// l'écriture. Rien, ensuite, ne dit qu'un témoin détecte ENCORE.
//
// Un témoin qui ne détecte plus est pire qu'un témoin absent : il produit un
// vert, et ce vert est lu comme une preuve. C'est la thèse centrale de
// `scripts/CLAUDE.md` appliquée à l'étage du dessus — les gardes gardent le
// produit, et rien ne garde les gardes.
//
// ── CE QUE CE SCRIPT FAIT ───────────────────────────────────────────
//
//   1. Il RECOMPTE les témoins du dépôt à chaque run (jamais un total recopié) :
//      tout cas `it`/`test` de `src/**`, `scripts/**` et `eslint-rules/**` dont
//      le nom, ou celui d'un `describe` qui le porte, a la marque `TÉMOIN` /
//      `TEMOIN` (ou l'étiquette `témoin :`, `(témoin)`). Lecture par l'AST de
//      TypeScript, pas par une expression régulière : un parseur de garde qui
//      se trompe est la classe de défaut que ce fichier existe pour attraper.
//   2. Il COPIE l'arbre de travail dans un dossier temporaire. 🔴 Il n'écrit
//      JAMAIS dans l'arbre de travail : plusieurs sessions travaillent sur
//      cette machine, et la version d'avant écrivait ses sabotages en place.
//   3. Il joue chaque garde du catalogue sur la copie PROPRE (la référence).
//   4. Pour chaque sabotage : il casse la chose gardée DANS LA COPIE, rejoue
//      la garde, exige qu'elle rougisse POUR LA BONNE RAISON, et restaure la
//      copie octet pour octet.
//   5. Il imprime le ratio témoins rejoués / témoins du dépôt.
//
// ── « POUR LA BONNE RAISON » ────────────────────────────────────────
//
// Un rouge ne prouve rien par lui-même : un fichier qui plante à l'import, une
// garde déjà rouge sur l'arbre propre, rougissent aussi. Deux formes de garde,
// deux preuves :
//   · un fichier de test : chaque cas `attendu` est lu par son NOM dans le
//     rapport JSON de vitest. Il doit être VERT sur la copie propre et ROUGE
//     sur la copie sabotée. Un cas absent du rapport n'est pas un rouge ;
//   · une commande (`npm run check:*`) : elle doit sortir en non-zéro, ET sa
//     sortie doit porter la `raison` attendue — qui nomme l'objet saboté —,
//     ET cette raison doit être ABSENTE de la sortie de la copie propre.
//
// ── CE QUI COMPTE COMME « TÉMOIN REJOUÉ » ───────────────────────────
//
// 🔴 Un témoin compte quand il a été VU ROUGE, par son nom, sous un sabotage,
// et VERT sans lui. Pas quand un sabotage le « concerne », pas quand son
// fichier a été lancé : quand son propre rouge a été observé. Les sabotages
// d'une garde-commande (`check:rls`…) prouvent que la GARDE mord ; ils sont
// comptés à part, et n'entrent pas dans ce ratio.
//
// ── POURQUOI PAS STRYKER ────────────────────────────────────────────
//
//   · Stryker mute le code SOURCE et regarde si les tests tombent. Or la
//     majorité des témoins de ce dépôt ne testent pas du code : ils lisent
//     des FICHIERS — `vercel.json`, une migration SQL, une Edge Function
//     Deno, un workflow YAML. Un mutateur JavaScript n'y touche pas ;
//   · surtout : un score de mutation est un POURCENTAGE, et l'expérience de
//     ce dépôt est qu'un pourcentage finit par être négocié. Un sabotage
//     nommé qui passe au vert ne se négocie pas.
//
// ── CE QUE ÇA NE PROUVE PAS ─────────────────────────────────────────
//
// ⚠️ Que TOUS les témoins détectent. Le nombre rejoué est IMPRIMÉ à chaque
// run, à côté du total, et les fichiers non rejoués sont nommés.
// ❌ Ne jamais écrire « les témoins sont vérifiés » : écrire combien.
// ═══════════════════════════════════════════════════════════════════

import {
  readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, rmSync,
  symlinkSync, unlinkSync, rmdirSync, lstatSync, realpathSync,
} from 'node:fs';
import { join, sep, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

import { CATALOGUE } from './replay-sabotages.catalogue.mjs';

export { CATALOGUE };

const RACINE = process.cwd();
const CHAMP = ['src', 'scripts', 'eslint-rules'];
const EST_UN_TEST = /\.(test|spec)\.(ts|tsx|mjs|js)$/;
const MEGA = 64 * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════
// 1. Le recensement des témoins
// ═══════════════════════════════════════════════════════════════════

/**
 * Un titre porte-t-il la marque du témoin ?
 *
 * La marque en CAPITALES (`TÉMOIN`, `TEMOIN`, `TEMOIN DU TEMOIN`), où qu'elle
 * soit ; ou l'étiquette en minuscules, en TÊTE de titre (`témoin : …`,
 * `témoin — …`) ou entre parenthèses (`… (témoin)`).
 *
 * ⚠️ Le mot nu en minuscules au milieu d'une phrase ne compte PAS : « aucune
 * Edge Function n est sans temoin » parle des témoins, il n'en est pas un.
 */
export function porteLaMarque(titre) {
  return /T[ÉE]MOIN/.test(titre)
    || /^\s*t[ée]moins?\b/i.test(titre)
    || /\(\s*t[ée]moins?\b/i.test(titre);
}

/** La clé d'un cas : ses `describe` puis son titre, comme vitest les rend. */
export const cleDuCas = (chemin, titre) => [...chemin, titre].join(' > ');

/**
 * Les témoins d'UNE source de test, lus dans son arbre syntaxique.
 *
 * Un cas est un témoin si son titre, OU celui d'un `describe` qui l'englobe,
 * porte la marque. `gabarit` signale un titre construit (`${table} …`) : vitest
 * le rendra substitué, il ne peut donc pas être apparié mot pour mot.
 */
export function temoinsDuSource(texte, fichier, ts) {
  const kind = fichier.endsWith('.tsx') ? ts.ScriptKind.TSX
    : fichier.endsWith('.ts') ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(fichier, texte, ts.ScriptTarget.Latest, true, kind);
  const out = [];

  // `it.skip(…)`, `it.each(t)(…)`, `describe.only(…)` : on remonte à l'identifiant.
  const racineDeLAppel = (e) => {
    let x = e;
    while (ts.isCallExpression(x) || ts.isPropertyAccessExpression(x)) x = x.expression;
    return ts.isIdentifier(x) ? x.text : null;
  };
  // Un titre qui n'est pas un littéral (`describe(name, …)` dans une boucle)
  // est gardé comme GABARIT : vitest le rendra substitué.
  const titreDe = (a) => {
    if (!a) return null;
    if (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) return { titre: a.text, gabarit: false };
    if (ts.isTemplateExpression(a)) return { titre: a.getText(sf).slice(1, -1), gabarit: true };
    return { titre: `\${${a.getText(sf)}}`, gabarit: true };
  };
  // Un appel de test porte une FONCTION : c'est ce qui distingue `it('x', () => …)`
  // de l'appel intérieur d'`it.each(table)`, et de `regex.test('…')`.
  const porteUneFonction = (n) => n.arguments.some((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));

  const visiter = (n, chemin, gabarit) => {
    if (ts.isCallExpression(n) && porteUneFonction(n)) {
      const qui = racineDeLAppel(n.expression);
      const t = titreDe(n.arguments[0]);
      if (t && (qui === 'describe' || qui === 'suite')) {
        ts.forEachChild(n, (c) => visiter(c, [...chemin, t.titre], gabarit || t.gabarit));
        return;
      }
      if (t && (qui === 'it' || qui === 'test') && [...chemin, t.titre].some(porteLaMarque)) {
        out.push({
          fichier,
          chemin,
          titre: t.titre,
          cle: cleDuCas(chemin, t.titre),
          // `it.each(table)('cas %s', …)` : vitest rend un cas PAR ligne, titre substitué.
          gabarit: gabarit || t.gabarit || ts.isCallExpression(n.expression),
          parSonNom: porteLaMarque(t.titre),
          ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        });
      }
    }
    ts.forEachChild(n, (c) => visiter(c, chemin, gabarit));
  };
  visiter(sf, [], false);
  return out;
}

/** Les fichiers de l'arbre de travail : suivis, plus les nouveaux non ignorés. */
function fichiersDeLArbre(racine, ...chemins) {
  const sortie = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...chemins],
    { cwd: racine, maxBuffer: MEGA },
  ).toString('utf8');
  return [...new Set(sortie.split('\0').filter(Boolean))].filter((f) => existsSync(join(racine, f)));
}

/** Tous les témoins du dépôt. Lecture seule. */
export function recenserTemoins(racine = RACINE) {
  const ts = createRequire(join(racine, 'package.json'))('typescript');
  const fichiers = fichiersDeLArbre(racine, ...CHAMP).filter((f) => EST_UN_TEST.test(f));
  const temoins = [];
  for (const f of fichiers) temoins.push(...temoinsDuSource(readFileSync(join(racine, f), 'utf8'), f, ts));
  return { temoins, fichiersDeTest: fichiers.length };
}

// ═══════════════════════════════════════════════════════════════════
// 2. L'atelier : une copie jetable de l'arbre
// ═══════════════════════════════════════════════════════════════════

/** git sans conversion de fins de ligne : on compare des OCTETS. */
const git = (cwd, args) => spawnSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', ...args], {
  cwd, encoding: 'utf8', maxBuffer: MEGA,
});

/**
 * Copie l'arbre de travail dans un dossier temporaire.
 *
 * 🔴 `node_modules` est un LIEN, jamais une copie (des centaines de Mo), et
 * c'est le point dangereux : un effacement récursif qui suivrait le lien
 * viderait le `node_modules` du dépôt (mémoire « worktree + junction »,
 * récidive du 2026-09-25). `nettoyerAtelier` retire donc le lien SEUL, vérifie
 * qu'il a disparu, et seulement ensuite efface le reste.
 *
 * La copie est un dépôt git à elle (index seulement, aucun commit) : en fin de
 * run, `git status` y prouve, indépendamment de la vérification octet pour
 * octet, que chaque sabotage a été défait.
 */
export function preparerAtelier(racine = RACINE) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'cosmo-sabotages-')));
  const copie = join(base, 'arbre');
  const journal = join(base, 'journal');
  mkdirSync(copie);
  mkdirSync(journal);
  const fichiers = fichiersDeLArbre(racine);
  for (const f of fichiers) {
    const cible = join(copie, f);
    mkdirSync(dirname(cible), { recursive: true });
    copyFileSync(join(racine, f), cible);
  }
  symlinkSync(join(racine, 'node_modules'), join(copie, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const init = git(copie, ['init', '-q']);
  const ajout = init.status === 0 ? git(copie, ['add', '-A']) : init;
  if (ajout.status !== 0) throw new Error(`git dans la copie : ${ajout.stderr}`);
  return { base, copie, journal, fichiers: fichiers.length };
}

/** Retire l'atelier. Rend `true` si tout est parti, `false` si on a préféré le laisser. */
export function nettoyerAtelier(atelier) {
  if (!atelier || !existsSync(atelier.base)) return true;
  const lien = join(atelier.copie, 'node_modules');
  // Deux gestes NON récursifs, et seulement eux : ni l'un ni l'autre ne peut
  // vider un dossier réel. `unlink` retire un lien symbolique (et une jonction
  // sous Windows) ; `rmdir` retire une jonction comme un dossier vide, sans
  // toucher sa cible, et échoue sur un vrai dossier non vide.
  try {
    unlinkSync(lien);
  } catch {
    try {
      rmdirSync(lien);
    } catch {
      // traité juste en dessous
    }
  }
  let present = true;
  try {
    lstatSync(lien);
  } catch {
    present = false;
  }
  if (present) {
    console.error(
      `\n⚠️ Le lien ${lien} n'a pas pu être retiré : la copie est LAISSÉE en place\n`
        + `   (${atelier.base}) plutôt que d'effacer à travers le lien le node_modules du dépôt.`,
    );
    return false;
  }
  rmSync(atelier.base, { recursive: true, force: true });
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// 3. Sabotage et restauration, dans la copie seulement
// ═══════════════════════════════════════════════════════════════════

/** Nombre d'occurrences littérales. */
const occurrences = (texte, motif) => texte.split(motif).length - 1;

/**
 * Vérifie qu'une modification est applicable SANS l'appliquer.
 *
 * ⚠️ `chercher` doit apparaître EXACTEMENT UNE FOIS. Un motif ambigu saboterait
 * autre chose que prévu, ou rien du tout, et un sabotage qui ne sabote rien
 * laisse la garde verte pour la bonne raison — c'est-à-dire qu'il ment.
 */
export function verifierModif(copie, m) {
  const chemin = join(copie, m.fichier);
  if ('creer' in m) {
    return existsSync(chemin) ? `${m.fichier} existe déjà : le sabotage écraserait un vrai fichier` : null;
  }
  if (!existsSync(chemin)) return `${m.fichier} absent : le catalogue décrit un état périmé`;
  if (m.supprimer) return null;
  const n = occurrences(readFileSync(chemin, 'utf8'), m.chercher);
  return n === 1 ? null : `le motif « ${m.chercher} » apparaît ${n} fois dans ${m.fichier} (attendu : exactement 1)`;
}

/** Applique les modifications d'un sabotage. Rend les octets d'origine, pour restaurer. */
export function appliquerModifs(copie, modifs) {
  const originaux = new Map();
  for (const m of modifs) {
    const chemin = join(copie, m.fichier);
    if (!originaux.has(m.fichier)) originaux.set(m.fichier, existsSync(chemin) ? readFileSync(chemin) : null);
    if ('creer' in m) {
      mkdirSync(dirname(chemin), { recursive: true });
      writeFileSync(chemin, m.creer, 'utf8');
    } else if (m.supprimer) {
      unlinkSync(chemin);
    } else {
      const texte = readFileSync(chemin, 'utf8');
      // Fonction de remplacement : une chaîne `remplacer` contenant `$&` ou `$1`
      // serait sinon INTERPRÉTÉE par `String.replace`.
      writeFileSync(chemin, texte.replace(m.chercher, () => m.remplacer), 'utf8');
    }
  }
  return originaux;
}

/** Remet chaque fichier touché dans son état d'origine. Rend les fichiers qui ne sont PAS revenus. */
export function restaurer(copie, originaux) {
  for (const [f, octets] of originaux) {
    const chemin = join(copie, f);
    if (octets === null) {
      if (existsSync(chemin)) unlinkSync(chemin);
    } else {
      writeFileSync(chemin, octets);
    }
  }
  const abimes = [];
  for (const [f, octets] of originaux) {
    const chemin = join(copie, f);
    const revenu = octets === null ? !existsSync(chemin) : existsSync(chemin) && readFileSync(chemin).equals(octets);
    if (!revenu) abimes.push(f);
  }
  return abimes;
}

// ═══════════════════════════════════════════════════════════════════
// 4. Jouer une garde
// ═══════════════════════════════════════════════════════════════════

// eslint-disable-next-line no-control-regex
const sansAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');
const fin = (s, n = 12) => sansAnsi(s).trim().split('\n').slice(-n).join('\n');
const posix = (p) => p.split('\\').join('/');

let numeroDeRapport = 0;

/**
 * Lance UN fichier de test dans la copie et rend chacun de ses cas, par nom.
 *
 * 🔴 Le verdict est lu dans le RAPPORT JSON de vitest, cas par cas, jamais
 * dans l'affichage. La première version de ce script lisait le reporter `dot`
 * et déclarait les sept témoins « rouges pour la mauvaise raison » alors
 * qu'ils faisaient leur travail ; la deuxième lisait un résumé coloré par des
 * séquences ANSI. Une garde qui interprète un AFFICHAGE rend un verdict sur la
 * mise en forme.
 *
 * 🔴 `node node_modules/vitest/vitest.mjs`, JAMAIS `npx` : sur Windows,
 * `spawnSync('npx.cmd')` échoue en `EINVAL` sans rien lancer, `status` vaut
 * `null`, et chaque témoin passait pour rouge sans avoir tourné.
 */
export function jouerVitest(atelier, fichier) {
  const vitest = join(atelier.copie, 'node_modules', 'vitest', 'vitest.mjs');
  if (!existsSync(vitest)) throw new Error(`vitest introuvable (${vitest}) : lancer \`npm ci\` d'abord.`);
  numeroDeRapport += 1;
  const rapport = join(atelier.journal, `vitest-${numeroDeRapport}.json`);
  const r = spawnSync(
    process.execPath,
    [vitest, 'run', fichier, '--reporter=json', `--outputFile=${rapport}`],
    { cwd: atelier.copie, encoding: 'utf8', maxBuffer: MEGA, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (r.error) throw r.error;
  if (!existsSync(rapport)) {
    return { panne: `aucun rapport JSON (sortie ${r.status}) :\n${fin(`${r.stdout}${r.stderr}`)}` };
  }
  return lireRapportVitest(JSON.parse(readFileSync(rapport, 'utf8')), fichier, r.status);
}

/** Rend `{ code, cas, message }` d'un rapport JSON de vitest, ou `{ panne }`. */
export function lireRapportVitest(json, fichier, code) {
  const resultats = json.testResults ?? [];
  const vises = resultats.filter((t) => posix(t.name ?? '').endsWith(`/${fichier}`));
  // « Ne JAMAIS conclure d une ligne de résumé » (CLAUDE.md racine) : on vérifie
  // que le rapport porte le fichier visé, et lui seul.
  if (resultats.length !== 1 || vises.length !== 1) {
    return {
      panne: `le rapport porte ${resultats.length} fichier(s) (${resultats.map((t) => posix(t.name ?? '?').split('/').pop()).join(', ')}), attendu : ${fichier} seul`,
    };
  }
  const t = vises[0];
  return {
    code,
    message: t.message ?? '',
    cas: (t.assertionResults ?? []).map((a) => ({
      titre: a.title,
      chemin: a.ancestorTitles ?? [],
      cle: cleDuCas(a.ancestorTitles ?? [], a.title),
      statut: a.status,
      echec: (a.failureMessages ?? []).join('\n'),
    })),
  };
}

/** Lance une garde-commande (`scripts/*.mjs`) dans la copie. */
export function jouerCommande(atelier, garde) {
  const args = [];
  if (garde.precharger) args.push('--import', pathToFileURL(join(atelier.copie, garde.precharger.fichier)).href);
  args.push(join(atelier.copie, garde.commande), ...(garde.args ?? []));
  const r = spawnSync(process.execPath, args, {
    cwd: atelier.copie,
    encoding: 'utf8',
    maxBuffer: MEGA,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(garde.env ?? {}) },
  });
  if (r.error) throw r.error;
  return { code: r.status, sortie: sansAnsi(`${r.stdout ?? ''}${r.stderr ?? ''}`) };
}

// ═══════════════════════════════════════════════════════════════════
// 5. Juger
// ═══════════════════════════════════════════════════════════════════

/**
 * Le verdict d'un sabotage sur un fichier de test.
 *
 * Rend `{ ok, motif, bascules }` où `bascules` est la clé de CHAQUE cas passé
 * du vert au rouge — celles des témoins font le ratio.
 */
export function jugerVitest(attendu, base, sabote) {
  if (base.panne) return { ok: false, motif: `la garde est en panne sur la copie PROPRE : ${base.panne}`, bascules: [] };
  if (sabote.panne) return { ok: false, motif: `rouge pour une raison qui n'est pas la nôtre : ${sabote.panne}`, bascules: [] };
  const statutDeBase = new Map(base.cas.map((c) => [c.cle, c.statut]));
  const bascules = sabote.cas
    .filter((c) => c.statut === 'failed' && statutDeBase.get(c.cle) === 'passed')
    .map((c) => c.cle);
  if (!attendu || attendu.length === 0) {
    return {
      ok: false,
      motif: `aucun cas \`attendu\` déclaré. Cas passés au rouge :\n        ${bascules.join('\n        ') || '(aucun)'}`,
      bascules,
    };
  }
  const problemes = [];
  for (const nom of attendu) {
    const trouves = base.cas.filter((c) => c.titre === nom || c.cle === nom);
    if (trouves.length !== 1) {
      problemes.push(`« ${nom} » : ${trouves.length} cas portent ce nom sur la copie propre (attendu : 1). Le catalogue décrit un état périmé.`);
      continue;
    }
    const [cas] = trouves;
    if (cas.statut !== 'passed') {
      problemes.push(`« ${nom} » est déjà ${cas.statut} sur la copie PROPRE : son rouge sous sabotage ne prouverait rien.`);
      continue;
    }
    const apres = sabote.cas.find((c) => c.cle === cas.cle);
    if (!apres) {
      problemes.push(`« ${nom} » est ABSENT du rapport sabote${sabote.message ? ` (${fin(sabote.message, 3)})` : ''} : le fichier a planté, ce rouge ne prouve rien.`);
    } else if (apres.statut !== 'failed') {
      problemes.push(`« ${nom} » reste ${apres.statut === 'passed' ? 'VERT' : apres.statut} alors que la chose gardée est cassée.`);
    }
  }
  return problemes.length === 0
    ? { ok: true, motif: '', bascules }
    : { ok: false, motif: problemes.join('\n      '), bascules };
}

/** Le verdict d'un sabotage sur une garde-commande. */
export function jugerCommande(raison, base, sabote) {
  if (!(raison instanceof RegExp)) return { ok: false, motif: 'aucune `raison` (RegExp) déclarée' };
  if (raison.test(base.sortie)) {
    return { ok: false, motif: `la raison ${raison} est DÉJÀ dans la sortie de la copie propre : le sabotage ne prouverait rien.` };
  }
  if (sabote.code === 0) return { ok: false, motif: `la garde reste VERTE (sortie 0) alors que la chose gardée est cassée.\n${fin(sabote.sortie, 6)}` };
  if (!raison.test(sabote.sortie)) {
    return {
      ok: false,
      motif: `la garde rougit (sortie ${sabote.code}) mais SANS la raison ${raison} : rouge pour une autre raison.\n${fin(sabote.sortie, 8)}`,
    };
  }
  return { ok: true, motif: '' };
}

// ═══════════════════════════════════════════════════════════════════
// 6. Le run
// ═══════════════════════════════════════════════════════════════════

/** Clé d'une garde, pour ne jouer la référence qu'une fois. */
const cleDeGarde = (g) => (typeof g === 'string' ? g : JSON.stringify({ c: g.commande, a: g.args ?? [], e: g.env ?? {}, p: g.precharger?.fichier ?? '' }));
const nomDeGarde = (g) => (typeof g === 'string' ? g : `node ${[g.commande, ...(g.args ?? [])].join(' ')}`);

/** Une erreur de forme dans le catalogue, avant tout run. */
export function verifierCatalogue(catalogue) {
  const erreurs = [];
  const ids = new Set();
  for (const s of catalogue) {
    if (ids.has(s.id)) erreurs.push(`${s.id} : id en double`);
    ids.add(s.id);
    if (!['produit', 'detecteur'].includes(s.famille)) erreurs.push(`${s.id} : famille « ${s.famille} » inconnue`);
    if (!Array.isArray(s.modifs) || s.modifs.length === 0) erreurs.push(`${s.id} : aucune modification`);
    for (const m of s.modifs ?? []) {
      if (!m.fichier) erreurs.push(`${s.id} : une modification sans fichier`);
      if (!('creer' in m) && !m.supprimer && (!m.chercher || m.remplacer === undefined || m.remplacer === m.chercher)) {
        erreurs.push(`${s.id} : modification de ${m.fichier} sans \`chercher\`/\`remplacer\` distincts`);
      }
    }
    if (typeof s.garde === 'string') {
      if (!EST_UN_TEST.test(s.garde)) erreurs.push(`${s.id} : la garde ${s.garde} n'est pas un fichier de test`);
      if (!Array.isArray(s.attendu) || s.attendu.length === 0) erreurs.push(`${s.id} : aucun cas \`attendu\``);
    } else if (!s.garde?.commande || !(s.raison instanceof RegExp)) {
      erreurs.push(`${s.id} : une garde-commande exige \`commande\` et une \`raison\` (RegExp)`);
    }
    if (!s.pourquoi || s.pourquoi.length < 40) erreurs.push(`${s.id} : \`pourquoi\` absent ou trop court`);
  }
  return erreurs;
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const debut = Date.now();
  const seulement = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');
  const catalogue = seulement ? CATALOGUE.filter((s) => seulement.includes(s.id)) : CATALOGUE;
  if (seulement && catalogue.length !== seulement.length) {
    console.error(`✖ Inconnu(s) au catalogue : ${seulement.filter((id) => !CATALOGUE.some((s) => s.id === id)).join(', ')}`);
    process.exit(1);
  }
  const erreursDeForme = verifierCatalogue(catalogue);
  if (erreursDeForme.length > 0) {
    console.error('✖ Catalogue mal formé :');
    for (const e of erreursDeForme) console.error(`  - ${e}`);
    process.exit(1);
  }

  // ── Le recensement, dans l'arbre RÉEL, en lecture seule ──────────
  const { temoins, fichiersDeTest } = recenserTemoins();
  const etatAvant = git(RACINE, ['status', '--porcelain', '--untracked-files=all']).stdout;

  // ── L'atelier, et sa disparition garantie ────────────────────────
  let atelier = null;
  const quitter = (code, message) => {
    if (message) console.error(message);
    nettoyerAtelier(atelier);
    process.exit(code);
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => quitter(130, `\n⚠️ Interrompu (${signal}) : copie retirée.`));
  process.on('uncaughtException', (e) => quitter(1, `\n✖ Exception : ${e?.stack ?? e}`));

  atelier = preparerAtelier();
  console.log(`Copie de travail : ${atelier.fichiers} fichiers dans ${atelier.base}`);
  console.log('🔴 Aucun sabotage n est écrit dans l arbre de travail : tout se joue dans cette copie.\n');

  const echecs = [];
  const rejoues = new Set(); // clés `fichier :: cas` des témoins vus rouges
  const resultats = [];

  // ── Le décor : les fichiers dont une garde a besoin pour tourner ──
  for (const s of catalogue) {
    const p = typeof s.garde === 'object' ? s.garde.precharger : null;
    if (p && !existsSync(join(atelier.copie, p.fichier))) {
      mkdirSync(dirname(join(atelier.copie, p.fichier)), { recursive: true });
      writeFileSync(join(atelier.copie, p.fichier), p.contenu, 'utf8');
    }
  }
  // Le décor fait partie de la référence : il entre dans l'index de la copie.
  git(atelier.copie, ['add', '-A']);

  // ── Chaque modification est-elle applicable ? ────────────────────
  for (const s of catalogue) {
    for (const m of s.modifs) {
      const e = verifierModif(atelier.copie, m);
      if (e) echecs.push(`${s.id} : ${e}`);
    }
  }

  // ── La référence : chaque garde, une fois, sur la copie PROPRE ───
  const references = new Map();
  const gardes = [...new Map(catalogue.map((s) => [cleDeGarde(s.garde), s.garde])).values()];
  console.log(`Référence : ${gardes.length} garde(s) jouée(s) sur la copie propre…`);
  for (const g of gardes) {
    const ref = typeof g === 'string' ? jouerVitest(atelier, g) : jouerCommande(atelier, g);
    references.set(cleDeGarde(g), ref);
    if (typeof g === 'string') {
      if (ref.panne) {
        console.log(`  ✖ ${g} : ${ref.panne}`);
        continue;
      }
      const rouges = ref.cas.filter((c) => c.statut === 'failed').length;
      console.log(`  ${rouges === 0 ? '✓' : '⚠️'} ${g} : ${ref.cas.length} cas${rouges ? `, dont ${rouges} DÉJÀ ROUGE(S) sur l arbre propre` : ''}`);
      // 🔴 Le recensement statique est confronté à ce que vitest a réellement
      // exécuté : si l'AST et le runner ne voient pas les mêmes témoins, c'est
      // le compteur qui ment, et le ratio avec lui.
      const statiques = temoins.filter((t) => t.fichier === g);
      const exacts = new Set(statiques.filter((t) => !t.gabarit).map((t) => t.cle));
      const vus = new Set(ref.cas
        .filter((c) => c.statut !== 'todo' && [...c.chemin, c.titre].some(porteLaMarque))
        .map((c) => c.cle));
      const oublies = [...exacts].filter((k) => !vus.has(k));
      const inconnus = statiques.some((t) => t.gabarit) ? [] : [...vus].filter((k) => !exacts.has(k));
      if (oublies.length || inconnus.length) {
        echecs.push(
          `recensement : ${g} — l'AST et vitest ne voient pas les mêmes témoins.\n`
            + `      absents du rapport : ${oublies.join(' | ') || '—'}\n`
            + `      absents du recensement : ${inconnus.join(' | ') || '—'}`,
        );
      }
    } else {
      console.log(`  ${ref.code === 0 ? '✓' : '⚠️'} ${nomDeGarde(g)} : sortie ${ref.code}${ref.code === 0 ? '' : ' — DÉJÀ ROUGE sur l arbre propre, seule la raison nommée tranchera'}`);
    }
  }

  // ── Les sabotages ────────────────────────────────────────────────
  console.log(`\nSabotages : ${catalogue.length}`);
  for (const s of catalogue) {
    if (echecs.some((e) => e.startsWith(`${s.id} :`))) continue; // inapplicable, déjà signalé
    process.stdout.write(`  [${s.famille === 'produit' ? 'produit  ' : 'détecteur'}] ${s.id.padEnd(34)} → ${nomDeGarde(s.garde)} … `);
    const originaux = appliquerModifs(atelier.copie, s.modifs);
    let verdict;
    try {
      const ref = references.get(cleDeGarde(s.garde));
      if (typeof s.garde === 'string') {
        verdict = jugerVitest(s.attendu, ref, jouerVitest(atelier, s.garde));
      } else {
        verdict = jugerCommande(s.raison, ref, jouerCommande(atelier, s.garde));
      }
    } finally {
      const abimes = restaurer(atelier.copie, originaux);
      if (abimes.length > 0) echecs.push(`${s.id} : la COPIE n'est pas revenue pour ${abimes.join(', ')}`);
    }
    resultats.push({ s, verdict });
    if (verdict.ok) {
      const temoinsVus = (verdict.bascules ?? []).filter((cle) => cle.split(' > ').some(porteLaMarque));
      for (const cle of temoinsVus) rejoues.add(`${s.garde} :: ${cle}`);
      process.stdout.write(`rouge ✓${temoinsVus.length ? ` (${temoinsVus.length} témoin${temoinsVus.length > 1 ? 's' : ''})` : ''}\n`);
    } else {
      process.stdout.write('✖\n');
      echecs.push(`${s.id} (${nomDeGarde(s.garde)}) :\n      ${verdict.motif}\n      Ce que la garde ne verrait plus : ${s.pourquoi}`);
    }
  }

  // ── La copie est-elle revenue à la référence ? ───────────────────
  // L'index de la copie EST la référence (aucun commit) : on compare l'arbre
  // de la copie à son index, et on cherche tout fichier né pendant le run.
  const modifies = git(atelier.copie, ['diff', '--name-only']);
  const nes = git(atelier.copie, ['ls-files', '--others', '--exclude-standard']);
  const ecarts = `${modifies.stdout ?? ''}${nes.stdout ?? ''}`.trim();
  if (modifies.status !== 0 || nes.status !== 0 || ecarts !== '') {
    echecs.push(`la copie n'est pas revenue à la référence (git, contre son index) :\n${ecarts || modifies.stderr || nes.stderr}`);
  }
  const nettoye = nettoyerAtelier(atelier);
  atelier = null;

  // ── L'arbre RÉEL n'a-t-il vraiment pas bougé ? ───────────────────
  const etatApres = git(RACINE, ['status', '--porcelain', '--untracked-files=all']).stdout;
  if (etatApres !== etatAvant) {
    echecs.push(`🔴 L'ARBRE DE TRAVAIL A CHANGÉ pendant le run, alors que ce script ne doit rien y écrire :\n${etatApres}`);
  }
  if (!existsSync(join(RACINE, 'node_modules', 'vitest', 'package.json'))) {
    echecs.push('🔴 node_modules/vitest a DISPARU du dépôt pendant le nettoyage de la copie.');
  }

  // ── Le rapport ───────────────────────────────────────────────────
  const total = temoins.length;
  const parSonNom = temoins.filter((t) => t.parSonNom).length;
  const fichiersTemoins = new Set(temoins.map((t) => t.fichier));
  const couverts = temoins.filter((t) => rejoues.has(`${t.fichier} :: ${t.cle}`)
    || (t.gabarit && [...rejoues].some((k) => k.startsWith(`${t.fichier} :: `))));
  const pct = total === 0 ? 0 : (100 * couverts.length) / total;
  const produits = resultats.filter((r) => r.s.famille === 'produit' && r.verdict.ok);
  const gardesProduit = new Set(produits.map((r) => nomDeGarde(r.s.garde)));
  const fichiersGuard = fichiersDeLArbre(RACINE, ...CHAMP).filter((f) => /[.-]guard\.(test|spec)\.(ts|tsx|mjs)$/.test(f));
  const guardsJoues = new Set(resultats.filter((r) => r.verdict.ok && typeof r.s.garde === 'string').map((r) => r.s.garde)
    .filter((g) => fichiersGuard.includes(g)));

  console.log('\n── Ratio ─────────────────────────────────────────────────────────');
  console.log(
    `Témoins du dépôt, recomptés à ce run : ${total} cas dans ${fichiersTemoins.size} fichiers `
      + `(${parSonNom} par leur propre nom, ${total - parSonNom} par le describe qui les porte),\n`
      + `  sur ${fichiersDeTest} fichiers de test de ${CHAMP.join(', ')}.`,
  );
  console.log(
    `TÉMOINS REJOUÉS : ${couverts.length} / ${total} (${pct.toFixed(1).replace('.', ',')} %) — vus ROUGES par leur nom sous un sabotage, VERTS sans lui.`,
  );
  console.log(
    `Gardes rejouées sur un défaut du PRODUIT : ${produits.length} sabotage(s), ${gardesProduit.size} garde(s).`,
  );
  console.log(`Fichiers *.guard.test.* rejoués : ${guardsJoues.size} / ${fichiersGuard.length}.`);
  const restants = new Map();
  for (const t of temoins) {
    if (couverts.includes(t)) continue;
    restants.set(t.fichier, (restants.get(t.fichier) ?? 0) + 1);
  }
  if (!seulement && restants.size > 0) {
    console.log(`Témoins JAMAIS vus rouges ici (${total - couverts.length}), par fichier :`);
    for (const [f, n] of [...restants].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`);
  }
  console.log('⚠️ Écrire « les témoins sont vérifiés » serait faux : écrire combien.');
  console.log(`Durée : ${Math.round((Date.now() - debut) / 1000)} s${nettoye ? '' : ' · ⚠️ copie laissée en place'}.`);

  if (echecs.length > 0) {
    console.error(`\n✖ ${echecs.length} problème(s) :`);
    for (const e of echecs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`\n✓ Les ${catalogue.length} sabotages du catalogue ont été VUS, chacun pour sa raison.`);
}
