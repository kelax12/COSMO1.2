// ═══════════════════════════════════════════════════════════════════
// BugReportModal — « Signaler un bug » (icône insecte de la navigation)
// ═══════════════════════════════════════════════════════════════════
//
// Trois champs : un titre, une description, une pièce jointe facultative
// (capture d'écran, PDF ou log). L'envoi passe par l'Edge Function
// `report-bug`, qui expédie le tout à l'adresse de contact.
//
// Deux garde-fous portés par ce fichier :
//
//   • L'écran de remerciement est un ÉTAT, pas un simple toast : le toast
//     disparaît en 4 s et un utilisateur qui a joint un fichier veut une
//     confirmation qui reste à l'écran.
//   • Si l'Edge Function n'est pas configurée (503 `mail_not_configured`) ou
//     injoignable, on n'affiche pas « échec » sans issue : on propose le lien
//     mailto vers la même adresse, formulaire pré-rempli en objet.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bug, Paperclip, Loader2, CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { CONTACT_EMAIL } from '@/lib/contact.mjs';
import {
  ATTACHMENT_ACCEPT,
  BUG_REPORT_LIMITS,
  collectBugContext,
  fileToBase64,
  validateBugReport,
  type BugReportField,
} from '@/lib/bug-report';
import { useT } from '@/i18n/useT';

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClasses =
  'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40 transition-all';

const primaryBtn =
  'w-full py-3 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 transition-all inline-flex items-center justify-center gap-2';

