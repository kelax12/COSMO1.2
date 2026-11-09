// ═══════════════════════════════════════════════════════════════════
// gardes-rouges-7j.mjs · UNE GARDE ROUGE PLUS DE 7 JOURS EST UNE GARDE MORTE
//
// Appelé chaque jour par `.github/workflows/ci-alert.yml` (job
// `rouges-anciens`). Vague 9.4 du plan de reprise, constat TST-05 de l'audit
// externe du 2026-11-06 (« seuils irréalistes et gardes laissées rouges »).
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `ci-alert.yml` sonne au PREMIER échec d'une sonde, puis se tait tant que
// l'issue `ci-red` reste ouverte. Une garde qui reste rouge ne sonne donc plus
// jamais, et c'est exactement ce que l'audit a mesuré : `Posture` rouge chaque
// jour depuis le 2026-10-30 au moins, `Secrets age` rouge depuis sa pose, et
// `Sabotages`, `Mutation`, que la vague 2.3 a sortis de l'alerte, rouges sans
// que personne le lise. Une garde rouge depuis des jours n'est plus lue :
// elle ne protège plus rien et rend muettes celles qui rougiront après elle.
//
// ── LA RÈGLE ────────────────────────────────────────────────────────
//
// Toute garde dont le dernier run conclu sur `main` est rouge, et rouge
// sans interruption depuis plus de 7 jours, est dans UN de ces trois états :
//   1. corrigée (elle redevient verte, ce script ne la voit plus) ;
//   2. recalée par une DÉCISION ÉCRITE ET DATÉE dans
//      `.github/gardes-rouges-decisions.json` (date, mesure, motif, et une
//      date de revue au plus 30 jours après la décision) ;
//   3. retirée (le workflow disparaît ou est désactivé, avec la même trace
//      dans le doc de la garde).
// Sinon : ce script l'inscrit dans l'issue `ci-red` (celle de `ci-alert.yml`,
// pas une seconde) et sort en 1.
//
// ── CE QU'IL REGARDE ────────────────────────────────────────────────
//
// TOUS les workflows actifs du dépôt, pas une liste : une liste est
// précisément ce qui a laissé `Sabotages` et `Mutation` hors de vue. Seuls les
// runs de `main` qui ne sont pas des pull requests comptent ; `cancelled`,
// `skipped` et `neutral` ne sont ni verts ni rouges et sont sautés.
// `CI alert` lui-même est exclu (ses runs sont des `skipped` par construction).
//
// ── ET LES ALERTES DE DÉTECTION ÉCHUES (vague 6.1, OBS-01) ──────────
//
// Chaque issue `detection-violation` ouverte (`detection-violation.yml`)
// porte son échéance de tri dans son marqueur. Passée l'échéance, elle entre
// dans la même liste, la même issue `ci-red`, le même canal : une seule
// règle de revue, pas une seconde. Une échéance illisible vaut échue.
// REVUE DU LUNDI : le cron hebdomadaire de `ci-alert.yml` passe
// `REVUE_HEBDO=true` ; s'il reste une alerte échue, la liste est republiée
// même inchangée (une alerte échue ne doit pas se faire oublier en se taisant).
//
// ✅ ÉCHEC FERMÉ : API en panne, jeton refusé, fichier de décisions illisible
//    ou mal formé = sortie 1. Jamais un vert sur une mesure qui n'a pas eu lieu.
// ⚠️ Le dépôt est PUBLIC : l'issue ne porte que des noms de workflow, des
//    dates et des liens de runs. Aucun journal, aucune annotation recopiée.
//
// 🔴 PAS DE SHEBANG : le témoin importe ce module (cf. `scripts/CLAUDE.md`).
// Témoin : `scripts/gardes-rouges-7j.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const JOUR = 86_400_000;
export const SEUIL_JOURS = 7;
export const DECISION_MAX_JOURS = 30;
export const EXCLUS = new Set(['CI alert']);
export const MARQUEUR = '<!-- gardes-rouges-7j';
export const LABEL_DETECTION = 'detection-violation';
export const AUTEUR_BOT = 'github-actions[bot]';
const ROUGES = new Set(['failure', 'timed_out', 'startup_failure']);
const VERTS = new Set(['success']);

// ═══════════════ NOYAU PUR · aucun réseau, aucun disque ═══════════════

/**
 * Depuis quand un workflow est rouge. `runs` : runs de `main`, du plus récent
 * au plus ancien. Rend `null` si le dernier run conclu n'est pas rouge, sinon
 * `{ depuis, complet, url, n }` : `depuis` = création du PREMIER rouge de la
 * série, `complet` = un vert a été trouvé avant elle (sinon `depuis` n'est
 * qu'une borne basse : rouge AU MOINS depuis).
 */
