// ═══════════════════════════════════════════════════════════════════
// M-63 + M-75 · préavis de 30 jours des CGU aux comptes existants
// ═══════════════════════════════════════════════════════════════════
//
// CGU art. 11 : une modification substantielle est notifiée par e-mail 30
// jours avant son entrée en vigueur. Sans cet envoi, les clauses 3.3 (âge),
// 6.3 (sous-traitance en mode entreprise) et 9 (responsabilité envers un
// professionnel), posées le 2026-09-24, ne sont pas opposables aux comptes
// créés avant cette date (`docs/LEGAL-JOURNAL.md`). Le même message porte la
// suppression des comptes inactifs depuis 3 ans (politique de confidentialité,
// 2026-10-13, `C-121`) et, pour les comptes créés par Google avant le
// 2026-10-13, un lien vers des CGU qu'ils n'ont jamais vues (`M-75`, E10).
//
// ── À BLANC PAR DÉFAUT ──────────────────────────────────────────────
//
//   node scripts/cgu-notice.mjs              comptage agrégé, rien n'est envoyé
//   node scripts/cgu-notice.mjs --preview    imprime le message, aucun réseau
//   node scripts/cgu-notice.mjs --send --expected <N> --proof <fichier>
//
// Le comptage ne rapatrie que des NOMBRES (`count(*) filter`) : aucune adresse
// ne quitte la base en mode à blanc. Seul `--send` lit les adresses, en
// mémoire, et ne les imprime ni ne les écrit jamais : la preuve locale porte
// un haché SHA-256 de l'adresse et l'identifiant Resend du message.
//
// ❌ Ne JAMAIS écrire une adresse dans un fichier du dépôt : il est PUBLIC.
//    `--proof` refuse un chemin situé dans le dépôt.
// ❌ Ne JAMAIS envoyer en copie à plusieurs destinataires : un message par
//    compte, sinon chacun lit l'adresse des autres.
// ⚠️ `--expected` doit égaler le compte du jour : un écart (compte créé ou
//    supprimé depuis le comptage) arrête tout avant le premier envoi.
// ⚠️ Rien ici n'est un avis juridique.
// ═══════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';
const APP_URL = 'https://thecosmo.app';
const CONTACT = 'contact@thecosmo.app';
const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Délai de l'art. 11 des CGU. */
export const PREAVIS_JOURS = 30;
/** Avant cette date, l'écran de connexion Google ne présentait pas les CGU (E10). */
export const GOOGLE_SANS_CGU_AVANT = '2026-10-13';
/** Resend accepte 2 requêtes par seconde : jamais plus vite qu'une toutes les 600 ms. */
export const DELAI_MIN_MS = 600;
export const DELAI_DEFAUT_MS = 1500;
/** Au-delà, le script refuse : un envoi de cette taille se repense (quota Resend). */
export const PLAFOND_ENVOIS = 500;

// ── Sélection des destinataires ─────────────────────────────────────
//
// Un seul prédicat, partagé par le comptage et par l'envoi : ce qui est
// compté est exactement ce qui part. `admin_stats_excluded_uids()` (mig. 149)
// retire le compte de démonstration et le compte de test, sans recopier leurs
// identifiants ici.
const PREDICAT = `
  u.email IS NOT NULL AND u.email <> ''
  AND u.email_confirmed_at IS NOT NULL
  AND NOT coalesce(u.is_anonymous, false)
  AND u.deleted_at IS NULL
  AND (u.banned_until IS NULL OR u.banned_until <= now())
  AND NOT (u.id = ANY (public.admin_stats_excluded_uids()))`;

const GOOGLE_SANS_CGU = `(
  (SELECT i.provider FROM auth.identities i WHERE i.user_id = u.id ORDER BY i.created_at LIMIT 1) = 'google'
  AND u.created_at < '${GOOGLE_SANS_CGU_AVANT}')`;

/** Agrégats seulement : cette requête ne peut rendre aucune adresse. */
export function sqlComptage() {
  return `SELECT
  count(*) AS tous,
  count(*) FILTER (WHERE u.created_at < '2026-09-24') AS avant_cgu_0924,
  count(*) FILTER (WHERE ${GOOGLE_SANS_CGU}) AS google_sans_cgu
FROM auth.users u
WHERE ${PREDICAT};`;
}

