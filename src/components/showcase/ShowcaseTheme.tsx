import React from 'react';
import { ShowcaseThemeContext, type ShowcaseTheme as Theme } from './showcase-theme';
import './showcase-light.css';

interface Props {
  theme: Theme;
  children: React.ReactNode;
}

/**
 * Pose le thème des vitrines qu'il enveloppe. Sans lui, elles sont SOMBRES :
 * c'est le cas de `/guide`, qui n'a rien à demander.
 *
 * Le `div` est en `display: contents` : il ne crée aucune boîte, donc il ne
 * change rien à la mise en page du parent, mais les variables CSS et le
 * sélecteur `[data-sc-theme]` descendent quand même à travers lui.
 *
 * La feuille claire est importée ICI, et pas dans `index.css` : elle ne part
 * qu'avec les pages qui montent ce composant, soit le chunk de la landing.
 */
const ShowcaseTheme: React.FC<Props> = ({ theme, children }) => (
  <ShowcaseThemeContext.Provider value={theme}>
    <div data-sc-theme={theme} className="contents">
      {children}
    </div>
  </ShowcaseThemeContext.Provider>
);

export default ShowcaseTheme;
