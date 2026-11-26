import React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { useT } from '@/i18n/useT';
import { CONTACT_EMAIL } from '@/lib/contact.mjs';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';

const Section: React.FC<{ title: string; id?: string; children: React.ReactNode }> = ({ title, id, children }) => (
  <div id={id} className="mb-10 scroll-mt-20">
    <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-900/10">{title}</h2>
    <div className="text-slate-600 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const AProposPage: React.FC = () => {
  useForcedLightTheme();
  const { t } = useT('landing');
  useSeoMeta({
    title: t('about.metaTitle'),
    description:
      t('about.metaDescription'),
    canonical: 'https://thecosmo.app/a-propos',
  });
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          {t('about.back')}
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-slate-900">{t('about.title')}</h1>
        <p className="text-slate-500 mb-10">{t('about.subtitle')}</p>

        <Section title={t('about.whyTitle')}>
          <p>{t('about.p1')}</p>
          <p>
            {t('about.p2before')}<strong className="text-slate-900">{t('about.p2bold')}</strong>{t('about.p2after')}
          </p>
        </Section>

        <Section title={t('about.beliefsTitle')}>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-slate-900">{t('about.principle1Bold')}</strong>{t('about.principle1')}</li>
            <li><strong className="text-slate-900">{t('about.principle2Bold')}</strong>{t('about.principle2')}</li>
            <li><strong className="text-slate-900">{t('about.principle3Bold')}</strong>{t('about.principle3')}</li>
            <li><strong className="text-slate-900">{t('about.principle4Bold')}</strong>{t('about.principle4')}</li>
          </ul>
        </Section>

        <Section title={t('about.namesTitle')}>
          <p>
            {t('about.namesP')}<strong className="text-slate-900">{t('about.namesBold1')}</strong>{t('about.namesMid')}<strong className="text-slate-900">{t('about.namesBold2')}</strong>{t('about.namesAfter')}
          </p>
        </Section>

        <Section title={t('about.whoTitle')} id="fondateur">
          <p>{t('about.whoP')}</p>
          <p>{t('about.founderP')}</p>
          <p>
            {t('about.contactP')}{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            {t('about.contactAfter')}
          </p>
        </Section>

        <div className="mt-12 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold mb-2">{t('about.ctaTitle')}</p>
          <p className="text-slate-500 text-sm mb-5">{t('about.ctaSubtitle')}</p>
          <Link
            to="/signup"
            data-cta="a-propos-signup-bas"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Commencer gratuitement
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AProposPage;
