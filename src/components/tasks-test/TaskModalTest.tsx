// Modal Créer / Éditer une tâche — refonte « test » 100% shadcn (desktop).
// Réutilise EXACTEMENT les mêmes hooks que TaskModal : useCreateTask /
// useUpdateTask / useDeleteTask / useCategories. Aucune logique métier nouvelle.
import { useEffect, useState } from 'react';
import { Trash2, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTask, useUpdateTask, useDeleteTask, type Task } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { PRIORITY_OPTIONS, isoToLocalInput, localInputToIso, todayEodIso } from './helpers';

interface TaskModalTestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si présent → mode édition ; sinon → mode création. */
  task?: Task | null;
  /** Ouvre le gestionnaire de catégories (ColorSettingsModalTest). */
  onManageCategories?: () => void;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  priority: number;
  deadline: string; // valeur datetime-local
  estimatedTime: number;
  bookmarked: boolean;
  completed: boolean;
}

const emptyForm = (defaultCategory: string): FormState => ({
  name: '',
  description: '',
  category: defaultCategory,
  priority: 3,
  deadline: isoToLocalInput(todayEodIso()),
  estimatedTime: 30,
  bookmarked: false,
  completed: false,
});

export default function TaskModalTest({ open, onOpenChange, task, onManageCategories }: TaskModalTestProps) {
  const { data: categories = [] } = useCategories();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const isEdit = !!task;
  const [form, setForm] = useState<FormState>(emptyForm(categories[0]?.id ?? ''));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // (Ré)initialise le formulaire à chaque ouverture / changement de tâche.
  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        name: task.name,
        description: task.description ?? '',
        category: task.category,
        priority: task.priority || 3,
        deadline: isoToLocalInput(task.deadline),
        estimatedTime: task.estimatedTime ?? 30,
        bookmarked: task.bookmarked,
        completed: task.completed,
      });
    } else {
      setForm(emptyForm(categories[0]?.id ?? ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSave = form.name.trim().length > 0;
  const isPending = createTask.isPending || updateTask.isPending;

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      priority: form.priority,
      deadline: form.deadline ? localInputToIso(form.deadline) : todayEodIso(),
      estimatedTime: Number(form.estimatedTime) || 0,
      bookmarked: form.bookmarked,
      completed: form.completed,
    };
    if (isEdit && task) {
      updateTask.mutate(
        { id: task.id, updates: payload },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createTask.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleDelete = () => {
    if (!task) return;
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Mets à jour les détails de cette tâche.' : 'Ajoute une nouvelle tâche à ta liste.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Nom */}
          <div className="grid gap-2">
            <Label htmlFor="task-name">Nom</Label>
            <Input
              id="task-name"
              value={form.name}
              autoFocus
              placeholder="Ex. Préparer la présentation"
              onChange={(e) => set('name', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSave) handleSave();
              }}
            />
          </div>

          {/* Catégorie + priorité */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="task-category">Catégorie</Label>
                {onManageCategories && (
                  <button
                    type="button"
                    onClick={onManageCategories}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                  >
                    <Settings2 className="size-3" aria-hidden="true" /> Gérer
                  </button>
                )}
              </div>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger id="task-category" className="w-full">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-priority">Priorité</Label>
              <Select value={String(form.priority)} onValueChange={(v) => set('priority', Number(v))}>
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Échéance + durée */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="task-deadline">Échéance</Label>
              <Input
                id="task-deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-time">Durée estimée (min)</Label>
              <Input
                id="task-time"
                type="number"
                min={0}
                step={5}
                value={form.estimatedTime}
                onChange={(e) => set('estimatedTime', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              rows={3}
              value={form.description}
              placeholder="Détails (facultatif)…"
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.bookmarked}
                onCheckedChange={(c) => set('bookmarked', c === true)}
              />
              Favori
            </label>
            {isEdit && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={form.completed}
                  onCheckedChange={(c) => set('completed', c === true)}
                />
                Terminée
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden="true" /> Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="button" size="lg" disabled={!canSave || isPending} onClick={handleSave}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation suppression */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La tâche « {task?.name} » sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
