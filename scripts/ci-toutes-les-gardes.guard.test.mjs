// ═══════════════════════════════════════════════════════════════════
// ci-toutes-les-gardes.guard.test.mjs · LE TÉMOIN DU JOB QUI JOUE TOUT
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// Le 2026-10-12, `check:docs` (étape 2 sur 23 de `lint-test-build`) est
// passé au rouge, et le job s'est arrêté là pendant trois jours : 21 étapes
// jamais jouées, dont dix rouges (effacement, portabilité, sept gardes
// unitaires, budget de bundle). Un job qui s'arrête au premier rouge ne
// mesure que le premier rouge.
//
// Ce témoin lit `ci.yml` et refuse :
//   · une étape de garde de `lint-test-build` sans
//     `if: ${{ !cancelled() && steps.deps.outcome == 'success' }}` ou sans `id` ;
//   · un `continue-on-error`, qui ferait perdre un rouge ;
//   · un `npm ci` qui ne serait plus bloquant ;
//   · une lectrice de `dist/` ou de `coverage/` qui pourrait passer à vide ;
//   · l'absence de l'étape finale qui liste toutes les étapes rouges.
// Et il vérifie que ce résumé, joué sur un faux contexte `steps`, liste
// TOUS les rouges et sort en 1.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONDITION,
  lireEtapes,
  verifierJob,
  resumer,
  run,
} from './ci-toutes-les-gardes.mjs';

const CI = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

/** Un job conforme, minimal : la base de chaque sabotage ci-dessous. */
const CONFORME = `name: CI
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@abc # v1
      - run: npm ci
        id: deps

      # commentaire entre deux étapes
      - name: Lint
        id: lint
        if: ${CONDITION}
        run: npm run lint

      - name: Docs
        id: docs
        if: ${CONDITION}
        run: npm run check:docs

      - name: Upload
        id: up
        if: ${CONDITION}
        uses: actions/upload-artifact@abc # v7
        with:
          name: coverage
          path: coverage/
          if-no-files-found: error

      - name: Build
        id: build
        if: ${CONDITION}
        run: npm run build
        env:
          # commentaire dans une carte
          A: \${{ secrets.A }}

      - name: Bundle
        id: bundle
        if: ${CONDITION}
        env:
          ENTREE_BUILD: \${{ steps.build.outcome }}
        run: |
          if [ "$ENTREE_BUILD" != success ]; then
            echo "::error::entree absente"
            exit 1
          fi
          npm run check:bundle

      - name: Resume
        if: \${{ !cancelled() }}
        env:
          STEPS_JSON: \${{ toJSON(steps) }}
        run: node scripts/ci-toutes-les-gardes.mjs --job j

  autre:
    runs-on: ubuntu-latest
`;

const fautes = (yaml) => verifierJob(lireEtapes(yaml, 'j'));
const saboter = (chercher, remplacer) => {
  expect(CONFORME.split(chercher).length, `motif ambigu : ${chercher}`).toBe(2);
  return CONFORME.replace(chercher, remplacer);
};

describe('lireEtapes : le parseur étroit', () => {
  it('lit les étapes, leurs cartes et leurs blocs, sans déborder sur le job suivant', () => {
    const e = lireEtapes(CONFORME, 'j');
    expect(e.map((x) => x.id ?? x.uses ?? x.name)).toEqual([
      'actions/checkout@abc', 'deps', 'lint', 'docs', 'up', 'build', 'bundle', 'Resume',
    ]);
    expect(e[4].with['if-no-files-found']).toBe('error');
    expect(e[5].env).toEqual({ A: '${{ secrets.A }}' });
    expect(e[6].run.split('\n')).toHaveLength(5);
    expect(e[6].run.endsWith('npm run check:bundle')).toBe(true);
  });

  it('refuse ce qu’il ne reconnaît pas au lieu de l’ignorer', () => {
    expect(() => lireEtapes(CONFORME, 'absent')).toThrow(/introuvable/);
    expect(() => lireEtapes(CONFORME.replace('        id: lint', '         id: lint'), 'j'))
      .toThrow(/indentation/);
  });

  // CodeQL n° 14 (`js/regex-injection`, 2026-10-15) : le nom du job venait de
  // `--job` et entrait tel quel dans une `RegExp`. `.` y valait « n'importe
  // quel job » : le script lisait alors les étapes de `j` en croyant lire
  // celles de `.`, et le résumé jugeait le mauvais job sans rien dire.
  it.each([['.'], ['.*'], ['j|autre'], ['(j)'], ['j:'], [''], ['2j']])(
    'refuse `--job %s`, qui n’est pas un identifiant de job GitHub',
    (job) => {
      expect(() => lireEtapes(CONFORME, job)).toThrow(/identifiant de job invalide/);
    },
  );

  it('lit un identifiant GitHub valide, majuscules et `_` compris', () => {
    const yaml = CONFORME.replace('\n  j:\n', '\n  Job_2-b:\n');
    expect(lireEtapes(yaml, 'Job_2-b').map((x) => x.id).filter(Boolean)).toContain('bundle');
  });
});

