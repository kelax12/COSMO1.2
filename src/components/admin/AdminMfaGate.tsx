// Garde d'accès de `/admin` — écran d'enrôlement TOTP puis défi.
//
// Cet écran ne protège RIEN par lui-même : la frontière est
// `public.is_admin()` (mig. 131), qui exige une session `aal2` avant que
// `get_admin_stats()` ne rende une ligne. Ce composant existe pour qu'un
// admin puisse atteindre cette session, et pour qu'un refus serveur cesse
// d'être un écran blanc.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/useT';
import { useAdminGate } from '@/modules/admin';
import {
  cancelEnrolment,
  formatSecret,
  listFactors,
  startTotpEnrolment,
  verifyTotp,
  type TotpEnrolment,
} from '@/modules/auth/mfa';

const CODE_LENGTH = 6;

/**
 * SVG rendu par GoTrue → `data:` URI porté par une balise `<img>`.
 *
 * Jamais `dangerouslySetInnerHTML` : un SVG inline s'exécute (scripts,
 * gestionnaires d'événements), un SVG chargé par `<img>` est une image
 * passive. La source est notre propre backend d'authentification, mais une
 * garde qui repose sur « la source est de confiance » n'est pas une garde.
 * `img-src 'self' data:` est déjà autorisé par la CSP (`vercel.json`).
 *
 * 🔴 Ne JAMAIS revenir à `btoa(String.fromCharCode(...bytes))`. Le spread
 * passe un argument par octet : au-delà de quelques dizaines de Ko il lève
 * `RangeError: Maximum call stack size exceeded`. Or un QR TOTP est un SVG
 * de ~1 500 `<rect>`, soit 60 à 100 Ko, et cette fonction est appelée
 * PENDANT LE RENDU — un throw y remonte à l'`AppErrorBoundary`, donc
 * l'écran d'erreur générique au lieu du QR code. C'est le bug observé le
 * 2026-09-01, et `src/lib/bug-report.ts` mettait déjà en garde contre ce
 * motif exact. `encodeURIComponent` n'a pas de limite de taille et c'est la
 * forme que recommande la doc Supabase pour ce champ.
 */
const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Coquille commune aux deux écrans : même cadre, même largeur, mêmes tokens. */
const GateCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-[60vh] flex items-center justify-center px-4">
    <div className="w-full max-w-md rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-[rgb(var(--color-accent-solid))]" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-[rgb(var(--color-foreground))]">{title}</h1>
      </div>
      {children}
    </div>
  </div>
);

/** Saisie du code à 6 chiffres, partagée par l'enrôlement et le défi. */
const CodeForm: React.FC<{
  label: string;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}> = ({ label, submitLabel, busy, error, onSubmit }) => {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === CODE_LENGTH && !busy) onSubmit(code);
      }}
      className="space-y-3">
      <label
        htmlFor="mfa-code"
        className="block text-sm text-[rgb(var(--color-muted-foreground))]">
        {label}
      </label>
      <Input
        id="mfa-code"
        ref={inputRef}
        value={code}
        // Le clavier numérique et le collage depuis un gestionnaire de mots de
        // passe passent tous les deux par ce filtre : on ne garde que les
        // chiffres, on ne rejette pas la saisie.
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        aria-describedby={error ? 'mfa-error' : undefined}
        aria-invalid={error ? true : undefined}
        className="tracking-[0.4em] text-center text-lg"
      />
      {error && (
        <p id="mfa-error" role="alert" className="text-sm text-[rgb(var(--color-danger))]">
          {error}
        </p>
      )}
      <Button type="submit" disabled={code.length !== CODE_LENGTH || busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
};

export const AdminMfaGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useT('admin');
  const { state, refresh } = useAdminGate();
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un enrôlement abandonné laisse un facteur `unverified` derrière lui, qui
  // ne protège rien et empêche un second enrôlement. On le retire en quittant.
  const enrolmentRef = useRef<TotpEnrolment | null>(null);
  enrolmentRef.current = enrolment;
  useEffect(
    () => () => {
      const pending = enrolmentRef.current;
      if (pending) void cancelEnrolment(pending.factorId).catch(() => undefined);
    },
    []
  );

  const begin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setEnrolment(await startTotpEnrolment('COSMO admin'));
    } catch {
      setError(t('mfa.enrolFailed'));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const submit = useCallback(
    async (factorId: string, code: string) => {
      setBusy(true);
      setError(null);
      try {
        await verifyTotp(factorId, code);
        // Le facteur est vérifié : plus rien à annuler au démontage.
        setEnrolment(null);
        refresh();
      } catch {
        // Message unique et volontairement muet sur la cause : un code faux et
        // un facteur inconnu ne doivent pas se distinguer.
        setError(t('mfa.codeRejected'));
      } finally {
        setBusy(false);
      }
    },
    [refresh, t]
  );

  /**
   * Défi sur un facteur déjà vérifié : son identifiant se relit au moment de
   * la soumission plutôt que d'être gardé en état, pour qu'un facteur ajouté
   * ou retiré depuis un autre onglet ne rende pas l'écran inutilisable.
   * Aucun facteur trouvé : on soumet quand même une chaîne vide, et l'échec
   * affiche le même message. Jamais de branche silencieuse.
   */
  const challenge = useCallback(
    async (code: string) => {
      const factors = await listFactors().catch(() => []);
      const verified = factors.find((f) => f.factor_type === 'totp' && f.status === 'verified');
      await submit(verified?.id ?? '', code);
    },
    [submit]
  );

  if (state === 'loading') return null;
  if (state === 'not-admin') return <Navigate to="/dashboard" replace />;
  if (state === 'ready') return <>{children}</>;

  if (state === 'challenge') {
    return (
      <GateCard title={t('mfa.challengeTitle')}>
        <p className="text-sm text-[rgb(var(--color-muted-foreground))]">{t('mfa.challengeHint')}</p>
        <CodeForm
          label={t('mfa.codeLabel')}
          submitLabel={t('mfa.verify')}
          busy={busy}
          error={error}
          onSubmit={(code) => void challenge(code)}
        />
      </GateCard>
    );
  }

  // state === 'enrol'
  return (
    <GateCard title={t('mfa.enrolTitle')}>
      <p className="text-sm text-[rgb(var(--color-muted-foreground))]">{t('mfa.enrolHint')}</p>
      {!enrolment ? (
        <Button onClick={() => void begin()} disabled={busy} className="w-full">
          <Smartphone className="w-4 h-4 mr-2" aria-hidden="true" />
          {t('mfa.enrolStart')}
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center rounded-xl bg-white p-3">
            <img
              src={svgToDataUri(enrolment.qrSvg)}
              alt={t('mfa.qrAlt')}
              width={176}
              height={176}
              className="w-44 h-44"
            />
          </div>
          <p className="text-xs text-center text-[rgb(var(--color-muted-foreground))] break-all">
            {t('mfa.manualEntry')}{' '}
            <code className="font-mono">{formatSecret(enrolment.secret)}</code>
          </p>
          <CodeForm
            label={t('mfa.codeLabel')}
            submitLabel={t('mfa.enrolConfirm')}
            busy={busy}
            error={error}
            onSubmit={(code) => void submit(enrolment.factorId, code)}
          />
        </div>
      )}
      {error && !enrolment && (
        <p role="alert" className="text-sm text-[rgb(var(--color-danger))]">
          {error}
        </p>
      )}
    </GateCard>
  );
};

export default AdminMfaGate;
