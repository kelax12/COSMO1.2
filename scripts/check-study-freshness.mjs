// ═══════════════════════════════════════════════════════════════════
// C-108 — une ÉTUDE périme sans que rien ne le signale
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. `docs/MIGRATION-REACT19.md` est écrite le 2026-09-03 CONTRE
// LES VERSIONS DE CE JOUR-LÀ : composants shadcn audités ref par ref,
// chiffrage de l'effort, chronologie CVE reconstituée version par version.
// Tout cela décrit un instant. Dependabot alerte sur une vulnérabilité
// DÉCLARÉE ; il ne dira jamais « React 18 approche de sa fin de support »,
// qui est pourtant l'argument central de l'étude.
//
// Une étude périmée est plus coûteuse qu'une étude absente : on la relit, on
// la croit, et on décide sur un état du monde qui n'existe plus. C'est la
// même famille que les « avant » recopiés au lieu d'être relus
// (`CLAUDE.md` → Documentation).
//
// CE QUE CETTE GARDE FAIT : elle fige les versions CONTRE LESQUELLES l'étude
// a été écrite, et échoue quand l'une d'elles a changé de MAJEURE, en nommant
// laquelle et ce que ce changement invalide dans le document.
//
// ── CE QU'ELLE NE FAIT PAS, ET IL FAUT LE DIRE ──────────────────────
//
// ❌ Elle ne mesure PAS le coût de NE PAS migrer. C'est le volet non
//    outillable de l'item, et il reste entier : il se compte en incidents,
//    pas en garde. L'étude le dit elle-même.
// ❌ Elle ne surveille pas la fin de support amont : aucune API ne la publie
//    sous une forme stable, et une garde qui interrogerait un site web
//    tomberait au premier changement de page.
// ⚠️ Elle regarde la MAJEURE, pas la mineure. Une étude qui rougirait à
//    chaque patch serait désarmée en une semaine.
//
// ❌ NE JAMAIS METTRE À JOUR `ETUDES` POUR FAIRE PASSER LA CI. Le rouge dit
//    que le document doit être relu, pas que le chiffre est mauvais. La
//    séquence est : relire l'étude, la corriger ou l'archiver, PUIS recaler.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();

/**
 * Les études du dépôt, et l'état du monde contre lequel chacune est écrite.
 *
 * `paquets` : nom → majeure au moment de l'écriture.
 * `invalide` : ce que le document affirme et qui cesse d'être vrai si cette
 *              majeure bouge. C'est ce qu'on lit quand la garde rougit.
 */
const ETUDES = [
  {
    doc: 'docs/MIGRATION-REACT19.md',
    ecrite_le: '2026-09-03',
    paquets: {
      react: 18,
      'react-dom': 18,
      'react-router': 7,
      '@types/react': 18,
      '@types/react-dom': 18,
    },
    invalide:
      "l'étude audite les composants shadcn « ref par ref » CONTRE React 18 et "
      + '`react-router` 7, chiffre l\'effort de migration depuis ces versions, et '
      + 'reconstitue une chronologie CVE qui s\'arrête à `react-router@7.18.2`. '
      + 'Si une de ces majeures a bougé, la migration est faite ou entamée : le '
      + "document décrit alors un projet qui n'existe plus, et il doit être "
      + 'archivé (`docs/archive/**`), pas relu comme état courant.',
  },
];

/** La majeure d'une plage semver (`^18.3.1` → 18). */
export function majeure(plage) {
  const m = /(\d+)/.exec(String(plage ?? ''));
  return m ? Number(m[1]) : null;
}

export function verifier(racine = RACINE) {
  const pkg = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));
  const toutes = { ...pkg.dependencies, ...pkg.devDependencies };
  const ecarts = [];
  const absents = [];
  const docsManquants = [];
  let comparaisons = 0;

  for (const etude of ETUDES) {
    if (!existsSync(join(racine, etude.doc))) {
      docsManquants.push(etude.doc);
      continue;
    }
    for (const [paquet, attendue] of Object.entries(etude.paquets)) {
      const plage = toutes[paquet];
      if (plage === undefined) {
        // 🔴 Un paquet cité par l'étude et DISPARU de `package.json` est aussi
        // une péremption — et la garde ne doit pas se taire dessus, sinon le
        // retrait d'une dépendance ferait baisser en silence le nombre de
        // comparaisons réellement faites.
        absents.push({ doc: etude.doc, paquet });
        continue;
      }
      comparaisons += 1;
      const reelle = majeure(plage);
      if (reelle !== attendue) {
        ecarts.push({ doc: etude.doc, paquet, attendue, reelle, plage, invalide: etude.invalide });
      }
    }
  }
  return { ecarts, absents, docsManquants, comparaisons };
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const { ecarts, absents, docsManquants, comparaisons } = verifier();
  const attendues = ETUDES.reduce((n, e) => n + Object.keys(e.paquets).length, 0);

  console.log('Fraîcheur des études');
  for (const e of ETUDES) console.log(`  ${e.doc} — écrite le ${e.ecrite_le}`);
  console.log(`  ${comparaisons} comparaison(s) faite(s) sur ${attendues} attendue(s)`);

  const erreurs = [];

  // 🔴 Le contrôle anti-« garde qui répond sans mesurer » : si aucune
  // comparaison n'a eu lieu, un « ✓ » ne voudrait rien dire.
  if (comparaisons === 0) {
    erreurs.push('AUCUNE comparaison effectuée : la garde ne mesure rien.');
  }
  for (const d of docsManquants) {
    erreurs.push(`${d} n'existe plus : retirer son entrée de ETUDES, ou restaurer le document.`);
  }
  for (const a of absents) {
    erreurs.push(
      `${a.paquet} est cité par ${a.doc} et absent de package.json : l'étude parle `
        + "d'une dépendance qui n'est plus là.",
    );
  }
  for (const e of ecarts) {
    erreurs.push(
      `${e.paquet} : majeure ${e.reelle} (\`${e.plage}\`), l'étude est écrite contre la ${e.attendue}.\n`
        + `    ${e.doc} : ${e.invalide}`,
    );
  }

  if (erreurs.length > 0) {
    console.error('\n✖ Une étude décrit un état du monde qui a changé :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    console.error(
      '  ❌ Ne pas recaler ETUDES pour faire passer la CI : relire l étude d abord,'
        + '\n     la corriger ou l archiver, PUIS recaler.',
    );
    process.exit(1);
  }
  console.log('\n✓ Chaque étude décrit encore les versions installées.');
}
