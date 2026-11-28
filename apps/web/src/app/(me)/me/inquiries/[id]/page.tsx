import { notFound } from 'next/navigation';
import { MePage } from '@/features/w-me/components/MePage';
import { ME_ROUTES } from '@/features/w-me/routes';
import { requireMe } from '@/features/w-me/server';
import { MyInquiryThreadView } from '@/features/w-inquiry/me/MyInquiryThreadView';
import { ME_INQUIRY_ROUTES } from '@/features/w-inquiry/routes';
import { myInquiryDetailSchema } from '@/features/w-inquiry/schemas';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '문의 상세',
  path: ME_ROUTES.inquiries,
  noindex: true,
});

/** /me/inquiries/[id] — one inquiry with the office's answers and a follow-up box. */
export default async function MyInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMe(ME_INQUIRY_ROUTES.detail(id));
  let inquiry;
  try {
    inquiry = await serverGetAuthed(`/me/inquiries/${encodeURIComponent(id)}`, {
      schema: myInquiryDetailSchema,
    });
  } catch (error) {
    // Someone else's inquiry answers 404 as well (the API never confirms it exists).
    if (error instanceof ApiError && (error.isNotFound || error.isValidation)) notFound();
    throw error;
  }
  return (
    <MePage title="문의 상세" description={inquiry.agency.name} backHref={ME_ROUTES.inquiries}>
      <MyInquiryThreadView initial={inquiry} />
    </MePage>
  );
}
