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
const MentionThread = ({ row, nameOf, onReplied }: { row: MentionRow; nameOf: (id?: string | null) => string; onReplied: () => void }) => {
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
        <ul className="space-y-3">
          {pager.slice.map((row) => (
            <li key={row.notification.id} className="min-w-0">
              <p className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                <span className="font-semibold">{nameOf(row.notification.actorId)}</span>
                <span className="text-[rgb(var(--color-text-muted))]"> · {ago(row.notification.createdAt)}</span>
              </p>
              <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">{t('apercu.widgets.n.onTask', { name: row.task.name })}</p>
              {size === 'large' && <MentionThread row={row} nameOf={nameOf} onReplied={() => markRead.mutate(row.task.id)} />}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {size !== 'large' && (
                  <ItemAction primary icon={AtSign} label={t('apercu.widgets.c.reply')} onClick={() => onOpenTask(row.task)} />
                )}
                {size === 'large' && (
                  <ItemAction icon={ExternalLink} label={t('apercu.widgets.n.openTask')} onClick={() => onOpenTask(row.task)} />
                )}
                <ItemAction icon={Check} label={t('apercu.widgets.n.markRead')} onClick={() => markRead.mutate(row.task.id)} />
              </div>
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
      actions={<ItemAction icon={Plus} label={t('apercu.widgets.n.newNote')} iconOnly={size === 'small'} onClick={add} />}
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
                  <p className={`whitespace-pre-line text-sm text-amber-900 dark:text-amber-100 ${size === 'small' ? 'line-clamp-4' : 'line-clamp-6'}`}>{note.text}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <ItemAction icon={Pencil} label={t('apercu.widgets.n.editNote')} iconOnly={size === 'small'} onClick={() => startEdit(note)} />
                    {size !== 'small' && (
                      <ItemAction iconOnly icon={Trash2} label={t('apercu.widgets.n.deleteNote')} onClick={() => remove(note.id)} />
                    )}
                    <span className="ml-auto text-xs text-amber-800/80 dark:text-amber-200/80">{ago(note.updatedAt)}</span>
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
