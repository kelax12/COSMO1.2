// ═══════════════════════════════════════════════════════════════════
// indicateurs.mjs · SIX INDICATEURS MESURES, A LA PLACE DES NOTES SUR 100
//
// Appele par `npm run indicateurs` et, chaque lundi, par
// `.github/workflows/indicateurs.yml`, qui regenere `docs/INDICATEURS.md`.
// Decision : `docs/adr/0012-indicateurs-mesures-a-la-place-des-notes.md`.
// Vague 20.2 du plan de reprise, constat PRO-05 de l'audit externe du
// 2026-11-06 : 964 sur 1100 attribues par soi-meme, pendant que `main` etait
// rouge 56 runs sur 75.
//
// 🔴 POURQUOI DES INDICATEURS ET PAS UNE NOTE
// Une note se decide, un indicateur se lit. Chacun des six ci-dessous porte
// sa DATE DE MESURE et sa SOURCE, et une valeur qu'on ne sait pas lire
// s'ecrit « non mesuré » avec sa raison : jamais un chiffre de repli.
//
//   1. taux de vert de `main` : les N derniers runs conclus du `CI noyau` ;
//   2. delai de restauration eprouve : dernier `drill-auto` vert, sa duree ;
//   3. couverture des parcours critiques : liste declaree vs specs presentes ;
//   4. age maximal des secrets : registre `.github/secrets-registry.json` ;
//   5. derive de la production : sondes `Deploy SHA drift`, `Edge deploy
//      drift` et `Migration coverage` (ledger des migrations) ;
//   6. incidents ouverts : issues ouvertes `ci-red` et `incident`.
//
// ── SEUILS D'ALERTE (ils sonnent, ils ne se relevent pas) ───────────
//   · `main` sous 80 % de vert ;
//   · aucun drill vert depuis 35 jours (meme borne que `restore-drill-fraicheur`) ;
//   · un secret au-dela de son echeance, ou sans date de rotation connue
//     (« date inconnue = echue », regle de `check-secrets-age.mjs`) ;
//   · une sonde de derive de production rouge ;
//   · un audit externe en retard sur sa periodicite semestrielle ;
//   · un indicateur illisible (API refusee, reponse mal formee) : echec FERME.
//
// ✅ ECHEC FERME : une lecture qui plante n'est pas un vert. L'indicateur est
//    « non mesuré », porte la raison, ET compte comme alerte.
// ⚠️ DEPOT PUBLIC : noms de workflow, numeros d'issue, dates, durees, liens
//    de runs. Aucune valeur de secret (le registre ne porte que des NOMS).
// 🔴 PAS DE SHEBANG (cf. `scripts/CLAUDE.md` § C-82) : le temoin importe ce
//    module. Temoin : `scripts/indicateurs.guard.test.mjs`.
//
// Usage :
//   node scripts/indicateurs.mjs                 # mesure et imprime le markdown
//   node scripts/indicateurs.mjs --ecrire        # ecrit docs/INDICATEURS.md
//   node scripts/indicateurs.mjs --ecrire --json=chemin.json
//   node scripts/indicateurs.mjs --seuils=chemin.json   # exit 1 si une alerte
// Jeton : GH_TOKEN, GITHUB_TOKEN, ou `gh auth token`. Depot : REPO,
// GITHUB_REPOSITORY, ou `kelax12/COSMO1.2`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { verdictFraicheur, JOB as JOB_DRILL, JOURS_MAX as DRILL_JOURS_MAX } from './restore-drill-fraicheur.mjs';
import { dateEffective } from './check-secrets-age.mjs';

const JOUR = 86_400_000;
export const NON_MESURE = 'non mesuré';
export const DEPOT_PAR_DEFAUT = 'kelax12/COSMO1.2';

/** Les bornes. Ne se relevent pas pour faire taire une alerte (CLAUDE.md). */
export const SEUILS = {
  /** `main` sous ce taux de vert (en %) : alerte. */
  vertMinPct: 80,
  /** Fenetre du taux de vert : les N derniers runs conclus. */
  fenetreRuns: 50,
  /** Aucun drill vert depuis ce nombre de jours : alerte. */
  drillJoursMax: DRILL_JOURS_MAX,
};

export const WORKFLOWS = {
  noyau: 'ci-noyau.yml',
  drill: 'restore-drill.yml',
  etendue: 'ci.yml',
  secrets: 'secrets-age.yml',
  sondes: [
    { fichier: 'deploy-sha-drift.yml', nom: 'Deploy SHA drift', regarde: 'le commit servi en production contre le dernier commit vert' },
    { fichier: 'edge-deploy-drift.yml', nom: 'Edge deploy drift', regarde: 'le code des Edge Functions deployees contre le depot' },
    { fichier: 'migration-coverage.yml', nom: 'Migration coverage', regarde: 'les fichiers de migration contre le ledger de production' },
  ],
};

const CONCLUS_ROUGE = new Set(['failure', 'timed_out', 'startup_failure']);
const CONCLUS_VERT = new Set(['success']);

