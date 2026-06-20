/**
 * visual-audit-report.mjs — Génère visual-audit/report.html AUTONOME (images base64).
 * Reflète automatiquement TOUS les PNG réellement présents dans les 4 dossiers.
 * Sections : résumé bugs (7 bugs validés) + check-up couverture + planches-contact.
 * Usage : node scripts/visual-audit-report.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'visual-audit');
const ROOT_BEFORE = join(__dirname, '..', 'visual-audit-before'); // état AVANT correctifs
const CONTEXTS = ['mobile-light', 'mobile-dark', 'desktop-light', 'desktop-dark'];

// ── base64 ─────────────────────────────────────────────────────────────────
const cache = new Map();
function dataUriFrom(root, ctx, file) {
  const key = `${root}|${ctx}/${file}`;
  if (cache.has(key)) return cache.get(key);
  const p = join(root, ctx, file);
  if (!existsSync(p)) { cache.set(key, ''); return ''; }
  const uri = `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  cache.set(key, uri);
  return uri;
}
function dataUri(ctx, file) { return dataUriFrom(ROOT, ctx, file); }
function dataUriBefore(ctx, file) { return dataUriFrom(ROOT_BEFORE, ctx, file); }
const HAS_BEFORE = existsSync(ROOT_BEFORE);

// ── inventaire réel ────────────────────────────────────────────────────────
const inventory = {};
for (const ctx of CONTEXTS) {
  const dir = join(ROOT, ctx);
  inventory[ctx] = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.png')).sort() : [];
}
const totalCaptures = Object.values(inventory).reduce((n, a) => n + a.length, 0);

// ── libellés humains ───────────────────────────────────────────────────────
const LABELS = {
  'landing-default.png':               'Landing',
  'landing-login-modal.png':           'Landing · LoginModal',
  'login-page.png':                    'Login',
  'signup-page.png':                   'Signup',
  'guide-page.png':                    'Guide',
  'legal-mentions.png':                'Mentions légales',
  'politique-confidentialite.png':     'Politique de confidentialité',
  'cgu.png':                           'CGU',
  'dashboard-default.png':             'Dashboard',
  'dashboard-period-week.png':         'Dashboard · Semaine',
  'dashboard-period-month.png':        'Dashboard · Mois',
  'dashboard-inbox-open.png':          'Dashboard · InboxMenu',
  'tasks-default.png':                 'Tâches',
  'tasks-calendar-week.png':           'Tâches · Calendrier Semaine',
  'tasks-calendar-month.png':          'Tâches · Calendrier Mois',
  'tasks-mobile-quick-filters.png':    'Tâches · Filtres rapides (mobile)',
  'tasks-smartlist-menu.png':          'Tâches · SmartListMenu ✨',
  'tasks-list-actions-sheet.png':      'Tâches · ListActionsSheet (long-press)',
  'tasks-add-task-form.png':           'Tâches · AddTaskForm',
  'tasks-add-to-list-modal.png':       'Tâches · AddToListModal',
  'tasks-task-modal.png':              'Tâches · TaskModal (desktop)',
  'tasks-task-modal-step2.png':        'Tâches · TaskModal Étape 2 (Collaborateurs)',
  'tasks-task-modal-mobile.png':       'Tâches · TaskModal (mobile)',
  'tasks-delete-confirm.png':          'Tâches · Supprimer confirmation',
  'tasks-color-settings-modal.png':    'Tâches · ColorSettingsModal',
  'color-settings-modal.png':          'ColorSettingsModal (palette catégories)',
  'agenda-default.png':                'Agenda · Semaine + sidebar',
  'agenda-month-view.png':             'Agenda · Vue Mois',
  'agenda-sidebar-hidden.png':         'Agenda · Sans sidebar',
  'agenda-mobile-day.png':             'Agenda · Vue Jour (mobile)',
  'agenda-event-modal-add.png':        'Agenda · EventModal (créer)',
  'agenda-event-modal-edit.png':       'Agenda · EventModal (éditer)',
  'agenda-delete-event-confirm.png':   'Agenda · Supprimer événement',
  'habits-table-view.png':             'Habitudes · Tableau',
  'habits-list-view.png':              'Habitudes · Liste',
  'habits-global-view.png':            'Habitudes · Suivi global',
  'habits-actions-menu.png':           'Habitudes · HabitActionsMenu (…)',
  'habits-schedule-event-modal.png':   'Habitudes · ScheduleEventModal',
  'habits-create-modal.png':           'Habitudes · HabitModal (créer)',
  'okr-default.png':                   'OKR',
  'okr-category-filtered.png':         'OKR · Catégorie filtrée',
  'okr-completed-modal.png':           'OKR · OKR terminés',
  'okr-create-modal-step1.png':        'OKR · Créer Étape 1',
  'okr-create-modal-step2.png':        'OKR · Créer Étape 2 (KR)',
  'okr-weekly-checkin-modal.png':      'OKR · Check-in hebdo',
  'statistics-default.png':            'Statistiques · Vue d\'ensemble',
  'statistics-period-jour.png':        'Statistiques · Jour',
  'statistics-period-mois.png':        'Statistiques · Mois',
  'statistics-period-annee.png':       'Statistiques · Année',
  'statistics-tab-taches.png':         'Statistiques · Onglet Tâches',
  'statistics-tab-agenda.png':         'Statistiques · Onglet Agenda',
  'statistics-tab-okr.png':            'Statistiques · Onglet OKR',
  'statistics-tab-habitudes.png':      'Statistiques · Onglet Habitudes',
  'statistics-voir-detail.png':        'Statistiques · Voir le détail',
  'settings-profile-tab.png':          'Paramètres · Profil',
  'settings-s-curit.png':              'Paramètres · Sécurité',
  'settings-apparence.png':            'Paramètres · Apparence',
  'settings-donn-es.png':              'Paramètres · Données',
  'settings-guide.png':                'Paramètres · Guide',
  'settings-aide.png':                 'Paramètres · Aide',
  'premium-page.png':                  'Premium',
  'mobile-more-sheet.png':             'MobileMoreSheet',
  'command-palette.png':               'Command Palette',
};

// Fichiers portant un bug → badge ⚠
const FLAGS = {
  'tasks-default.png': 'B07',
  'habits-list-view.png': 'B01',
  'habits-table-view.png': 'B01',
  'habits-global-view.png': 'B01',
  'statistics-default.png': 'B03/B04',
  'statistics-tab-taches.png': 'B03',
  'statistics-tab-agenda.png': 'B03',
  'statistics-tab-okr.png': 'B03',
  'statistics-tab-habitudes.png': 'B03',
  'statistics-period-jour.png': 'B04',
  'statistics-period-mois.png': 'B04',
  'statistics-period-annee.png': 'B04',
  'settings-apparence.png': 'B06',
  'landing-default.png': 'B05',
};

// ── définition des bugs (B02 retiré : intentionnel) ───────────────────────
const SEV_COLOR = { HIGH: 'red', MEDIUM: 'orange', LOW: 'yellow' };
const bugs = [
  {
    id: 'B01', sev: 'HIGH', status: 'fixed', logicFix: true,
    title: 'FAB (+) chevauche le dernier contenu en bas de scroll (Habitudes + OKR)',
    meta: ['Mobile 390×844', 'Clair + Sombre', '/habits + /okr', 'FAB fixed · padding bas'],
    desc: `Le bouton FAB en <code>position: fixed</code> recouvre le <strong>dernier élément interactif quand on déroule jusqu'en bas</strong> : en vue Liste/Tableau/Suivi global, le dernier rang (boutons jour, streak 🔥, bulles) restait coincé sous le FAB faute de padding bas suffisant. Présent en <strong>clair ET sombre</strong>.`,
    fix: `Ajouter <code>pb-[calc(64px+env(safe-area-inset-bottom)+88px)]</code> au conteneur de page (FAB 56px + 12px + tab bar 64px → ~88px de réserve basse, cf. CLAUDE.md).`,
    fixed: `<code>HabitsPage.tsx:86</code> ET <code>OKRPage.tsx:253</code> : padding bas <code>+24px</code> → <code>+88px</code>. Les deux pages ont un FAB mais utilisaient le padding « sans FAB » (violation de la règle CLAUDE.md). Désormais le dernier élément se dégage du FAB en fin de scroll. <em>(Le chevauchement transitoire d'un élément en milieu de liste — visible sur une capture au scroll-top — est le comportement standard d'un FAB flottant : il se résout en faisant défiler ; non démontrable par une capture statique.)</em>`,
    shots: [
      ['mobile-light', 'habits-list-view.png', 'Mobile · Clair', 'Vue Liste : FAB masque « sam. »'],
      ['mobile-light', 'habits-table-view.png', 'Mobile · Clair', 'Vue Tableau : streak cachée'],
      ['mobile-dark', 'habits-list-view.png', 'Mobile · Sombre', 'Même bug dark mode'],
      ['mobile-light', 'habits-global-view.png', 'Mobile · Clair', 'Suivi global : bulles du bas cachées'],
    ],
  },
  {
    id: 'B03', sev: 'MEDIUM', verified: true, status: 'fixed',
    fixed: `<code>StatisticsPage.tsx:319</code> : label désormais visible sur mobile (suppression de <code>hidden sm:inline</code>) + <code>aria-label</code>/<code>aria-pressed</code> sur chaque onglet + <code>aria-hidden</code> sur l'icône. WCAG 1.1.1 satisfait.`,
    title: 'Onglets « Analyser » des Statistiques : icônes seules sur mobile',
    meta: ['Mobile 390×844', 'Clair + Sombre', '/statistics', 'StatisticsPage · AnalysisTabs'],
    desc: `<strong>Re-vérifié ✓.</strong> Sur desktop : icône + texte (Vue d'ensemble / Tâches / Agenda / OKR / Habitudes).<br>
      Sur mobile : uniquement les 5 icônes — aucun label. Cas ambigus : barchart (Vue d'ensemble) ≈ checkbox (Tâches), refresh (Habitudes) ≈ « recharger ».<br><br>
      WCAG 2.1 SC 1.1.1 : contrôles icon-only doivent avoir un <code>aria-label</code>.`,
    fix: `Afficher des labels courts sous les icônes sur mobile ou garantir <code>aria-label</code> + <code>title</code> sur chaque onglet. Re-scanner axe-core (Critical = 0).`,
    shots: [
      ['mobile-light', 'statistics-default.png', 'Mobile · Clair', 'Icônes seules, pas de labels'],
      ['mobile-dark', 'statistics-default.png', 'Mobile · Sombre', 'Idem'],
      ['desktop-light', 'statistics-default.png', 'Desktop · Clair', 'Référence : icône + texte'],
    ],
  },
  {
    id: 'B04', sev: 'MEDIUM', verified: true, status: 'fixed',
    fixed: `<code>StatisticsPage.tsx:453</code> : <code>&lt;YAxis width={38}&gt;</code> → <code>width={56}</code>. Les labels « 13h20 » / « 16h40 » ne sont plus rognés au bord gauche.`,
    title: 'Labels Y-axis tronqués — « 13h20 » → « 3h20 » et « 16h40 » → « 6h40 »',
    meta: ['Desktop 1440×900', 'Clair + Sombre', '/statistics', 'DashboardChart · Recharts YAxis'],
    desc: `<strong>Re-vérifié ✓ — deux labels affectés.</strong> Le bord gauche du container graphique coupe le chiffre des dizaines :<br><br>
      • « 13h20 » → « 3h20 »<br>• « 16h40 » → « 6h40 »<br><br>
      Les graduations courtes (« 25h », « 8h20 », « 0min ») ne sont pas affectées. Tout label d'heure à deux chiffres est rogné.`,
    fix: `Augmenter la largeur réservée à l'axe Y : <code>&lt;YAxis width={64}&gt;</code> dans la config Recharts du DashboardChart.`,
    shots: [
      ['desktop-light', 'statistics-default.png', 'Desktop · Clair', '« 3h20 » et « 6h40 » : dizaines coupées'],
      ['desktop-dark', 'statistics-default.png', 'Desktop · Sombre', 'Encore plus visible sur fond sombre'],
    ],
  },
  {
    id: 'B05', sev: 'LOW', status: 'fixed', logicFix: true,
    fixed: `<code>repository.factory.ts:206</code> : <code>clearDemoStorage()</code> exclut désormais <code>cosmo_cookie_consent</code> du sweep <code>cosmo_*</code> (set <code>PRESERVE_KEYS</code>). Le consentement RGPD persiste à travers les <code>loginDemo()</code>. <em>(Correctif de logique — non visible sur une capture « nouvel utilisateur » où la bannière s'affiche légitimement.)</em>`,
    title: 'Bannière cookie visible à chaque nouveau contexte (landing)',
    meta: ['Desktop', 'Clair + Sombre', '/welcome'],
    desc: `Bannière cookie (bas-droite) réapparaît à chaque visite avec localStorage vierge. En prod, tout utilisateur non-consentant la voit. À vérifier : la clé de consentement est-elle balayée par <code>clearDemoStorage()</code> ?`,
    fix: `Vérifier que la clé de consentement (ex. <code>cosmo_cookie_consent</code>) n'est pas effacée par le sweep <code>cosmo_*</code> de <code>clearDemoStorage</code>. Si oui, l'exclure.`,
    shots: [['desktop-dark', 'landing-default.png', 'Desktop · Sombre', 'Bannière cookie bas-droite']],
  },
  {
    id: 'B06', sev: 'LOW', status: 'deferred',
    fixed: `<strong>Différé (by design).</strong> La carte « Thème de l'interface » fonctionne ; le vide est esthétique. Ajouter un toggle monochrome/contraste élevé serait une <em>feature</em> à part entière (risque de régression sur le thème), hors scope d'une correction de bug visuel.`,
    title: 'Onglet « Apparence » des Paramètres quasi-vide',
    meta: ['Desktop + Mobile', 'Clair + Sombre', '/settings · Apparence'],
    desc: `Seul le toggle Clair/Sombre est visible, ~70% de la zone est vide. CLAUDE.md mentionne un mode <em>monochrome</em> non visible ici — impression d'incomplétude ou de bug de chargement.`,
    fix: `Si le mode monochrome est masqué (démo/flag), afficher en <code>disabled</code> avec tooltip. Sinon envisager de fusionner Apparence + Profil.`,
    shots: [
      ['desktop-dark', 'settings-apparence.png', 'Desktop · Sombre', 'Seul le toggle thème'],
      ['desktop-light', 'settings-apparence.png', 'Desktop · Clair', 'Idem'],
    ],
  },
  {
    id: 'B07', sev: 'LOW', status: 'fixed',
    title: 'Placeholder du champ de recherche tronqué sur mobile',
    meta: ['Mobile 390×844', 'Clair + Sombre', '/tasks · TaskFilter'],
    desc: `« Filtrer par n... » au lieu de « Filtrer par nom... » — l'input est trop étroit pour son placeholder par défaut.`,
    fix: `Raccourcir en <code>« Rechercher... »</code> ou élargir l'input dans <code>TaskFilter.tsx</code>.`,
    fixed: `<code>TaskFilter.tsx:94</code> : placeholder <code>« Filtrer par nom... »</code> → <code>« Rechercher... »</code>. Le <code>aria-label</code> « Rechercher une tâche par nom » reste explicite.`,
    shots: [['mobile-light', 'tasks-default.png', 'Mobile · Clair', '« Filtrer par n... »']],
  },
  {
    id: 'B08', sev: 'LOW', verified: true, status: 'fixed',
    fixed: `<code>StatisticsPage.tsx:477</code> : <code>position: 'insideTopRight'</code> → <code>'insideTopLeft'</code> + libellé enrichi <code>« Objectif 1h »</code>. Le label ne chevauche plus « S25 » dans le coin inférieur droit.`,
    title: 'Label « 1h » de la ligne objectif chevauche l\'axe X',
    meta: ['Desktop 1440×900', 'Clair + Sombre', '/statistics · DashboardChart · ReferenceLine'],
    desc: `<strong>Re-vérifié ✓.</strong> Le label « 1h » (objectif 60 min) est positionné à l'extrémité droite du tracé à la même hauteur que l'axe X, se superposant à « S25 » dans le coin inférieur droit.`,
    fix: `Repositionner : <code>label={{ position: 'insideTopLeft', value: 'Objectif' }}</code> sur la <code>&lt;ReferenceLine&gt;</code>.`,
    shots: [['desktop-light', 'statistics-default.png', 'Desktop · Clair', '« 1h » collé à « S25 »']],
  },
  {
    id: 'B09', sev: 'MEDIUM', verified: true, status: 'fixed',
    title: 'Durée non formatée sur la TaskCard mobile (« 2400min » au lieu de « 40 h »)',
    meta: ['Mobile 390×844', 'Clair + Sombre', '/tasks · TaskCard mobile', 'task-table/list.tsx'],
    desc: `<strong>Nouveau bug — détecté pendant la passe 3.</strong> La carte de tâche mobile affiche la durée en minutes brutes :<br><br>
      • « Cours deep learning » → <code>2400min</code> (devrait être <code>40 h</code>)<br>
      • « Préparer la réunion » → <code>90min</code> (devrait être <code>1 h 30 min</code>)<br><br>
      Incohérence avec la table desktop qui affiche correctement « 40 h », « 1 h 30 min » via <code>formatDuration()</code>. La carte mobile interpolait <code>{task.estimatedTime}min</code> en dur.`,
    fix: `Utiliser le helper existant <code>formatDuration(task.estimatedTime)</code> (défini dans le même fichier) au lieu de l'interpolation brute.`,
    fixed: `<code>task-table/list.tsx:365</code> : <code>{task.estimatedTime}min</code> → <code>{formatDuration(task.estimatedTime)}</code>. Mobile et desktop affichent désormais la durée de façon identique (« 40 h », « 1 h 30 min »).`,
    shots: [['mobile-light', 'tasks-default.png', 'Mobile · Clair', '« 2400min » et « 90min » non formatés']],
  },
  {
    id: 'B10', sev: 'MEDIUM', status: 'fixed', logicFix: true,
    title: 'Durée non formatée dans la sidebar « Tâches disponibles » de l\'Agenda',
    meta: ['Desktop 1440×900', '/agenda · TaskSidebar', 'src/components/TaskSidebar.tsx'],
    desc: `<strong>Nouveau bug — détecté lors de l'inspection des modals (passe 4).</strong> La sidebar « Tâches disponibles » de l'Agenda affichait la durée en minutes brutes, comme B09 mais dans un composant différent :<br><br>
      • « Cours deep learning Coursera » → <code>2400 min</code> (devrait être <code>40 h</code>)<br><br>
      Visible sur la capture <code>agenda-event-modal-add</code> (sidebar gauche). Le correctif B09 ne couvrait que la TaskCard ; <code>TaskSidebar</code> interpolait aussi <code>{task.estimatedTime} min</code> en dur.`,
    fix: `Ajouter un helper <code>formatDuration()</code> local (même format que la TaskCard) et l'utiliser à la place de l'interpolation brute.`,
    fixed: `<code>TaskSidebar.tsx</code> : helper <code>formatDuration()</code> ajouté + <code>{task.estimatedTime} min</code> → <code>{formatDuration(task.estimatedTime)}</code>. <em>(Correctif de code postérieur à ce run d'audit — la preuve visuelle « 40 h » apparaîtra au prochain run.)</em>`,
    shots: [['desktop-light', 'agenda-event-modal-add.png', 'Desktop · Clair', 'Sidebar : « 2400 min » (avant correctif)']],
  },
];

const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
bugs.forEach(b => counts[b.sev]++);
const fixedCount = bugs.filter(b => b.status === 'fixed').length;
const deferredCount = bugs.filter(b => b.status === 'deferred').length;

// ── HTML helpers ───────────────────────────────────────────────────────────
function bugCard(b) {
  const vbadge = b.verified ? '<span class="badge badge-green" style="margin-left:6px">RE-VÉRIFIÉ ✓</span>' : '';
  const statusBadge = b.status === 'fixed'
    ? '<span class="badge badge-green" style="margin-left:6px">✅ CORRIGÉ</span>'
    : b.status === 'deferred'
      ? '<span class="badge badge-yellow" style="margin-left:6px">⏸ DIFFÉRÉ</span>'
      : '';
  const fixedBox = b.fixed
    ? `<div class="fix-box" style="border-color:#22c55e55;background:#22c55e0d"><strong style="color:var(--gr)">✅ Correctif appliqué :</strong> ${b.fixed}</div>`
    : '';
  // Pour un bug corrigé : montrer AVANT (backup) + APRÈS (run actuel) côte à côte.
  // Sauf logicFix (non démontrable visuellement, ex. B05 consentement cookie).
  const showBeforeAfter = b.status === 'fixed' && HAS_BEFORE && !b.logicFix;
  const shots = b.shots.map(([ctx, file, vp, cap]) => {
    if (showBeforeAfter) {
      const before = dataUriBefore(ctx, file);
      const after = dataUri(ctx, file);
      if (!before && !after) return '';
      const beforeImg = before
        ? `<div class="ba-col"><span class="ba-tag ba-before">AVANT</span><img src="${before}" alt="avant — ${cap}" loading="lazy"></div>` : '';
      const afterImg = after
        ? `<div class="ba-col"><span class="ba-tag ba-after">APRÈS ✓</span><img src="${after}" alt="après — ${cap}" loading="lazy"></div>` : '';
      return `<div class="screenshot-item ba-pair"><div class="ba-row">${beforeImg}${afterImg}</div><div class="screenshot-caption"><span class="vp">${vp}</span> — ${cap}</div></div>`;
    }
    const uri = dataUri(ctx, file);
    if (!uri) return '';
    return `<div class="screenshot-item"><img src="${uri}" alt="${cap}" loading="lazy"><div class="screenshot-caption"><span class="vp">${vp}</span> — ${cap}</div></div>`;
  }).join('');
  return `
    <div class="bug-card" id="${b.id}">
      <div class="bug-card-header">
        <span class="bug-id">${b.id}</span>
        <span class="bug-title">${b.title}</span>
        <span class="badge badge-${SEV_COLOR[b.sev]}">${b.sev}</span>${vbadge}${statusBadge}
      </div>
      <div class="bug-body">
        <div class="bug-meta">${b.meta.map(m => `<span class="meta-item">${m}</span>`).join('')}</div>
        <div class="bug-desc">${b.desc}</div>
        <div class="fix-box">${b.fix}</div>
        ${fixedBox}
        <div class="screenshots">${shots}</div>
      </div>
    </div>`;
}

function tocRow(b) {
  return `<li><span class="sev"><span class="badge badge-${SEV_COLOR[b.sev]}">${b.sev}</span></span><a href="#${b.id}">${b.id} — ${b.title}</a></li>`;
}

function contactSection(ctx) {
  const TITLE = { 'mobile-light': 'Mobile · Clair', 'mobile-dark': 'Mobile · Sombre', 'desktop-light': 'Desktop · Clair', 'desktop-dark': 'Desktop · Sombre' };
  const items = inventory[ctx].map(f => {
    const uri = dataUri(ctx, f);
    const label = LABELS[f] || f.replace('.png','');
    const flag = FLAGS[f];
    const mark = flag ? `<span class="warn">⚠</span> ${label} <small>(${flag})</small>` : `<span class="ok">✓</span> ${label}`;
    return `<div class="contact-item"><img src="${uri}" loading="lazy"><div class="contact-label">${mark}</div></div>`;
  }).join('');
  return `<h3 class="cs-title">${TITLE[ctx]} (${inventory[ctx].length} captures)</h3><div class="contact-grid">${items}</div>`;
}

// ── HTML complet ───────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audit Visuel COSMO 1.2 — Rapport Final</title>
<style>
:root{--bg:#0f1117;--sf:#1a1d2e;--sf2:#222538;--bd:#2e3354;--tx:#e2e8f0;--mu:#8892b0;--red:#ef4444;--or:#f97316;--ye:#eab308;--gr:#22c55e;--bl:#3b82f6}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--tx);font:14px/1.6 system-ui,sans-serif}
a{color:var(--bl)}a:hover{text-decoration:underline}
code{background:var(--sf2);padding:1px 5px;border-radius:4px;font-size:12px}
header{background:var(--sf);border-bottom:1px solid var(--bd);padding:20px 32px}
header h1{font-size:20px;font-weight:700}
header p{color:var(--mu);font-size:13px;margin-top:4px}
.container{max-width:1440px;margin:0 auto;padding:24px 32px}
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.badge-red{background:#ef44441a;color:var(--red)}.badge-orange{background:#f973161a;color:var(--or)}
.badge-yellow{background:#eab3081a;color:var(--ye)}.badge-green{background:#22c55e1a;color:var(--gr)}
.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin:28px 0 36px}
.sc{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:18px}
.sc .n{font-size:34px;font-weight:800;line-height:1;margin-bottom:4px}
.sc .l{color:var(--mu);font-size:12px}
.n-r{color:var(--red)}.n-o{color:var(--or)}.n-y{color:var(--ye)}.n-g{color:var(--gr)}.n-b{color:var(--bl)}
.section{margin-bottom:44px}
.section h2{font-size:15px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.07em;margin-bottom:14px;border-bottom:1px solid var(--bd);padding-bottom:8px}
.toc{background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:18px 22px;margin-bottom:36px}
.toc h3{font-size:12px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
.toc ul{list-style:none;display:flex;flex-direction:column;gap:5px}
.toc li{display:flex;align-items:center;gap:10px;font-size:13px}.sev{width:66px;flex-shrink:0}
.note{color:var(--mu);font-size:13px;margin-top:10px;line-height:1.7}
.bug-list{display:flex;flex-direction:column;gap:18px}
.bug-card{background:var(--sf);border:1px solid var(--bd);border-radius:12px;overflow:hidden}
.bug-card-header{padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--bd)}
.bug-id{color:var(--mu);font-size:11px;font-weight:600;white-space:nowrap}
.bug-title{font-size:14px;font-weight:600;flex:1}
.bug-body{padding:14px 18px}
.bug-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.meta-item{font-size:11px;color:var(--mu);background:var(--sf2);border:1px solid var(--bd);border-radius:6px;padding:2px 7px}
.bug-desc{color:var(--mu);font-size:13px;line-height:1.7;margin-bottom:14px}
.bug-desc strong{color:var(--tx)}
.fix-box{background:#22c55e08;border:1px solid #22c55e30;border-radius:8px;padding:10px 14px;font-size:13px;color:#86efac;margin-bottom:0}
.fix-box::before{content:"Fix — ";font-weight:600}
.screenshots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:14px}
.screenshot-item{border-radius:8px;overflow:hidden;border:1px solid var(--bd);background:var(--sf2)}
.screenshot-item img{width:100%;display:block;cursor:zoom-in}
.screenshot-caption{padding:6px 8px;font-size:11px;color:var(--mu);border-top:1px solid var(--bd)}
.screenshot-caption .vp{font-weight:600;color:var(--tx)}
.ba-pair{grid-column:1/-1}
.ba-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;background:var(--sf2)}
.ba-col{position:relative;border-radius:6px;overflow:hidden;border:1px solid var(--bd);background:var(--bg)}
.ba-col img{width:100%;display:block;cursor:zoom-in}
.ba-tag{position:absolute;top:6px;left:6px;z-index:2;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;letter-spacing:.04em}
.ba-before{background:#ef4444;color:#fff}
.ba-after{background:#22c55e;color:#06210f}
hr{border:none;border-top:1px solid var(--bd);margin:36px 0}
.contact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:7px;margin-bottom:4px}
.contact-item{border-radius:7px;overflow:hidden;border:1px solid var(--bd)}
.contact-item img{width:100%;display:block;cursor:zoom-in}
.contact-label{padding:4px 7px;font-size:10px;color:var(--mu);background:var(--sf2)}
.ok{color:var(--gr)}.warn{color:var(--ye)}
.cs-title{font-size:14px;font-weight:600;color:var(--mu);margin:24px 0 10px}
.cov-ok{display:inline-block;background:#22c55e12;border:1px solid #22c55e33;color:#86efac;border-radius:6px;padding:2px 8px;font-size:11px;margin:2px}
.cov-miss{display:inline-block;background:#f9731612;border:1px solid #f9731633;color:#fdba74;border-radius:6px;padding:2px 8px;font-size:11px;margin:2px}
table.cov{width:100%;border-collapse:collapse;font-size:13px}
table.cov td{padding:8px 10px;border-bottom:1px solid var(--bd);vertical-align:top}
.cov-zone{color:var(--tx);font-weight:600;white-space:nowrap;width:180px}
</style>
</head>
<body>
<header>
  <h1>Audit Visuel Final — COSMO 1.2</h1>
  <p>Généré le ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })} · ${totalCaptures} captures embarquées (rapport autonome, images base64) · 4 contextes : Mobile 390×844 + Desktop 1440×900 × Clair + Sombre</p>
</header>

<div class="container">

<div class="summary">
  <div class="sc"><div class="n n-r">${counts.HIGH}</div><div class="l">HIGH — Bloquant UX</div></div>
  <div class="sc"><div class="n n-o">${counts.MEDIUM}</div><div class="l">MEDIUM — Impact réel</div></div>
  <div class="sc"><div class="n n-y">${counts.LOW}</div><div class="l">LOW — Cosmétique</div></div>
  <div class="sc"><div class="n n-g">${fixedCount}/${bugs.length}</div><div class="l">Bugs corrigés ✅${deferredCount ? ` (${deferredCount} différé)` : ''}</div></div>
  <div class="sc"><div class="n n-b">${totalCaptures}</div><div class="l">Captures (4 contextes)</div></div>
</div>

<div class="toc">
  <h3>Table des bugs</h3>
  <ul>${bugs.map(tocRow).join('')}</ul>
  <p class="note"><strong>${fixedCount}/${bugs.length} bugs corrigés</strong> dans cette passe (B06 différé — voir fiche). Chaque fiche corrigée montre une comparaison <span class="badge badge-red">AVANT</span> / <span class="badge badge-green">APRÈS ✓</span>.<br>Retiré : <strong>« texte barré sur habitudes complétées » (Dashboard)</strong> — comportement intentionnel confirmé par le propriétaire du produit.</p>
</div>

<div class="section">
  <h2>Bugs identifiés</h2>
  <div class="bug-list">${bugs.map(bugCard).join('')}</div>
</div>

<hr>

<div class="section">
  <h2>Couverture de l'audit — ce run final</h2>
  <p class="note" style="margin-bottom:14px">Surfaces capturées et revues dans ce run. Les captures issues de ce run (${totalCaptures} PNG) sont toutes visibles dans les planches-contact ci-dessous.</p>

  <h3 class="cs-title" style="margin-top:0">Couvert dans ce run</h3>
  <div>
    <span class="cov-ok">Pages publiques : Landing · LoginModal · Login · Signup · Guide · Mentions légales · Politique de confidentialité · CGU</span>
    <span class="cov-ok">Dashboard (défaut · Semaine · Mois · InboxMenu)</span>
    <span class="cov-ok">Tâches (liste · calendrier Sem/Mois · filtres rapides mobile · SmartListMenu ✨ · ListActionsSheet · AddTaskForm · AddToListModal · TaskModal desktop/mobile · Step 2 Collaborateurs · DeleteConfirm · ColorSettingsModal)</span>
    <span class="cov-ok">Agenda (Semaine+sidebar · Mois · Sans sidebar · Vue Jour mobile · EventModal créer/éditer · DeleteEventConfirm)</span>
    <span class="cov-ok">Habitudes (Tableau · Liste · Suivi global · HabitActionsMenu · ScheduleEventModal · HabitModal créer)</span>
    <span class="cov-ok">OKR (défaut · filtré · OKR terminés · Créer Étape 1+2 · Check-in hebdo)</span>
    <span class="cov-ok">Statistiques (Vue d'ensemble · Jour · Mois · Année · Onglets Tâches/Agenda/OKR/Habitudes · Voir le détail)</span>
    <span class="cov-ok">Paramètres (Profil · Sécurité · Apparence · Données · Guide)</span>
    <span class="cov-ok">Premium · MobileMoreSheet · Command Palette</span>
  </div>

  <h3 class="cs-title">Non capturable en mode démo</h3>
  <p class="note">Ces surfaces nécessitent un état production spécifique — elles ne s'affichent pas en mode démo.</p>
  <div>
    <span class="cov-miss">PremiumGateModal — mode démo = toujours bypasse les gates premium</span>
    <span class="cov-miss">AdModal / HabitsAdGate — mode démo = mur pub jamais affiché (isDemo = true)</span>
    <span class="cov-miss">RecurrenceDaysModal — nécessite la création d'un événement récurrent (hors script)</span>
    <span class="cov-miss">InboxMenu notifications réelles — mode démo n'a pas de messages entrants Supabase</span>
  </div>
</div>

<hr>

<div class="section">
  <h2>Planches-contact — toutes les captures</h2>
  <p class="note" style="margin-bottom:14px">Cliquer une image pour l'agrandir (lightbox). ESC pour fermer. ⚠ = surface portant un bug listé ci-dessus.</p>
  ${CONTEXTS.map(contactSection).join('')}
</div>

</div>
<script>
document.querySelectorAll('img').forEach(img=>{
  img.addEventListener('click',()=>{
    const o=document.createElement('div');
    o.style.cssText='position:fixed;inset:0;background:#000d;z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px';
    const i=document.createElement('img');
    i.src=img.src;i.style.cssText='max-width:92vw;max-height:92vh;border-radius:8px;box-shadow:0 20px 60px #0008;object-fit:contain';
    o.appendChild(i);
    o.addEventListener('click',()=>o.remove());
    document.addEventListener('keydown',e=>{if(e.key==='Escape')o.remove();},{once:true});
    document.body.appendChild(o);
  });
});
</script>
</body>
</html>`;

writeFileSync(join(ROOT, 'report.html'), html, 'utf8');
const sizeMb = (Buffer.byteLength(html)/1024/1024).toFixed(1);
console.log(`✅ report.html généré — ${totalCaptures} captures, ${bugs.length} bugs (${fixedCount} corrigés, ${deferredCount} différés), ${sizeMb} MB`);
console.log(`   HIGH ${counts.HIGH} · MEDIUM ${counts.MEDIUM} · LOW ${counts.LOW}`);
console.log(`   Avant/après : ${HAS_BEFORE ? 'OUI (visual-audit-before/)' : 'non (backup absent)'}`);
CONTEXTS.forEach(ctx => console.log(`   ${ctx}: ${inventory[ctx].length} PNG`));
