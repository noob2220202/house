import { describe, expect, it } from 'vitest';
import {
  adminAccountState,
  generateTempPassword,
  ipAllowedBy,
  parseIpAllowlist,
  type AdminAccountLike,
} from './admins';
import { auditRange, rangePresetOf, shiftDate } from './audit';
import { formatBusinessNumber, isValidBusinessNumber } from './business';
import {
  PHOTO_MAX_COUNT,
  applyPhotoChange,
  photoFileError,
  suggestPyeongLabel,
  takeWithinLimit,
} from './complex';
import { diffJson, formatDiffValue, summarizeDiff } from './diff';
import { normalizeFlags, orderedFlags } from './features';
import {
  DEFAULT_HOME_SECTIONS,
  canMoveSection,
  normalizeHomeLayout,
  sameLayout,
} from './home-layout';
import {
  auditActionLabel,
  auditActionTone,
  fieldLabel,
  formatYearMonthInt,
  inputToYm,
  ymToInput,
} from './labels';
import { moveById, moveItem, sameOrder } from './reorder';
import {
  compareVersions,
  daysUntil,
  isoToKstDate,
  kstDateAfter,
  kstDateToIso,
  nextVersion,
  termsState,
} from './terms';
import { durationLabel, nextScheduledRun, previousYearMonth } from './trade-sync';
import { describeUserAgent } from './user-agent';

describe('business number', () => {
  it('formats progressively', () => {
    expect(formatBusinessNumber('1')).toBe('1');
    expect(formatBusinessNumber('1234')).toBe('123-4');
    expect(formatBusinessNumber('123456')).toBe('123-45-6');
    expect(formatBusinessNumber('123 45 67890 99')).toBe('123-45-67890');
  });

  it('checks the 국세청 check digit', () => {
    // 220-81-62517 is the well-known sample number with a valid check digit.
    expect(isValidBusinessNumber('220-81-62517')).toBe(true);
    expect(isValidBusinessNumber('220-81-62518')).toBe(false);
    expect(isValidBusinessNumber('123-45')).toBe(false);
    expect(isValidBusinessNumber('')).toBe(false);
  });

  it('accepts the all-zero placeholder', () => {
    expect(isValidBusinessNumber('000-00-00000')).toBe(true);
  });
});

describe('diffJson', () => {
  it('reports changed, added and removed fields', () => {
    const rows = diffJson(
      { households: 598, floorsMax: 27, builder: null, note: 'x' },
      { households: 612, floorsMax: 27, builder: '[시공사 G]', extra: true },
    );
    expect(rows).toEqual([
      { path: 'households', kind: 'changed', before: 598, after: 612 },
      { path: 'builder', kind: 'changed', before: null, after: '[시공사 G]' },
      { path: 'extra', kind: 'added', after: true },
      { path: 'note', kind: 'removed', before: 'x' },
    ]);
  });

  it('treats a create / delete as all added / all removed', () => {
    expect(diffJson(null, { a: 1, b: 2 }).map((r) => r.kind)).toEqual(['added', 'added']);
    expect(diffJson({ a: 1 }, null).map((r) => r.kind)).toEqual(['removed']);
    expect(diffJson(null, null)).toEqual([]);
  });

  it('flattens nested objects and compares arrays as whole values', () => {
    const rows = diffJson(
      { address: { road: 'A', jibun: '1' }, order: ['x', 'y'] },
      { address: { road: 'B', jibun: '1' }, order: ['y', 'x'] },
    );
    expect(rows.map((r) => r.path)).toEqual(['address.road', 'order']);
  });

  it('includes unchanged fields on request', () => {
    const rows = diffJson({ a: 1, b: 2 }, { a: 1, b: 3 }, { includeUnchanged: true });
    expect(rows.map((r) => r.kind)).toEqual(['unchanged', 'changed']);
  });

  it('formats values and summaries', () => {
    expect(formatDiffValue(null)).toBe('없음');
    expect(formatDiffValue('')).toBe('(빈 값)');
    expect(formatDiffValue(true)).toBe('예');
    expect(formatDiffValue(['a'])).toBe('["a"]');
    expect(summarizeDiff(diffJson({ a: 1, b: 1 }, { a: 2, c: 1 }))).toBe(
      '1개 변경 · 1개 추가 · 1개 삭제',
    );
    expect(summarizeDiff([])).toBe('변경 내용 없음');
  });
});

