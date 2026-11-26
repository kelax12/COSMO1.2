/* global chrome */
// Extension « Ajouter à Cosmo » (plan SEO P2). Elle ne touche à aucune donnée :
// elle ouvre la page Tâches de Cosmo avec le titre et l'adresse de la page en
// paramètres, et c'est l'utilisateur qui valide la tâche, avec sa propre
// session. Aucune permission sur les sites visités au-delà de l'onglet actif.

const APP = 'https://thecosmo.app/tasks';
const MAX = 140;

function ouvrir(titre, source) {
  const url = new URL(APP);
  url.searchParams.set('ajouter', String(titre || '').trim().slice(0, MAX));
  if (source && /^https?:\/\//.test(source)) url.searchParams.set('source', source.slice(0, 500));
  chrome.tabs.create({ url: url.toString() });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'cosmo-selection', title: chrome.i18n.getMessage('menuSelection'), contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'cosmo-page', title: chrome.i18n.getMessage('menuPage'), contexts: ['page', 'link'] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cosmo-selection') ouvrir(info.selectionText, tab && tab.url);
  else if (info.linkUrl) ouvrir(info.linkUrl, info.linkUrl);
  else ouvrir(tab && tab.title, tab && tab.url);
});

chrome.action.onClicked.addListener((tab) => ouvrir(tab.title, tab.url));
