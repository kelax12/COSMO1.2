// ═══════════════════════════════════════════════════════════════════
// block-mail-send.mjs · HOOK PreToolUse : AUCUN ENVOI DE MAIL, AUCUN ACCES AU SECRET
//
// Branche dans .claude/settings.local.json (PreToolUse, tous outils). C'est
// Claude Code qui l'execute, pas le modele : une injection de prompt dans un
// mail lu par le skill `tri-mails` ne peut ni le contourner ni le desactiver.
//
// Refuse (exit 2) :
//   · toute lecture, recherche ou ecriture de `.env.mail` par un outil fichier ;
//   · toute commande shell qui nomme `.env.mail`, IMAP_PASSWORD, SMTP, un port
//     d'envoi (25/465/587), une bibliotheque ou cmdlet d'envoi ;
//   · toute commande shell qui touche scripts/mail/ ou ce fichier autrement
//     qu'en lancant `node scripts/mail/mail.mjs list|apply|report` ;
//   · toute modification de scripts/mail/ et des fichiers de reglages Claude.
// ⚠️ Filet en profondeur, pas une preuve : le verrou dur cote reseau est la
//    regle de pare-feu decrite dans le skill (ports d'envoi bloques).
// ═══════════════════════════════════════════════════════════════════
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SHELL_DENY = [
  /\.env\.mail/i,
  /IMAP_PASSWORD/i,
  /smtp/i,
  /nodemailer|emailjs|sendmail|msmtp|swaks|mutt\b|mailx?\b/i,
  /Send-MailMessage|System\.Net\.Mail|MailKit|SmtpClient/i,
  /(?:^|[^\d])(?:25|465|587|2525)(?:[^\d]|$).*(?:ionos|mail|tcp|socket|connect)|(?:ionos|mail|tcp|socket|connect).*(?:[^\d])(?:25|465|587|2525)(?:[^\d]|$)/i,
  /resend\.com|api\.resend|sendgrid|mailgun|postmark|brevo|sendinblue/i,
  /block-mail-send/i,
  /settings(\.local)?\.json/i,
];
// `apply` porte des Message-ID (`<...>`) : admis seulement dans UN argument entre
// apostrophes, ou ni bash ni PowerShell n'interpretent rien.
const ALLOWED_MAIL_CMD =
  /^\s*node\s+scripts[\\/]mail[\\/]mail\.mjs\s+(?:(?:list|report)(?:\s+--[a-z-]+(?:\s+\d+)?)*|apply\s+--input\s+'[^']*')\s*$/;
const PROTECTED_PATH = /(\.env\.mail|scripts[\\/]mail[\\/]|\.claude[\\/]settings(\.local)?\.json|\.claude[\\/]skills[\\/]tri-mails)/i;

/** Rend la raison du refus, ou null si l'appel peut passer. */
export function verdict(toolName, input = {}) {
  const command = input.command;
  if (typeof command === 'string') {
    if (ALLOWED_MAIL_CMD.test(command)) return null;
    if (/scripts[\\/]mail/i.test(command)) return 'scripts/mail/ ne se lance que par node scripts/mail/mail.mjs list|apply|report';
    const hit = SHELL_DENY.find((re) => re.test(command));
    return hit ? `commande refusee (envoi de mail / secret mail) : ${hit}` : null;
  }
  const target = [input.file_path, input.path, input.notebook_path, input.pattern].filter(Boolean).join(' ');
  if (/\.env\.mail/i.test(target)) return '.env.mail est illisible pour Claude';
  const writes = ['Write', 'Edit', 'NotebookEdit', 'MultiEdit'].includes(toolName);
  if (writes && PROTECTED_PATH.test(target)) return `fichier protege contre l'ecriture : ${target}`;
  return null;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    // Entree illisible : on refuse plutot que de laisser passer.
    console.error('block-mail-send : entree illisible, appel refuse.');
    process.exit(2);
  }
  const reason = verdict(payload.tool_name, payload.tool_input);
  if (reason) {
    console.error(`block-mail-send : ${reason}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
