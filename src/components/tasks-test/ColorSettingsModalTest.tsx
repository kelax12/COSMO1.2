// Gestion des catégories — refonte « test » shadcn (desktop).
// Réutilise useCategories / useCreateCategory / useUpdateCategory / useDeleteCategory.
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/modules/categories';

interface ColorSettingsModalTestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_NEW_COLOR = '#3b82f6';

export default function ColorSettingsModalTest({ open, onOpenChange }: ColorSettingsModalTestProps) {
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    createCategory.mutate(
      { name, color: newColor },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor(DEFAULT_NEW_COLOR);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catégories</DialogTitle>
          <DialogDescription>Crée, renomme ou supprime tes catégories.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[50vh] gap-2 overflow-y-auto py-1">
          {categories.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">Aucune catégorie pour l'instant.</p>
          )}
          {categories.map((c) => (
            <div
              key={c.id}
              className="border-border flex items-center gap-3 rounded-lg border p-2"
            >
              <input
                type="color"
                value={c.color}
                aria-label={`Couleur de ${c.name}`}
                className="size-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                onChange={(e) => updateCategory.mutate({ id: c.id, updates: { color: e.target.value } })}
              />
              <Input
                defaultValue={c.name}
                aria-label={`Nom de ${c.name}`}
                className="h-8"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name) updateCategory.mutate({ id: c.id, updates: { name: v } });
                }}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                aria-label={`Supprimer ${c.name}`}
                onClick={() => deleteCategory.mutate(c.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        {/* Ajouter une catégorie */}
        <div className="border-border grid gap-2 rounded-lg border border-dashed p-3">
          <Label htmlFor="new-cat-name">Nouvelle catégorie</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              aria-label="Couleur de la nouvelle catégorie"
              className="size-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
              onChange={(e) => setNewColor(e.target.value)}
            />
            <Input
              id="new-cat-name"
              value={newName}
              placeholder="Nom de la catégorie"
              className="h-8"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Button type="button" size="sm" disabled={!newName.trim()} onClick={handleAdd}>
              <Plus aria-hidden="true" /> Ajouter
            </Button>
          </div>
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
