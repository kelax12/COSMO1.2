import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useT } from '@/i18n/useT';
import { OBJECT_TERMS, ROLE_TERMS, termDefKey, termNameKey, type OrgTerm } from './org-glossary';

/** Le glossaire de l'entreprise : chaque rôle, chaque objet, une définition. */
const OrgGlossarySheet = ({ focusTerm, onClose }: { focusTerm?: OrgTerm; onClose: () => void }) => {
  // Titres et définitions : catalogue `orgAccount`, chargé avec cette feuille.
  const { t: ta } = useT('orgAccount');
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({ open: true, onClose, label: ta('glossary.title') });
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const section = (titleKey: 'glossary.sectionRoles' | 'glossary.sectionObjects', terms: readonly OrgTerm[]) => (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">{ta(titleKey)}</h3>
      <dl className="space-y-3">
        {terms.map((term) => (
          <div
            key={term}
            ref={term === focusTerm ? focusRef : undefined}
            className={`rounded-xl border p-3 ${term === focusTerm ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.06)]' : 'border-[rgb(var(--color-border))]'}`}
          >
            <dt className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{ta(termNameKey(term))}</dt>
            <dd className="text-xs leading-relaxed text-[rgb(var(--color-text-secondary))] mt-1">{ta(termDefKey(term))}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full sm:max-w-lg max-h-[88vh] rounded-t-[28px] sm:rounded-2xl shadow-2xl overflow-hidden bg-[rgb(var(--color-surface))]"
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2 border-b border-[rgb(var(--color-border))]">
          <h2 className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-[rgb(var(--color-text-primary))]">
            <BookOpen size={18} aria-hidden="true" /> {ta('glossary.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={ta('glossary.close')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 bg-[rgb(var(--color-background))]">
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">{ta('glossary.intro')}</p>
          {section('glossary.sectionRoles', ROLE_TERMS)}
          {section('glossary.sectionObjects', OBJECT_TERMS)}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OrgGlossarySheet;
