import { contactCards, contactInfo } from './contact';

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

describe('contactCards', () => {
  const full = contactInfo({
    CONTACT: {
      phone: '1588-0000',
      email: 'help@example.com',
      hours: '평일 09:00 – 18:00',
      kakaoChannelUrl: 'https://pf.kakao.com/_abc',
    },
  });

  it('lists every configured channel with its action, phone first', () => {
    const cards = contactCards(full);
    expect(cards.map((c) => c.channel)).toEqual(['phone', 'kakao', 'email']);
    expect(cards[0]).toMatchObject({
      value: '1588-0000',
      valueHref: 'tel:15880000',
      note: '평일 09:00 – 18:00',
      action: { label: '전화 걸기', href: 'tel:15880000', external: false },
    });
    expect(cards[1]?.action).toEqual({
      label: '채널 열기',
      href: 'https://pf.kakao.com/_abc',
      external: true,
    });
    expect(cards[2]?.valueHref).toBe('mailto:help@example.com');
  });

  it('leaves out channels that are not configured, never a placeholder card', () => {
    const onlyMail = contactCards(contactInfo({ CONTACT: { email: 'help@example.com' } }));
    expect(onlyMail.map((c) => c.channel)).toEqual(['email']);
    expect(contactCards(contactInfo({}))).toEqual([]);
    const text = JSON.stringify(contactCards(contactInfo({ CONTACT: { phone: '[대표번호]' } })));
    expect(text).not.toContain('준비');
  });
});