// ═══════════════ NOYAU PUR · aucun reseau, aucun disque ═══════════════

const jour = (iso) => (iso ? String(iso).slice(0, 10) : null);
const pct = (n, d) => (d === 0 ? null : Math.round((1000 * n) / d) / 10);
const fr = (x) => String(x).replace('.', ',');

/** Un run conclu vert ou rouge : ni annule, ni saute, ni neutre. */
function conclu(r) {
  return r?.status !== 'in_progress' && (CONCLUS_ROUGE.has(r?.conclusion) || CONCLUS_VERT.has(r?.conclusion));
}

function nonMesure(base, raison) {
  return { ...base, etat: 'non-mesure', valeur: NON_MESURE, raison, alertes: [`${base.titre} : ${NON_MESURE} (${raison})`], details: [] };
}

function duree(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

/**
 * 1 · Taux de vert de `main`. `runs` : runs du `CI noyau` sur `main`, du plus
 * recent au plus ancien. Les runs annules ou sautes ne comptent ni pour ni contre.
 */
export function tauxDeVert(runs, { source, fenetre = SEUILS.fenetreRuns, seuilPct = SEUILS.vertMinPct } = {}) {
  const base = { id: 'taux-de-vert', titre: 'Taux de vert de main (CI noyau)', source };
  const utiles = (runs ?? []).filter(conclu).slice(0, fenetre);
  if (utiles.length === 0) return nonMesure(base, 'aucun run conclu du CI noyau lu sur main');
  const verts = utiles.filter((r) => CONCLUS_VERT.has(r.conclusion)).length;
  const taux = pct(verts, utiles.length);
  const alertes = [];
  if (taux < seuilPct) alertes.push(`main sous ${seuilPct} % de vert : ${fr(taux)} % sur les ${utiles.length} derniers runs du CI noyau`);
  const dernier = utiles[0];
  return {
    ...base,
    etat: 'mesure',
    valeur: `${fr(taux)} % (${verts} verts sur ${utiles.length} runs)`,
    taux,
    mesureLe: jour(dernier.created_at),
    alertes,
    details: [
      `Fenêtre : les ${utiles.length} derniers runs conclus du \`CI noyau\` sur \`main\` (du ${jour(utiles.at(-1).created_at)} au ${jour(dernier.created_at)}), annulés et sautés exclus.`,
      `Dernier run : ${CONCLUS_VERT.has(dernier.conclusion) ? 'vert' : 'rouge'}, ${dernier.html_url ?? 'lien indisponible'}.`,
      `Seuil d'alerte : moins de ${seuilPct} %.`,
    ],
  };
}

/**
 * 2 · Delai de restauration eprouve. `runs` : [{ id, date, html_url, jobs:
 * [{ name, conclusion, started_at, completed_at, steps }] }], runs REUSSIS de
 * `restore-drill.yml` sur `main`. L'age se juge par `verdictFraicheur`, la
 * meme fonction que la garde d'absence.
 */
export function drillRestauration(runs, { maintenant = new Date(), source, joursMax = SEUILS.drillJoursMax } = {}) {
  const base = { id: 'delai-de-restauration', titre: 'Délai de restauration éprouvé (drill mensuel)', source };
  const v = verdictFraicheur(runs, maintenant, joursMax);
  if (!v.dernier) {
    return {
      ...base,
      etat: 'mesure',
      valeur: 'aucun drill vert',
      mesureLe: jour(maintenant.toISOString()),
      alertes: [`aucun drill de restauration vert (job ${JOB_DRILL}) sur main : la seule sauvegarde n'est pas éprouvée`],
      details: [v.message, `Seuil d'alerte : aucun drill vert depuis ${joursMax} jours.`],
    };
  }
  const run = (runs ?? []).find((r) => r.id === v.dernier.id);
  const job = (run?.jobs ?? []).find((j) => j.name === JOB_DRILL && j.conclusion === 'success');
  const dureeJob = duree(Date.parse(job?.completed_at) - Date.parse(job?.started_at));
  const etape = (job?.steps ?? []).find((s) => /^restaurer le dernier dump/i.test(s.name ?? '') && s.conclusion === 'success');
  const dureeEtape = etape ? duree(Date.parse(etape.completed_at) - Date.parse(etape.started_at)) : null;
  const quand = jour(new Date(v.dernier.t ?? Date.parse(run?.date)).toISOString());
  const alertes = v.ok ? [] : [v.message];
  return {
    ...base,
    etat: 'mesure',
    valeur: `${dureeEtape ?? dureeJob ?? NON_MESURE}, dernier vert le ${quand} (il y a ${v.ageJours} j)`,
    mesureLe: quand,
    ageJours: v.ageJours,
    alertes,
    details: [
      `Durée du job \`${JOB_DRILL}\` entier (téléchargement, déchiffrement, restauration, comparaison des comptages) : ${dureeJob ?? NON_MESURE}.`,
      `Durée de l'étape de restauration seule : ${dureeEtape ?? NON_MESURE}.`,
      `Run : ${run?.html_url ?? `id ${v.dernier.id}`}.`,
      `🔴 Ce que ce chiffre n'est pas : le drill restaure dans un Postgres jetable du runner, pas sur la plateforme Supabase. Il ne chronomètre pas un vrai sinistre (\`docs/DEPLOYMENT.md\` § 7).`,
      `Seuil d'alerte : aucun drill vert depuis ${joursMax} jours.`,
    ],
  };
}

/**
 * 3 · Couverture des parcours critiques. `declaration` : { parcours: [{ id,
 * libelle, specs }] }, `existe(chemin)` : booleen. C'est une couverture de
 * PRESENCE : une spec existe, pas qu'elle est verte. Le dernier run de
 * `CI etendue` (qui joue les e2e sans bloquer) est donne en contexte.
 */
export function couvertureParcours(declaration, existe, { source, contexte = null, mesureLe } = {}) {
  const base = { id: 'parcours-critiques', titre: 'Couverture des parcours critiques', source };
  const liste = declaration?.parcours;
  if (!Array.isArray(liste) || liste.length === 0) return nonMesure(base, 'liste des parcours critiques absente ou vide');
  const lignes = liste.map((p) => {
    const presentes = (p.specs ?? []).filter((s) => existe(s));
    return { id: p.id, libelle: p.libelle, specs: p.specs ?? [], presentes, couvert: presentes.length > 0 };
  });
  const couverts = lignes.filter((l) => l.couvert).length;
  const manquants = lignes.filter((l) => !l.couvert);
  return {
    ...base,
    etat: 'mesure',
    valeur: `${couverts} sur ${lignes.length} parcours (${fr(pct(couverts, lignes.length))} %)`,
    mesureLe,
    couverts,
    total: lignes.length,
    alertes: [],
    details: [
      `Parcours déclarés dans \`scripts/indicateurs.config.json\`, chacun avec au moins une spec \`e2e/\` présente dans le dépôt.`,
      manquants.length
        ? `Sans aucune spec : ${manquants.map((m) => m.libelle).join(' ; ')}.`
        : 'Aucun parcours déclaré sans spec.',
      `🔴 Couverture de PRÉSENCE : une spec existe, rien ne dit qu'elle est verte. Les e2e sont joués par \`CI etendue\`, qui ne bloque pas.`,
      contexte ?? `Dernier run de \`CI etendue\` sur \`main\` : ${NON_MESURE}.`,
    ],
  };
}

/**
 * Lignes `<age> j / <echeance> j  <store>/<NOM>` imprimees par
 * `check-secrets-age.mjs` dans le journal de son run. `?` = date inconnue.
 * Rend [{ id, age|null, max }], vide si le journal ne porte aucune ligne.
 */
export function lignesDAge(texteJournal) {
  const sortie = [];
  for (const m of String(texteJournal ?? '').matchAll(/(?:^|\s)(\d+|\?) j \/ (\d+) j {2}([a-z-]+\/[A-Z][A-Z0-9_]*)\s*$/gm)) {
    sortie.push({ id: m[3], age: m[1] === '?' ? null : Number(m[1]), max: Number(m[2]) });
  }
  return sortie;
}

/**
 * 4 · Age maximal des secrets. Deux sources, la plus precise gagne :
 *   · `vivant` : les lignes du journal du dernier run de `Secrets age`, qui
 *     detient les jetons GitHub, Supabase et Vercel et lit la date VIVANTE ;
 *   · le registre `.github/secrets-registry.json` (NOMS et dates de rotation
 *     connues, jamais une valeur), seul recours quand ce journal est illisible.
 * `runSecrets` : dernier run conclu de `Secrets age`. S'il est VERT, la garde a
 * deja prouve qu'aucun secret n'est echu ni sans date : une date que ce script
 * ne lit pas n'est alors pas une alerte.
 */
export function ageSecrets(registre, { maintenant = new Date(), source, contexte = null, vivant = [], runSecrets = null, raisonVivant = null } = {}) {
  const base = { id: 'age-des-secrets', titre: 'Âge maximal des secrets', source };
  // Seuls les champs LUS ici sont verifies. La forme complete du registre
  // (lecteurs, effet d'une fuite, procedure) est le metier de
  // `check-secrets-age.mjs` : la redoubler ici ferait taire cet indicateur a
  // chaque champ que la garde exige en plus.
  const entrees = registre?.entries;
  if (!Array.isArray(entrees) || entrees.length === 0) return nonMesure(base, 'registre des secrets vide ou illisible');
  const sansEcheance = entrees.find((e) => e?.kind === 'secret' && !(Number.isInteger(e.maxAgeDays) && e.maxAgeDays > 0));
  if (sansEcheance) return nonMesure(base, `registre mal formé : ${sansEcheance.store}/${sansEcheance.name} sans échéance maxAgeDays`);
  const parId = new Map((vivant ?? []).map((l) => [l.id, l]));
  const secrets = registre.entries.filter((e) => e.kind === 'secret');
  const lignes = secrets.map((e) => {
    const id = `${e.store}/${e.name}`;
    const live = parId.get(id);
    const d = dateEffective(e, null);
    const ageRegistre = d ? Math.floor((maintenant.getTime() - d.getTime()) / JOUR) : null;
    const age = live && live.age !== null ? live.age : ageRegistre;
    return { id, nom: e.name, max: e.maxAgeDays, age, dateVivante: Boolean(live && live.age !== null) };
  });
  const connus = lignes.filter((l) => l.age !== null);
  const inconnus = lignes.filter((l) => l.age === null);
  const echus = connus.filter((l) => l.age > l.max);
  const garantiParVert = runSecrets?.conclusion === 'success';
  const vives = lignes.filter((l) => l.dateVivante).length;
  const alertes = [
    ...echus.map((l) => `secret ${l.id} au-delà de son échéance : ${l.age} j pour ${l.max} j`),
    ...(inconnus.length && !garantiParVert
      ? [`${inconnus.length} secret(s) sans date de rotation connue, donc échus : ${inconnus.map((l) => l.id).join(', ')}`]
      : []),
  ];
  const plusVieux = [...connus].sort((a, b) => b.age - a.age)[0];
  const valeur = [
    plusVieux ? `${plusVieux.age} j (${plusVieux.nom}, échéance ${plusVieux.max} j)` : `âge ${NON_MESURE}`,
    inconnus.length ? `${inconnus.length} sans date de rotation connue` : null,
  ].filter(Boolean).join(' ; ');
  return {
    ...base,
    etat: 'mesure',
    valeur,
    mesureLe: jour(runSecrets?.created_at) ?? jour(maintenant.toISOString()),
    alertes,
    details: [
      `${secrets.length} secrets au registre, ${connus.length} avec un âge connu (${vives} lus à la date vivante, ${connus.length - vives} au registre), ${echus.length} au-delà de leur échéance.`,
      inconnus.length
        ? `Âge inconnu${garantiParVert ? ' ici (le dernier run de `Secrets age` est vert : la garde a lu les dates vivantes)' : ' (échus selon la règle de `check-secrets-age`)'} : ${inconnus.map((l) => l.nom).join(', ')}.`
        : 'Aucun âge inconnu.',
      vives
        ? 'Les âges à la date vivante viennent du journal du dernier run de `Secrets age`, seul à détenir les jetons GitHub, Supabase et Vercel.'
        : `🔴 Âge lu au registre seulement${raisonVivant ? ` (journal de \`Secrets age\` : ${raisonVivant})` : ''}. La date vivante n'est lue que par le workflow \`Secrets age\`, qui détient les jetons.`,
      contexte ?? `Dernier run de \`Secrets age\` sur \`main\` : ${NON_MESURE}.`,
      `Seuil d'alerte : un secret au-delà de son échéance, ou sans date connue.`,
    ],
  };
}

/** Dernier run conclu (vert ou rouge) d'une liste de runs, du plus recent au plus ancien. */
export function dernierConclu(runs) {
  return (runs ?? []).find(conclu) ?? null;
}

/**
 * 5 · Derive de la production. `sondes` : [{ nom, regarde, run|null, erreur? }],
 * `run` le dernier run conclu de la sonde sur `main`.
 */
export function deriveProduction(sondes, { source } = {}) {
  const base = { id: 'derive-production', titre: 'Dérive de la production', source };
  const lues = (sondes ?? []).filter((s) => s.run);
  const illisibles = (sondes ?? []).filter((s) => !s.run);
  if (lues.length === 0) return nonMesure(base, illisibles.map((s) => `${s.nom} : ${s.erreur ?? 'aucun run conclu lu'}`).join(' ; ') || 'aucune sonde lue');
  const rouges = lues.filter((s) => CONCLUS_ROUGE.has(s.run.conclusion));
  const alertes = [
    ...rouges.map((s) => `dérive de production : \`${s.nom}\` rouge (run du ${jour(s.run.created_at)}, ${s.run.html_url})`),
    ...illisibles.map((s) => `${s.nom} : ${NON_MESURE} (${s.erreur ?? 'aucun run conclu lu'})`),
  ];
  const dates = lues.map((s) => jour(s.run.created_at)).sort();
  return {
    ...base,
    etat: illisibles.length ? 'non-mesure' : 'mesure',
    valeur: illisibles.length
      ? `${lues.length - rouges.length} verte(s), ${rouges.length} rouge(s), ${illisibles.length} ${NON_MESURE}`
      : rouges.length
        ? `${rouges.length} sonde(s) rouge(s) sur ${lues.length} : ${rouges.map((s) => s.nom).join(', ')}`
        : `${lues.length} sondes sur ${lues.length} vertes`,
    mesureLe: dates.at(-1),
    alertes,
    details: [
      ...(sondes ?? []).map((s) =>
        s.run
          ? `${s.nom} (${s.regarde}) : ${CONCLUS_VERT.has(s.run.conclusion) ? 'vert' : 'rouge'} le ${jour(s.run.created_at)}, ${s.run.html_url}.`
          : `${s.nom} (${s.regarde}) : ${NON_MESURE}, ${s.erreur ?? 'aucun run conclu lu'}.`),
      `Dernier run conclu de chaque sonde sur \`main\`. Les trois tournent sans déclencheur humain.`,
      `Seuil d'alerte : une sonde rouge.`,
    ],
  };
}

/**
 * 6 · Incidents ouverts. `ciRed` et `incident` : issues OUVERTES portant
 * l'etiquette, deja filtrees des pull requests. Pas d'alerte : l'issue `ci-red`
 * EST l'alerte, la compter ne doit pas en sonner une seconde.
 */
export function incidentsOuverts({ ciRed, incident }, { source, mesureLe } = {}) {
  const base = { id: 'incidents-ouverts', titre: 'Incidents ouverts', source };
  const total = ciRed.length + incident.length;
  const ligne = (i) => `#${i.number} ${String(i.title ?? '').slice(0, 80)} (ouverte le ${jour(i.created_at)})`;
  return {
    ...base,
    etat: 'mesure',
    valeur: `${total} (ci-red ${ciRed.length}, incident ${incident.length})`,
    mesureLe,
    alertes: [],
    details: [
      ciRed.length ? `Issues \`ci-red\` ouvertes : ${ciRed.map(ligne).join(' ; ')}.` : 'Aucune issue `ci-red` ouverte.',
      incident.length ? `Issues \`incident\` ouvertes : ${incident.map(ligne).join(' ; ')}.` : 'Aucune issue `incident` ouverte.',
      `Une issue ouverte est un incident non refermé. Une issue \`ci-red\` se referme une fois la CI revenue au vert (c'est ce qui réarme l'alerte).`,
    ],
  };
}

/** Audit externe semestriel : echeance, et alerte si elle est depassee. */
export function auditExterne(config, maintenant = new Date()) {
  const dernier = config?.dernier;
  const mois = config?.periodiciteMois;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dernier ?? '') || !Number.isInteger(mois) || mois <= 0) {
    return { dernier: null, echeance: null, joursRestants: null, alertes: [`audit externe : ${NON_MESURE} (date du dernier audit ou periodicite absente de la config)`] };
  }
  const d = new Date(`${dernier}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + mois);
  const echeance = d.toISOString().slice(0, 10);
  const joursRestants = Math.ceil((Date.parse(`${echeance}T00:00:00Z`) - maintenant.getTime()) / JOUR);
  return {
    dernier,
    echeance,
    joursRestants,
    alertes: joursRestants < 0 ? [`audit externe en retard : échéance du ${echeance}, dépassée de ${-joursRestants} j`] : [],
  };
}

/** Rassemble : toutes les alertes, dans l'ordre des indicateurs puis de l'audit. */
export function toutesLesAlertes(indicateurs, audit) {
  return [...indicateurs.flatMap((i) => i.alertes ?? []), ...(audit?.alertes ?? [])];
}

// ═══════════════ RENDU MARKDOWN · aucun tiret cadratin ═══════════════

const cellule = (t) => String(t ?? NON_MESURE).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Le document `docs/INDICATEURS.md`. `meta` : { genereLe: Date, sha, depot }. */
export function rendre({ indicateurs, audit, alertes, meta }) {
  const quand = meta.genereLe.toISOString().slice(0, 16).replace('T', ' ');
  const sha = meta.sha ? `, au commit \`${String(meta.sha).slice(0, 7)}\`` : '';
  const l = [];
  l.push('<!-- GENERE par scripts/indicateurs.mjs. NE PAS EDITER A LA MAIN. Regenerer : npm run indicateurs -->');
  l.push('> Ce document ne porte aucune note. Il remplace les notes sur 100 par six indicateurs mesurés, chacun daté et sourcé (ADR 0012).');
  l.push('');
  l.push('# Indicateurs COSMO');
  l.push('');
  l.push('> 🔴 **Fichier généré, ne pas éditer à la main.** `npm run indicateurs` (`scripts/indicateurs.mjs`) le réécrit ;');
  l.push('> `.github/workflows/indicateurs.yml` le régénère chaque lundi et le pousse sur `main`.');
  l.push('> Une valeur introuvable s\'écrit « non mesuré », avec sa raison : jamais un chiffre de repli.');
  l.push('');
  l.push(`Régénéré le **${quand} UTC**${sha}. Alertes en cours : **${alertes.length}**.`);
  l.push('');
  l.push('| # | Indicateur | Valeur | Mesuré le | Source |');
  l.push('|---|---|---|---|---|');
  indicateurs.forEach((i, n) => {
    l.push(`| ${n + 1} | ${cellule(i.titre)} | ${cellule(i.valeur)} | ${cellule(i.mesureLe ?? NON_MESURE)} | ${cellule(i.source)} |`);
  });
  l.push('');
  l.push('## Alertes');
  l.push('');
  if (alertes.length) {
    for (const a of alertes) l.push(`- 🔴 ${a}`);
    l.push('');
    l.push('Elles ouvrent ou mettent à jour l\'issue `ci-red` (via `ci-alert.yml`), la liste de `workflows:` y contenant `Indicateurs`.');
  } else {
    l.push('Aucune alerte au moment de la mesure.');
  }
  l.push('');
  l.push('## Détail');
  indicateurs.forEach((i, n) => {
    l.push('');
    l.push(`### ${n + 1}. ${i.titre}`);
    l.push('');
    l.push(`- **Valeur** : ${i.valeur}`);
    l.push(`- **Mesuré le** : ${i.mesureLe ?? NON_MESURE}`);
    l.push(`- **Source** : ${i.source}`);
    if (i.raison) l.push(`- **Raison de l'absence de mesure** : ${i.raison}`);
    for (const d of i.details ?? []) l.push(`- ${d}`);
  });
  l.push('');
  l.push('## Audit externe semestriel');
  l.push('');
  if (audit?.dernier) {
    l.push(`- Dernier audit externe : **${audit.dernier}** (rapport de l'audit du 2026-11-06 pour le premier).`);
    l.push(`- Prochain au plus tard : **${audit.echeance}**${audit.joursRestants >= 0 ? `, dans ${audit.joursRestants} jours` : `, **dépassé de ${-audit.joursRestants} jours**`}.`);
  } else {
    l.push(`- Dernier audit externe : ${NON_MESURE}.`);
  }
  l.push('- Après chaque audit, `auditExterne.dernier` de `scripts/indicateurs.config.json` est recalé sur la date de son rapport.');
  l.push('');
  l.push('## Seuils d\'alerte');
  l.push('');
  l.push('| Indicateur | Alerte quand |');
  l.push('|---|---|');
  l.push(`| Taux de vert de \`main\` | sous ${SEUILS.vertMinPct} % sur les ${SEUILS.fenetreRuns} derniers runs conclus |`);
  l.push(`| Délai de restauration | aucun drill vert depuis ${SEUILS.drillJoursMax} jours |`);
  l.push('| Âge des secrets | un secret au-delà de son échéance, ou sans date de rotation connue |');
  l.push('| Dérive de la production | une des trois sondes rouge |');
  l.push('| Audit externe | échéance semestrielle dépassée |');
  l.push('| Tout indicateur | illisible : « non mesuré » compte comme une alerte (échec fermé) |');
  l.push('');
  l.push('Les seuils sont des constantes de `scripts/indicateurs.mjs`. Un dépassement dit qu\'une chose doit bouger, jamais que la borne est trop basse.');
  l.push('');
  return `${l.join('\n')}\n`;
}

