import { chromium } from 'playwright';
const url = 'file:///C:/Users/Axel/AppData/Local/Temp/claude/C--Users-Axel-Documents-COSMO1-1/660ec15d-a8fe-4ee3-ae7b-1f89fbf739ab/scratchpad/c56.html';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 900 } });
await p.goto(url);
console.log(JSON.stringify(await p.evaluate(() => window.__c56), null, 2));
await b.close();
