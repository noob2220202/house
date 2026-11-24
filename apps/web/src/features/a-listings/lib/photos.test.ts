import { describe, expect, it } from 'vitest';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  checkPhotoFiles,
  movePhoto,
  normalizeCover,
  removePhoto,
  samePhotos,
  setCover,
  toPhotosPayload,
  variantUrls,
  withPhotoType,
  type PhotoValue,
} from './photos';

const photo = (mediaId: string, patch: Partial<PhotoValue> = {}): PhotoValue => ({
  mediaId,
  url: `/media/${mediaId}/file`,
  caption: '',
  isCover: false,
  ...patch,
});
const ids = (list: readonly PhotoValue[]) => list.map((p) => p.mediaId).join('');
const covers = (list: readonly PhotoValue[]) => list.filter((p) => p.isCover).map((p) => p.mediaId);

describe('cover handling', () => {
  it('normalizeCover keeps exactly one cover (the flagged one, else the first)', () => {
    expect(normalizeCover([])).toEqual([]);
    expect(covers(normalizeCover([photo('a'), photo('b')]))).toEqual(['a']);
    expect(covers(normalizeCover([photo('a'), photo('b', { isCover: true })]))).toEqual(['b']);
    expect(
      covers(normalizeCover([photo('a', { isCover: true }), photo('b', { isCover: true })])),
    ).toEqual(['a']);
  });

  it('normalizeCover returns the same objects when nothing changes', () => {
    const list = [photo('a', { isCover: true }), photo('b')];
    const next = normalizeCover(list);
    expect(next[0]).toBe(list[0]);
    expect(next[1]).toBe(list[1]);
  });

  it('setCover moves the photo to the front and flags only it', () => {
    const next = setCover([photo('a', { isCover: true }), photo('b'), photo('c')], 'c');
    expect(ids(next)).toBe('cab');
    expect(covers(next)).toEqual(['c']);
    expect(ids(setCover([photo('a'), photo('b')], 'zz'))).toBe('ab');
  });

  it('removePhoto promotes the next photo when the cover is removed', () => {
    const next = removePhoto([photo('a', { isCover: true }), photo('b'), photo('c')], 'a');
    expect(ids(next)).toBe('bc');
    expect(covers(next)).toEqual(['b']);
    expect(removePhoto([photo('a', { isCover: true })], 'a')).toEqual([]);
  });
});

describe('movePhoto (drag / arrow-button reorder)', () => {
  const list = [photo('a'), photo('b'), photo('c'), photo('d')];

  it('moves forwards and backwards', () => {
    expect(ids(movePhoto(list, 0, 2))).toBe('bcad');
    expect(ids(movePhoto(list, 3, 0))).toBe('dabc');
    expect(ids(movePhoto(list, 1, 1))).toBe('abcd');
  });

  it('clamps the target and ignores an invalid source', () => {
    expect(ids(movePhoto(list, 0, 99))).toBe('bcda');
    expect(ids(movePhoto(list, 2, -5))).toBe('cabd');
    expect(ids(movePhoto(list, 9, 0))).toBe('abcd');
  });

  it('does not mutate the input', () => {
    movePhoto(list, 0, 3);
    expect(ids(list)).toBe('abcd');
  });
});

describe('checkPhotoFiles', () => {
  const file = (name: string, type: string, size = 1024) => {
    const f = new File(['x'], name, { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  it('accepts images and explains each rejection', () => {
    const { accepted, rejected } = checkPhotoFiles(
      [
        file('living.jpg', 'image/jpeg'),
        file('plan.pdf', 'application/pdf'),
        file('huge.png', 'image/png', PHOTO_MAX_BYTES + 1),
        file('view.webp', 'image/webp'),
      ],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(['living.jpg', 'view.webp']);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toContain('plan.pdf');
    expect(rejected[1]).toContain('10MB');
  });

  it('stops at the photo limit', () => {
    const { accepted, rejected } = checkPhotoFiles(
      [file('1.jpg', 'image/jpeg'), file('2.jpg', 'image/jpeg'), file('3.jpg', 'image/jpeg')],
      PHOTO_MAX_COUNT - 2,
    );
    expect(accepted.map((f) => f.name)).toEqual(['1.jpg', '2.jpg']);
    expect(rejected).toEqual([`3.jpg: 사진은 최대 ${PHOTO_MAX_COUNT}장까지 올릴 수 있어요.`]);
  });
});

describe('photo payload', () => {
  it('sends the order, trimmed captions and a single cover', () => {
    expect(
      toPhotosPayload([photo('a', { caption: ' 거실 ' }), photo('b', { caption: '  ' })]),
    ).toEqual({
      photos: [
        { mediaId: 'a', caption: '거실', isCover: true },
        { mediaId: 'b', caption: undefined, isCover: false },
      ],
    });
  });

  it('samePhotos detects order, caption and cover changes (unsaved-changes check)', () => {
    const a = [photo('a', { isCover: true }), photo('b')];
    expect(samePhotos(a, [photo('a', { isCover: true }), photo('b')])).toBe(true);
    expect(samePhotos(a, [photo('b'), photo('a', { isCover: true })])).toBe(false);
    expect(samePhotos(a, [photo('a', { isCover: true }), photo('b', { caption: '주방' })])).toBe(
      false,
    );
    expect(samePhotos(a, [photo('a', { isCover: true })])).toBe(false);
    expect(samePhotos([], [])).toBe(true);
  });
});

describe('HEIC files without a MIME type', () => {
  it('get their type from the extension and pass the pre-check', () => {
    const heic = new File(['x'], 'IMG_0001.HEIC', { type: '' });
    expect(withPhotoType(heic).type).toBe('image/heic');
    expect(withPhotoType(new File(['x'], 'a.heif', { type: '' })).type).toBe('image/heif');
    expect(checkPhotoFiles([heic], 0).accepted.map((f) => f.type)).toEqual(['image/heic']);
  });

  it('leave other files alone', () => {
    const typed = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    expect(withPhotoType(typed)).toBe(typed);
    const unknown = new File(['x'], 'notes.txt', { type: '' });
    expect(withPhotoType(unknown)).toBe(unknown);
    expect(checkPhotoFiles([unknown], 0).rejected).toHaveLength(1);
  });
});

describe('variantUrls (async media processing)', () => {
  it('prefers the medium variant and falls back to large / thumb', () => {
    expect(
      variantUrls({
        variants: { thumb: { url: '/t' }, medium: { url: '/m' }, large: { url: '/l' } },
      }),
    ).toEqual({ url: '/m', thumbUrl: '/t' });
    expect(variantUrls({ variants: { large: { url: '/l' } } })).toEqual({
      url: '/l',
      thumbUrl: '/l',
    });
  });

  it('is null while the server has not built any variant yet (PENDING)', () => {
    expect(variantUrls({ variants: {} })).toBeNull();
  });
});
