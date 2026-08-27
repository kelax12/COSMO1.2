// ═══════════════════════════════════════════════════════════════════
// LA lecture de la boite de reception d'entreprise (mig. 129)
//
// Ce hook vit dans son propre module, et pas dans `hooks.ts`, pour une raison
// concrete : `notifications.ts` en a besoin, et `hooks.ts` tire le catalogue
// i18n `org`. L'importer depuis notifications faisait entrer ce catalogue dans
// le sous-arbre de pages qui n'ont rien d'entreprise (landing, connexion,
// habitudes, OKR...), ce que la garde `lazy-namespaces.guard.test.ts` refuse
// a juste titre : un catalogue charge est du poids envoye au navigateur.
// ═══════════════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query';
import { getOrganizationsRepository } from '@/lib/repository.factory';
import { orgKeys } from './constants';

/**
 * Les CINQ lectures de la boite de reception en UNE requete.
 *
 * Elles partaient a chaque ouverture de l'application, sur TOUTES les pages
 * protegees, parce que `Layout` monte `useOrgBadges` pour peindre une
 * pastille : invitations, avis de retrait, ma demande d'adhesion, demandes
 * recues cote admin, notifications, plus un sixieme appel conditionnel a
 * `profiles` pour nommer les demandeurs.
 *
 * ❌ Ne pas lui passer d'organisation. La RPC ne prend aucun parametre, son
 * perimetre vient de `auth.uid()` seul : c'est ce qui lui permet de partir en
 * meme temps que tout le reste, au lieu d'attendre que l'organisation active
 * soit resolue. On echangerait alors quatre requetes contre du delai, en
 * serialisant ce qui partait en parallele. Les sections par organisation
 * couvrent TOUTES mes organisations, et les selecteurs filtrent.
 *
 * ❌ Ne pas redonner une cle React Query a l'un des selecteurs : une cle de
 * plus est une requete de plus.
 */
export const useOrgInbox = () => {
  const repository = getOrganizationsRepository();
  return useQuery({
    queryKey: orgKeys.inbox(),
    queryFn: () => repository.getMyOrgInbox(),
    // Plus de sondage : `useOrgInboxRealtime` (App.tsx, mig. 118) ecoute les
    // tables et invalide cette cle. `refetchOnWindowFocus` reste le filet
    // quand le WebSocket est indisponible (navigation privee, anti-pistage).
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
};
