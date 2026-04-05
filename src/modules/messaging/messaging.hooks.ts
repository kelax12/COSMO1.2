// ═══════════════════════════════════════════════════════════════════
// MESSAGING MODULE — Hooks React Query
// ═══════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { useEffect } from 'react';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  taskId?: string;
  createdAt: string;
}

const msgKeys = {
  all: ['chat_messages'] as const,
  conversation: (partnerId: string) => ['chat_messages', 'conv', partnerId] as const,
};

/**
 * Récupère les messages d'une conversation (avec un ami ou groupe)
 */
export const useConversationMessages = (partnerId: string) => {
  return useQuery({
    queryKey: msgKeys.conversation(partnerId),
    queryFn: async () => {
      if (!supabase || !partnerId) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${partnerId}),and(receiver_id.eq.${partnerId})`)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw normalizeApiError(error);
      return (data || []).map(row => ({
        id: row.id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        content: row.content,
        read: row.read,
        taskId: row.task_id,
        createdAt: row.created_at,
      })) as ChatMessage[];
    },
    enabled: !!partnerId,
    staleTime: 1000 * 30, // 30 secondes
  });
};

/**
 * Envoie un message
 */
export const useSendChatMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ receiverId, content, taskId }: { receiverId: string; content: string; taskId?: string }) => {
      if (!supabase) throw new Error('Supabase not configured');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{ sender_id: user.id, receiver_id: receiverId, content, task_id: taskId ?? null }])
        .select()
        .single();
      if (error) throw normalizeApiError(error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: msgKeys.conversation(variables.receiverId) });
    },
  });
};

/**
 * Abonnement Realtime — rafraîchit automatiquement quand un message arrive
 */
export const useMessagingRealtime = (partnerId: string) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase || !partnerId) return;
    const channel = supabase
      .channel(`messages-${partnerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `receiver_id=eq.${partnerId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: msgKeys.conversation(partnerId) });
      })
      .subscribe();
    return () => { supabase!.removeChannel(channel); };
  }, [partnerId, queryClient]);
};