// ═══════════════ RESEAU ET DISQUE · jeton, GitHub REST, fichiers ═══════════════

export function jetonGitHub(env = process.env) {
  const direct = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (direct) return direct;
  try {
    const t = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return t || null;
  } catch {
    return null;
  }
}

/** Client minimal. `fetcher` est injectable : le temoin ne touche pas le reseau. */
export function clientGitHub({ jeton, depot, fetcher = fetch }) {
  const entetes = { authorization: `Bearer ${jeton}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  const appeler = async (chemin) => {
    const r = await fetcher(`https://api.github.com/repos/${depot}${chemin}`, { headers: entetes });
    if (!r.ok) throw new Error(`API GitHub ${r.status} sur ${chemin.replace(/\?.*$/, '')}`);
    return r;
  };
  const lire = async (chemin) => (await appeler(chemin)).json();
  /** Les journaux se rendent en texte (apres une redirection vers le stockage). */
  lire.texte = async (chemin) => (await appeler(chemin)).text();
  return lire;
}

/** Journal du job `age` du dernier run conclu de `Secrets age`. */
async function lireJournalSecrets(lire, runs) {
  const run = dernierConclu(runs);
  if (!run) throw new Error('aucun run conclu de Secrets age');
  const j = await lire(`/actions/runs/${run.id}/jobs?per_page=50`);
  const job = (j?.jobs ?? []).find((x) => x.name === 'age') ?? (j?.jobs ?? [])[0];
  if (!job?.id) throw new Error(`job du run ${run.id} introuvable`);
  const lignes = lignesDAge(await lire.texte(`/actions/jobs/${job.id}/logs`));
  if (lignes.length === 0) throw new Error(`journal du run ${run.id} sans ligne d'age`);
  return lignes;
}

