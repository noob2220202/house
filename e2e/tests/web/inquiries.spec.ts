import { expect, test } from 'playwright/test';
import { apiSessionAs, bodyOf, findListings, loginAs } from '../../lib/api';
import { uniq, WEB_URL } from '../../lib/env';
import { shots } from '../../lib/site';

/**
 * 문의 on the main site (SPEC docs/agency-sites §3.5, §4.3, §4.4): a member asks about a listing →
 * the office answers in its console 문의함 → the member reads the answer under MY > 문의 내역 and
 * gets the INQUIRY_REPLIED notification. A 바로 연락 press (전화 / 문자 / 번호 복사) is logged in the
 * 문의함 but never counts as unread. The guest 문의 from an office's own site is in
 * admin/agency-sites.spec.ts.
 *
 * Office: 연향중앙공인중개사사무소 (a4) — no other spec writes to its 문의함.
 */
const OWNER = 'a4-owner@seed.example.invalid';

interface InboxPage {
  total: number;
  unreadCount: number;
  items: { id: string; channel: string; status: string; readAt: string | null }[];
}

test.describe.serial('inquiries', () => {
  test('member 문의 on a listing → office replies in 문의함 → member reads it in MY + notification', async ({
    page,
    context,
    browser,
    playwright,
  }) => {
    test.setTimeout(120_000);
    const office = await apiSessionAs(playwright, OWNER);
    const agency = await office.api.get<{ id: string; name: string }>('/agencies/mine');
    const nickname = `문의회원${Math.floor(Math.random() * 900) + 100}`;
    const { api } = await loginAs(context, `${uniq('inq')}@e2e.example.invalid`, { nickname });
    const listing = (await findListings(api, { primaryAgencyId: agency.id }))[0]!;
    expect(listing, `a published listing of ${agency.name}`).toBeTruthy();
    const question = `e2e 회원 문의 ${Date.now()}: 관리비와 입주 가능 시기가 궁금해요.`;
    const answer = `e2e 답변 ${Date.now()}: 관리비는 월 15만 원 정도이고, 다음 달 입주 가능해요.`;

    // 1. The member asks from the listing page (BrokersCard → 문의하기 → 문의 남기기).
    await page.goto(`/listing/${listing.id}`);
    await page
      .getByRole('button', { name: `${agency.name}에 문의하기` })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: '중개사무소에 문의하기' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('연락처 (선택)')).toBeVisible(); // optional for members
    const name = dialog.getByLabel('이름');
    if (!(await name.inputValue())) await name.fill(nickname);
    await dialog.getByLabel('문의 내용').fill(question);
    await dialog.getByRole('checkbox', { name: /문의 개인정보 수집·이용 및 제공 동의/ }).check();
    await shots(page, 'inq-01-member-form');
    const sent = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/inquiries') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '문의 보내기' }).click();
    const res = await sent;
    expect(res.status(), await bodyOf(res)).toBe(201);
    const created = (await res.json()) as { id: string; member: boolean };
    expect(created.member).toBe(true);
    await expect(dialog.getByText('문의를 보냈어요')).toBeVisible();
    await shots(page, 'inq-02-member-sent');

    // 2. The office answers in the console (notification deep link /agent/inquiries?id=…).
    const ownerCtx = await browser.newContext({ baseURL: WEB_URL });
    await loginAs(ownerCtx, OWNER);
    const inbox = await ownerCtx.newPage();
    await inbox.goto('/agent/inquiries');
    const row = inbox.getByRole('button').filter({ hasText: question.slice(0, 20) });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('홈페이지'); // source MAIN
    await expect(row).not.toContainText('비회원');
    await row.click();
    const drawer = inbox.getByRole('dialog');
    await expect(drawer.getByText(question)).toBeVisible();
    await drawer.getByLabel('답변').fill(answer);
    await shots(inbox, 'inq-03-console-reply');
    const replied = inbox.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/agency/inquiries/${created.id}/replies`) &&
        r.request().method() === 'POST',
    );
    await drawer.getByRole('button', { name: '답변 보내기' }).click();
    const rr = await replied;
    expect(rr.ok(), await bodyOf(rr)).toBe(true);
    await expect(drawer.getByText(answer)).toBeVisible();
    await shots(inbox, 'inq-04-console-replied');
    const detail = await office.api.get<{ status: string }>(`/agency/inquiries/${created.id}`);
    expect(detail.status).toBe('IN_PROGRESS');
    await ownerCtx.close();
    await office.dispose();

    // 3. The member sees the answer under MY > 문의 내역 …
    await page.goto('/me/inquiries');
    const item = page.getByRole('listitem').filter({ hasText: agency.name }).first();
    await expect(item).toBeVisible();
    await expect(item).toContainText('새 답변');
    await expect(item).toContainText(answer); // preview = latest message
    await shots(page, 'inq-05-me-list');
    await item.locator(`a[href="/me/inquiries/${created.id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/me/inquiries/${created.id}$`));
    await expect(page.getByText(question)).toBeVisible();
    await expect(page.getByText(answer)).toBeVisible();
    await shots(page, 'inq-06-me-thread', { fullPage: true });

    // … and the INQUIRY_REPLIED notification, linking to the thread.
    const feed = await api.get<{ items: { type: string; data: Record<string, unknown> }[] }>(
      '/me/notifications?pageSize=20',
    );
    const note = feed.items.find((n) => n.type === 'INQUIRY_REPLIED');
    expect(note?.data).toEqual(expect.objectContaining({ inquiryId: created.id }));
    expect(note?.data).not.toHaveProperty('agencyId');
    await page.goto('/me/notifications');
    const link = page.locator(`a[href="/me/inquiries/${created.id}"]`).first();
    await expect(link).toBeVisible();
    await shots(page, 'inq-07-me-notification');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/me/inquiries/${created.id}$`));
  });

  test('바로 연락 (번호 복사) is logged in the 문의함 but does not raise the unread badge', async ({
    page,
    context,
    browser,
    playwright,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: WEB_URL });
    const office = await apiSessionAs(playwright, OWNER);
    const agency = await office.api.get<{ id: string; name: string }>('/agencies/mine');
    // A fresh member: the 6-hour dedupe is per visitor, so earlier runs never swallow the event.
    const { api } = await loginAs(context, `${uniq('call')}@e2e.example.invalid`, {
      nickname: '연락회원',
    });
    const listing = (await findListings(api, { primaryAgencyId: agency.id }))[0]!;
    const before = await office.api.get<InboxPage>('/agency/inquiries?pageSize=1');
    const copiesBefore = await office.api.get<InboxPage>(
      '/agency/inquiries?channel=COPY&pageSize=1',
    );

    await page.goto(`/listing/${listing.id}`);
    await page
      .getByRole('button', { name: `${agency.name}에 문의하기` })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: '중개사무소에 문의하기' });
    await dialog.getByRole('tab', { name: '바로 연락' }).click();
    const logged = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/v1/inquiries/contact-events') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: /^전화번호 .+ 복사$/ }).click();
    const res = await logged;
    expect(res.status(), await bodyOf(res)).toBe(204);
    await shots(page, 'inq-08-contact-copy');

    const copies = await office.api.get<InboxPage>('/agency/inquiries?channel=COPY&pageSize=1');
    expect(copies.total).toBe(copiesBefore.total + 1);
    expect(copies.items[0]!.readAt).not.toBeNull();
    const after = await office.api.get<InboxPage>('/agency/inquiries?pageSize=1');
    expect(after.total).toBe(before.total + 1);
    expect(after.unreadCount).toBe(before.unreadCount);

    // Console: the row is there (번호 복사), the 문의함 badge did not move.
    const ownerCtx = await browser.newContext({ baseURL: WEB_URL });
    await loginAs(ownerCtx, OWNER);
    const inbox = await ownerCtx.newPage();
    await inbox.goto('/agent/inquiries');
    const nav = inbox.getByRole('link', { name: /^문의함/ }).first();
    await expect(nav).toBeVisible();
    const badge = (await nav.innerText()).replace(/\D/g, '');
    expect(badge === '' ? 0 : Number(badge)).toBe(after.unreadCount);
    await expect(inbox.getByRole('button').filter({ hasText: '번호 복사' }).first()).toBeVisible();
    await shots(inbox, 'inq-09-console-contact-event');
    await ownerCtx.close();
    await office.dispose();
  });
});