describe('verifierJob : chaque sabotage est refusé (témoins)', () => {
  it('le job conforme passe', () => {
    expect(fautes(CONFORME)).toEqual([]);
  });

  it.each([
    ['une étape sans condition', `        id: docs\n        if: ${CONDITION}\n`, '        id: docs\n', /Docs.*if:.*absent/],
    ['une condition `always()`, qui ignore un npm ci rouge', `        id: docs\n        if: ${CONDITION}\n`, '        id: docs\n        if: ${{ always() }}\n', /Docs.*exactement/],
    ['un `!cancelled()` seul', `        id: lint\n        if: ${CONDITION}\n`, '        id: lint\n        if: ${{ !cancelled() }}\n', /Lint.*exactement/],
    ['une étape sans id', '        id: docs\n', '', /Docs.*sans `id`/],
    ['un continue-on-error', '        run: npm run lint\n', '        run: npm run lint\n        continue-on-error: true\n', /continue-on-error/],
    ['un npm ci conditionnel', '        id: deps\n', `        id: deps\n        if: \${{ always() }}\n`, /npm ci.*bloquant/],
    ['un npm ci sans id', '        id: deps\n', '', /id: deps/],
    ['un envoi qui passe à vide', '          if-no-files-found: error\n', '', /if-no-files-found/],
    ['un budget qui lit dist/ sans vérifier le Build', '          if [ "$ENTREE_BUILD" != success ]; then\n', '          if true; then\n', /sans vérifier/],
    ['un résumé qui ne lance plus le script', 'run: node scripts/ci-toutes-les-gardes.mjs --job j', 'run: echo fini', /dernière étape.*doit lancer/],
    ['un résumé sans le contexte steps', '          STEPS_JSON: ${{ toJSON(steps) }}\n', '          AUTRE: x\n', /STEPS_JSON/],
    ['un résumé qui ne joue pas après un rouge', '      - name: Resume\n        if: ${{ !cancelled() }}\n', '      - name: Resume\n        if: ${{ success() }}\n', /dernière étape.*if:/],
    ['une garde avant npm ci', '      - run: npm ci\n', '      - run: npm run lint\n      - run: npm ci\n', /AVANT `npm ci`/],
  ])('%s', (_titre, chercher, remplacer, attendu) => {
    const f = fautes(saboter(chercher, remplacer));
    expect(f.join('\n')).toMatch(attendu);
  });
});

describe('ci.yml réel', () => {
  const etapes = lireEtapes(CI, 'lint-test-build');

  it('lint-test-build : chaque garde joue après un rouge, et le job finit par le résumé', () => {
    expect(verifierJob(etapes)).toEqual([]);
    // 23 étapes le 2026-10-12 : une liste courte ne prouverait rien.
    expect(etapes.filter((e) => e.if === CONDITION).length).toBeGreaterThanOrEqual(23);
  });

  it('audit : la lecture de la chaîne de build joue après un audit prod rouge', () => {
    expect(verifierJob(lireEtapes(CI, 'audit'), { resume: false, entrees: [] })).toEqual([]);
  });

  it('lighthouse : après le Build, plus aucune étape ne dépend des précédentes', () => {
    const e = lireEtapes(CI, 'lighthouse');
    const iBuild = e.findIndex((x) => x.id === 'build');
    expect(iBuild).toBeGreaterThan(0);
    const apres = e.slice(iBuild + 1);
    expect(apres.length).toBeGreaterThanOrEqual(10);
    for (const x of apres) expect(x.if, x.name).toMatch(/!cancelled\(\)/);
    for (const x of apres.filter((y) => /check:seo|--pages|lhci\/cli@[^ ]+ collect/.test(y.run ?? ''))) {
      expect(x.if, x.name).toContain("steps.build.outcome == 'success'");
    }
    for (const x of apres.filter((y) => /lhci\/cli@[^ ]+ assert/.test(y.run ?? ''))) {
      expect(x.if, x.name).toMatch(/steps\.lhci-(desktop|mobile)\.outcome == 'success'/);
    }
  });

  // 🔴 2026-10-16 : sur les 141 runs `CI` de `main` créés depuis le 10-09,
  // 108 avaient été annulés par le push suivant, `e2e` (23 min) le premier.
  // Quatre sessions ont dû ouvrir une PR brouillon jetable (n° 71, 72, 74, 76)
  // pour obtenir un verdict. Sur `main`, un groupe PAR COMMIT : aucun run n'en
  // annule un autre. Sur une PR, le push suivant remplace toujours le précédent.
  it('concurrency : TÉMOIN, un run de main n’est jamais annulé, une PR l’est encore', () => {
    const bloc = CI.replace(/\r\n/g, '\n').match(/\nconcurrency:\n {2}group: (.*)\n {2}cancel-in-progress: (.*)\n/);
    expect(bloc, 'bloc `concurrency:` de premier niveau introuvable').not.toBeNull();
    const [, groupe, annule] = bloc;
    expect(groupe).toBe("ci-${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.sha }}");
    expect(annule).toBe("${{ github.event_name == 'pull_request' }}");
    expect(CI.match(/^\s*concurrency:/gm)).toHaveLength(1);
  });

  it('rls-integration : le diagnostic ne masque jamais les tests', () => {
    const e = lireEtapes(CI, 'rls-integration');
    const tests = e.find((x) => x.run?.includes('npm run test:rls'));
    expect(tests.if).toBe("${{ !cancelled() && steps.migrate.outcome == 'success' }}");
    expect(e.find((x) => x.id === 'migrate')).toBeDefined();
  });
});

