// Chat d'un projet (mig. 220) : remplace le bloc « Ajouter au projet ».
// Quiconque voit le projet écrit ; la fonction (responsable / membre) suit
// le nom de l'auteur. Seul l'auteur supprime son message.

import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { SendHorizontal, Trash2 } from 'lucide-react';
import {
  useProjectMessages, useAddProjectMessage, useDeleteProjectMessage,
  type TeamProject, type TeamProjectMember,
} from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import MemberAvatar from './MemberAvatar';
import { projectFunctionOf } from './project-function';

const MAX = 2000;

interface ProjectChatProps {
  project: TeamProject;
  projectMembers: TeamProjectMember[];
  members: OrgMember[];
  currentUserId?: string;
  /** Projet archivé : le fil se lit, ne s'écrit plus. */
  readOnly: boolean;
}

const ProjectChat = ({ project, projectMembers, members, currentUserId, readOnly }: ProjectChatProps) => {
  const { t: pf } = useT('portfolio');
  const { data: messages = [], isLoading } = useProjectMessages(project.id);
  const add = useAddProjectMessage(project.orgId, project.id);
  const remove = useDeleteProjectMessage(project.id);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Le dernier message reste en vue.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body || add.isPending) return;
    add.mutate(body, { onSuccess: () => setDraft('') });
  };

  return (
    <section
      aria-labelledby={`project-chat-${project.id}`}
      className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] flex flex-col"
    >
      <h3 id={`project-chat-${project.id}`} className="flex items-center gap-1.5 px-4 pt-4 pb-2 text-sm font-bold text-[rgb(var(--color-text-primary))]">
        {pf('chat.title')}
      </h3>

      <div ref={listRef} className="px-4 max-h-[420px] min-h-[120px] overflow-y-auto space-y-3 pb-2" aria-live="polite">
        {!isLoading && messages.length === 0 && (
          <p className="py-6 text-center text-xs text-[rgb(var(--color-text-muted))]">{pf('chat.empty')}</p>
        )}
        {messages.map((msg) => {
          const author = msg.authorId ? members.find((m) => m.userId === msg.authorId) : undefined;
          const name = author?.displayName ?? pf('members.formerMember');
          const fn = projectFunctionOf(msg.authorId, project, projectMembers);
          const mine = !!currentUserId && msg.authorId === currentUserId;
          return (
            <div key={msg.id} className="group flex gap-2">
              <MemberAvatar avatar={author?.avatar} name={name} size={24} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{name}</span>
                  {author && (
                    <span className={`text-[11px] font-semibold px-1.5 rounded-full ${fn === 'lead' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]'}`}>
                      {pf(`members.role.${fn}`)}
                    </span>
                  )}
                  <time dateTime={msg.createdAt} className="text-[11px] text-[rgb(var(--color-text-muted))]">
                    {format(parseISO(msg.createdAt), 'd MMM HH:mm', { locale: getDateLocale() })}
                  </time>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(msg.id)}
                      aria-label={pf('chat.delete')}
                      title={pf('chat.delete')}
                      className="ml-auto p-0.5 rounded text-[rgb(var(--color-text-muted))] hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-[rgb(var(--color-text-primary))] whitespace-pre-wrap break-words">{msg.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-end gap-2 p-3 border-t border-[rgb(var(--color-border))]"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={1}
            placeholder={pf('chat.placeholder')}
            aria-label={pf('chat.placeholder')}
            className="flex-1 resize-none max-h-32 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || add.isPending}
            aria-label={pf('chat.send')}
            title={pf('chat.send')}
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 transition-colors"
          >
            <SendHorizontal size={15} aria-hidden="true" />
          </button>
        </form>
      )}
    </section>
  );
};

export default ProjectChat;
