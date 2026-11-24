# SEO module (`apps/api/src/modules/seo`)

Read-only public data for search engines and AI answer engines, used by the web app's `lib/seo`
(지역 landing pages `/suncheon/<지역>/<매물 종류>`, sitemaps, `/llms.txt`, the monthly 실거래 report
and the closed-listing redirect). No writes, no Prisma schema of its own: it reads `regions`,
`listings`, `complexes`, `trade_records`, `trade_sync_runs` and `agencies` directly and gets the
region list from the complexes module (`RegionsService`).

Contracts live in `seo.types.ts` / `dto.ts` (not yet in `@house/shared`); the web parses them with
`apps/web/src/lib/seo/schemas.ts` and mocks them in `apps/web/src/app/mock-api/v1/seo/**`.

## Endpoints

All paths are under `/api/v1`, all `@Public()`.

| Path                                                           | Cache        | Notes                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /seo/regions`                                             | Redis 10 min | 읍면동 (8 digits) / 리 (10 digits) with public listings per asset type, 아파트·오피스텔 단지 count and non-cancelled 매매 실거래 of the last 12 KST months. An 읍·면 row includes its 리. Regions without data are left out. |
| `GET /seo/regions/:code/landing?assetTypes=`                   | Redis 10 min | Listings per deal type (count, min/max/avg 호가, 월세 range), up to 50 단지 (most listings first, latest 매매), 12-month 매매/전세 summary and the 10 latest 매매. 404 `REGION_NOT_FOUND`.                                   |
| `GET /seo/reports/apartment-trades?ym=YYYYMM`                  | Redis 1 h    | Month (default: newest month before the current KST month with trades): count, mean, median, range, 전용 3.3㎡당, per 법정동, top 단지, previous month / year-ago, 전세 summary, last sync. 404 without data.                |
| `GET /seo/sitemap/:kind` (`complexes`, `listings`, `agencies`) | Redis 15 min | `{ id, lastModified }` of every public row (≤ 50,000, `truncated` flag). A 단지's lastModified includes its trades and public listings.                                                                                      |
| `GET /seo/listings/:id/status`                                 | none         | `PUBLIC` / `GONE` (+ status, asset type, 단지, region key, endedAt) of a listing that was ever published; never-published → 404 `LISTING_NOT_FOUND`. No private field.                                                       |

## Rules

- "Public listing" = the same rule as search: 광고중/계약중, not deleted, approved primary office.
- Trades: 해제(cancelled) rows are excluded from every statistic (`cancelledCount` reports them). A
  trade belongs to the region of its matched 단지; unmatched trades are placed by the reported 법정동
  name (`regionNameResolver`), and a bare 리 name shared by two 읍·면 is never guessed.
- Amounts are 만원; 평당가 is per 전용 3.3㎡ (`SQM_PER_PYEONG`).
- Pure helpers (`seo.domain.ts`) are unit tested in `seo.spec.ts` (`pnpm --filter @house/api test seo`).
