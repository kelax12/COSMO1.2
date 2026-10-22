// ═══════════════════════════════════════════════════════════════════
// SORTIE DE SECOURS — repartir d'une session propre quand tout est casse
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE FICHIER EXISTE (C-64).
//
// `RootErrorBoundary` porte cette sortie depuis son ecriture, pour une raison
// nommee dans son propre en-tete : « le pire n'etait pas l'ecran vide, c'etait
// l'impasse ». `AppErrorBoundary`, qui est PLUS BAS dans l'arbre et attrape
// donc EN PREMIER, n'offrait que « Rafraichir la page ».
//
// Quand la cause est deterministe — une valeur de stockage, une reponse d'API
// mise en cache, une preference — le rechargement ramene le meme ecran. C'est
// exactement ce qui a ete MESURE le 2026-09-03 sur C-61 : trois entrees, trois
// fois le meme ecran, et le bouton propose relisait la meme cle. L'utilisateur
// n'avait alors aucun geste disponible, et `Layout` etant le parent de toutes
// les pages protegees, la deconnexion elle-meme etait hors d'atteinte.
//
// La fonction vit donc ici, partagee par les deux frontieres, plutot que
// dupliquee : deux copies d'un chemin de secours finissent par diverger, et
// c'est la copie non maintenue qu'on rencontre le jour ou on en a besoin.

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