describe('audit labels', () => {
  it('builds a Korean label from the action code', () => {
    expect(auditActionLabel('complex.photo.add')).toBe('단지 사진 추가');
    expect(auditActionLabel('user.view_personal_data')).toBe('회원 개인정보 열람');
    expect(auditActionLabel('something.unknown')).toBe('something.unknown');
  });

  it('picks a tone by the kind of change', () => {
    expect(auditActionTone('notice.delete')).toBe('danger');
    expect(auditActionTone('agency.approve')).toBe('success');
    expect(auditActionTone('admin.reset_totp')).toBe('warn');
    expect(auditActionTone('complex.trade_sync.trigger')).toBe('brand');
    expect(auditActionTone('faq.update')).toBe('neutral');
  });

  it('labels diff paths', () => {
    expect(fieldLabel('households')).toBe('세대수');
    expect(fieldLabel('address.unknownKey')).toBe('주소 › unknownKey');
  });

  it('converts year-months', () => {
    expect(formatYearMonthInt(202611)).toBe('2026년 11월');
    expect(ymToInput(202603)).toBe('2026-03');
    expect(inputToYm('2026-03')).toBe(202603);
    expect(inputToYm('2026/03')).toBeNull();
  });
});

describe('audit range', () => {
  it('turns KST dates into the query datetimes', () => {
    expect(auditRange('2026-11-01', '2026-11-23')).toEqual({
      from: '2026-11-01T00:00:00+09:00',
      to: '2026-11-23T23:59:59.999+09:00',
    });
    expect(auditRange('', 'nope')).toEqual({ from: undefined, to: undefined });
  });

  it('recognises the quick ranges', () => {
    const today = '2026-11-24';
    expect(rangePresetOf('', '', today)).toBe('all');
    expect(rangePresetOf(today, today, today)).toBe('today');
    expect(rangePresetOf('2026-11-18', today, today)).toBe('7d');
    expect(rangePresetOf('2026-10-26', today, today)).toBe('30d');
    expect(rangePresetOf('2026-11-01', today, today)).toBe('custom');
    expect(rangePresetOf('2026-11-18', '2026-11-20', today)).toBe('custom');
  });

  it('shifts dates across month and year ends', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('home layout', () => {
  it('drops unknown / duplicate keys, appends new sections and pins the hero', () => {
    const layout = normalizeHomeLayout({
      sections: [
        { key: 'NOTICES', visible: false },
        { key: 'HERO_SEARCH', visible: false },
        { key: 'NOTICES', visible: true },
      ],
    });
    expect(layout[0]).toEqual({ key: 'HERO_SEARCH', visible: true });
    expect(layout[1]).toEqual({ key: 'NOTICES', visible: false });
    expect(layout).toHaveLength(DEFAULT_HOME_SECTIONS.length);
    expect(new Set(layout.map((s) => s.key)).size).toBe(layout.length);
  });

  it('falls back to the default layout', () => {
    expect(sameLayout(normalizeHomeLayout(null), DEFAULT_HOME_SECTIONS)).toBe(true);
  });

  it('keeps locked sections in place', () => {
    const layout = normalizeHomeLayout(null);
    expect(canMoveSection(layout, 0, 1)).toBe(false);
    expect(canMoveSection(layout, 1, -1)).toBe(false);
    expect(canMoveSection(layout, 1, 1)).toBe(true);
    expect(canMoveSection(layout, layout.length - 1, 1)).toBe(false);
    expect(canMoveSection(layout, layout.length - 1, -1)).toBe(true);
  });
});

describe('reorder', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('moves items without mutating the input', () => {
    expect(moveItem(list, 0, 2).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(list.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(list, 0, 9).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
  it('moves by id and compares orders', () => {
    const moved = moveById(list, 'c', -1);
    expect(moved.map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(sameOrder(list, moved)).toBe(false);
    expect(sameOrder(list, [...list])).toBe(true);
    expect(moveById(list, 'a', -1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('terms', () => {
  const now = new Date('2026-11-24T03:00:00Z'); // 12:00 KST

  it('derives the lifecycle state', () => {
    const base = { effectiveAt: '2026-12-15T00:00:00+09:00', isCurrent: false };
    expect(termsState({ ...base, publishedAt: null }, now)).toBe('draft');
    expect(termsState({ ...base, publishedAt: '2026-11-20T10:00:00+09:00' }, now)).toBe(
      'scheduled',
    );
    expect(
      termsState(
        { effectiveAt: '2026-10-01T00:00:00+09:00', publishedAt: 'x', isCurrent: true },
        now,
      ),
    ).toBe('current');
    expect(
      termsState(
        { effectiveAt: '2026-08-01T00:00:00+09:00', publishedAt: 'x', isCurrent: false },
        now,
      ),
    ).toBe('past');
  });

  it('compares and suggests versions numerically', () => {
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0', '2')).toBe(0);
    expect(nextVersion([])).toBe('1.0');
    expect(nextVersion(['1.0', '1.9', '1.10'])).toBe('1.11');
    expect(nextVersion(['draft', '2.3.1'])).toBe('2.4');
  });

  it('converts between KST dates and ISO datetimes', () => {
    expect(kstDateToIso('2026-12-15')).toBe('2026-12-15T00:00:00+09:00');
    expect(isoToKstDate('2026-12-14T15:00:00Z')).toBe('2026-12-15');
    expect(isoToKstDate('nope')).toBe('');
    expect(kstDateAfter(7, now)).toBe('2026-12-01');
    expect(kstDateAfter(0, new Date('2026-11-24T16:00:00Z'))).toBe('2026-11-25');
  });

  it('counts whole KST days until the effective date', () => {
    expect(daysUntil('2026-12-15T00:00:00+09:00', now)).toBe(21);
    expect(daysUntil('2026-11-24T00:00:00+09:00', now)).toBe(0);
    expect(daysUntil('2026-11-01T00:00:00+09:00', now)).toBe(-23);
  });
});

describe('trade sync', () => {
  it('computes the target month in KST', () => {
    expect(previousYearMonth(new Date('2026-11-24T03:00:00Z'))).toBe(202610);
    expect(previousYearMonth(new Date('2026-01-10T03:00:00Z'))).toBe(202512);
    // 2026-11-30 16:00 UTC is already December 1st in Korea.
    expect(previousYearMonth(new Date('2026-11-30T16:00:00Z'))).toBe(202611);
    expect(previousYearMonth(new Date('2026-11-24T03:00:00Z'), 0)).toBe(202611);
  });

  it('finds the next monthly run', () => {
    expect(nextScheduledRun(new Date('2026-11-24T03:00:00Z'))).toBe('12.01 04:00');
    expect(nextScheduledRun(new Date('2026-11-30T18:59:00Z'))).toBe('12.01 04:00'); // 03:59 KST
    expect(nextScheduledRun(new Date('2026-11-30T19:00:00Z'))).toBe('01.01 04:00'); // 04:00 KST
  });

  it('formats durations', () => {
    expect(durationLabel('2026-11-20T10:12:00+09:00', '2026-11-20T10:12:38+09:00')).toBe('38초');
    expect(durationLabel('2026-11-20T10:12:00+09:00', '2026-11-20T10:14:05+09:00')).toBe('2분 5초');
    expect(durationLabel('2026-11-20T10:12:00+09:00', '2026-11-20T10:14:00+09:00')).toBe('2분');
    expect(durationLabel('2026-11-20T10:12:00+09:00', null)).toBe('–');
  });
});

describe('admin accounts', () => {
  const now = new Date('2026-11-24T03:00:00Z');
  const base: AdminAccountLike = {
    status: 'ACTIVE',
    totpEnabled: true,
    lockedUntil: null,
    lastLoginAt: '2026-11-23T10:00:00+09:00',
  };

  it('ranks disabled > locked > pending > active', () => {
    expect(adminAccountState(base, now)).toBe('active');
    expect(adminAccountState({ ...base, totpEnabled: false, lastLoginAt: null }, now)).toBe(
      'pending',
    );
    expect(adminAccountState({ ...base, lockedUntil: '2026-11-24T12:30:00+09:00' }, now)).toBe(
      'locked',
    );
    expect(adminAccountState({ ...base, lockedUntil: '2026-11-24T11:30:00+09:00' }, now)).toBe(
      'active',
    );
    expect(
      adminAccountState(
        { ...base, status: 'DISABLED', lockedUntil: '2026-11-24T12:30:00+09:00' },
        now,
      ),
    ).toBe('disabled');
    // shared AdminAccountView only says `locked` (no end time)
    expect(adminAccountState({ ...base, locked: true }, now)).toBe('locked');
  });

  it('parses the IP allowlist textarea', () => {
    expect(parseIpAllowlist('203.0.113.10\n 203.0.113.0/24 ,203.0.113.10\n\n')).toEqual([
      '203.0.113.10',
      '203.0.113.0/24',
    ]);
    expect(parseIpAllowlist('  ')).toEqual([]);
  });

  it('tells whether an address is inside the allowlist', () => {
    expect(ipAllowedBy('203.0.113.24', [])).toBe(true);
    expect(ipAllowedBy('203.0.113.24', ['203.0.113.24'])).toBe(true);
    expect(ipAllowedBy('203.0.113.24', ['203.0.113.0/24'])).toBe(true);
    expect(ipAllowedBy('203.0.114.1', ['203.0.113.0/24'])).toBe(false);
    expect(ipAllowedBy('10.1.2.3', ['10.0.0.0/8', '203.0.113.5'])).toBe(true);
    expect(ipAllowedBy('198.51.100.8', ['203.0.113.5'])).toBe(false);
    expect(ipAllowedBy('2001:db8::1', ['203.0.113.5'])).toBe(true);
  });

  it('generates temporary passwords that satisfy the policy', () => {
    for (let i = 0; i < 50; i += 1) {
      const pw = generateTempPassword();
      expect(pw).toHaveLength(16);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/\d/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
      expect(pw).not.toMatch(/[lIO01]/);
    }
    expect(generateTempPassword(4)).toHaveLength(12);
    // Deterministic with an injected random source.
    expect(generateTempPassword(12, () => 0)).toBe(generateTempPassword(12, () => 0));
  });
});

describe('complex helpers', () => {
  it('suggests the 평형 label from the supply area', () => {
    expect(suggestPyeongLabel(84.98, 112.4)).toBe('34평');
    expect(suggestPyeongLabel(59.97, null)).toBe('18평');
    expect(suggestPyeongLabel(null, null)).toBeNull();
    expect(suggestPyeongLabel(Number.NaN, null)).toBeNull();
  });

  it('pre-checks photo files', () => {
    expect(photoFileError({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(photoFileError({ type: 'image/gif', size: 1024 })).toMatch(/JPG/);
    expect(photoFileError({ type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/10MB/);
    expect(photoFileError({ type: 'image/webp', size: 0 })).toMatch(/빈 파일/);
  });

  it('keeps uploads within the photo limit', () => {
    const files = ['a', 'b', 'c'];
    expect(takeWithinLimit(files, PHOTO_MAX_COUNT - 2)).toEqual({
      accepted: ['a', 'b'],
      rejected: ['c'],
    });
    expect(takeWithinLimit(files, PHOTO_MAX_COUNT + 5).accepted).toEqual([]);
    expect(takeWithinLimit(files, 0).rejected).toEqual([]);
  });
});

describe('feature flags', () => {
  it('lists known flags first and fills missing ones with off', () => {
    const flags = normalizeFlags({ zeta: true, dealRequests: true, alpha: false });
    expect(Object.keys(flags).slice(-2)).toEqual(['alpha', 'zeta']);
    expect(flags.dealRequests).toBe(true);
    expect(flags.tradeHistory).toBe(false);
    expect(orderedFlags({})).toEqual(Object.keys(normalizeFlags(null)));
  });
});

describe('describeUserAgent', () => {
  it('names the browser and OS', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome 141 · macOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      ),
    ).toBe('Edge 141 · Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari 19 · iOS');
  });

  it('falls back gracefully', () => {
    expect(describeUserAgent(null)).toBe('기록 없음');
    expect(describeUserAgent('curl/8.5.0')).toBe('curl/8.5.0');
  });
});

describe('applyPhotoChange (whole-list PUT …/photos)', () => {
  const p = (mediaId: string, sortOrder: number, caption: string | null = null) => ({
    mediaId,
    caption,
    sortOrder,
  });
  const list = [p('a', 0), p('b', 1), p('c', 2)];

  it('appends, ignores a duplicate and renumbers', () => {
    expect(
      applyPhotoChange(list, { kind: 'add', photo: p('d', 9) }).map((x) => x.sortOrder),
    ).toEqual([0, 1, 2, 3]);
    expect(applyPhotoChange(list, { kind: 'add', photo: p('a', 9) })).toHaveLength(3);
  });

  it('moves within bounds (first = 대표 사진)', () => {
    const moved = applyPhotoChange(list, { kind: 'move', mediaId: 'c', delta: -1 });
    expect(moved.map((x) => x.mediaId)).toEqual(['a', 'c', 'b']);
    expect(moved.map((x) => x.sortOrder)).toEqual([0, 1, 2]);
    expect(
      applyPhotoChange(list, { kind: 'move', mediaId: 'a', delta: -1 }).map((x) => x.mediaId),
    ).toEqual(['a', 'b', 'c']);
  });

  it('edits a caption and removes a photo', () => {
    expect(
      applyPhotoChange(list, { kind: 'caption', mediaId: 'b', caption: '단지 전경' })[1]?.caption,
    ).toBe('단지 전경');
    const removed = applyPhotoChange(list, { kind: 'remove', mediaId: 'a' });
    expect(removed.map((x) => [x.mediaId, x.sortOrder])).toEqual([
      ['b', 0],
      ['c', 1],
    ]);
  });
});
