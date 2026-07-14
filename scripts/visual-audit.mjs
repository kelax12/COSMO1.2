/**
 * visual-audit.mjs — Check-up visuel FINAL complet COSMO 1.2
 * Couvre TOUTES les surfaces : pages publiques + protected + modals/popovers/sheets.
 * Usage : node scripts/visual-audit.mjs
 * Prérequis : npm start (port 3000)
 */
import { chromium, devices } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'visual-audit');
const BASE = 'http://localhost:3000';

const VIEWPORTS = {
  mobile:  { width: 390, height: 844, isMobile: true,  hasTouch: true,  userAgent: devices['iPhone 14'].userAgent },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
};

// ─── Détecteurs programmatiques ───────────────────────────────────────────────
const DETECTORS = `(function(){
  const iw=window.innerWidth,ih=window.innerHeight,f=[];
  if(document.documentElement.scrollWidth>iw+2){
    const o=[...document.querySelectorAll('*')].filter(el=>{const r=el.getBoundingClientRect();return r.right>iw+2&&r.width>0&&r.height>0&&getComputedStyle(el).display!=='none';}).slice(0,5).map(el=>el.tagName+(el.className?'.'+el.className.toString().split(' ').filter(Boolean).slice(0,2).join('.'):''));
    f.push({type:'overflow-x',severity:'high',detail:'sw='+document.documentElement.scrollWidth,offenders:o});
  }
  const br=[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src.slice(-50));
  if(br.length)f.push({type:'broken-images',severity:'high',detail:br.join(', ')});
  const st=[...document.querySelectorAll('button,a,[role="button"],[role="checkbox"],[role="tab"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<44||r.height<44)&&getComputedStyle(el).display!=='none'&&r.top>0&&r.top<ih;}).slice(0,5).map(el=>{const r=el.getBoundingClientRect();return(el.ariaLabel||el.textContent||el.tagName).slice(0,30).trim()+' ('+Math.round(r.width)+'x'+Math.round(r.height)+')'});
  if(st.length)f.push({type:'small-targets',severity:'medium',detail:st.join('; ')});
  const tb=ih-64;
  const mb=[...document.querySelectorAll('button,a,input,[role="button"]')].filter(el=>{const r=el.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;return cy>tb&&cy<ih&&cx>0&&cx<iw&&r.width>0&&getComputedStyle(el).display!=='none';}).slice(0,3).map(el=>(el.ariaLabel||el.textContent||el.tagName).slice(0,30).trim());
  if(mb.length)f.push({type:'masked-by-tabbar',severity:'high',detail:mb.join('; ')});
  return f;
})()`;

const SUPPRESS_OVERLAYS = `
  localStorage.removeItem('cosmo_onboarding_pending');
  ['tasks','agenda','habits','okr'].forEach(p=>{
    localStorage.setItem('cosmo_tutorial_seen_'+p+'_desktop','1');
    localStorage.setItem('cosmo_tutorial_seen_'+p+'_mobile','1');
    localStorage.setItem('cosmo_tutorial_seen_'+p,'1');
  });
  localStorage.setItem('cosmo:last-checkin-week','2026-W25');
  localStorage.setItem('cosmo_swipe_hint_anim_seen','1');
  localStorage.setItem('cosmo_swipe_hint_dismissed','1');
  localStorage.setItem('cosmo_adwall_habits_'+new Date().toLocaleDateString('en-CA'),'1');
`;
const SET_LIGHT = `localStorage.setItem('theme','light');document.documentElement.classList.remove('dark','test','monochrome','glass');`;
const SET_DARK  = `localStorage.setItem('theme','dark');document.documentElement.classList.remove('light','test','monochrome','glass');document.documentElement.classList.add('dark');`;

function slug(s){ return s.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase(); }
function mkdir(p){ if(!existsSync(p)) mkdirSync(p,{recursive:true}); }
async function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

// Force les éléments quasi-invisibles (revert FM v12 WAAPI fill:'auto') à opacity:1
async function forceOpacity(page){
  await page.evaluate(()=>{
    for(const el of document.querySelectorAll('*')){
      try{
        const s=getComputedStyle(el);
        if(parseFloat(s.opacity)<0.1&&s.display!=='none') el.style.setProperty('opacity','1','important');
        if(s.transform&&s.transform!=='none'&&s.transform!=='matrix(1, 0, 0, 1, 0, 0)'){
          try{ const m=new DOMMatrix(s.transform); if(Math.abs(m.m41)>3||Math.abs(m.m42)>3) el.style.setProperty('transform','none','important'); }catch(_){}
        }
      }catch(_){}
    }
  }).catch(()=>{});
}

async function killAnimations(page){
  await page.evaluate(()=>{
    if(document.getElementById('__audit-no-anim')) return;
    const s=document.createElement('style');
    s.id='__audit-no-anim';
    s.textContent='*,*::before,*::after{animation-duration:1ms!important;animation-delay:0ms!important;transition-duration:1ms!important;transition-delay:0ms!important;}';
    document.head.appendChild(s);
    try{ document.getAnimations().forEach(a=>{try{a.updatePlaybackRate(100);}catch(_){}}); }catch(_){}
  }).catch(()=>{});
  await wait(150);
}

