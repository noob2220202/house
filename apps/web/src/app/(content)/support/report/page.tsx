import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/nav';

/**
 * /support/report (footer "허위매물 신고", notice popups, `ROUTES.report`) → 고객센터 허위매물 신고
 * section. A report needs the listing (`reportCreateSchema`: targetType + targetId), so it is filed
 * from the listing page; this route only explains how. Real 307 (no loading boundary above).
 */
export default function ReportRedirect() {
  redirect(`${ROUTES.support}#report`);
}
