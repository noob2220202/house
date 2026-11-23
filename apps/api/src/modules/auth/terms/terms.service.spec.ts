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
