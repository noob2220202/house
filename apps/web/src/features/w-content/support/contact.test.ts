import { contactInfo } from './contact';

describe('contactInfo', () => {
  it('builds tel / mailto links from the site settings', () => {
    const info = contactInfo({
      CONTACT: {
        phone: '1588-0000',
        email: 'help@example.com',
        hours: '평일 09:00 – 18:00',
        kakaoChannelUrl: 'https://pf.kakao.com/_abc',
      },
    });
    expect(info.phone).toEqual({ display: '1588-0000', href: 'tel:15880000' });
    expect(info.email).toEqual({ display: 'help@example.com', href: 'mailto:help@example.com' });
    expect(info.hours).toBe('평일 09:00 – 18:00');
    expect(info.kakaoChannelUrl).toBe('https://pf.kakao.com/_abc');
  });

  it('ignores placeholders and unsafe values, falling back to the business info', () => {
    const info = contactInfo({
      CONTACT: { phone: '[대표번호]', email: '[이메일]', kakaoChannelUrl: 'javascript:alert(1)' },
      BUSINESS_INFO: { phone: '061-123-4567' },
    });
    expect(info.phone?.href).toBe('tel:0611234567');
    expect(info.email).toBeNull();
    expect(info.hours).toBeNull();
    expect(info.kakaoChannelUrl).toBeNull();
    expect(contactInfo({}).phone).toBeNull();
  });
});
