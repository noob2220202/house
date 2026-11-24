import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { AdminAgencyDetail } from '@/features/m-moderation/api/schemas';
import { isBlocked, modGate } from '@/features/m-moderation/mock/handler';
import { mockNotFound } from '@/lib/mock';
import { MOCK_DOC_LABEL, agenciesDb } from '../../../_fixtures';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A stand-in scan of a certificate (fictional data, clearly marked as a sample). */
function certificateSvg(agency: AdminAgencyDetail, title: string): string {
  const rows: [string, string][] = [
    ['등록번호', agency.registrationNumber],
    ['상호', agency.name],
    ['대표자', agency.representativeName],
    [
      '소재지',
      `전라남도 ${agency.roadAddress}${agency.addressDetail ? `, ${agency.addressDetail}` : ''}`,
    ],
    [
      '사업자등록번호',
      (agency.businessNumber ?? '').replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3'),
    ],
  ];
  const lines = rows
    .map(
      ([k, v], i) =>
        `<text x="120" y="${330 + i * 74}" font-size="26" fill="#646f7c">${esc(k)}</text>` +
        `<text x="340" y="${330 + i * 74}" font-size="28" font-weight="700" fill="#0a1222">${esc(v)}</text>` +
        `<line x1="120" y1="${352 + i * 74}" x2="880" y2="${352 + i * 74}" stroke="#e5e8eb"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1414" width="1000" height="1414" font-family="'Noto Sans KR','Malgun Gothic',sans-serif">
<rect width="1000" height="1414" fill="#fbfaf6"/>
<rect x="44" y="44" width="912" height="1326" fill="none" stroke="#c9b98a" stroke-width="3"/>
<rect x="58" y="58" width="884" height="1298" fill="none" stroke="#e9d7a8" stroke-width="1"/>
<text x="500" y="190" text-anchor="middle" font-size="52" font-weight="800" letter-spacing="14" fill="#0a1222">${esc(title)}</text>
<line x1="380" y1="222" x2="620" y2="222" stroke="#0a1222" stroke-width="2"/>
${lines}
<text x="500" y="820" text-anchor="middle" font-size="24" fill="#333d4b">「공인중개사법」에 따라 위와 같이 등록하였음을 증명합니다.</text>
<text x="500" y="940" text-anchor="middle" font-size="26" fill="#333d4b">2026년 11월 18일</text>
<text x="500" y="1080" text-anchor="middle" font-size="40" font-weight="800" letter-spacing="10" fill="#0a1222">순 천 시 장</text>
<circle cx="760" cy="1066" r="58" fill="none" stroke="#c81e2c" stroke-width="4" opacity=".7"/>
<text x="760" y="1076" text-anchor="middle" font-size="24" font-weight="800" fill="#c81e2c" opacity=".7">직인</text>
<text x="500" y="1290" text-anchor="middle" font-size="20" fill="#8b95a1">개발용 견본 · 실제 문서가 아닙니다 (MOCK)</text>
<text transform="translate(500 700) rotate(-28)" text-anchor="middle" font-size="120" font-weight="800" fill="#0a1222" opacity=".04">SAMPLE</text>
</svg>`;
}

/** Minimal one-page PDF (ASCII only) so the viewer's PDF path can be exercised without a backend. */
function samplePdf(lines: string[]): Uint8Array {
  const text = lines
    .map(
      (l, i) =>
        `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${760 - i * 28} Td (${l.replace(/[()\\]/g, '')}) Tj ET`,
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

// GET /api/v1/admin/agencies/:id/documents/:docId — authorized stream of a PRIVATE document.
// Never cacheable; the real endpoint audit-logs every read.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; docId: string }> },
) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const { id, docId } = await ctx.params;
  const agency = agenciesDb().find((a) => a.id === id);
  const doc = agency?.documents.find((d) => d.id === docId);
  if (!agency || !doc) return mockNotFound('AGENCY_DOCUMENT_NOT_FOUND', '서류를 찾을 수 없습니다.');

  const headers = {
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName ?? 'document')}`,
  };
  if (doc.mimeType === 'application/pdf') {
    const pdf = samplePdf([
      'Broker license (MOCK SAMPLE)',
      `Registration no. ${agency.registrationNumber}`,
      'This is a development sample, not a real document.',
    ]);
    return new NextResponse(pdf.buffer as ArrayBuffer, {
      headers: { ...headers, 'content-type': 'application/pdf' },
    });
  }
  return new NextResponse(certificateSvg(agency, MOCK_DOC_LABEL[doc.type]), {
    headers: { ...headers, 'content-type': 'image/svg+xml; charset=utf-8' },
  });
}
