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
// ── LE CLIQUET ─────────────────────────────────────────────────────
//
// `i18n:check` compare les CLÉS : une chaîne jamais externalisée lui est
// invisible. Ce script échoue au-dessus de `MAX_STRINGS`, à **ZÉRO**.
// 🔴 Ne jamais relever ce seuil pour faire passer la CI.
//
// 🔴 Un seuil ne prouve que ce que la mesure couvre : chaque forme couverte est un
// ancien angle mort, nommé dans `i18n-scan.guard.test.mjs`. ✅ Avant de conclure
// « plus rien en dur » : soumettre des chaînes à la mesure, pas relire la mesure.
//
// ── CE QUE LE SCAN NE VOIT VOLONTAIREMENT PAS ──────────────────────
//
// Trois exclusions voulues : les COMMENTAIRES (en français) ; les SEEDS de démo,
// recouverts par locale par `localizeSeed` / `seedOverlay` / `seedText` ; la
// SYNTAXE quick-add (`QUICK_ADD_FR_ONLY_SYNTAX`), dont les mots-clés français ne
// se traduisent pas sans casser la démonstration.
//
// ⚠️ Ce qu'il ne verra jamais : une phrase construite par concaténation, ou un
// texte hors de `src/`. Le total est un PLANCHER, pas une preuve.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = /(__test__|showcase|\.test\.|\.spec\.)/;

// Seeds de démo : le français est la forme de référence, recouverte par
// `localizeSeed` / `seedOverlay` / `seedText` (src/i18n/seed.ts) ou, pour le
// journal des KR, par `localizedDemoOkrTitles`. Détection par l'USAGE du
// recouvrement, jamais par le nom : un seed non traduit redevient visible.
const isSeedFile = (source) => /localizeSeed|seedOverlay|seedText|SEED_I18N|localizedDemoOkrTitles/.test(source);

// Meme logique, pour la syntaxe quick-add (`quick-add-examples.ts`).
const isLockedSyntaxFile = (source) => /QUICK_ADD_FR_ONLY_SYNTAX/.test(source);

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

// Toutes les voyelles accentuées (`â` omis jadis : « tâches » était invisible).
const ACC = '[éèêëàâäçùûüôöîïœÉÈÊËÀÂÄÇÙÛÔÖÎÏŒ]';

// Second signal, pour le français SANS accent (« Ajouter », « Demain ») : une
// liste FERMÉE de mots-outils et verbes d'interface qui n'existent pas en
// anglais ; chaque mot ajouté doit prouver à lui seul une phrase française.
const FR_STOPWORD =
  "\\b(?:le|la|les|un|une|des|du|au|aux|dans|sur|sous|avec|sans|pour|par|vous|votre|vos|son|sa|ses|cette|qui|que|tout|tous|toute|plus|moins|aucun|aucune|ajouter|retirer|supprimer|modifier|annuler|valider|placer|choisir|voir|entreprise|collaborateur|membre|membres|equipe|agenda|jour|semaine|mois|nom|liste|projet|projets|tache|taches" +
  "|aujourd|demain|hier|prochain|prochaine|pas|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche" +
  // Vocabulaire des messages d'erreur (`return`, `throw`).
  "|erreur|utilisateur|veuillez|survenue|connexion|compte|champ|obligatoire|introuvable|saisir|reserve" +
  "|masquer|sauvegarder)\\b";

/** Une chaîne « française » : accent OU mot-outil français. */
const FR = `(?:${ACC}|${FR_STOPWORD})`;
const FR_RE = new RegExp(FR, 'i');

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
 *
 * 🔴 Le delimiteur est un groupe NOMME, unique a chaque appel (`quoteId`), pas
 * `\1`. Le motif (6) embarque DEUX appels de `QUOTED` dans un seul pattern
 * (une branche vraie ET une branche fausse) : avec un `\1` fixe, la seconde
 * chaine se serait refermee sur le delimiteur de la PREMIERE au lieu du sien.
 * Mesure : `'Sauvegarder' : "Créer l'habitude"` rendait "Créer l" — tronque
 * a la premiere apostrophe, parce que `\1` visait encore le guillemet simple
 * de la branche vraie plutot que le guillemet double de la branche fausse.
 */
