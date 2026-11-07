# Politique de divulgation responsable

Vous pensez avoir trouvé une faille de sécurité dans COSMO (l'application, ses API, ses Edge Functions
ou ce dépôt) ? Merci de nous la signaler en privé, de façon à ce qu'elle soit corrigée avant d'être
connue.

## Comment signaler

Écrivez à **contact@thecosmo.app**, l'adresse de contact publiée sur le site (mentions légales).
Mettez `[SECURITE]` au début de l'objet.

Ne signalez **pas** une faille dans une issue ou une discussion publique du dépôt : elle serait
visible de tous avant d'être corrigée.

Un bon signalement contient :

- l'URL, la route ou le fichier concerné ;
- les étapes pour reproduire, ou une preuve de concept minimale ;
- ce que la faille permet, à votre avis ;
- votre nom ou pseudonyme si vous souhaitez être remercié.

Écrivez en français ou en anglais.

## Ce que vous pouvez attendre de nous

- Un **accusé de réception sous 5 jours ouvrés**. COSMO est tenu par une seule personne : ce délai est
  un objectif honnête, pas un contrat.
- Une première évaluation (reproduite ou non, gravité estimée), puis des nouvelles à chaque étape
  importante.
- Une correction aussi vite que sa gravité le demande. Nous ne promettons pas de délai de correction
  avant de l'avoir évaluée.
- Aucune action en justice contre une personne qui respecte cette politique de bonne foi.

Nous vous demandons de **ne rien publier** avant que la faille soit corrigée, ou avant 90 jours après
votre signalement si nous restons sans nouvelles de notre côté.

## Règles du jeu

Vous devez :

- n'accéder qu'à vos propres comptes et à vos propres données, ou à des comptes de test que vous
  avez créés ;
- vous arrêter dès que la faille est démontrée : une seule ligne ou un seul objet qui prouve l'accès
  suffit ;
- nous signaler, sans les conserver ni les copier, les données d'autrui que vous auriez vues par
  accident.

Vous ne devez pas :

- tester de façon destructive : supprimer, modifier ou corrompre des données qui ne sont pas les vôtres ;
- accéder aux données d'un autre utilisateur ou d'une autre organisation, même « pour voir » ;
- mener d'attaque par déni de service, de saturation ou de volume (scan massif, brute force,
  inondation de requêtes) ;
- faire de l'ingénierie sociale, de l'hameçonnage, ou viser l'équipe, des utilisateurs ou des
  prestataires ;
- tester des paiements réels ou chercher à obtenir un remboursement ou un avantage indu.

## Hors périmètre

Ces signalements ne sont pas traités comme des failles :

- les rapports d'outils automatiques envoyés sans analyse ni preuve d'impact ;
- l'absence d'un en-tête ou d'une bonne pratique sans exploitation démontrée ;
- les failles de nos prestataires (Vercel, Supabase, Stripe, Sentry…) : signalez-les à leurs
  équipes ;
- les attaques qui exigent un appareil déjà compromis, ou le contrôle de la boîte mail de la
  victime ;
- le contenu d'une page de démonstration, qui tourne dans votre navigateur sur `localStorage` ;
- les dépendances vulnérables dont le code vulnérable n'est pas atteignable dans COSMO.

## Pas de programme de récompense

COSMO ne propose pas de prime à ce jour. Nous remercions volontiers, avec votre accord, les personnes
qui nous aident.

Pour toute autre question que la sécurité, voir [`README.md`](./README.md) et
[`CONTRIBUTING.md`](./CONTRIBUTING.md).
