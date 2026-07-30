import { describe, it, expect, vi, afterEach } from 'vitest';
import { interpolate, lookup, pluralSuffix, translate, type CatalogNode } from './translate';

const FR: CatalogNode = {
  actions: { save: 'Enregistrer' },
  greeting: 'Bonjour {{name}}',
  count: {
    task_one: '{{count}} tâche',
    task_other: '{{count}} tâches',
  },
  onlyInFrench: 'Repli français',
};

const EN: CatalogNode = {
  actions: { save: 'Save' },
  greeting: 'Hello {{name}}',
  count: {
    task_one: '{{count}} task',
    task_other: '{{count}} tasks',
  },
};

describe('lookup', () => {
  it('descend un chemin pointé', () => {
    expect(lookup(FR, 'actions.save')).toBe('Enregistrer');
  });

  it('retourne null pour un chemin inconnu', () => {
    expect(lookup(FR, 'actions.publish')).toBeNull();
    expect(lookup(FR, 'nope.nope.nope')).toBeNull();
  });

  it('retourne null quand le chemin mène à un nœud, pas à une chaîne', () => {
    expect(lookup(FR, 'actions')).toBeNull();
  });
});

describe('interpolate', () => {
  it('remplace les variables', () => {
    expect(interpolate('Bonjour {{name}}', { name: 'Axel' })).toBe('Bonjour Axel');
  });

  it('accepte les espaces dans les accolades et les nombres', () => {
    expect(interpolate('{{ count }} éléments', { count: 3 })).toBe('3 éléments');
  });

  it('remplace toutes les occurrences', () => {
    expect(interpolate('{{a}}-{{a}}', { a: 'x' })).toBe('x-x');
  });

  it('laisse le marqueur visible si la variable manque', () => {
    // Un trou silencieux ne se voit pas en préprod ; un `{{name}}` affiché, si.
    expect(interpolate('Bonjour {{name}}', {})).toBe('Bonjour {{name}}');
    expect(interpolate('Bonjour {{name}}')).toBe('Bonjour {{name}}');
  });
});

describe('pluralSuffix', () => {
  it('applique les règles CLDR du français (0 au singulier)', () => {
    expect(pluralSuffix('fr', 0)).toBe('one');
    expect(pluralSuffix('fr', 1)).toBe('one');
    expect(pluralSuffix('fr', 2)).toBe('other');
  });

  it('applique les règles CLDR de l’anglais (0 au pluriel)', () => {
    expect(pluralSuffix('en', 0)).toBe('other');
    expect(pluralSuffix('en', 1)).toBe('one');
    expect(pluralSuffix('en', 2)).toBe('other');
  });

  it('gère l’espagnol', () => {
    expect(pluralSuffix('es', 1)).toBe('one');
    expect(pluralSuffix('es', 5)).toBe('other');
  });

  it('dégrade proprement sans ICU complet', () => {
    // Certains runtimes légers livrent un Intl amputé. La dégradation doit
    // rester un pluriel plausible, pas une exception qui casse le rendu.
    const original = Intl.PluralRules;
    vi.spyOn(Intl, 'PluralRules').mockImplementation((() => {
      throw new Error('ICU absent');
    }) as unknown as typeof Intl.PluralRules);
    try {
      expect(pluralSuffix('fr', 1)).toBe('one');
      expect(pluralSuffix('fr', 7)).toBe('other');
    } finally {
      Intl.PluralRules = original;
    }
  });
});

afterEach(() => vi.restoreAllMocks());

describe('translate', () => {
  const base = { catalog: EN, fallbackCatalog: FR, locale: 'en' as const };

  it('traduit depuis le catalogue de la locale', () => {
    expect(translate('actions.save', base)).toBe('Save');
  });

  it('interpole les variables', () => {
    expect(translate('greeting', { ...base, vars: { name: 'Axel' } })).toBe('Hello Axel');
  });

  it('choisit la forme plurielle selon la locale', () => {
    expect(translate('count.task', { ...base, count: 1 })).toBe('1 task');
    expect(translate('count.task', { ...base, count: 5 })).toBe('5 tasks');
    // Le français met 0 au singulier, l'anglais au pluriel : même clé, formes
    // différentes — c'est exactement ce que `Intl.PluralRules` garantit.
    expect(translate('count.task', { catalog: FR, fallbackCatalog: FR, locale: 'fr', count: 0 })).toBe('0 tâche');
    expect(translate('count.task', { ...base, count: 0 })).toBe('0 tasks');
  });

  it('expose count sans le répéter dans vars', () => {
    expect(translate('count.task', { ...base, count: 3 })).toBe('3 tasks');
  });

  it('laisse vars surcharger count', () => {
    expect(translate('count.task', { ...base, count: 3, vars: { count: 99 } })).toBe('99 tasks');
  });

  it('retombe clé par clé sur le catalogue de référence', () => {
    expect(translate('onlyInFrench', base)).toBe('Repli français');
  });

  it('retombe aussi quand le catalogue de la locale est absent', () => {
    expect(translate('actions.save', { ...base, catalog: null })).toBe('Enregistrer');
  });

  it('retourne la clé en dernier recours, jamais une chaîne vide', () => {
    // Une chaîne vide donnerait un bouton sans libellé, indiagnosticable.
    expect(translate('rien.du.tout', base)).toBe('rien.du.tout');
  });

  it('retombe sur _other si la catégorie CLDR manque au catalogue', () => {
    const sparse: CatalogNode = { count: { task_other: '{{count}} tasks' } };
    expect(translate('count.task', { ...base, catalog: sparse, count: 1 })).toBe('1 tasks');
  });
});
