#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// i18n-scan.mjs — inventaire des chaînes NON traduites
//
// Complément de `i18n-check.mjs` : celui-ci vérifie que les catalogues
// existants sont cohérents ; celui-là dit ce qu'il RESTE à extraire.
//
// Heuristique volontairement large (texte JSX, attributs textuels, toasts,
// littéraux accentués) : il vaut mieux un faux positif qu'une chaîne oubliée.
//
//   npm run i18n:scan
//
// Sortie : nombre de fichiers et de chaînes restantes, puis le détail trié par
// volume décroissant.
//
// ── CLIQUET (2026-09-02, risque R-05) ──────────────────────────────
//
// Ce script ne faisait PAS échouer la CI, et c'est précisément ce qui a laissé
// la dette grossir jusqu'à 334 chaînes dans 76 fichiers, sans que rien ne
// l'annonce. `i18n:check`, la seule gate bloquante, compare les CLÉS des deux
// catalogues : une chaîne jamais externalisée n'a pas de clé, donc elle lui est
// invisible par construction.
//
// Le script échoue au-dessus de `MAX_STRINGS` : la dette ne peut plus remonter,
// et chaque extraction future doit faire BAISSER le nombre ci-dessous.
//
// 🔴 Un seuil n'est une preuve que si la mesure regarde au bon endroit. Le
// seuil a valu 4 pendant une journée, sur une heuristique qui ne voyait pas
// quatre formes entières — le rapport certifiait alors « plus aucune chaîne en
// dur » pendant qu'il en restait des dizaines dans le produit. Il vaut 25
// aujourd'hui, sur une heuristique élargie : un chiffre plus haut et honnête
// vaut mieux qu'un chiffre flatteur qui ne mesure pas ce qu'il annonce.
//
// Ce qui reste (25, listé par `npm run i18n:scan -- --list`) vit hors des
// composants : titres SEO des pages d'authentification, grille de la page
// Premium, quelques libellés de démonstration. `src/components` est à ZÉRO.
//
// 🔴 Le réflexe à ne pas avoir : relever ce seuil pour faire passer la CI. Même
// règle que le cliquet d'architecture, pour la même raison — il ne tourne que
// dans un sens, et c'est ce qui le rend utile.
//
// ── QUATRE ANGLES MORTS, COMBLÉS LE 2026-09-02 ─────────────────────
//
// Le cliquet a été posé à 4 en concluant « aucune chaîne d'interface n'est plus
// en dur ». C'était faux, et le gate le certifiait : la mesure servait de preuve
// alors qu'elle ne couvrait pas ce qu'elle prétendait mesurer. Quatre formes
// passaient sous le radar, chacune retrouvée à la main dans le produit :
//
//   1. texte JSX contenant une interpolation — `Aujourd'hui · {x} min` (le
//      motif refusait `{` et `}` pour éviter de capturer du code) ;
//   2. texte JSX sur PLUSIEURS lignes — le paragraphe de `RootErrorBoundary` ;
//   3. propriété d'objet `label:` (par opposition à l'attribut JSX `label=`) —
//      les libellés de récurrence, de période, de priorité, de report ;
//   4. valeur par DÉFAUT d'une prop — `saveLabel = 'Créer'`.
//
// Les quatre sont couvertes ci-dessous. Le total est remonté en conséquence :
// un cliquet honnête à un chiffre plus haut vaut mieux qu'un cliquet flatteur
// qui ne regarde pas au bon endroit.
//
// ⚠️ Ce que le scan ne verra jamais : une phrase construite par concaténation,
// ou un texte hors de `src/`. Le total est un plancher, pas une preuve.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = /(__test__|showcase|\.test\.|\.spec\.)/;

// ── Les seeds de demonstration ne sont PAS une dette ──────────────
//
// `localizeSeed` traduit les donnees de demo par recouvrement, keye par id
// (src/i18n/seed.ts) : le francais y est la forme de reference, pas un oubli.
// Les compter gonflait le rapport de ~50 chaines qu'aucune extraction ne doit
// jamais toucher. La detection porte sur l'USAGE de `localizeSeed`, pas sur le
// nom du fichier : un seed qui cesserait d'etre traduit redeviendrait visible.
const isSeedFile = (source) => /localizeSeed|SEED_I18N/.test(source);

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'locales') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

