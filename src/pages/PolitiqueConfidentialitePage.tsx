import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const PolitiqueConfidentialitePage: React.FC = () => {
  useSeoMeta({
    title: 'Politique de confidentialité – Cosmo App',
    description: 'Politique de confidentialité de Cosmo : données collectées, stockage sécurisé Supabase, Row Level Security, droits RGPD et contact.',
    canonical: 'https://thecosmo.app/politique-confidentialite',
  });
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Retour
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">Politique de confidentialité</h1>
        <p className="text-slate-400 mb-10">Dernière mise à jour : 2 septembre 2026</p>

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via l'application Cosmo est l'équipe Cosmo, joignable à <a href="mailto:axellongattepro@gmail.com" className="text-blue-400 hover:underline">axellongattepro@gmail.com</a>.
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
              <strong className="text-white">Données sociales :</strong> liste d'amis, demandes d'amitié, tâches partagées avec d'autres utilisateurs
            </li>
            <li>
              <strong className="text-white">Données d'abonnement :</strong> statut Premium, tokens, date de fin d'abonnement. Les données bancaires sont gérées exclusivement par Stripe, Cosmo n'y a pas accès
            </li>
            <li>
              <strong className="text-white">Données techniques :</strong> informations de session Supabase (token d'authentification, date de dernière connexion)
            </li>
          </ul>
          <p className="mt-3">
            <strong className="text-white">Mesure d'audience :</strong> Cosmo utilise Vesk, un outil de mesure
            d'audience, chargé uniquement si vous l'acceptez. Il enregistre, à chaque page consultée, l'adresse de la
            page, la page d'où vous venez, votre adresse IP, votre navigateur, ainsi que des indicateurs d'engagement
            (profondeur de défilement, temps passé, clics sur les liens et boutons). Il ne construit aucun profil
            publicitaire.
          </p>
          <p className="mt-3">
            <strong className="text-white">Identifiant de mesure :</strong> Vesk enregistre sur votre appareil, dans le
            stockage local du navigateur, un identifiant aléatoire qui permet de reconnaître une même visite d'une page
            à l'autre. Ce n'est pas un cookie, mais c'est bien une information déposée sur votre équipement : elle n'est
            donc écrite qu'après votre acceptation, et vous pouvez l'effacer à tout moment en vidant les données de
            site de votre navigateur. L'adresse IP, le navigateur et cet identifiant sont des données personnelles.
            Ces données ne sont pas rattachées à votre compte Cosmo et ne sont jamais recoupées avec vos tâches,
            habitudes ou OKR.
          </p>
          <p className="mt-3">
            <strong className="text-white">Pages exclues de la mesure :</strong> la mesure d'audience n'est jamais
            chargée sur les pages où vous saisissez des identifiants (création de compte, connexion, réinitialisation
            de mot de passe, acceptation d'une invitation), ni sur aucun écran de l'application une fois connecté.
          </p>
          <p className="mt-3 text-slate-400 text-sm">
            Aucun autre outil de tracking tiers (Google Analytics, Mixpanel, Hotjar, etc.) n'est utilisé, et aucune donnée
            comportementale n'est collectée à l'intérieur de l'application au-delà de cette mesure d'audience.
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
            <li><strong className="text-white">Intérêt légitime</strong> pour la sécurité et la continuité de l'application</li>
            <li><strong className="text-white">Consentement</strong> pour la mesure d'audience (Vesk et Vercel Analytics) et pour tout dépôt d'information sur votre appareil qui n'est pas strictement nécessaire au service. Rien n'est chargé tant que vous n'avez pas accepté, et un refus ne charge jamais rien. Vous pouvez revenir sur ce choix à tout moment</li>
          </ul>
        </Section>

        <Section title="6. Durée de conservation">
          <ul className="list-disc list-inside space-y-1">
            <li>Données de compte et de contenu : conservées pendant toute la durée d'activité du compte, puis supprimées définitivement sous 90 jours après clôture</li>
            <li>Tokens de session : expiration automatique selon la configuration Supabase</li>
            <li><strong className="text-white">Visite de la démonstration</strong> (identifiant d'appareil, posé avant toute création de compte) : <strong className="text-white">90 jours</strong> si la visite ne débouche pas sur une inscription, <strong className="text-white">400 jours</strong> si elle y aboutit</li>
            <li><strong className="text-white">Jours d'activité</strong> (dates de connexion, utilisées pour les statistiques d'usage) : <strong className="text-white">400 jours</strong></li>
            <li><strong className="text-white">Marqueurs techniques de paiement</strong> (identifiants d'événements Stripe déjà traités, servant à ne pas facturer deux fois) : <strong className="text-white">90 jours</strong></li>
            <li>Données de paiement : conservées selon les obligations légales (10 ans pour la comptabilité)</li>
          </ul>
          <p className="mt-3 text-slate-400 text-sm">
            Ces durées sont appliquées automatiquement par la base de données, sans intervention
            manuelle. Le journal d'encaissement fait exception : la loi fiscale impose sa
            conservation, il ne peut donc pas être effacé. Une demande de suppression de compte y
            rend les lignes anonymes plutôt que de les supprimer.
          </p>
        </Section>

        <Section title="7. Partage des données">
          <p>Vos données peuvent transiter via les sous-traitants suivants :</p>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li><strong className="text-white">Supabase</strong> : base de données et authentification. Vos données sont hébergées dans la région <strong className="text-white">eu-west-1 (Irlande)</strong>, donc dans l'Union européenne</li>
            <li><strong className="text-white">Vercel</strong> : hébergement du site. Traite les données de connexion (adresse IP, journaux techniques)</li>
            <li><strong className="text-white">Vercel Analytics</strong> : mesure d'audience sans cookie, chargée uniquement si vous l'acceptez</li>
            <li><strong className="text-white">Sentry</strong> : détection des erreurs techniques. Les adresses email et les identifiants sont retirés automatiquement avant l'envoi</li>
            <li><strong className="text-white">Stripe</strong> : traitement sécurisé des paiements</li>
            <li><strong className="text-white">Google</strong> : uniquement si vous utilisez la connexion Google OAuth</li>
            <li><strong className="text-white">Vesk</strong> : mesure d'audience (adresse de la page, page référente, adresse IP, navigateur, indicateurs d'engagement, et un identifiant aléatoire déposé dans le stockage local du navigateur), chargée uniquement si vous l'acceptez et jamais sur les pages de saisie d'identifiants</li>
          </ul>
          <p className="mt-3">Aucune donnée n'est vendue à des tiers. Aucun partage à des fins publicitaires ou marketing.</p>
        </Section>

        <Section title="7 bis. Transferts hors de l'Union européenne">
          <p>
            Votre base de données est hébergée en Irlande, donc au sein de l'Union européenne, et
            n'en sort pas.
          </p>
          <p className="mt-2">
            En revanche, <strong className="text-white">Vercel</strong> et{' '}
            <strong className="text-white">Sentry</strong> sont des sociétés établies aux
            États-Unis. Les données techniques qu'elles traitent pour notre compte (adresse IP,
            journaux de connexion, rapports d'erreur expurgés) peuvent donc faire l'objet d'un
            transfert hors de l'Union. Ces transferts sont encadrés par les clauses
            contractuelles types de la Commission européenne ou par un mécanisme d'adéquation
            équivalent, prévus aux articles 45 et 46 du RGPD.
          </p>
          <p className="mt-2">
            Vous pouvez nous demander une copie des garanties applicables à l'adresse indiquée
            ci-dessous.
          </p>
        </Section>

        <Section title="8. Vos droits (RGPD)">
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong className="text-white">Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
            <li><strong className="text-white">Droit de rectification</strong> : corriger des informations inexactes depuis les paramètres</li>
            <li><strong className="text-white">Droit à l'effacement</strong> : supprimer votre compte et toutes vos données</li>
            <li><strong className="text-white">Droit à la portabilité</strong> : exporter vos données dans un format lisible</li>
            <li><strong className="text-white">Droit d'opposition</strong> : s'opposer à certains traitements</li>
            <li><strong className="text-white">Droit à la limitation</strong> : restreindre le traitement dans certains cas</li>
          </ul>
          <p className="mt-3">
            La portabilité s'exerce directement depuis <strong className="text-white">Paramètres, onglet Mes données</strong> :
            l'export couvre vos tâches, habitudes, événements, OKR, catégories, listes et votre profil,
            au format CSV.
          </p>
          <p className="mt-2">
            Pour tout autre droit : <a href="mailto:axellongattepro@gmail.com" className="text-blue-400 hover:underline">axellongattepro@gmail.com</a>.
            Nous répondons dans un délai d'<strong className="text-white">un mois</strong> à compter de la réception
            de votre demande, conformément à l'article 12 du RGPD. Ce délai peut être prolongé de deux mois
            en cas de demande complexe, auquel cas nous vous en informons dans le mois.
          </p>
          <p className="mt-2">Vous pouvez également saisir la <strong className="text-white">CNIL</strong> : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">www.cnil.fr</a></p>
        </Section>

        <Section title="9. Sécurité">
          <p>
            Toutes les communications entre votre navigateur et nos serveurs sont chiffrées via HTTPS/TLS. Les mots de passe sont stockés sous forme hachée (bcrypt via Supabase Auth). L'accès aux données est protégé par des politiques Row Level Security (RLS) côté base de données : chaque utilisateur n'accède qu'à ses propres données.
          </p>
        </Section>

        <Section title="10. Cookies et informations stockées sur votre appareil">
          <p>
            Les éléments suivants sont <strong className="text-white">strictement nécessaires</strong> au
            fonctionnement, et déposés sans votre consentement parce que le service ne peut pas s'en passer :
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Cookie de session Supabase (authentification)</li>
            <li>Préférences de l'interface stockées en localStorage (thème, filtres)</li>
            <li>Choix du consentement stocké en localStorage — c'est lui qui nous permet de respecter votre refus</li>
          </ul>
          <p className="mt-3">
            Les éléments suivants ne sont déposés{' '}
            <strong className="text-white">qu'après votre acceptation</strong> :
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>
              Un identifiant aléatoire déposé par Vesk dans le stockage local du navigateur, pour reconnaître une même
              visite d'une page à l'autre
            </li>
          </ul>
          <p className="mt-2 text-slate-400 text-sm">
            Aucun cookie publicitaire n'est déposé sur votre appareil, et aucune donnée n'est utilisée à des fins
            publicitaires.
          </p>
          <p className="mt-2 text-slate-400 text-sm">
            Nos deux outils de mesure d'audience (Vesk et Vercel Analytics) sont soumis à votre consentement :{' '}
            <strong className="text-white">ils ne sont chargés que si vous cliquez sur « Accepter »</strong>{' '}
            dans le bandeau. Tant que vous n'avez pas répondu, rien n'est chargé, et si vous refusez,
            ils ne le sont jamais. Votre choix est conservé sur votre appareil et vous pouvez en changer
            en effaçant les données du site.
          </p>
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
