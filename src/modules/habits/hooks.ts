import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getHabitsRepository } from '@/lib/repository.factory';
import { IHabitsRepository } from './repository';
import { CreateHabitInput, UpdateHabitInput } from './types';
import { habitKeys } from './constants';

// Repository - Via centralized factory (demo/production mode)
const useHabitsRepository = (): IHabitsRepository => {
  return useMemo(() => getHabitsRepository(), []);
};

/**
 * Fetch all habits
 */
export const useHabits = () => {
  const repository = useHabitsRepository();
  return useQuery({
    queryKey: habitKeys.lists(),
    queryFn: () => repository.fetchHabits(),
    staleTime: 1000 * 60 * 2, // 2 minutes — les habitudes se cochent souvent
  });
};

/**
 * Fetch a single habit by ID
 */
export const useHabit = (id: string) => {
  const repository = useHabitsRepository();
  return useQuery({
    queryKey: habitKeys.detail(id),
    queryFn: () => repository.getById(id),
    enabled: !!id,
  });
};
/**
 * Create a new habit
 */
export const useCreateHabit = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: (input: CreateHabitInput) => repository.createHabit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(`Impossible de créer l'habitude : ${error.message}`);
    },
  });
};

/**
 * Update an existing habit
 */
export const useUpdateHabit = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateHabitInput }) =>
      repository.updateHabit(id, updates),
    onSuccess: (_, { id }) => {
      // Invalidate both the list and the specific detail
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(id) });
    },
  });
};

/**
 * Delete a habit
 */
export const useDeleteHabit = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: (id: string) => repository.deleteHabit(id),
    onSuccess: (_, id) => {
      // Invalidate the list and remove the specific detail from cache
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
      queryClient.removeQueries({ queryKey: habitKeys.detail(id) });
    },
  });
};

/**
 * Toggle habit completion for a specific date
 */
export const useToggleHabitCompletion = () => {
  const queryClient = useQueryClient();
  const repository = useHabitsRepository();
  
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      repository.toggleCompletion(id, date),
    onSuccess: (_, { id }) => {
      // Only invalidate the specific habit and the list
      queryClient.invalidateQueries({ queryKey: habitKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() });
    },
  });
};