// Toutes les voyelles accentuées du français, PAS seulement les plus courantes.
// La version précédente omettait `â` : « tâches » — le mot le plus fréquent de
// l'app — était donc invisible pour le scan, et avec lui toute chaîne qui ne
// contenait pas d'autre accent (« Toutes les tâches », « Tâches de… »).
const ACC = '[éèêëàâäçùûüôöîïœÉÈÊËÀÂÄÇÙÛÔÖÎÏŒ]';

// ── L'angle mort de l'accent (2026-08-08) ──
//
// Ne chercher QUE des voyelles accentuées rendait invisible tout le français
// qui n'en porte pas : « Ajouter un collaborateur », « Voir son agenda »,
// « Retirer de l'entreprise », « Annuler », « Jour / Semaine / Mois »… Le mode
// entreprise était déclaré « propre » sur cette base alors qu'il restait ~50
// chaînes en dur — constaté en lisant l'écran, pas le rapport.
//
// D'où ce second signal : un mot-outil français fréquent, qui n'existe pas en
// anglais et n'apparaît quasiment jamais dans du code. On garde une liste
// FERMÉE plutôt qu'un dictionnaire : chaque mot ajouté doit être un mot dont
// la présence prouve à elle seule qu'on lit une phrase française.
const FR_STOPWORD =
  "\\b(?:le|la|les|un|une|des|du|au|aux|dans|sur|sous|avec|sans|pour|par|vous|votre|vos|son|sa|ses|cette|qui|que|tout|tous|toute|plus|moins|aucun|aucune|ajouter|retirer|supprimer|modifier|annuler|valider|placer|choisir|voir|entreprise|collaborateur|membre|membres|equipe|agenda|jour|semaine|mois|nom|liste|projet|projets|tache|taches)\\b";

/** Une chaîne « française » : accent OU mot-outil français. */
const FR = `(?:${ACC}|${FR_STOPWORD})`;

const PATTERNS = [
  // (1) Texte JSX. `[^<>]` au lieu de `[^<>{}\n]` : une phrase coupee par une
  // interpolation (« Aujourd'hui · {x} min ») ou etalee sur plusieurs lignes
  // reste une phrase affichee. Le bruit est trie plus bas.
  new RegExp(`>\\s*([^<>]*${FR}[^<>]*?)\\s*<`, 'gi'),
  // (2) Attributs textuels, guillemets DROITS comme accolades : `title="…"` et
  // `title={"…"}` affichent la meme chose.
  new RegExp(`(?:title|aria-label|placeholder|label|actionLabel|description|alt)=\\{?\\s*["'\`]([^"'\`]*${FR}[^"'\`]*)["'\`]`, 'gi'),
  // (3) Toasts et confirmations.
  new RegExp(`(?:toast\\.\\w+|showUndoToast|confirm)\\(\\s*['"\`]([^'"\`]*${FR}[^'"\`]*)['"\`]`, 'gi'),
  // (4) Proprietes d'objet et valeurs par defaut de props : `label: 'Semaine'`,
  // `saveLabel = 'Creer'`. C'est la que vivaient les libelles de recurrence, de
  // periode, de priorite et de report — invisibles pendant tout le chantier.
  new RegExp(`(?<![A-Za-z])(?:label|title|name|text|placeholder|hint|heading)\\s*[:=]\\s*['"\`]([^'"\`\\n]*${FR}[^'"\`\\n]*)['"\`]`, 'gi'),
];

