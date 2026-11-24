import type { Request, Response } from 'express';
import { OAuthCallbackQueryDto, OAuthProviderParamDto, OAuthStartQueryDto } from '../dto';
import { OAuthService } from './oauth.service';
/**
 * Fixed routes (registered in the Kakao / Naver / Google consoles):
 *   GET /api/v1/auth/oauth/{kakao|naver|google}/start
 *   GET /api/v1/auth/oauth/{kakao|naver|google}/callback
 */
export declare class OAuthController {
    private readonly oauth;
    constructor(oauth: OAuthService);
    start(params: OAuthProviderParamDto, query: OAuthStartQueryDto, req: Request, res: Response): Promise<void>;
    callback(params: OAuthProviderParamDto, query: OAuthCallbackQueryDto, req: Request, res: Response): Promise<void>;
}