/** Mode `--send` uniquement : rend les adresses, gardées en mémoire. */
export function sqlDestinataires() {
  return `SELECT u.email, ${GOOGLE_SANS_CGU} AS google_sans_cgu
FROM auth.users u
WHERE ${PREDICAT}
ORDER BY u.created_at;`;
}

// ── Le message ──────────────────────────────────────────────────────

/** Date d'entrée en vigueur : date d'envoi + 30 jours. */
export function dateEffet(maintenant = new Date()) {
  return new Date(maintenant.getTime() + PREAVIS_JOURS * 86_400_000);
}

function formater(date, langue) {
  return new Intl.DateTimeFormat(langue === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

export function objet(effet) {
  return `Cosmo : nos conditions d'utilisation évoluent le ${formater(effet, 'fr')} / Our terms change on ${formater(effet, 'en')}`;
}

/**
 * Le texte, en lignes. Un seul e-mail bilingue : la langue d'un compte n'est
 * enregistrée nulle part en base (relu le 2026-10-18 : ni `profiles`, ni les
 * métadonnées d'inscription ; seule `org_settings.locale` existe, par
 * organisation).
 */
export function lignes(effet, { googleSansCgu = false } = {}) {
  const fr = formater(effet, 'fr');
  const en = formater(effet, 'en');
  return [
    '(English version below)',
    '',
    'Bonjour,',
    '',
    `Nous avons mis à jour les conditions générales d'utilisation (CGU) de Cosmo. Trois changements s'appliqueront à votre compte le ${fr}, 30 jours après ce message :`,
    '',
    "- Âge minimum (article 3.3) : Cosmo est destiné aux personnes d'au moins 15 ans. En dessous, il faut l'accord d'un parent.",
    "- Espace entreprise (article 6.3) : une organisation qui utilise l'espace entreprise est responsable des données de ses membres, et Cosmo les traite pour son compte, comme sous-traitant au sens du RGPD.",
    "- Usage professionnel (article 9) : envers un professionnel, la responsabilité de Cosmo est limitée aux dommages directs et aux sommes versées sur les 12 derniers mois, sauf faute lourde ou dolosive. Pour un particulier, rien ne change : aucune limitation au-delà de ce que permet la loi.",
    '',
    'Notre politique de confidentialité prévoit aussi désormais qu\'un compte sans aucune connexion pendant 3 ans est supprimé, après un e-mail d\'avertissement envoyé 30 jours avant.',
    '',
    ...(googleSansCgu
      ? [
          `Vous avez créé votre compte avec Google, depuis un écran qui ne présentait pas encore nos CGU. Vous pouvez les lire ici : ${APP_URL}/cgu`,
          '',
        ]
      : []),
    'Les autres changements de ces dernières semaines vous sont favorables ou purement informatifs, et s\'appliquent déjà.',
    '',
    `Si vous n'acceptez pas ces changements, vous pouvez supprimer votre compte sans frais avant le ${fr}, depuis les Paramètres (exportez d'abord vos données, onglet Mes données, si vous souhaitez les garder). Sinon, vous n'avez rien à faire.`,
    '',
    `CGU : ${APP_URL}/cgu`,
    `Politique de confidentialité : ${APP_URL}/politique-confidentialite`,
    `Une question : répondez à ce message ou écrivez à ${CONTACT}.`,
    '',
    'Axel Longatte, éditeur de Cosmo',
    '',
    '---',
    '',
    'Hello,',
    '',
    `We have updated the Cosmo terms of use. Three changes will apply to your account on ${en}, 30 days after this message:`,
    '',
    '- Minimum age (section 3.3): Cosmo is intended for people aged 15 or over. Below that age, a parent must agree.',
    '- Business workspace (section 6.3): an organisation using the business workspace is the controller of its members\' data, and Cosmo processes that data on its behalf, as a processor under the GDPR.',
    '- Professional use (section 9): towards a business user, Cosmo\'s liability is limited to direct damage and to the amounts paid over the last 12 months, except in cases of gross negligence or wilful misconduct. For consumers, nothing changes: no limitation beyond what the law allows.',
    '',
    'Our privacy policy now also provides that an account with no sign-in for 3 years is deleted, after a warning email sent 30 days beforehand.',
    '',
    ...(googleSansCgu
      ? [
          `You created your account with Google, from a screen that did not yet show our terms. You can read them here: ${APP_URL}/en/terms`,
          '',
        ]
      : []),
    'The other recent changes are in your favour or purely informative, and already apply.',
    '',
    `If you do not accept these changes, you can delete your account free of charge before ${en}, from Settings (export your data first, from the My data tab, if you want to keep it). Otherwise, there is nothing to do.`,
    '',
    `Terms: ${APP_URL}/en/terms`,
    `Privacy policy: ${APP_URL}/en/privacy-policy`,
    `Questions: reply to this email or write to ${CONTACT}.`,
    '',
    'Axel Longatte, publisher of Cosmo',
  ];
}

function echapper(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function message(effet, options) {
  const l = lignes(effet, options);
  const html = l
    .map((x) => {
      if (x === '') return '';
      if (x === '---') return '<hr style="margin:24px 0">';
      const corps = echapper(x)
        .replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`)
        .replace(new RegExp(CONTACT.replace(/\./g, '\\.'), 'g'), `<a href="mailto:${CONTACT}">${CONTACT}</a>`);
      return `<p style="margin:0 0 12px">${corps}</p>`;
    })
    .join('');
  return { subject: objet(effet), text: l.join('\n'), html };
}

// ── Arguments ───────────────────────────────────────────────────────

export function lireArguments(argv) {
  const opts = { send: false, preview: false, expected: null, proof: null, delaiMs: DELAI_DEFAUT_MS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--send') opts.send = true;
    else if (a === '--preview') opts.preview = true;
    else if (a === '--expected') opts.expected = Number(argv[++i]);
    else if (a === '--proof') opts.proof = argv[++i] ?? null;
    else if (a === '--delay-ms') opts.delaiMs = Number(argv[++i]);
    else throw new Error(`argument inconnu : ${a}`);
  }
  if (opts.send) {
    if (!Number.isInteger(opts.expected) || opts.expected < 1) {
      throw new Error('--send exige --expected <N>, le nombre de destinataires du comptage à blanc du jour');
    }
    if (!opts.proof) throw new Error('--send exige --proof <fichier>, hors du dépôt');
    if (!Number.isFinite(opts.delaiMs) || opts.delaiMs < DELAI_MIN_MS) {
      throw new Error(`--delay-ms doit valoir au moins ${DELAI_MIN_MS} (Resend : 2 requêtes par seconde)`);
    }
  }
  return opts;
}

/** Refuse un fichier de preuve situé dans le dépôt, qui est public. */
export function verifierCheminPreuve(chemin, depot = DEPOT) {
  const abs = resolve(chemin);
  const rel = relative(depot, abs);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Error('--proof doit être HORS du dépôt (dépôt public) : par exemple dans COSMO-coffre-hors-depot');
  }
  return abs;
}

export function hacher(email) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** Les hachés déjà servis, pour reprendre un envoi interrompu sans doublon. */
export function dejaEnvoyes(chemin) {
  if (!existsSync(chemin)) return new Set();
  const faits = new Set();
  for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
    if (!ligne.trim()) continue;
    try {
      const e = JSON.parse(ligne);
      if (e.ok && e.sha256) faits.add(e.sha256);
    } catch {
      // ligne tronquée par une interruption : ignorée, le message repartira
    }
  }
  return faits;
}

// ── Réseau (injectable pour les tests) ──────────────────────────────

export async function interroger(sql, { token, projet, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${projet}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`API Supabase ${res.status}`);
  return res.json();
}

export async function compter(env, { fetchImpl = fetch } = {}) {
  const lignesSql = await interroger(sqlComptage(), {
    token: env.SUPABASE_ACCESS_TOKEN,
    projet: env.SUPABASE_PROJECT_REF ?? PROJET_DEFAUT,
    fetchImpl,
  });
  const r = lignesSql[0] ?? {};
  return {
    tous: Number(r.tous ?? 0),
    avantCgu0924: Number(r.avant_cgu_0924 ?? 0),
    googleSansCgu: Number(r.google_sans_cgu ?? 0),
  };
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * L'envoi réel. N'imprime et n'écrit jamais une adresse : le journal de
 * preuve porte le haché, l'identifiant Resend et l'heure.
 */
export async function envoyer(env, opts, { fetchImpl = fetch, maintenant = new Date(), pause = attendre, log = console.log } = {}) {
  for (const cle of ['SUPABASE_ACCESS_TOKEN', 'RESEND_API_KEY', 'CGU_NOTICE_FROM']) {
    if (!env[cle]) throw new Error(`${cle} absent`);
  }
  const preuve = verifierCheminPreuve(opts.proof);
  const projet = env.SUPABASE_PROJECT_REF ?? PROJET_DEFAUT;
  const comptes = await interroger(sqlDestinataires(), { token: env.SUPABASE_ACCESS_TOKEN, projet, fetchImpl });

  if (comptes.length !== opts.expected) {
    throw new Error(`${comptes.length} destinataires aujourd'hui, ${opts.expected} attendus : rien n'est parti. Relancer le comptage à blanc.`);
  }
  if (comptes.length > PLAFOND_ENVOIS) {
    throw new Error(`${comptes.length} destinataires, au-delà du plafond de ${PLAFOND_ENVOIS} : rien n'est parti.`);
  }

  const effet = dateEffet(maintenant);
  const faits = dejaEnvoyes(preuve);
  const empreinte = createHash('sha256').update(lignes(effet).join('\n')).digest('hex').slice(0, 16);
  appendFileSync(preuve, `${JSON.stringify({ debut: maintenant.toISOString(), effet: effet.toISOString(), texte: empreinte, destinataires: comptes.length })}\n`);

  let envoyes = 0;
  let sautes = 0;
  let echecs = 0;
  for (const [i, c] of comptes.entries()) {
    const sha256 = hacher(c.email);
    if (faits.has(sha256)) {
      sautes++;
      continue;
    }
    const m = message(effet, { googleSansCgu: c.google_sans_cgu === true });
    let entree;
    try {
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.CGU_NOTICE_FROM, to: [c.email], reply_to: CONTACT, ...m }),
        signal: AbortSignal.timeout(15000),
      });
      const corps = await res.json().catch(() => ({}));
      entree = { at: new Date().toISOString(), sha256, ok: res.ok, resend_id: corps.id ?? null, status: res.status };
    } catch (err) {
      entree = { at: new Date().toISOString(), sha256, ok: false, erreur: String(err?.name ?? 'erreur') };
    }
    appendFileSync(preuve, `${JSON.stringify(entree)}\n`);
    if (entree.ok) envoyes++;
    else {
      echecs++;
      log(`✖ destinataire n° ${i + 1} (${sha256.slice(0, 8)}) : échec ${entree.status ?? entree.erreur}`);
    }
    if (i < comptes.length - 1) await pause(opts.delaiMs);
  }
  return { destinataires: comptes.length, envoyes, sautes, echecs, effet };
}

