import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

interface Item<Id extends string> { id: Id; icon: LucideIcon; label: string }

interface Props<Id extends string> {
  groups: { label: string; items: Item<Id>[] }[];
  danger: Item<Id>;
  onOpen: (id: Id) => void;
}

/**
 * Paramètres de l'entreprise sur MOBILE (maquettes 295 et 303, 2026-10-11).
 *
 * Les rubriques défilaient en pastilles à icône et la plupart étaient hors
 * champ. C'est désormais la même liste groupée que les Paramètres perso
 * (maquette 205) ; la rubrique sensible (quitter, supprimer) ferme la liste,
 * en texte rouge.
 */
function MobileOrgSettingsHome<Id extends string>({ groups, danger, onOpen }: Props<Id>) {
  const row = (item: Item<Id>, isDanger = false) => (
    <li key={item.id} className="border-b last:border-b-0 border-[rgb(var(--color-border))]">
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className={`w-full flex items-center gap-3 min-h-touch py-2 text-left text-body active:bg-[rgb(var(--color-hover))] ${
          isDanger ? 'text-[rgb(var(--color-danger-text))]' : 'text-[rgb(var(--color-text-primary))]'
        }`}
      >
        {!isDanger && <item.icon size={19} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />}
        <span className="flex-1 min-w-0 truncate">{item.label}</span>
        {!isDanger && <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />}
      </button>
    </li>
  );
  return (
    <div className="md:hidden pb-4">
      {groups.map((g) => (
        <section key={g.label} className="mt-4 first:mt-0">
          <h2 className="px-1 pb-1.5 text-label font-semibold text-[rgb(var(--color-text-muted))]">{g.label}</h2>
          <ul className="rounded-2xl bg-[rgb(var(--color-surface))] px-4">{g.items.map((i) => row(i))}</ul>
        </section>
      ))}
      <ul className="mt-5 rounded-2xl bg-[rgb(var(--color-surface))] px-4">{row(danger, true)}</ul>
    </div>
  );
}

export const MobileOrgSettingsBack = ({ label, onBack }: { label: string; onBack: () => void }) => (
  <button type="button" onClick={onBack} className="md:hidden -ml-2 mb-3 inline-flex items-center gap-1 min-h-touch pr-3 text-body text-[rgb(var(--color-accent))]">
    <ChevronLeft size={20} aria-hidden="true" />
    {label}
  </button>
);

export default MobileOrgSettingsHome;
