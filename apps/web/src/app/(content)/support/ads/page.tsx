import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/nav';

/**
 * /support/ads (header + footer "광고 문의", `ROUTES.adInquiry`) → 고객센터 광고·제휴 문의 section.
 * No loading boundary sits above this page, so it is a real 307 (and a client-side redirect that
 * keeps the #ads anchor on in-app navigation).
 */
export default function AdInquiryRedirect() {
  redirect(`${ROUTES.support}#ads`);
}
