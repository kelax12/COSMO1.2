// ═══════════════════════════════════════════════════════════════════
// AM-3 du registre art. 30 · la liste des sous-traitants était tenue à la main
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Un service ajouté au produit (analytics, mail, anti-robot) est
// un destinataire de données personnelles, donc un sous-traitant au sens de
// l'art. 28, et rien ne le signalait. Cloudflare Turnstile et Resend ont vécu
// des semaines dans le code avant d'entrer au registre (ajouts du 2026-09-24).
//
// ── CE QUE LA GARDE DÉRIVE DU CODE ──────────────────────────────────
//   1. les origines de la CSP (`vercel.json`) ;
//   2. les hôtes en littéral dans `api/`, `supabase/functions/`, `src/`
//      (hors tests) ;
//   3. les SDK de `package.json` et les imports `npm:` des Edge Functions ;
//   4. `actions/upload-artifact` dans les workflows (GitHub reçoit alors un
//      fichier : la sauvegarde chiffrée).
// Chaque signal est rattaché à un tiers du CATALOGUE. Un signal qu'aucune
// entrée ne reconnaît fait ÉCHOUER la garde (tiers inconnu) : le catalogue ne
// peut pas rester muet sur un nouveau venu.
//
// ── CE QU'ELLE COMPARE ──────────────────────────────────────────────
//   · code → registre : chaque tiers du code est cité dans `RGPD-REGISTRE.md`
//     ET dans le tableau « Transferts hors Union européenne » ET dans le
//     tableau § 6 de `LEGAL.md` ;
//   · registre → code : chaque ligne du tableau des transferts est soit
//     appelée par le code, soit déclarée `horsDepot` ici avec sa raison (T11
//     vit dans un autre dépôt). Un tiers déclaré que plus rien n'appelle
//     échoue : un registre périmé atteste qu'on savait.
//
// ── CE QU'ELLE NE PROUVE PAS ────────────────────────────────────────
// ⚠️ Ni qu'un DPA est signé (ligne A5 de `LEGAL.md`), ni que la finalité ou la
// durée écrites au registre sont justes. ⚠️ Un tiers appelé par un secret
// dont l'hôte n'est pas en littéral (`OPS_ALERT_WEBHOOK_URL`, URL de webhook
// d'organisation) est invisible : ceux-là sont des destinations choisies à
// l'exécution, déclarées en T4. ⚠️ Un tiers joint par le SERVEUR Supabase
// (SMTP d'authentification, OAuth Google) n'a aucune ligne de code ici.
//
// ❌ NE JAMAIS AJOUTER UN TIERS À `HORS_DEPOT` POUR ÉTEINDRE UN ROUGE : il faut
//    alors prouver qu'aucun code de ce dépôt ne l'appelle, et le dire.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Le catalogue. `nom` : ce que le registre écrit. `hotes` : motifs d'hôte.
 * `deps` : paquets npm. `workflow` : motif cherché dans `.github/workflows`.
 */
