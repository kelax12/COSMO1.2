// ═══════════════════════════════════════════════════════════════════
// i18n-quality.mjs · ce que les autres gardes i18n ne lisent pas (AM-1)
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `i18n:check` compare des CLES, `i18n:identical` des COPIES, `i18n:pages`
// des VOLUMES et des FORMES. Une traduction FAUSSE MAIS DIFFERENTE les passe
// toutes sans un bruit : c'est l'angle mort AM-1 de `docs/I18N.md`, nommé le
// 2026-09-16 et refermé seulement par des relectures humaines (`M-50`), que
// rien ne rejoue.
//
// Ce script ne prétend pas juger la qualité d'une phrase. Il mesure deux
// choses qu'un script PEUT voir, et qu'une relecture laisse revenir :
//
//   1. GLOSSAIRE ÉPINGLÉ · le vocabulaire produit. Quand la source `fr`
//      contient un terme du glossaire (« tâche », « objectif »…), la valeur
//      `en` de la même clé doit contenir le terme anglais épinglé. C'est la
//      dérive que `M-50` a corrigée à la main le 2026-10-16 (« Agenda » et
//      « Calendar », « Goal » et « Objective » dans le même écran) ;
//   2. FRANÇAIS RESTÉ DANS `en` · accents et guillemets français, mots outils
//      (« le, la, des, pour »…), verbes d'interface (« Supprimer »…) dans une
//      valeur anglaise. `i18n:identical` ne voit qu'une valeur ENTIÈREMENT
//      recopiée ; une phrase à moitié traduite lui échappe.
//
// Les exceptions sont DÉCLARÉES une par une dans
// `i18n-quality-allowlist.json`, avec une justification, et VÉRIFIÉES comme
// celles d'`i18n:identical` : une entrée dont la clé a disparu, qui ne
// déclenche plus rien, ou dont la valeur épinglée a changé fait ÉCHOUER la
// garde. Sans la valeur épinglée, réécrire une phrase hériterait en silence
// de la dispense accordée à l'ancienne.
//
// 🔴 CE QU'ELLE NE PROUVE PAS : qu'une phrase anglaise dit la même chose que
// la française. « Delete the task » pour « Terminer la tâche » passe. Ça
// reste une relecture humaine (`M-50`).
//
// Usage :  node scripts/i18n-quality.mjs [--list]
// Sortie : 1 si un écart non déclaré existe, si l'allowlist est périmée, ou
//          si la garde n'a rien lu ; 0 sinon.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LOCALES_DIR = 'src/locales';
export const ALLOWLIST = 'scripts/i18n-quality-allowlist.json';

/** Une lettre, accents compris : la frontière d'un mot français. */
const L = String.raw`\p{L}`;

/**
 * Le glossaire épinglé. `fr` : le terme source, avec ses variantes de
 * nombre et d'accent ; `en` : le terme anglais exigé, cherché comme RADICAL
 * (« task » couvre « subtask », « categor » couvre « Uncategorized »).
 *
 * ⚠️ « entreprise » n'y est PAS, et c'est voulu : il se traduit légitimement
 * par « organization », « company » ou « business » selon qu'on parle de la
 * structure, du mode ou de l'offre. Un terme qui n'a pas UNE traduction ne
 * s'épingle pas.
 */
export const GLOSSAIRE = [
  { terme: 'tâche', fr: String.raw`t[âa]ches?`, en: /task/i, attendu: 'task' },
  { terme: 'habitude', fr: String.raw`habitudes?`, en: /habit/i, attendu: 'habit' },
  { terme: 'objectif', fr: String.raw`objectifs?`, en: /objective/i, attendu: 'objective' },
  { terme: 'résultat clé', fr: String.raw`r[ée]sultats?[\s-]+cl[ée]s?`, en: /key[\s-]results?/i, attendu: 'key result' },
  { terme: 'agenda', fr: String.raw`agendas?`, en: /calendar/i, attendu: 'calendar' },
  { terme: 'catégorie', fr: String.raw`cat[ée]gories?`, en: /categor/i, attendu: 'category' },
  { terme: 'équipe', fr: String.raw`[ée]quipes?`, en: /team/i, attendu: 'team' },
  { terme: 'projet', fr: String.raw`projets?`, en: /project/i, attendu: 'project' },
].map((g) => ({ ...g, frRe: new RegExp(String.raw`(?<![${L}])(?:${g.fr})(?![${L}])`, 'iu') }));

/** Accents et guillemets français, absents d'un texte anglais ordinaire. */
const ACCENTS = /[àâäçéèêëîïôöùûüÿœæ«»]/giu;

