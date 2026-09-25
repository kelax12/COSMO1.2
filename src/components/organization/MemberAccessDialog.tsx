import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import type { OrgMember } from '@/modules/organizations';
import { useSetMemberAccess } from '@/modules/organizations/governance.hooks';
import { useT } from '@/i18n/useT';

interface MemberAccessDialogProps {
  orgId: string;
  member: OrgMember;
  onClose: () => void;
}

/** 'YYYY-MM-DD' local → fin de journée locale, en ISO. */
const endOfLocalDay = (date: string): string => new Date(`${date}T23:59:59`).toISOString();

/**
 * Suspendre, réactiver, borner l'accès d'un membre (mig. 161, M10).
 *
 * Suspendre coupe l'accès SANS retirer la personne : ses tâches, sa place dans
 * la pyramide et ses équipes restent, pour un congé, une enquête ou un
 * prestataire entre deux missions. Borner l'accès donne une date au-delà de
 * laquelle le serveur la traite comme absente (`is_org_member`).
 */
const MemberAccessDialog = ({ orgId, member, onClose }: MemberAccessDialogProps) => {
  const { t } = useT('org');
  const setAccess = useSetMemberAccess();
  const [suspended, setSuspended] = useState(!!member.suspendedAt);
  const [until, setUntil] = useState(member.accessExpiresAt ? member.accessExpiresAt.slice(0, 10) : '');

  const save = () =>
    setAccess.mutate(
      { orgId, userId: member.userId, suspended, expiresAt: until ? endOfLocalDay(until) : null },
      { onSuccess: onClose },
    );

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl text-[rgb(var(--color-text-primary))] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">
            {t('lifecycle.accessTitle', { name: member.displayName })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[rgb(var(--color-text-secondary))] text-sm leading-relaxed">
            {t('lifecycle.accessIntro')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
            {t('lifecycle.accessState')}
          </legend>
          {[false, true].map((value) => (
            <label key={String(value)} className="flex items-start gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] cursor-pointer has-[:checked]:border-[rgb(var(--color-accent))]">
              <input
                type="radio"
                name="member-access-state"
                checked={suspended === value}
                onChange={() => setSuspended(value)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="block font-semibold">
                  {value ? t('lifecycle.stateSuspended') : t('lifecycle.stateActive')}
                </span>
                <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                  {value ? t('lifecycle.stateSuspendedHint') : t('lifecycle.stateActiveHint')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div>
          <label htmlFor="member-access-until" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
            {t('lifecycle.accessUntil')}
          </label>
          <DatePicker
            id="member-access-until"
            value={until}
            onChange={(v) => setUntil(v ?? '')}
            placeholder={t('lifecycle.accessUntilNone')}
            minDate={new Date().toLocaleDateString('en-CA')}
          />
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('lifecycle.accessUntilHint')}</p>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))] font-semibold text-sm">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={setAccess.isPending}
            onClick={(e) => { e.preventDefault(); save(); }}
            className="rounded-xl font-semibold text-sm bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90 disabled:opacity-50"
          >
            {t('lifecycle.accessSave')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MemberAccessDialog;
