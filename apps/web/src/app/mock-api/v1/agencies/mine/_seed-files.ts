import { mediaStore } from '../../media/_store';

/**
 * Placeholder files behind the seeded agency documents (`seed-office-*`), so "열람" on
 * /agent/apply opens a real file in mock mode (GET /media/:id/private) instead of a 404.
 * One-page PDFs built in memory; registered once per dev-server process.
 */
const SEED_FILES: readonly { id: string; fileName: string; title: string }[] = [
  {
    id: 'seed-office-registration',
    fileName: '중개사무소등록증.pdf',
    title: 'Registration certificate',
  },
  { id: 'seed-office-business', fileName: '사업자등록증.pdf', title: 'Business registration' },
  { id: 'seed-office-deduction', fileName: '공제증서_2026.pdf', title: 'Guarantee insurance' },
];

/** A minimal, valid one-page PDF showing `title` (ASCII only — no embedded font needed). */
export function placeholderPdf(title: string): Uint8Array {
  const text = `(${title.replace(/[()\\]/g, '')} - mock document) Tj`;
  const stream = `BT /F1 18 Tf 72 720 Td ${text} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
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
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

export function ensureSeedDocumentFiles(): void {
  const store = mediaStore();
  for (const f of SEED_FILES) {
    if (store.has(f.id)) continue;
    store.set(f.id, {
      id: f.id,
      purpose: 'AGENCY_DOCUMENT',
      mimeType: 'application/pdf',
      fileName: f.fileName,
      bytes: placeholderPdf(f.title),
      createdAt: Date.parse('2025-03-10T14:03:00+09:00'),
    });
  }
}
