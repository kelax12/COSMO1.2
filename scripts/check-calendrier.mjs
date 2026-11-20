// ═══════════════════════════════════════════════════════════════════
// check-calendrier.mjs · les gardes de DATE qui jugent un document
//
// Trois gardes fusionnées (MAI-02), un fichier, trois sous-commandes :
//   node scripts/check-calendrier.mjs study       · C-108 : une étude décrit encore les versions installées
//   node scripts/check-calendrier.mjs lecteurs    · M-52  : échéance des séances VoiceOver / NVDA
//   node scripts/check-calendrier.mjs chantiers   · AM-2  : chaque chantier daté (relu sous 90 j, ou clos)
// Sans argument : les trois, dans cet ordre. Quotidien, `gardes-calendrier.yml`,
// jamais dans un job bloquant (CI-01). Témoins : `check-procedures-humaines.guard.test.mjs`.
// Docs : MIGRATION-REACT19.md, AUDIT-NVDA-WINDOWS.md, AUDIT-VOICEOVER-IOS.md, POST-AUDIT-GUIDE.md.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { estLance } from './ops-alert.mjs';

const RACINE = process.cwd();
const JOUR = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const jour = (s) => (DATE.test(s) ? Date.parse(`${s}T00:00:00Z`) : NaN);

// ── C-108 · fraîcheur des études ─────────────────────────────────

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
    // Recalé le 2026-10-23, APRÈS relecture : la migration est faite, le
    // document porte un §0 qui décrit l'état migré (versions, correctifs,
    // mesures du bundle). Écrit d'abord contre React 18 / router 7, le
    // 2026-09-03.
    ecrite_le: '2026-10-23',
    paquets: {
      react: 19,
      'react-dom': 19,
      'react-router': 8,
      '@types/react': 19,
      '@types/react-dom': 19,
    },
    invalide:
      'le §0 décrit la migration vers React 19 et `react-router` 8 : versions '
      + 'installées, `forwardRef` retirés de `ui/`, mesures du chemin critique. '
      + 'Si une de ces majeures a bougé, ce § décrit un état qui n\'existe plus : '
      + 'le relire et le corriger, ou archiver le document (`docs/archive/**`).',
  },
];

/** La majeure d'une plage semver (`^18.3.1` → 18). */
export function majeure(plage) {
  const m = /(\d+)/.exec(String(plage ?? ''));
  return m ? Number(m[1]) : null;
}

export function verifierEtudes(racine = RACINE) {
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


// ── M-52 · séances lecteur d'écran ─────────────────────────────
export const REPORT_MAX_JOURS = 30;
export const PREAVIS_JOURS = 14;

/** Les check-lists, et le plancher d'étapes qui interdit à la garde de répondre sans mesurer. */
export const CHECKLISTS = [
  { doc: 'docs/AUDIT-VOICEOVER-IOS.md', nom: 'VoiceOver iOS', minEtapes: 90 },
  { doc: 'docs/AUDIT-NVDA-WINDOWS.md', nom: 'NVDA et revue humaine WCAG', minEtapes: 30 },
];


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

export function verifierLecteurs(racine = RACINE, maintenant = new Date()) {
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


// ── AM-2 · péremption des chantiers ──────────────────────────────
export const DELAI_JOURS = 90;
export const DOC = 'docs/POST-AUDIT-GUIDE.md';
export const MIN_CHANTIERS = 5;


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

export function verifierChantiers(racine = RACINE, maintenant = new Date()) {
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


// ── Ligne de commande ────────────────────────────────────────────
function cliEtudes() {
  const { ecarts, absents, docsManquants, comparaisons } = verifierEtudes();
  const attendues = ETUDES.reduce((n, e) => n + Object.keys(e.paquets).length, 0);

  console.log('Fraîcheur des études');
  for (const e of ETUDES) console.log(`  ${e.doc} — écrite le ${e.ecrite_le}`);
  console.log(`  ${comparaisons} comparaison(s) faite(s) sur ${attendues} attendue(s)`);

  const erreurs = [];
  // 🔴 Anti-« garde qui répond sans mesurer » : aucune comparaison, un « ✓ » ne voudrait rien dire.
  if (comparaisons === 0) erreurs.push('AUCUNE comparaison effectuée : la garde ne mesure rien.');
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
    return false;
  }
  console.log('\n✓ Chaque étude décrit encore les versions installées.');
  return true;
}

function cliLecteurs() {
  const { erreurs, avis, resume } = verifierLecteurs();
  for (const r of resume) console.log(`✔ ${r}`);
  for (const a of avis) console.log(`::warning::${a}`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`❌ ${e}`);
    return false;
  }
  console.log('Échéances des séances lecteur d\'écran tenues.');
  return true;
}

function cliChantiers() {
  const { erreurs, total } = verifierChantiers();
  console.log(`✔ ${total} chantier(s) lu(s)`);
  if (erreurs.length) {
    for (const e of erreurs) console.error(`❌ ${e}`);
    return false;
  }
  console.log('Chantiers à jour.');
  return true;
}

const SOUS_COMMANDES = { study: cliEtudes, lecteurs: cliLecteurs, chantiers: cliChantiers };

const estLanceDirectement = estLance(import.meta.url);

if (estLanceDirectement) {
  const demande = process.argv[2];
  if (demande && !SOUS_COMMANDES[demande]) {
    console.error(`Sous-commande inconnue : ${demande} (study, lecteurs, chantiers).`);
    process.exit(2);
  }
  const noms = demande ? [demande] : Object.keys(SOUS_COMMANDES);
  const rouges = noms.filter((n) => !SOUS_COMMANDES[n]());
  if (rouges.length) process.exit(1);
}