const BugReportModal: React.FC<BugReportModalProps> = ({ open, onOpenChange }) => {
  // ⚠️ Namespace `bugReport` et non `common` : `common` est eager (chunk
  // d'entree) et ces libelles ne servent qu'a ceux qui ouvrent ce formulaire.
  // La route qui le monte doit declarer 'bugReport' dans App.tsx.
  const { t } = useT('bugReport');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldError, setFieldError] = useState<BugReportField | null>(null);
  const [mailFallback, setMailFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Réinitialise à chaque ouverture : rouvrir la fenêtre après un envoi doit
  // proposer un formulaire vierge, pas l'écran de remerciement précédent.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setFile(null);
    setSent(false);
    setSending(false);
    setFieldError(null);
    setMailFallback(false);
  }, [open]);

  const close = () => onOpenChange(false);

  // Échap ferme la fenêtre — sauf pendant l'envoi, où fermer perdrait la
  // saisie sans savoir si le mail est parti.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sending]);

  const mailtoHref =
    `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[Bug] ${title.trim()}`)}` +
    `&body=${encodeURIComponent(description.trim())}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const invalid = validateBugReport({ title, description, attachment: file });
    if (invalid) {
      setFieldError(invalid);
      return;
    }
    setFieldError(null);
    setSending(true);

    try {
      const attachment = file
        ? { name: file.name, type: file.type, content: await fileToBase64(file) }
        : undefined;

      const { error } = await supabase.functions.invoke('report-bug', {
        body: {
          title: title.trim(),
          description: description.trim(),
          context: collectBugContext(),
          ...(attachment ? { attachment } : {}),
        },
      });

      if (error) throw error;

      setSent(true);
      toast.success(t('toastSuccess'));
    } catch {
      // Aucune issue morte : on bascule sur le lien mailto vers la même
      // adresse plutôt que d'afficher « erreur » et rien d'autre.
      setMailFallback(true);
      toast.error(t('toastError'));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const errorMessage = fieldError
    ? fieldError === 'title'
      ? t('errors.title', { min: BUG_REPORT_LIMITS.titleMin, max: BUG_REPORT_LIMITS.titleMax })
      : fieldError === 'description'
        ? t('errors.description', {
            min: BUG_REPORT_LIMITS.descriptionMin,
            max: BUG_REPORT_LIMITS.descriptionMax,
          })
        : t('errors.attachment', { max: BUG_REPORT_LIMITS.attachmentMaxBytes / (1024 * 1024) })
    : null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm overflow-y-auto"
        onClick={() => !sending && close()}
        role="presentation"
      >
        {/* C-56 — `items-center` ET `overflow-y-auto` sur le MEME element est
            le piege CSS classique : quand l'enfant depasse, le debordement se
            repartit DES DEUX COTES, et la partie qui sort par le haut n'entre
            pas dans `scrollHeight`. `scrollTop` etant borne a zero, aucun geste
            ne la ramene. Mesure a 375x350 (viewport Android clavier ouvert) :
            haut de la carte a -55,8 px, et le defilement l'ELOIGNE encore. Le
            scroll appartient donc au conteneur, le centrage a un enfant
            `min-h-full` — apres correctif, +16 px, atteignable. */}
        <div className="flex min-h-full items-center justify-center p-4">
        <motion.div
          // La position vient du CSS (centrage flex), l'animation ne porte que
          // sur l'opacité et l'échelle : sous prefers-reduced-motion la valeur
          // `initial` reste appliquée, un décalage en `y` laisserait la modale
          // hors écran (cf. garde-fou animations, CLAUDE.md).
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="w-full max-w-xl my-auto rounded-3xl bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] shadow-2xl overflow-hidden"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[rgb(var(--color-border))]">
            <h2 className="text-base sm:text-lg font-bold text-[rgb(var(--color-text-primary))] inline-flex items-center gap-2">
              <Bug size={18} className="text-red-500" aria-hidden="true" />
              {t('title')}
            </h2>
            <button
              type="button"
              onClick={close}
              disabled={sending}
              aria-label={t('close')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] transition-colors disabled:opacity-40"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {sent ? (
            /* Remerciement — état persistant, pas un toast. */
            <div className="px-5 sm:px-6 py-10 flex flex-col items-center text-center gap-3">
              <CheckCircle2 size={40} className="text-green-500" aria-hidden="true" />
              <p className="text-base font-semibold text-[rgb(var(--color-text-primary))]">
                {t('successTitle')}
              </p>
              <p className="text-sm text-[rgb(var(--color-text-secondary))] max-w-sm">
                {t('successBody')}
              </p>
              <button type="button" onClick={close} className={`${primaryBtn} mt-2 max-w-[200px]`}>
                {t('done')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-5 sm:px-6 py-5 flex flex-col gap-4">
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                {t('intro')}
              </p>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bug-title" className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
                  {t('fields.title')}
                </label>
                <input
                  id="bug-title"
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setFieldError(null); }}
                  maxLength={BUG_REPORT_LIMITS.titleMax}
                  placeholder={t('placeholders.title')}
                  className={inputClasses}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="bug-description" className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
                  {t('fields.description')}
                </label>
                <textarea
                  id="bug-description"
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setFieldError(null); }}
                  maxLength={BUG_REPORT_LIMITS.descriptionMax}
                  rows={6}
                  placeholder={t('placeholders.description')}
                  className={`${inputClasses} resize-y min-h-[120px]`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-secondary))]">
                  {t('fields.attachment')}
                </span>
                {/* L'input natif est masqué mais reste focalisable au clavier :
                    c'est lui qui porte le libellé accessible du bouton. */}
                <input
                  ref={fileInputRef}
                  id="bug-attachment"
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  className="sr-only"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFieldError(null); }}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <label
                    htmlFor="bug-attachment"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] transition-colors"
                  >
                    <Paperclip size={16} aria-hidden="true" />
                    {t('chooseFile')}
                  </label>
                  {file ? (
                    <span className="text-sm text-[rgb(var(--color-text-secondary))] inline-flex items-center gap-2 min-w-0">
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        aria-label={t('removeFile')}
                        className="text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-[rgb(var(--color-text-muted))]">
                      {t('attachmentHint', { max: BUG_REPORT_LIMITS.attachmentMaxBytes / (1024 * 1024) })}
                    </span>
                  )}
                </div>
              </div>

              {errorMessage && (
                <p role="alert" className="text-sm text-red-500">{errorMessage}</p>
              )}

              {mailFallback && (
                <p role="alert" className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {t('fallback')}{' '}
                  <a href={mailtoHref} className="text-[rgb(var(--color-accent))] underline underline-offset-2">
                    {CONTACT_EMAIL}
                  </a>
                </p>
              )}

              <button type="submit" disabled={sending} className={primaryBtn}>
                {sending
                  ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  : <Send size={16} aria-hidden="true" />}
                {sending ? t('sending') : t('submit')}
              </button>
            </form>
          )}
        </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default BugReportModal;
