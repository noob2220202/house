import { TermsType } from '@house/shared';
import { createTestApp, resetAll, type TestApp } from '../../utils';
import { createTerms } from './helpers';

const DAY_MS = 86_400_000;

describe('auth: GET /terms/:type/versions[/:version] (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('lists published versions newest first without content, marking the one in force', async () => {
    const now = Date.now();
    const v1 = await createTerms(t.prisma, {
      type: TermsType.SERVICE,
      version: '1.0',
      effectiveAt: new Date(now - 60 * DAY_MS),
      publishedAt: new Date(now - 70 * DAY_MS),
    });
    const v2 = await createTerms(t.prisma, {
      type: TermsType.SERVICE,
      version: '2.0',
      effectiveAt: new Date(now - DAY_MS),
      publishedAt: new Date(now - 10 * DAY_MS),
    });
    // Announced (published, effective next month), a draft, and another type.
    const v3 = await createTerms(t.prisma, {
      type: TermsType.SERVICE,
      version: '3.0',
      effectiveAt: new Date(now + 30 * DAY_MS),
      publishedAt: new Date(now - DAY_MS),
    });
    await createTerms(t.prisma, { type: TermsType.SERVICE, version: '4.0', publishedAt: null });
    await createTerms(t.prisma, { type: TermsType.PRIVACY, version: '1.0' });

    const res = await t.http().get('/api/v1/terms/service/versions').expect(200);
    expect(res.body).toEqual([
      {
        id: v3.id,
        type: 'SERVICE',
        version: '3.0',
        title: v3.title,
        isRequired: true,
        effectiveAt: v3.effectiveAt.toISOString(),
        isCurrent: false,
      },
      expect.objectContaining({ id: v2.id, version: '2.0', isCurrent: true }),
      expect.objectContaining({ id: v1.id, version: '1.0', isCurrent: false }),
    ]);
    expect(res.body[0]).not.toHaveProperty('content');

    const one = await t.http().get('/api/v1/terms/SERVICE/versions/1.0').expect(200);
    expect(one.body).toMatchObject({ id: v1.id, version: '1.0', content: v1.content });
    await t.http().get('/api/v1/terms/SERVICE/versions/4.0').expect(404);
  });

  it('empty list for a type without documents; 400 for an unknown type', async () => {
    expect((await t.http().get('/api/v1/terms/MARKETING/versions').expect(200)).body).toEqual([]);
    await t.http().get('/api/v1/terms/castle/versions').expect(400);
    await t.http().get('/api/v1/terms/SERVICE/versions/bad%20version').expect(400);
  });
});