async function runsDe(lire, fichier, requete) {
  const j = await lire(`/actions/workflows/${fichier}/runs?branch=main&exclude_pull_requests=true&${requete}`);
  if (!Array.isArray(j?.workflow_runs)) throw new Error(`reponse illisible pour ${fichier} (workflow_runs absent)`);
  return j.workflow_runs;
}

async function issuesOuvertes(lire, etiquette) {
  const j = await lire(`/issues?state=open&labels=${encodeURIComponent(etiquette)}&per_page=100`);
  if (!Array.isArray(j)) throw new Error(`reponse illisible pour les issues ${etiquette}`);
  return j.filter((i) => !i.pull_request);
}

/** Enveloppe une lecture : `{ ok, valeur }` ou `{ ok: false, erreur }`, jamais d'exception. */
async function tenter(fn) {
  try {
    return { ok: true, valeur: await fn() };
  } catch (e) {
    return { ok: false, erreur: String(e?.message ?? e).slice(0, 200) };
  }
}

/** Le dernier run vert de `drill-auto` : on remonte les runs reussis jusqu'au premier qui le porte. */
async function lireDrills(lire) {
  const runs = await runsDe(lire, WORKFLOWS.drill, 'status=success&per_page=30');
  const sortie = [];
  for (const run of runs) {
    const j = await lire(`/actions/runs/${run.id}/jobs?per_page=50`);
    if (!Array.isArray(j?.jobs)) throw new Error(`jobs du run ${run.id} illisibles`);
    sortie.push({
      id: run.id,
      date: run.updated_at ?? run.created_at,
      html_url: run.html_url,
      jobs: j.jobs.map((x) => ({
        name: x.name,
        conclusion: x.conclusion,
        started_at: x.started_at,
        completed_at: x.completed_at,
        steps: (x.steps ?? []).map((s) => ({ name: s.name, conclusion: s.conclusion, started_at: s.started_at, completed_at: s.completed_at })),
      })),
    });
    if (sortie.at(-1).jobs.some((x) => x.name === JOB_DRILL && x.conclusion === 'success')) break;
  }
  return sortie;
}

