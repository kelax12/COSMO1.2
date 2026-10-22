// ═══════════════════════════════════════════════════════════════════
// C-109 — douze documents de fond ne sont notés par RIEN
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Onze documents sur vingt-trois portent une note au tableau de
// bord de `docs/README.md`. Les autres — dont `SECURITY.md` et `LEGAL.md` —
// n'en ont aucune. Ils ne peuvent donc ni monter ni baisser : **rien ne
// signale qu'ils ont vieilli**.
//
// Et le cas de `SECURITY.md` montre que « déléguer la note » n'est pas
// gratuit : `faille.md` porte les FINDINGS de sécurité, pas les RÈGLES. Un
// finding qui se ferme fait monter la note ; une règle qui se périme ne coûte
// rien. La délégation est légitime, mais elle a une limite, et cette limite
// doit être écrite là où on la lit.
//
// ── CE QUE CETTE GARDE EXIGE, ET CE QU'ELLE N'EXIGE PAS ─────────────
//
// Elle exige que chaque document de `docs/` DÉCLARE son rapport à une note,
// par un marqueur en tête :
//
//   `<!-- note-audit: note=84 -->`               il porte sa propre note
//   `<!-- note-audit: couvert-par=RGPD.md -->`   une autre note le couvre
//   `<!-- note-audit: non-note -->`              personne ne le note, ET la
//                                                phrase qui suit dit pourquoi
//   `<!-- note-audit: tableau-de-bord -->`       c'est le tableau lui-même
//
// ❌ ELLE N'EXIGE PAS UNE NOTE. L'énoncé de C-109 est explicite : le
//    2026-09-16 refuse d'inventer une note sans auditer le domaine, et il a
//    raison. Cet item OUVRE l'audit, il ne le remplace pas. `non-note` est
//    une réponse honnête ; un chiffre inventé ne l'est pas — et il vivrait
//    dans un document qu'on produit en contrôle.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS : que la note est juste, ni qu'elle est
// fraîche. Elle prouve qu'on sait, pour chaque document, s'il est noté et par
// quoi. C'est le minimum qui manquait.
//
// 🔴 UNE CHAÎNE DE DÉLÉGATION EST VÉRIFIÉE : `couvert-par` doit désigner un
// document qui existe, et la chaîne ne doit pas boucler. Sans ça, deux
// documents pourraient se renvoyer l'un à l'autre et n'être notés par
// personne tout en se déclarant couverts.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const DOCS = join(RACINE, 'docs');

/** Les formes admises du marqueur. */
const FORMES = [
  { re: /^note=(\d{1,3})$/, nom: 'note' },
  { re: /^couvert-par=([A-Za-z0-9._-]+)$/, nom: 'couvert-par' },
  { re: /^non-note$/, nom: 'non-note' },
  { re: /^tableau-de-bord$/, nom: 'tableau-de-bord' },
];

/** Lit le marqueur d'un document. `null` s'il n'en a pas. */
export function lireMarqueur(texte) {
  const m = /<!--\s*note-audit:\s*([^\s][^>]*?)\s*-->/.exec(texte);
  if (!m) return null;
  const brut = m[1].trim();
  for (const f of FORMES) {
    const t = f.re.exec(brut);
    if (t) return { forme: f.nom, valeur: t[1] ?? null, brut };
  }
  return { forme: 'INCONNUE', valeur: null, brut };
}

/**
 * La phrase lisible qui suit le marqueur.
 *
 * 🔴 Elle est OBLIGATOIRE pour `non-note`. Un marqueur seul dirait « personne
 * ne le note » sans dire pourquoi, ce qui est exactement l'état qu'on vient
 * de quitter : un document sans note et sans explication.
 */
export function lirePhrase(texte) {
  return /^>\s*\*\*Note d'audit\*\*\s*—\s*(.+)$/m.exec(texte)?.[1]?.trim() ?? null;
}

