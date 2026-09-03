#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// i18n-scan.mjs — inventaire des chaînes NON traduites
//
// Complément de `i18n-check.mjs` : celui-ci vérifie que les catalogues
// existants sont cohérents ; celui-là dit ce qu'il RESTE à extraire.
//
//   npm run i18n:scan            → combien, et dans quels fichiers
//   npm run i18n:scan -- --list  → LESQUELLES
//
// Cinq familles de motifs (détail au-dessus de `PATTERNS`) : texte JSX,
// attributs textuels, toasts, propriétés d'objet, et messages rendus par du
// code. Heuristique volontairement large : mieux vaut un faux positif qu'une
// chaîne oubliée, le bruit est trié après coup par `looksLikeCode`.
//
// ── LE CLIQUET, ET POURQUOI IL EXISTE ──────────────────────────────
//
// Ce script ne faisait PAS échouer la CI, et c'est précisément ce qui a laissé
// la dette grossir jusqu'à 334 chaînes dans 76 fichiers sans que rien ne
// l'annonce. `i18n:check`, la seule gate bloquante, compare les CLÉS des deux
// catalogues : une chaîne jamais externalisée n'a pas de clé, donc elle lui est
// invisible par construction.
//
// Le script échoue au-dessus de `MAX_STRINGS`, aujourd'hui à **ZÉRO** : plus
// une seule chaîne d'interface en dur dans `src/`.
//
// 🔴 Le réflexe à ne pas avoir : relever ce seuil pour faire passer la CI. Même
// règle que le cliquet d'architecture, pour la même raison — il ne tourne que
// dans un sens, et c'est ce qui le rend utile.
//
// ── 🔴 UN SEUIL NE PROUVE QUE CE QUE LA MESURE COUVRE ───────────────
//
// Le point important de ce fichier n'est pas son chiffre, c'est que ce chiffre
// a menti DEUX FOIS, de la même façon, à un mois d'intervalle.
//
// **Première fois.** Le cliquet est posé à 4, en concluant « aucune chaîne
// d'interface n'est plus en dur ». C'était faux, et le gate le certifiait :
// quatre formes entières passaient sous le radar, chacune retrouvée à la main
// dans le produit —
//
//   1. texte JSX contenant une interpolation (« Aujourd'hui · {x} min ») : le
//      motif refusait `{` et `}` pour éviter de capturer du code ;
//   2. texte JSX sur PLUSIEURS lignes — le paragraphe de `RootErrorBoundary` ;
//   3. propriété d'objet `label:` (par opposition à l'attribut JSX `label=`) —
//      les libellés de récurrence, de période, de priorité, de report ;
//   4. valeur par DÉFAUT d'une prop — `saveLabel = 'Créer'`.
//
// Les quatre sont couvertes. Le seuil est alors monté à 25, honnêtement, le
// temps de résorber ce que la mesure élargie révélait — puis redescendu à ZÉRO
// une fois l'extraction faite.
//
// **Seconde fois (revue du 2026-09-02, point 7).** Seuil à ZÉRO, CI verte, et
// il restait 22 chaînes d'interface en dur. Dont les CINQ SECTIONS DE LA
// LANDING, rendues intégralement en français à un visiteur anglophone, alors
// que leurs quarante clés traduites dormaient dans `landing.json` sans un seul
// consommateur. Quatre angles morts cette fois —
//
//   a. les MESSAGES rendus par du code : `return '…'`, `throw new Error('…')`,
//      `return { error: '…' }`. Aucun motif ne regardait ces formes, or c'est
//      là que vivaient les six chaînes d'`AuthContext` et les cinq de
//      `friends/supabase.repository`, toutes remontées à l'écran ;
//   b. le français SANS ACCENT ET SANS MOT-OUTIL de la liste : « Aujourd'hui »,
//      « Demain », « Lundi prochain », « Pas de date » ;
//   c. le corps d'une chaîne excluait les TROIS guillemets à la fois, donc une
//      apostrophe dans une chaîne à guillemets doubles rendait la valeur
//      incapturable — « Aujourd'hui » en faisait partie (cf. `QUOTED`) ;
//   d. le filtre « identifiant seul » jetait « Demain » : un mot français isolé
//      ressemble à un identifiant (cf. `looksLikeCode`).
//
// ⚠️ Les deux DERNIERS ne sont pas venus d'une relecture du code de la mesure,
// mais d'un test : on a soumis au scan les chaînes qu'il était censé voir. Les
// deux premiers avaient été corrigés en croyant le travail fini. C'est la
// leçon, et elle vaut au-delà de ce script : **avant de conclure « plus rien en
// dur », soumettre la chose à la mesure, pas relire la mesure.**
//
// ── CE QUE LE SCAN NE VOIT VOLONTAIREMENT PAS ──────────────────────
//
// Deux exclusions, et ce sont des décisions, pas des angles morts :
//
//   - les COMMENTAIRES de code — ce dépôt commente en français ;
//   - les SEEDS de démonstration, dont le français est la forme de référence,
//     recouverte en anglais par `localizeSeed` / `isEnglishSeed`.
//
// ⚠️ Ce qu'il ne verra jamais : une phrase construite par concaténation, ou un
// texte hors de `src/`. Le total est un PLANCHER, pas une preuve.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = /(__test__|showcase|\.test\.|\.spec\.)/;

