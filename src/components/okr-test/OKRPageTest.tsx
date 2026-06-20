// Page OKR — refonte « test » riche en composants shadcn (desktop).
// Accordion (objectifs) · Progress · Slider (ajuster un KR) · HoverCard ·
// Tooltip · Avatar · Tabs (statut) · Command (recherche) · Badge · ScrollArea ·
// Sheet (création/édition). Réutilise le module okrs (mêmes hooks). OKRPage
// d'origine inchangée.
import { useMemo, useState } from 'react';
import { FlaskConical, Plus, Search, Pencil, Trash2, CheckCircle2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useOkrs, useCreateOkr, useUpdateOkr, useDeleteOkr, useUpdateKeyResult } from '@/modules/okrs';
import { useCategories } from '@/modules/categories';
import { getColorHex } from '@/components/CategoryManager';
import { filterObjectivesByCategory, getProgress, type Objective } from '@/pages/okr/okr-page-logic';
import OKRModalTest from './OKRModalTest';

export default function OKRPageTest() {
  const { data: objectives = [] } = useOkrs();
  const createOkr = useCreateOkr();
  const updateOkr = useUpdateOkr();
  const deleteOkr = useDeleteOkr();
  const updateKeyResult = useUpdateKeyResult();
  const { data: categories = [] } = useCategories();

  const [statusTab, setStatusTab] = useState<'active' | 'done'>('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Objective | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const resolveColor = (color: string) => (color.startsWith('#') ? color : getColorHex(color));
  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const filtered = useMemo(() => {
    const key = statusTab === 'done' ? 'finished' : categoryFilter;
    return filterObjectivesByCategory(objectives, key);
  }, [objectives, statusTab, categoryFilter]);

  const activeCount = objectives.filter((o) => !o.completed).length;
  const doneCount = objectives.filter((o) => o.completed).length;

  const handleUpdateKR = (objectiveId: string, keyResultId: string, newValue: number) => {
    const obj = objectives.find((o) => o.id === objectiveId);
    const kr = obj?.keyResults.find((k) => k.id === keyResultId);
    if (!kr) return;
    updateKeyResult.mutate({ okrId: objectiveId, keyResultId, updates: { currentValue: newValue, completed: newValue >= kr.targetValue } });
  };

  const handleSubmit = (data: Omit<Objective, 'id'>, isEditing: boolean) => {
    if (isEditing && editing) updateOkr.mutate({ id: editing.id, updates: data });
    else createOkr.mutate({ ...data, progress: data.progress || 0, completed: data.completed || false });
    setEditing(null);
  };

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (id: string) => { const o = objectives.find((x) => x.id === id); if (o) { setEditing(o); setSheetOpen(true); } };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-medium">
            <FlaskConical className="size-3.5" aria-hidden="true" /> Mode test
          </div>
          <h1 className="text-3xl font-bold tracking-tight">OKR — Objectifs &amp; Résultats clés</h1>
          <p className="text-muted-foreground mt-1 text-sm">Suis tes objectifs avec des résultats mesurables.</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon-lg" aria-label="Rechercher un objectif" onClick={() => setSearchOpen(true)}>
                <Search aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rechercher (objectifs)</TooltipContent>
          </Tooltip>
          <Button type="button" size="lg" onClick={openCreate}>
            <Plus aria-hidden="true" /> Nouvel objectif
          </Button>
        </div>
      </div>

      {/* Statut (Tabs) + filtre catégories (Badges) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as 'active' | 'done')}>
          <TabsList>
            <TabsTrigger value="active">Actifs <span className="text-muted-foreground ml-1">{activeCount}</span></TabsTrigger>
            <TabsTrigger value="done">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Terminés <span className="text-muted-foreground ml-1">{doneCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {statusTab === 'active' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setCategoryFilter('all')}
            >
              Tous
            </Badge>
            {categories.map((c) => (
              <Badge
                key={c.id}
                variant={categoryFilter === c.id ? 'default' : 'outline'}
                className="cursor-pointer"
                style={categoryFilter === c.id ? { backgroundColor: resolveColor(c.color), borderColor: 'transparent', color: '#fff' } : undefined}
                onClick={() => setCategoryFilter(c.id)}
              >
                {c.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Liste (Accordion) */}
      {filtered.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          Aucun objectif {statusTab === 'done' ? 'terminé' : categoryFilter === 'all' ? '' : 'dans cette catégorie'}.
        </div>
      ) : (
        <Accordion type="multiple" className="border-border bg-card rounded-xl border px-4">
          {filtered.map((obj) => {
            const cat = getCategoryById(obj.category);
            const color = cat ? resolveColor(cat.color) : '#6366f1';
            const progress = getProgress(obj.keyResults);
            return (
              <AccordionItem key={obj.id} value={obj.id}>
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 hover:no-underline">
                    <div className="flex flex-1 items-center gap-3 pr-2">
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback style={{ backgroundColor: color + '22', color }}>
                          {(cat?.name ?? obj.title).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <HoverCard openDelay={150}>
                            <HoverCardTrigger asChild>
                              <span className="truncate font-semibold">{obj.title}</span>
                            </HoverCardTrigger>
                            <HoverCardContent align="start">
                              <p className="mb-1 text-sm font-semibold">{obj.title}</p>
                              {obj.description && <p className="text-muted-foreground mb-2 text-xs">{obj.description}</p>}
                              <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                                <CalendarDays className="size-3" aria-hidden="true" />
                                {new Date(obj.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} →{' '}
                                {new Date(obj.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </HoverCardContent>
                          </HoverCard>
                          {cat && <Badge variant="outline" style={{ borderColor: color + '60', color }}>{cat.name}</Badge>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={progress} className="h-1.5" />
                          <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">{progress}%</span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Modifier" onClick={() => openEdit(obj.id)}>
                          <Pencil aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Modifier</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Supprimer" onClick={() => setDeletingId(obj.id)}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Supprimer</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <AccordionContent>
                  {obj.keyResults.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Aucun résultat clé.</p>
                  ) : (
                    <ScrollArea className={cn(obj.keyResults.length > 4 && 'h-56')}>
                      <div className="grid gap-3 pr-3">
                        {obj.keyResults.map((kr) => {
                          const krPct = kr.targetValue > 0 ? Math.round((kr.currentValue / kr.targetValue) * 100) : 0;
                          return (
                            <div key={kr.id} className="border-border grid gap-2 rounded-lg border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn('text-sm', kr.completed && 'text-muted-foreground line-through')}>{kr.title}</span>
                                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{kr.currentValue} / {kr.targetValue} {kr.unit} · {krPct}%</span>
                              </div>
                              <Slider
                                key={`${kr.id}-${kr.currentValue}`}
                                min={0}
                                max={Math.max(kr.targetValue, 1)}
                                step={1}
                                defaultValue={[Math.min(kr.currentValue, kr.targetValue)]}
                                onValueCommit={(v) => handleUpdateKR(obj.id, kr.id, v[0])}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Sheet création / édition */}
      <OKRModalTest
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditing(null); }}
        categories={categories}
        editingObjective={editing}
        onSubmit={handleSubmit}
      />

      {/* Recherche (Command) */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Rechercher un objectif</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Rechercher un objectif…" />
            <CommandList>
              <CommandEmpty>Aucun objectif trouvé.</CommandEmpty>
              <CommandGroup heading="Objectifs">
                {objectives.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.title}
                    onSelect={() => { setSearchOpen(false); openEdit(o.id); }}
                  >
                    {o.completed ? <CheckCircle2 className="text-emerald-500" aria-hidden="true" /> : <FlaskConical aria-hidden="true" />}
                    <span className="truncate">{o.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet objectif ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {objectives.find((o) => o.id === deletingId)?.title} » et ses résultats clés seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (deletingId) { deleteOkr.mutate(deletingId); setDeletingId(null); } }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
