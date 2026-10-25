// ═══════════════════════════════════════════════════════════════════
// M-40 / M-52 / M-56: une check-list « à jouer » SANS ÉCHÉANCE se reconduit
// indéfiniment
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. `AUDIT-VOICEOVER-IOS.md` écrivait « à jouer, rien n'est coché »
// depuis le 2026-09-03. Aucune date, donc aucun moment où l'absence de séance
// devienne un échec. Ce que VoiceOver ou NVDA ANNONCE ne s'outille pas : seule
// la séance humaine le mesure. Ce qui s'outille, c'est l'ÉCHÉANCE.
//
// CE QUE CETTE GARDE EXIGE, pour chaque check-list de lecteur d'écran :
//
//   1. un marqueur `<!-- echeance-lecteur-ecran: AAAA-MM-JJ initiale=AAAA-MM-JJ -->` ;
//   2. une échéance qui n'a pas été repoussée de plus de 30 jours depuis
//      l'`initiale` (sinon repousser la date redevient une reconduction) ;
//   3. chaque étape numérotée (`| 4.5 |`) porte un RÉSULTAT ATTENDU non vide,
//      sans quoi la check-list n'est pas exécutable pas à pas ;
//   4. passé le jour de l'échéance, une ligne `✅ joué` datée, au plus tard
//      aujourd'hui, dans le « Registre des séances ». Sinon : ÉCHEC.
//
// ⚠️ CE QU'ELLE NE PROUVE PAS : que la séance a été bien faite, ni que ses
// findings sont corrigés. Elle prouve qu'une séance est CONSIGNÉE, avec un
// appareil. Un « partiel » n'éteint pas l'échéance (« à refaire », pas « fait »).
//
// ❌ NE JAMAIS repousser l'échéance au-delà de initiale + 30 jours, ni cocher
//    une ligne du registre sans séance réelle.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const JOUR = 86_400_000;
export const REPORT_MAX_JOURS = 30;
export const PREAVIS_JOURS = 14;

/** Les check-lists, et le plancher d'étapes qui interdit à la garde de répondre sans mesurer. */
export const CHECKLISTS = [
  { doc: 'docs/AUDIT-VOICEOVER-IOS.md', nom: 'VoiceOver iOS', minEtapes: 90 },
  { doc: 'docs/AUDIT-NVDA-WINDOWS.md', nom: 'NVDA et revue humaine WCAG', minEtapes: 30 },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const jour = (s) => (DATE.test(s) ? Date.parse(`${s}T00:00:00Z`) : NaN);

export function lireMarqueur(texte) {
  const m = /<!--\s*echeance-lecteur-ecran:\s*(\S+)\s+initiale=(\S+)\s*-->/.exec(texte);
  return m ? { echeance: m[1], initiale: m[2] } : null;
}

/** Les lignes `| N.N | geste | attendu | … |` : numéro et cellule « attendu ». */
export function etapes(texte) {
  const out = [];
  for (const l of texte.split(/\r?\n/)) {
    const c = l.split('|').map((x) => x.trim());
    if (c.length > 4 && /^[AB0-9]+\.\d+$/.test(c[1])) out.push({ id: c[1], attendu: c[3] ?? '' });
  }
  return out;
}

/** Les lignes du « Registre des séances » : date, appareil, statut. */
export function registre(texte) {
  const debut = texte.search(/^##\s+Registre des séances/m);
  if (debut < 0) return null;
  const suite = texte.slice(debut).split(/\r?\n/).slice(1);
  const lignes = [];
  for (const l of suite) {
    if (/^##\s/.test(l)) break;
    const c = l.split('|').map((x) => x.trim());
    if (c.length > 3 && DATE.test(c[1])) lignes.push({ date: c[1], appareil: c[2], statut: c[3] });
  }
  return lignes;
}

export function verifier(racine = RACINE, maintenant = new Date()) {
  const erreurs = [];
  const avis = [];
  const resume = [];
  const aujourdhui = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());

  for (const c of CHECKLISTS) {
    const chemin = join(racine, c.doc);
    if (!existsSync(chemin)) {
      erreurs.push(`\`${c.doc}\` est introuvable.`);
      continue;
    }
    const texte = readFileSync(chemin, 'utf8');
    const m = lireMarqueur(texte);
    if (!m || Number.isNaN(jour(m.echeance)) || Number.isNaN(jour(m.initiale))) {
      erreurs.push(`\`${c.doc}\` : marqueur \`<!-- echeance-lecteur-ecran: AAAA-MM-JJ initiale=AAAA-MM-JJ -->\` absent ou illisible.`);
      continue;
    }
    const ech = jour(m.echeance);
    const ini = jour(m.initiale);

    if (ech > ini + REPORT_MAX_JOURS * JOUR) {
      erreurs.push(
        `\`${c.doc}\` : échéance ${m.echeance} repoussée de plus de ${REPORT_MAX_JOURS} jours après ${m.initiale}. `
          + 'Repousser sans limite, c\'est reconduire : jouer la séance, ou décider par écrit de retirer la check-list.',
      );
    }

    const liste = etapes(texte);
    if (liste.length < c.minEtapes) {
      erreurs.push(`\`${c.doc}\` : ${liste.length} étape(s) numérotée(s), plancher ${c.minEtapes}. L'analyse est cassée, ou des étapes ont disparu.`);
    }
    const vides = liste.filter((e) => e.attendu.length < 8).map((e) => e.id);
    if (vides.length) {
      erreurs.push(`\`${c.doc}\` : étape(s) sans résultat attendu : ${vides.join(', ')}. Sans attendu, la séance n'est pas exécutable pas à pas.`);
    }

    const lignes = registre(texte);
    if (lignes === null) {
      erreurs.push(`\`${c.doc}\` : section « ## Registre des séances » absente.`);
      continue;
    }
    const futures = lignes.filter((l) => jour(l.date) > aujourdhui);
    for (const f of futures) erreurs.push(`\`${c.doc}\` : séance datée dans le futur (${f.date}).`);
    const jouees = lignes.filter((l) => jour(l.date) <= aujourdhui && /✅\s*joué/.test(l.statut) && l.appareil.length >= 6);
    resume.push(`${c.nom} : ${liste.length} étapes, échéance ${m.echeance}, ${jouees.length} séance(s) jouée(s)`);

    if (!jouees.length) {
      const reste = Math.round((ech - aujourdhui) / JOUR);
      if (reste < 0) {
        erreurs.push(
          `${c.nom} : échéance ${m.echeance} dépassée de ${-reste} jour(s) sans séance « ✅ joué » consignée dans \`${c.doc}\`. `
            + 'Jouer la séance et la consigner (date, appareil), ou, si la date est irréaliste, la repousser dans la limite des 30 jours.',
        );
      } else if (reste <= PREAVIS_JOURS) {
        avis.push(`${c.nom} : échéance dans ${reste} jour(s) (${m.echeance}), aucune séance consignée.`);
      }
    }
  }
  return { erreurs, avis, resume };
}

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const { erreurs, avis, resume } = verifier();
  for (const r of resume) console.log(`✔ ${r}`);
  for (const a of avis) console.log(`::warning::${a}`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`❌ ${e}`);
    process.exit(1);
  }
  console.log('Échéances des séances lecteur d\'écran tenues.');
}
