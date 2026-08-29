// Délivrabilité des emails d'authentification — vérification par le DNS réel.
//
// POURQUOI CE SCRIPT EXISTE
//
// L'audit du 2026-08-27 a trouvé qu'aucun SMTP applicatif n'était configuré pour
// Supabase Auth : les emails de réinitialisation de mot de passe partaient par
// l'expéditeur intégré de Supabase, plafonné à quelques envois par heure. Le
// mode de défaillance est le pire qui soit — il ne se déclenche que sous trafic,
// et il ressemble à « la campagne n'a pas converti ».
//
// La configuration elle-même vit dans deux consoles (Resend et Supabase) et dans
// la zone DNS. Rien de tout ça n'est dans le dépôt, donc rien ne peut empêcher
// qu'elle se défasse : un enregistrement supprimé par erreur pendant une
// migration DNS ne se voit nulle part, jusqu'au jour où plus personne ne reçoit
// rien. Ce script rend l'état VÉRIFIABLE depuis le dépôt, sans le rendre
// modifiable depuis le dépôt.
//
// CE QU'IL NE FAIT PAS : il ne dit pas si le SMTP est branché côté Supabase, ni
// si la limite d'envoi horaire a été relevée. Ces deux réglages ne sont exposés
// nulle part en lecture. Il dit seulement que le domaine d'envoi est en état de
// signer du courrier — ce qui est la condition préalable, pas la preuve finale.
// La preuve finale reste un email reçu, cf. docs/DEPLOYMENT.md §2ter.
//
// 🔴 CE SCRIPT N'EST PAS UNE GATE CI, et c'est délibéré. Il dépend d'un état
// EXTERNE (une zone DNS, un fournisseur) : un job rouge pour une raison que le
// commit n'a pas causée finit ignoré, et rend inaudibles les gardes voisines.
// C'est la règle déjà écrite pour `lighthouse` et pour `check-rls-advisors`.
// Il se lance à la main, et après toute modification de la zone.
//
// Usage :
//   npm run check:mail
//   npm run check:mail -- --domain autre.tld --send-subdomain envoi

import { promises as dns } from 'node:dns';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const ROOT = arg('domain', 'thecosmo.app');
// Resend émet depuis un SOUS-DOMAINE dédié. Ce n'est pas une préférence de
// style : la racine porte déjà les MX et le SPF du fournisseur de boîte aux
// lettres (IONOS). Écraser l'un des deux couperait la réception ou l'émission.
const SEND = `${arg('send-subdomain', 'send')}.${ROOT}`;

const flat = (records) => records.map((r) => (Array.isArray(r) ? r.join('') : String(r)));

async function txt(name) {
  try {
    return flat(await dns.resolveTxt(name));
  } catch {
    return [];
  }
}

async function mx(name) {
  try {
    return (await dns.resolveMx(name)).map((r) => r.exchange.toLowerCase());
  } catch {
    return [];
  }
}

/** Un CNAME est une réponse valable pour DMARC : c'est ce que posent la plupart des hébergeurs. */
async function cname(name) {
  try {
    return await dns.resolveCname(name);
  } catch {
    return [];
  }
}

const results = [];
const check = (level, label, ok, detail) => results.push({ level, label, ok, detail });

const rootMx = await mx(ROOT);
const rootTxt = await txt(ROOT);
const rootSpf = rootTxt.find((r) => r.startsWith('v=spf1'));

// 🔴 Le Return-Path ne vit PAS sur le domaine d'envoi, mais sur un sous-domaine
// `send.` de celui-ci. Constaté dans la console Resend le 2026-08-29 : pour un
// domaine `send.thecosmo.app`, elle réclame le MX et le SPF sur
// `send.send.thecosmo.app`. Cette version du script les cherchait sur le domaine
// d'envoi lui-même et aurait donc affiché DEUX ÉCHECS sur une configuration
// parfaitement correcte — le meilleur moyen d'apprendre à ignorer sa propre
// garde. On interroge les deux emplacements et on accepte l'un ou l'autre :
// Resend a déjà changé de topologie une fois.
const BOUNCE = `send.${SEND}`;

const bounceMx = await mx(BOUNCE);
const bounceTxt = await txt(BOUNCE);
const bounceSpf = bounceTxt.find((r) => r.startsWith('v=spf1'));

const sendMxDirect = await mx(SEND);
const sendTxtDirect = await txt(SEND);
const sendSpfDirect = sendTxtDirect.find((r) => r.startsWith('v=spf1'));

