// ═══════════════════════════════════════════════════════════════════
// Assistant de démarrage d'une entreprise : l'ordre des étapes
//
// Nom → première équipe → inviter par e-mail → premier projet (modèle) →
// le cap (premier objectif d'entreprise, ajouté le 2026-10-03).
// Le nom est l'étape 1 et elle est déjà faite quand l'assistant s'ouvre :
// c'est la création de l'entreprise qui l'y amène.
//
// « Équipe » passe AVANT « projet », comme dans la checklist de l'Aperçu : un
// projet rattaché après coup demande un geste de plus, et c'est le
// rattachement qui porte le cloisonnement de visibilité.
//
// « Équipe » passe aussi AVANT « inviter » depuis le 2026-10-05 : les
// invitations partaient sans équipe ni manager, et il fallait replacer chaque
// personne ailleurs, plus tard. Une fois l'équipe créée, l'invitation peut
// l'emporter (`teamIds`) et placer la personne sous vous (`managerId`).
//
// « Cap » vient EN DERNIER : un objectif d'entreprise se comprend mieux une
// fois qu'on a vu les personnes, l'équipe et le projet qu'il va orienter.
// ═══════════════════════════════════════════════════════════════════

export const ORG_SETUP_STEPS = ['name', 'team', 'invite', 'project', 'objective'] as const;
export type OrgSetupStep = (typeof ORG_SETUP_STEPS)[number];
/** `done` : écran de fin, hors de la liste numérotée. */
export type OrgSetupScreen = Exclude<OrgSetupStep, 'name'> | 'done';

/** Étape d'une URL (`?step=`). Inconnue ou absente → la première à faire. */
export const parseSetupScreen = (value: string | null | undefined): OrgSetupScreen =>
  value === 'invite' || value === 'project' || value === 'objective' || value === 'done' ? value : 'team';

/** Écran suivant. Une étape passée avance exactement comme une étape faite. */
export const nextSetupScreen = (screen: OrgSetupScreen): OrgSetupScreen => {
  if (screen === 'team') return 'invite';
  if (screen === 'invite') return 'project';
  if (screen === 'project') return 'objective';
  return 'done';
};

/** Index 0-based de l'étape dans la liste numérotée (`done` = après la dernière). */
export const setupStepIndex = (screen: OrgSetupScreen): number =>
  screen === 'done' ? ORG_SETUP_STEPS.length : ORG_SETUP_STEPS.indexOf(screen);

/** Chemin de l'assistant pour une organisation (et, au besoin, une étape). */
export const orgSetupPath = (orgId: string, screen?: OrgSetupScreen): string => {
  const params = new URLSearchParams({ setup: orgId });
  if (screen && screen !== 'team') params.set('step', screen);
  return `/entreprise/onboarding?${params.toString()}`;
};
