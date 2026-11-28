'use client';
import { ROUTES } from '@/config/nav';
import { InquiryDialog as OfficeInquiryDialog, type InquiryTab } from '@/features/w-inquiry';
import { formatPhone } from '@/lib/format';
import type { ComplexListingItem, ListingAgency } from '../api/schemas';
import { listingLabel, listingNo } from '../lib/listing';

/**
 * 문의하기 of one co-brokering office — the same dialog as the listing page: 바로 연락 with the
 * office's 표시·광고 명시사항 (명칭, 소재지, 연락처, 등록번호, 대표) and 문의 남기기 about this listing.
 */
export function InquiryDialog({
  listing,
  agency,
  open,
  onClose,
  initialTab,
}: {
  listing: ComplexListingItem;
  agency: ListingAgency;
  open: boolean;
  onClose: () => void;
  initialTab?: InquiryTab;
}) {
  const no = listingNo(listing);
  const label = [listing.complexName, listingLabel(listing)].filter(Boolean).join(' ');
  return (
    <OfficeInquiryDialog
      open={open}
      onClose={onClose}
      initialTab={initialTab}
      agency={{
        id: agency.agencyId,
        name: agency.name,
        phone: agency.phone,
        logoUrl: agency.logoUrl,
        representativeName: agency.representativeName,
        note: agency.isPrimary ? '최초 등록 사무소' : null,
      }}
      listing={{ id: listing.id, no, label }}
      details={[
        { label: '명칭', value: agency.name },
        { label: '소재지', value: agency.roadAddress },
        { label: '연락처', value: agency.phone ? formatPhone(agency.phone) : null, num: true },
        { label: '등록번호', value: agency.registrationNumber, num: true },
        { label: '대표', value: agency.representativeName },
        { label: '매물번호', value: no, num: true },
      ]}
      moreHref={ROUTES.agency(agency.agencyId)}
    />
  );
}
