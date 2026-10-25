// ═══════════════════════════════════════════════════════════════════
// Copie du hero de la landing dans le prérendu : la CSS qui va avec
// ═══════════════════════════════════════════════════════════════════
//
// 2026-10-16 · Le prérendu de `/` peignait un mur de texte SEO (C-116)
// pendant le chargement, puis la landing le remplaçait : deux pages
// différentes, l'une après l'autre. Il peint désormais une COPIE du haut de
// la landing (`scripts/landing-hero/<locale>.html`, capturée par
// `capture-landing-hero.mjs`), avec les MÊMES classes Tailwind que le JSX.
//
// Ce module sort de la CSS buildée les seules règles dont la copie a besoin,
// confinées sous `#lp-hero` :
//   · une règle n'est gardée que si TOUTES les classes de son sélecteur sont
//     présentes dans la copie (`.group:hover .x` exige `group` ET `x`) ;
//   · `html`, `body`, `:root` deviennent `#lp-hero` (police, variables) ;
//   · tout le reste est préfixé par `#lp-hero ` : la copie ne déteint sur
//     rien, et chaque règle gagne le même poids, donc l'ordre de la cascade
//     entre elles est celui de la feuille d'origine ;
//   · `@keyframes` est jeté : la copie ne s'anime pas, elle doit être
//     identique à l'état FINAL du hero ;
//   · `@font-face` passe, mais en `font-display: block` (2026-10-21). En
//     `swap`, la copie se peignait d'abord en police système, plus étroite :
//     moins de lignes, donc un bloc PLUS PETIT que celui de React, qui
//     reprenait alors le LCP à la relève (mesuré à 412 px, CPU ×4 : LCP de
//     4,6 à 5,9 s au lieu de 1,2 à 1,4 s). Inter est préchargée par
//     index.html : l'attente est courte, et la police ne saute plus à l'écran.
//
// ❌ Ne jamais recopier ces valeurs à la main dans index.html : c'est
// précisément ce qui ferait diverger la copie de la landing au premier
// changement de classe.
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

/** Les classes portées par un fragment HTML (attribut `class` seulement). */
export function classesIn(html) {
  const out = new Set();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) out.add(c.replace(/&amp;/g, '&'));
  }
  return out;
}

/** Les balises présentes dans un fragment HTML. */
export function tagsIn(html) {
  const out = new Set();
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)) out.add(m[1].toLowerCase());
  return out;
}

const RACINES = new Set(['html', 'body', ':root']);

// La copie est INERTE (`inert`, aucun pointeur, aucun focus) : un état
// interactif n'y arrive jamais. Ces règles ne feraient que peser.
const ETATS_INTERACTIFS = new Set([':hover', ':focus', ':focus-visible', ':focus-within', ':active']);

// 2026-10-23 · Classes de THÈME, posées sur `<html>` par `applyTheme()` et, avant
// React, par le script inline d'index.html. Une page de contenu à thème (le
// guide) en dépend ; la copie ne les porte pas, elles vivent au-dessus d'elle.
const THEMES = new Set(['dark', 'gris', 'noir']);

/**
 * Extrait d'un sélecteur le composé qui porte une classe de thème (`.dark`,
 * `.dark:not(.gris):not(.noir)`), avec le combinateur qui le suit, et le rend
 * en texte. Rend `null` s'il n'y en a pas.
 */
function extraireTheme(sel) {
  let theme = null;
  sel.walk((node) => {
    if (theme !== null || node.type !== 'class' || !THEMES.has(node.value)) return;
    const parent = node.parent;
    const nodes = parent.nodes;
    const i = nodes.indexOf(node);
    let debut = i;
    while (debut > 0 && nodes[debut - 1].type !== 'combinator') debut--;
    let fin = i;
    while (fin < nodes.length - 1 && nodes[fin + 1].type !== 'combinator') fin++;
    const compose = nodes.slice(debut, fin + 1);
    theme = compose.map(String).join('').trim();
    const suivant = nodes[fin + 1];
    compose.forEach((n) => n.remove());
    if (suivant?.type === 'combinator') suivant.remove();
  });
  return theme;
}

/**
 * Réécrit un sélecteur sous `scope`, ou rend `null` s'il vise une classe que
 * la copie ne porte pas (ou un id, qui ne peut rien viser dans la copie).
 * `themeSurHtml` : une classe de thème n'est pas cherchée dans la copie, elle
 * est remontée sur `html` (`.dark .x` → `html.dark #scope .x`).
 */
function scoper(selector, classes, scope, tags, themeSurHtml = false) {
  let garde = true;
  const ast = selectorParser().astSync(selector);
  const themes = [];
  if (themeSurHtml) {
    ast.each((sel) => {
      const t = extraireTheme(sel);
      themes.push(t);
    });
  }
  ast.walk((node) => {
    if (node.type === 'class' && !classes.has(node.value)) garde = false;
    if (node.type === 'id') garde = false;
    if (node.type === 'tag' && tags && !RACINES.has(node.value) && !tags.has(node.value.toLowerCase())) garde = false;
    if (node.type === 'pseudo' && ETATS_INTERACTIFS.has(node.value)) garde = false;
  });
  if (!garde) return null;
  const parts = [];
  ast.each((sel, i) => {
    const theme = themes[i] ?? null;
    const portee = theme ? `html${theme} ${scope}` : scope;
    const first = sel.first;
    const estRacine = first && ((first.type === 'tag' && RACINES.has(first.value)) || (first.type === 'pseudo' && first.value === ':root'));
    if (String(sel).trim() === '') {
      // `.dark { --color-… }` : le bloc de variables du thème, sur la portée.
      parts.push(portee);
    } else if (estRacine) {
      // `html body .x` n'existe pas dans la feuille ; `html` ou `body` seul,
      // éventuellement suivi de pseudo-éléments, devient la portée elle-même.
      first.replaceWith(selectorParser.string({ value: portee }));
      parts.push(String(sel).trim());
    } else {
      parts.push(`${portee} ${String(sel).trim()}`);
    }
  });
  return parts.join(', ');
}

/**
 * La CSS de `cssText` utile à `html`, confinée sous `scope`.
 * `themeSurHtml` : voir `scoper` (copie d'une page de contenu à thème).
 */
export function scopedCssFor(html, cssText, scope = '#lp-hero', { themeSurHtml = false } = {}) {
  const classes = classesIn(html);
  const tags = tagsIn(html);
  const root = postcss.parse(cssText);
  root.walkAtRules('keyframes', (at) => at.remove());
  root.walkAtRules('font-face', (at) => {
    at.walkDecls('font-display', (decl) => {
      decl.value = 'block';
    });
  });
  root.walkRules((rule) => {
    // Les règles internes d'un @keyframes sont déjà parties ; un @font-face
    // n'a pas de règle enfant. Tout le reste passe par le filtre.
    const gardes = rule.selectors.map((s) => scoper(s, classes, scope, tags, themeSurHtml)).filter(Boolean);
    if (gardes.length === 0) rule.remove();
    else rule.selector = gardes.join(', ');
  });
  // Un @media ou un @supports vidé par le filtre ne sert plus à rien.
  let vide = true;
  while (vide) {
    vide = false;
    root.walkAtRules((at) => {
      if (at.name !== 'font-face' && at.nodes && at.nodes.length === 0) {
        at.remove();
        vide = true;
      }
    });
  }
  root.walkComments((c) => c.remove());
  return root.toString().replace(/\n\s*\n/g, '\n').trim();
}
