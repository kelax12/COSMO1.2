// ═══════════════════════════════════════════════════════════════════
// useOrgInboxRealtime — remplace trois sondages permanents de 20 s
//
// POURQUOI (audit scalabilité, §3 de docs/SCALABILITY.md)
//
// `InboxMenu` est monté sur le tableau de bord, donc en permanence. Il tirait
// trois requêtes indépendantes toutes les 20 secondes :
//
//   useMyOrgInvitations      → org_invitations
//   useMyOrgRemovalNotices   → org_notifications (kind = 'org_removed')
//   useMySentJoinRequest     → organization_join_requests
//
// Soit NEUF requêtes par minute et par utilisateur connecté, avant toute
// interaction, pour découvrir dans la quasi-totalité des cas qu'il n'y a rien
// de neuf. Une invitation d'entreprise, un retrait, une réponse à une demande
// d'adhésion sont des événements RARES et ponctuels : c'est le cas d'usage
// exact du Realtime, et le pire cas d'usage du sondage.
//
// Le payload n'est pas le sujet ici (ces lignes sont minuscules), le NOMBRE de
// requêtes l'est : à 1 000 utilisateurs actifs simultanés, ces trois hooks
// seuls produisaient 9 000 requêtes par minute.
//
// ── Deux tables pour trois hooks ──
//
// `org_notifications` porte À LA FOIS les notifications (`task_assigned`,
// `mention`) et les avis de retrait (`org_removed`, lus par la RPC
// `get_my_org_removal_notices`). L'écouter ferme donc deux sondages d'un coup.
//
// ── Pourquoi c'est sûr côté données ──
//
// Realtime applique la RLS de chaque table au flux : le serveur ne pousse une
// ligne que si la policy SELECT l'autorise pour cette session. Les filtres
// `user_id=eq.<uid>` / `invitee_id=eq.<uid>` ci-dessous sont une RÉDUCTION DE
// BRUIT côté serveur, PAS la frontière de sécurité.
//
// ── À monter UNE SEULE FOIS ──
//
// Un canal Realtime est une connexion WebSocket. Le monter dans un composant
// de page en ouvrirait un par écran affiché (garde-fou CLAUDE.md § 📡). Ce
// hook est donc monté dans `App.tsx`, à côté de `useSharedTasksRealtime`.
// ═══════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// Sentry n'est PLUS importe statiquement : il est charge apres le premier
// rendu (arbitrage C-13/C-14). `monitoring` est la seule porte, et elle
// tamponne ce qui arrive avant le chargement.
import * as monitoring from '@/lib/monitoring';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useIsDemo } from '@/lib/app-mode.store';
import { orgKeys } from './constants';

/**
 * Abonne la session courante à sa boîte de réception d'organisation et invalide
 * les listes concernées à chaque changement. No-op en démo et sans Supabase.
 */
export function useOrgInboxRealtime(
  userId: string | undefined,
  activeOrgId?: string,
): void {
  const queryClient = useQueryClient();
  const isDemo = useIsDemo();

  useEffect(() => {
    if (isDemo || !isSupabaseConfigured || !userId) return;

    // Depuis la mig. 129, les CINQ sections de la boite de reception viennent
    // d'une seule lecture : notifications, avis de retrait, invitations, ma
    // demande d'adhesion et les demandes recues cote admin. Il n'y a donc plus
    // qu'une cle a invalider, et elle ne depend d'aucune organisation.
    //
    // ❌ Ne pas reintroduire une invalidation par section : elles pointeraient
    // des cles qui ne portent plus de donnee, et l'ecran ne se rafraichirait
    // plus du tout, en silence.
    const invalidateInbox = () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.inbox() });
    };
    const invalidateNotifications = invalidateInbox;
    const invalidateInvitations = () => {
      invalidateInbox();
      // Une invitation acceptée me fait entrer dans une organisation : la
      // liste de MES organisations change, et avec elle l'onglet Entreprise.
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
    };
    const invalidateJoinRequest = () => {
      invalidateInbox();
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
    };
    // Côté ADMIN : les demandes d'adhésion adressées à MON organisation.
    // Sans cette écoute, `useOrgJoinRequests` gardait un sondage de 20 s monté
    // par `Layout`, donc actif sur TOUTES les pages protégées pour tout admin
    // d'organisation — le sondage le plus permanent de l'app.
    const invalidateOrgJoinRequests = invalidateInbox;

    // ⚠️ `subscribe()` construit un WebSocket, et le constructeur `WebSocket`
    // LÈVE de façon SYNCHRONE dans les navigateurs qui les bloquent
    // (navigation privée, anti-pistage strict). Ce hook étant monté dans
    // `App.tsx`, AU-DESSUS de tout boundary de page, une exception non
    // rattrapée démonterait l'application ENTIÈRE — c'est exactement le bug
    // « écran noir à la connexion » documenté dans `useSharedTasksRealtime`.
    //
    // Le temps réel est un CONFORT : une connexion impossible doit dégrader la
    // synchronisation, jamais empêcher l'application de démarrer. Le repli est
    // `refetchOnWindowFocus`, resté actif sur les trois hooks.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`org-inbox:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'org_notifications', filter: `user_id=eq.${userId}` },
          invalidateNotifications,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'org_invitations', filter: `invitee_id=eq.${userId}` },
          invalidateInvitations,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'organization_join_requests', filter: `user_id=eq.${userId}` },
          invalidateJoinRequest,
        );

      // Écoute admin, seulement s'il y a une organisation active. Le filtre
      // porte sur `org_id` : la RLS de la table décide déjà si j'ai le droit
      // de voir ces lignes, le filtre n'est qu'une réduction de bruit.
      if (activeOrgId) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'organization_join_requests', filter: `org_id=eq.${activeOrgId}` },
          invalidateOrgJoinRequests,
        );
      }

      channel.subscribe();
    } catch (err) {
      console.warn('[realtime] canal org indisponible, repli sur le retour d onglet', err);
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
  }, [userId, activeOrgId, isDemo, queryClient]);
}
