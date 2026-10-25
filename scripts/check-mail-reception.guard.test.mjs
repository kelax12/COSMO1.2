// ═══════════════════════════════════════════════════════════════════
// Témoin de `check-mail-reception.mjs` (M-53, SUPPORT.md AM-2), posé le 2026-10-23
//
// `check:mail` ne regardait que l'envoi. Ce témoin garde les trois moitiés de
// la réception : le balayage voit les adresses publiées (et pas les exemples
// de saisie), un domaine sans MX fait échouer, et le dialogue SMTP s'arrête à
// `RCPT TO` sans jamais envoyer `DATA`. Aucun appel réseau : le DNS est
// injecté, le serveur SMTP est local.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import {
  adressesDuTexte,
  adressesDuCatalogue,
  adressesPubliees,
  deciderMx,
  lireReponse,
  deciderRcpt,
  sonderRcpt,
  verifierReception,
} from './check-mail-reception.mjs';

const arbre = (fichiers) => {
  const racine = mkdtempSync(join(tmpdir(), 'mail-reception-'));
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(join(racine, chemin, '..'), { recursive: true });
    writeFileSync(join(racine, chemin), typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  }
  return racine;
};

describe('check-mail-reception : les adresses publiées', () => {
  it('lit une adresse dans un catalogue, pas dans un exemple de saisie', () => {
    expect(adressesDuCatalogue({
      notice: { li2: '**Adresse e-mail :** contact@thecosmo.app' },
      form: { emailPlaceholder: 'votre@email.com' },
    })).toEqual(['contact@thecosmo.app']);
  });

  it('ignore un attribut placeholder et un commentaire dans le code', () => {
    expect(adressesDuTexte([
      '  placeholder="exemple@cosmo.app"',
      ' * saluer « axel@exemple.fr ».',
      "export const CONTACT_EMAIL = 'Contact@TheCosmo.app';",
    ].join('\n'))).toEqual(['contact@thecosmo.app']);
  });

  it('TÉMOIN : le balayage du dépôt voit contact@thecosmo.app et l adresse du JSON-LD', () => {
    const publiees = adressesPubliees();
    expect(publiees.get('contact@thecosmo.app')).toEqual(expect.arrayContaining(['src/lib/contact.mjs', 'src/locales/fr/legal.json']));
    expect([...publiees.keys()].some((a) => a.endsWith('@gmail.com'))).toBe(true);
    expect(publiees.has('demo@cosmo.app')).toBe(false);
    expect(publiees.has('votre@email.com')).toBe(false);
  });

  it('exclut les fichiers de test, qui fabriquent des adresses', () => {
    const racine = arbre({ 'src/pages/A.test.tsx': "mailto:a@b.fr", 'src/pages/A.tsx': "mailto:x@y.fr" });
    expect([...adressesPubliees(racine, ['src/pages']).keys()]).toEqual(['x@y.fr']);
  });
});

describe('check-mail-reception : décision sur les MX', () => {
  it('des MX résolus : OK, triés par priorité', () => {
    const d = deciderMx([{ exchange: 'mx01.ionos.fr', priority: 20 }, { exchange: 'mx00.ionos.fr.', priority: 10 }], { 'mx00.ionos.fr': 1, 'mx01.ionos.fr': 2 });
    expect(d.ok).toBe(true);
    expect(d.hotes[0].hote).toBe('mx00.ionos.fr');
  });

  it('TÉMOIN : un domaine sans MX fait échouer', () => {
    expect(deciderMx([], {})).toMatchObject({ ok: false, detail: 'aucun MX' });
  });

  it('TÉMOIN : un MX nul (RFC 7505) compte comme absent', () => {
    expect(deciderMx([{ exchange: '', priority: 0 }], {}).ok).toBe(false);
  });

  it('TÉMOIN : des MX dont aucun hôte ne se résout font échouer', () => {
    expect(deciderMx([{ exchange: 'mx.mort.tld', priority: 10 }], { 'mx.mort.tld': 0 }).ok).toBe(false);
  });

  it('un hôte sur deux résolu : OK, le muet est nommé', () => {
    const d = deciderMx([{ exchange: 'a.tld', priority: 10 }, { exchange: 'b.tld', priority: 20 }], { 'a.tld': 1 });
    expect(d.ok).toBe(true);
    expect(d.detail).toContain('non résolus : b.tld');
  });
});

describe('check-mail-reception : parsing SMTP', () => {
  it('attend la dernière ligne d une réponse multiligne', () => {
    expect(lireReponse('250-mx.tld bonjour\r\n250-PIPELINING\r\n')).toBeNull();
    expect(lireReponse('250-mx.tld bonjour\r\n250 SIZE')).toBeNull();
    expect(lireReponse('250-mx.tld bonjour\r\n250 SIZE\r\n')).toMatchObject({ code: 250 });
  });

  it('classe le code de RCPT TO', () => {
    expect(deciderRcpt(250)).toBe('recoit');
    expect(deciderRcpt(251)).toBe('recoit');
    expect(deciderRcpt(450)).toBe('temporaire');
    expect(deciderRcpt(550)).toBe('refuse');
  });
});