/** Lit toutes les sources, chacune isolee : une panne n'empeche pas les autres. */
export async function lireSources({ lire, racine, depot }) {
  const [noyau, drills, etendue, secrets, journalSecrets, issuesRouges, issuesIncident, ...sondes] = await Promise.all([
    tenter(() => runsDe(lire, WORKFLOWS.noyau, 'status=completed&per_page=100')),
    tenter(() => lireDrills(lire)),
    tenter(() => runsDe(lire, WORKFLOWS.etendue, 'status=completed&per_page=20')),
    tenter(() => runsDe(lire, WORKFLOWS.secrets, 'status=completed&per_page=10')),
    tenter(async () => lireJournalSecrets(lire, await runsDe(lire, WORKFLOWS.secrets, 'status=completed&per_page=10'))),
    tenter(() => issuesOuvertes(lire, 'ci-red')),
    tenter(() => issuesOuvertes(lire, 'incident')),
    ...WORKFLOWS.sondes.map((s) => tenter(() => runsDe(lire, s.fichier, 'status=completed&per_page=10'))),
  ]);
  const lireFichier = (chemin) => {
    try {
      return { ok: true, valeur: JSON.parse(readFileSync(resolve(racine, chemin), 'utf8')) };
    } catch (e) {
      return { ok: false, erreur: `${chemin} illisible (${e.message})` };
    }
  };
  return {
    depot,
    noyau, drills, etendue, secrets, journalSecrets, issuesRouges, issuesIncident, sondes,
    config: lireFichier('scripts/indicateurs.config.json'),
    registre: lireFichier('.github/secrets-registry.json'),
    existe: (chemin) => existsSync(resolve(racine, chemin)),
  };
}

