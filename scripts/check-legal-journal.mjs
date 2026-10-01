// ═══════════════════════════════════════════════════════════════════
// C-107 (3ᵉ volet) — une modification des CGU est un CHANGEMENT DE CONTRAT
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Les CGU, la politique de confidentialité et les mentions
// légales vivent dans `src/locales/{fr,en}/legal.json`. Pour la CI, c'est un
// catalogue i18n comme un autre : `i18n:check` vérifie la parité des clés,
// `i18n:identical` les valeurs non traduites. Aucune des deux ne sait qu'une
// de ces clés porte un ENGAGEMENT CONTRACTUEL.
//
// Or une modification de fond y déclenche le préavis de 30 jours de
// l'article 11 des CGU. Ce préavis ne se déclenche pas tout seul, et rien,
// aujourd'hui, ne relie le commit au geste.
//
// CE QUE CETTE GARDE FAIT : elle fige l'empreinte de chaque catalogue légal,
// et ÉCHOUE quand elle a changé sans qu'une entrée correspondante ait été
// écrite dans `docs/LEGAL-JOURNAL.md`. Elle n'empêche pas la modification :
// elle interdit qu'elle passe inaperçue.
//
// ── CE QU'ELLE NE FAIT PAS ──────────────────────────────────────────
//
// ⚠️ Elle ne distingue pas le FOND de la FORME. Corriger une faute de frappe
// dans les CGU la fait rougir comme changer une clause. C'est délibéré : le
// tri « fond ou forme » est exactement le jugement qu'on veut voir écrit par
// un humain dans le journal, et non deviné par une expression régulière.
// Une entrée qui dit « correction de typographie, pas de préavis » coûte
// trente secondes et vaut une trace.
//
// ⚠️ Elle ne vérifie pas que le préavis a été ENVOYÉ. C'est un geste
// (`a-faire-manuel.md`), et il laisse sa trace ailleurs — la table
// `renewal_notices`, qui est une PREUVE et qu'on ne purge jamais.
//
// ❌ NE JAMAIS RECALER L'EMPREINTE SANS ÉCRIRE L'ENTRÉE. Le recalage est
//    `node scripts/check-legal-journal.mjs --update`, et il REFUSE de
//    s'exécuter tant que le journal ne porte pas la nouvelle empreinte.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const JOURNAL = join(RACINE, 'docs', 'LEGAL-JOURNAL.md');

/**
 * Les documents qui portent un engagement contractuel, UN par langue.
 *
 * 🔴 Depuis le 2026-10-01, le texte d'une langue vit dans TROIS catalogues
 * (`legal` : mentions et libellés communs, `legalTerms` : CGU,
 * `legalPrivacy` : confidentialité), chargés chacun par sa page pour tenir le
 * budget de bundle. L'empreinte porte sur leur RÉUNION : un découpage ou un
 * déplacement de clé entre eux ne la change pas, une modification de texte la
 * change toujours. C'est ce qui a permis le découpage sans recaler le journal,
 * et le témoin `scripts/check-legal-journal.guard.test.mjs` le vérifie.
 */
export const DOCUMENTS = Object.fromEntries(['fr', 'en'].map((locale) => [
  `src/locales/${locale}/{legal,legalTerms,legalPrivacy}.json`,
  ['legal', 'legalTerms', 'legalPrivacy'].map((ns) => `src/locales/${locale}/${ns}.json`),
]));

/**
 * L'empreinte d'un document (un ou plusieurs catalogues, réunis).
 *
 * ⚠️ Calculée sur le JSON RE-SÉRIALISÉ avec des clés triées, pas sur les
 * octets du fichier. Un reformatage (indentation, ordre des clés, fin de
 * ligne CRLF/LF) ne change alors pas l'empreinte : la garde rougit sur le
 * CONTENU, jamais sur la mise en forme. Sans ça, elle crierait au loup à
 * chaque passage d'un éditeur, et une garde qui crie au loup finit désarmée.
 *
 * ❌ Deux catalogues d'un même document qui portent la même section de tête
 *    font échouer le calcul : la réunion masquerait l'une des deux.
 */
