// Adresse de contact publique de COSMO.
//
// Source unique : elle est affichée sur la landing (footer + FAQ) ET utilisée
// comme destinataire du formulaire « Signaler un bug » (Edge Function
// `report-bug`). Une adresse recopiée à la main dans deux fichiers finit
// toujours par diverger le jour où elle change.
//
// ⚠️ Les pages légales (mentions légales, CGU, confidentialité) gardent
// volontairement l'adresse personnelle de l'éditeur : c'est une mention
// d'identité, pas un canal de support.
//
// En `.mjs` (types dans `contact.d.mts`) parce que `prerender.mjs` l'importe
// sous Node, sans passer par Vite : c'est la seule façon d'avoir la MÊME
// adresse dans le footer React et dans le footer statique servi aux crawlers.
export const CONTACT_EMAIL = 'contact@thecosmo.app';
