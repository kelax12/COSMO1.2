// Que contient le chunk d'ENTRÉE ? — l'outil qui manquait pour agir sur le budget.
//
// `npm run check:bundle` dit QUE le budget dérive ; il ne dit pas D'OÙ. Le chunk
// d'entrée est passé de 87,2 à 106,9 ko gzip en deux jours (2026-08-25 → 27)
// sans que personne puisse nommer le coupable, et le plafond a été relevé de 92
// à 112 ko pour l'absorber — le seul plafond de ce dépôt qu'on ait jamais
// remonté. Un budget qu'on ne sait pas expliquer finit toujours par être relevé.
//
// Ce script rejoue le build en mémoire avec un plugin d'analyse et imprime les
// modules de l'entrée, du plus gros au plus petit.
//
//   node scripts/analyze-entry.mjs            # top 30
//   node scripts/analyze-entry.mjs --all      # tout
//   node scripts/analyze-entry.mjs --chunk vendor-utils
//
// ⚠️ Les tailles sont en octets NON compressés (`renderedLength`) : c'est ce que
// Rollup connaît. Le rapport sert à comparer des modules entre eux, pas à
// prédire un gzip. Le chiffre qui fait foi reste celui de `check:bundle`, qui
// mesure le fichier réellement écrit.

import { build } from 'vite';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
};

const target = value('chunk');
const collected = [];

const reporter = {
  name: 'cosmo-entry-report',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue;
      const isTarget = target ? chunk.name === target : chunk.isEntry;
      if (!isTarget) continue;
      collected.push({
        name: chunk.name,
        fileName: chunk.fileName,
        modules: Object.entries(chunk.modules).map(([id, m]) => ({
          id,
          bytes: m.renderedLength,
        })),
      });
    }
  },
};

console.log(`Analyse du chunk ${target ? `« ${target} »` : "d'ENTRÉE"} — build en cours…\n`);
await build({ configFile: 'vite.config.ts', logLevel: 'error', plugins: [reporter] });

if (collected.length === 0) {
  console.error(target ? `Aucun chunk nommé « ${target} ».` : "Aucun chunk d'entrée trouvé.");
  process.exit(1);
}

const short = (id) =>
  id
    .replace(/\\/g, '/')
    .replace(/^.*\/node_modules\//, 'node_modules/')
    .replace(new RegExp(`^${process.cwd().replace(/\\/g, '/')}/`), '');

for (const chunk of collected) {
  const mods = chunk.modules.filter((m) => m.bytes > 0).sort((a, b) => b.bytes - a.bytes);
  const total = mods.reduce((s, m) => s + m.bytes, 0);

  console.log(`── ${chunk.fileName} — ${mods.length} modules, ${(total / 1024).toFixed(1)} ko bruts\n`);

  // Regroupement par origine : c'est là que se lisent les vraies décisions
  // (« ce paquet n'a rien à faire dans l'entrée »), pas dans le détail fichier.
  const byOrigin = new Map();
  for (const m of mods) {
    const s = short(m.id);
    const key = s.startsWith('node_modules/')
      ? `node_modules/${s.split('/')[1].startsWith('@') ? s.split('/').slice(1, 3).join('/') : s.split('/')[1]}`
      : s.split('/').slice(0, 2).join('/');
    byOrigin.set(key, (byOrigin.get(key) ?? 0) + m.bytes);
  }
  console.log('  Par origine :');
  for (const [k, v] of [...byOrigin].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${(v / 1024).toFixed(1).padStart(7)} ko  ${k}`);
  }

  console.log('\n  Modules :');
  for (const m of flag('all') ? mods : mods.slice(0, 30)) {
    console.log(`    ${(m.bytes / 1024).toFixed(1).padStart(7)} ko  ${short(m.id)}`);
  }
  if (!flag('all') && mods.length > 30) console.log(`    … et ${mods.length - 30} autres (--all)`);
  console.log('');
}