let quoteId = 0;
const QUOTED = (inner) => {
  const g = `q${quoteId++}`;
  return `(?<${g}>['"\`])((?:(?!\\k<${g}>)[^\\n])*${inner}(?:(?!\\k<${g}>)[^\\n])*)\\k<${g}>`;
};

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
  [new RegExp(`(?:return|new Error\\(|(?<![A-Za-z])(?:error|message|description|reason)\\s*:)\\s*\\{?\\s*${QUOTED(FR)}`, 'gi'), 2],
  // (6) Les DEUX branches d'un ternaire — `cond ? '…' : '…'` — que ce soit
  // dans un attribut JSX ou comme enfant JSX. Ni (1) ni (2) ne s'arrêtent sur
  // `?` ou `:`, et le fragment JSX entier était de toute façon rejeté par
  // `CODE_QUOTING` dès qu'il contenait `: '` (angle mort e, 2026-09-08).
  //
  // 🔴 Une PREMIÈRE version exigeait que les DEUX branches matchent FR EN
  // REGEX, dans un seul match : `fontFamily: 'system-ui, -apple-system,
  // sans-serif'` (« sans » y matchait le mot-outil dans « sans-serif ») ne
  // matchait plus, bien vu — mais `savingProfile ? 'Sauvegarde…' :
  // 'Sauvegarder'` non plus, la branche vraie n'ayant ni accent ni mot-outil :
  // le bouton « Sauvegarder » redevenait invisible.
  //
  // Une SECONDE version essayait un lookbehind a largeur variable pour
  // rendre les deux branches independantes tout en gardant FR en regex —
  // `(?<=\?\s*QUOTED\s*:\s*)QUOTED(FR)`. V8 le compile, mais un backreference
  // NOMME defini a l'INTERIEUR d'un lookbehind ne s'y resout pas de la meme
  // facon qu'en avant : le motif ne matchait plus JAMAIS. Verifie isole,
  // hors de ce fichier, avant de l'abandonner.
  //
  // Le motif ne verifie donc plus que la STRUCTURE (deux chaines quelconques
  // de part et d'autre de `?`/`:`) ; c'est le filtre FR_RE, apres capture,
  // qui decide independamment pour CHAQUE branche si elle est francaise.
  //
  // 🔴 Cette structure seule matche aussi un ternaire qui choisit une VALEUR
  // (route, cle i18n, id d'evenement) plutot qu'un TEXTE affiche. Un essai de
  // lookbehind excluant tout `?` precede d'une comparaison `===`/`!==` a ete
  // ABANDONNE : `variant === 'remove' ? 'Retirer' : 'Ajouter'`
  // (CollaboratorItem) et `m.userId === currentUserId ? ' (vous)' : ''`
  // (MemberPlacementSheet) choisissent aussi un TEXTE via une comparaison
  // d'egalite — l'exclure aurait fait disparaitre deux phrases reelles pour
  // en cacher trois qui n'en etaient pas. C'est l'inverse du principe de ce
  // scanner (« mieux vaut un faux positif qu'une chaine oubliee »). Les VRAIS
  // faux positifs (routes, cles a points, identifiants kebab-case) sont donc
  // filtres par la FORME de la valeur capturee, dans `looksLikeCode`,
  // jamais par la forme de la condition qui a choisi entre les deux.
  [new RegExp(`\\?\\s*${QUOTED('')}\\s*:\\s*${QUOTED('')}`, 'gi'), [2, 4]],
  // (7) Argument d'un appel de fonction QUELCONQUE — `setError('…')`,
  // `confirm2('…')`. Exclut nommément `t(` et `tp(`, les appels de traduction :
  // leur clé peut contenir un mot du vocabulaire fermé (`taches.liste.vide`)
  // sans être une phrase (angle mort g, 2026-09-08). Exclut aussi
  // `console.*(` : un diagnostic destiné à la console du navigateur n'est pas
  // une chaîne d'INTERFACE, personne ne le lit traduit.
  //
  // 🔴 Restreint aux valeurs à PLUSIEURS mots (`requirePhrase`) : sans ça,
  // `useT('agenda')` remonte 'agenda' — un namespace, pas une phrase — parce
  // que « agenda » est aussi un nom commun de la liste. `useT`/`useTranslation`
  // ne sont pas exclus par leur nom : c'est la forme du contenu qui protège,
  // pas la liste des appelants.
  [new RegExp(`(?<![\\w$])(?<!console\\.)(?!t\\(|tp\\()[A-Za-z_$][\\w$]*\\(\\s*${QUOTED(FR)}`, 'g'), 2, true],
  // (8) Éléments d'un tableau de libellés — `['Nom du membre', 'Tâches
  // terminées']`. Le séparateur de fin est en lookahead, comme (6), pour que
  // chaque élément d'un tableau à plus de deux entrées matche (angle mort h,
  // 2026-09-08). Même garde `requirePhrase` que (7), pour la même raison :
  // `['/dashboard', '/agenda', '/entreprise']` et les tableaux de namespaces
  // (`['agenda', 'eventModal', …]`) partagent des mots de la liste fermée.
  [new RegExp(`[\\[,]\\s*${QUOTED(FR)}(?=\\s*[,\\]])`, 'gi'), 2, true],
  // (9) Valeur d'une propriete d'objet, QUEL QUE SOIT le nom de la propriete.
  //
  // Les motifs (4), (5) et (7) ne voient pas `setErrors({ general: '…' })` :
  // nom de propriété hors liste, chaîne pas en premier jeton.
  //
  // Elargir le NOM de la propriete impose de restreindre la VALEUR, sinon
  // toute la configuration technique du depot entre dans le rapport. D'ou le
  // quatrieme element, `requireSentence` : la valeur doit commencer par une
  // MAJUSCULE ou porter un accent. C'est ce qui separe
  // `banner: 'Votre abonnement arrive a echeance'` de
  // `fontFamily: 'system-ui, -apple-system, sans-serif'`, dont « sans » matche
  // le mot-outil de la liste fermee sans etre une phrase.
  //
  // La restriction est ASSUMEE et elle a un cout : une phrase francaise qui
  // commencerait par une minuscule et ne porterait aucun accent reste
  // invisible a CE motif. Elle reste visible aux huit autres des qu'elle est
  // rendue en JSX, passee a un toast ou retournee par du code : ce motif-ci ne
  // couvre que le cas du conteneur objet.
  [new RegExp(`(?<![A-Za-z0-9_$'"\`.])[A-Za-z_$][A-Za-z0-9_$]*[ \t]*:[ \t]*${QUOTED(FR)}`, 'g'), 2, true, true],
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
  // Un chemin de route (`/entreprise`, `/agenda?tab=x`) matche FR des qu'il
  // contient un mot de la liste fermee, mais ce n'est jamais une phrase. Vu
  // dans une branche de ternaire (angle mort e) : requirePhrase ne s'applique
  // qu'aux motifs (7)/(8), et une route peut etre un seul mot.
  v.startsWith('/') ||
  // Un identifiant kebab-case (`open-agenda-create`) ou un simple mot MINUSCULE
  // isole (`entreprise`, `perso`) matchent FR des qu'ils contiennent un mot de
  // la liste fermee, mais ce sont des VALEURS d'etat ou des id d'evenement, pas
  // des phrases affichees. Une vraie phrase francaise d'un seul mot commence
  // par une MAJUSCULE (« Sauvegarder », « Entreprise » en tant que libelle).
  /^[a-z][a-z0-9-]*$/.test(v) ||
  // Une CLE i18n a points (`enterprise.switcher.entreprise`) — jamais une
  // phrase, meme quand un de ses segments est un mot de la liste fermee.
  (v.includes('.') && /^[\w.]+$/.test(v)) ||
  // Un format date-fns (`"d MMMM yyyy 'à' HH:mm"`) contient un texte litteral
  // ENTRE GUILLEMETS SIMPLES — la convention d'echappement de date-fns — donc
  // « à » y matche l'accent. `format()` est deja localise par `getDateLocale()` ;
  // ce n'est pas une phrase a traduire a la main. Detecte par les jetons de
  // format qui n'apparaissent jamais dans une phrase affichee.
  /\b(?:yyyy|MMMM?|HH:mm|EEEE?)\b/.test(v) ||
  // Un message de diagnostic pour la console (`console.error('[auth] …')`)
  // n'est pas une chaine d'INTERFACE : personne ne le lit traduit. Le motif
  // (8), pense pour les tableaux, matche aussi n'importe quelle liste
  // d'arguments separee par des virgules — donc les arguments suivants d'un
  // `console.error(msg1, msg2, msg3)` — sans savoir que la fonction appelee
  // est `console.*`. La convention du depot marque ces messages d'un tag
  // entre crochets (`[auth]`, `[realtime]`) : plus fiable ici que de
  // remonter jusqu'au nom de la fonction.
  /^\[[a-z][a-z-]*\]/.test(v) ||
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

