// Sonde C-56 — mesure le HAUT d'une modale a 375x350 (viewport Android,
// clavier ouvert), dans l'application reelle, en mode demo.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5287';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 375, height: Number(process.env.H ?? 350) } });

await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
// Mode demo : le bouton porte un libelle stable dans les deux locales.
await p.getByRole('button', { name: /d[ée]mo/i }).first().click();
await p.waitForURL(/dashboard/, { timeout: 20000 });
await p.waitForTimeout(1500);

async function probe(eventName, label) {
  await p.evaluate((e) => window.dispatchEvent(new Event(e)), eventName);
  await p.waitForTimeout(2500);
  console.log('  url=', p.url(), 'dialogs=', await p.locator('[role="dialog"]').count());
  const r = await p.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dlg) return { error: 'modale absente' };
    // Le conteneur de defilement : le premier ancetre qui deborde.
    let sc = dlg.parentElement;
    while (sc && sc.scrollHeight <= sc.clientHeight) sc = sc.parentElement;
    sc = sc ?? document.scrollingElement;
    sc.scrollTop = 0;
    const top0 = dlg.getBoundingClientRect().top;
    sc.scrollTop = 99999;
    const topMax = dlg.getBoundingClientRect().top;
    sc.scrollTop = 0;
    return {
      hauteurCarte: Math.round(dlg.getBoundingClientRect().height * 10) / 10,
      scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight,
      course: sc.scrollHeight - sc.clientHeight,
      hautAScrollZero: Math.round(top0 * 10) / 10,
      hautAScrollMax: Math.round(topMax * 10) / 10,
      hautAtteignable: top0 >= -0.5,
    };
  });
  console.log(label, JSON.stringify(r));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
}

await probe('open-bug-report', 'BugReportModal   ');
await probe('open-invite-join', 'InviteOrJoinModal');
await b.close();
