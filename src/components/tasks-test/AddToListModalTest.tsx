// Ajouter une tâche à des listes — refonte « test » shadcn (desktop).
// Réutilise useLists / useAddTaskToList / useRemoveTaskFromList / useCreateList.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useLists,
  useAddTaskToList,
  useRemoveTaskFromList,
  useCreateList,
} from '@/modules/lists';

interface AddToListModalTestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
}

const NEW_LIST_COLOR = '#6366f1';

export default function AddToListModalTest({ open, onOpenChange, taskId }: AddToListModalTestProps) {
  const { data: lists = [] } = useLists();
  const addToList = useAddTaskToList();
  const removeFromList = useRemoveTaskFromList();
  const createList = useCreateList();

  const [newName, setNewName] = useState('');

  // Seules les listes manuelles peuvent contenir explicitement une tâche.
  const manualLists = lists.filter((l) => l.type !== 'smart');

  const toggle = (listId: string, checked: boolean) => {
    if (!taskId) return;
    if (checked) addToList.mutate({ taskId, listId });
    else removeFromList.mutate({ taskId, listId });
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createList.mutate(
      { name, color: NEW_LIST_COLOR, type: 'manual' },
      {
        onSuccess: (created) => {
          setNewName('');
          if (taskId) addToList.mutate({ taskId, listId: created.id });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter à une liste</DialogTitle>
          <DialogDescription>Sélectionne les listes qui contiennent cette tâche.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[45vh] gap-1 overflow-y-auto py-1">
          {manualLists.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">Aucune liste manuelle.</p>
          )}
          {manualLists.map((l) => {
            const checked = !!taskId && l.taskIds.includes(taskId);
            return (
              <label
                key={l.id}
                className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2"
              >
                <Checkbox checked={checked} onCheckedChange={(c) => toggle(l.id, c === true)} />
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="text-sm">{l.name}</span>
              </label>
            );
          })}
        </div>

        <div className="border-border flex items-center gap-2 rounded-lg border border-dashed p-2">
          <Input
            value={newName}
            placeholder="Nouvelle liste…"
            className="h-8"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <Button type="button" size="sm" disabled={!newName.trim()} onClick={handleCreate}>
            <Plus aria-hidden="true" /> Créer
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