function contexteRun(nom, lecture) {
  if (!lecture.ok) return `Dernier run de \`${nom}\` sur \`main\` : ${NON_MESURE} (${lecture.erreur}).`;
  const r = dernierConclu(lecture.valeur);
  if (!r) return `Dernier run de \`${nom}\` sur \`main\` : ${NON_MESURE} (aucun run conclu lu).`;
  return `Dernier run de \`${nom}\` sur \`main\` : ${CONCLUS_VERT.has(r.conclusion) ? 'vert' : 'rouge'} le ${jour(r.created_at)}, ${r.html_url}.`;
}

/** Calcule les six indicateurs et l'audit depuis les sources lues. */
export function calculer(src, maintenant = new Date()) {
  const lien = (chemin) => `[${chemin}](https://github.com/${src.depot}/actions/workflows/${chemin})`;
  const du = jour(maintenant.toISOString());

  const i1 = src.noyau.ok
    ? tauxDeVert(src.noyau.valeur, { source: `API GitHub Actions, ${lien(WORKFLOWS.noyau)}, branche main` })
    : nonMesure({ id: 'taux-de-vert', titre: 'Taux de vert de main (CI noyau)', source: `API GitHub Actions, ${lien(WORKFLOWS.noyau)}` }, src.noyau.erreur);

  const i2 = src.drills.ok
    ? drillRestauration(src.drills.valeur, { maintenant, source: `API GitHub Actions, ${lien(WORKFLOWS.drill)}, job ${JOB_DRILL}` })
    : nonMesure({ id: 'delai-de-restauration', titre: 'Délai de restauration éprouvé (drill mensuel)', source: `API GitHub Actions, ${lien(WORKFLOWS.drill)}` }, src.drills.erreur);

  const i3 = src.config.ok
    ? couvertureParcours(src.config.valeur, src.existe, {
        source: 'scripts/indicateurs.config.json et dossier e2e/ du dépôt',
        contexte: contexteRun('CI etendue', src.etendue),
        mesureLe: du,
      })
    : nonMesure({ id: 'parcours-critiques', titre: 'Couverture des parcours critiques', source: 'scripts/indicateurs.config.json' }, src.config.erreur);

  const i4 = src.registre.ok
    ? ageSecrets(src.registre.valeur, {
        maintenant,
        source: 'journal du dernier run de `Secrets age` (dates vivantes) et .github/secrets-registry.json',
        contexte: contexteRun('Secrets age', src.secrets),
        vivant: src.journalSecrets.ok ? src.journalSecrets.valeur : [],
        raisonVivant: src.journalSecrets.ok ? null : src.journalSecrets.erreur,
        runSecrets: src.secrets.ok ? dernierConclu(src.secrets.valeur) : null,
      })
    : nonMesure({ id: 'age-des-secrets', titre: 'Âge maximal des secrets', source: '.github/secrets-registry.json' }, src.registre.erreur);

  const i5 = deriveProduction(
    WORKFLOWS.sondes.map((s, k) => ({
      nom: s.nom,
      regarde: s.regarde,
      run: src.sondes[k].ok ? dernierConclu(src.sondes[k].valeur) : null,
      erreur: src.sondes[k].ok ? 'aucun run conclu lu sur main' : src.sondes[k].erreur,
    })),
    { source: `API GitHub Actions, ${WORKFLOWS.sondes.map((s) => lien(s.fichier)).join(', ')}` },
  );

  const i6 = src.issuesRouges.ok && src.issuesIncident.ok
    ? incidentsOuverts({ ciRed: src.issuesRouges.valeur, incident: src.issuesIncident.valeur }, {
        source: `API GitHub, issues ouvertes [ci-red](https://github.com/${src.depot}/issues?q=is%3Aissue+is%3Aopen+label%3Aci-red) et [incident](https://github.com/${src.depot}/issues?q=is%3Aissue+is%3Aopen+label%3Aincident)`,
        mesureLe: du,
      })
    : nonMesure({ id: 'incidents-ouverts', titre: 'Incidents ouverts', source: 'API GitHub, issues ouvertes ci-red et incident' }, (src.issuesRouges.erreur ?? src.issuesIncident.erreur));

  const audit = src.config.ok
    ? auditExterne(src.config.valeur.auditExterne, maintenant)
    : { dernier: null, echeance: null, joursRestants: null, alertes: [`audit externe : ${NON_MESURE} (${src.config.erreur})`] };

  const indicateurs = [i1, i2, i3, i4, i5, i6];
  return { indicateurs, audit, alertes: toutesLesAlertes(indicateurs, audit) };
}

