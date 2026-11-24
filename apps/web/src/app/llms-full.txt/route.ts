import { connection } from 'next/server';
import { llmsInput } from '@/lib/seo/llms-data';
import { buildLlmsFullTxt } from '@/lib/seo/llms';

/** /llms-full.txt — llms.txt plus the latest 실거래 figures and every indexable landing page. */
export async function GET() {
  await connection();
  return new Response(buildLlmsFullTxt(await llmsInput()), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
