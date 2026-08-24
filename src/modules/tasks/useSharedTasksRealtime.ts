// ═══════════════════════════════════════════════════════════════════
// useSharedTasksRealtime — remplace le sondage de la liste de tâches
//
// POURQUOI (audit architecture 2026-08-07, point C2)
//
// La collaboration n'a pas de canal de notification : sans rien, une tâche
// qu'un ami vient de partager n'apparaît jamais (cache React Query,
// `refetchOnWindowFocus` désactivé globalement). La parade était un
// `refetchInterval` qui rejouait un `getAll()` COMPLET toutes les 15 s dès que
// l'utilisateur avait au moins un ami.
//
// Coût mesuré de cette approche : ≈ 58 Mo/mois/utilisateur d'egress Supabase,
// pour un événement qui survient quelques fois par mois. À 1 000 utilisateurs,
// ~58 Go/mois — uniquement pour découvrir qu'il n'y a rien de neuf.
//
// Ce hook écoute la table `shared_tasks` en temps réel et n'invalide le cache
// QUE lorsqu'un partage me concerne réellement. Le sondage devient un simple
// filet de sécurité (cf. `useTasks`), pas le mécanisme principal.
//
// ── Pourquoi c'est sûr côté données ──
//
// Realtime applique la RLS de `shared_tasks` au flux : le serveur ne pousse une
// ligne que si la policy `shared_tasks_select` l'autorise pour cette session
// (`auth.uid() = shared_by OR = friend_id`). On ne reçoit donc jamais l'activité
// de partage d'inconnus. Le filtre `friend_id=eq.<uid>` ci-dessous est une
// réduction de bruit côté serveur, PAS la frontière de sécurité.
//
// ── Pourquoi on n'écoute pas `tasks` directement ──
//
// Il faudrait un canal par tâche partagée, ou un filtre impossible à exprimer
// (« les tâches dont l'id est dans ma table de partages »). `shared_tasks` est
// le point d'entrée de toute collaboration : une ligne y apparaît exactement
// quand quelque chose devient visible pour moi.
// ═══════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useIsDemo } from '@/lib/app-mode.store';
import { taskKeys } from './constants';
import { friendKeys } from '@/modules/friends/constants';

/**
 * Abonne la session courante aux partages de tâches la concernant et invalide
 * la liste de tâches à chaque changement. No-op en démo et sans Supabase.
 *
 * À monter UNE SEULE FOIS par application (fait dans `App.tsx`) : un canal
 * Realtime est une connexion WebSocket, la monter par composant en ouvrirait
 * autant que d'écrans affichés.
 */
export function useSharedTasksRealtime(userId: string | undefined): void {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  useEffect(() => {
    if (isDemo || !isSupabaseConfigured || !userId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      // Même événement, même vérité : une ligne de `shared_tasks` qui bouge
      // change AUSSI la boîte de réception et les avatars de collaborateurs
      // (`useRelatedTaskShares`). Cette liste se sondait toutes les 20 s alors
      // que le canal qui porte l'information était déjà ouvert, juste à côté.
      // On importe la clé du module `friends` plutôt que d'ouvrir un second
      // canal : un canal Realtime est un WebSocket, pas un abonnement gratuit.
      queryClient.invalidateQueries({ queryKey: friendKeys.relatedTaskShares() });
    };

    // ⚠️ `subscribe()` construit un WebSocket, et le constructeur `WebSocket`
    // LÈVE de façon SYNCHRONE dans les navigateurs qui les bloquent :
    // « SecurityError: The operation is insecure » (navigation privée, blocage
    // total des données de site, protection anti-pistage stricte — Safari et
    // Firefox notamment).
    //
    // Ce hook étant monté dans `App.tsx`, AU-DESSUS de tout boundary de page,
    // cette exception démontait l'application ENTIÈRE : écran noir en thème
    // sombre, page blanche en clair, à CHAQUE visite depuis ce navigateur — et
    // plus aucun bouton pour se déconnecter. C'est la cause des symptômes
    // « écran noir à la connexion sur mobile » et « page blanche automatique ».
    //
    // Le temps réel est un CONFORT, pas une dépendance : `useTasks` garde son
    // sondage de secours à 5 min. Une connexion impossible doit donc dégrader
    // la synchronisation, jamais empêcher l'application de démarrer.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`shared-tasks:${userId}`)
        // Destinataire : quelqu'un vient de me partager (ou de me retirer) une tâche.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shared_tasks', filter: `friend_id=eq.${userId}` },
          invalidate,
        )
        // Émetteur : l'état de mes propres partages a changé (acceptation, retrait).
        // Utile pour rafraîchir les marqueurs de collaboration sur MES tâches.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shared_tasks', filter: `shared_by=eq.${userId}` },
          invalidate,
        )
        .subscribe();
    } catch (err) {
      // Remonté en `warning` et non en erreur : l'app fonctionne, elle est
      // simplement moins réactive. Le savoir reste utile pour mesurer combien
      // d'utilisateurs sont dans ce cas.
      console.warn('[realtime] canal indisponible, repli sur le sondage', err);
      Sentry.captureException(err, {
        level: 'warning',
        tags: { context: 'realtime-websocket-unavailable' },
      });
      return;
    }

    return () => {
      // `removeChannel` ferme l'abonnement ET libère le socket s'il ne reste
      // aucun canal — indispensable pour ne pas fuir une connexion à chaque
      // changement d'utilisateur sur un appareil partagé.
      const opened = channel;
      if (!opened) return;
      try {
        void supabase.removeChannel(opened);
      } catch {
        /* le socket n'a jamais existé — rien à libérer */
      }
    };
  }, [userId, isDemo, queryClient]);
}
