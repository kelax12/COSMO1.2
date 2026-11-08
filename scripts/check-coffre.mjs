// ═══════════════════════════════════════════════════════════════════
// check-coffre.mjs · le coffre est-il vérifié chaque trimestre ? (V4.2, SEC-04)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Le coffre (docs/SECURITY.md, § Coffre) garde ce qu'aucune console ne rend
// deux fois : la phrase qui déchiffre les sauvegardes, les codes de
// récupération du second facteur de chaque compte, la sortie de secours de la
// console admin. Un coffre se remplit une fois et se périme en silence : un
// code de récupération consommé, un compte dont le second facteur a changé,
// une personne de confiance qui ne répond plus. Le jour où on en a besoin est
// le pire jour pour le découvrir.
//
// CE QUE CETTE GARDE EXIGE, dans `.github/coffre-verifications.json` :
//   1. une vérification datée de moins de `periodeJours` (92) jours ; tant
//      qu'aucune n'est consignée, la `premiereEcheance` fait foi ;
//   2. la dernière vérification couvre CHAQUE élément exigé (liste ci-dessous
//      + tout secret du registre marqué `coffre: true`) ;
//   3. aucune date dans le futur, aucun identifiant inconnu, aucune forme de
//      valeur dans le journal.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS : que le coffre contienne bien ce qu'on y a
// rangé. Elle prouve qu'une personne a DIT l'avoir vérifié, à telle date, élément
// par élément. La vérification elle-même (ouvrir le coffre, tester un code,
// joindre la personne de confiance) reste humaine : c'est son rappel qui est
// automatique.
//
// ❌ NE JAMAIS dater une vérification qui n'a pas eu lieu pour faire passer la CI.
// ❌ NE JAMAIS relever `periodeJours` : c'est la borne, pas un réglage.
//
// Rouge = issue `calendrier-red` (gardes-calendrier.yml), jamais un job bloquant.
// Témoin : scripts/check-coffre.guard.test.mjs
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contientUneValeur } from './check-secrets-age.mjs';

const RACINE = process.cwd();
const JOUR = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PERIODE_MAX_JOURS = 92;
export const JOURNAL = '.github/coffre-verifications.json';
export const REGISTRE = '.github/secrets-registry.json';

/**
 * Les éléments qui doivent être au coffre, hors secrets du registre. Des
 * identifiants, jamais des valeurs. Les secrets `coffre: true` du registre
 * s'y ajoutent par leur nom.
 */
export const ELEMENTS_EXIGES = [
  'mfa-github',
  'mfa-supabase',
  'mfa-vercel',
  'mfa-stripe',
  'mfa-hebergeur-courrier',
  'admin-aal2',
  'admin-aal2-sortie',
  'acces-urgence',
];

const dateUtc = (d) => Date.parse(`${d}T00:00:00Z`);

/** Les éléments exigés pour un registre donné. */
export function elementsExiges(registre) {
  const duRegistre = (registre?.entries ?? []).filter((e) => e.coffre === true).map((e) => e.name);
  return [...new Set([...duRegistre, ...ELEMENTS_EXIGES])];
}

/**
 * Le cœur, pur. Rend { erreurs, resume }.
 * `journal` : contenu du fichier de vérifications ; `registre` : secrets-registry.json.
 */
