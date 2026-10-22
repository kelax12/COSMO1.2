// Contenu de l'info-bulle d'un terme : chargé à la PREMIÈRE ouverture, avec le
// catalogue `orgAccount` où vivent les définitions (cf. `org-glossary.ts`).
import { useT } from '@/i18n/useT';
import { termDefKey, termNameKey, type OrgTerm } from './org-glossary';

const RoleTermCard = ({ term, onOpenGlossary }: { term: OrgTerm; onOpenGlossary: () => void }) => {
  const { t: ta } = useT('orgAccount');
  return (
    <>
      <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-1">{ta(termNameKey(term))}</p>
      <p className="leading-relaxed">{ta(termDefKey(term))}</p>
      <button
        type="button"
        onClick={onOpenGlossary}
        className="mt-2 text-xs font-semibold text-[rgb(var(--color-accent))] hover:underline"
      >
        {ta('glossary.seeAll')}
      </button>
    </>
  );
};

export default RoleTermCard;
