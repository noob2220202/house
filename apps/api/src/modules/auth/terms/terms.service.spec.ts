import { ErrorCode, TermsType } from '@house/shared';
import type { TermsDocument } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import type { PrismaService } from '../../../prisma/prisma.service';
import { TermsService } from './terms.service';

const doc = (id: string, type: TermsType, isRequired: boolean): TermsDocument => ({
  id,
  type,
  isRequired,
  version: '1.0',
  title: type,
  content: '',
  effectiveAt: new Date(0),
  publishedAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe('TermsService.validate', () => {
  const svc = new TermsService({} as PrismaService);
  const current = [
    doc('s', TermsType.SERVICE, true),
    doc('p', TermsType.PRIVACY, true),
    doc('m', TermsType.MARKETING, false),
  ];

  const codeOf = (fn: () => unknown): string | undefined => {
    try {
      fn();
    } catch (e) {
      return e instanceof AppException ? e.code : 'other';
    }
    return undefined;
  };

  it('passes when every required document is agreed', () => {
    const byId = svc.validate(
      current,
      [
        { termsDocumentId: 's', agreed: true },
        { termsDocumentId: 'p', agreed: true },
        { termsDocumentId: 'm', agreed: false },
      ],
      { requireAll: true },
    );
    expect(byId.get('m')?.type).toBe(TermsType.MARKETING);
  });

  it('reports missing required types', () => {
    expect(
      codeOf(() =>
        svc.validate(current, [{ termsDocumentId: 's', agreed: true }], { requireAll: true }),
      ),
    ).toBe(ErrorCode.AUTH_TERMS_REQUIRED);
    // partial updates are fine outside signup
    expect(
      codeOf(() =>
        svc.validate(current, [{ termsDocumentId: 'm', agreed: true }], { requireAll: false }),
      ),
    ).toBeUndefined();
  });

  it('rejects unknown/stale ids, duplicates and declining a required document', () => {
    expect(
      codeOf(() =>
        svc.validate(current, [{ termsDocumentId: 'old', agreed: true }], { requireAll: false }),
      ),
    ).toBe(ErrorCode.AUTH_TERMS_INVALID);
    expect(
      codeOf(() =>
        svc.validate(
          current,
          [
            { termsDocumentId: 'm', agreed: true },
            { termsDocumentId: 'm', agreed: false },
          ],
          { requireAll: false },
        ),
      ),
    ).toBe(ErrorCode.AUTH_TERMS_INVALID);
    expect(
      codeOf(() =>
        svc.validate(current, [{ termsDocumentId: 's', agreed: false }], { requireAll: false }),
      ),
    ).toBe(ErrorCode.AUTH_REQUIRED_TERMS_REVOKE);
  });
});

describe('TermsService.verifyActionConsents (D8 purpose consents)', () => {
  const DEAL = [TermsType.DEAL_REQUEST_PRIVACY, TermsType.DEAL_REQUEST_PROVIDE] as const;
  const docs = [
    { ...doc('dp', TermsType.DEAL_REQUEST_PRIVACY, true), version: '1.2' },
    { ...doc('dv', TermsType.DEAL_REQUEST_PROVIDE, true), version: '2.0' },
  ];
  /** Prisma stub: the `where.type.in` filter of current() is honoured. */
  const svcWith = (rows: TermsDocument[]) => {
    const findMany = jest.fn(({ where }: { where: { type: { in: TermsType[] } } }) =>
      Promise.resolve(rows.filter((r) => where.type.in.includes(r.type))),
    );
    return { svc: new TermsService({ termsDocument: { findMany } } as never), findMany };
  };
  const failure = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return e instanceof AppException
        ? { code: e.code, status: e.getStatus(), details: e.details }
        : { code: 'other' };
    }
    return undefined;
  };

  it('returns one agreed decision per type when every current version is given', async () => {
    const { svc, findMany } = svcWith(docs);
    const out = await svc.verifyActionConsents(DEAL, [
      { type: TermsType.DEAL_REQUEST_PROVIDE, version: '2.0' },
      { type: TermsType.DEAL_REQUEST_PRIVACY, version: '1.2' },
    ]);
    expect(out).toEqual([
      { termsDocumentId: 'dp', agreed: true },
      { termsDocumentId: 'dv', agreed: true },
    ]);
    expect(findMany.mock.calls[0]?.[0].where.type.in).toEqual([...DEAL]);
  });

  it('400 AUTH_CONSENT_REQUIRED lists the types that were not agreed', async () => {
    const { svc } = svcWith(docs);
    expect(
      await failure(
        svc.verifyActionConsents(DEAL, [{ type: TermsType.DEAL_REQUEST_PRIVACY, version: '1.2' }]),
      ),
    ).toEqual({
      code: ErrorCode.AUTH_CONSENT_REQUIRED,
      status: 400,
      details: { missing: [TermsType.DEAL_REQUEST_PROVIDE] },
    });
  });

  it('400 AUTH_CONSENT_OUTDATED names the version the form showed and the current one', async () => {
    const { svc } = svcWith(docs);
    expect(
      await failure(
        svc.verifyActionConsents(DEAL, [
          { type: TermsType.DEAL_REQUEST_PRIVACY, version: '1.2' },
          { type: TermsType.DEAL_REQUEST_PROVIDE, version: '1.0' },
        ]),
      ),
    ).toEqual({
      code: ErrorCode.AUTH_CONSENT_OUTDATED,
      status: 400,
      details: {
        outdated: [{ type: TermsType.DEAL_REQUEST_PROVIDE, version: '1.0', currentVersion: '2.0' }],
      },
    });
  });

  it('503 AUTH_CONSENT_UNAVAILABLE while a document is not published', async () => {
    const { svc } = svcWith([docs[0]!]);
    expect(
      await failure(
        svc.verifyActionConsents(DEAL, [
          { type: TermsType.DEAL_REQUEST_PRIVACY, version: '1.2' },
          { type: TermsType.DEAL_REQUEST_PROVIDE, version: '2.0' },
        ]),
      ),
    ).toMatchObject({
      code: ErrorCode.AUTH_CONSENT_UNAVAILABLE,
      status: 503,
      details: { types: [TermsType.DEAL_REQUEST_PROVIDE] },
    });
  });

  it('400 AUTH_TERMS_INVALID for a type the action does not ask for', async () => {
    const { svc } = svcWith(docs);
    expect(
      await failure(svc.verifyActionConsents(DEAL, [{ type: TermsType.SERVICE, version: '1.0' }])),
    ).toMatchObject({ code: ErrorCode.AUTH_TERMS_INVALID });
  });

  it('account-term reads never include purpose consents', async () => {
    const { svc, findMany } = svcWith(docs);
    expect(await svc.current()).toEqual([]);
    expect(findMany.mock.calls[0]?.[0].where.type.in).toEqual([
      TermsType.SERVICE,
      TermsType.PRIVACY,
      TermsType.LOCATION,
      TermsType.MARKETING,
    ]);
  });
});
