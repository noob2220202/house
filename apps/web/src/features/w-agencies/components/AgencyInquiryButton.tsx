'use client';
import { InquirySource } from '@house/shared';
import { Button, Icon, type ButtonProps } from '@house/ui';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ROUTES } from '@/config/nav';
import type { AgencySummary } from '../api/schemas';
import { displayPhone, fullAddress } from '../lib/agency';

// Interaction-only → its own chunk, loaded when a visitor opens 문의.
const InquiryDialog = dynamic(() => import('@/features/w-inquiry').then((m) => m.InquiryDialog), {
  ssr: false,
});

export interface AgencyInquiryButtonProps {
  agency: Pick<
    AgencySummary,
    | 'id'
    | 'name'
    | 'phone'
    | 'logoUrl'
    | 'representativeName'
    | 'registrationNumber'
    | 'roadAddress'
    | 'addressDetail'
  >;
  variant?: ButtonProps['variant'];
  className?: string;
  /** Show "사무소 정보와 다른 매물 보기" in the dialog (the map panel; not on the office page itself). */
  linkToAgency?: boolean;
  source?: InquirySource;
}

/**
 * 문의하기 of an office (office page, map panel): opens the inquiry dialog on 문의 남기기, with
 * 바로 연락 (전화 · 문자 · 번호 복사) as its second part.
 */
export function AgencyInquiryButton({
  agency,
  variant = 'secondary',
  className,
  linkToAgency,
  source = InquirySource.MAIN,
}: AgencyInquiryButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        className={className}
        aria-haspopup="dialog"
        iconLeft={<Icon name="chat" size={18} />}
        onClick={() => setOpen(true)}
      >
        문의하기
      </Button>
      {open && (
        <InquiryDialog
          open
          onClose={() => setOpen(false)}
          source={source}
          agency={{
            id: agency.id,
            name: agency.name,
            phone: agency.phone || null,
            logoUrl: agency.logoUrl,
            representativeName: agency.representativeName,
          }}
          details={[
            { label: '명칭', value: agency.name },
            { label: '소재지', value: fullAddress(agency) },
            { label: '연락처', value: agency.phone ? displayPhone(agency.phone) : null, num: true },
            { label: '등록번호', value: agency.registrationNumber, num: true },
            { label: '대표', value: agency.representativeName },
          ]}
          moreHref={linkToAgency ? ROUTES.agency(agency.id) : null}
        />
      )}
    </>
  );
}
