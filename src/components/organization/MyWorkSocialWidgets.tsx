import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { AtSign, Check, ExternalLink, Pencil, Pin, Plus, Send, Trash2 } from 'lucide-react';
import { useAddTeamTaskComment, useTeamTaskComments, type TeamTask } from '@/modules/team-projects';
import { useMarkTaskNotificationsRead, type OrgMember, type OrgNotification } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { WidgetSize } from './apercu-widgets';
import { loadNotes, saveNotes, type PinnedNote } from './apercu-new-widgets.helpers';
import { ItemAction, WidgetEmpty, WidgetShell } from './WidgetShell';
import { usePager } from './widget-shell.helpers';

/**
 * Nouveaux widgets de l'Aperçu (2026-10-19) : « Mentions et commentaires »
 * (répondre sans ouvrir la tâche, en grand format) et « Note épinglée »
 * (personnelle, gardée dans ce navigateur).
 */

const PER_PAGE: Record<WidgetSize, number> = { small: 1, medium: 2, large: 1 };
const ago = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { locale: getDateLocale(), addSuffix: true });

/* ─────────────────────────── Mentions et commentaires ──────────────── */

interface MentionRow { notification: OrgNotification; task: TeamTask }

/** Dernier message de l'auteur de la mention, et une réponse sur place. */
const MentionThread = ({ row, nameOf, onReplied, onRead, onOpen }: {
  row: MentionRow; nameOf: (id?: string | null) => string; onReplied: () => void; onRead: () => void; onOpen: () => void;
}) => {
  const { t } = useT('orgAdmin');
  const { data: comments = [] } = useTeamTaskComments(row.task.id);
  const addComment = useAddTeamTaskComment(row.task.id);
  const [draft, setDraft] = useState('');
  const actor = row.notification.actorId;
  const last = [...comments].reverse().find((c) => c.authorId === actor) ?? comments[comments.length - 1];
  const send = () => {
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(
      { body, mentions: actor ? [actor] : [] },
      { onSuccess: () => { setDraft(''); onReplied(); } },
    );
  };
  return (
    <div className="mt-2 space-y-2">
      {last && (
        <blockquote className="rounded-xl bg-[rgb(var(--color-hover))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))] line-clamp-4">
          {last.body}
        </blockquote>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <label className="flex-1 min-w-0">
          <span className="sr-only">{t('apercu.widgets.n.replyTo', { name: nameOf(actor) })}</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('apercu.widgets.n.replyTo', { name: nameOf(actor) })}
            className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
        </label>
        <button
          type="submit"
          disabled={addComment.isPending}
          aria-label={t('apercu.widgets.n.send')}
          className="shrink-0 w-9 h-9 rounded-lg bg-[rgb(var(--color-accent))] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50"
        >
          <Send size={15} aria-hidden="true" />
        </button>
        {/* Envoyer, Lu, Ouvrir la tâche : dans cet ordre, sur la ligne de la réponse. */}
        <ItemAction icon={Check} label={t('apercu.widgets.n.markRead')} onClick={onRead} />
        <ItemAction icon={ExternalLink} label={t('apercu.widgets.n.openTask')} onClick={onOpen} />
      </form>
    </div>
  );
};

interface MentionsWidgetProps {
  size: WidgetSize;
  orgId: string;
  mentions: MentionRow[];
  members: OrgMember[];
  onOpenTask: (task: TeamTask) => void;
}

export const MentionsWidget = ({ size, orgId, mentions, members, onOpenTask }: MentionsWidgetProps) => {
  const { t } = useT('orgAdmin');
  const pager = usePager(mentions, PER_PAGE[size]);
  const markRead = useMarkTaskNotificationsRead(orgId);
  const nameOf = (id?: string | null) => (id && members.find((m) => m.userId === id)?.displayName) || t('activity.someMember');

  return (
    <WidgetShell
      icon={AtSign}
      title={t('apercu.widgets.names.mentions')}
      count={mentions.length}
      countTone={mentions.length > 0 ? 'warning' : 'neutral'}
      pager={pager}
    >
      {mentions.length === 0 ? <WidgetEmpty>{t('apercu.widgets.n.noMentions')}</WidgetEmpty> : (
        <ul className="divide-y divide-[rgb(var(--color-border))]">
          {pager.slice.map((row) => (
            <li key={row.notification.id} className="py-2 first:pt-0 last:pb-0 min-w-0">
              {/* L'élément à gauche, Répondre et Lu sur la même ligne à droite. */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                    <span className="font-semibold">{nameOf(row.notification.actorId)}</span>
                    <span className="text-[rgb(var(--color-text-muted))]"> · {ago(row.notification.createdAt)}</span>
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">{t('apercu.widgets.n.onTask', { name: row.task.name })}</p>
                </div>
                {size !== 'large' && (
                  <>
                    <ItemAction primary hideIcon={size === 'small'} icon={AtSign} label={t('apercu.widgets.c.reply')} onClick={() => onOpenTask(row.task)} />
                    <ItemAction hideIcon={size === 'small'} icon={Check} label={t('apercu.widgets.n.markRead')} onClick={() => markRead.mutate(row.task.id)} />
                  </>
                )}
              </div>
              {size === 'large' && (
                <MentionThread
                  row={row}
                  nameOf={nameOf}
                  onReplied={() => markRead.mutate(row.task.id)}
                  onRead={() => markRead.mutate(row.task.id)}
                  onOpen={() => onOpenTask(row.task)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};

/* ─────────────────────────── Note épinglée ─────────────────────────── */

const NOTE_PER_PAGE: Record<WidgetSize, number> = { small: 1, medium: 1, large: 3 };
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

export const NoteWidget = ({ size, orgId, userId }: { size: WidgetSize; orgId: string; userId: string }) => {
  const { t } = useT('orgAdmin');
  const [notes, setNotes] = useState<PinnedNote[]>(() => loadNotes(orgId, userId));
  useEffect(() => { setNotes(loadNotes(orgId, userId)); }, [orgId, userId]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const pager = usePager(notes, NOTE_PER_PAGE[size]);

  const commit = (next: PinnedNote[]) => { setNotes(next); saveNotes(orgId, userId, next); };
  const startEdit = (note: PinnedNote) => { setEditing(note.id); setDraft(note.text); };
  const add = () => {
    const note = { id: newId(), text: '', updatedAt: new Date().toISOString() };
    commit([note, ...notes]);
    startEdit(note);
  };
  const save = (id: string) => {
    const text = draft.trim();
    commit(text
      ? notes.map((n) => (n.id === id ? { ...n, text, updatedAt: new Date().toISOString() } : n))
      : notes.filter((n) => n.id !== id));
    setEditing(null);
  };
  const remove = (id: string) => { commit(notes.filter((n) => n.id !== id)); setEditing(null); };

  return (
    <WidgetShell
      icon={Pin}
      title={t('apercu.widgets.names.note')}
      count={notes.length > 1 ? notes.length : undefined}
      pager={pager}
      headerAction={(
        <button
          type="button"
          onClick={add}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-sm font-semibold text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent)/0.1)]"
        >
          <Plus size={15} aria-hidden="true" />
          {t('apercu.widgets.n.newNote')}
        </button>
      )}
    >
      {notes.length === 0 ? <WidgetEmpty>{t('apercu.widgets.n.noNote')}</WidgetEmpty> : (
        <ul className="space-y-2.5">
          {pager.slice.map((note) => (
            <li key={note.id} className="rounded-xl bg-amber-500/15 px-3 py-2.5">
              {editing === note.id ? (
                <form onSubmit={(e) => { e.preventDefault(); save(note.id); }} className="space-y-2">
                  <label>
                    <span className="sr-only">{t('apercu.widgets.n.noteText')}</span>
                    <textarea
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={size === 'small' ? 3 : 4}
                      className="w-full resize-none rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2.5 py-2 text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
                    />
                  </label>
                  <div className="flex gap-1.5">
                    <button type="submit" className="h-9 px-3 rounded-lg bg-[rgb(var(--color-accent))] text-xs font-semibold text-white hover:opacity-90">
                      {t('apercu.widgets.n.saveNote')}
                    </button>
                    <ItemAction iconOnly icon={Trash2} label={t('apercu.widgets.n.deleteNote')} onClick={() => remove(note.id)} />
                  </div>
                </form>
              ) : (
                <>
                  {/* Une seule ligne : la note, puis « modifier » et la date (2026-10-20). */}
                  <div className="flex items-start gap-2">
                    <p className={`flex-1 min-w-0 whitespace-pre-line text-sm text-amber-900 dark:text-amber-100 ${size === 'small' ? 'line-clamp-4' : 'line-clamp-6'}`}>{note.text}</p>
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      aria-label={t('apercu.widgets.n.editNote')}
                      title={t('apercu.widgets.n.editNote')}
                      className="shrink-0 w-7 h-7 -mt-0.5 rounded-lg flex items-center justify-center text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <span className="shrink-0 text-xs leading-5 text-amber-800/80 dark:text-amber-200/80 whitespace-nowrap">{ago(note.updatedAt)}</span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
};
