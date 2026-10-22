// ═══════════════════════════════════════════════════════════════════
// exhaustive-deps-justified.guard.test.mjs — le TÉMOIN de la règle C-06
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `CLAUDE.md` § « une garde se vérifie sur ce qu'elle REGARDE » : en cinq
// jours, QUATRE gardes de ce dépôt ont été prises en train de répondre sans
// mesurer. Une règle ESLint qui cesserait de détecter serait exactement ce
// cas-là — `npm run lint` resterait vert, et les désarmements
// `react-hooks/exhaustive-deps` repartiraient sans justification, en silence.
//
// Chaque cas ci-dessous SOUMET une source à la règle réelle, via un vrai
// `ESLint` programmatique : la logique n'est jamais réimplémentée ici. Une
// garde qui réécrit ce qu'elle teste ne teste que sa copie.
//
// ⚠️ Les trois premiers sont les témoins NÉGATIFS (ce que la règle doit
// refuser). Sans eux, une règle qui rendrait toujours « rien à signaler »
// passerait ce fichier.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import rule from './exhaustive-deps-justified.js';

const linter = new Linter();

/**
 * Rend les messageId leves par NOTRE regle sur ce code.
 *
 * Le filtre sur `ruleId` n'est pas cosmetique : `react-hooks` n'est pas
 * enregistre dans ce `Linter`, donc ESLint emet en plus un « Definition for
 * rule ... was not found ». Le garder ferait echouer chaque cas pour une
 * raison qui n'a rien a voir avec ce qu'on mesure.
 */
function lint(code, options = []) {
  return linter
    .verify(code, {
      plugins: { cosmo: { rules: { 'exhaustive-deps-justified': rule } } },
      rules: { 'cosmo/exhaustive-deps-justified': ['error', ...options] },
    })
    .filter((m) => m.ruleId === 'cosmo/exhaustive-deps-justified')
    .map((m) => m.messageId);
}

/** Un vrai saut de ligne, pour composer des sources multi-lignes. */
const NL = String.fromCharCode(10);

const EFFECT = 'useEffect(() => { read(a); }, []);';

describe('C-06 — un desarmement sans justification est refuse', () => {
  it('refuse un desarmement nu', () => {
    expect(
      lint(`// eslint-disable-next-line react-hooks/exhaustive-deps\n${EFFECT}`),
    ).toEqual(['missing']);
  });

  it('refuse la forme BLOC nue, pas seulement la forme ligne', () => {
    expect(
      lint(`/* eslint-disable-next-line react-hooks/exhaustive-deps */\n${EFFECT}`),
    ).toEqual(['missing']);
  });

  it('refuse un desarmement de FICHIER nu', () => {
    expect(
      lint(`/* eslint-disable react-hooks/exhaustive-deps */\n${EFFECT}`),
    ).toEqual(['missing']);
  });

  // 🔴 Le cœur de la règle : « ok », « voulu », « cf. plus haut » sont des
  // réponses, pas des raisons. Sans ce cas, la règle serait satisfaite par
  // deux caractères et n'exigerait rien de plus qu'un rituel.
  it('refuse une justification trop courte pour etre une raison', () => {
    expect(
      lint(
        `// eslint-disable-next-line react-hooks/exhaustive-deps -- voulu\n${EFFECT}`,
      ),
    ).toEqual(['tooShort']);
  });

  it('accepte une justification qui dit pourquoi la dependance ne peut pas perimer', () => {
    expect(
      lint(
        '// eslint-disable-next-line react-hooks/exhaustive-deps -- `a` est lu a'
          + " l OUVERTURE seulement, le remettre reecrirait le formulaire\n"
          + EFFECT,
      ),
    ).toEqual([]);
  });

  it('accepte une justification etalee sur plusieurs lignes en commentaire BLOC', () => {
    expect(
      lint(
        '/* eslint-disable-next-line react-hooks/exhaustive-deps --\n'
          + '   `a` est une MotionValue, stable pour la vie du composant :\n'
          + '   l ajouter ne changerait rien au comportement. */\n'
          + EFFECT,
      ),
    ).toEqual([]);
  });
});

describe('C-06 — la regle ne deborde pas sur le reste', () => {
  // Sans ce cas, une règle qui signalerait TOUT commentaire passerait les
  // témoins négatifs ci-dessus pour de mauvaises raisons.
  it('ignore un commentaire ordinaire', () => {
    expect(lint(`// on ne touche pas a ce bloc\n${EFFECT}`)).toEqual([]);
  });

  it('ignore le desarmement d une AUTRE regle, meme nu', () => {
    expect(
      lint(`// eslint-disable-next-line no-console\nconsole.log(1);`),
    ).toEqual([]);
  });

  // 🔴 Le nom de la règle doit être lu AVANT le `--`, jamais dans la prose de
  // la justification : sinon un désarmement d'une autre règle dont la raison
  // CITE `react-hooks/exhaustive-deps` serait signalé à tort, et surtout un
  // désarmement nu pourrait se cacher derrière la mention du nom.
  it('ne confond pas le nom de la regle cite DANS une justification', () => {
    expect(
      lint(
        '// eslint-disable-next-line no-console -- diagnostic garde le temps de'
          + ' comprendre le desarmement react-hooks/exhaustive-deps voisin\n'
          + 'console.log(1);',
      ),
    ).toEqual([]);
  });

  // 🔴 CE QUE CE CAS NE PROUVE PAS, et il faut le dire. En sabotant la regle
  // pour qu'elle cherche son nom dans TOUT le commentaire (au lieu de la seule
  // partie avant `--`), les dix cas restaient VERTS. Ce n'est pas un trou du
  // temoin : au seuil par defaut les deux implementations sont indiscernables,
  // parce que le nom de la regle fait 27 caracteres et que le seuil en demande
  // 25 — une raison qui CONTIENT ce nom est donc toujours assez longue. Le
  // dernier cas du fichier, lui, distingue les deux : il monte le seuil.
  it('ne signale pas une AUTRE regle dont la raison cite la notre', () => {
    expect(
      lint(
        '// eslint-disable-next-line no-console -- cf. react-hooks/exhaustive-deps' + '\n'
          + 'console.log(1);',
      ),
    ).toEqual([]);
  });

  it('honore le seuil configure', () => {
    const code =
      '// eslint-disable-next-line react-hooks/exhaustive-deps -- raison courte'
      + NL + EFFECT;
    expect(lint(code, [{ minLength: 5 }])).toEqual([]);
    expect(lint(code, [{ minLength: 200 }])).toEqual(['tooShort']);
  });

  // 🔴 LE SEUL cas qui distingue « chercher le nom AVANT le `--` » de « le
  // chercher partout ». Ici le nom de notre regle n'apparait QUE dans la raison
  // d'un desarmement de `no-console`, et le seuil est monte assez haut pour que
  // cette raison paraisse trop courte. Une regle qui lit le commentaire entier
  // signale alors un desarmement qui ne la concerne pas. Vu ROUGE sur ce
  // sabotage precis avant d'etre committe.
  it('ne lit pas le nom de la regle APRES le `--` (temoin du decoupage)', () => {
    expect(
      lint(
        '// eslint-disable-next-line no-console -- react-hooks/exhaustive-deps'
          + NL + 'console.log(1);',
        [{ minLength: 200 }],
      ),
    ).toEqual([]);
  });
});
