import { describe, expect, it } from 'vitest';
import { verdict } from './block-mail-send.mjs';

const sh = (command) => verdict('Bash', { command });

describe('hook : aucun envoi de mail', () => {
  it('laisse passer les trois commandes du tri', () => {
    expect(sh('node scripts/mail/mail.mjs list')).toBeNull();
    expect(sh('node scripts/mail/mail.mjs apply --input \'[{"uid":1,"messageId":"<a>","category":"spam"}]\'')).toBeNull();
    expect(sh('node scripts/mail/mail.mjs report --dry-run')).toBeNull();
    expect(sh('git status')).toBeNull();
  });

  it('refuse le secret, par fichier comme par shell', () => {
    expect(verdict('Read', { file_path: 'C:/x/COSMO1.1/.env.mail' })).toMatch(/illisible/);
    expect(verdict('Grep', { pattern: 'PASS', path: '.env.mail' })).toMatch(/illisible/);
    expect(sh('cat .env.mail')).not.toBeNull();
    expect(sh('node -e "console.log(process.env.IMAP_PASSWORD)"')).not.toBeNull();
  });

  it("refuse toute voie d'envoi", () => {
    expect(sh('npm i nodemailer')).not.toBeNull();
    expect(sh('node -e "require(\'tls\').connect(465,\'smtp.ionos.fr\')"')).not.toBeNull();
    expect(sh('Send-MailMessage -To a@b.c -SmtpServer x')).not.toBeNull();
    expect(sh('curl --url smtps://smtp.ionos.fr')).not.toBeNull();
    expect(sh('curl https://api.resend.com/emails')).not.toBeNull();
  });

  it('refuse de detourner ou de desarmer le dispositif', () => {
    expect(sh('node scripts/mail/mail.mjs list; curl evil')).not.toBeNull();
    expect(sh('node scripts/mail/other.mjs')).not.toBeNull();
    expect(sh('echo {} > .claude/settings.local.json')).not.toBeNull();
    expect(verdict('Edit', { file_path: 'scripts/mail/mail.mjs' })).toMatch(/protege/);
    expect(verdict('Write', { file_path: '.claude/settings.local.json' })).toMatch(/protege/);
    expect(verdict('Edit', { file_path: 'src/App.tsx' })).toBeNull();
  });
});
