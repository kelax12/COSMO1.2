// ═══════════════════════════════════════════════════════════════════
// CLIQUET — toute classe sombre d'une vitrine a sa ligne dans le thème clair
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE QU'IL GARDE. Depuis le 2026-09-22, les vitrines de la landing perso
// sont montées sous `<ShowcaseTheme theme="light">`. Leur JSX reste écrit en
// classes SOMBRES (c'est ce qui laisse `/guide` intact), et c'est
// `showcase-light.css` qui les re-teinte une par une. Une classe sombre ajoutée
// à une vitrine SANS sa règle claire ne casse rien, ne lève rien, n'avertit
// personne : elle reste simplement noire sur la page blanche. Ce fichier est
// le seul endroit où ça se voit avant la production.
//
// ⚠️ CE QU'IL NE PROUVE PAS. `text-white` n'est PAS contrôlé : du blanc sur un
// aplat coloré doit rester blanc, et seul un humain sait si un `text-white`
// est de l'encre (à doubler de `sc-ink`) ou un texte sur couleur. Il ne prouve
// pas non plus qu'une valeur passée en `style` passe par la palette : ça, ce
// sont les captures qui le montrent.
//
// ── LES SABOTAGES QUE CE FICHIER DOIT REFUSER ──────────────────────
// Joués à la main avant commit, chacun vu ROUGE :
//   1. retirer la règle `.text-slate-400` de la feuille → « sans règle claire »
//      liste `text-slate-400` ;
//   2. ajouter `bg-slate-950` à une vitrine → même échec, nouvelle classe ;
//   3. vider le motif de détection → le témoin « le détecteur voit quelque
//      chose » tombe, au lieu d'un vert creux.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DOSSIER = join(process.cwd(), 'src/components/showcase');

// `AppWindowShowcase` n'est plus monté par aucune page depuis la refonte du
// hero perso (2026-09-22) et n'est donc jamais enveloppé d'un thème : il reste
// hors du périmètre, et le jour où il revient sur une page blanche, il faudra
// l'y faire entrer.
const HORS_THEME = new Set(['AppWindowShowcase.tsx']);

// Les classes qui portent une teinte SOMBRE : neutres foncés, blancs
// translucides (filets), et accents pâles pensés pour un fond noir.
const MOTIF_SOMBRE =
  /(?<![\w-])(?:bg|border|divide)-(?:slate-(?:[6-9]00|950)|white\/[\w.[\]]+|black\/\d+)(?:\/[\w.[\]]+)?|(?<![\w-])text-slate-[3-6]00|(?<![\w-])(?:text|fill)-(?:red|orange|yellow|green|blue|purple)-[34]00(?:\/\d+)?|(?<![\w-])(?:bg|border)-(?:yellow|blue)-(?:800|900)(?:\/\d+)?/g;

// Classes qui passent telles quelles sur blanc — chacune a son motif.
const TENUES_SUR_BLANC = new Set([
  'text-slate-500', // 4,76:1 sur blanc
]);

const vitrines = readdirSync(DOSSIER).filter(
  (f) => f.endsWith('.tsx') && !f.includes('.test.') && !HORS_THEME.has(f),
);

const classesSombres = (): Map<string, string[]> => {
  const vues = new Map<string, string[]>();
  for (const f of vitrines) {
    const src = readFileSync(join(DOSSIER, f), 'utf8');
    for (const [classe] of src.matchAll(MOTIF_SOMBRE)) {
      if (TENUES_SUR_BLANC.has(classe)) continue;
      vues.set(classe, [...(vues.get(classe) ?? []), f]);
    }
  }
  return vues;
};

// Un sélecteur CSS échappe `/`, `[`, `]` et `.` : on compare la forme échappée.
const echapper = (classe: string) => classe.replace(/([/[\].])/g, '\\$1');

// 🔴 La classe doit FINIR là où finit le sélecteur. Une comparaison par
// `includes()` trouvait `.bg-slate-950` dans `.bg-slate-950\/40` : le sabotage 2
// est resté VERT tant que ce cliquet comparait par préfixe.
const aSaRegle = (feuille: string, classe: string) => {
  const selecteur = `[data-sc-theme='light'] .${echapper(classe)}`;
  for (let i = feuille.indexOf(selecteur); i !== -1; i = feuille.indexOf(selecteur, i + 1)) {
    if (/[\s,{.:>]/.test(feuille[i + selecteur.length] ?? '')) return true;
  }
  return false;
};

describe('thème clair des vitrines', () => {
  const feuille = readFileSync(join(DOSSIER, 'showcase-light.css'), 'utf8');

  it('le détecteur voit quelque chose (sinon ce cliquet serait vert pour rien)', () => {
    expect(vitrines.length).toBeGreaterThanOrEqual(5);
    expect(classesSombres().size).toBeGreaterThan(10);
  });

  it('chaque classe sombre des vitrines a sa règle sous [data-sc-theme="light"]', () => {
    const sansRegle = [...classesSombres().entries()]
      .filter(([classe]) => !aSaRegle(feuille, classe))
      .map(([classe, fichiers]) => `${classe}  (${[...new Set(fichiers)].join(', ')})`);
    expect(sansRegle, 'classe(s) sombre(s) sans règle claire dans showcase-light.css').toEqual([]);
  });

  it("l'accent plein est figé : il ne suit pas le thème du visiteur", () => {
    // En thème `noir`, --color-accent-solid vaut #F0F0F0 : une pastille
    // blanche sur une vitrine blanche.
    expect(feuille).toMatch(/\[data-sc-theme='light'\]\s*\{[^}]*--color-accent-solid:\s*37 99 235/);
  });
});
