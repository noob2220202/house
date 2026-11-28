/** Only digits of a search term ("010-12" → "01012"); null when it holds none. */
export function phoneDigits(q: string): string | null {
  const d = q.replace(/\D/g, '');
  return d.length >= 2 ? d : null;
}

/**
 * Inquiries are scrubbed this long after their last message (retention period of the
 * INQUIRY_PRIVACY terms: 마지막 답변 후 1년).
 */
export function retentionCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Name of a listing in inquiry views and notices: its title, else 단지 / building, else address. */
export function listingTitle(l: {
  title: string | null;
  complex: { name: string } | null;
  property: { buildingName: string | null; roadAddress: string };
}): string {
  return l.title ?? l.complex?.name ?? l.property.buildingName ?? l.property.roadAddress;
}
