import { Suspense, useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useT } from '@/i18n/useT';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { claimFirstSight, releaseFirstSight, type OrgTerm } from './org-glossary';

const RoleTermCard = lazyWithRetry(() => import('./RoleTermCard'), ['org', 'orgAccount']);
const OrgGlossarySheet = lazyWithRetry(() => import('./OrgGlossarySheet'), ['org', 'orgAccount']);

/**
 * Un rôle (ou un objet) nommé à l'écran, avec sa définition à portée de clic.
 *
 * Au PREMIER affichage de ce terme sur l'appareil, la définition s'ouvre
 * d'elle-même, une fois (cf. `claimFirstSight`). Ensuite, le « ? » suffit.
 */
const RoleTerm = ({ term, children, label, className = '' }: {
  term: OrgTerm;
  /** Libellé affiché avant le « ? ». Absent : le « ? » seul (à côté d'un bouton,
   *  jamais DANS un bouton : deux contrôles imbriqués). */
  children?: string;
  /** Nom du terme pour le lecteur d'écran quand rien n'est affiché. */
  label?: string;
  className?: string;
}) => {
  const { t } = useT('org');
  const [open, setOpen] = useState(false);
  // « Voir tout le glossaire » : la feuille s'ouvre d'ici, sur ce terme.
  const [glossary, setGlossary] = useState(false);
  const [firstSight, setFirstSight] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // 🔴 Jamais par-dessus une surface modale qui ne la contient pas. La bulle
    // est en `z-[10001]` (elle doit passer au-dessus des fiches qui l'hébergent) :
    // ouverte pendant qu'une feuille est montée AILLEURS, elle s'y posait dessus
    // et prenait ses appuis. Mesuré le 2026-10-02 sur /entreprise/members à
    // 375 px : sélecteur de section ouvert AVANT que l'annuaire ne rende ses
    // rôles, la bulle « Administrateur » couvrait la feuille et le tap sur
    // « OKR » tombait sur elle (cas e2e intermittent de demo-entreprise).
    // Le premier affichage n'est alors PAS consommé : il attendra le suivant.
    const elsewhere = [...document.querySelectorAll('[aria-modal="true"]')]
      .some((modal) => !modal.contains(anchor.current));
    if (elsewhere) return;
    if (claimFirstSight(term)) { setFirstSight(true); setOpen(true); }
  }, [term]);
  // La bulle de premier affichage refermée (ou démontée) laisse la place à la suivante.
  useEffect(() => {
    if (firstSight && !open) releaseFirstSight();
    return () => { if (firstSight) releaseFirstSight(); };
  }, [firstSight, open]);
  // Le libellé affiché nomme le terme : la définition, elle, se charge à l'ouverture.
  const name = children ?? label ?? '';

  return (
    <span ref={anchor} className={`inline-flex items-center gap-0.5 ${className}`}>
      {children}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={t('glossary.termHelp', { term: name })}
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-current opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
          >
            <HelpCircle size={11} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[10001] w-72 text-xs normal-case tracking-normal font-normal bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))]"
          onClick={(e) => e.stopPropagation()}
        >
          <Suspense fallback={<p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{name}</p>}>
            <RoleTermCard term={term} onOpenGlossary={() => { setOpen(false); setGlossary(true); }} />
          </Suspense>
        </PopoverContent>
      </Popover>
      {glossary && (
        <Suspense fallback={null}>
          <OrgGlossarySheet focusTerm={term} onClose={() => setGlossary(false)} />
        </Suspense>
      )}
    </span>
  );
};

export default RoleTerm;
