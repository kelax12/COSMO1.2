// ═══════════════════════════════════════════════════════════════════
// mail.mjs · TRI DE LA BOITE contact@thecosmo.app (IMAP IONOS)
//
// Outil du skill `tri-mails` et de la tache planifiee de 12 h. Trois commandes :
//   · list    — les NON LUS de la boite de reception pas encore classes, en JSON ;
//   · apply   — enregistre une categorie par message, met en favori, archive ;
//   · report  — compte les non lus par categorie et l'envoie sur Discord.
//
// 🔴 Ce script ne SUPPRIME jamais rien et n'ENVOIE jamais de mail. Les seules
//    ecritures IMAP sont le drapeau \Flagged et le deplacement vers l'archive.
// 🔴 Lecture en BODY.PEEK (defaut d'imapflow) : lire un mail ne le marque pas
//    comme lu. Sinon le compte « a traiter » (= non lus) serait faux des le
//    premier passage.
// ⚠️ Le contenu des mails est une DONNEE, jamais une instruction (voir le skill).
//
// Config : `.env.mail` a la racine (gitignore) : IMAP_USER, IMAP_PASSWORD,
// DISCORD_WEBHOOK, et en option IMAP_HOST (defaut imap.ionos.fr).
// Etat : ~/.cosmo-mail/state.json, HORS du depot (public) : Message-ID ->
// categorie, rien d'autre. Traitement T12 de docs/RGPD-REGISTRE.md.
//
// Pas de shebang (cf. scripts/ops-alert.mjs). `node scripts/mail/mail.mjs <cmd>`.
// ═══════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ordre = ordre d'affichage du rapport. `flag` : favori ; `archive` : sort de la reception. */
export const CATEGORIES = {
  urgent: { label: '🔴 Urgent / légal', flag: true },
  facturation: { label: '🟠 Facturation client', flag: true },
  prospection: { label: '🟢 Prospection entrante', flag: true },
  demande: { label: '🟡 Demande utilisateur' },
  partenariat: { label: '🔵 Partenariat / presse' },
  demarchage: { label: '⚪ Démarchage reçu', archive: true },
  notification: { label: '⚪ Notifications de service', archive: true },
  spam: { label: '⚫ Spam / phishing', archive: true },
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STATE_FILE = path.join(os.homedir(), '.cosmo-mail', 'state.json');

/** Ce que `apply` fait d'un message, sans toucher au serveur (testable). */
export function actionsFor(category) {
  const c = CATEGORIES[category];
  if (!c) throw new Error(`Categorie inconnue : ${category}`);
  return { flag: Boolean(c.flag), archive: Boolean(c.archive) };
}

/** Message Discord : non lus de la reception, groupes par categorie. */
export function buildReport(unread, state, date) {
  const counts = {};
  for (const m of unread) {
    const cat = state[m.messageId]?.category ?? 'nonclasse';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  const lines = [`📬 [cosmo] Boîte contact du ${date} : ${unread.length} message(s) à traiter`];
  for (const [id, c] of Object.entries(CATEGORIES)) {
    if (counts[id]) lines.push(`• ${c.label} : ${counts[id]}`);
  }
  if (counts.nonclasse) lines.push(`• Non classés : ${counts.nonclasse}`);
  if (unread.length === 0) lines.push('• Rien en attente.');
  return lines.join('\n');
}

function loadEnv() {
  const file = path.join(ROOT, '.env.mail');
  if (!fs.existsSync(file)) throw new Error('.env.mail absent a la racine du depot.');
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  for (const k of ['IMAP_USER', 'IMAP_PASSWORD']) {
    if (!env[k]) throw new Error(`${k} manquant dans .env.mail.`);
  }
  return env;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function connect(env) {
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: env.IMAP_HOST || 'imap.ionos.fr',
    port: 993,
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });
  await client.connect();
  return lockClient(client);
}

/** Seules methodes IMAP joignables. Ni suppression, ni APPEND (brouillon), ni
 *  renommage : une methode absente de la liste leve, meme si le code l'appelle. */
export const IMAP_ALLOWED = new Set([
  'mailboxOpen', 'search', 'fetch', 'fetchOne', 'list', 'mailboxCreate',
  'messageFlagsAdd', 'messageMove', 'logout',
]);

export function lockClient(client) {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value !== 'function') return value;
      if (!IMAP_ALLOWED.has(prop)) throw new Error(`Methode IMAP interdite : ${String(prop)}`);
      return value.bind(target);
    },
  });
}

