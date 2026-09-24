// ═══════════════════════════════════════════════════════════════════
// C-107 (3ᵉ volet) — une modification des CGU est un CHANGEMENT DE CONTRAT
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Les CGU, la politique de confidentialité et les mentions
// légales vivent dans `src/locales/{fr,en}/legal*.json`. Pour la CI, c'est un
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

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const JOURNAL = join(RACINE, 'docs', 'LEGAL-JOURNAL.md');

/** Les locales dont les documents contractuels sont publiés. */
export const LOCALES = ['fr', 'en'];

/**
 * Les catalogues qui portent un engagement contractuel, pour une locale :
 * TOUS les `src/locales/<locale>/legal*.json`.
 *
 * 🔴 DÉCOUPAGE DU 2026-09-24. Il n'y avait qu'un `legal.json` par locale ; il
 * y en a quatre (`legalShared`, `legalTerms`, `legalPrivacy`, `legalNotice`),
 * pour que chaque page ne télécharge que SON document (`src/i18n/catalog.ts`).
 * La liste est DÉCOUVERTE par préfixe, pas écrite à la main : un cinquième
 * document contractuel ajouté demain entre dans l'empreinte sans que personne
 * ait à se souvenir de cette garde.
 */
export function cataloguesDe(locale, racine = RACINE) {
  return readdirSync(join(racine, 'src', 'locales', locale))
    .filter((f) => /^legal[A-Za-z]*\.json$/.test(f))
    .sort()
    .map((f) => `src/locales/${locale}/${f}`);
}

/**
 * Les documents d'une locale, RÉUNIS en un seul objet.
 *
 * ⚠️ C'est cette réunion qu'on empreinte, et pas chaque fichier : les clés
 * racines (`back`, `updated`, `terms`, `privacy`, `notice`) sont celles de
 * l'ancien `legal.json`, donc l'empreinte d'un contenu inchangé est IDENTIQUE
 * avant et après le découpage. L'historique du journal reste comparable ligne
 * à ligne, et un déplacement de fichier ne peut pas passer pour un changement
 * de contrat (ni l'inverse).
 *
 * 🔴 Deux fichiers qui porteraient la même clé racine s'écraseraient en
 * silence dans la réunion : c'est refusé, pas arbitré.
 */
export function documentsReunis(locale, racine = RACINE) {
  const reunion = {};
  for (const c of cataloguesDe(locale, racine)) {
    const j = JSON.parse(readFileSync(join(racine, c), 'utf8'));
    for (const [cle, valeur] of Object.entries(j)) {
      if (cle in reunion) {
        throw new Error(`${c} : clé racine « ${cle} » déjà portée par un autre catalogue légal.`);
      }
      reunion[cle] = valeur;
    }
  }
  return reunion;
}

/** Libellé d'une locale dans les messages de la garde. */
export const libelle = (locale) => `src/locales/${locale}/legal*.json`;

/**
 * L'empreinte d'un contenu (les documents réunis d'une locale).
 *
 * ⚠️ Calculée sur le JSON RE-SÉRIALISÉ avec des clés triées, pas sur les
 * octets du fichier. Un reformatage (indentation, ordre des clés, fin de
 * ligne CRLF/LF) ne change alors pas l'empreinte : la garde rougit sur le
 * CONTENU, jamais sur la mise en forme. Sans ça, elle crierait au loup à
 * chaque passage d'un éditeur, et une garde qui crie au loup finit désarmée.
 */
export function empreinte(j) {
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
    LOCALES.map((l) => {
      // Une locale sans aucun catalogue légal rendrait l'empreinte de `{}` :
      // une garde qui répond sans rien mesurer. Refusé.
      if (cataloguesDe(l, racine).length === 0) {
        throw new Error(`Aucun catalogue légal trouvé pour « ${l} » (${libelle(l)}).`);
      }
      return [libelle(l), empreinte(documentsReunis(l, racine))];
    }),
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
    console.log(`  ${c.padEnd(32)} ${h}  ${citees.has(h) ? '· au journal' : '· ABSENTE'}`);
  }
  console.log(`  ${citees.size} empreinte(s) citée(s) par le journal`);

  if (erreurs.length > 0) {
    console.error('\n✖ Documents contractuels :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Chaque catalogue légal a son entrée au journal.');
}