async function waitForContent(page, timeoutMs=6000){
  await killAnimations(page);
  await page.waitForFunction(()=>{
    const h1=document.querySelector('h1');
    const main=document.querySelector('main');
    function ok(el){ return el&&el.textContent.trim().length>2; }
    function visible(el){ let n=el; while(n&&n!==document.body){ const s=getComputedStyle(n); if(s.display==='none'||s.visibility==='hidden') return false; n=n.parentElement; } return true; }
    if(h1&&ok(h1)&&visible(h1)) return true;
    if(!main) return false;
    return [...main.querySelectorAll('p,h2,h3,[class*="card"],[class*="Card"]')].some(el=>ok(el)&&visible(el));
  },{timeout:timeoutMs}).catch(()=>{});
  await wait(200);
}

async function capture(page, label, outDir){
  await wait(300);
  await killAnimations(page);
  await forceOpacity(page);
  const findings = await page.evaluate(DETECTORS).catch(()=>[]);
  const filename = slug(label)+'.png';
  await page.screenshot({ path: join(outDir, filename), fullPage: false });
  return { label, filename, findings };
}

async function loginDemo(page){
  await page.goto(BASE+'/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(()=>{});
  await wait(1500);
  const btn = page.getByRole('button', { name: /essayer.*sans inscription/i }).first();
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  await btn.click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  await wait(2000);
  await page.evaluate(SUPPRESS_OVERLAYS);
  await wait(500);
}

// Navigation SPA — jamais goto() sur les routes protégées
async function navByClick(page, nameRegex, urlRegex){
  const link = page.getByRole('link', { name: nameRegex }).filter({ visible: true }).first();
  if(await link.isVisible().catch(()=>false)){
    await link.click({ force: true });
  } else {
    // Mobile MobileMoreSheet — DOM click bypasse WAAPI revert et z-index
    const clicked = await page.evaluate(()=>{
      const btn = document.querySelector('[aria-label="Plus d\'options"]');
      if(btn){ btn.click(); return true; }
      return false;
    }).catch(()=>false);
    if(clicked){
      await wait(700);
      const sheetClicked = await page.evaluate((pattern)=>{
        const re = new RegExp(pattern, 'i');
        const target = [...document.querySelectorAll('button,a')].find(el=>re.test((el.textContent||'').trim())||re.test(el.ariaLabel||''));
        if(target){ target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
        return false;
      }, nameRegex.source).catch(()=>false);
      if(!sheetClicked){
        await page.getByRole('link',{name:nameRegex}).or(page.getByRole('button',{name:nameRegex})).first().click({force:true,timeout:3000}).catch(()=>{});
      }
    }
  }
  if(urlRegex) await page.waitForURL(urlRegex,{timeout:8000}).catch(()=>{});
  await wait(600);
}

async function closeModal(page){
  await page.keyboard.press('Escape').catch(()=>{});
  await wait(200);
  await page.evaluate(()=>{
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true,cancelable:true,composed:true}));
  }).catch(()=>{});
  await wait(200);
  // Clic backdrop pour Framer Motion bottom-sheets
  await page.evaluate(()=>{
    document.querySelectorAll('.fixed.inset-0').forEach(el=>{
      el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:10,clientY:10}));
    });
  }).catch(()=>{});
  await wait(400);
}

async function dismissBanners(page){
  // Cookie banner
  const cookieBtn = page.locator('[aria-label="Bannière cookies"] button').last();
  if(await cookieBtn.isVisible({timeout:500}).catch(()=>false)){ await cookieBtn.click({force:true}); await wait(300); }
  // Tous les overlays fixes
  for(let i=0;i<5;i++){
    const has = await page.evaluate(()=>[...document.querySelectorAll('[role="dialog"],.fixed.inset-0')].some(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.opacity)>0.05;})).catch(()=>false);
    if(!has) break;
    await page.keyboard.press('Escape').catch(()=>{});
    await page.evaluate(()=>{
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true,cancelable:true,composed:true}));
    }).catch(()=>{});
    await wait(150);
    await page.evaluate(()=>{
      document.querySelectorAll('.fixed.inset-0').forEach(el=>{
        el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:10,clientY:10}));
      });
    }).catch(()=>{});
    await wait(300);
    await page.mouse.click(10,10).catch(()=>{});
    await wait(200);
    // Nucléaire si encore présent
    await page.evaluate(()=>{
      document.querySelectorAll('.fixed.inset-0').forEach(el=>{
        const s=getComputedStyle(el);
        if(parseFloat(s.opacity)>0.05&&s.display!=='none') el.remove();
      });
    }).catch(()=>{});
    await wait(200);
  }
}

