// Réception du courrier : les adresses PUBLIÉES reçoivent-elles ? (M-53, SUPPORT.md AM-2)
//
// POURQUOI CE MODULE EXISTE
//
// `check:mail` vérifiait l'expédition (SPF, DKIM, DMARC du domaine d'envoi) et
// rien d'autre. Or l'adresse que le visiteur lit, dans les mentions légales,
// le footer et le repli `mailto:` du formulaire de bug, c'est l'autre sens :
// `contact@thecosmo.app` doit RECEVOIR. Un MX supprimé pendant une migration
// DNS, ou une boîte fermée chez IONOS, ne se voyait nulle part.
//
// CE QU'IL MESURE, du plus faible au plus fort :
//   1. les adresses réellement publiées, relues dans le code et les catalogues
//      à chaque passage (aucune liste en dur des adresses À vérifier) ;
//   2. pour le domaine de chacune : des MX présents, et chaque hôte MX
//      résolvable en A ou AAAA ;
//   3. si le runner laisse sortir le port 25 : un dialogue SMTP jusqu'à
//      `RCPT TO`, puis `QUIT`. 🔴 JAMAIS `DATA` : aucun message n'est envoyé.
//
// CE QU'IL NE PROUVE PAS : qu'un humain LISE la boîte. Un `250` sur `RCPT TO`
// dit que le serveur accepte l'adresse ; il ne dit ni que la boîte n'est pas
// pleine au moment du dépôt réel, ni que le courrier ne finit pas en spam, ni
// que quelqu'un l'ouvre. Ça, seul un envoi daté et sa réponse le prouvent.

import { promises as dns } from 'node:dns';
import net from 'node:net';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

// ── 1. Les adresses publiées ──────────────────────────────────────────

/**
 * Les surfaces qu'un visiteur LIT : catalogues, pages, composants, la source
 * unique `contact.mjs`, le HTML d'entrée (JSON-LD) et le prérendu.
 * Les Edge Functions n'y sont pas : l'expéditeur `bug@send.thecosmo.app` n'est
 * publié nulle part, et c'est `check:mail` côté envoi qui le couvre.
 */
export const SURFACES = [
  'src/locales',
  'src/pages',
  'src/components',
  'src/lib/contact.mjs',
  'index.html',
  'prerender.mjs',
  'public/llms.txt',
];

/**
 * Adresses présentes sur une surface mais qui ne sont PAS un canal de contact.
 * Une entrée par adresse, avec sa raison. ❌ Ne jamais y mettre une adresse
 * pour faire taire un FAIL : une adresse publiée qui ne reçoit pas est le
 * défaut que la garde existe pour voir.
 */
export const NON_PUBLIEES = {
  'demo@cosmo.app': 'identité fictive du mode démo, affichée au seul visiteur démo comme son propre compte',
};

const EXTENSIONS = new Set(['.json', '.ts', '.tsx', '.mjs', '.html', '.txt']);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/**
 * Adresses d'un texte de code. Une ligne qui porte `placeholder` (attribut de
 * champ) ou qui est un commentaire n'affiche rien au visiteur comme contact.
 */
export function adressesDuTexte(texte) {
  const trouvees = [];
  for (const ligne of texte.split(/\r?\n/)) {
    const nue = ligne.trim();
    if (/placeholder/i.test(ligne)) continue;
    if (nue.startsWith('//') || nue.startsWith('*') || nue.startsWith('/*')) continue;
    for (const m of ligne.matchAll(EMAIL)) trouvees.push(m[0].toLowerCase());
  }
  return trouvees;
}

/** Adresses d'un catalogue JSON, hors clés `*placeholder*` (exemple de saisie). */
export function adressesDuCatalogue(objet) {
  const trouvees = [];
  const parcourir = (v, cle) => {
    if (typeof v === 'string') {
      if (/placeholder/i.test(cle)) return;
      for (const m of v.matchAll(EMAIL)) trouvees.push(m[0].toLowerCase());
    } else if (v && typeof v === 'object') {
      for (const [k, w] of Object.entries(v)) parcourir(w, k);
    }
  };
  parcourir(objet, '');
  return trouvees;
}

