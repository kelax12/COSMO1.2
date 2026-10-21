// src/lib/guide-demo-active.ts

/**
 * Vrai pendant qu'une démo de guide (perso ou entreprise) pilote l'écran.
 *
 * Lu par `useTutorial` : le tutoriel d'une page s'ouvre de lui-même à la
 * première visite, et la démo, qui VISITE la page, le faisait surgir par-dessus
 * son propre curseur (mesuré le 2026-10-19 sur /tasks, « 1/9 » plein écran).
 * Un module plutôt qu'un contexte : le guide est lazy, la page ne le charge pas.
 */
let active = false;

export const setGuideDemoActive = (value: boolean): void => { active = value; };

export const isGuideDemoActive = (): boolean => active;