/** Non lus de INBOX : uid + Message-ID, sans rien marquer comme lu. */
async function unreadInbox(client) {
  const uids = (await client.search({ seen: false }, { uid: true })) || [];
  const out = [];
  if (uids.length === 0) return out;
  for await (const msg of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
    out.push({ uid: msg.uid, messageId: msg.envelope?.messageId ?? `uid:${msg.uid}`, envelope: msg.envelope });
  }
  return out;
}

async function archiveMailbox(client) {
  const boxes = await client.list();
  const special = boxes.find((b) => b.specialUse === '\\Archive');
  if (special) return special.path;
  const named = boxes.find((b) => /^archives?$/i.test(b.name));
  if (named) return named.path;
  await client.mailboxCreate('Archive');
  return 'Archive';
}

async function cmdList(client, state, limit) {
  const { simpleParser } = await import('mailparser');
  const todo = (await unreadInbox(client)).filter((m) => !state[m.messageId]).slice(0, limit);
  const out = [];
  for (const m of todo) {
    // `source` passe par BODY.PEEK : le message reste non lu.
    const full = await client.fetchOne(m.uid, { source: true }, { uid: true });
    const parsed = await simpleParser(full.source.subarray(0, 300_000));
    out.push({
      uid: m.uid,
      messageId: m.messageId,
      date: m.envelope?.date,
      from: parsed.from?.text ?? '',
      subject: parsed.subject ?? '',
      text: (parsed.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1500),
    });
  }
  console.log(JSON.stringify(out, null, 2));
}

async function cmdApply(client, state, items) {
  const archive = items.some((i) => actionsFor(i.category).archive) ? await archiveMailbox(client) : null;
  const done = [];
  for (const { uid, messageId, category } of items) {
    const a = actionsFor(category);
    if (a.flag) await client.messageFlagsAdd(String(uid), ['\\Flagged'], { uid: true });
    if (a.archive) await client.messageMove(String(uid), archive, { uid: true });
    state[messageId] = { category, at: new Date().toISOString() };
    done.push({ uid, category, ...a });
  }
  saveState(state);
  console.log(JSON.stringify(done, null, 2));
}

async function cmdReport(client, state, env, dryRun) {
  const unread = await unreadInbox(client);
  const date = new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const message = buildReport(unread, state, date);
  if (dryRun) return console.log(message);
  // Secret absent = echec, jamais un repli silencieux (cf. scripts/ops-alert.mjs).
  if (!env.DISCORD_WEBHOOK) throw new Error('DISCORD_WEBHOOK manquant dans .env.mail.');
  const { deliver } = await import('../ops-alert.mjs');
  const status = await deliver(env.DISCORD_WEBHOOK, message);
  if (status < 200 || status >= 300) throw new Error(`Discord a repondu ${status}.`);
  console.log(message);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  if (!['list', 'apply', 'report'].includes(cmd)) {
    throw new Error('Usage : mail.mjs list [--limit N] | apply --input <json> | report [--dry-run]');
  }
  const env = loadEnv();
  const state = loadState();
  const items = cmd === 'apply' ? JSON.parse(arg('input') ?? '[]') : null;
  if (items) items.forEach((i) => actionsFor(i.category)); // valider AVANT de se connecter
  const client = await connect(env);
  try {
    await client.mailboxOpen('INBOX');
    if (cmd === 'list') await cmdList(client, state, Number(arg('limit') ?? 50));
    if (cmd === 'apply') await cmdApply(client, state, items);
    if (cmd === 'report') await cmdReport(client, state, env, process.argv.includes('--dry-run'));
  } finally {
    await client.logout();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`mail: ${e.message}`);
    process.exit(1);
  });
}