/**
 * Mots français SANS homographe anglais courant. « son », « plus », « on »,
 * « a », « fin » ou « date » n'y sont pas : ils lèveraient l'anglais lui-même.
 */
export const MOTS_FRANCAIS = [
  // mots outils
  'le', 'la', 'les', 'des', 'du', 'une', 'un', 'de', 'au', 'aux', 'et', 'ou',
  'pour', 'avec', 'dans', 'sur', 'sous', 'chez', 'sans', 'vers', 'selon',
  'est', 'sont', 'pas', 'ne', 'se', 'ce', 'cet', 'cette', 'ces', 'il', 'elle',
  'vous', 'votre', 'vos', 'nous', 'notre', 'qui', 'que', 'mais', 'donc', 'puis',
  'lors', 'leur', 'leurs', 'ses', 'sa', 'tout', 'tous', 'toutes', 'aucun',
  'aucune', 'aussi', 'encore', 'depuis', 'pendant', 'jusqu', 'toujours',
  'jamais', 'trop', 'peu', 'bien', 'rien', 'chaque', 'plusieurs', 'autre',
  'autres', 'parce', 'quand',
  // vocabulaire d'interface
  'ajouter', 'supprimer', 'annuler', 'enregistrer', 'modifier', 'fermer',
  'valider', 'rechercher', 'choisir', 'voir', 'faire', 'aujourd', 'demain',
  'semaine', 'jours', 'mois', 'membres', 'heures', 'nouveau', 'nouvelle',
  'oui', 'merci', 'bonjour', 'erreur', 'chargement',
];
const MOTS_RE = new RegExp(
  String.raw`(?<![${L}'’-])(${MOTS_FRANCAIS.join('|')})(?![${L}'’-])`,
  'giu',
);

/** Aplatit un catalogue JSON en `Map<'a.b.c', 'valeur'>`. */
export function aplatir(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      aplatir(value, path, out);
    } else if (typeof value === 'string') {
      out.set(path, value);
    }
  }
  return out;
}

/**
 * Ce qu'une valeur `en` contient de français. Les variables `{{x}}`, les
 * cibles de liens Markdown et les URL sont retirées d'abord : un chemin
 * `/fr/aide` n'est pas une phrase.
 * @returns {string[]} les indices trouvés, triés et dédoublonnés
 */
export function detecterFrancais(valeur) {
  const texte = valeur
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/(?:https?:\/\/|mailto:)\S+/g, ' ');
  const indices = new Set();
  for (const m of texte.matchAll(ACCENTS)) indices.add(m[0].toLowerCase());
  for (const m of texte.matchAll(MOTS_RE)) indices.add(m[1].toLowerCase());
  return [...indices].sort();
}

/**
 * Les termes du glossaire présents dans `fr` et absents de `en`.
 * @returns {string[]} les termes manquants (noms du glossaire)
 */
export function termesManquants(fr, en) {
  return GLOSSAIRE.filter((g) => g.frRe.test(fr) && !g.en.test(en)).map((g) => g.terme);
}

/** Lit les couples (fr, en) de tous les namespaces présents des deux côtés. */
export function lireCouples(racine = '.') {
  const dir = join(racine, LOCALES_DIR);
  const lire = (locale, file) => aplatir(JSON.parse(readFileSync(join(dir, locale, file), 'utf8')));
  const couples = [];
  for (const file of readdirSync(join(dir, 'fr')).filter((f) => f.endsWith('.json')).sort()) {
    if (!existsSync(join(dir, 'en', file))) continue;
    const ns = file.replace(/\.json$/, '');
    const fr = lire('fr', file);
    const en = lire('en', file);
    for (const [key, valeurEn] of en) {
      couples.push({ id: `${ns}.${key}`, fr: fr.get(key), en: valeurEn });
    }
  }
  return couples;
}

const ARGUMENT_MIN = 20;

/**
 * Le verdict, sans effet de bord.
 * @param {{ id: string, fr: string | undefined, en: string }[]} couples
 * @param {{ glossaire?: object, francais?: object }} allow
 */
