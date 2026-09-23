// ═══════════════════════════════════════════════════════════════════
// Emplacement à DROITE de la page, hors de la zone qui défile (desktop).
//
// `Layout` pose un élément vide à cet id, frère de `<main>` ; une page y
// monte une navigation propre par `createPortal` (seul client aujourd'hui :
// `OrgSideNav`, l'espace entreprise).
//
// POURQUOI hors de `<main>` : `<main>` est le conteneur qui défile. Rendue
// dedans, la navigation laissait la barre de défilement de la page ENTRE elle
// et le bord de la fenêtre, et un curseur poussé contre le bord atterrissait
// sur la barre de défilement, pas sur la bande de 10 px censée rouvrir le
// panneau. Mesuré dans le navigateur le 2026-09-23 : bande à x = 1007-1016,
// barre de défilement à 1016-1024, fenêtre de 1024.
//
// Sur mobile, `Layout` ne pose pas cet emplacement : le portail ne rend rien.
// ═══════════════════════════════════════════════════════════════════
export const PAGE_RIGHT_RAIL_ID = 'page-right-rail';
