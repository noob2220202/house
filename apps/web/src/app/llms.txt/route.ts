import { connection } from 'next/server';
import { llmsInput } from '@/lib/seo/llms-data';
import { buildLlmsTxt } from '@/lib/seo/llms';

/** /llms.txt (https://llmstxt.org) — what the service is and which URL holds which facts. */
export async function GET() {
  await connection();
  return new Response(buildLlmsTxt(await llmsInput()), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
