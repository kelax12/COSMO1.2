// Login interactif du CLI COSMO. À lancer PAR L'UTILISATEUR :
//   npm run cosmo:login
// Le compte étant Google-only, il n'y a pas de mot de passe : on passe par un
// code OTP envoyé par email. La session obtenue est persistée dans
// ~/.cosmo/session.json et rafraîchie automatiquement ensuite.
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createCosmoClient, SESSION_PATH, parseVerificationInput } from './client.mjs';

async function main() {
  const rl = readline.createInterface({ input, output });
  const client = createCosmoClient();

  try {
    const email = (await rl.question('Email du compte COSMO : ')).trim();
    if (!email) {
      console.error('Email vide, abandon.');
      process.exitCode = 1;
      return;
    }

    // shouldCreateUser: false — sans ça, une faute de frappe dans l'email
    // creerait silencieusement un nouveau compte.
    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      console.error(`Envoi du code impossible : ${otpError.message}`);
      console.error(
        'Si le message parle de provider desactive, active Email dans Supabase > Authentication > Providers.'
      );
      process.exitCode = 1;
      return;
    }

    console.log(`Email envoye a ${email}.`);
    console.log('Selon le template Supabase, tu recois soit un code numerique,');
    console.log('soit un lien « Log In ». Dans le second cas : copie le LIEN sans le');
    console.log('cliquer (appui long > Copier l adresse du lien) et colle-le ici.');

    const answer = await rl.question('Code ou lien : ');

    // parseVerificationInput lève une CosmoAuthError explicite si la saisie
    // n'est ni un code ni une URL — inutile de deviner ici.
    const parsed = parseVerificationInput(answer);

    // Ambiguïté réelle de GoTrue : pour un utilisateur EXISTANT, signInWithOtp
    // enregistre le jeton avec le type `magiclink`, alors que la doc du flux
    // « code a 6 chiffres » documente `email`. Selon la version deployee, l'un
    // des deux est refuse. On essaie donc les deux avant d'abandonner.
    const attempts =
      parsed.kind === 'otp'
        ? [
            { email, token: parsed.token, type: 'email' },
            { email, token: parsed.token, type: 'magiclink' },
          ]
        : [{ token_hash: parsed.tokenHash, type: parsed.type }];

    let data = null;
    let error = null;
    for (const payload of attempts) {
      ({ data, error } = await client.auth.verifyOtp(payload));
      if (!error) break;
      console.error(`  (essai type=${payload.type} refuse : ${error.message})`);
    }

    if (error) {
      console.error('');
      console.error(`Verification refusee : ${error.message}`);
      console.error(`  name=${error.name ?? '?'} status=${error.status ?? '?'} code=${error.code ?? '?'}`);
      console.error('');
      console.error('Causes frequentes :');
      console.error(' - le code vient d un email plus ancien : seul le DERNIER envoi est valide ;');
      console.error(' - le lien a deja ete ouvert dans un navigateur, donc consomme ;');
      console.error(' - le code a expire (1 h par defaut).');
      console.error('Relance la commande pour recevoir un nouvel email, et utilise CELUI-LA.');
      process.exitCode = 1;
      return;
    }

    console.log(`Connecte en tant que ${data.user.email}.`);
    console.log(`Session enregistree dans ${SESSION_PATH}`);
    console.log('Tu peux maintenant lancer : npm run cosmo -- tasks list');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
