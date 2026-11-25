import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config.service';
import { parseEnv } from './env.schema';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Tests load their own env files (test/env/*.env) before the app boots.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      envFilePath: ['.env'],
      validate: parseEnv,
      // Read ONLY the validated env. Otherwise ConfigService.get() falls back to the raw
      // process.env value whenever the schema yields undefined — e.g. an empty `KEY=` line in the
      // server .env comes back as '' instead of "not set", which broke `A ?? B` key fallbacks
      // (KAKAO_REST_API_KEY → KAKAO_CLIENT_ID: address search was "unavailable" in production).
      skipProcessEnv: true,
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
