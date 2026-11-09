// ═══════════════════════════════════════════════════════════════════
// detection-violation-alerte.mjs · UN SIGNAL DEVIENT UNE ISSUE, AVEC UN
// PROPRIÉTAIRE, UNE ÉCHÉANCE, ET UN PLAFOND
//
// Appelé par `.github/workflows/detection-violation.yml`, job `alerter`, qui
// ne reçoit AUCUN secret de production : il ne connaît du détecteur que trois
// sorties (statut, catégories d'un vocabulaire fermé, date de détection).
// Vague 6.1 (OBS-01) : « des signaux produits et jamais traités ». Le signal
// du 2026-10-26 (PR n° 125) a été poussé sur le salon, puis n'a été trié par
// personne pendant 13 jours : pas d'issue, pas de propriétaire, pas d'échéance.
//
// ── CE QU'IL FAIT ───────────────────────────────────────────────────
//
// · Une issue `detection-violation` OUVERTE à la fois, ASSIGNÉE au
//   propriétaire du dépôt (Axel), avec une ÉCHÉANCE de tri de 72 h (le délai
//   CNIL court depuis la prise de connaissance : le tri doit tenir dedans).
// · Tant qu'elle est ouverte, un nouveau signal ne la commente que si
//   l'ensemble des catégories CHANGE (empreinte, pas de texte en clair).
// · PLAFOND : au plus `PLAFOND_7J` publications (issue ou commentaire) sur
//   7 jours glissants. Au-delà, rien n'est écrit ni poussé, le job rougit
//   (GitHub notifie l'échec) et le dit : un canal inondé apprend à se taire.
// · La revue des issues ÉCHUES vit dans la règle des 7 jours
//   (`scripts/gardes-rouges-7j.mjs`), pas ici : une seule règle.
//
// ⚠️ DÉPÔT PUBLIC : l'issue ne dit QUE « seuil franchi le JJ/MM, voir le
// résumé du job », le propriétaire et l'échéance. Les catégories n'y sont
// pas (une empreinte seulement) : elles vont au salon ops, privé.
// ✅ ÉCHEC FERMÉ : jeton absent, API refusée = sortie 1.
//
// 🔴 PAS DE SHEBANG : le témoin importe ce module.
// Témoin : `scripts/detection-violation.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { CATEGORIES } from './detection-violation.mjs';

const JOUR = 86_400_000;
export const LABEL = 'detection-violation';
export const ECHEANCE_H = 72;
export const PLAFOND_7J = 3;
export const MARQUEUR = '<!-- detection-violation';
/** Seule identité dont les écrits comptent. Sur un dépôt public, n'importe
 *  quel compte peut commenter en recopiant le marqueur : il ferait croire à
 *  un signal « inchangé », ou remplirait le plafond, et l'alerte se tairait. */
export const AUTEUR = 'github-actions[bot]';
const duBot = (e) => e?.user?.login === AUTEUR;

// ═══════════════ NOYAU PUR ═══════════════

/** Catégories reçues du détecteur, filtrées par le vocabulaire fermé. Une
 *  sortie vide ou un statut absent (détecteur tombé avant d'écrire) vaut
 *  « source non lue » : jamais un silence. */
