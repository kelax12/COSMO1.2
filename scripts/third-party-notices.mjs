// ═══════════════════════════════════════════════════════════════════
// NOTICES DES LICENCES TIERCES : dist/third-party-notices.txt
//
// 🔴 POURQUOI (audit juridique du 2026-09-24, ligne F9 de docs/LEGAL.md).
// MIT, ISC, BSD et Apache-2.0 sont permissives, mais toutes posent la même
// condition : reproduire la mention de copyright et la licence dans toute
// copie distribuée. Le bundle servi au navigateur en est une, et le build
// retire les commentaires de licence. Aucun fichier ne les reproduisait.
//
// Généré au BUILD, jamais commité : une liste tenue à la main vieillit à la
// première dépendance ajoutée, et c'est exactement ce qu'elle doit suivre.
//
// Périmètre : `dependencies` du package.json et leur fermeture transitive.
// C'est un SUR-ENSEMBLE de ce que Vite embarque (le tree-shaking en retire),
// et c'est le bon sens de l'erreur : une notice en trop ne coûte rien, une
// notice manquante est un manquement à la licence.
//
// Usage : node scripts/third-party-notices.mjs [fichier de sortie]
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Remonte l'arborescence comme Node pour trouver `node_modules/<name>`. */
export function findPackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function licenseText(dir) {
  const file = fs
    .readdirSync(dir)
    .find((f) => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f));
  return file ? fs.readFileSync(path.join(dir, file), 'utf8').trim() : null;
}

export function licenseName(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'UNKNOWN';
}

/**
 * Parcourt la fermeture transitive des `dependencies` de `root` et rend une
 * entrée par paquet installé (dédoublonnée par dossier), triée par nom.
 */
export function collectNotices(root) {
  const rootPkg = readJson(path.join(root, 'package.json'));
  const seen = new Map(); // dir -> { name, version, license, text }
  const queue = Object.keys(rootPkg.dependencies ?? {}).map((name) => [name, root]);

  while (queue.length > 0) {
    const [name, from] = queue.shift();
    const dir = findPackageDir(name, from);
    if (!dir || seen.has(dir)) continue;
    const pkg = readJson(path.join(dir, 'package.json'));
    seen.set(dir, {
      name: pkg.name ?? name,
      version: pkg.version ?? '?',
      license: licenseName(pkg),
      text: licenseText(dir),
    });
    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const dep of Object.keys(deps)) queue.push([dep, dir]);
  }

  return [...seen.values()].sort((a, b) =>
    a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
  );
}

/** Le fichier publié : un en-tête, puis chaque paquet et le texte de sa licence. */
export function renderNotices(entries) {
  const lines = [
    'COSMO · composants open source tiers et leurs licences',
    'Third-party open source components and their licences',
    '',
    `${entries.length} paquets. Généré au build à partir des dépendances de production.`,
    '',
  ];
  for (const e of entries) {
    lines.push('='.repeat(72), `${e.name}@${e.version} · ${e.license}`, '='.repeat(72));
    lines.push(e.text ?? `(Aucun fichier de licence fourni par le paquet. Licence déclarée : ${e.license}.)`, '');
  }
  return lines.join('\n');
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const root = process.cwd();
  const out = process.argv[2] ?? path.join(root, 'dist', 'third-party-notices.txt');
  const entries = collectNotices(root);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderNotices(entries));
  const missing = entries.filter((e) => !e.text).length;
  console.log(`third-party-notices : ${entries.length} paquets, ${missing} sans fichier de licence → ${path.relative(root, out)}`);
}