export function juger(couples, allow = {}) {
  const decGlossaire = new Map(Object.entries(allow.glossaire ?? {}));
  const decFrancais = new Map(Object.entries(allow.francais ?? {}));
  const glossaire = [];
  const francais = [];
  const perimees = [];
  const vus = { glossaire: new Set(), francais: new Set() };
  const parTerme = Object.fromEntries(GLOSSAIRE.map((g) => [g.terme, { occurrences: 0, ecarts: 0 }]));
  let valeursEn = 0;

  for (const { id, fr, en } of couples) {
    valeursEn++;
    if (typeof fr === 'string') {
      for (const g of GLOSSAIRE) if (g.frRe.test(fr)) parTerme[g.terme].occurrences++;
      const manquants = termesManquants(fr, en);
      if (manquants.length) {
        for (const t of manquants) parTerme[t].ecarts++;
        const dec = decGlossaire.get(id);
        if (dec) {
          vus.glossaire.add(id);
          if (dec.fr !== fr) perimees.push([id, `glossaire : valeur fr épinglée ${JSON.stringify(dec.fr)} ≠ ${JSON.stringify(fr)}`]);
          else if (JSON.stringify([...(dec.termes ?? [])].sort()) !== JSON.stringify([...manquants].sort())) {
            perimees.push([id, `glossaire : termes déclarés ${JSON.stringify(dec.termes)} ≠ manquants ${JSON.stringify(manquants)}`]);
          }
        } else {
          glossaire.push({ id, termes: manquants, fr, en });
        }
      }
    }
    const indices = detecterFrancais(en);
    if (indices.length) {
      const dec = decFrancais.get(id);
      if (dec) {
        vus.francais.add(id);
        if (dec.en !== en) perimees.push([id, `français : valeur en épinglée ${JSON.stringify(dec.en)} ≠ ${JSON.stringify(en)}`]);
        else if (JSON.stringify([...(dec.indices ?? [])].sort()) !== JSON.stringify(indices)) {
          perimees.push([id, `français : indices déclarés ${JSON.stringify(dec.indices)} ≠ trouvés ${JSON.stringify(indices)}`]);
        }
      } else {
        francais.push({ id, indices, en });
      }
    }
  }

  for (const [section, decs] of [['glossaire', decGlossaire], ['francais', decFrancais]]) {
    for (const [id, dec] of decs) {
      if (typeof dec?.pourquoi !== 'string' || dec.pourquoi.trim().length < ARGUMENT_MIN) {
        perimees.push([id, `${section} : justification absente ou trop courte (${ARGUMENT_MIN} caractères minimum)`]);
      }
      if (!vus[section].has(id)) {
        perimees.push([id, `${section} : la clé n'existe plus, ou ne déclenche plus rien`]);
      }
    }
  }

  return { valeursEn, parTerme, glossaire, francais, perimees };
}

function main() {
  const lister = process.argv.includes('--list');
  const allow = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : {};
  const v = juger(lireCouples('.'), allow);

  console.log(`i18n:quality · ${v.valeursEn} valeurs en lues`);
  for (const [terme, { occurrences, ecarts }] of Object.entries(v.parTerme)) {
    console.log(`  glossaire « ${terme} » : ${occurrences} source(s) fr, ${ecarts} sans le terme épinglé`);
  }

  // Une garde qui sort 0 sans avoir rien lu ne se distingue pas d'une garde
  // qui a tout vérifié.
  const vide = v.valeursEn === 0 || Object.values(v.parTerme).every((t) => t.occurrences === 0);
  if (vide) console.error('✖ rien lu : aucun catalogue, ou aucun terme du glossaire dans fr');

  if (v.glossaire.length) {
    console.error(`✖ ${v.glossaire.length} valeur(s) en sans le terme épinglé du glossaire`);
    if (lister) {
      for (const e of v.glossaire) {
        console.error(`  ${e.id} [${e.termes.join(', ')}]\n    fr: ${JSON.stringify(e.fr)}\n    en: ${JSON.stringify(e.en)}`);
      }
    }
  }
  if (v.francais.length) {
    console.error(`✖ ${v.francais.length} valeur(s) en contenant du français`);
    if (lister) {
      for (const e of v.francais) console.error(`  ${e.id} [${e.indices.join(', ')}] = ${JSON.stringify(e.en)}`);
    }
  }
  if (v.perimees.length) {
    console.error(`✖ ${v.perimees.length} entrée(s) d'allowlist périmée(s) (${ALLOWLIST})`);
    for (const [id, raison] of v.perimees) console.error(`  ${id} : ${raison}`);
  }
  if ((v.glossaire.length || v.francais.length) && !lister) {
    console.error('  `npm run i18n:quality -- --list` dit lesquelles.');
  }

  const rouge = vide || v.glossaire.length || v.francais.length || v.perimees.length;
  if (!rouge) {
    const declares = Object.keys(allow.glossaire ?? {}).length + Object.keys(allow.francais ?? {}).length;
    console.log(`✔ glossaire tenu, aucun français dans en (${declares} exception(s) déclarée(s))`);
  }
  process.exit(rouge ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
