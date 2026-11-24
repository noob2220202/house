import { ACTION_CONSENT_TERMS, dealRequestCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockSessionRole,
  mockUnauthenticated,
} from '@/lib/mock';
import { COMPLEXES } from './_fixtures';
import {
  agenciesFor,
  dealStore,
  emptyRequest,
  MOCK_USER_ID,
  newRequestId,
  requestDetailDto,
  type MockDealRequest,
} from './_store';

const photoIdsSchema = z.object({ photoMediaIds: z.array(z.string()).max(20).optional() });

/** MediaDto of an uploaded photo built from its id (keeps this mock independent of the media store). */
const photoDto = (id: string) => {
  const url = `/mock-api/v1/media/${id}/file`;
  return {
    id,
    purpose: 'DEAL_REQUEST_PHOTO',
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    variants: {
      thumb: { url, width: 320, height: 240 },
      medium: { url, width: 960, height: 720 },
    },
  };
};

// POST /api/v1/deal-requests — create a 내놓기 (SELL_OR_LEASE) or 구하기 (WANTED) request.
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockSessionRole(req)) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(403, 'CSRF_INVALID', '보안 토큰이 올바르지 않습니다.');
  await mockDelay(req, 400);

  const raw: unknown = await req.json().catch(() => null);
  const parsed = dealRequestCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    );
  }
  const input = parsed.data;
  // D8: both purpose consents must be sent (the mock does not check the versions like the server).
  if (input.consents.length !== ACTION_CONSENT_TERMS.DEAL_REQUEST.length) {
    return mockError(400, 'AUTH_CONSENT_REQUIRED', '필수 동의 항목에 동의해 주세요.');
  }
  const now = new Date().toISOString();
  // ASSUMED extra field (not in the shared schema yet): ids of uploaded DEAL_REQUEST_PHOTO media.
  const photoIds = photoIdsSchema.safeParse(raw).data?.photoMediaIds ?? [];

  const base: MockDealRequest = {
    ...emptyRequest(),
    id: newRequestId(),
    userId: MOCK_USER_ID,
    type: input.type,
    status: 'OPEN',
    assetType: input.assetType,
    dealTypes: input.dealTypes,
    visibility: input.visibility,
    targetAgencyIds: input.targetAgencyIds,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    description: input.description ?? null,
    moveInDate: input.moveInDate ?? null,
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    createdAt: now,
    updatedAt: now,
    proposals: [],
    grants: {},
  };

  let request: MockDealRequest;
  if (input.type === 'SELL_OR_LEASE') {
    const complex = COMPLEXES.find((c) => c.id === input.complexId);
    const emdCode = complex?.emdCode ?? null;
    request = {
      ...base,
      roadAddress: input.roadAddress,
      addressDetail: input.addressDetail ?? null,
      emdCode,
      emdName: complex?.emdName ?? null,
      complexId: complex?.id ?? null,
      complexName: complex?.name ?? null,
      exclusiveArea: input.exclusiveArea ?? null,
      floor: input.floor ?? null,
      desiredSalePrice: input.desiredSalePrice ?? null,
      desiredDeposit: input.desiredDeposit ?? null,
      desiredMonthlyRent: input.desiredMonthlyRent ?? null,
      photos: photoIds.map(photoDto),
      targetAgencyCount:
        input.visibility === 'SELECTED_AGENCIES'
          ? input.targetAgencyIds.length
          : agenciesFor(emdCode ? [emdCode] : []).length,
    };
  } else {
    request = {
      ...base,
      regionCodes: input.regionCodes,
      complexIds: input.complexIds,
      priceMin: input.priceMin ?? null,
      priceMax: input.priceMax ?? null,
      depositMin: input.depositMin ?? null,
      depositMax: input.depositMax ?? null,
      rentMin: input.rentMin ?? null,
      rentMax: input.rentMax ?? null,
      areaMin: input.areaMin ?? null,
      areaMax: input.areaMax ?? null,
      roomsMin: input.roomsMin ?? null,
      targetAgencyCount:
        input.visibility === 'SELECTED_AGENCIES'
          ? input.targetAgencyIds.length
          : agenciesFor(input.regionCodes).length,
    };
  }
  dealStore().requests.unshift(request);
  return mockJson(requestDetailDto(request), { status: 201 });
}
