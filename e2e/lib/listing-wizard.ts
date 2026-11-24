import { expect, type Locator, type Page } from 'playwright/test';
import { bodyOf } from './api';
import { FIXTURES_DIR } from './env';
import path from 'node:path';

/**
 * Drives the broker listing wizard (/agent/listings/new, apps/web features/a-listings/wizard):
 * 종류·소재지 → 거래·가격 → 면적·상세 → 사진 → 설명·옵션 → 실매물 확인 → 미리보기·게시.
 * Labels follow the wizard's accessible names; fields the complex prefills are only filled when
 * still empty, so the same driver works for 아파트 (단지 선택) and 원룸 (주소 검색).
 */
export class ListingWizard {
  constructor(readonly page: Page) {}

  /** Required groups/fields read "<label> (필수)" to screen readers (packages/ui FormRow). */
  radioGroup(name: string): Locator {
    return this.page.getByRole('radiogroup', { name: field(name) });
  }

  /** A labelled control by its label, with or without the " (필수)" suffix. */
  field(name: string): Locator {
    return this.page.getByLabel(field(name));
  }

  async choose(group: string, option: string | RegExp): Promise<void> {
    await this.radioGroup(group)
      .getByText(option, { exact: typeof option === 'string' })
      .click();
  }

  /** The highlighted step of the stepper ("3 면적·상세"). */
  currentStep(): Locator {
    return this.page
      .getByRole('list', { name: '매물 등록 단계' })
      .locator('li[aria-current="step"]');
  }

  /**
   * "다음 단계로" saves the draft first (POST/PATCH) and only then moves on, so wait for the
   * stepper to advance — a validation error keeps the step and fails here with its name.
   */
  async next(): Promise<void> {
    const before = ((await this.currentStep().textContent()) ?? '').trim();
    await this.page.getByRole('button', { name: '다음 단계로' }).click();
    await expect(this.currentStep(), `stayed on "${before}"`).not.toHaveText(before);
  }

  async fillIfEmpty(locator: Locator, value: string): Promise<void> {
    if (!(await locator.isVisible())) return;
    if ((await locator.inputValue()).trim() === '') await locator.fill(value);
  }

  async open(): Promise<void> {
    await this.page.goto('/agent/listings/new');
    await expect(this.radioGroup('중개대상물 종류')).toBeVisible();
  }

  /** 아파트: pick the complex from 단지 검색, then 동/호/층 (호 stays private). */
  async apartmentProperty(complexName: string, unit: { dong: string; ho: string; floor: string }) {
    await this.choose('중개대상물 종류', '아파트');
    const search = this.page.getByRole('combobox', { name: '단지 검색' });
    await search.fill(complexName.slice(0, Math.min(6, complexName.length)));
    await this.page
      .getByRole('option', { name: new RegExp(escapeRe(complexName)) })
      .first()
      .click();
    await expect(this.page.getByText(complexName).first()).toBeVisible();
    await this.unitFields(unit);
    // 건축물 용도: APT has an implied 공동주택 use; fill only when the select is still empty.
    await this.pickBuildingUseIfEmpty();
  }

  /**
   * 원룸: 주소 검색 (GET /geo/geocode — the external geocoder is stubbed by the test) → pin, then
   * 건물명/층/총 층수/건축물 용도.
   */
  async oneRoomProperty(roadAddress: string, unit: { floor: string; totalFloors: string }) {
    await this.choose('중개대상물 종류', /원룸/);
    const search = this.page.getByRole('combobox', { name: '주소 검색' });
    await search.fill(roadAddress.split(' ').slice(-2).join(' '));
    await this.page
      .getByRole('option', { name: new RegExp(escapeRe(roadAddress)) })
      .first()
      .click();
    await this.field('해당 층').fill(unit.floor);
    await this.fillIfEmpty(this.field('총 층수'), unit.totalFloors);
    await this.pickBuildingUseIfEmpty();
  }

  private async unitFields(unit: { dong: string; ho: string; floor: string }) {
    await this.field('동').fill(unit.dong);
    await this.field('호 (비공개)').fill(unit.ho);
    await this.field('해당 층').fill(unit.floor);
  }

  private async pickBuildingUseIfEmpty() {
    const use = this.field('건축물 용도');
    if (!(await use.isVisible())) return;
    if ((await use.inputValue()) === '') {
      // First real option of the "자주 쓰는 용도" group.
      const first = use.locator('optgroup option').first();
      await use.selectOption((await first.getAttribute('value')) ?? '');
    }
  }

  /** 거래·가격 + 관리비 (정액 0원 → no 세부 내역) + 입주가능일 즉시입주. */
  async deal(kind: '매매' | '전세' | '월세', price: { amount: string; rent?: string }) {
    await this.choose('거래 형태', kind);
    if (kind === '매매') await this.field('매매가').fill(price.amount);
    if (kind === '전세') await this.field('전세 보증금').fill(price.amount);
    if (kind === '월세') {
      await this.field('보증금').fill(price.amount);
      await this.field('월세').fill(price.rent ?? '50');
    }
    await this.field('월 관리비').fill('0');
    await this.choose('입주가능일', '즉시입주');
  }

  /** 면적·상세: 평형 (단지) or 전용면적, 방/욕실, 방향 + 기준, 사용승인일, 주차. */
  async detail(opts: { area?: string; approvalDate?: string } = {}) {
    // 단지 매물: pick the first 평형 (fills 전용·공급면적 and 방/욕실 from the area type).
    const areaTypes = this.radioGroup('평형');
    if (
      (await areaTypes.count()) > 0 &&
      !(await areaTypes.getByRole('radio', { checked: true }).count())
    ) {
      // The radio is visually hidden inside its chip <label>: click the chip.
      await areaTypes.locator('label').first().click();
    }
    await this.fillIfEmpty(this.page.getByLabel(/^전용면적 \(제곱미터\)/), opts.area ?? '23.14');
    await this.fillIfEmpty(this.field('방 수'), '1');
    await this.fillIfEmpty(this.field('욕실 수'), '1');
    await this.choose('방향', '남향');
    await this.choose('방향 기준', '거실 기준');
    await this.fillIfEmpty(this.field('사용승인일'), opts.approvalDate ?? '2015-03-02');
    await this.fillIfEmpty(this.field('총 주차대수'), '1');
  }

  async photos() {
    await this.page
      .getByLabel('매물 사진 선택')
      .setInputFiles(path.join(FIXTURES_DIR, 'listing-photo.jpg'));
    // Upload → worker processing → READY thumbnail.
    await expect(this.field('사진 1 설명')).toBeVisible({ timeout: 30_000 });
  }

  async verify() {
    await this.choose('확인 방법', '소유자 통화 확인');
    const date = this.field('확인일');
    await this.fillIfEmpty(date, new Date().toISOString().slice(0, 10));
  }

  /** 미리보기·게시: "광고 게시하기" → POST /agency/listings/:id/publish. Returns the listing id. */
  async publish(): Promise<string> {
    const published = this.page.waitForResponse(
      (r) =>
        /\/api\/v1\/agency\/listings\/[0-9a-f-]{36}\/publish$/.test(r.url()) &&
        r.request().method() === 'POST',
    );
    await this.page.getByRole('button', { name: '광고 게시하기' }).click();
    const res = await published;
    expect(res.ok(), `publish → ${res.status()} ${await bodyOf(res)}`).toBe(true);
    return /listings\/([0-9a-f-]{36})\/publish/.exec(res.url())![1]!;
  }
}

function field(name: string): RegExp {
  return new RegExp(`^${escapeRe(name)}( \\(필수\\))?$`);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
