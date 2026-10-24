// ═══════════════════════════════════════════════════════════════════
// POST-AUDIT-GUIDE AM-2: un guide de chantiers ne dit pas lesquels sont périmés
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Le point 3 était tranché depuis le 2026-09-03 et exécuté le
// 09-04 ; le point 5 décrivait une facturation « dormante » alors qu'elle est
// live depuis le 2026-10-20. Rien ne signalait qu'un chantier avait vieilli.
//
// CE QUE CETTE GARDE EXIGE : chaque « ## Point N » de `docs/POST-AUDIT-GUIDE.md`
// porte, juste dessous, un marqueur de statut :
//
//   `<!-- chantier: actif relu=AAAA-MM-JJ -->`   à jouer ou à surveiller : la
//                                                relecture ne doit pas dépasser
//                                                90 jours ;
//   `<!-- chantier: clos le=AAAA-MM-JJ -->`      tranché ou exécuté : exempt de
//                                                péremption, mais daté.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS : que la relecture a eu lieu. Elle force
// quelqu'un à ÉCRIRE une date, donc à rouvrir le point au moins une fois par
// trimestre. ❌ Ne jamais mettre `relu=` à la date du jour sans avoir relu.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const JOUR = 86_400_000;
export const DELAI_JOURS = 90;
export const DOC = 'docs/POST-AUDIT-GUIDE.md';
export const MIN_CHANTIERS = 5;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const jour = (s) => (DATE.test(s) ? Date.parse(`${s}T00:00:00Z`) : NaN);

/** Les chantiers : titre, marqueur (ou null). Le marqueur doit suivre le titre à 3 lignes près. */
export function chantiers(texte) {
  const lignes = texte.split(/\r?\n/);
  const out = [];
  lignes.forEach((l, i) => {
    const t = /^##\s+(Point\s+\d+\b.*)$/.exec(l);
    if (!t) return;
    const m = lignes
      .slice(i + 1, i + 4)
      .map((x) => /<!--\s*chantier:\s*(actif|clos)\s+(relu|le)=(\S+)\s*-->/.exec(x))
      .find(Boolean);
    out.push({ titre: t[1], statut: m?.[1] ?? null, cle: m?.[2] ?? null, date: m?.[3] ?? null });
  });
  return out;
}

export function verifier(racine = RACINE, maintenant = new Date()) {
  const erreurs = [];
  const chemin = join(racine, DOC);
  if (!existsSync(chemin)) return { erreurs: [`\`${DOC}\` introuvable.`], total: 0 };
  const liste = chantiers(readFileSync(chemin, 'utf8'));
  const aujourdhui = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());

  if (liste.length < MIN_CHANTIERS) erreurs.push(`${liste.length} chantier(s) trouvé(s), plancher ${MIN_CHANTIERS} : l'analyse est cassée.`);
  for (const c of liste) {
    if (!c.statut) {
      erreurs.push(`« ${c.titre} » : pas de marqueur \`<!-- chantier: actif relu=… -->\` ou \`clos le=…\` sous le titre.`);
      continue;
    }
    const d = jour(c.date);
    if (Number.isNaN(d)) { erreurs.push(`« ${c.titre} » : date illisible (${c.date}).`); continue; }
    if (d > aujourdhui) { erreurs.push(`« ${c.titre} » : date dans le futur (${c.date}).`); continue; }
    if (c.statut === 'actif') {
      if (c.cle !== 'relu') erreurs.push(`« ${c.titre} » : un chantier actif porte \`relu=\`, pas \`le=\`.`);
      const age = Math.round((aujourdhui - d) / JOUR);
      if (age > DELAI_JOURS) {
        erreurs.push(`« ${c.titre} » : relu le ${c.date}, il y a ${age} jours (limite ${DELAI_JOURS}). Le relire contre le dépôt, puis le re-dater, ou le déclarer clos.`);
      }
    } else if (c.cle !== 'le') {
      erreurs.push(`« ${c.titre} » : un chantier clos porte \`le=\`, pas \`relu=\`.`);
    }
  }
  return { erreurs, total: liste.length };
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const { erreurs, total } = verifier();
  console.log(`✔ ${total} chantier(s) lu(s)`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`❌ ${e}`);
    process.exit(1);
  }
  console.log('Chantiers à jour.');
}
