// ═══════════════════════════════════════════════════════════════════
// Instantanés du HTML prérendu (vague 14.4, COD-04)
//
// 🔴 POURQUOI
// Le HTML que servent les moteurs de recherche sort d'un seul script
// (`prerender/`), et ses régressions récentes étaient toutes SILENCIEUSES :
// un double <h1>, un guide tronqué, un JSON-LD faux. Aucun test ne comparait la
// page produite à une page attendue ; seul un `curl` sur la production les a
// vues. Ici chaque sortie du prérendu est comparée, octet pour octet après
// normalisation, à un instantané VERSIONNÉ (`prerender/instantanes/`).
//
// CE QUI EST NORMALISÉ, et rien d'autre : ce qui change d'un build à l'autre
// sans que le contenu bouge.
//   · l'empreinte des assets (`/assets/index-Bx3kQ9aZ.js` → `index-[empreinte].js`) ;
//   · la date de build (`<lastBuildDate>` du flux RSS).
// Tout autre octet qui bouge fait échouer la comparaison, y compris une
// date de contenu : c'est voulu.
//
// COMMENT UN INSTANTANÉ CHANGE : jamais tout seul. Une modification VOULUE du
// prérendu s'enregistre par `npm run prerender:instantanes:maj`, relue dans le
// diff git. La commande refuse de tourner en CI (variable `CI`).
// Procédure complète : docs/TESTING.md § Instantanés du prérendu.
//
// Usage : npm run build && npm run check:prerender
// ═══════════════════════════════════════════════════════════════════
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

/** Dossier des instantanés versionnés, relatif à la racine du dépôt. */
export const DOSSIER_INSTANTANES = 'prerender/instantanes';

/** Fichiers produits par le prérendu hors `**​/index.html`. */
export const FICHIERS_HORS_PAGES = ['app.html', 'sitemap.xml', 'rss.xml', 'llms.txt'];

/** Extensions d'assets dont Vite empreinte le nom. */
const EXTENSIONS_ASSETS = 'js|mjs|css|woff2?|ttf|png|jpe?g|webp|avif|svg|gif|ico|json|map';

/**
 * `/assets/nom-Bx3kQ9aZ.ext` → `/assets/nom-[empreinte].ext`. L'empreinte de Vite
 * fait huit caractères (`[A-Za-z0-9_-]`), précédés d'un `-` et suivis de
 * l'extension : tout autre motif de huit caractères reste intact.
 */
const EMPREINTE = new RegExp(`(/assets/[A-Za-z0-9_./-]*?)-[A-Za-z0-9_-]{8}(\\.(?:${EXTENSIONS_ASSETS}))(?![A-Za-z0-9])`, 'g');

/** `<lastBuildDate>` du flux RSS : la seule date de build qui sorte du prérendu. */
const DATE_DE_BUILD = /<lastBuildDate>[^<]*<\/lastBuildDate>/g;

/** Retire ce qui change d'un build à l'autre. Rien d'autre. */
export function normaliser(texte) {
  return texte
    .replace(/\r\n/g, '\n')
    .replace(EMPREINTE, '$1-[empreinte]$2')
    .replace(DATE_DE_BUILD, '<lastBuildDate>[date du build]</lastBuildDate>');
}

/** Tous les fichiers sous `dossier`, chemins POSIX relatifs, triés. */
function lister(dossier, base = dossier) {
  const sortie = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const complet = join(dossier, entree.name);
    if (entree.isDirectory()) sortie.push(...lister(complet, base));
    else sortie.push(relative(base, complet).split(sep).join(posix.sep));
  }
  return sortie.sort();
}

/**
 * Les sorties du prérendu dans `dist/`, sous leur clé d'instantané.
 * `dist/guide/index.html` → `pages/guide.html`, `dist/en/blog/x/index.html` →
 * `pages/en__blog__x.html`, `dist/index.html` → `pages/index.html`.
 */