export const CATALOGUE = [
  { id: 'supabase', nom: /Supabase/, hotes: [/(^|\.)supabase\.(co|com)$/], deps: [/^@supabase\//] },
  { id: 'vercel', nom: /Vercel/, hotes: [/(^|\.)vercel\.(com|app)$/, /vercel-scripts\.com$/], deps: [/^@vercel\//] },
  { id: 'stripe', nom: /Stripe/, hotes: [/(^|\.)stripe\.com$/], deps: [/^stripe$/, /^@stripe\//] },
  { id: 'sentry', nom: /Sentry/, hotes: [/(^|\.)sentry\.io$/], deps: [/^@sentry\//] },
  { id: 'resend', nom: /Resend/, hotes: [/(^|\.)resend\.com$/], deps: [/^resend$/] },
  { id: 'cloudflare', nom: /Cloudflare/, hotes: [/(^|\.)cloudflare\.com$/], deps: [/turnstile/i] },
  { id: 'google', nom: /Google/, hotes: [/(^|\.)google\.(com|fr)$/, /googleusercontent\.com$/, /googleapis\.com$/], deps: [] },
  { id: 'github', nom: /GitHub/, hotes: [], deps: [], workflow: /actions\/upload-artifact/, workflowFichier: /backup/ },
  { id: 'slack', nom: /Slack/, hotes: [/(^|\.)slack\.com$/], deps: [], tableauTransferts: false },
];

/**
 * Déclarés au registre, SANS appel dans ce dépôt. Chaque entrée dit où vit
 * l'appel. `motif` : ce que la ligne du tableau des transferts contient.
 */
export const HORS_DEPOT = [
  { motif: /Anthropic/, raison: 'T11 : classement des réponses de prospects, dépôt privé `analytics`' },
  { motif: /IONOS/, raison: 'T11 : boîtes d\'envoi de la prospection, dépôt privé `analytics`' },
];

/** Hôtes qui ne sont pas des destinataires : notre domaine, des espaces de noms XML, des exemples. */
const NEUTRES = [
  /(^|\.)thecosmo\.app$/, /^localhost$/, /^127\.0\.0\.1$/, /\.localhost$/, /\.test$/, /\.local$/, /\.internal$/,
  /(^|\.)w3\.org$/, /(^|\.)schema\.org$/, /(^|\.)example(\.[a-z.]+)?$/, /^x\.app$/,
];

/** SDK réseau qu'on reconnaît à leur nom : s'ils ne sont pas au catalogue, échec. */
const SDK_SUSPECTS = /^(@?(datadog|posthog|segment|mixpanel|amplitude|intercom|hotjar|logrocket|bugsnag|rollbar|firebase|algolia|twilio|sendgrid|mailgun|postmark|openai|anthropic|plausible|fathom|clarity|cloudinary|mapbox|recaptcha|hcaptcha|@google-analytics|react-ga|gtag|crisp|zendesk|hubspot|launchdarkly|statsig|amplitude)|@sentry|@vercel|@supabase|@stripe|stripe|resend)/i;

const IGNORES = new Set(['node_modules', 'dist', '.git', '.claude', '.worktrees', 'coverage', '__tests__']);

function fichiers(dossier, exts, out = []) {
  if (!existsSync(dossier)) return out;
  for (const nom of readdirSync(dossier)) {
    if (IGNORES.has(nom)) continue;
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) fichiers(p, exts, out);
    else if (exts.some((e) => nom.endsWith(e)) && !/\.(test|spec|guard\.test)\./.test(nom)) out.push(p);
  }
  return out;
}

function lire(p) {
  return readFileSync(p, 'utf8');
}

const estNeutre = (h) => NEUTRES.some((re) => re.test(h));
const catalogueDe = (h) => CATALOGUE.find((t) => t.hotes.some((re) => re.test(h)));

/** `https://a.b.c/x` → `a.b.c`, `https://*.x.co` → `x.co`. */
function hotesDe(texte) {
  const hotes = new Set();
  for (const m of texte.matchAll(/(?:https?|wss?):\/\/(\*\.)?([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) hotes.add(m[2].toLowerCase());
  return hotes;
}

/**
 * Dérive les tiers du code. Rend `{ tiers: Map<id, string[]>, inconnus: string[] }`.
 * `tiers` : id du catalogue → signaux (pour le message). `inconnus` : signaux
 * qu'aucune entrée du catalogue ne reconnaît.
 */
export function deriver(racine) {
  const tiers = new Map();
  const inconnus = [];
  const noter = (t, signal) => {
    if (!tiers.has(t.id)) tiers.set(t.id, []);
    const l = tiers.get(t.id);
    if (!l.includes(signal)) l.push(signal);
  };
  const traiterHote = (h, signal, strict) => {
    if (estNeutre(h)) return;
    const t = catalogueDe(h);
    if (t) noter(t, signal);
    else if (strict) inconnus.push(`${signal} · hôte inconnu \`${h}\``);
  };

  // 1. CSP : strict, chaque origine est un destinataire potentiel.
  const vercelJson = join(racine, 'vercel.json');
  if (existsSync(vercelJson)) {
    const cfg = JSON.parse(lire(vercelJson));
    for (const bloc of cfg.headers ?? []) {
      for (const h of bloc.headers ?? []) {
        if (h.key !== 'Content-Security-Policy') continue;
        for (const hote of hotesDe(h.value)) traiterHote(hote, `CSP ${hote}`, true);
      }
    }
  }

  // 2. Hôtes en littéral. Strict seulement derrière un `fetch(` ou dans api/ et
  //    functions/ ; ailleurs (liens, textes), on reconnaît sans accuser.
  for (const dossier of ['api', 'supabase/functions', 'src']) {
    for (const f of fichiers(join(racine, dossier), ['.ts', '.tsx'])) {
      const texte = lire(f);
      const rel = relative(racine, f).split(sep).join('/');
      const appel = new Set();
      for (const m of texte.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g)) for (const h of hotesDe(m[1])) appel.add(h);
      for (const h of hotesDe(texte)) traiterHote(h, `hôte ${h} dans ${rel}`, appel.has(h));
    }
  }

  // 3. Dépendances.
  const pkg = JSON.parse(lire(join(racine, 'package.json')));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const prod = Object.keys(pkg.dependencies ?? {});
  for (const d of prod) {
    const t = CATALOGUE.find((x) => x.deps.some((re) => re.test(d)));
    if (t) noter(t, `dépendance ${d}`);
    else if (SDK_SUSPECTS.test(d)) inconnus.push(`dépendance \`${d}\` : SDK réseau absent du catalogue`);
  }
  void deps;
  for (const f of fichiers(join(racine, 'supabase/functions'), ['.ts'])) {
    for (const m of lire(f).matchAll(/from\s+['"]npm:(@?[^@'"/]+(?:\/[^@'"]+)?)@/g)) {
      const d = m[1];
      const t = CATALOGUE.find((x) => x.deps.some((re) => re.test(d)));
      if (t) noter(t, `import npm:${d} dans ${relative(racine, f).split(sep).join('/')}`);
      else if (SDK_SUSPECTS.test(d)) inconnus.push(`import npm:${d} : SDK réseau absent du catalogue`);
    }
  }

  // 4. Workflows.
  for (const f of fichiers(join(racine, '.github/workflows'), ['.yml', '.yaml'])) {
    const texte = lire(f);
    for (const t of CATALOGUE) if (t.workflow?.test(texte) && (t.workflowFichier?.test(f) ?? true)) noter(t, `workflow ${relative(racine, f).split(sep).join('/')}`);
  }

  return { tiers, inconnus };
}

/** Lignes du premier tableau suivant le titre `## Transferts hors Union européenne`. */
export function tableauTransferts(registre) {
  const i = registre.indexOf('## Transferts hors Union européenne');
  if (i < 0) return [];
  const bloc = registre.slice(i).split('\n## ')[0];
  return bloc
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l) && !/Sous-traitant/.test(l))
    .map((l) => l.split('|')[1].trim());
}

/** Lignes du tableau § 6 de LEGAL.md (première colonne). */
export function tableauLegal(legal) {
  const i = legal.indexOf('## 6. Sous-traitants et transferts');
  if (i < 0) return [];
  const bloc = legal.slice(i).split('\n---')[0];
  return bloc
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l) && !/Prestataire/.test(l))
    .map((l) => l.split('|')[1].trim());
}

/** Rend la liste des écarts (vide si tout concorde). */
export function comparer({ tiers, inconnus }, registre, legal) {
  const erreurs = [...inconnus.map((s) => `tiers inconnu du catalogue : ${s}`)];
  const lignesRegistre = tableauTransferts(registre);
  const lignesLegal = tableauLegal(legal);
  if (lignesRegistre.length < 5) erreurs.push('tableau des transferts du registre introuvable ou vide : extraction cassée');
  if (lignesLegal.length < 3) erreurs.push('tableau § 6 de LEGAL.md introuvable ou vide : extraction cassée');

  for (const [id, signaux] of tiers) {
    const t = CATALOGUE.find((x) => x.id === id);
    const vu = `(vu : ${signaux.slice(0, 2).join(' ; ')})`;
    if (!t.nom.test(registre)) erreurs.push(`\`${id}\` est appelé par le code ${vu} mais n'apparaît nulle part dans RGPD-REGISTRE.md`);
    else if (t.tableauTransferts !== false && !lignesRegistre.some((l) => t.nom.test(l))) {
      erreurs.push(`\`${id}\` est appelé par le code ${vu} mais absent du tableau « Transferts hors Union européenne » du registre`);
    }
    if (t.tableauTransferts !== false && !lignesLegal.some((l) => t.nom.test(l))) {
      erreurs.push(`\`${id}\` est appelé par le code ${vu} mais absent du tableau § 6 de LEGAL.md`);
    }
  }

  for (const ligne of lignesRegistre) {
    if (HORS_DEPOT.some((h) => h.motif.test(ligne))) continue;
    const t = CATALOGUE.find((x) => x.nom.test(ligne));
    if (!t) erreurs.push(`le registre déclare « ${ligne} » : aucun tiers du catalogue ne le porte (ni \`HORS_DEPOT\`)`);
    else if (!tiers.has(t.id)) erreurs.push(`le registre déclare « ${ligne} » mais plus aucun code ne l'appelle : le retirer, ou le justifier dans HORS_DEPOT`);
  }
  for (const ligne of lignesLegal) {
    if (/^Analytics$/i.test(ligne)) continue;
    const t = CATALOGUE.find((x) => x.nom.test(ligne));
    if (t && !tiers.has(t.id)) erreurs.push(`LEGAL.md § 6 déclare « ${ligne} » mais plus aucun code ne l'appelle`);
  }
  return erreurs;
}

/** Plancher : une dérivation qui ne voit plus rien rend « tout va bien ». */
export const PLANCHER_TIERS = 6;

export function main(racine) {
  const derive = deriver(racine);
  const registre = lire(join(racine, 'docs/RGPD-REGISTRE.md'));
  const legal = lire(join(racine, 'docs/LEGAL.md'));
  const erreurs = comparer(derive, registre, legal);
  if (derive.tiers.size < PLANCHER_TIERS) erreurs.push(`seulement ${derive.tiers.size} tiers dérivés (plancher ${PLANCHER_TIERS}) : la dérivation est cassée`);

  console.log('Sous-traitants · DÉRIVÉS du code (CSP, hôtes, SDK, workflows), RGPD art. 28 / art. 30');
  for (const [id, s] of [...derive.tiers].sort()) console.log(`  ${id.padEnd(11)} ${s.length} signal(aux)`);
  console.log(`  déclarés hors dépôt : ${HORS_DEPOT.map((h) => h.motif.source).join(', ')}`);
  console.log('⚠️ Ne prouve ni qu\'un DPA est signé, ni que finalité et durée sont justes.');
  if (erreurs.length > 0) {
    console.error('\n✖ Sous-traitants :');
    for (const e of erreurs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('\n✓ Le registre et LEGAL.md déclarent exactement les tiers que le code appelle.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(join(fileURLToPath(import.meta.url), '..', '..'));
}
