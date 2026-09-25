import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useOrgBillingContact, useSaveOrgBillingContact } from '@/modules/billing/org-billing.hooks';

interface Props {
  orgId: string;
  /** Adresse du propriétaire : c'est là que partent les factures sans contact. */
  ownerEmail?: string;
  userId?: string;
}

/** Même forme que la contrainte `org_billing_contacts_email_ck` (mig. 180). */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const inputClass =
  'w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent)/0.4)]';

/**
 * Contact de facturation distinct du propriétaire (mig. 180).
 *
 * Le cas visé : le propriétaire crée l'organisation, mais c'est la
 * comptabilité qui reçoit et range les factures. Sans ce réglage, il devait
 * les transférer à la main, une par une.
 *
 * ⚠️ Ce qui est enregistré ici est reporté sur le customer Stripe au prochain
 * paiement ou à la prochaine ouverture de « Gérer l'abonnement »
 * (`stripe-org-checkout`, `stripe-org-portal`) : l'écran le dit, pour ne pas
 * promettre un envoi immédiat qu'aucun appel ne fait.
 */
export function OrgBillingContactCard({ orgId, ownerEmail, userId }: Props) {
  const { t } = useT('org');
  const { data: contact, isLoading } = useOrgBillingContact(orgId, true);
  const save = useSaveOrgBillingContact(orgId, userId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  // Le formulaire reprend la valeur enregistrée dès qu'elle arrive.
  useEffect(() => {
    setName(contact?.name ?? '');
    setEmail(contact?.email ?? '');
  }, [contact]);

  const trimmed = email.trim();
  const invalid = trimmed.length > 0 && (!EMAIL_RE.test(trimmed) || trimmed.length > 254);
  const unchanged = trimmed === (contact?.email ?? '') && name.trim() === (contact?.name ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!trimmed || invalid) return;
    save.mutate({ name: name.trim() || null, email: trimmed });
  };

  const recipient = contact?.email ?? ownerEmail;

  return (
    <section
      aria-labelledby="org-billing-contact"
      className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-3"
    >
      <h3 id="org-billing-contact" className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
        <Mail size={15} aria-hidden="true" />
        {t('billing.contactTitle')}
      </h3>
      {!isLoading && recipient && (
        <p className="text-xs text-[rgb(var(--color-text-secondary))]">
          {contact
            ? t('billing.contactCurrent', { email: recipient })
            : t('billing.contactOwnerDefault', { email: recipient })}
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="org-billing-contact-name" className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">
              {t('billing.contactName')}
            </label>
            <input
              id="org-billing-contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoComplete="organization"
              placeholder={t('billing.contactNamePlaceholder')}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="org-billing-contact-email" className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">
              {t('billing.contactEmail')}
            </label>
            <input
              id="org-billing-contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={254}
              autoComplete="email"
              placeholder="compta@exemple.fr"
              aria-invalid={touched && invalid ? true : undefined}
              aria-describedby={touched && invalid ? 'org-billing-contact-error' : undefined}
              className={inputClass}
            />
          </div>
        </div>
        {touched && invalid && (
          <p id="org-billing-contact-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
            {t('billing.contactInvalid')}
          </p>
        )}
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('billing.contactHint')}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={save.isPending || !trimmed || invalid || unchanged}
            className="rounded-lg bg-[rgb(var(--color-accent-solid))] px-3 py-2 text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60 transition-colors"
          >
            {t('billing.contactSave')}
          </button>
          {contact && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(null)}
              className="rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-sm text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] disabled:opacity-60 transition-colors"
            >
              {t('billing.contactRemove')}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export default OrgBillingContactCard;
