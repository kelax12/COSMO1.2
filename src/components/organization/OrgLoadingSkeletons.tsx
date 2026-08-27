import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholders de chargement du mode entreprise.
 *
 * Ils existent pour une raison précise, pas pour l'esthétique : les onglets
 * Aperçu, Tâches et Statistiques déstructuraient `const { data = [] }` sans
 * jamais lire `isLoading`. Pendant le premier fetch, ils rendaient donc leur
 * état VIDE comme s'il s'agissait de la vérité — « Aucune tâche pour
 * l'instant », « Créez d'abord un projet », et surtout un tableau de bord
 * annonçant 0 tâche / 0 % à un manager avant d'afficher ses vrais chiffres.
 * Un zéro faux coûte plus cher qu'une attente : c'est l'image dont on se
 * souvient.
 *
 * Même parti pris que le reste de l'app (`src/components/skeletons`) : un
 * squelette plutôt qu'un spinner, parce qu'il donne un aperçu de la structure
 * à venir et se perçoit plus rapide.
 *
 * ⚠️ Le `label` est TRADUIT par l'appelant. Ces composants vivent dans une
 * zone bilingue ; un `aria-label` en dur ici parlerait français à un lecteur
 * d'écran anglophone.
 */

/** Bloc inerte : gris neutre, jamais `bg-accent` (bleu vif dans 3 thèmes sur 4). */
const Bar = ({ className }: { className?: string }) => (
  <Skeleton className={`bg-[rgb(var(--color-hover))] ${className ?? ''}`} />
);

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
    {children}
  </div>
);

/** Lignes d'une liste de tâches (case, titre, pastille, date). */
const RowList = ({ count }: { count: number }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-2.5 py-1.5">
        <Bar className="w-6 h-6 rounded-md shrink-0" />
        <Bar className="h-4 flex-1 max-w-[70%]" />
        <Bar className="h-4 w-16 rounded-full shrink-0" />
      </div>
    ))}
  </div>
);

/** Onglet Aperçu : carte de synthèse, puis les deux colonnes. */
export function MyWorkSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-5" role="status" aria-label={label}>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <Bar className="h-5 w-40" />
            <Bar className="h-2.5 w-full rounded-full" />
            <div className="flex gap-4">
              <Bar className="h-3 w-20" />
              <Bar className="h-3 w-20" />
              <Bar className="h-3 w-20" />
            </div>
          </div>
          <Bar className="w-[130px] h-16 rounded-xl shrink-0 hidden sm:block" />
        </div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <Card>
          <Bar className="h-4 w-32 mb-3" />
          <RowList count={4} />
        </Card>
        <Card>
          <Bar className="h-4 w-28 mb-3" />
          <RowList count={3} />
        </Card>
      </div>
    </div>
  );
}

/** Onglet Tâches : la zone de contenu sous la barre d'outils (table ou message). */
export function TeamTasksSkeleton({ label }: { label: string }) {
  return (
    <Card>
      <div role="status" aria-label={label}>
        <Bar className="h-4 w-full mb-4" />
        <RowList count={6} />
      </div>
    </Card>
  );
}

/**
 * Attente d'un onglet dont le code n'est pas encore arrivé (fallback Suspense
 * des onglets chargés à la demande, cf. `OrganizationPage`). Volontairement
 * neutre : on ne sait pas encore quelle forme aura l'écran, on n'en promet
 * donc aucune.
 */
export function OrgTabSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <div className="flex gap-2">
        <Bar className="h-9 w-28 rounded-lg" />
        <Bar className="h-9 w-28 rounded-lg" />
        <Bar className="h-9 w-20 rounded-lg" />
      </div>
      <Card>
        <Bar className="h-4 w-40 mb-4" />
        <RowList count={5} />
      </Card>
    </div>
  );
}

/** Onglet Statistiques : les tuiles de chiffres, puis les graphiques. */
export function TeamOverviewSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-5" role="status" aria-label={label}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Bar className="h-3 w-20 mb-3" />
            <Bar className="h-7 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <Bar className="h-4 w-36 mb-4" />
            <Bar className="h-[180px] w-full rounded-xl" />
          </Card>
        ))}
      </div>
    </div>
  );
}
