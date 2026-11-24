// w-seo: search landing pages (/suncheon/**), 서비스 소개 (/about), monthly 실거래 report
// (/reports/suncheon-apartment-trades) and the 단지 FAQ block. Data: @/lib/seo/api.
export { AboutView, type AboutNap } from './components/AboutView';
export { ComplexFaqSection } from './components/ComplexFaqSection';
export { LandingView, type LandingLink } from './components/LandingView';
export { RegionIndexView } from './components/RegionIndexView';
export { ReportView } from './components/ReportView';
export { complexFaq, newestTrade, type FaqItem } from './lib/complex-faq';
export { landingDescription, landingIntro, placeFull, reportLead } from './lib/facts';
