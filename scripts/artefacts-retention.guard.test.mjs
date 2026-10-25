// ═══════════════════════════════════════════════════════════════════
// artefacts-retention.guard.test.mjs · tout dépôt d'artefact a une durée
// de rétention (AM-7, docs/DEPLOYMENT.md)
//
// 🔴 POURQUOI CE FICHIER EXISTE (2026-10-23)
//
// Le quota d'artefacts du compte GitHub (11,5 Go) a été atteint le
// 2026-10-23 : c'est lui qui a bloqué la sauvegarde. Sans `retention-days`,
// GitHub garde un artefact 90 jours (son défaut), et rien ne borne ni ne
// mesure la croissance. Une étape `actions/upload-artifact` qui n'écrit
// pas sa durée passe donc silencieusement au défaut.
//
// Ce fichier lit tous les `.github/workflows/*.yml`, parse le YAML (une
// étape reste une étape, quelle que soit sa mise en forme) et refuse :
//
//   A · un dépôt d'artefact sans `retention-days` ;
//   B · une durée qui n'est pas un entier littéral entre 1 et PLAFOND_JOURS
//       (une expression `${{ }}` ne se lit pas ici, donc elle échoue) ;
//
// ❌ Ne jamais relever PLAFOND_JOURS pour faire passer la garde. 30 est la
// plus longue durée posée aujourd'hui (sauvegarde chiffrée `db-backup.yml`,
// journal `scalability-volume.yml`). Une durée plus longue est une décision
// de quota : elle se discute, elle ne se règle pas dans ce fichier.
//
// TÉMOINS : le dépôt réel doit passer, et chaque sabotage ci-dessous doit
// rougir. Un témoin qui ne voit pas la faute est une garde absente.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
// `js-yaml` arrive par ESLint (dépendance transitive). S'il disparaît,
// l'import échoue BRUYAMMENT : la garde rougit, elle ne se tait pas.
import { load } from 'js-yaml';

const RACINE = process.cwd();
const DOSSIER = resolve(RACINE, '.github/workflows');
const PLAFOND_JOURS = 30;
const DEPOTS = /^actions\/(upload-artifact|upload-pages-artifact)@/;

export function lireWorkflows(dossier = DOSSIER) {
  return readdirSync(dossier)
    .filter((f) => /\.ya?ml$/i.test(f))
    .sort()
    .map((fichier) => ({ fichier, texte: readFileSync(join(dossier, fichier), 'utf8') }));
}

/** Retourne les dépôts vus et les violations. Pure : ne lit rien seule. */
export function analyser(workflows) {
  const violations = [];
  const vus = [];
  for (const { fichier, texte } of workflows) {
    const doc = load(texte);
    for (const [job, def] of Object.entries(doc?.jobs ?? {})) {
      for (const etape of def?.steps ?? []) {
        if (!DEPOTS.test(String(etape?.uses ?? ''))) continue;
        const ou = `${fichier} · job ${job} · « ${etape.name ?? etape.uses} »`;
        vus.push(ou);
        const jours = etape.with?.['retention-days'];
        if (jours === undefined || jours === null || jours === '') {
          violations.push(`${ou} : retention-days absent (défaut GitHub : 90 jours)`);
        } else if (!Number.isInteger(jours) || jours < 1 || jours > PLAFOND_JOURS) {
          violations.push(`${ou} : retention-days = ${JSON.stringify(jours)}, attendu un entier de 1 à ${PLAFOND_JOURS}`);
        }
      }
    }
  }
  return { vus, violations };
}

// ─── Le dépôt réel ───────────────────────────────────────────────────

describe('workflows du dépôt · tout upload-artifact a une rétention bornée', () => {
  const workflows = lireWorkflows();
  const r = analyser(workflows);

  it('la garde a lu des dépôts d\'artefact (elle regarde quelque chose)', () => {
    expect(workflows.length).toBeGreaterThan(0);
    expect(r.vus.length).toBeGreaterThan(0);
    expect(r.vus.some((ou) => ou.startsWith('ci.yml'))).toBe(true);
    expect(r.vus.some((ou) => ou.startsWith('db-backup.yml'))).toBe(true);
  });

  it('chaque dépôt d\'artefact porte un retention-days borné', () => {
    expect(r.violations).toEqual([]);
  });
});

// ─── Témoins : la garde voit la faute ────────────────────────────────

describe('témoins · la garde refuse ce qu\'elle doit refuser', () => {
  const sans = (texte) => texte.replace(/\n[ \t]*retention-days:[^\n]*/g, '');
  const reel = lireWorkflows();

  it('sabotage : retirer retention-days de ci.yml est une violation', () => {
    const casse = reel.map((w) => (w.fichier === 'ci.yml' ? { ...w, texte: sans(w.texte) } : w));
    const v = analyser(casse).violations.filter((x) => x.startsWith('ci.yml'));
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]).toMatch(/retention-days absent/);
  });

  it('sabotage : retirer retention-days de db-backup.yml est une violation', () => {
    const casse = reel.map((w) => (w.fichier === 'db-backup.yml' ? { ...w, texte: sans(w.texte) } : w));
    const v = analyser(casse).violations.filter((x) => x.startsWith('db-backup.yml'));
    expect(v.length).toBeGreaterThan(0);
  });

  const un = (valeur) => [{
    fichier: 'x.yml',
    texte: `jobs:\n  j:\n    steps:\n      - uses: actions/upload-artifact@v7\n        with:\n          name: r\n          path: r/\n          retention-days: ${valeur}\n`,
  }];

  it('une durée de 90 jours (défaut GitHub, plafond dépassé) est refusée', () => {
    expect(analyser(un(90)).violations).toHaveLength(1);
  });

  it('une durée de 0 est refusée', () => {
    expect(analyser(un(0)).violations).toHaveLength(1);
  });

  it('une expression ${{ }} n\'est pas lisible ici : refusée', () => {
    expect(analyser(un('${{ env.JOURS }}')).violations).toHaveLength(1);
  });

  it('une durée de 7 jours est acceptée', () => {
    expect(analyser(un(7)).violations).toEqual([]);
  });

  it('un upload-pages-artifact sans retention-days est aussi refusé', () => {
    const v = analyser([{
      fichier: 'p.yml',
      texte: 'jobs:\n  j:\n    steps:\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: dist/\n',
    }]).violations;
    expect(v).toHaveLength(1);
  });

  it('une étape qui ne dépose pas d\'artefact est ignorée', () => {
    const r = analyser([{
      fichier: 'c.yml',
      texte: 'jobs:\n  j:\n    steps:\n      - uses: actions/checkout@v4\n',
    }]);
    expect(r.vus).toEqual([]);
    expect(r.violations).toEqual([]);
  });
});