// ── Ce qui n'est PAS une phrase d'interface ────────────────────────
//
// Elargir le motif (1) aux interpolations et aux retours a la ligne fait
// entrer du CODE dans la capture : un `=>`, un commentaire `{/* … */}`, un
// generique `<T>`. Plutot que de re-restreindre le motif — c'est cette
// restriction qui creait les angles morts — on filtre APRES coup, sur des
// marqueurs qui n'apparaissent jamais dans une phrase affichee.
const CODE_MARKERS = ['=>', '/*', '*/', '//', '${', ';', '==', '&&', '||', '):', '): '];

// Un guillemet DROIT colle a un separateur de code (`, '` · `: '` · `('`) ne
// se produit pas dans une phrase affichee, mais partout dans un tableau
// d'objets. C'est ce motif qui faisait remonter les entrees de la palette de
// commandes comme si c'etaient des phrases.
const CODE_QUOTING = /['"]\s*[,:)\]]|[,:(\[]\s*['"]/;

const looksLikeCode = (v) =>
  CODE_MARKERS.some((m) => v.includes(m)) ||
  CODE_QUOTING.test(v) ||
  /^[A-Za-z0-9_$.]+$/.test(v) ||          // un identifiant seul
  /\b(?:const|function|return|import|export|interface|type)\b/.test(v) ||
  v.length > 220;                          // un bloc entier, pas une phrase

// ── Les COMMENTAIRES ne sont pas de l'interface ───────────────────
//
// Ce depot commente en francais, abondamment, et cite du JSX dans ses
// commentaires (« un `<Button>` pose dans un `<form>` »). Le motif (1) y voyait
// des phrases affichees. On retire donc les blocs `/* … */` et les lignes qui
// COMMENCENT par `//` — jamais un `//` en milieu de ligne, qui serait le `//`
// d'une URL dans une vraie chaine.
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

const rows = [];
for (const f of walk('src')) {
  const raw = readFileSync(f, 'utf8');
  if (isSeedFile(raw)) continue;
  const s = stripComments(raw);
  const hits = new Set();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      // Une phrase JSX peut arriver sur plusieurs lignes : on la normalise
      // avant de la compter, sinon la meme phrase compterait deux fois selon
      // l'endroit ou le formatage l'a coupee.
      const v = m[1].replace(/\s+/g, ' ').trim();
      if (!v || v.length < 3) continue;
      if (/^[\d\s%·—–\-+.,:/()€]+$/.test(v)) continue;
      // Une interpolation est conservee DANS une phrase (« {x} min » en est
      // une), mais un fragment qui n'est que du code n'en est pas une.
      if (/^\{[^}]*\}$/.test(v)) continue;
      if (looksLikeCode(v)) continue;
      hits.add(v);
    }
  }
  if (hits.size > 0) rows.push([hits.size, f.replace(/\\/g, '/'), [...hits]]);
}
rows.sort((a, b) => b[0] - a[0]);
const total = rows.reduce((s, r) => s + r[0], 0);
console.log('FICHIERS:', rows.length, '| CHAINES UNIQUES:', total);
// `--list` dit CE QU'IL FAUT extraire, pas seulement combien. Sans lui, le
// rapport annonce une dette sans jamais montrer une seule phrase.
const LIST = process.argv.includes('--list');
for (const [n, f, strings] of rows) {
  console.log(String(n).padStart(4), f);
  if (LIST) for (const v of strings) console.log('       ·', v);
}

// Cliquet : voir l'en-tête de ce fichier avant de toucher à ce nombre.
const MAX_STRINGS = 25;

if (total > MAX_STRINGS) {
  console.error(
    `\ni18n-scan : ${total} chaînes en dur > ${MAX_STRINGS} autorisées.\n` +
    "Externaliser les nouvelles chaînes avant de livrer. Ne PAS relever le seuil :\n" +
    "c'est ce qui a laissé la dette monter à 334 sans que personne ne le voie.",
  );
  process.exit(1);
}

if (total < MAX_STRINGS) {
  console.log(
    `\n✅ ${MAX_STRINGS - total} chaîne(s) de moins que le seuil. ` +
    `Baisser MAX_STRINGS à ${total} dans scripts/i18n-scan.mjs pour verrouiller le gain.`,
  );
}
