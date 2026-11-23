import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { parseEnv } from './env.schema';

const base = {
  PUBLIC_BASE_URL: 'http://localhost:3000',
  ADMIN_BASE_URL: 'http://localhost:3001',
  API_BASE_URL: 'http://localhost:4000',
  CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
  COOKIE_SECRET: 'x'.repeat(40),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  UPLOAD_DIR: '/tmp/u',
  PRIVATE_UPLOAD_DIR: '/tmp/p',
};

describe('parseEnv', () => {
  it('applies defaults and parses lists/booleans', () => {
    const env = parseEnv({ ...base, SWAGGER_ENABLED: 'true', KAKAO_CLIENT_ID: '' });
    expect(env.PORT).toBe(4000);
    expect(env.REGION_SGG_CODE).toBe('46150');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.KAKAO_CLIENT_ID).toBeUndefined();
  });

  it('treats empty values as unset and accepts .env.example', () => {
    expect(
      parseEnv({ ...base, COOKIE_SECURE: '', ADMIN_IP_ALLOWLIST: '' }).COOKIE_SECURE,
    ).toBeUndefined();
    const example = parse(readFileSync(path.join(__dirname, '..', '..', '.env.example')));
    expect(parseEnv(example).REGION_SGG_CODE).toBe('46150');
  });

  it('rejects missing required values', () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('refuses dev settings in production', () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: 'production',
        COOKIE_SECRET: 'dev-only-cookie-secret-change-me-0123456789',
      }),
    ).toThrow(/COOKIE_SECRET/);
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toThrow(
      /SWAGGER_ENABLED/,
    );
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
    expect(parseEnv({ ...base, NODE_ENV: 'production' }).NODE_ENV).toBe('production');
  });

  it('has no SMS or Apple settings', () => {
    const keys = Object.keys(parseEnv(base));
    expect(keys.filter((k) => /SMS|APPLE|PHONE_CODE/.test(k))).toEqual([]);
  });
});