describe('resumer : aucun rouge ne se perd', () => {
  const etapes = lireEtapes(CONFORME, 'j');
  const ctx = (issues) => Object.fromEntries(
    ['deps', 'lint', 'docs', 'up', 'build', 'bundle'].map((id) => [id, { outcome: issues[id] ?? 'success' }]),
  );

  it('tout vert : code 0', () => {
    const r = resumer(etapes, ctx({}), 'j');
    expect(r.code).toBe(0);
    expect(r.vertes).toBe(6);
  });

  it('deux gardes rouges : les DEUX listées, code 1', () => {
    const r = resumer(etapes, ctx({ lint: 'failure', bundle: 'failure' }), 'j');
    expect(r.code).toBe(1);
    expect(r.rouges.map((x) => x.nom)).toEqual(['Lint', 'Bundle']);
    expect(r.markdown).toContain('2 étape(s) rouge(s) sur 6');
  });

  it('une garde sautée alors que npm ci est vert : anomalie, code 1', () => {
    const r = resumer(etapes, ctx({ docs: 'skipped' }), 'j');
    expect(r.code).toBe(1);
    expect(r.anomalies.join()).toMatch(/Docs.*SAUTÉE/);
  });

  it('npm ci rouge : le dit, code 1', () => {
    const tout = { lint: 'skipped', docs: 'skipped', up: 'skipped', build: 'skipped', bundle: 'skipped' };
    const r = resumer(etapes, ctx({ deps: 'failure', ...tout }), 'j');
    expect(r.code).toBe(1);
    expect(r.rouges.map((x) => x.id)).toEqual(['deps']);
    expect(r.anomalies.join()).toMatch(/aucune garde n’a tourné/);
  });

  it('un contexte vide, incomplet ou étranger ne passe jamais', () => {
    expect(resumer(etapes, {}, 'j').code).toBe(1);
    const sans = ctx({});
    delete sans.docs;
    expect(resumer(etapes, sans, 'j').anomalies.join()).toMatch(/absente du contexte/);
    expect(resumer(etapes, { ...ctx({}), x: { outcome: 'success' } }, 'j').anomalies.join())
      .toMatch(/ne déclare pas/);
  });
});

describe('run : le point d’entrée', () => {
  const lire = () => CONFORME;
  const sortie = () => {
    const lignes = [];
    const resume = [];
    return { lignes, resume, log: (l) => lignes.push(l), ajouterResume: (_p, t) => resume.push(t) };
  };

  it('sans STEPS_JSON : échec, jamais un vert muet', () => {
    const s = sortie();
    expect(run({ argv: ['--job', 'j'], env: {}, lire, log: s.log })).toBe(1);
    expect(s.lignes.join()).toMatch(/STEPS_JSON absent/);
  });

  it('STEPS_JSON illisible : échec', () => {
    const s = sortie();
    expect(run({ argv: ['--job', 'j'], env: { STEPS_JSON: '{' }, lire, log: s.log })).toBe(1);
  });

  it('sans --job : échec', () => {
    expect(run({ argv: [], env: { STEPS_JSON: '{}' }, lire, log: () => {} })).toBe(1);
  });

  it('`--job .*` : TÉMOIN, échec qui nomme l’identifiant, jamais la lecture d’un autre job', () => {
    const s = sortie();
    const steps = JSON.stringify({ deps: { outcome: 'success' } });
    expect(run({ argv: ['--job', '.*'], env: { STEPS_JSON: steps }, lire, log: s.log })).toBe(1);
    expect(s.lignes.join()).toMatch(/identifiant de job invalide/);
  });

  it('deux rouges : résumé écrit, UNE annotation qui les nomme toutes les deux, code 1', () => {
    const s = sortie();
    const steps = {
      deps: { outcome: 'success' }, lint: { outcome: 'failure' }, docs: { outcome: 'failure' },
      up: { outcome: 'success' }, build: { outcome: 'success' }, bundle: { outcome: 'success' },
    };
    const code = run({
      argv: ['--job', 'j'],
      env: { STEPS_JSON: JSON.stringify(steps), GITHUB_STEP_SUMMARY: 'resume.md' },
      lire,
      log: s.log,
      ajouterResume: s.ajouterResume,
    });
    expect(code).toBe(1);
    expect(s.resume.join()).toMatch(/Lint[\s\S]*Docs/);
    const annotations = s.lignes.filter((l) => l.startsWith('::error'));
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatch(/ROUGE · Lint.*%0AROUGE · Docs/);
  });
});
