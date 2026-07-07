import React, { useState } from 'react';
import { Building2, Users, ArrowLeft, Copy, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateOrganization,
  useRequestJoinOrganization,
  useMySentJoinRequest,
  useCancelJoinRequest,
  type Organization,
} from '@/modules/organizations';

interface CreateOrJoinOrganizationProps {
  /** Appelé quand l'utilisateur vient de créer une entreprise (nav vers /entreprise). */
  onCreated?: (org: Organization) => void;
}

const cardBase =
  'flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-all w-full';
const inputClasses =
  'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all';
const primaryBtn =
  'w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-500/20';

/**
 * Choix « Créer une entreprise » ou « Rejoindre via code ». Réutilisé par la
 * page d'onboarding (après inscription entreprise) ET par la section
 * « Entreprise » des Réglages (conversion d'un compte particulier).
 *
 * Trois états :
 *   • choix : deux cartes (créer / rejoindre)
 *   • create : saisie du nom → affiche le code généré à partager
 *   • join : saisie du code → écran « demande envoyée » (piloté par
 *     getMySentJoinRequest, poll 20 s → l'écran d'attente reste après reload)
 */
const CreateOrJoinOrganization: React.FC<CreateOrJoinOrganizationProps> = ({ onCreated }) => {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [createdOrg, setCreatedOrg] = useState<Organization | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateOrganization();
  const requestJoinMutation = useRequestJoinOrganization();
  const cancelMutation = useCancelJoinRequest();
  const { data: sentRequest } = useMySentJoinRequest();

  const handleCreate = () => {
    createMutation.mutate(name.trim(), {
      onSuccess: (org) => {
        setCreatedOrg(org);
        onCreated?.(org);
      },
    });
  };

  const handleJoin = () => {
    requestJoinMutation.mutate(code.trim(), {
      onSuccess: () => setCode(''),
    });
  };

  const copyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Code copié');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Impossible de copier le code');
    }
  };

  // ── État : entreprise créée → afficher le code à partager ───────────
  if (createdOrg) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
          <Building2 size={26} className="text-indigo-500" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
            {createdOrg.name} est créée
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            Partagez ce code d'invitation avec votre équipe pour qu'ils vous rejoignent.
          </p>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <code className="text-lg font-bold tracking-widest px-4 py-2.5 rounded-xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]">
            {createdOrg.joinCode}
          </code>
          <button
            type="button"
            onClick={() => createdOrg.joinCode && copyCode(createdOrg.joinCode)}
            className="w-11 h-11 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-secondary))] transition-colors"
            aria-label="Copier le code d'invitation"
          >
            {copied ? <Check size={18} className="text-green-500" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    );
  }

  // ── État : demande d'adhésion envoyée → écran d'attente ─────────────
  if (sentRequest) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
          <Clock size={26} className="text-amber-500" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
            Demande envoyée
          </h3>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
            Votre demande d'adhésion est en attente de validation par un administrateur.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            cancelMutation.mutate(sentRequest.id, {
              onSuccess: () => toast.success('Demande annulée'),
            })
          }
          disabled={cancelMutation.isPending}
          className="text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-red-500 transition-colors underline underline-offset-2 disabled:opacity-60"
        >
          Annuler ma demande
        </button>
      </div>
    );
  }

  // ── État : choix ────────────────────────────────────────────────────
  if (mode === 'choice') {
    return (
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`${cardBase} border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:border-blue-500 hover:ring-2 hover:ring-blue-500/30`}
        >
          <Building2 size={22} className="text-blue-500" aria-hidden="true" />
          <span className="text-base font-bold text-[rgb(var(--color-text-primary))]">Créer une entreprise</span>
          <span className="text-sm text-[rgb(var(--color-text-secondary))]">
            Vous devenez administrateur et invitez votre équipe avec un code.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode('join')}
          className={`${cardBase} border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/30`}
        >
          <Users size={22} className="text-indigo-500" aria-hidden="true" />
          <span className="text-base font-bold text-[rgb(var(--color-text-primary))]">Rejoindre une entreprise</span>
          <span className="text-sm text-[rgb(var(--color-text-secondary))]">
            Saisissez le code d'invitation reçu de votre administrateur.
          </span>
        </button>
      </div>
    );
  }

  // ── État : formulaire (create | join) ───────────────────────────────
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setMode('choice')}
        className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Retour
      </button>

      {mode === 'create' ? (
        <div className="space-y-3">
          <label htmlFor="org-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
            Nom de l'entreprise
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim().length >= 2 && handleCreate()}
            placeholder="Nova Studio"
            className={inputClasses}
            maxLength={80}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={name.trim().length < 2 || createMutation.isPending}
            className={primaryBtn}
          >
            {createMutation.isPending ? 'Création…' : "Créer l'entreprise"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="org-code" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
            Code d'invitation
          </label>
          <input
            id="org-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && code.trim() && handleJoin()}
            placeholder="COSMO-XXXXXX"
            className={`${inputClasses} tracking-widest font-mono`}
            maxLength={12}
            autoFocus
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={!code.trim() || requestJoinMutation.isPending}
            className={primaryBtn}
          >
            {requestJoinMutation.isPending ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateOrJoinOrganization;
