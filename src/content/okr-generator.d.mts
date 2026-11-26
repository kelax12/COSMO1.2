/** Contenu d'un domaine dans une langue : nom, objectifs types, résultats clés [libellé, unité, départ, cible]. */
export interface OkrDomaineContenu {
  nom: string;
  objectifs: readonly string[];
  kr: readonly (readonly [string, string, string, string])[];
}
export interface OkrDomaine {
  id: string;
  fr: OkrDomaineContenu;
  en: OkrDomaineContenu;
}
export declare const OKR_DOMAINES: readonly OkrDomaine[];