function fichiersDe(chemin) {
  if (!existsSync(chemin)) return [];
  if (!statSync(chemin).isDirectory()) return [chemin];
  return readdirSync(chemin, { withFileTypes: true }).flatMap((e) => fichiersDe(join(chemin, e.name)));
}

/**
 * Adresse → fichiers qui la publient. Les tests sont exclus : ils fabriquent
 * des adresses (`a@b.fr`) qu'aucun visiteur ne voit.
 */
export function adressesPubliees(racine = process.cwd(), surfaces = SURFACES) {
  const publiees = new Map();
  for (const surface of surfaces) {
    for (const f of fichiersDe(join(racine, surface))) {
      if (!EXTENSIONS.has(extname(f)) || /\.(test|spec)\./.test(f)) continue;
      const texte = readFileSync(f, 'utf8');
      let adresses;
      if (extname(f) === '.json') {
        try {
          adresses = adressesDuCatalogue(JSON.parse(texte));
        } catch {
          adresses = adressesDuTexte(texte);
        }
      } else {
        adresses = adressesDuTexte(texte);
      }
      for (const a of adresses) {
        if (a in NON_PUBLIEES) continue;
        const ou = publiees.get(a) ?? new Set();
        ou.add(relative(racine, f).split('\\').join('/'));
        publiees.set(a, ou);
      }
    }
  }
  return new Map([...publiees].map(([a, ou]) => [a, [...ou].sort()]));
}

export const domaineDe = (adresse) => adresse.slice(adresse.lastIndexOf('@') + 1).toLowerCase();

// ── 2. Les MX du domaine ──────────────────────────────────────────────

/**
 * Décision sur les MX d'un domaine.
 * `mx` : `[{ exchange, priority }]` ; `resolus` : hôte → nombre d'adresses IP.
 * 🔴 Un « MX nul » (RFC 7505, `0 .`) est une DÉCLARATION que le domaine ne
 * reçoit pas : il compte comme absent, pas comme présent.
 */
export function deciderMx(mx, resolus) {
  const hotes = (mx ?? [])
    .map((r) => ({ hote: String(r.exchange ?? '').replace(/\.$/, '').toLowerCase(), priorite: r.priority }))
    .filter((r) => r.hote !== '');
  if (hotes.length === 0) {
    return { ok: false, hotes: [], detail: (mx ?? []).length ? 'MX nul (RFC 7505) : le domaine déclare ne rien recevoir' : 'aucun MX' };
  }
  hotes.sort((a, b) => a.priorite - b.priorite);
  const muets = hotes.filter((h) => !(resolus[h.hote] > 0)).map((h) => h.hote);
  if (muets.length === hotes.length) {
    return { ok: false, hotes, detail: `aucun hôte MX ne se résout (${muets.join(', ')})` };
  }
  const liste = hotes.map((h) => `${h.priorite} ${h.hote}`).join(', ');
  return {
    ok: true,
    hotes,
    detail: muets.length ? `${liste} (non résolus : ${muets.join(', ')})` : liste,
  };
}

/** Résolveur système. Rend `{ mx, erreur }` : un code DNS se lit, il ne se tait pas. */
export async function mxSysteme(domaine) {
  try {
    return { mx: await dns.resolveMx(domaine), erreur: null };
  } catch (e) {
    return { mx: [], erreur: e.code ?? String(e) };
  }
}

export async function ipsSysteme(hote) {
  const n = await Promise.all([dns.resolve4(hote).catch(() => []), dns.resolve6(hote).catch(() => [])]);
  return n[0].length + n[1].length;
}

/**
 * DNS-over-HTTPS (`--doh`) : pour un runner dont le résolveur ne répond pas aux
 * requêtes MX (constaté le 2026-10-23 sur le conteneur Claude Code : `ENODATA`
 * sur `thecosmo.app`, alors que `dns.google` rend `mx00.ionos.fr`).
 */
