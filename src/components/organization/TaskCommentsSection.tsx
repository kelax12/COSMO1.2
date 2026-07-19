import { useMemo, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import {
  useTeamTaskComments,
  useAddTeamTaskComment,
  useDeleteTeamTaskComment,
} from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface TaskCommentsSectionProps {
  taskId: string;
  members: OrgMember[];
  currentUserId?: string;
}

/**
 * Fil de commentaires d'une tâche d'équipe (reco #9, mig. 082) — journal
 * immuable, suppression par l'auteur. Mentions : taper « @ » ouvre la liste
 * des membres ; les ids mentionnés sont recalculés du texte à l'envoi.
 */
const TaskCommentsSection = ({ taskId, members, currentUserId }: TaskCommentsSectionProps) => {
  const { data: comments = [], isLoading } = useTeamTaskComments(taskId);
  const addMutation = useAddTeamTaskComment(taskId);
  const deleteMutation = useDeleteTeamTaskComment(taskId);
  const [body, setBody] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  // Détection de la mention en cours : « @ » suivi de texte sans espace,
  // en fin de saisie uniquement (UX simple, pas de curseur milieu de texte).
  const onBodyChange = (value: string) => {
    setBody(value);
    const match = /(?:^|\s)@([^\s@]*)$/.exec(value);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    return members
      .filter((m) => m.userId !== currentUserId)
      .filter((m) => m.displayName.toLowerCase().includes(mentionQuery))
      .slice(0, 5);
  }, [members, mentionQuery, currentUserId]);

  const pickMention = (m: OrgMember) => {
    setBody((prev) => prev.replace(/@[^\s@]*$/, `@${m.displayName} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const submit = () => {
    const text = body.trim();
    if (!text || addMutation.isPending) return;
    // Mentions recalculées du texte final : robuste aux éditions manuelles.
    const mentions = members
      .filter((m) => text.includes(`@${m.displayName}`))
      .map((m) => m.userId);
    addMutation.mutate({ body: text, mentions }, { onSuccess: () => { setBody(''); setMentionQuery(null); } });
  };

  return (
    <div className="border-t pt-4 mt-5" style={{ borderColor: 'rgb(var(--color-border))' }}>
      <h3 className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
        <MessageSquare size={15} aria-hidden="true" />
        Commentaires{comments.length > 0 ? ` (${comments.length})` : ''}
      </h3>

      {isLoading ? (
        <p className="text-xs py-3 text-center" style={{ color: 'rgb(var(--color-text-muted))' }}>Chargement…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs py-1 mb-2" style={{ color: 'rgb(var(--color-text-muted))' }}>
          Aucun commentaire — lancez la discussion. Tapez « @ » pour mentionner un membre.
        </p>
      ) : (
        <ul className="space-y-3 mb-3 max-h-56 overflow-y-auto pr-1">
          {comments.map((c) => {
            const author = c.authorId ? memberById.get(c.authorId) : undefined;
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                <MemberAvatar avatar={author?.avatar} name={author?.displayName ?? '?'} size={26} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {author?.displayName ?? 'Ancien membre'}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: 'rgb(var(--color-text-muted))' }}>
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {c.body}
                  </p>
                </div>
                {c.authorId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                    aria-label="Supprimer ce commentaire"
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-50"
                    style={{ color: 'rgb(var(--color-text-muted))' }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        {mentionCandidates.length > 0 && (
          <ul
            className="absolute bottom-full mb-1 left-0 right-0 rounded-xl border shadow-lg overflow-hidden z-10"
            style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}
            role="listbox"
            aria-label="Mentionner un membre"
          >
            {mentionCandidates.map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => pickMention(m)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                  <span className="text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>{m.displayName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && mentionCandidates.length === 0) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Écrire un commentaire… (@ pour mentionner)"
            className="flex-1 px-3 py-2 text-sm rounded-xl border resize-none focus:outline-none focus:border-[rgb(var(--color-accent))]"
            style={{
              borderColor: 'rgb(var(--color-border))',
              backgroundColor: 'rgb(var(--color-surface))',
              color: 'rgb(var(--color-text-primary))',
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!body.trim() || addMutation.isPending}
            aria-label="Envoyer le commentaire"
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCommentsSection;
