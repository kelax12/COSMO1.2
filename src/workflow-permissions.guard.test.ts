// ═══════════════════════════════════════════════════════════════════
// Témoin : chaque workflow déclare ses `permissions` (A-8, 2026-09-30)
//
// Sans bloc `permissions`, le `GITHUB_TOKEN` d'un job reçoit les droits par
// défaut du dépôt. CodeQL (`actions/missing-workflow-permissions`) l'a signalé
// sur `renewal-notice.yml` le 2026-09-22, puis sur `org-digest.yml` et
// `org-webhook-dispatch.yml`, créés APRÈS : l'alerte triée à la main ne
// protégeait pas le workflow suivant. Ce test le fait.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), '.github/workflows');
const workflows = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

/** Un bloc `permissions` au niveau du workflow, ou sur CHAQUE job. */
function declaresPermissions(yaml: string): boolean {
  if (/^permissions:/m.test(yaml)) return true;
  const jobs = yaml.split(/^jobs:\s*$/m)[1] ?? '';
  const jobNames = [...jobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return jobNames.length > 0 && jobNames.length === [...jobs.matchAll(/^ {4}permissions:/gm)].length;
}

describe('.github/workflows : moindre privilège', () => {
  it('le détecteur refuse un workflow sans permissions (témoin)', () => {
    expect(declaresPermissions('on: push\njobs:\n  a:\n    runs-on: x\n')).toBe(false);
    expect(declaresPermissions('permissions:\n  contents: read\njobs:\n  a:\n    runs-on: x\n')).toBe(true);
    expect(declaresPermissions('jobs:\n  a:\n    permissions: {}\n  b:\n    runs-on: x\n')).toBe(false);
    // 18 workflows au 2026-09-30 : une liste vide ne prouverait rien.
    expect(workflows.length).toBeGreaterThanOrEqual(15);
  });

  it.each(workflows)('%s déclare ses permissions', (file) => {
    expect(declaresPermissions(readFileSync(join(DIR, file), 'utf8'))).toBe(true);
  });
});
