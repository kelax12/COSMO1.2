// Alerte 80 % des sièges (`_shared/seat-alert-text.ts`), module pur.
import { describe, it, expect } from 'vitest';
import {
  effectiveSeatQuota,
  effectiveTierKey,
  nextTier,
  seatAlertMail,
  shouldAlert,
} from '../../../supabase/functions/_shared/seat-alert-text';

const APP = 'https://thecosmo.app';

describe('shouldAlert', () => {
  it('alerte à partir de 80 % du quota', () => {
    expect(shouldAlert(3, 5)).toBe(false);
    expect(shouldAlert(4, 5)).toBe(true);
    expect(shouldAlert(5, 5)).toBe(true);
    expect(shouldAlert(7, 10)).toBe(false);
    expect(shouldAlert(8, 10)).toBe(true);
    expect(shouldAlert(15, 20)).toBe(false);
    expect(shouldAlert(16, 20)).toBe(true);
    expect(shouldAlert(39, 50)).toBe(false);
    expect(shouldAlert(40, 50)).toBe(true);
    expect(shouldAlert(80, 100)).toBe(true);
  });

  it('exclut l illimité, un quota nul et un effectif illisible', () => {
    expect(shouldAlert(1000, null)).toBe(false);
    expect(shouldAlert(0, 0)).toBe(false);
    expect(shouldAlert(Number.NaN, 5)).toBe(false);
    expect(shouldAlert(-1, 5)).toBe(false);
  });
});

describe('quota et palier effectifs, miroir de org_seats_allowed', () => {
  it('un abonnement non actif retombe au gratuit (5 places)', () => {
    expect(effectiveSeatQuota(null, null)).toBe(5);
    expect(effectiveSeatQuota('past_due', 20)).toBe(5);
    expect(effectiveSeatQuota('canceled', null)).toBe(5);
    expect(effectiveTierKey('past_due', 't20')).toBe('free');
    expect(effectiveTierKey(null, null)).toBe('free');
  });

  it('un abonnement actif garde son quota, illimité compris', () => {
    expect(effectiveSeatQuota('active', 20)).toBe(20);
    expect(effectiveSeatQuota('active', null)).toBeNull();
    expect(effectiveTierKey('active', 't20')).toBe('t20');
  });

  it('palier suivant', () => {
    expect(nextTier('free')?.key).toBe('t10');
    expect(nextTier('t100')?.key).toBe('tmax');
    expect(nextTier('tmax')).toBeUndefined();
  });
});

describe('seatAlertMail', () => {
  const m = seatAlertMail({ orgName: 'Acme', tierKey: 'free', memberCount: 4, quota: 5, appUrl: APP });

  it('porte le titre, les deux paliers avec leurs prix et la mention légale', () => {
    expect(m.text).toContain('Votre équipe grandit');
    expect(m.text).toContain("Palier actuel : Jusqu'à 5 membres, gratuit");
    expect(m.text).toContain('Palier suivant : 5 à 10 membres, 70 € TTC / mois');
    expect(m.text).toContain(
      "Cet e-mail est envoyé une seule fois, quand l'organisation franchit 80 % de ses places. Rien ne change sur votre abonnement sans votre accord.",
    );
  });

  it('ouvre la facturation et les membres', () => {
    expect(m.text).toContain(`Voir les paliers : ${APP}/entreprise/billing`);
    expect(m.text).toContain(`Gérer les membres : ${APP}/entreprise/members`);
    expect(m.html).toContain(`href="${APP}/entreprise/billing"`);
    expect(m.html).toContain(`href="${APP}/entreprise/members"`);
  });

  it('échappe un nom d organisation piégé (SV-5)', () => {
    const t = seatAlertMail({ orgName: '<script>x</script>"', tierKey: 't10', memberCount: 8, quota: 10, appUrl: APP });
    expect(t.html).not.toContain('<script>');
    expect(t.html).toContain('&lt;script&gt;');
  });

  it('n émet aucun lien non https', () => {
    const t = seatAlertMail({ orgName: 'Acme', tierKey: 't10', memberCount: 8, quota: 10, appUrl: 'javascript:alert(1)//' });
    expect(t.html).not.toContain('href="javascript:');
    expect(t.html).not.toContain('Voir les paliers</a>');
  });

  it('dernier palier payant : palier suivant illimité', () => {
    const t = seatAlertMail({ orgName: 'Acme', tierKey: 't100', memberCount: 80, quota: 100, appUrl: APP });
    expect(t.text).toContain('Palier suivant : Illimité, 1000 € TTC / mois');
  });

  it('aucun tiret cadratin', () => {
    expect(m.text + m.html + m.subject).not.toContain('—');
  });
});
