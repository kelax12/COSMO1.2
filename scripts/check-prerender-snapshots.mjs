// Compare le HTML prérendu (`dist/`) aux instantanés versionnés
// (`prerender/instantanes/`). Voir `scripts/prerender-snapshots.mjs` pour le
// pourquoi, la normalisation et la procédure de mise à jour.
//
//   npm run build && npm run check:prerender          → compare, sort en 1 au premier écart
//   npm run prerender:instantanes:maj                  → réécrit les instantanés (refusé en CI)
//
// Son ENTRÉE est `dist/`, écrit par `npm run build` : un `dist/` absent ou
// partiel fait ÉCHOUER la garde en le disant, jamais passer à vide.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOSSIER_INSTANTANES, comparer, mettreAJour } from './prerender-snapshots.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const MAX_ECARTS_AFFICHES = 12;

/** Le texte et le code de sortie d'une exécution, séparés de `process` pour être testés. */
export function executer({ args, env, dist, instantanes }) {
  if (args.includes('--mettre-a-jour')) {
    // Une mise à jour automatique est exactement ce que cette garde interdit :
    // en CI, un instantané ne bouge pas, il se relit dans un diff.
    if (env.CI) {
      return { code: 1, texte: 'Mise à jour refusée en CI (variable CI posée) : un instantané se met à jour en local, voir docs/TESTING.md § Instantanés du prérendu.' };
    }
    const r = mettreAJour(dist, instantanes);
    return { code: 0, texte: `Instantanés du prérendu : ${r.total} sorties, ${r.ecrits} écrites, ${r.retires} retirées. Relire le diff git avant de committer.` };
  }
  const ecarts = comparer(dist, instantanes);
  if (ecarts.length === 0) return { code: 0, texte: 'Instantanés du prérendu : identiques.' };
  const lignes = [`Instantanés du prérendu : ${ecarts.length} écart(s).`];
  for (const e of ecarts.slice(0, MAX_ECARTS_AFFICHES)) {
    if (e.nature === 'sans-instantane') lignes.push(`  ${e.cle} : produite par le prérendu, sans instantané versionné`);
    else if (e.nature === 'orphelin') lignes.push(`  ${e.cle} : instantané versionné, mais plus produite par le prérendu`);
    else {
      const d = e.detail;
      lignes.push(`  ${e.cle} : ligne ${d.ligne} (instantané ${d.lignesAttendues} lignes, build ${d.lignesObtenues})`);
      lignes.push(`      attendu : ${d.attendu}`);
      lignes.push(`      obtenu  : ${d.obtenu}`);
    }
  }
  if (ecarts.length > MAX_ECARTS_AFFICHES) lignes.push(`  … et ${ecarts.length - MAX_ECARTS_AFFICHES} autre(s)`);
  lignes.push('Un écart voulu se met à jour par `npm run prerender:instantanes:maj` (jamais en CI), puis se relit dans le diff git.');
  return { code: 1, texte: lignes.join('\n') };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let resultat;
  try {
    resultat = executer({
      args: process.argv.slice(2),
      env: process.env,
      dist: join(RACINE, 'dist'),
      instantanes: join(RACINE, DOSSIER_INSTANTANES),
    });
  } catch (err) {
    resultat = { code: 1, texte: `Instantanés du prérendu : ${err.message}` };
  }
  if (resultat.code !== 0) console.error(`::error title=Instantanés du prérendu::${resultat.texte.split('\n')[0]}`);
  (resultat.code === 0 ? console.log : console.error)(resultat.texte);
  process.exit(resultat.code);
}
