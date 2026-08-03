import React from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { useT } from '@/i18n/useT';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

const AProposPage: React.FC = () => {
  const { t } = useT('landing');
  useSeoMeta({
    title: t('about.metaTitle'),
    description:
      t('about.metaDescription'),
    canonical: 'https://thecosmo.app/a-propos',
  });
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          {t('about.back')}
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">{t('about.title')}</h1>
        <p className="text-slate-400 mb-10">{t('about.subtitle')}</p>

        <Section title={t('about.whyTitle')}>
          <p>{t('about.p1')}</p>
          <p>
            {t('about.p2before')}<strong className="text-white">{t('about.p2bold')}</strong>{t('about.p2after')}
          </p>
        </Section>

        <Section title={t('about.beliefsTitle')}>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-white">{t('about.principle1Bold')}</strong>{t('about.principle1')}</li>
            <li><strong className="text-white">{t('about.principle2Bold')}</strong>{t('about.principle2')}</li>
            <li><strong className="text-white">{t('about.principle3Bold')}</strong>{t('about.principle3')}</li>
            <li><strong className="text-white">{t('about.principle4Bold')}</strong>{t('about.principle4')}</li>
          </ul>
        </Section>

        <Section title={t('about.namesTitle')}>
          <p>
            {t('about.namesP')}<strong className="text-white">{t('about.namesBold1')}</strong>{t('about.namesMid')}<strong className="text-white">{t('about.namesBold2')}</strong>{t('about.namesAfter')}
          </p>
        </Section>

        <Section title={t('about.whoTitle')}>
          <p>{t('about.whoP')}</p>
          <p>
            {t('about.contactP')}{' '}
            <a href="mailto:axellongattepro@gmail.com" className="text-blue-400 hover:underline">
              axellongattepro@gmail.com
            </a>
            {t('about.contactAfter')}
          </p>
        </Section>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold mb-2">{t('about.ctaTitle')}</p>
          <p className="text-slate-400 text-sm mb-5">{t('about.ctaSubtitle')}</p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors"
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