export function empreinte(chemins) {
  const j = {};
  for (const chemin of [chemins].flat()) {
    const part = JSON.parse(readFileSync(chemin, 'utf8'));
    for (const [k, v] of Object.entries(part)) {
      if (k in j) throw new Error(`Section « ${k} » présente deux fois dans le document (${chemin})`);
      j[k] = v;
    }
  }
  const trier = (v) => {
    if (Array.isArray(v)) return v.map(trier);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, trier(v[k])]));
    }
    return v;
  };
  return createHash('sha256').update(JSON.stringify(trier(j))).digest('hex').slice(0, 16);
}

export function empreintesActuelles(racine = RACINE) {
  return Object.fromEntries(
    Object.entries(DOCUMENTS).map(([nom, chemins]) => [nom, empreinte(chemins.map((c) => join(racine, c)))]),
  );
}

/** Les empreintes citées par le journal, quelle que soit leur position. */
export function empreintesDuJournal(texte) {
  return new Set([...texte.matchAll(/\b([0-9a-f]{16})\b/g)].map((m) => m[1]));
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const actuelles = empreintesActuelles();

  if (!existsSync(JOURNAL)) {
    console.error(
      `✖ ${JOURNAL} absent. Ce journal est la seule trace reliant une modification\n`
        + '  contractuelle au préavis de 30 jours (CGU art. 11). Le créer, puis y\n'
        + '  inscrire les empreintes du jour :\n'
        + Object.entries(actuelles).map(([c, h]) => `    ${c} → ${h}`).join('\n'),
    );
    process.exit(1);
  }

  const texte = readFileSync(JOURNAL, 'utf8');
  const citees = empreintesDuJournal(texte);

  if (process.argv.includes('--update')) {
    // 🔴 `--update` ne recale RIEN tout seul : il vérifie que l'humain a déjà
    // écrit l'entrée. Un `--update` qui écrirait l'empreinte lui-même serait
    // la façon la plus courte de transformer cette garde en formalité.
    const absentes = Object.entries(actuelles).filter(([, h]) => !citees.has(h));
    if (absentes.length > 0) {
      console.error(
        '✖ Ces empreintes ne sont PAS dans le journal :\n'
          + absentes.map(([c, h]) => `    ${c} → ${h}`).join('\n')
          + "\n\n  Écrire d'abord l'entrée dans docs/LEGAL-JOURNAL.md : la date, ce qui a\n"
          + '  changé, si c est du FOND ou de la FORME, et si le préavis de 30 jours\n'
          + '  (CGU art. 11) est dû. Puis relancer.',
      );
      process.exit(1);
    }
    console.log('✓ Le journal cite déjà les empreintes du jour. Rien à recaler.');
    process.exit(0);
  }

  const erreurs = [];
  for (const [catalogue, h] of Object.entries(actuelles)) {
    if (!citees.has(h)) {
      erreurs.push(
        `${catalogue} : empreinte \`${h}\` absente du journal.\n`
          + '    Ce catalogue porte un engagement CONTRACTUEL. Une modification de fond\n'
          + '    déclenche le préavis de 30 jours des CGU (art. 11), et ce préavis ne se\n'
          + '    déclenche pas tout seul.\n'
          + '    ✅ Écrire une entrée dans docs/LEGAL-JOURNAL.md : date, ce qui a changé,\n'
          + '       FOND ou FORME, préavis dû ou non. Puis `npm run check:legal-journal -- --update`.',
      );
    }
  }

  // 🔴 Le contrôle anti-« garde qui répond sans mesurer » : un journal qui ne
  // citerait plus AUCUNE empreinte serait le signe que le format a changé et
  // que la garde lit à côté.
  if (citees.size === 0) {
    erreurs.push(
      'Le journal ne cite AUCUNE empreinte de 16 caractères hexadécimaux : son '
        + 'format a changé, et cette garde ne sait plus le lire.',
    );
  }

  console.log('Journal des documents contractuels');
  for (const [c, h] of Object.entries(actuelles)) {
    console.log(`  ${c.padEnd(30)} ${h}  ${citees.has(h) ? '· au journal' : '· ABSENTE'}`);
  }
  console.log(`  ${citees.size} empreinte(s) citée(s) par le journal`);

  if (erreurs.length > 0) {
    console.error('\n✖ Documents contractuels :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Chaque catalogue légal a son entrée au journal.');
}