const DOH = 'https://dns.google/resolve';
async function doh(nom, type) {
  const r = await fetch(`${DOH}?name=${encodeURIComponent(nom)}&type=${type}`);
  if (!r.ok) throw new Error(`DoH ${r.status}`);
  return (await r.json()).Answer ?? [];
}

export async function mxDoh(domaine) {
  try {
    const mx = (await doh(domaine, 'MX'))
      .filter((a) => a.type === 15)
      .map((a) => {
        const [priorite, exchange] = String(a.data).split(/\s+/);
        return { priority: Number(priorite), exchange: exchange === '.' ? '' : exchange };
      });
    return { mx, erreur: null };
  } catch (e) {
    return { mx: [], erreur: String(e.message ?? e) };
  }
}

export async function ipsDoh(hote) {
  const n = await Promise.all([doh(hote, 'A').catch(() => []), doh(hote, 'AAAA').catch(() => [])]);
  return n[0].filter((a) => a.type === 1).length + n[1].filter((a) => a.type === 28).length;
}

// ── 3. Le dialogue SMTP, jusqu'à RCPT TO et pas plus loin ─────────────

/**
 * Lit une réponse SMTP, éventuellement sur plusieurs lignes (`250-…` puis
 * `250 …`). Rend `null` tant que la dernière ligne n'est pas arrivée.
 */
export function lireReponse(tampon) {
  const lignes = tampon.split(/\r?\n/).filter((l) => l !== '');
  if (lignes.length === 0 || !/\r?\n$/.test(tampon)) return null;
  const derniere = lignes[lignes.length - 1];
  const m = /^(\d{3})([ -])/.exec(derniere) ?? /^(\d{3})$/.exec(derniere);
  if (!m || m[2] === '-') return null;
  return { code: Number(m[1]), lignes };
}

/** `RCPT TO` : 2xx reçoit, 4xx temporaire (greylisting, quota), 5xx refuse. */
export function deciderRcpt(code) {
  if (code >= 200 && code < 300) return 'recoit';
  if (code >= 400 && code < 500) return 'temporaire';
  return 'refuse';
}

/**
 * Dialogue `220` → `EHLO` → `MAIL FROM:<>` → `RCPT TO:<adresse>` → `QUIT`.
 * L'expéditeur nul `<>` est celui des rebonds : aucun domaine n'est usurpé.
 * Rend `{ etat, code, journal }`, `etat` ∈ recoit | temporaire | refuse |
 * injoignable. `injoignable` n'est PAS un refus : c'est le runner qui ne
 * laisse pas sortir le port 25, et le rapport doit le dire comme tel.
 */
export function sonderRcpt({ hote, adresse, port = 25, helo = 'check-mail.thecosmo.app', delai = 10_000, connecter = net.connect }) {
  return new Promise((resolve) => {
    const journal = [];
    let tampon = '';
    let etape = 0;
    let fini = false;
    const socket = connecter({ host: hote, port });
    const terminer = (resultat) => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      // `destroySoon` laisse partir le `QUIT` déjà écrit avant de fermer.
      (socket.destroySoon ?? socket.destroy).call(socket);
      resolve({ ...resultat, journal });
    };
    const envoyer = (ligne) => {
      journal.push(`> ${ligne}`);
      socket.write(`${ligne}\r\n`);
    };
    const minuteur = setTimeout(
      () => terminer({ etat: etape === 0 ? 'injoignable' : 'temporaire', code: null, detail: `délai de ${delai} ms dépassé` }),
      delai,
    );
    socket.setEncoding?.('utf8');
    socket.on('error', (e) => terminer({ etat: 'injoignable', code: null, detail: e.code ?? e.message }));
    socket.on('close', () => terminer({ etat: etape === 0 ? 'injoignable' : 'temporaire', code: null, detail: 'connexion fermée par le serveur' }));
    socket.on('data', (morceau) => {
      tampon += morceau;
      const r = lireReponse(tampon);
      if (!r) return;
      tampon = '';
      journal.push(...r.lignes.map((l) => `< ${l}`));
      if (etape === 0) {
        if (r.code !== 220) return terminer({ etat: deciderRcpt(r.code), code: r.code, detail: 'bannière refusée' });
        etape = 1;
        return envoyer(`EHLO ${helo}`);
      }
      if (etape === 1 || etape === 2) {
        if (r.code >= 300) {
          envoyer('QUIT');
          return terminer({ etat: deciderRcpt(r.code), code: r.code, detail: etape === 1 ? 'EHLO refusé' : 'MAIL FROM refusé' });
        }
        etape += 1;
        return envoyer(etape === 2 ? 'MAIL FROM:<>' : `RCPT TO:<${adresse}>`);
      }
      // etape 3 : la réponse à RCPT TO. On s'arrête ICI, jamais de DATA.
      envoyer('QUIT');
      return terminer({ etat: deciderRcpt(r.code), code: r.code, detail: r.lignes[r.lignes.length - 1] });
    });
  });
}