// ── Point d'entrée ──────────────────────────────────────────────────

const estPrincipal =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estPrincipal) {
  let opts;
  try {
    opts = lireArguments(process.argv.slice(2));
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }
  const effet = dateEffet();

  if (opts.preview) {
    const m = message(effet, { googleSansCgu: true });
    console.log(`Objet : ${m.subject}\n\n${m.text}`);
    console.log('\n(aperçu avec le paragraphe Google ; les autres comptes ne le reçoivent pas)');
    process.exit(0);
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('✖ SUPABASE_ACCESS_TOKEN absent : le comptage lit la base de production (Dashboard, Account, Access Tokens).');
    process.exit(1);
  }

  if (!opts.send) {
    const n = await compter(process.env);
    console.log('À BLANC : aucun e-mail envoyé, aucune adresse lue.');
    console.log(`  destinataires             ${n.tous}`);
    console.log(`  dont inscrits avant le 2026-09-24 (clauses 3.3, 6.3, 9)   ${n.avantCgu0924}`);
    console.log(`  dont comptes Google sans CGU (avant le ${GOOGLE_SANS_CGU_AVANT})   ${n.googleSansCgu}`);
    console.log('  langue                    inconnue en base : message bilingue fr + en');
    console.log(`  entrée en vigueur si envoi aujourd'hui : ${formater(effet, 'fr')}`);
    console.log(`\nEnvoi réel : node scripts/cgu-notice.mjs --send --expected ${n.tous} --proof <fichier hors dépôt>`);
    process.exit(0);
  }

  try {
    const r = await envoyer(process.env, opts);
    console.log(`Envoyés ${r.envoyes} · déjà servis ${r.sautes} · échecs ${r.echecs} · sur ${r.destinataires}`);
    console.log(`Entrée en vigueur : ${formater(r.effet, 'fr')}. Preuve : ${resolve(opts.proof)}`);
    process.exit(r.echecs > 0 ? 1 : 0);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }
}