// ── Les diagnostics `console.*` ne sont pas de l'interface non plus ────
//
// Un `console.error('[auth] …', arg2, 'suite du message …')` n'est lu par
// PERSONNE d'autre qu'un developpeur dans les outils du navigateur — le
// traduire n'a pas de sens. Le motif (8), pense pour les tableaux, matche
// aussi n'importe quelle liste d'arguments separee par des virgules : sans
// ce retrait, le DEUXIEME argument d'un `console.error` (qui ne porte pas
// le tag `[auth]` du premier) restait visible. On retire l'appel ENTIER
// (parentheses comprises, en comptant leur profondeur a la main — pas de
// regex a parenthese non bornee), comme les commentaires ci-dessus.
const stripConsoleCalls = (source) => {
  const re = /console\.(?:log|warn|error|info|debug)\(/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    out += source.slice(last, m.index);
    let i = re.lastIndex;
    let depth = 1;
    while (i < source.length && depth > 0) {
      const c = source[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === '"' || c === "'" || c === '`') {
        const q = c;
        i++;
        while (i < source.length && source[i] !== q) {
          if (source[i] === '\\') i++;
          i++;
        }
      }
      i++;
    }
    last = i;
    re.lastIndex = i;
  }
  return out + source.slice(last);
};

const rows = [];
for (const f of walk('src')) {
  const raw = readFileSync(f, 'utf8');
  if (isSeedFile(raw) || isLockedSyntaxFile(raw)) continue;
  const s = stripConsoleCalls(stripComments(raw));
  const hits = new Set();
  for (const [re, groupOrGroups, requirePhrase, requireSentence] of PATTERNS) {
    re.lastIndex = 0;
    let m;
    // (6) porte DEUX groupes (les deux branches du ternaire) sur un seul
    // match : les autres motifs n'en portent qu'un, normalise en tableau ici.
    const groups = Array.isArray(groupOrGroups) ? groupOrGroups : [groupOrGroups];
    while ((m = re.exec(s))) {
      for (const group of groups) {
        // Une phrase JSX peut arriver sur plusieurs lignes : on la normalise
        // avant de la compter, sinon la meme phrase compterait deux fois selon
        // l'endroit ou le formatage l'a coupee.
        const v = m[group].replace(/\s+/g, ' ').trim();
        if (!v || v.length < 3) continue;
        if (/^[\d\s%·—–\-+.,:/()€]+$/.test(v)) continue;
        // Une interpolation est conservee DANS une phrase (« {x} min » en est
        // une), mais un fragment qui n'est que du code n'en est pas une.
        if (/^\{[^}]*\}$/.test(v)) continue;
        // (7) et (8) matchent hors de tout contexte d'interface — n'importe
        // quel appel de fonction, n'importe quel tableau — donc un simple nom
        // commun de la liste fermee (route, namespace i18n : `agenda`,
        // `entreprise`) y ressemble a une phrase. Une phrase a plusieurs mots ;
        // un identifiant seul n'en a qu'un.
        if (requirePhrase && !/\s/.test(v)) continue;
        // (9) matche n'importe quel nom de propriete : sans cette borne, toute
        // la configuration technique du depot (piles de polices, listes de
        // classes, enumerations kebab-case) entrerait dans le rapport. Une
        // phrase affichee commence par une majuscule ou porte un accent.
        if (requireSentence && !/^[A-ZÀ-Þ]/.test(v) && !new RegExp(ACC).test(v)) continue;
        // Motif (6) : la structure du ternaire est verifiee en regex, mais
        // pas le contenu — chaque branche doit prouver ELLE-MEME qu'elle est
        // francaise (accent ou mot-outil), independamment de l'autre.
        if (!FR_RE.test(v)) continue;
        if (looksLikeCode(v)) continue;
        hits.add(v);
      }
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
