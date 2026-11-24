// @vitest-environment node
import type { NextConfig } from 'next';
import { describe, expect, it } from 'vitest';

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number];
type ConfigModule = {
  default: NextConfig;
  mediaRemotePatterns: (
    csv: string | undefined,
    opts?: { production?: boolean },
  ) => RemotePattern[];
};
const load = async () => {
  const file = '../../../next.config.mjs';
  return (await import(/* @vite-ignore */ file)) as ConfigModule;
};

describe('next.config.mjs (compression, remote images)', () => {
  it('leaves compression to nginx and lists no remote image host by default', async () => {
    const { default: config } = await load();
    expect(config.compress).toBe(false);
    expect(config.images?.remotePatterns).toEqual([]);
  });

  it('remotePatterns: exactly the listed media hosts, under their path, https only in production', async () => {
    const { mediaRemotePatterns } = await load();
    expect(mediaRemotePatterns(undefined, { production: true })).toEqual([]);
    expect(
      mediaRemotePatterns(' https://cdn.example.kr/media/ , http://media.example.kr:8080', {
        production: true,
      }),
    ).toEqual([
      {
        protocol: 'https',
        hostname: 'cdn.example.kr',
        port: '',
        pathname: '/media/**',
        search: '',
      },
    ]);
    expect(mediaRemotePatterns('http://media.example.kr:8080')).toEqual([
      { protocol: 'http', hostname: 'media.example.kr', port: '8080', pathname: '/**', search: '' },
    ]);
  });
});