// Un faux serveur SMTP local : il note tout ce qu'il reçoit.
const serveurs = [];
afterAll(() => serveurs.forEach((s) => s.close()));
function fauxSmtp(reponseRcpt) {
  const recu = [];
  let fermeture;
  const ferme = new Promise((resolve) => { fermeture = resolve; });
  const serveur = net.createServer((socket) => {
    socket.on('close', fermeture);
    socket.write('220 faux.tld ESMTP\r\n');
    let tampon = '';
    socket.on('data', (d) => {
      tampon += d;
      let i;
      while ((i = tampon.indexOf('\r\n')) !== -1) {
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        recu.push(ligne);
        if (/^EHLO/i.test(ligne)) socket.write('250-faux.tld\r\n250 PIPELINING\r\n');
        else if (/^MAIL FROM/i.test(ligne)) socket.write('250 2.1.0 Ok\r\n');
        else if (/^RCPT TO/i.test(ligne)) socket.write(`${reponseRcpt}\r\n`);
        else if (/^QUIT/i.test(ligne)) socket.end('221 Bye\r\n');
        else socket.write('502 non\r\n');
      }
    });
  });
  serveurs.push(serveur);
  return new Promise((resolve) => serveur.listen(0, '127.0.0.1', () => resolve({ port: serveur.address().port, recu, ferme })));
}

describe('check-mail-reception : dialogue SMTP jusqu à RCPT TO', () => {
  it('TÉMOIN : une adresse acceptée rend « recoit », et AUCUN DATA n est envoyé', async () => {
    const { port, recu, ferme } = await fauxSmtp('250 2.1.5 Ok');
    const r = await sonderRcpt({ hote: '127.0.0.1', port, adresse: 'contact@thecosmo.app', delai: 3000 });
    await ferme;
    expect(r).toMatchObject({ etat: 'recoit', code: 250 });
    expect(recu).toEqual(['EHLO check-mail.thecosmo.app', 'MAIL FROM:<>', 'RCPT TO:<contact@thecosmo.app>', 'QUIT']);
    expect(recu.some((l) => /^DATA/i.test(l))).toBe(false);
  });

  it('TÉMOIN : une boîte inconnue (550) rend « refuse »', async () => {
    const { port } = await fauxSmtp('550 5.1.1 User unknown');
    const r = await sonderRcpt({ hote: '127.0.0.1', port, adresse: 'nul@thecosmo.app', delai: 3000 });
    expect(r).toMatchObject({ etat: 'refuse', code: 550 });
  });

  it('un port fermé rend « injoignable », jamais « refuse »', async () => {
    const libre = net.createServer();
    const port = await new Promise((resolve) => libre.listen(0, '127.0.0.1', () => resolve(libre.address().port)));
    await new Promise((resolve) => libre.close(resolve));
    const r = await sonderRcpt({ hote: '127.0.0.1', port, adresse: 'contact@thecosmo.app', delai: 3000 });
    expect(r.etat).toBe('injoignable');
  });
});

describe('check-mail-reception : le verdict', () => {
  const racine = arbre({
    'src/lib/contact.mjs': "export const CONTACT_EMAIL = 'contact@recoit.tld';",
    'index.html': '"email": "editeur@sansmx.tld"',
  });
  const resoudreMx = async (d) => (d === 'recoit.tld' ? { mx: [{ exchange: 'mx.recoit.tld', priority: 10 }], erreur: null } : { mx: [], erreur: 'ENODATA' });
  const compterIps = async () => 1;

  it('TÉMOIN : une adresse publiée sur un domaine sans MX est une erreur, nommée avec son fichier', async () => {
    const lignes = await verifierReception({ racine, resoudreMx, compterIps, smtp: false });
    const ko = lignes.filter((l) => l.level === 'error' && !l.ok).map((l) => l.label);
    expect(ko).toEqual(['MX de sansmx.tld : réception', 'editeur@sansmx.tld : domaine à MX valide']);
    expect(lignes.find((l) => l.label.startsWith('editeur@')).detail).toContain('index.html');
  });

  it('un port 25 bloqué est dit NON MESURÉ, en avertissement, pas en échec', async () => {
    const sonder = async () => ({ etat: 'injoignable', code: null, detail: 'ETIMEDOUT', journal: [] });
    const lignes = await verifierReception({ racine, resoudreMx, compterIps, sonder });
    const rcpt = lignes.find((l) => l.label.includes('RCPT TO'));
    expect(rcpt).toMatchObject({ level: 'warn', ok: false });
    expect(rcpt.detail).toMatch(/NON MESURÉ/);
  });

  it('un RCPT TO refusé est une erreur', async () => {
    const sonder = async () => ({ etat: 'refuse', code: 550, detail: '550 User unknown', journal: [] });
    const lignes = await verifierReception({ racine, resoudreMx, compterIps, sonder });
    expect(lignes.find((l) => l.label.includes('RCPT TO'))).toMatchObject({ level: 'error', ok: false });
  });

  it('un balayage qui ne voit rien est une erreur, pas un vert', async () => {
    const vide = arbre({ 'src/pages/A.tsx': 'rien' });
    const lignes = await verifierReception({ racine: vide, resoudreMx, compterIps, smtp: false });
    expect(lignes).toEqual([expect.objectContaining({ level: 'error', ok: false })]);
  });
});
