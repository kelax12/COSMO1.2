// ═══════════════════════════════════════════════════════════════════
// useFriendsInboxRealtime — remplace les trois derniers sondages permanents
//
// POURQUOI (audit scalabilité, §3 de docs/SCALABILITY.md)
//
// La mig. 118 a fermé la boîte de réception d'ORGANISATION. Restaient les
// trois sondages de la collaboration entre comptes personnels, eux aussi
// montés en permanence par `InboxMenu` :
//
//   useFriendRequests      15 s  → friend_requests (reçues)
//   useSentFriendRequests  15 s  → friend_requests (envoyées)
//   useIncomingSharedLists 20 s  → shared_lists    (reçues)
//
// Soit ≈ 15 requêtes par minute et par utilisateur connecté, avant toute
// interaction, pour apprendre dans la quasi-totalité des cas qu'il n'y a rien
// de neuf. Une demande d'ami et un partage de liste sont des événements RARES
// et ponctuels : le cas d'usage exact du Realtime.
//
// ── Deux tables, trois hooks ──
//
// `friend_requests` porte les demandes REÇUES et ENVOYÉES : deux écoutes
// filtrées (`receiver_id` / `sender_id`) suffisent, et elles ferment deux
// sondages. `shared_lists` ferme le troisième.
//
// ── Pourquoi c'est sûr côté données ──
//
// Realtime applique la RLS de chaque table au flux : le serveur ne pousse une
// ligne que si la policy SELECT l'autorise pour cette session. Les filtres
// `eq` ci-dessous sont une RÉDUCTION DE BRUIT côté serveur, PAS la frontière
// de sécurité.
//
// ── À monter UNE SEULE FOIS ──
//
// Un canal Realtime est une connexion WebSocket. Le monter dans un composant
// de page en ouvrirait un par écran affiché (garde-fou CLAUDE.md § 📡). Ce
// hook est donc monté dans `App.tsx`, à côté de `useSharedTasksRealtime` et
// `useOrgInboxRealtime`.
// ═══════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useIsDemo } from '@/lib/app-mode.store';
import { friendKeys } from './constants';

/**
 * Abonne la session courante à ses demandes d'amis et aux listes qu'on lui
 * partage, et invalide les listes concernées à chaque changement.
 * No-op en démo et sans Supabase.
 */
export function useFriendsInboxRealtime(userId: string | undefined): void {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  useEffect(() => {
    if (isDemo || !isSupabaseConfigured || !userId) return;

    const invalidateIncomingRequests = () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.requests() });
      // Une demande acceptée crée une amitié : la liste d'amis change aussi.
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    };
    const invalidateSentRequests = () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.sentRequests() });
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
    };
    const invalidateSharedLists = () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.incomingSharedLists() });
    };

    // ⚠️ `subscribe()` construit un WebSocket, et le constructeur `WebSocket`
    // LÈVE de façon SYNCHRONE dans les navigateurs qui les bloquent
    // (navigation privée, anti-pistage strict). Ce hook étant monté dans
    // `App.tsx`, AU-DESSUS de tout boundary de page, une exception non
    // rattrapée démonterait l'application ENTIÈRE — c'est le bug « écran noir
    // à la connexion » documenté dans `useSharedTasksRealtime`.
    //
    // Le temps réel est un CONFORT : une connexion impossible doit dégrader la
    // synchronisation, jamais empêcher l'application de démarrer. Le repli est
    // `refetchOnWindowFocus`, resté actif sur les trois hooks.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`friends-inbox:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friend_requests', filter: `receiver_id=eq.${userId}` },
          invalidateIncomingRequests,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friend_requests', filter: `sender_id=eq.${userId}` },
          invalidateSentRequests,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shared_lists', filter: `friend_id=eq.${userId}` },
          invalidateSharedLists,
        )
        .subscribe();
    } catch (err) {
      console.warn('[realtime] canal amis indisponible, repli sur le retour d onglet', err);
      monitoring.captureException(err, {
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