export async function mesurer({ env = process.env, racine = process.cwd(), maintenant = new Date(), fetcher = fetch } = {}) {
  const jeton = jetonGitHub(env);
  if (!jeton) throw new Error('GH_TOKEN, GITHUB_TOKEN ou `gh auth token` : aucun jeton, rien n a ete mesure.');
  const depot = env.REPO || env.GITHUB_REPOSITORY || DEPOT_PAR_DEFAUT;
  const lire = clientGitHub({ jeton, depot, fetcher });
  const src = await lireSources({ lire, racine, depot });
  const r = calculer(src, maintenant);
  const sha = env.GITHUB_SHA || (() => {
    try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
  })();
  return { ...r, meta: { genereLe: maintenant, sha, depot } };
}

/** Verdict des seuils, sur un resultat deja ecrit : { exit, lignes }. */
export function verdictSeuils(resultat) {
  const alertes = resultat?.alertes;
  if (!Array.isArray(alertes)) return { exit: 1, lignes: ['::error title=indicateurs::resultat illisible, donc rouge.'] };
  if (alertes.length === 0) return { exit: 0, lignes: ['Aucun seuil franchi.'] };
  return { exit: 1, lignes: alertes.map((a) => `::error title=indicateurs::${a.replace(/[\r\n]+/g, ' ')}`) };
}

