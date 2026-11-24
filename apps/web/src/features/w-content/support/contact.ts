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