// Clique un bouton via evaluate (bypasse z-index et WAAPI)
async function evalClick(page, selector){
  return page.evaluate((sel)=>{
    const el = document.querySelector(sel);
    if(el){ el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
    return false;
  }, selector).catch(()=>false);
}

// Trouve et clique via lucide icon class dans les boutons
async function clickByIcon(page, iconClass){
  return page.evaluate((cls)=>{
    const target = [...document.querySelectorAll('button')].find(b=>b.querySelector(cls));
    if(target){ target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
    return false;
  }, iconClass).catch(()=>false);
}

// ─── runAudit ─────────────────────────────────────────────────────────────────
async function runAudit(browser, vpName, theme){
  const vp = VIEWPORTS[vpName];
  const isMobile = vp.isMobile;
  const outDir = join(OUT, `${vpName}-${theme}`);
  mkdir(outDir);

  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile, hasTouch: vp.hasTouch, userAgent: vp.userAgent,
  });
  const page = await ctx.newPage();
  const results = [];

  const cap = (label) => capture(page, label, outDir).then(r=>{ results.push(r); return r; });
  const setTheme = () => page.evaluate(theme==='dark' ? SET_DARK : SET_LIGHT);
  const dismiss = () => dismissBanners(page);
  const close = () => closeModal(page);

  // Détection d'ouverture de modal ROBUSTE : Radix Dialog (role=dialog) OU
  // overlay custom `fixed inset-0` (HabitModal/EventModal/ColorSettingsModal/
  // AddToListModal n'ont PAS de role=dialog — cause des 12 modals non capturés).
  const modalOpen = (timeout=2000) => page.waitForFunction(()=>{
    if([...document.querySelectorAll('[role="dialog"]')].some(d=>d.offsetParent!==null)) return true;
    return [...document.querySelectorAll('.fixed.inset-0,[class*="fixed inset-0"]')].some(el=>{
      const r=el.getBoundingClientRect();
      return r.width>100&&r.height>100&&parseFloat(getComputedStyle(el).opacity)>0.1&&el.querySelector('button,input,textarea,h2,h3,[role="dialog"]');
    });
  },{timeout}).then(()=>true).catch(()=>false);

  try {
    // ═══════════════════════════════════════════════════════
    // A. PAGES PUBLIQUES (goto autorisé)
    // ═══════════════════════════════════════════════════════

    // Landing
    await page.goto(BASE+'/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('load', { timeout: 30000 }).catch(()=>{});
    await wait(2000); await setTheme();
    await waitForContent(page, 8000);
    await cap('landing-default');

    // Landing → LoginModal
    const loginBtn = page.getByRole('button', { name: /^connexion$/i }).first();
    if(await loginBtn.isVisible({timeout:3000}).catch(()=>false)){
      await loginBtn.click(); await wait(600);
      await cap('landing-login-modal');
      await close();
    }

    // /login
    await page.goto(BASE+'/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(1500); await setTheme(); await waitForContent(page);
    await cap('login-page');

    // /signup
    await page.goto(BASE+'/signup', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(1500); await setTheme(); await waitForContent(page);
    await cap('signup-page');

    // /guide
    await page.goto(BASE+'/guide', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(1500); await setTheme(); await waitForContent(page);
    await cap('guide-page');

    // /mentions-legales
    await page.goto(BASE+'/mentions-legales', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(1500); await setTheme(); await waitForContent(page);
    await cap('legal-mentions');

    // /politique-confidentialite
    await page.goto(BASE+'/politique-confidentialite', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(1500); await setTheme(); await waitForContent(page);
    await cap('politique-confidentialite');

    // /cgu
    await page.goto(BASE+'/cgu', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await wait(1500); await setTheme(); await waitForContent(page);
    await cap('cgu');

    // ═══════════════════════════════════════════════════════
    // B. LOGIN DÉMO → APP
    // ═══════════════════════════════════════════════════════
    await loginDemo(page);
    await setTheme(); await wait(500); await dismiss();

    // ═══════════════════════════════════════════════════════
    // C. DASHBOARD
    // ═══════════════════════════════════════════════════════
    await waitForContent(page);
    await cap('dashboard-default');

    // Période Semaine
    const weekBtn = page.getByRole('button', { name: /^semaine$/i }).filter({ visible: true }).first();
    if(await weekBtn.isVisible({timeout:2000}).catch(()=>false)){
      await weekBtn.click(); await wait(400);
      await cap('dashboard-period-week');
    }
    // Période Mois
    const moisBtnD = page.getByRole('button', { name: /^mois$/i }).filter({ visible: true }).first();
    if(await moisBtnD.isVisible({timeout:2000}).catch(()=>false)){
      await moisBtnD.click(); await wait(400);
      await cap('dashboard-period-month');
    }

    // InboxMenu (cloche/notifications)
    const inboxClicked = await page.evaluate(()=>{
      const btns = [...document.querySelectorAll('button')];
      const t = btns.find(b=>b.querySelector('.lucide-bell,.lucide-inbox')||(b.ariaLabel&&/inbox|notif|cloche/i.test(b.ariaLabel)));
      if(t){ t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
      return false;
    }).catch(()=>false);
    if(inboxClicked){
      await wait(600);
      if(await page.locator('[role="dialog"],[data-radix-popper-content-wrapper]').isVisible({timeout:2000}).catch(()=>false)){
        await cap('dashboard-inbox-open');
      }
      await close(); await dismiss();
    }

    // ═══════════════════════════════════════════════════════
    // D. TÂCHES
    // ═══════════════════════════════════════════════════════
    await navByClick(page, /to ?do|tâches|tasks/i, /\/tasks/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(500); await dismiss();
    await waitForContent(page);
    await cap('tasks-default');

    // Calendrier (vue Semaine)
    const calToggle = page.locator('[data-tutorial-id="tasks-calendar-toggle"]').first();
    if(await calToggle.isVisible({timeout:2000}).catch(()=>false)){
      await calToggle.click(); await wait(800);
      await cap('tasks-calendar-week');
      // Attendre que les boutons de vue apparaissent dans le calendrier
      await page.waitForFunction(()=>{
        const btns=[...document.querySelectorAll('button')];
        return btns.some(b=>/^mois$/i.test((b.textContent||'').trim()));
      },{timeout:3000}).catch(()=>{});
      // Vue Mois calendrier — evaluate pour trouver le bouton exact
      const monthCalClicked = await page.evaluate(()=>{
        const btns=[...document.querySelectorAll('button')];
        const t=btns.find(b=>/^mois$/i.test((b.textContent||'').trim())&&getComputedStyle(b).display!=='none');
        if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
        return false;
      }).catch(()=>false);
      if(monthCalClicked){ await wait(500); await cap('tasks-calendar-month'); }
      // Retour Semaine
      await page.evaluate(()=>{
        const btns=[...document.querySelectorAll('button')];
        const t=btns.find(b=>/^semaine$/i.test((b.textContent||'').trim())&&getComputedStyle(b).display!=='none');
        if(t) t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      }).catch(()=>{});
      await wait(400);
      await calToggle.click().catch(()=>{}); await wait(400);
    }

    // Filtres rapides mobile — aria-label exact confirmé dans TaskFilter.tsx
    if(isMobile){
      const moreFilters = page.locator('button[aria-label="Afficher les options"]').first()
        .or(page.locator('button[aria-label="Masquer les options"]').first());
      if(await moreFilters.isVisible({timeout:1500}).catch(()=>false)){
        await moreFilters.click(); await wait(400);
        await cap('tasks-mobile-quick-filters');
        await moreFilters.click().catch(()=>{}); await wait(300);
      }
    }

    // SmartListMenu ✨ — aria-label exact confirmé dans SmartListMenu.tsx
    await dismiss();
    const sparkleBtn = page.locator('button[aria-label="Créer une liste intelligente"]').first();
    if(await sparkleBtn.isVisible({timeout:1500}).catch(()=>false)){
      await sparkleBtn.click({force:true}); await wait(600);
      // SmartListMenu = createPortal fixed — chercher dans body
      const popVisible = await page.evaluate(()=>{
        // Le menu est rendu via createPortal avec position fixed z-[9999]
        const fixed=[...document.querySelectorAll('body > div,[data-radix-popper-content-wrapper]')];
        return fixed.some(el=>getComputedStyle(el).display!=='none'&&parseFloat(getComputedStyle(el).opacity)>0.05&&el.querySelector('button,li'));
      }).catch(()=>false);
      if(popVisible){ await cap('tasks-smartlist-menu'); }
      await page.keyboard.press('Escape').catch(()=>{}); await wait(300);
      await dismiss();
    }

    // ListActionsSheet — long press sur un chip de liste nommée (bottom-sheet)
    await dismiss();
    const chipBox = await page.evaluate(()=>{
      const listArea = document.querySelector('[data-tutorial-id="tasks-lists"]');
      if(!listArea) return null;
      const btns=[...listArea.querySelectorAll('button')];
      const chip = btns.find(b=>{
        const r=b.getBoundingClientRect();
        return r.width>0&&r.height>0&&r.top>0&&(b.textContent||'').trim().length>1;
      });
      if(!chip) return null;
      const r=chip.getBoundingClientRect();
      return {x:r.left+r.width/2, y:r.top+r.height/2};
    }).catch(()=>null);
    if(chipBox){
      await page.mouse.move(chipBox.x, chipBox.y);
      await page.mouse.down(); await wait(750); await page.mouse.up(); await wait(600);
      if(await modalOpen(1500)){ await cap('tasks-list-actions-sheet'); await close(); }
    }

    // AddTaskForm (bouton créer ou FAB)
    await dismiss(); await wait(400);
    const createBtn = isMobile
      ? page.locator('[data-tutorial-id="global-quick-add-fab"]').first()
      : page.locator('[data-tutorial-id="tasks-create-button"]').first();
    if(await createBtn.isVisible({timeout:2000}).catch(()=>false)){
      await createBtn.click({force:true}); await wait(700);
      if(await modalOpen(2000)){ await cap('tasks-add-task-form'); }
      await close();
    }

    // ── Modals d'action par tâche ────────────────────────────────────────────
    // Desktop = menu déroulant « Actions pour {nom} » ; mobile = bouton
    // « Afficher les actions » qui révèle les boutons d'action de la carte.
    const openTaskAction = async (labelRe) => {
      await dismiss(); await wait(300);
      // étape 1 : révéler les actions
      await page.evaluate(()=>{
        const trig=[...document.querySelectorAll('button')].find(b=>/^Actions pour /i.test(b.getAttribute('aria-label')||''));
        if(trig) trig.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
        const rev=document.querySelector('button[aria-label="Afficher les actions"]');
        if(rev) rev.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      }).catch(()=>{});
      await wait(500);
      // étape 2 : cliquer l'item (aria-label mobile OU texte du menu desktop)
      return page.evaluate((src)=>{
        const re=new RegExp(src,'i');
        const a=[...document.querySelectorAll('button,[role="menuitem"],a')]
          .find(b=>re.test(b.getAttribute('aria-label')||'')||re.test((b.textContent||'').trim()));
        if(a){ a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
        return false;
      }, labelRe.source).catch(()=>false);
    };

    // AddToListModal — action « Ajouter à une liste » (overlay custom)
    if(await openTaskAction(/ajouter à une liste/i)){
      await wait(500);
      if(await modalOpen(2000)){ await cap('tasks-add-to-list-modal'); await close(); }
    }

    // TaskModal vue Collaborateurs (= « step 2 ») — action collaborateur
    // (desktop = « Collaborateur », mobile aria-label = « Ajouter un collaborateur »)
    await dismiss();
    if(await openTaskAction(/collaborateur/i)){
      await wait(600);
      if(await modalOpen(2500)){ await cap('tasks-task-modal-step2'); await close(); }
    }

    // TaskModal (clic ligne desktop / corps de carte mobile) + DeleteTaskConfirm
    await dismiss(); await wait(400);
    if(!isMobile){
      const taskRow = page.locator('table tbody tr').first();
      if(await taskRow.isVisible({timeout:3000}).catch(()=>false)){
        await taskRow.click({force:true}); await wait(700);
        if(await modalOpen(3000)){
          await cap('tasks-task-modal');
          const deleteClicked = await page.evaluate(()=>{
            const dialog=document.querySelector('[role="dialog"]')||[...document.querySelectorAll('.fixed.inset-0')].pop();
            if(!dialog) return false;
            const btns=[...dialog.querySelectorAll('button')];
            const t=btns.find(b=>{
              const svg=b.querySelector('svg'); const cl=svg&&(svg.getAttribute('class')||'');
              return (cl&&(cl.includes('trash')||cl.includes('Trash')))||/supprimer|delete/i.test(b.ariaLabel||b.textContent||'');
            });
            if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
            return false;
          }).catch(()=>false);
          if(deleteClicked){ await wait(400); if(await modalOpen(1500)){ await cap('tasks-delete-confirm'); } }
          await close();
        }
      }
    } else {
      // Mobile : clic sur le corps de la carte → onSelectTask → TaskModal full-screen
      const clicked = await page.evaluate(()=>{
        const card=[...document.querySelectorAll('div')].find(el=>{
          const c=el.className;
          return typeof c==='string'&&c.includes('items-stretch')&&c.includes('rounded-xl')
            &&el.getBoundingClientRect().width>200&&el.getBoundingClientRect().top>110;
        });
        if(card){ card.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; }
        return false;
      }).catch(()=>false);
      if(clicked){
        await wait(700);
        if(await modalOpen(2500)){ await cap('tasks-task-modal-mobile'); await close(); }
      }
    }

    // ═══════════════════════════════════════════════════════
    // E. AGENDA
    // ═══════════════════════════════════════════════════════
    await dismiss();
    await navByClick(page, /agenda/i, /\/agenda/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(1000); await dismiss();
    await waitForContent(page, 8000);
    await cap('agenda-default');

    // Vue Mois (desktop)
    if(!isMobile){
      const agendaMonth = page.getByRole('button', { name: /^mois$|^month$/i }).filter({ visible: true }).first();
      if(await agendaMonth.isVisible({timeout:1500}).catch(()=>false)){
        await agendaMonth.click(); await wait(800);
        await cap('agenda-month-view');
        // Retour Semaine
        const agendaWeek = page.getByRole('button', { name: /^semaine$|^week$/i }).filter({ visible: true }).first();
        if(await agendaWeek.isVisible({timeout:1500}).catch(()=>false)){ await agendaWeek.click(); await wait(600); }
      }
    }

    // Sidebar toggle (desktop)
    if(!isMobile){
      const sidebarToggle = page.locator('[data-tutorial-id="agenda-task-sidebar-toggle"]').first();
      if(await sidebarToggle.isVisible({timeout:2000}).catch(()=>false)){
        await sidebarToggle.click(); await wait(500);
        await cap('agenda-sidebar-hidden');
        await sidebarToggle.click(); await wait(400);
      }
    }

    // Vue Jour mobile
    if(isMobile){
      const dayView = page.getByRole('button', { name: /^jour$|^day$/i }).filter({ visible: true }).first();
      if(await dayView.isVisible({timeout:1500}).catch(()=>false)){
        await dayView.click(); await wait(600);
        await cap('agenda-mobile-day');
      }
    }

    // EventModal — clic sur créneau horaire vide (desktop uniquement)
    if(!isMobile){
      // S'assurer qu'on est en vue Semaine (timegrid) — pas Mois
      const inTimegrid = await page.locator('.fc-timegrid-col').first().isVisible({timeout:3000}).catch(()=>false);
      if(!inTimegrid){
        // Forcer retour vue Semaine
        await page.evaluate(()=>{
          const btns=[...document.querySelectorAll('button')];
          const t=btns.find(b=>/^semaine$/i.test((b.textContent||'').trim()));
          if(t) t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
        }).catch(()=>{});
        await wait(800);
      }
      // Purger tout overlay résiduel
      await dismiss();
      // Clic via mouse.click sur la position exacte du slot (FullCalendar répond aux coords)
      const slotBox = await page.locator('.fc-timegrid-slot-lane').nth(8).boundingBox().catch(()=>null);
      if(slotBox){
        await page.mouse.click(slotBox.x + slotBox.width * 0.3, slotBox.y + slotBox.height * 0.5);
        await wait(800);
        if(await modalOpen(2000)){ await cap('agenda-event-modal-add'); await close(); }
      }
      // Clic sur un event existant — mouse.click avec coordonnées réelles
      await dismiss();
      const evBox = await page.locator('.fc-event:not(.fc-event-mirror)').first().boundingBox().catch(()=>null);
      if(evBox){
        await page.mouse.click(evBox.x + evBox.width * 0.5, evBox.y + evBox.height * 0.5);
        await wait(700);
        if(await modalOpen(2000)){
          await cap('agenda-event-modal-edit');
          // DeleteEventConfirm — scoper à l'overlay EventModal (custom, pas role=dialog)
          const delEv = await page.evaluate(()=>{
            const modal=document.querySelector('[role="dialog"]')||[...document.querySelectorAll('.fixed.inset-0')].pop();
            const btns=[...(modal?.querySelectorAll('button')||[])];
            const t=btns.find(b=>{
              const svg=b.querySelector('svg');const cl=svg&&(svg.getAttribute('class')||'');
              return (cl&&(cl.includes('trash')||cl.includes('Trash')))||/supprimer|delete/i.test(b.ariaLabel||b.textContent||'');
            });
            if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
            return false;
          }).catch(()=>false);
          if(delEv){
            await wait(400);
            if(await modalOpen(1500)){ await cap('agenda-delete-event-confirm'); }
          }
          await close();
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // F. HABITUDES
    // ═══════════════════════════════════════════════════════
    await dismiss();
    await navByClick(page, /habitudes|habits/i, /\/habits/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(600); await dismiss();
    await waitForContent(page);
    // Vue Tableau (défaut)
    await cap('habits-table-view');

    // Vue switcher
    const habSwitcher = page.locator('[data-tutorial-id="habits-view-switcher"]').first();
    if(await habSwitcher.isVisible({timeout:2000}).catch(()=>false)){
      // Vue Liste
      const listV = page.getByRole('button', { name: /^liste$|^list$/i }).filter({ visible: true }).first();
      if(await listV.isVisible({timeout:1500}).catch(()=>false)){
        await listV.click(); await wait(500);
        await cap('habits-list-view');
      }
      // Vue Suivi global
      const globalV = page.getByRole('button', { name: /suivi|global/i }).filter({ visible: true }).first();
      if(await globalV.isVisible({timeout:1500}).catch(()=>false)){
        await globalV.click(); await wait(800);
        await cap('habits-global-view');
      }
      // Retour Liste pour les captures suivantes
      if(await listV.isVisible({timeout:1000}).catch(()=>false)){
        await listV.click(); await wait(400);
      }
    }

    // HabitActionsMenu — aria-label exact confirmé dans HabitActionsMenu.tsx
    await dismiss();
    const habMoreClicked = await page.evaluate(()=>{
      // aria-label="Plus d'actions" sur le bouton MoreHorizontal de HabitCard
      const t=document.querySelector('button[aria-label="Plus d\'actions"]');
      if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
      return false;
    }).catch(()=>false);
    if(habMoreClicked){
      await wait(400);
      // Le popover HabitActionsMenu utilise createPortal → chercher dans body
      const popupVisible = await page.evaluate(()=>{
        return [...document.querySelectorAll('[style*="position: fixed"],[style*="position:fixed"]')]
          .some(el=>getComputedStyle(el).display!=='none'&&parseFloat(getComputedStyle(el).opacity)>0.05);
      }).catch(()=>false);
      if(popupVisible){
        await cap('habits-actions-menu');
        // ScheduleEventModal — chercher "Planifier" dans le menu
        const scheduleClicked = await page.evaluate(()=>{
          const btns=[...document.querySelectorAll('button,li,a')];
          const t=btns.find(b=>/planifier|agenda|schedule/i.test(b.textContent||''));
          if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
          return false;
        }).catch(()=>false);
        if(scheduleClicked){
          await wait(600);
          if(await modalOpen(2000)){
            await cap('habits-schedule-event-modal');
            await close();
          }
        } else {
          await dismiss();
        }
      } else {
        await dismiss();
      }
    }

    // HabitModal (création) — overlay custom z-50 (PAS role=dialog) → modalOpen()
    await dismiss(); await wait(400);
    const habCreate = isMobile
      ? page.locator('[data-tutorial-id="habits-fab"]').first()
      : page.locator('[data-tutorial-id="habits-create-button"]').first();
    if(await habCreate.isVisible({timeout:2000}).catch(()=>false)){
      await habCreate.click({force:true}); await wait(700);
      if(await modalOpen(2000)){
        await cap('habits-create-modal');
        // ColorSettingsModal (nested) — trigger aria-label confirmé dans HabitModal.tsx
        const colorClicked = await page.evaluate(()=>{
          const t=document.querySelector('button[aria-label="Personnaliser les couleurs"]');
          if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
          return false;
        }).catch(()=>false);
        if(colorClicked){
          await wait(500);
          if(await modalOpen(2000)){ await cap('color-settings-modal'); }
          await page.keyboard.press('Escape').catch(()=>{}); await wait(300);
        }
        await close();
      }
    }

    // ═══════════════════════════════════════════════════════
    // G. STATISTIQUES
    // ═══════════════════════════════════════════════════════
    await dismiss();
    await navByClick(page, /statistiques?|statistics/i, /\/statistics/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(800); await dismiss();
    await waitForContent(page);
    await cap('statistics-default');

    // Période Jour
    const jourStatBtn = page.getByRole('button', { name: /^jour$/i }).filter({ visible: true }).first();
    if(await jourStatBtn.isVisible({timeout:1500}).catch(()=>false)){
      await jourStatBtn.click(); await wait(500);
      await cap('statistics-period-jour');
    }
    // Période Mois
    const moisStatBtn = page.getByRole('button', { name: /^mois$/i }).filter({ visible: true }).first();
    if(await moisStatBtn.isVisible({timeout:1500}).catch(()=>false)){
      await moisStatBtn.click(); await wait(500);
      await cap('statistics-period-mois');
    }
    // Période Année
    const anneeStatBtn = page.getByRole('button', { name: /^ann[ée]e$/i }).filter({ visible: true }).first();
    if(await anneeStatBtn.isVisible({timeout:1500}).catch(()=>false)){
      await anneeStatBtn.click(); await wait(500);
      await cap('statistics-period-annee');
    }
    // Retour Semaine
    const semStatBtn = page.getByRole('button', { name: /^semaine$/i }).filter({ visible: true }).first();
    if(await semStatBtn.isVisible({timeout:1500}).catch(()=>false)){
      await semStatBtn.click(); await wait(400);
    }

    // Sous-onglets Analyser : Tâches / Agenda / OKR / Habitudes
    for(const tabName of ['Tâches','Agenda','OKR','Habitudes']){
      const tabBtn = await page.evaluate((name)=>{
        const btns=[...document.querySelectorAll('button,[role="tab"]')];
        const t=btns.find(b=>new RegExp('^'+name+'$','i').test((b.textContent||'').trim())||new RegExp('^'+name+'$','i').test(b.ariaLabel||''));
        if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
        return false;
      }, tabName).catch(()=>false);
      if(tabBtn){
        await wait(600);
        await cap('statistics-tab-'+slug(tabName));
      }
    }
    // Retour Vue d'ensemble
    await page.evaluate(()=>{
      const btns=[...document.querySelectorAll('button,[role="tab"]')];
      const t=btns.find(b=>/(vue\s*d.ensemble|overview)/i.test(b.textContent||b.ariaLabel||''));
      if(t) t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    }).catch(()=>{});
    await wait(400);

    // Voir le détail
    const detailBtn = page.getByRole('button', { name: /voir le détail|détail/i }).filter({ visible: true }).first();
    if(await detailBtn.isVisible({timeout:1500}).catch(()=>false)){
      await detailBtn.click(); await wait(500);
      await cap('statistics-voir-detail');
      const hideBtn = page.getByRole('button', { name: /masquer|tout|fermer/i }).filter({ visible: true }).first();
      if(await hideBtn.isVisible({timeout:1000}).catch(()=>false)){ await hideBtn.click(); await wait(300); }
    }

    // ═══════════════════════════════════════════════════════
    // H. PARAMÈTRES
    // ═══════════════════════════════════════════════════════
    await dismiss();
    await navByClick(page, /param[èe]tres?|settings/i, /\/settings/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(600); await dismiss();
    await waitForContent(page);
    await cap('settings-profile-tab');

    for(const tabName of ['Sécurité','Apparence','Données','Guide','Aide']){
      const tab = page.getByRole('tab', { name: new RegExp(tabName,'i') })
        .or(page.getByRole('button', { name: new RegExp(tabName,'i') })).filter({ visible: true }).first();
      if(await tab.isVisible({timeout:1500}).catch(()=>false)){
        await tab.click(); await wait(500);
        await cap('settings-'+slug(tabName));
      }
    }

    // ═══════════════════════════════════════════════════════
    // I. PREMIUM
    // ═══════════════════════════════════════════════════════
    await dismiss();
    await navByClick(page, /premium/i, /\/premium/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(600); await dismiss();
    await waitForContent(page);
    await cap('premium-page');

    // ═══════════════════════════════════════════════════════
    // J. OKR (en dernier — OKRDeadlineReviewModal peut bloquer la nav)
    // ═══════════════════════════════════════════════════════
    await navByClick(page, /okr/i, /\/okr/);
    await page.evaluate(SUPPRESS_OVERLAYS); await setTheme(); await wait(800); await dismiss();
    await waitForContent(page);
    await wait(600); await dismiss();
    await cap('okr-default');

    // Catégorie filtrée
    const okrFilter = page.locator('[data-tutorial-id="okr-category-filter"]').first();
    if(await okrFilter.isVisible({timeout:2000}).catch(()=>false)){
      const firstCat = okrFilter.locator('button').nth(1);
      if(await firstCat.isVisible({timeout:1500}).catch(()=>false)){
        await firstCat.click({force:true}); await wait(400);
        await cap('okr-category-filtered');
        await firstCat.click().catch(()=>{}); await wait(300);
      }
    }

    // CompletedOKRsModal — aria-label exact confirmé dans OKRPage.tsx (texte caché mobile)
    await dismiss();
    const completedClicked = await page.evaluate(()=>{
      const t=document.querySelector('button[aria-label="Voir la liste des OKR terminés"]');
      if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
      return false;
    }).catch(()=>false);
    if(completedClicked){
      await wait(600);
      if(await modalOpen(2000)){
        await cap('okr-completed-modal');
        await close();
      }
    }

    // OKRModal Créer (étape 1 + étape 2)
    await dismiss(); await wait(400);
    const okrCreate = page.locator('[data-tutorial-id="okr-create-button"]').first();
    if(await okrCreate.isVisible({timeout:2000}).catch(()=>false)){
      await okrCreate.click({force:true}); await wait(700);
      if(await modalOpen(2000)){
        await cap('okr-create-modal-step1');
        // Étape 2 — chercher le bouton "Suivant" via evaluate dans le dialog ouvert
        const nextClicked = await page.evaluate(()=>{
          const dialog=document.querySelector('[role="dialog"]')||[...document.querySelectorAll('.fixed.inset-0')].pop();
          if(!dialog) return false;
          const btns=[...dialog.querySelectorAll('button')];
          // Chercher "Suivant", "KR", "key result", ou à défaut le dernier bouton primaire
          const t=btns.find(b=>/suivant|next|kr|key.result/i.test((b.textContent||b.ariaLabel||'').trim()));
          if(t){t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
          // Fallback: bouton avec bg-blue ou btn-primary (dernier dans footer)
          const primary=btns.filter(b=>b.className&&(b.className.includes('blue')||b.className.includes('primary'))).pop();
          if(primary){primary.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true;}
          return false;
        }).catch(()=>false);
        if(nextClicked){ await wait(600); await cap('okr-create-modal-step2'); }
        await close();
      }
    }

    // WeeklyCheckinModal
    await dismiss();
    const checkinBtn = page.getByRole('button', { name: /bilan|check.in|weekly/i }).first();
    if(await checkinBtn.isVisible({timeout:2000}).catch(()=>false)){
      await checkinBtn.click({force:true}); await wait(600);
      if(await modalOpen(2000)){
        await cap('okr-weekly-checkin-modal');
        await close();
      }
    }

    // ═══════════════════════════════════════════════════════
    // K. MOBILE MORE SHEET
    // ═══════════════════════════════════════════════════════
    if(isMobile){
      await page.evaluate(()=>{
        document.querySelectorAll('.fixed.inset-0').forEach(el=>{
          const s=getComputedStyle(el);
          if(parseFloat(s.opacity)>0.05&&s.display!=='none') el.click();
        });
      }).catch(()=>{});
      await wait(400);
      const clicked = await page.evaluate(()=>{
        const btn=document.querySelector('[aria-label="Plus d\'options"]');
        if(btn){btn.click();return true;}return false;
      }).catch(()=>false);
      if(clicked){
        await wait(600);
        await cap('mobile-more-sheet');
        await page.keyboard.press('Escape').catch(()=>{}); await wait(400);
      }
    }

    // ═══════════════════════════════════════════════════════
    // L. COMMAND PALETTE (desktop)
    // ═══════════════════════════════════════════════════════
    if(!isMobile){
      await page.keyboard.press('Control+k'); await wait(500);
      if(await page.locator('[role="dialog"],[cmdk-root]').isVisible({timeout:2000}).catch(()=>false)){
        await cap('command-palette');
        await page.keyboard.press('Escape').catch(()=>{}); await wait(400);
      }
    }

  } catch(err){
    console.error(`[${vpName}/${theme}] Erreur:`, err.message);
  } finally {
    await ctx.close();
  }

  return results;
}

// ─── Report generator (chemins relatifs — sera écrasé par visual-audit-report.mjs) ──
function generateReport(allResults){
  const total = Object.values(allResults).reduce((s,r)=>s+r.length,0);
  writeFileSync(join(OUT,'report.html'),`<html><body style="background:#0f1117;color:#e2e8f0;font-family:sans-serif;padding:20px"><h1>Audit généré — ${total} captures</h1><p>Lancer <code>node scripts/visual-audit-report.mjs</code> pour le rapport autonome complet.</p></body></html>`,'utf-8');
}

// ─── Entry point ──────────────────────────────────────────────────────────────
(async()=>{
  mkdir(OUT);
  // --desktop-only : relancer uniquement les 2 contextes desktop (ex: après un fix)
  const desktopOnly = process.argv.includes('--desktop-only');
  const combos = desktopOnly
    ? [['desktop','light'],['desktop','dark']]
    : [['mobile','light'],['mobile','dark'],['desktop','light'],['desktop','dark']];
  const label = desktopOnly ? 'DESKTOP UNIQUEMENT' : 'RUN FINAL';
  console.log(`🚀 Audit visuel COSMO 1.2 — ${label}…`);
  console.log(`📁 Output: ${OUT}`);
  const browser = await chromium.launch({ headless: true });
  const allResults = {};
  for(const [vp, theme] of combos){
    console.log(`\n⚡ ${vp.toUpperCase()} · ${theme.toUpperCase()}`);
    const results = await runAudit(browser, vp, theme);
    allResults[`${vp}/${theme}`] = results;
    console.log(`   ✓ ${results.length} captures`);
  }
  await browser.close();
  console.log('\n📊 Génération du rapport stub…');
  generateReport(allResults);
  const total = Object.values(allResults).reduce((s,r)=>s+r.length,0);
  console.log(`\n✅ Captures terminées — ${total} total`);
  console.log(`▶  Lancer : node scripts/visual-audit-report.mjs`);
})();
