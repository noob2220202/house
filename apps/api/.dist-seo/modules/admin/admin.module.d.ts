import { type MiddlewareConsumer, type NestModule } from '@nestjs/common';
/**
 * Back-office API (/api/v1/admin/**) not owned by another module, public content (공지·FAQ·영상·
 * 사이트 설정), 허위매물 신고, the visitor counter, and the admin-wide audit safety net.
 * Auth (SessionService, PasswordService, TermsService) comes from the global AuthModule.
 */
export declare class AdminModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void;
}
