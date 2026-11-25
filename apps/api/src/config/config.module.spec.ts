import { Test } from '@nestjs/testing';

// Regression (production): the server .env has an empty `KAKAO_REST_API_KEY=` line. The schema turns
// it into undefined, but Nest's ConfigService used to fall back to the raw process.env value (''),
// so `KAKAO_REST_API_KEY ?? KAKAO_CLIENT_ID` stayed '' and the address search reported no key.
const base = {
  PUBLIC_BASE_URL: 'http://localhost:3000',
  ADMIN_BASE_URL: 'http://localhost:3001',
  API_BASE_URL: 'http://localhost:4000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379/0',
  COOKIE_SECRET: 'x'.repeat(40),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  UPLOAD_DIR: '/tmp/u',
  PRIVATE_UPLOAD_DIR: '/tmp/p',
};

describe('AppConfigModule', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('reads only validated values: an empty env line is "not set", not an empty string', async () => {
    process.env = { ...saved, ...base, KAKAO_CLIENT_ID: 'rest-key', KAKAO_REST_API_KEY: '' };
    // ConfigModule.forRoot() validates process.env when the module file is evaluated: load it now.
    jest.resetModules();
    const { AppConfigModule } = await import('./config.module');
    const { AppConfig } = await import('./app-config.service');
    const { KakaoGeocoder } = await import('../modules/home/clients/kakao-geocode.client');
    const mod = await Test.createTestingModule({
      imports: [AppConfigModule],
      providers: [KakaoGeocoder],
    }).compile();
    const config = mod.get(AppConfig);
    expect(config.get('KAKAO_REST_API_KEY')).toBeUndefined();
    expect(mod.get(KakaoGeocoder).isConfigured()).toBe(true);
  });
});
