// Carte « Usage par fonctionnalité » de la console admin (mig. 266).
//
// Comptes distincts et volume, lus depuis les tables métier par la RPC
// `get_admin_usage_by_feature`. Une valeur sous le seuil (moins de 3 comptes)
// arrive à `null` du serveur et s'affiche « · ». `null` pour toute la carte =
// migration non appliquée : jamais des zéros.
import React from 'react';
import { useT } from '@/i18n/useT';
import { useUsageByFeature } from '@/modules/admin';

const muted = { color: 'rgb(var(--color-text-muted))' } as const;

export const FeatureUsageCard: React.FC = () => {
  const { t } = useT('admin');
  const { data: usage } = useUsageByFeature();

  return (
    <div className="card p-4 md:p-6">
      <h2 className="font-bold mb-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
        {t('featureUsage')}
      </h2>
      <p className="text-xs mb-3" style={muted}>
        {t('featureUsageNote', { min: usage?.minUsers ?? 3 })}
      </p>
      {usage === null ? (
        <p className="text-sm" style={muted}>{t('featureUsageNotInstalled')}</p>
      ) : usage === undefined ? (
        <p className="text-sm" style={muted}>{t('supportLoading')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="admin-usage-table">
            <thead>
              <tr style={muted}>
                <th className="text-left font-medium py-1 pr-2">{t('usageFeature')}</th>
                <th className="text-right font-medium py-1 px-2">{t('usageActive7d')}</th>
                <th className="text-right font-medium py-1 px-2">{t('usageActive30d')}</th>
                <th className="text-right font-medium py-1 pl-2">{t('usageActions30d')}</th>
              </tr>
            </thead>
            <tbody style={{ color: 'rgb(var(--color-text-primary))' }}>
              {usage.features.map((f) => (
                <tr key={f.feature} className="border-t" style={{ borderColor: 'rgb(var(--color-border))' }}>
                  <td className="py-1 pr-2">{t(`usageFeature_${f.feature}` as Parameters<typeof t>[0])}</td>
                  <td className="text-right py-1 px-2 tabular-nums">{f.active7d ?? '·'}</td>
                  <td className="text-right py-1 px-2 tabular-nums">{f.active30d ?? '·'}</td>
                  <td className="text-right py-1 pl-2 tabular-nums">{f.actions30d ?? '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
