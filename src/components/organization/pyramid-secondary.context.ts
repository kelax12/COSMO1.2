// Liens hiérarchiques secondaires (mig. 196), lus UNE fois par la pyramide et
// fournis à chaque carte par contexte : `NodeCard` est rendue à trois
// endroits, récursivement, et porte déjà dix-neuf paramètres.
import { createContext, useContext } from 'react';

/** userId → noms des responsables secondaires. */
export const SecondaryManagersContext = createContext<ReadonlyMap<string, string[]>>(new Map());
export const useSecondaryManagerNames = (userId: string): string[] =>
  useContext(SecondaryManagersContext).get(userId) ?? [];
