// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — hooks du chat de projet (mig. 220). Données : `messages.repository.ts`.
// ═══════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { translator } from '@/i18n/useT';
import { teamProjectKeys } from './constants';
import { addProjectMessage, deleteProjectMessage, getProjectMessages } from './messages.repository';

const messagesKey = (projectId: string) => [...teamProjectKeys.all, 'messages', projectId] as const;

export const useProjectMessages = (projectId: string | undefined) =>
  useQuery({
    queryKey: messagesKey(projectId ?? ''),
    queryFn: () => getProjectMessages(projectId as string),
    enabled: !!projectId,
    staleTime: 1000 * 10,
    // Pas de Realtime : un fil de projet tolère quelques secondes de retard.
    refetchInterval: 1000 * 20,
    refetchOnWindowFocus: true,
  });

export const useAddProjectMessage = (orgId: string, projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addProjectMessage(orgId, projectId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagesKey(projectId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.addComment', { message: error.message })),
  });
};

export const useDeleteProjectMessage = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectMessage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagesKey(projectId) }),
    onError: (error: Error) => toast.error(translator('errors').t('mutation.deleteComment', { message: error.message })),
  });
};
