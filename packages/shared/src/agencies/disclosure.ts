// Owned by the agencies module team.
// 공인중개사법 제18조의2 / 표시·광고 명시사항: an online listing ad must show the responsible
// 개업공인중개사's 명칭·소재지·연락처·등록번호·성명. Listings render this block next to every ad.
import { formatPhone } from '../utils/phone';

export interface AgencyDisclosure {
  agencyId: string;
  /** 중개사무소 명칭 */
  name: string;
  /** 중개사무소 소재지 (도로명 + 상세) */
  address: string;
  /** Same as `address`; matches the listings publish validator input (`agency.roadAddress`). */
  roadAddress: string;
  /** 연락처 (digits) */
  phone: string;
  /** 중개사무소 등록번호 */
  registrationNumber: string;
  /** 개업공인중개사 성명 */
  representativeName: string;
}

export interface AgencyDisclosureSource {
  id: string;
  name: string;
  roadAddress: string;
  addressDetail?: string | null;
  phone: string;
  registrationNumber: string;
  representativeName: string;
}

export function toAgencyDisclosure(a: AgencyDisclosureSource): AgencyDisclosure {
  const detail = a.addressDetail?.trim();
  const address = detail ? `${a.roadAddress} ${detail}` : a.roadAddress;
  return {
    agencyId: a.id,
    name: a.name,
    address,
    roadAddress: address,
    phone: a.phone,
    registrationNumber: a.registrationNumber,
    representativeName: a.representativeName,
  };
}

export const AGENCY_DISCLOSURE_LABEL = {
  name: '중개사무소',
  address: '소재지',
  phone: '연락처',
  registrationNumber: '등록번호',
  representativeName: '대표 공인중개사',
} as const;

/** Label/value rows in the legally expected order, phone formatted for display. */
export function agencyDisclosureLines(d: AgencyDisclosure): { label: string; value: string }[] {
  return [
    { label: AGENCY_DISCLOSURE_LABEL.name, value: d.name },
    { label: AGENCY_DISCLOSURE_LABEL.representativeName, value: d.representativeName },
    { label: AGENCY_DISCLOSURE_LABEL.address, value: d.address },
    { label: AGENCY_DISCLOSURE_LABEL.registrationNumber, value: d.registrationNumber },
    { label: AGENCY_DISCLOSURE_LABEL.phone, value: formatPhone(d.phone) },
  ];
}
