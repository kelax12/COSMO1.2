// ═══════════════════════════════════════════════════════════════════
// Assistant de démarrage d'une entreprise : l'ordre des étapes
//
// Nom → inviter par e-mail → première équipe → premier projet (modèle).
// Le nom est l'étape 1 et elle est déjà faite quand l'assistant s'ouvre :
// c'est la création de l'entreprise qui l'y amène.
//
// « Équipe » passe AVANT « projet », comme dans la checklist de l'Aperçu : un
// projet rattaché après coup demande un geste de plus, et c'est le
// rattachement qui porte le cloisonnement de visibilité.
// ═══════════════════════════════════════════════════════════════════

export const ORG_SETUP_STEPS = ['name', 'invite', 'team', 'project'] as const;
export type OrgSetupStep = (typeof ORG_SETUP_STEPS)[number];
/** `done` : écran de fin, hors de la liste numérotée. */
export type OrgSetupScreen = Exclude<OrgSetupStep, 'name'> | 'done';

/** Étape d'une URL (`?step=`). Inconnue ou absente → la première à faire. */
export const parseSetupScreen = (value: string | null | undefined): OrgSetupScreen =>
  value === 'team' || value === 'project' || value === 'done' ? value : 'invite';

/** Écran suivant. Une étape passée avance exactement comme une étape faite. */
export const nextSetupScreen = (screen: OrgSetupScreen): OrgSetupScreen => {
  if (screen === 'invite') return 'team';
  if (screen === 'team') return 'project';
  return 'done';
};

/** Index 0-based de l'étape dans la liste numérotée (`done` = après la dernière). */
export const setupStepIndex = (screen: OrgSetupScreen): number =>
  screen === 'done' ? ORG_SETUP_STEPS.length : ORG_SETUP_STEPS.indexOf(screen);

/** Chemin de l'assistant pour une organisation (et, au besoin, une étape). */
export const orgSetupPath = (orgId: string, screen?: OrgSetupScreen): string => {
  const params = new URLSearchParams({ setup: orgId });
  if (screen && screen !== 'invite') params.set('step', screen);
  return `/entreprise/onboarding?${params.toString()}`;
};