const sendMx = bounceMx.length ? bounceMx : sendMxDirect;
const sendSpf = bounceSpf ?? sendSpfDirect;
const spfWhere = bounceSpf ? BOUNCE : SEND;
const mxWhere = bounceMx.length ? BOUNCE : SEND;

// Le sélecteur Resend est `resend._domainkey`. Sur le sous-domaine d'envoi si
// c'est un sous-domaine qui est vérifié, sur la racine sinon — on tolère les
// deux plutôt que d'imposer une topologie.
const dkimSend = await txt(`resend._domainkey.${SEND}`);
const dkimRoot = await txt(`resend._domainkey.${ROOT}`);
const dkim = dkimSend.length ? dkimSend : dkimRoot;

const dmarcTxt = await txt(`_dmarc.${ROOT}`);
const dmarcCname = await cname(`_dmarc.${ROOT}`);

// ── Ce qui BLOQUE : le domaine d'envoi ────────────────────────────────
check(
  'error',
  `DKIM Resend (resend._domainkey.${SEND} ou .${ROOT})`,
  dkim.length > 0,
  dkim.length ? `présent sur ${dkimSend.length ? SEND : ROOT}` : 'ABSENT — le domaine n’est pas vérifié chez Resend',
);
check(
  'error',
  `SPF du Return-Path (${BOUNCE})`,
  Boolean(sendSpf),
  sendSpf ? `${sendSpf}  [sur ${spfWhere}]` : `ABSENT sur ${BOUNCE} comme sur ${SEND}`,
);
check(
  'error',
  `MX du Return-Path (${BOUNCE})`,
  sendMx.length > 0,
  sendMx.length
    ? `${sendMx.join(', ')}  [sur ${mxWhere}]`
    : `ABSENT sur ${BOUNCE} comme sur ${SEND} — Resend ne peut pas recevoir les rebonds`,
);

// ── Ce qui ne doit pas AVOIR ÉTÉ CASSÉ : la racine ────────────────────
//
// Le risque réel d'une mise en service n'est pas d'oublier un enregistrement,
// c'est d'écraser ceux qui servent déjà la boîte contact@. Ces deux lignes sont
// là pour attraper exactement ça.
check('error', `MX de la racine (${ROOT}) — réception du courrier`, rootMx.length > 0, rootMx.join(', ') || 'ABSENT');
check('error', `SPF de la racine (${ROOT})`, Boolean(rootSpf), rootSpf ?? 'ABSENT');

// ── Ce qui mérite un avertissement, pas un échec ──────────────────────
const dmarcValue = dmarcTxt.find((r) => r.startsWith('v=DMARC1'));
check(
  'warn',
  `DMARC (_dmarc.${ROOT})`,
  Boolean(dmarcValue) || dmarcCname.length > 0,
  dmarcValue ?? (dmarcCname.length ? `CNAME → ${dmarcCname.join(', ')}` : 'ABSENT'),
);
if (dmarcValue?.includes('p=none')) {
  check('warn', 'Politique DMARC', false, 'p=none — surveillance seule, rien n’est rejeté. Correct pour démarrer, à durcir plus tard');
}

// ── Rapport ───────────────────────────────────────────────────────────
const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));
const width = Math.max(...results.map((r) => r.label.length));

console.log(`\nDélivrabilité des emails Auth — ${ROOT}\n`);
for (const r of results) {
  const mark = r.ok ? '  OK  ' : r.level === 'warn' ? ' WARN ' : ' FAIL ';
  console.log(`[${mark}] ${pad(r.label, width)}  ${r.detail}`);
}

const failures = results.filter((r) => !r.ok && r.level === 'error');
const warnings = results.filter((r) => !r.ok && r.level === 'warn');

console.log('');
if (failures.length === 0) {
  console.log(`✅ Domaine d’envoi en état de signer${warnings.length ? ` (${warnings.length} avertissement(s))` : ''}.`);
  console.log('   ⚠️  Le DNS ne prouve pas qu’un email ARRIVE. La preuve reste un compte jetable,');
  console.log('       vérifié sur Gmail ET sur Outlook. Cf. docs/DEPLOYMENT.md §2ter.\n');
  process.exit(0);
}

console.log(`❌ ${failures.length} contrôle(s) en échec — les emails d’authentification ne sont pas fiables.`);
console.log('   Procédure de mise en service : docs/DEPLOYMENT.md §2ter.\n');
process.exit(1);