export function rougeDepuis(runs) {
  const utiles = (runs ?? []).filter(
    (r) => r.event !== 'pull_request' && r.status === 'completed' && (ROUGES.has(r.conclusion) || VERTS.has(r.conclusion)),
  );
  if (!utiles.length || !ROUGES.has(utiles[0].conclusion)) return null;
  let premier = utiles[0];
  let n = 0;
  for (const r of utiles) {
    if (VERTS.has(r.conclusion)) return { depuis: premier.created_at, complet: true, url: utiles[0].html_url, n };
    premier = r;
    n += 1;
  }
  return { depuis: premier.created_at, complet: false, url: utiles[0].html_url, n };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Valide le fichier de décisions. Rend la liste des erreurs (vide = bien formé). */
export function validerDecisions(fichier) {
  const erreurs = [];
  const liste = fichier?.decisions;
  if (!Array.isArray(liste)) return ['`decisions` absent ou pas un tableau'];
  const vus = new Set();
  for (const d of liste) {
    const id = d?.workflow ?? '(sans nom)';
    if (typeof d?.workflow !== 'string' || !d.workflow) erreurs.push(`${id} : \`workflow\` manquant`);
    if (vus.has(id)) erreurs.push(`${id} : deux décisions pour le même workflow`);
    vus.add(id);
    if (!DATE.test(d?.decide_le ?? '')) erreurs.push(`${id} : \`decide_le\` n'est pas AAAA-MM-JJ`);
    if (!DATE.test(d?.revoir_le ?? '')) erreurs.push(`${id} : \`revoir_le\` n'est pas AAAA-MM-JJ`);
    if (DATE.test(d?.decide_le ?? '') && DATE.test(d?.revoir_le ?? '')) {
      const ecart = (Date.parse(d.revoir_le) - Date.parse(d.decide_le)) / JOUR;
      if (ecart < 0) erreurs.push(`${id} : revue avant la décision`);
      if (ecart > DECISION_MAX_JOURS) {
        erreurs.push(`${id} : revue à ${ecart} j de la décision, plafond ${DECISION_MAX_JOURS} j (une décision se relit, elle ne se pose pas pour toujours)`);
      }
    }
    if (String(d?.mesure ?? '').length < 20) erreurs.push(`${id} : \`mesure\` absente ou trop courte (ce qui a été mesuré, et quand)`);
    if (String(d?.motif ?? '').length < 40) erreurs.push(`${id} : \`motif\` absent ou trop court (pourquoi ce rouge est assumé)`);
    if (String(d?.doc ?? '').length < 5) erreurs.push(`${id} : \`doc\` absent (où la décision est écrite en entier)`);
  }
  return erreurs;
}

/**
 * Le verdict. `rouges` : [{ workflow, depuis, complet, url }].
 * Rend { violations, recales, decisionsSansObjet }.
 */
export function juger({ rouges, decisions, maintenant, seuil = SEUIL_JOURS }) {
  const parNom = new Map((decisions ?? []).map((d) => [d.workflow, d]));
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  const violations = [];
  const recales = [];
  for (const r of rouges) {
    const jours = Math.floor((maintenant.getTime() - Date.parse(r.depuis)) / JOUR);
    if (jours <= seuil) continue;
    const d = parNom.get(r.workflow);
    const ligne = { ...r, jours };
    if (d && d.revoir_le >= aujourdhui) recales.push({ ...ligne, decision: d });
    else violations.push({ ...ligne, decisionEchue: d ?? null });
  }
  const rougesNoms = new Set(rouges.map((r) => r.workflow));
  const decisionsSansObjet = (decisions ?? []).filter((d) => !rougesNoms.has(d.workflow)).map((d) => d.workflow);
  return { violations, recales, decisionsSansObjet };
}

/**
 * Les alertes de détection ouvertes dont l'échéance est passée. `issues` :
 * issues ouvertes du label `detection-violation`. L'échéance est lue dans le
 * marqueur `echeance=<ISO>` du corps ; absente ou illisible, l'alerte est
 * échue depuis sa création (échec fermé).
 */
export function alertesEchues(issues, maintenant) {
  const out = [];
  for (const i of issues ?? []) {
    if (i.pull_request || i.state === 'closed') continue;
    const lue = /echeance=(\S+?) -->/.exec(String(i.body ?? ''))?.[1];
    const t = Date.parse(lue ?? '');
    if (Number.isFinite(t) && maintenant.getTime() <= t) continue;
    const echeance = Number.isFinite(t) ? t : Date.parse(i.created_at);
    const connue = Number.isFinite(echeance);
    out.push({
      numero: i.number,
      url: i.html_url,
      echeance: connue ? new Date(echeance).toISOString().slice(0, 10) : 'inconnue',
      lisible: Number.isFinite(t),
      jours: connue ? Math.floor((maintenant.getTime() - echeance) / JOUR) : null,
    });
  }
  return out.sort((a, b) => a.numero - b.numero);
}

/** Signature stable d'un verdict : ne commenter l'issue que quand elle change. */
export function signature(violations, alertes = []) {
  return [
    ...violations.map((v) => `${v.workflow}@${String(v.depuis).slice(0, 10)}`),
    ...alertes.map((a) => `alerte#${a.numero}`),
  ].sort().join('|');
}

/** Corps markdown de l'issue. Noms, dates, liens : rien d'autre (dépôt public). */
export function corps({ violations, recales, decisionsSansObjet, alertes = [], maintenant, runUrl }) {
  const jour = maintenant.toISOString().slice(0, 10);
  const l = [];
  l.push(`${MARQUEUR} ${signature(violations, alertes)} -->`);
  l.push(`**Gardes rouges depuis plus de ${SEUIL_JOURS} jours (${jour})**`);
  l.push('');
  if (violations.length) {
    l.push('Chacune doit être corrigée, recalée par une décision écrite et datée (`.github/gardes-rouges-decisions.json`, revue à 30 jours au plus), ou retirée :');
    l.push('');
    for (const v of violations) {
      const borne = v.complet ? '' : 'au moins ';
      const echue = v.decisionEchue ? ` · décision du ${v.decisionEchue.decide_le} ÉCHUE le ${v.decisionEchue.revoir_le}` : '';
      l.push(`- **${v.workflow}** : rouge depuis ${borne}${v.jours} j (${String(v.depuis).slice(0, 10)}), dernier run : ${v.url}${echue}`);
    }
  } else {
    l.push('Aucune garde rouge depuis plus de 7 jours sans décision.');
  }
  if (alertes.length) {
    l.push('');
    l.push(`**Alertes de détection échues** (label \`${LABEL_DETECTION}\`, propriétaire Axel) : trier hors du dépôt, puis fermer l'issue avec sa qualification en une ligne.`);
    for (const a of alertes) {
      const quand = a.lisible ? `échue depuis ${a.jours} j (échéance du ${a.echeance})` : `échéance illisible, ouverte le ${a.echeance}`;
      l.push(`- alerte n° ${a.numero} : ${quand} : ${a.url}`);
    }
  }
  if (recales.length) {
    l.push('');
    l.push('Recalées par décision (à relire à la date dite) :');
    for (const r of recales) l.push(`- ${r.workflow} : rouge depuis ${r.jours} j, décision du ${r.decision.decide_le}, revue le ${r.decision.revoir_le} (${r.decision.doc})`);
  }
  if (decisionsSansObjet.length) {
    l.push('');
    l.push(`Décisions sans objet (le workflow n'est plus rouge) : ${decisionsSansObjet.join(', ')}. Les retirer du fichier.`);
  }
  if (runUrl) {
    l.push('');
    l.push(`Mesure : ${runUrl}`);
  }
  return l.join('\n');
}

// ═══════════════ RÉSEAU · GitHub REST, jeton exigé ═══════════════

async function api(chemin, { token, repo, methode = 'GET', corpsJson } = {}) {
  const rep = await fetch(`https://api.github.com/repos/${repo}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      ...(corpsJson ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpsJson ? JSON.stringify(corpsJson) : undefined,
  });
  if (!rep.ok) throw new Error(`HTTP ${rep.status} sur ${methode} ${chemin.split('?')[0]}`);
  return rep.status === 204 ? null : rep.json();
}

export async function mesurer({ token, repo }) {
  const { workflows } = await api('/actions/workflows?per_page=100', { token, repo });
  const rouges = [];
  for (const w of workflows ?? []) {
    if (w.state !== 'active' || EXCLUS.has(w.name)) continue;
    const { workflow_runs: runs } = await api(
      `/actions/workflows/${w.id}/runs?branch=main&exclude_pull_requests=true&per_page=60`,
      { token, repo },
    );
    const r = rougeDepuis(runs);
    if (r) rouges.push({ workflow: w.name, ...r });
  }
  return rouges;
}

/** Les issues de détection ouvertes (label `detection-violation`). */
export async function mesurerAlertes({ token, repo }) {
  return api(`/issues?state=open&labels=${LABEL_DETECTION}&per_page=100`, { token, repo });
}

/** Ouvre ou met à jour l'issue `ci-red`. Rend { url, nouveau }. `forcer` :
 *  republier même si la liste n'a pas changé (revue du lundi). */
export async function publier({ token, repo, texte, maintenant, forcer = false }) {
  const sig = /<!-- gardes-rouges-7j (.*?) -->/.exec(texte)?.[1] ?? '';
  const ouvertes = await api('/issues?state=open&labels=ci-red&per_page=1', { token, repo });
  if (!ouvertes.length) {
    const titre = `Gardes rouges depuis plus de ${SEUIL_JOURS} jours (${maintenant.toISOString().slice(0, 10)})`;
    const cree = await api('/issues', { token, repo, methode: 'POST', corpsJson: { title: titre, body: texte, labels: ['ci-red'] } });
    return { url: cree.html_url, nouveau: true };
  }
  const issue = ouvertes[0];
  const commentaires = await api(`/issues/${issue.number}/comments?per_page=100`, { token, repo });
  // L'issue créée par ce script porte le marqueur dans son CORPS : il compte comme précédent.
  // Seuls les écrits du bot comptent (vague 6.1) : sur un dépôt public, un commentaire
  // tiers qui recopierait le marqueur ferait taire la liste.
  const precedent = [{ body: issue.body ?? '', html_url: issue.html_url, user: issue.user }, ...commentaires]
    .reverse()
    .find((c) => c?.user?.login === AUTEUR_BOT && String(c.body).startsWith(MARQUEUR));
  const sigPrecedente = precedent ? /<!-- gardes-rouges-7j (.*?) -->/.exec(precedent.body)?.[1] ?? null : null;
  if (sigPrecedente === sig && !forcer) return { url: precedent.html_url, nouveau: false };
  const c = await api(`/issues/${issue.number}/comments`, { token, repo, methode: 'POST', corpsJson: { body: texte } });
  return { url: c.html_url, nouveau: true };
}

export async function run(env = process.env, maintenant = new Date()) {
  const lignes = [];
  if (!env.GH_TOKEN || !env.REPO) {
    return { exit: 1, lignes: ['::error title=gardes-7j::GH_TOKEN ou REPO absent : rien n a été mesuré, échec et non saut.'] };
  }
  let fichier;
  try {
    fichier = JSON.parse(readFileSync(resolve(process.cwd(), '.github/gardes-rouges-decisions.json'), 'utf8'));
  } catch (e) {
    return { exit: 1, lignes: [`::error title=gardes-7j::décisions illisibles (${e.message})`] };
  }
  const erreursDecisions = validerDecisions(fichier);
  if (erreursDecisions.length) {
    return { exit: 1, lignes: erreursDecisions.map((e) => `::error title=gardes-7j · décision mal formée::${e}`) };
  }
  const rouges = await mesurer({ token: env.GH_TOKEN, repo: env.REPO });
  const verdict = juger({ rouges, decisions: fichier.decisions, maintenant });
  verdict.alertes = alertesEchues(await mesurerAlertes({ token: env.GH_TOKEN, repo: env.REPO }), maintenant);
  const texte = corps({ ...verdict, maintenant, runUrl: env.RUN_URL });
  lignes.push(texte);
  const aSignaler = verdict.violations.length + verdict.alertes.length;
  let pub = { url: '', nouveau: false };
  // `DRY_RUN=1` : mesurer et imprimer, sans écrire l'issue (mesure locale).
  if (aSignaler && env.DRY_RUN !== '1') {
    const forcer = env.REVUE_HEBDO === 'true' && verdict.alertes.length > 0;
    pub = await publier({ token: env.GH_TOKEN, repo: env.REPO, texte, maintenant, forcer });
    const etat = pub.nouveau ? (forcer ? ' (revue du lundi)' : ' (mise à jour)') : ' (inchangée, pas de nouveau commentaire)';
    lignes.push(`Issue ci-red : ${pub.url}${etat}`);
  }
  for (const v of verdict.violations) {
    lignes.push(`::error title=gardes-7j · ${v.workflow}::rouge depuis ${v.complet ? '' : 'au moins '}${v.jours} j sans décision écrite`);
  }
  for (const a of verdict.alertes) {
    lignes.push(`::error title=gardes-7j · alerte de détection n° ${a.numero}::${a.lisible ? `échue depuis ${a.jours} j` : 'échéance illisible'}, non triée`);
  }
  return { exit: aSignaler ? 1 : 0, lignes, verdict, pub };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let r;
  try {
    r = await run();
  } catch (e) {
    r = { exit: 1, lignes: [`::error title=gardes-7j::mesure impossible (${e.message}) : échec fermé`] };
  }
  for (const l of r.lignes) console.log(l);
  if (process.env.GITHUB_OUTPUT) {
    const noms = [
      ...(r.verdict?.violations ?? []).map((v) => v.workflow),
      ...(r.verdict?.alertes ?? []).map((a) => `alerte de détection n° ${a.numero}`),
    ].join(', ');
    appendFileSync(process.env.GITHUB_OUTPUT, `nouveau=${r.pub?.nouveau ? 'true' : 'false'}\nnoms=${noms}\nissue=${r.pub?.url ?? ''}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY && r.lignes[0] && !r.lignes[0].startsWith('::')) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${r.lignes[0].split('\n').slice(1).join('\n')}\n`);
  }
  process.exit(r.exit);
}