export function documents(dossier = DOCS) {
  return readdirSync(dossier).filter((f) => f.endsWith('.md')).sort();
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  if (!existsSync(DOCS)) {
    console.error('docs/ introuvable.');
    process.exit(1);
  }

  const fichiers = documents();
  const erreurs = [];
  const parForme = {};
  const marqueurs = new Map();

  // 🔴 Anti-« garde qui répond sans mesurer ».
  if (fichiers.length < 10) {
    erreurs.push(`Seulement ${fichiers.length} document(s) trouvé(s) dans docs/ : le parcours est cassé.`);
  }

  for (const f of fichiers) {
    const texte = readFileSync(join(DOCS, f), 'utf8');
    const m = lireMarqueur(texte);
    if (!m) {
      erreurs.push(
        `\`docs/${f}\` n'a pas de marqueur \`<!-- note-audit: … -->\`.\n`
          + "    Un document sans rapport déclaré à une note ne peut ni monter ni\n"
          + "    baisser : rien ne signalera qu'il a vieilli.\n"
          + '    Quatre réponses possibles : `note=<n>`, `couvert-par=<doc>`, `non-note`\n'
          + '    (avec sa raison), `tableau-de-bord`.',
      );
      continue;
    }
    if (m.forme === 'INCONNUE') {
      erreurs.push(`\`docs/${f}\` : marqueur \`${m.brut}\` non reconnu.`);
      continue;
    }
    marqueurs.set(f, m);
    parForme[m.forme] = (parForme[m.forme] ?? 0) + 1;

    const phrase = lirePhrase(texte);
    if (!phrase || phrase.length < 20) {
      erreurs.push(
        `\`docs/${f}\` : marqueur \`${m.brut}\` sans phrase lisible en dessous.\n`
          + '    Le marqueur est pour la garde ; la phrase est pour qui ouvre le\n'
          + '    document. Les deux sont obligatoires.',
      );
    }
    if (m.forme === 'note') {
      const n = Number(m.valeur);
      if (!(n >= 0 && n <= 100)) erreurs.push(`\`docs/${f}\` : note ${m.valeur} hors de [0, 100].`);
    }
  }

  // ── La chaîne de délégation ─────────────────────────────────────
  for (const [f, m] of marqueurs) {
    if (m.forme !== 'couvert-par') continue;
    const cible = m.valeur;
    // `faille.md` est à la RACINE du dépôt, pas dans `docs/` : c'est la
    // source de vérité sécurité, et `CLAUDE.md` le dit.
    const existe = cible === 'faille.md'
      ? existsSync(join(RACINE, 'faille.md'))
      : existsSync(join(DOCS, cible));
    if (!existe) {
      erreurs.push(`\`docs/${f}\` se déclare couvert par \`${cible}\`, qui n'existe pas.`);
      continue;
    }
    // 🔴 La chaîne ne doit pas boucler. Deux documents qui se renverraient
    // l'un à l'autre se déclareraient couverts tout en n'étant notés par
    // personne — la garde serait verte sur exactement le défaut qu'elle
    // existe pour attraper.
    const vus = new Set([f]);
    let courant = cible;
    while (marqueurs.has(courant) && marqueurs.get(courant).forme === 'couvert-par') {
      if (vus.has(courant)) {
        erreurs.push(
          `Chaîne de couverture CIRCULAIRE : ${[...vus, courant].join(' → ')}.\n`
            + '    Ces documents se déclarent couverts les uns par les autres, donc\n'
            + '    aucun n est réellement noté.',
        );
        break;
      }
      vus.add(courant);
      courant = marqueurs.get(courant).valeur;
    }
  }

  console.log('Notes d audit · déclaration par document');
  console.log(`  ${fichiers.length} document(s) dans docs/`);
  for (const [forme, n] of Object.entries(parForme).sort()) {
    console.log(`    ${forme.padEnd(16)} ${n}`);
  }
  console.log(
    "\n⚠️ Cette garde ne dit PAS que les notes sont justes ni fraîches. Elle dit\n"
      + "   qu'on sait, pour chaque document, s'il est noté et par quoi. `non-note`\n"
      + "   est une réponse honnête : elle OUVRE un audit, elle ne le remplace pas.",
  );

  if (erreurs.length > 0) {
    console.error('\n✖ Notes d audit :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Chaque document déclare son rapport à une note.');
}
