/**
 * Auth module. Global so every module's guards resolve sessions through SESSION_RESOLVER and can
 * inject SessionService (logout-all on suspension, session refresh after agency approval) and
 * PasswordService (admin account management). Social login: 카카오 / 네이버 / Google only.
 * No SMS / phone verification exists (owner decision).
 */
export declare class AuthModule {
}