export function categoriesDe({ statut, categories }) {
  if (statut === 'rien') return [];
  const liste = String(categories ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  const sures = [...new Set(liste.map((c) => (CATEGORIES.has(c) ? c : 'categorie-inconnue')))].sort();
  return sures.length ? sures : ['source-non-lue'];
}

export const empreinte = (cats) => createHash('sha256').update(cats.join(',')).digest('hex').slice(0, 12);

const jjmm = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const hhmm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

/** Corps public d'une issue ou d'un commentaire. */
export function texte({ cats, detecteLe, echeance, runUrl, proprietaire, premier }) {
  const marque = `${MARQUEUR} empreinte=${empreinte(cats)} echeance=${echeance.toISOString()} -->`;
  const l = [marque, `**Seuil de détection franchi le ${jjmm(detecteLe)}**, voir le résumé du job : ${runUrl}`, ''];
  if (premier) {
    l.push(`- Propriétaire : ${proprietaire} (assigné)`);
    l.push(`- Échéance du tri : ${jjmm(echeance)} à ${hhmm(echeance)} UTC (${ECHEANCE_H} h après la détection)`);
    l.push('');
    l.push('Le tri se fait hors de ce dépôt public. Fermer cette issue avec une qualification en une ligne, sans identifiant : « faux positif expliqué », « usage légitime » ou « violation possible, procédure engagée ».');
    l.push('Passée l\'échéance, la règle des 7 jours (`ci-alert.yml`) la liste dans l\'issue `ci-red`, et la revue du lundi la rappelle.');
  } else {
    l.push(`Nouveau signal sur l'issue ouverte (ensemble de catégories changé). L'échéance de l'issue ne bouge pas.`);
  }
  return l.join('\n');
}

/** Publications de ce script sur 7 jours glissants (corps d'issue et commentaires marqués). */
export function publicationsRecentes(elements, maintenant) {
  const depuis = maintenant.getTime() - 7 * JOUR;
  return elements.filter((e) => duBot(e) && String(e.body ?? '').startsWith(MARQUEUR) && Date.parse(e.created_at) >= depuis).length;
}

/** La dernière empreinte écrite PAR LE BOT sur l'issue ouverte. */
export function derniereEmpreinte(elements) {
  const m = [...elements].reverse().find((e) => duBot(e) && String(e.body ?? '').startsWith(MARQUEUR));
  return m ? /empreinte=([0-9a-f]+)/.exec(m.body)?.[1] ?? null : null;
}

/**
 * Le verdict, sans réseau. `ouverte` : l'issue ouverte et ses commentaires,
 * ou null. `recentes` : publications marquées des 7 derniers jours.
 * Rend { action: 'rien' | 'creer' | 'commenter' | 'inchange' | 'plafond' }.
 */
export function decider({ cats, ouverte, recentes, plafond = PLAFOND_7J }) {
  if (!cats.length) return { action: 'rien' };
  if (ouverte && derniereEmpreinte(ouverte.elements) === empreinte(cats)) return { action: 'inchange' };
  if (recentes >= plafond) return { action: 'plafond' };
  return { action: ouverte ? 'commenter' : 'creer' };
}

// ═══════════════ RÉSEAU · GitHub REST ═══════════════

async function api(chemin, { token, repo, methode = 'GET', corpsJson, fetchImpl = fetch }) {
  const rep = await fetchImpl(`https://api.github.com/repos/${repo}${chemin}`, {
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

/** Issues `detection-violation` des 7 derniers jours (ouvertes ou fermées), et leurs commentaires. */
async function etat({ token, repo, maintenant, fetchImpl }) {
  const depuis = new Date(maintenant.getTime() - 7 * JOUR).toISOString();
  const issues = await api(`/issues?state=all&labels=${LABEL}&since=${depuis}&per_page=100`, { token, repo, fetchImpl });
  const elements = [];
  let ouverte = null;
  for (const i of issues) {
    const commentaires = await api(`/issues/${i.number}/comments?since=${depuis}&per_page=100`, { token, repo, fetchImpl });
    const fil = [{ body: i.body, created_at: i.created_at, user: i.user }, ...commentaires];
    elements.push(...fil);
    if (i.state === 'open' && !ouverte) ouverte = { number: i.number, html_url: i.html_url, elements: fil };
  }
  return { ouverte, recentes: publicationsRecentes(elements, maintenant) };
}

export async function run(env = process.env, { maintenant = new Date(), fetchImpl = fetch } = {}) {
  const cats = categoriesDe({ statut: env.STATUT, categories: env.CATEGORIES });
  if (!cats.length) return { exit: 0, lignes: ['Aucun signal : rien à publier.'], sorties: { publie: 'false' } };
  if (env.EXERCICE === 'true') {
    return { exit: 0, lignes: [`Exercice : ${cats.join(', ')} aurait été publié. Rien n'est écrit.`], sorties: { publie: 'false' } };
  }
  if (!env.GH_TOKEN || !env.REPO) {
    return { exit: 1, lignes: ['::error title=detection-alerte::GH_TOKEN ou REPO absent : signal NON publié, échec fermé.'], sorties: { publie: 'false' } };
  }
  const repo = env.REPO;
  const token = env.GH_TOKEN;
  const proprietaire = env.PROPRIETAIRE || repo.split('/')[0];
  const detecteLe = Number.isFinite(Date.parse(env.DETECTE_LE ?? '')) ? new Date(env.DETECTE_LE) : maintenant;
  const echeance = new Date(detecteLe.getTime() + ECHEANCE_H * 3600_000);
  const { ouverte, recentes } = await etat({ token, repo, maintenant, fetchImpl });
  const v = decider({ cats, ouverte, recentes });
  const lignes = [`Catégories : ${cats.join(', ')} ; publications sur 7 jours : ${recentes}/${PLAFOND_7J} ; issue ouverte : ${ouverte ? `#${ouverte.number}` : 'aucune'}.`];

  if (v.action === 'inchange') {
    lignes.push(`Même signal que sur l'issue #${ouverte.number} : pas de nouveau commentaire, rien poussé.`);
    return { exit: 0, lignes, sorties: { publie: 'false', issue: ouverte.html_url } };
  }
  if (v.action === 'plafond') {
    lignes.push(`::error title=detection-alerte · plafond::${recentes} publications sur 7 jours (plafond ${PLAFOND_7J}) : rien n'est écrit ni poussé. Le résumé du job porte le signal.`);
    return { exit: 1, lignes, sorties: { publie: 'false', issue: ouverte?.html_url ?? '' } };
  }
  if (v.action === 'commenter') {
    const c = await api(`/issues/${ouverte.number}/comments`, {
      token, repo, fetchImpl, methode: 'POST',
      corpsJson: { body: texte({ cats, detecteLe, echeance, runUrl: env.RUN_URL, proprietaire, premier: false }) },
    });
    lignes.push(`Commentaire ajouté : ${c.html_url}`);
    return { exit: 0, lignes, sorties: { publie: 'true', issue: c.html_url, resume: `nouveau signal (${cats.join(', ')}) sur l'issue ouverte` } };
  }
  // Le label peut ne pas exister au premier passage ; 422 = il existe déjà.
  try {
    await api('/labels', { token, repo, fetchImpl, methode: 'POST', corpsJson: { name: LABEL, color: 'b60205', description: 'Signal du detecteur de violation, a trier sous 72 h' } });
  } catch (e) {
    if (!/HTTP 422/.test(e.message)) throw e;
  }
  const cree = await api('/issues', {
    token, repo, fetchImpl, methode: 'POST',
    corpsJson: {
      title: `Seuil de détection franchi le ${jjmm(detecteLe)}`,
      body: texte({ cats, detecteLe, echeance, runUrl: env.RUN_URL, proprietaire, premier: true }),
      labels: [LABEL],
      assignees: [proprietaire],
    },
  });
  lignes.push(`Issue créée : ${cree.html_url} (échéance ${echeance.toISOString()})`);
  return {
    exit: 0,
    lignes,
    sorties: { publie: 'true', issue: cree.html_url, resume: `seuil franchi (${cats.join(', ')}), tri avant le ${jjmm(echeance)} ${hhmm(echeance)} UTC` },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let r;
  try {
    r = await run();
  } catch (e) {
    r = { exit: 1, lignes: [`::error title=detection-alerte::publication impossible (${e.message}) : échec fermé`], sorties: { publie: 'false' } };
  }
  for (const l of r.lignes) console.log(l);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(r.sorties).map(([k, v]) => `${k}=${v}\n`).join(''));
  }
  process.exit(r.exit);
}
