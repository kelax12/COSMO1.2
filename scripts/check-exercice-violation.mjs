// ═══════════════════════════════════════════════════════════════════
// M-49: un chemin de récupération qu'on n'a pas parcouru est une hypothèse
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. La procédure de violation (art. 33, 72 h) se parcourt en
// situation de panique. Elle n'avait jamais été jouée, même à blanc : le
// premier passage réel (BK-1, 2026-10-13) a révélé qu'elle n'avait pas de
// minuterie.
//
// CE QUE CETTE GARDE EXIGE, dans `docs/RGPD-VIOLATION.md` :
//
//   1. au moins un exercice daté dans « ## Exercice à blanc », et le plus
//      récent a moins de 12 mois (et n'est pas dans le futur) ;
//   2. chaque « trou » consigné porte un état (corrigé, ou ouvert avec son item) ;
//   3. TOUT lien `.md` du document (et son ancre) existe ;
//   4. TOUTE commande `npm run X` citée existe dans `package.json`, et
//      `verify_payment_chain` existe dans une migration ;
//   5. chaque gabarit exigé existe sous son titre dans
//      `docs/RGPD-VIOLATION-GABARITS.md`.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS : qu'un exercice a réellement eu lieu, ni qu'il
// a été fait par la bonne personne. Elle prouve qu'il est CONSIGNÉ, récent, et
// que la matière qu'il manipule (liens, commandes, gabarits) EXISTE encore.
//
// ❌ NE JAMAIS dater un exercice qui n'a pas eu lieu pour faire passer la CI.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

const RACINE = process.cwd();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const VALIDITE_MOIS = 12;
export const DOC = 'docs/RGPD-VIOLATION.md';
export const GABARITS = 'docs/RGPD-VIOLATION-GABARITS.md';

/** Les gabarits que la procédure appelle, par titre (`##`). */
export const GABARITS_EXIGES = [
  'Chronologie horodatée',
  'Rappel de l\'échéance de 72 h',
  'Qualification en six questions',
  'Message aux personnes concernées',
  'Message à l\'organisation cliente',
  'Ligne du registre',
];

export function slug(titre) {
  return titre
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

export function titres(texte) {
  return [...texte.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim());
}

/** Les lignes du tableau d'une section `## <titre>` : cellules sans les bords. */
export function lignesDeSection(texte, titre) {
  const re = new RegExp(`^##\\s+${titre}`, 'm');
  const debut = texte.search(re);
  if (debut < 0) return null;
  const out = [];
  for (const l of texte.slice(debut).split(/\r?\n/).slice(1)) {
    if (/^##\s/.test(l)) break;
    if (l.startsWith('|')) out.push(l.split('|').slice(1, -1).map((x) => x.trim()));
  }
  return out;
}

export function verifier(racine = RACINE, maintenant = new Date()) {
  const erreurs = [];
  const resume = [];
  const chemin = join(racine, DOC);
  if (!existsSync(chemin)) return { erreurs: [`\`${DOC}\` introuvable.`], resume };
  const texte = readFileSync(chemin, 'utf8');

  // 1 · l'exercice daté
  const exos = lignesDeSection(texte, 'Exercice à blanc');
  if (exos === null) {
    erreurs.push('Section « ## Exercice à blanc » absente.');
  } else {
    const dates = exos.map((c) => c[0]).filter((d) => DATE.test(d)).sort();
    if (!dates.length) {
      erreurs.push('Aucun exercice daté dans « Exercice à blanc » : une procédure jamais parcourue est une hypothèse.');
    } else {
      const dernier = dates[dates.length - 1];
      const limite = new Date(`${dernier}T00:00:00Z`);
      limite.setUTCMonth(limite.getUTCMonth() + VALIDITE_MOIS);
      if (Date.parse(`${dernier}T00:00:00Z`) > maintenant.getTime() + 86_400_000) {
        erreurs.push(`Exercice daté dans le futur (${dernier}).`);
      } else if (limite.getTime() < maintenant.getTime()) {
        erreurs.push(`Dernier exercice du ${dernier} : plus de ${VALIDITE_MOIS} mois. Rejouer l'exercice et le consigner.`);
      }
      resume.push(`dernier exercice ${dernier}`);
    }
  }

  // 2 · les trous ont un état
  const trous = lignesDeSection(texte, 'Trous trouvés par l\'exercice');
  if (trous === null) {
    erreurs.push('Section « ## Trous trouvés par l\'exercice » absente.');
  } else {
    const donnees = trous.filter((c) => /^T-\d+/.test(c[0]));
    for (const c of donnees) if (!(c[3] ?? '').length) erreurs.push(`Trou ${c[0]} sans état (corrigé, ou ouvert avec son item).`);
    resume.push(`${donnees.length} trou(s) consigné(s)`);
  }

  // 3 · les liens et leurs ancres
  let nLiens = 0;
  for (const m of texte.matchAll(/\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/g)) {
    if (/^[a-z]+:\/\//i.test(m[1])) continue;
    nLiens += 1;
    const cible = resolve(dirname(chemin), m[1]);
    if (!existsSync(cible)) {
      erreurs.push(`Lien mort : ${m[1]}`);
    } else if (m[2]) {
      const ancre = m[2].slice(1);
      if (!titres(readFileSync(cible, 'utf8')).some((t) => slug(t) === ancre)) erreurs.push(`Ancre morte : ${m[1]}${m[2]}`);
    }
  }
  if (nLiens < 3) erreurs.push(`Seulement ${nLiens} lien(s) .md trouvé(s) : l'analyse est cassée.`);

  // 4 · les commandes
  const pkg = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  let nCmd = 0;
  for (const m of texte.matchAll(/npm run ([a-z0-9:-]+)/g)) {
    nCmd += 1;
    if (!pkg.scripts?.[m[1]]) erreurs.push(`Commande citée absente de package.json : npm run ${m[1]}`);
  }
  if (nCmd < 1) erreurs.push('Aucune commande `npm run` citée : l\'analyse est cassée.');
  const migs = join(racine, 'supabase/migration');
  const sql = readdirSync(migs).filter((f) => f.endsWith('.sql'));
  if (!sql.some((f) => readFileSync(join(migs, f), 'utf8').includes('verify_payment_chain'))) {
    erreurs.push('`verify_payment_chain` n\'existe dans aucune migration.');
  }

  // 5 · les gabarits
  const g = join(racine, GABARITS);
  if (!existsSync(g)) {
    erreurs.push(`\`${GABARITS}\` introuvable : la procédure appelle des gabarits qui n'existent pas.`);
  } else {
    const ts = titres(readFileSync(g, 'utf8'));
    for (const exige of GABARITS_EXIGES) {
      if (!ts.some((t) => t.includes(exige))) erreurs.push(`Gabarit manquant : « ${exige} »`);
    }
  }
  resume.push(`${nLiens} liens, ${nCmd} commandes, ${GABARITS_EXIGES.length} gabarits vérifiés`);
  return { erreurs, resume };
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const { erreurs, resume } = verifier();
  for (const r of resume) console.log(`✔ ${r}`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`❌ ${e}`);
    process.exit(1);
  }
  console.log('Exercice de violation à jour.');
}
