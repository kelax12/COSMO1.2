import React from 'react';
import { ShowcaseThemeContext, type ShowcaseTheme as Theme } from './showcase-theme';
import './showcase-light.css';
import './showcase-gris-noir.css';

interface Props {
  theme: Theme;
  children: React.ReactNode;
}

/**
 * Pose le thème des vitrines qu'il enveloppe. Sans lui, elles sont SOMBRES.
 * La landing perso les monte en clair ; `/guide` les monte dans le thème de
 * l'app du visiteur (clair, sombre, gris ou noir).
 *
 * Le `div` est en `display: contents` : il ne crée aucune boîte, donc il ne
 * change rien à la mise en page du parent, mais les variables CSS et le
 * sélecteur `[data-sc-theme]` descendent quand même à travers lui.
 *
 * Les feuilles de thème sont importées ICI, et pas dans `index.css` : elles ne
 * partent qu'avec les pages qui montent ce composant.
 */
const ShowcaseTheme: React.FC<Props> = ({ theme, children }) => (
  <ShowcaseThemeContext.Provider value={theme}>
    <div data-sc-theme={theme} className="contents">
      {children}
    </div>
  </ShowcaseThemeContext.Provider>
);

export default ShowcaseTheme;
