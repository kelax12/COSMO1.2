import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const PolitiqueConfidentialitePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/welcome')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Retour
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Politique de confidentialité</h1>
        <p className="text-slate-400 mb-10">Dernière mise à jour : 26 avril 2026</p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via l'application Cosmo est l'équipe Cosmo, joignable à <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>.
          </p>
        </Section>

        <Section title="2. Données collectées">
          <p>Lors de votre utilisation de Cosmo, nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
          <ul className="list-disc list-inside space-y-2 mt-3 text-slate-300">
            <li>
              <strong className="text-white">Données d'identification :</strong> nom d'affichage, adresse e-mail, mot de passe chiffré (inscription classique) ou photo de profil et identifiant Google (connexion via Google OAuth)
            </li>
            <li>
              <strong className="text-white">Données de productivité :</strong> tâches, catégories, listes, habitudes et leur historique de complétion, événements agenda, OKR (objectifs et résultats clés) et leurs progressions
            </li>
            <li>
              <strong className="text-white">Données sociales :</strong> liste d'amis, demandes d'amitié, tâches partagées avec d'autres utilisateurs, messages de chat échangés via la messagerie intégrée
            </li>
            <li>
              <strong className="text-white">Données d'abonnement :</strong> statut Premium, tokens, date de fin d'abonnement — les données bancaires sont gérées exclusivement par Stripe, Cosmo n'y a pas accès
            </li>
            <li>
              <strong className="text-white">Données techniques :</strong> informations de session Supabase (token d'authentification, date de dernière connexion)
            </li>
          </ul>
          <p className="mt-3 text-slate-400 text-sm">
            Cosmo ne collecte pas de données comportementales ni analytiques. Aucun outil de tracking tiers (Google Analytics, Mixpanel, Hotjar, etc.) n'est utilisé.
          </p>
        </Section>

        <Section title="3. Méthodes d'authentification">
          <p>Cosmo propose deux modes de connexion :</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li>
              <strong className="text-white">Email / mot de passe :</strong> votre mot de passe est haché côté serveur par Supabase Auth et n'est jamais stocké en clair
            </li>
            <li>
              <strong className="text-white">Google OAuth :</strong> en vous connectant via Google, vous autorisez Cosmo à récupérer votre nom, adresse e-mail et photo de profil depuis votre compte Google. Aucun accès à votre agenda ou autres services Google n'est demandé
            </li>
          </ul>
        </Section>

        <Section title="4. Finalités du traitement">
          <p>Vos données sont utilisées exclusivement pour :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Créer et authentifier votre compte utilisateur</li>
            <li>Stocker et synchroniser vos données de productivité (tâches, habitudes, agenda, OKR)</li>
            <li>Permettre la collaboration : partage de tâches, messagerie et gestion des amis</li>
            <li>Traiter les paiements et gérer votre abonnement Premium</li>
            <li>Assurer la sécurité et le bon fonctionnement de l'application</li>
          </ul>
        </Section>

        <Section title="5. Base légale">
          <p>Le traitement de vos données repose sur :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-white">Exécution du contrat</strong> pour toutes les données nécessaires au fonctionnement du service</li>
            <li><strong className="text-white">Intérêt légitime</strong> pour la sécurité de l'application</li>
            <li><strong className="text-white">Consentement</strong> pour les cookies non essentiels (si applicable)</li>
          </ul>
        </Section>

        <Section title="6. Durée de conservation">
          <ul className="list-disc list-inside space-y-1">
            <li>Données de compte et de contenu : conservées pendant toute la durée d'activité du compte, puis supprimées définitivement sous 90 jours après clôture</li>
            <li>Messages de chat : supprimés à la demande ou à la clôture du compte</li>
            <li>Tokens de session : expiration automatique selon la configuration Supabase</li>
            <li>Données de paiement : conservées selon les obligations légales (10 ans pour la comptabilité)</li>
          </ul>
        </Section>

        <Section title="7. Partage des données">
          <p>Vos données peuvent transiter via les sous-traitants suivants :</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li><strong className="text-white">Supabase</strong> — base de données et authentification (serveurs en UE disponibles)</li>
            <li><strong className="text-white">Vercel</strong> — hébergement du frontend (CDN mondial)</li>
            <li><strong className="text-white">Stripe</strong> — traitement sécurisé des paiements</li>
            <li><strong className="text-white">Google</strong> — uniquement si vous utilisez la connexion Google OAuth</li>
          </ul>
          <p className="mt-3">Aucune donnée n'est vendue à des tiers. Aucun partage à des fins publicitaires ou marketing.</p>
        </Section>

        <Section title="8. Vos droits (RGPD)">
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-white">Droit d'accès</strong> — obtenir une copie de vos données personnelles</li>
            <li><strong className="text-white">Droit de rectification</strong> — corriger des informations inexactes depuis les paramètres</li>
            <li><strong className="text-white">Droit à l'effacement</strong> — supprimer votre compte et toutes vos données</li>
            <li><strong className="text-white">Droit à la portabilité</strong> — exporter vos données dans un format lisible</li>
            <li><strong className="text-white">Droit d'opposition</strong> — s'opposer à certains traitements</li>
            <li><strong className="text-white">Droit à la limitation</strong> — restreindre le traitement dans certains cas</li>
          </ul>
          <p className="mt-3">Pour exercer ces droits : <a href="mailto:contact@cosmo.app" className="text-blue-400 hover:underline">contact@cosmo.app</a>. Réponse sous 30 jours.</p>
          <p className="mt-2">Vous pouvez également saisir la <strong className="text-white">CNIL</strong> : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">www.cnil.fr</a></p>
        </Section>

        <Section title="9. Sécurité">
          <p>
            Toutes les communications entre votre navigateur et nos serveurs sont chiffrées via HTTPS/TLS. Les mots de passe sont stockés sous forme hachée (bcrypt via Supabase Auth). L'accès aux données est protégé par des politiques Row Level Security (RLS) côté base de données — chaque utilisateur n'accède qu'à ses propres données.
          </p>
        </Section>

        <Section title="10. Cookies">
          <p>Cosmo utilise uniquement des cookies <strong className="text-white">strictement nécessaires</strong> au fonctionnement :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Cookie de session Supabase (authentification)</li>
            <li>Préférences de l'interface stockées en localStorage (thème, filtres)</li>
            <li>Choix du consentement cookie stocké en localStorage</li>
          </ul>
          <p className="mt-2 text-slate-400 text-sm">Aucun cookie publicitaire ou de tracking tiers n'est déposé sur votre appareil.</p>
        </Section>

        <Section title="11. Modifications">
          <p>
            Cette politique peut être mise à jour. En cas de modification substantielle, vous serez informé par e-mail ou via une notification dans l'application. La date de dernière mise à jour est indiquée en haut de cette page.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default PolitiqueConfidentialitePage;
