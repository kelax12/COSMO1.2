// Garde « un seul formulaire par objet » du mode entreprise (org-create.context).
//
// Le 2026-09-25, un projet se créait à trois endroits et une équipe à quatre,
// avec des résultats différents : projet gris sans équipe depuis les puces de
// Tâches, équipe SANS MEMBRES depuis le modal d'OKR. Cette garde refuse qu'un
// écran recrée sa propre création.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// L'assistant de démarrage vit depuis le 2026-10-03 dans l'accueil entreprise :
// sans ce second dossier, une création y échapperait à la garde.
const DIRS = ['src/components/organization', 'src/components/onboarding/enterprise'];

/**
 * Seuls endroits autorisés à créer un projet ou une équipe. Chaque entrée dit
 * pourquoi ; en ajouter une pour faire passer la CI est exactement ce que la
 * garde existe pour empêcher.
 */
const ALLOWED: Record<string, string> = {
  'OrgCreateForms.tsx': 'le formulaire unique lui-même',
  'CreateTeamModal.tsx': "définit CreateTeamForm et la modale qui l'entoure",
  'TeamOKRModal.tsx': 'intègre CreateTeamForm tel quel : un panneau Radix ne laisse pas une autre modale prendre le focus',
  'SetupSteps.tsx': "assistant de démarrage (accueil entreprise) : parcours guidé d'une entreprise vide, un écran par étape",
  'use-team-projects-actions.ts': 'dupliquer un projet et enregistrer un modèle, pas une création depuis un formulaire',
};

/** Ce qui CRÉE un projet ou une équipe, ou monte un formulaire de création. */
const CREATION = /\buseCreateTeamProject\s*\(|\buseCreateTeamProjectWithTasks\s*\(|\buseCreateOrgTeam\s*\(|\buseCreateTeamWithMembers\s*\(|<NewTeamProjectModal\b|<CreateTeamModal\b|<CreateTeamForm\b/;

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('un seul formulaire de création par objet (mode entreprise)', () => {
  const paths = DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
      .map((f) => ({ dir, f })),
  );
  const files = paths.map((p) => p.f);

  it('lit bien le dossier', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("aucun écran ne recrée sa propre création de projet ou d'équipe", () => {
    const offenders = paths
      .filter(({ dir, f }) => !(f in ALLOWED) && CREATION.test(code(readFileSync(join(dir, f), 'utf8'))))
      .map(({ f }) => f);
    expect(offenders).toEqual([]);
  });

  it('chaque exception existe encore (une exception morte se retire)', () => {
    for (const f of Object.keys(ALLOWED)) expect(files).toContain(f);
  });

  it('témoin : le détecteur voit une création en ligne', () => {
    expect(CREATION.test(code('const createProject = useCreateTeamProject(orgId);'))).toBe(true);
    expect(CREATION.test(code('{show && <CreateTeamModal members={m} />}'))).toBe(true);
    expect(CREATION.test(code('// useCreateOrgTeam(orgId) retiré'))).toBe(false);
  });
});
