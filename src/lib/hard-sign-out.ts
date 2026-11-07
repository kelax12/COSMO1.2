// ═══════════════════════════════════════════════════════════════════
// SORTIE DE SECOURS — repartir d'une session propre quand tout est casse
// ═══════════════════════════════════════════════════════════════════
//
// `RootErrorBoundary` porte cette sortie ; `AppErrorBoundary`, plus bas dans
// l'arbre et donc premier à attraper, n'offrait que « Rafraichir la page ». Quand
// la cause est deterministe (valeur de stockage, reponse d'API en cache,
// preference), le rechargement ramene le meme ecran, et la deconnexion elle-meme
// etait hors d'atteinte (`Layout` est le parent des pages protegees).
//
// La fonction vit ici, partagee par les deux frontieres : deux copies d'un
// chemin de secours divergent, et c'est la copie non maintenue qu'on rencontre
// le jour ou on en a besoin.

/**
 * Purge tout ce qui pourrait ramener dans l'etat casse, puis repart sur la
 * racine par un rechargement complet.
 *
 * On efface les cles de session Supabase (`sb-*-auth-token`) ET nos propres
 * caches (`cosmo*`). On ne touche a RIEN d'autre : le localStorage de
 * l'origine peut contenir des donnees etrangeres a l'app.
 */
export function hardSignOut(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sb-') || key.startsWith('cosmo')) doomed.push(key);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* navigation privee stricte — on tente quand meme la redirection */
  }
  // `location.replace` et pas `assign` : l'ecran casse ne doit pas rester dans
  // l'historique, sinon le bouton retour y ramene.
  window.location.replace('/');
}