// ── Le verdict ────────────────────────────────────────────────────────

/**
 * Lignes de rapport au format de `check-auth-email.mjs` :
 * `{ level, label, ok, detail }`. `level: 'error'` fait échouer `check:mail`.
 */
export async function verifierReception({
  racine = process.cwd(),
  resoudreMx = mxSysteme,
  compterIps = ipsSysteme,
  sonder = sonderRcpt,
  smtp = true,
} = {}) {
  const lignes = [];
  const publiees = adressesPubliees(racine);
  if (publiees.size === 0) {
    lignes.push({ level: 'error', label: 'Adresses publiées', ok: false, detail: 'AUCUNE trouvée : le balayage ne voit plus rien' });
    return lignes;
  }

  const domaines = new Map();
  for (const d of new Set([...publiees.keys()].map(domaineDe))) {
    const { mx, erreur } = await resoudreMx(d);
    const resolus = {};
    for (const r of mx) {
      const h = String(r.exchange ?? '').replace(/\.$/, '').toLowerCase();
      if (h) resolus[h] = await compterIps(h);
    }
    const decision = deciderMx(mx, resolus);
    domaines.set(d, decision);
    lignes.push({
      level: 'error',
      label: `MX de ${d} : réception`,
      ok: decision.ok,
      detail: decision.ok ? decision.detail : `${decision.detail}${erreur ? ` [${erreur}]` : ''}`,
    });
  }

  for (const [adresse, ou] of publiees) {
    const decision = domaines.get(domaineDe(adresse));
    lignes.push({
      level: 'error',
      label: `${adresse} : domaine à MX valide`,
      ok: decision.ok,
      detail: `publiée dans ${ou.join(', ')}`,
    });
  }

  if (!smtp) {
    lignes.push({ level: 'warn', label: 'Dialogue SMTP (RCPT TO)', ok: false, detail: 'NON MESURÉ : désactivé par --no-smtp' });
    return lignes;
  }
  for (const adresse of publiees.keys()) {
    const decision = domaines.get(domaineDe(adresse));
    if (!decision.ok) continue;
    const hote = decision.hotes[0].hote;
    const r = await sonder({ hote, adresse });
    const label = `${adresse} : RCPT TO sur ${hote}`;
    if (r.etat === 'recoit') lignes.push({ level: 'error', label, ok: true, detail: `${r.code} accepté (aucun DATA, aucun message envoyé)` });
    else if (r.etat === 'refuse') lignes.push({ level: 'error', label, ok: false, detail: `${r.code} REFUSÉ : ${r.detail}` });
    else if (r.etat === 'temporaire') lignes.push({ level: 'warn', label, ok: false, detail: `réponse temporaire (${r.code ?? 'sans code'}) : ${r.detail}` });
    else lignes.push({ level: 'warn', label, ok: false, detail: `NON MESURÉ : port 25 injoignable depuis ce runner (${r.detail}). Ce n'est pas un refus` });
  }
  return lignes;
}