export function evaluerCoffre({ journal, registre, maintenant }) {
  const erreurs = [];
  const resume = [];
  if (!journal || typeof journal !== 'object') return { erreurs: ['journal du coffre illisible'], resume };

  const periode = journal.periodeJours;
  if (!Number.isInteger(periode) || periode < 1) erreurs.push('`periodeJours` doit être un entier positif');
  else if (periode > PERIODE_MAX_JOURS) {
    erreurs.push(`\`periodeJours\` vaut ${periode} : la borne est ${PERIODE_MAX_JOURS} jours (trimestrielle), elle ne se relève pas`);
  }
  const bornePeriode = Number.isInteger(periode) && periode >= 1 ? Math.min(periode, PERIODE_MAX_JOURS) : PERIODE_MAX_JOURS;

  if (!DATE.test(journal.premiereEcheance ?? '')) erreurs.push('`premiereEcheance` doit être AAAA-MM-JJ');
  const verifs = Array.isArray(journal.verifications) ? journal.verifications : null;
  if (!verifs) return { erreurs: [...erreurs, '`verifications` doit être une liste'], resume };

  const exiges = elementsExiges(registre);
  const connus = new Set(exiges);
  for (const [i, v] of verifs.entries()) {
    const id = `vérification n° ${i + 1}`;
    if (!DATE.test(v?.date ?? '')) { erreurs.push(`${id} : date absente ou pas AAAA-MM-JJ`); continue; }
    if (dateUtc(v.date) > maintenant.getTime() + JOUR) erreurs.push(`${id} : datée dans le futur (${v.date})`);
    if (typeof v.par !== 'string' || !v.par.trim()) erreurs.push(`${id} : \`par\` (qui a vérifié) manquant`);
    if (!Array.isArray(v.elements) || v.elements.length === 0) {
      erreurs.push(`${id} : \`elements\` (ce qui a été vérifié) manquant`);
      continue;
    }
    for (const el of v.elements) {
      if (!connus.has(el)) erreurs.push(`${id} : élément inconnu « ${el} »`);
    }
    if (contientUneValeur(JSON.stringify(v))) erreurs.push(`${id} : ressemble à une VALEUR de secret, jamais ici`);
  }

  const datees = verifs.filter((v) => DATE.test(v?.date ?? '')).sort((a, b) => dateUtc(a.date) - dateUtc(b.date));
  const derniere = datees.at(-1);
  if (derniere) {
    const manquants = exiges.filter((el) => !(derniere.elements ?? []).includes(el));
    if (manquants.length) {
      erreurs.push(`dernière vérification (${derniere.date}) incomplète, il manque : ${manquants.join(', ')}`);
    }
    const age = Math.floor((maintenant.getTime() - dateUtc(derniere.date)) / JOUR);
    resume.push(`dernière vérification ${derniere.date} (${age} j, borne ${bornePeriode} j)`);
    if (age > bornePeriode) {
      erreurs.push(`dernière vérification du ${derniere.date} : ${age} j, borne ${bornePeriode} j. Vérifier le coffre (docs/SECURITY.md, § Coffre) et la consigner.`);
    }
  } else if (DATE.test(journal.premiereEcheance ?? '')) {
    const retard = Math.floor((maintenant.getTime() - dateUtc(journal.premiereEcheance)) / JOUR);
    resume.push(`aucune vérification consignée, première échéance ${journal.premiereEcheance}`);
    if (retard > 0) {
      erreurs.push(`aucune vérification du coffre consignée, première échéance dépassée de ${retard} j (${journal.premiereEcheance}). Vérifier le coffre (docs/SECURITY.md, § Coffre) et la consigner.`);
    }
  }
  return { erreurs, resume };
}

export function verifier(racine = RACINE, maintenant = new Date()) {
  let journal;
  let registre;
  try {
    journal = JSON.parse(readFileSync(resolve(racine, JOURNAL), 'utf8'));
  } catch (e) {
    return { erreurs: [`${JOURNAL} illisible (${e.message})`], resume: [] };
  }
  try {
    registre = JSON.parse(readFileSync(resolve(racine, REGISTRE), 'utf8'));
  } catch (e) {
    return { erreurs: [`${REGISTRE} illisible (${e.message})`], resume: [] };
  }
  return evaluerCoffre({ journal, registre, maintenant });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { erreurs, resume } = verifier();
  for (const l of resume) console.log(`· ${l}`);
  if (erreurs.length) {
    console.error(`\n✖ ${erreurs.length} écart(s) :`);
    for (const e of erreurs) console.error(`  · ${e}`);
    if (process.env.GITHUB_ACTIONS === 'true') {
      for (const e of erreurs) console.log(`::error title=coffre · vérification trimestrielle::${e}`);
    }
    process.exit(1);
  }
  console.log('\n✔ coffre vérifié dans sa période');
}
