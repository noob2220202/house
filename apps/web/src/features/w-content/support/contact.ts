import { normalizePhone } from '@house/shared';

/** The CONTACT / BUSINESS_INFO parts of the public site settings this page reads (all optional). */
export interface ContactSettings {
  CONTACT?: { phone?: string; email?: string; hours?: string; kakaoChannelUrl?: string };
  BUSINESS_INFO?: { phone?: string; email?: string };
}

export interface ContactInfo {
  /** 고객센터 대표번호 as entered ("1588-0000") + its `tel:` href; null until configured. */
  phone: { display: string; href: string } | null;
  email: { display: string; href: string } | null;
  /** "평일 09:00 – 18:00 · 점심 12:00 – 13:00"; null when not configured. */
  hours: string | null;
  /** https 카카오톡 채널 URL; null when not configured. */
  kakaoChannelUrl: string | null;
}

/** "[대표번호]"-style placeholders the operator has not filled in yet. */
const isPlaceholder = (v: string): boolean => /^\[.*\]$/.test(v.trim());
const clean = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t && !isPlaceholder(t) ? t : null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turns the (possibly half-filled) site settings into links that are safe to render. */
export function contactInfo(settings: ContactSettings): ContactInfo {
  const c = settings.CONTACT ?? {};
  const b = settings.BUSINESS_INFO ?? {};

  const phoneText = clean(c.phone) ?? clean(b.phone);
  const digits = phoneText ? normalizePhone(phoneText) : '';
  const emailText = clean(c.email) ?? clean(b.email);
  const kakao = clean(c.kakaoChannelUrl);

  return {
    phone: phoneText && digits.length >= 8 ? { display: phoneText, href: `tel:${digits}` } : null,
    email:
      emailText && EMAIL.test(emailText)
        ? { display: emailText, href: `mailto:${emailText}` }
        : null,
    hours: clean(c.hours),
    kakaoChannelUrl: kakao && /^https:\/\//.test(kakao) ? kakao : null,
  };
}

export type ContactChannel = 'phone' | 'kakao' | 'email';

/** One configured contact channel as the 고객센터 page shows it. */
export interface ContactCard {
  channel: ContactChannel;
  icon: 'phone' | 'chat' | 'mail';
  label: string;
  /** The number / address itself (or "카카오톡 채널"). */
  value: string;
  /** `tel:` / `mailto:` link of the value; null when it is plain text. */
  valueHref: string | null;
  note: string;
  action: { label: string; href: string; external: boolean };
}

/**
 * The contact cards to render: only the channels configured in 사이트 설정 (a missing number or
 * address is left out instead of a "준비하고 있어요" card), in the order 전화 → 카카오톡 → 이메일.
 */
export function contactCards(contact: ContactInfo): ContactCard[] {
  const cards: ContactCard[] = [];
  if (contact.phone) {
    cards.push({
      channel: 'phone',
      icon: 'phone',
      label: '전화 상담',
      value: contact.phone.display,
      valueHref: contact.phone.href,
      note: contact.hours ?? '운영 시간은 공지사항으로 알려 드려요.',
      action: { label: '전화 걸기', href: contact.phone.href, external: false },
    });
  }
  if (contact.kakaoChannelUrl) {
    cards.push({
      channel: 'kakao',
      icon: 'chat',
      label: '카카오톡 상담',
      value: '카카오톡 채널',
      valueHref: null,
      note: '채팅으로 편하게 물어보세요. 사진이나 화면 캡처도 함께 보낼 수 있어요.',
      action: { label: '채널 열기', href: contact.kakaoChannelUrl, external: true },
    });
  }
  if (contact.email) {
    cards.push({
      channel: 'email',
      icon: 'mail',
      label: '이메일 문의',
      value: contact.email.display,
      valueHref: contact.email.href,
      note: '화면을 캡처해 함께 보내 주시면 더 빨리 확인할 수 있어요.',
      action: { label: '메일 보내기', href: contact.email.href, external: false },
    });
  }
  return cards;
}