// ═══════════════ ENTREE CLI ═══════════════

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const val = (nom) => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
  let code = 0;
  try {
    const seuilsChemin = val('seuils');
    if (seuilsChemin) {
      const v = verdictSeuils(JSON.parse(readFileSync(resolve(process.cwd(), seuilsChemin), 'utf8')));
      for (const ligne of v.lignes) console.log(ligne);
      process.exit(v.exit);
    }
    const r = await mesurer();
    const md = rendre(r);
    if (args.includes('--ecrire')) {
      writeFileSync(resolve(process.cwd(), 'docs/INDICATEURS.md'), md, 'utf8');
      console.log('docs/INDICATEURS.md ecrit.');
    } else {
      console.log(md);
    }
    const json = val('json');
    if (json) {
      // Le JSON ne porte que ce que le markdown porte deja : rien de plus.
      writeFileSync(resolve(process.cwd(), json), JSON.stringify({ alertes: r.alertes, indicateurs: r.indicateurs.map((i) => ({ id: i.id, etat: i.etat, valeur: i.valeur, mesureLe: i.mesureLe ?? null })) }, null, 2), 'utf8');
    }
    console.log(`${r.alertes.length} alerte(s).`);
  } catch (e) {
    console.log(`::error title=indicateurs::Mesure impossible, donc rouge : ${e.message}`);
    code = 1;
  }
  process.exit(code);
}