// ── Les seeds de demonstration ne sont PAS une dette ──────────────
//
// `localizeSeed` traduit les donnees de demo par recouvrement, keye par id
// (src/i18n/seed.ts) : le francais y est la forme de reference, pas un oubli.
// Les compter gonflait le rapport de ~50 chaines qu'aucune extraction ne doit
// jamais toucher.
//
// La detection porte sur l'USAGE des helpers de recouvrement, jamais sur le nom
// du fichier : un seed qui cesserait d'etre traduit redeviendrait visible, ce
// qui est exactement le signal qu'on veut. `isEnglishSeed` compte au meme titre
// que `localizeSeed` — c'est la forme que prennent les seeds a structure
// imbriquee (les OKR, dont le recouvrement ne peut pas etre generique).
const isSeedFile = (source) => /localizeSeed|isEnglishSeed|SEED_I18N/.test(source);

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
//
// 🔴 Elargie le 2026-09-02 (point 7 de la revue). « Aujourd'hui », « Demain »,
// « Lundi prochain » et « Pas de date » n'ont NI accent NI mot-outil de la
// liste d'origine : les presets des DEUX pickers du produit etaient donc
// invisibles pour ce scan, qui certifiait « zero chaine en dur » pendant
// qu'ils s'affichaient en francais a un anglophone.
const FR_STOPWORD =
  "\\b(?:le|la|les|un|une|des|du|au|aux|dans|sur|sous|avec|sans|pour|par|vous|votre|vos|son|sa|ses|cette|qui|que|tout|tous|toute|plus|moins|aucun|aucune|ajouter|retirer|supprimer|modifier|annuler|valider|placer|choisir|voir|entreprise|collaborateur|membre|membres|equipe|agenda|jour|semaine|mois|nom|liste|projet|projets|tache|taches" +
  "|aujourd|demain|hier|prochain|prochaine|pas|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche" +
  // Vocabulaire des MESSAGES d'erreur, qui vivent dans des `return` et des
  // `throw` — formes que les motifs ne regardaient pas non plus.
  "|erreur|utilisateur|veuillez|survenue|connexion|compte|champ|obligatoire|introuvable|saisir|reserve)\\b";

/** Une chaîne « française » : accent OU mot-outil français. */
const FR = `(?:${ACC}|${FR_STOPWORD})`;

/**
 * Corps d'une chaine, borne par SON PROPRE delimiteur.
 *
 * 🔴 L'ancienne forme excluait du corps les TROIS guillemets a la fois. Une
 * chaine entre guillemets DOUBLES contenant une apostrophe etait donc
 * incapturable — « Aujourd'hui », le libelle le plus visible des deux pickers
 * du produit, en faisait partie. Le delimiteur est capture (groupe 1), et le
 * corps ne s'arrete que sur LUI (groupe 2).
 *
 * Consequence : ces motifs rendent la valeur en groupe 2, d'ou le second
 * element de chaque entree de PATTERNS.
 */
const QUOTED = (inner) => `(['"\`])((?:(?!\\1)[^\\n])*${inner}(?:(?!\\1)[^\\n])*)\\1`;

/** `[motif, index du groupe qui porte la valeur]`. */
const PATTERNS = [
  // (1) Texte JSX. `[^<>]` au lieu de `[^<>{}\n]` : une phrase coupee par une
  // interpolation (« Aujourd'hui · {x} min ») ou etalee sur plusieurs lignes
  // reste une phrase affichee. Le bruit est trie plus bas.
  [new RegExp(`>\\s*([^<>]*${FR}[^<>]*?)\\s*<`, 'gi'), 1],
  // (2) Attributs textuels, guillemets DROITS comme accolades : `title="…"` et
  // `title={"…"}` affichent la meme chose.
  [new RegExp(`(?:title|aria-label|placeholder|label|actionLabel|description|alt)=\\{?\\s*${QUOTED(FR)}`, 'gi'), 2],
  // (3) Toasts et confirmations.
  [new RegExp(`(?:toast\\.\\w+|showUndoToast|confirm)\\(\\s*${QUOTED(FR)}`, 'gi'), 2],
  // (4) Proprietes d'objet et valeurs par defaut de props : `label: 'Semaine'`,
  // `saveLabel = 'Creer'`. C'est la que vivaient les libelles de recurrence, de
  // periode, de priorite et de report — invisibles pendant tout le chantier.
  [new RegExp(`(?<![A-Za-z])(?:label|title|name|text|placeholder|hint|heading)\\s*[:=]\\s*${QUOTED(FR)}`, 'gi'), 2],
  // (5) MESSAGES rendus par du CODE et non par du JSX : `return '…'`,
  // `return \`…\``, `throw new Error('…')`, `return { error: '…' }`.
  //
  // 🔴 Aucun des quatre motifs precedents ne regardait ces formes, par
  // construction : le gate certifiait donc un etat qu'il ne mesurait pas
  // (revue du 2026-09-02, point 7). C'est la que vivaient les six chaines de
  // `AuthContext` et les cinq de `friends/supabase.repository`, toutes
  // remontees a l'ecran.
  [new RegExp(`(?:return|new Error\\(|(?<![A-Za-z])(?:error|message|description|reason)\\s*:)\\s*\\{?\\s*${QUOTED(FR)}`, 'gi'), 2],
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
  // 🔴 Le filtre « identifiant seul » ne s'applique QU'AUX valeurs sans
  // mot-outil francais. Applique en bloc, il jetait « Demain » — un mot
  // francais isole ressemble a un identifiant — alors que la valeur n'arrive
  // ici que parce qu'elle a DEJA matche FR. Il ne reste utile que pour les
  // captures accentuees qui sont vraiment du code (`données`, `créé`).
  (/^[A-Za-z0-9_$.]+$/.test(v) && !new RegExp(FR_STOPWORD, 'i').test(v)) ||
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
  for (const [re, group] of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      // Une phrase JSX peut arriver sur plusieurs lignes : on la normalise
      // avant de la compter, sinon la meme phrase compterait deux fois selon
      // l'endroit ou le formatage l'a coupee.
      const v = m[group].replace(/\s+/g, ' ').trim();
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
const MAX_STRINGS = 0;

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