export function sortiesDuPrerendu(dist) {
  if (!existsSync(dist)) throw new Error(`${dist} absent : lancer npm run build d'abord`);
  const sorties = new Map();
  for (const fichier of lister(dist)) {
    if (fichier.startsWith('assets/')) continue;
    if (fichier === 'index.html' || fichier.endsWith('/index.html')) {
      const route = fichier.replace(/\/?index\.html$/, '');
      sorties.set(`pages/${route ? route.split('/').join('__') : 'index'}.html`, fichier);
    } else if (FICHIERS_HORS_PAGES.includes(fichier)) {
      sorties.set(`fichiers/${fichier}`, fichier);
    }
  }
  for (const attendu of FICHIERS_HORS_PAGES) {
    if (!sorties.has(`fichiers/${attendu}`)) throw new Error(`dist/${attendu} absent : le prérendu ne l'a pas produit`);
  }
  return sorties;
}

/** Contenu normalisé de chaque sortie, `clé → texte`. */
export function lireSorties(dist) {
  const lues = new Map();
  for (const [cle, fichier] of sortiesDuPrerendu(dist)) {
    lues.set(cle, normaliser(readFileSync(join(dist, fichier), 'utf8')));
  }
  return lues;
}

/** Instantanés versionnés, `clé → texte`. */
export function lireInstantanes(dossier) {
  const lus = new Map();
  if (!existsSync(dossier)) return lus;
  for (const fichier of lister(dossier)) lus.set(fichier, readFileSync(join(dossier, fichier), 'utf8').replace(/\r\n/g, '\n'));
  return lus;
}

/** La première ligne qui diffère, avec son voisinage, pour un message lisible. */
export function premierEcart(attendu, obtenu) {
  const a = attendu.split('\n');
  const b = obtenu.split('\n');
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) continue;
    const coupe = (s) => (s === undefined ? '(fin du fichier)' : s.length > 220 ? `${s.slice(0, 220)}… (+${s.length - 220} car.)` : s);
    return { ligne: i + 1, attendu: coupe(a[i]), obtenu: coupe(b[i]), lignesAttendues: a.length, lignesObtenues: b.length };
  }
  return null;
}

/**
 * Compare les sorties du prérendu aux instantanés.
 * @returns {Array<{cle:string, nature:'different'|'sans-instantane'|'orphelin', detail?:object}>}
 */
export function comparer(dist, dossierInstantanes) {
  const sorties = lireSorties(dist);
  const instantanes = lireInstantanes(dossierInstantanes);
  const ecarts = [];
  for (const [cle, texte] of sorties) {
    const attendu = instantanes.get(cle);
    if (attendu === undefined) ecarts.push({ cle, nature: 'sans-instantane' });
    else if (attendu !== texte) ecarts.push({ cle, nature: 'different', detail: premierEcart(attendu, texte) });
  }
  for (const cle of instantanes.keys()) {
    if (!sorties.has(cle)) ecarts.push({ cle, nature: 'orphelin' });
  }
  return ecarts.sort((x, y) => x.cle.localeCompare(y.cle));
}

/** Réécrit TOUS les instantanés depuis `dist/` et retire les orphelins. */
export function mettreAJour(dist, dossierInstantanes) {
  const sorties = lireSorties(dist);
  const avant = lireInstantanes(dossierInstantanes);
  for (const cle of avant.keys()) if (!sorties.has(cle)) rmSync(join(dossierInstantanes, cle));
  let ecrits = 0;
  for (const [cle, texte] of sorties) {
    if (avant.get(cle) === texte) continue;
    const cible = join(dossierInstantanes, cle);
    mkdirSync(join(cible, '..'), { recursive: true });
    writeFileSync(cible, texte, 'utf8');
    ecrits++;
  }
  return { total: sorties.size, ecrits, retires: [...avant.keys()].filter((c) => !sorties.has(c)).length };
}
