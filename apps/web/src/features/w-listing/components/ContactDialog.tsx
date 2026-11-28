'use client';
import type { InquirySource } from '@house/shared';
import { ROUTES } from '@/config/nav';
import { InquiryDialog, type InquiryTab } from '@/features/w-inquiry';
import type { ListingAgency, ListingDetail } from '../api/schemas';
import { displayPhone, listingFullTitle, listingNo } from '../lib/view';

export interface ContactDialogProps {
  listing: ListingDetail;
  agency: ListingAgency;
  open: boolean;
  onClose: () => void;
  /** 바로 연락 (the 전화 buttons) or 문의 남기기 (the 문의하기 buttons). */
  initialTab?: InquiryTab;
  source?: InquirySource;
  /** Hide "사무소 정보와 다른 매물 보기" (the office's own site). */
  hideAgencyLink?: boolean;
}

/**
 * 문의하기 of one office on the listing page: 바로 연락 with the office's full 표시·광고 명시사항
 * (명칭, 소재지, 연락처, 등록번호, 대표) and 문의 남기기 (a written inquiry about this listing).
 */
export function ContactDialog({
  listing,
  agency,
  open,
  onClose,
  initialTab,
  source,
  hideAgencyLink,
}: ContactDialogProps) {
  const no = listingNo(listing);
  return (
    <InquiryDialog
      open={open}
      onClose={onClose}
      initialTab={initialTab}
      source={source}
      agency={{
        id: agency.agencyId,
        name: agency.name,
        phone: agency.contactPhone ?? agency.phone,
        logoUrl: agency.logoUrl,
        representativeName: agency.representativeName,
        note: agency.isPrimary ? '최초 등록 사무소' : null,
      }}
      listing={{ id: listing.id, no, label: listingFullTitle(listing) }}
      details={[
        { label: '명칭', value: agency.name },
        {
          label: '소재지',
          value: [agency.roadAddress, agency.addressDetail].filter(Boolean).join(', '),
        },
        { label: '연락처', value: displayPhone(agency.phone), num: true },
        { label: '등록번호', value: agency.registrationNumber, num: true },
        { label: '대표', value: agency.representativeName },
        { label: '매물번호', value: no, num: true },
      ]}
      moreHref={hideAgencyLink ? null : ROUTES.agency(agency.agencyId)}
    />
  );
}
