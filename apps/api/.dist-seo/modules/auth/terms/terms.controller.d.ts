import type { TermsDetail, TermsSummary } from '@house/shared';
import { TermsTypeParamDto, TermsVersionParamDto, TermsVersionQueryDto } from '../dto';
import { TermsService, type TermsVersionSummary } from './terms.service';
/** Published terms (이용약관, 개인정보처리방침, 위치기반서비스 이용약관, 마케팅 수신). */
export declare class TermsController {
    private readonly terms;
    constructor(terms: TermsService);
    list(): Promise<TermsSummary[]>;
    /** Current version of a type (`service`, `privacy`, …), or `?version=` for a past one. */
    get(params: TermsTypeParamDto, q: TermsVersionQueryDto): Promise<TermsDetail>;
    /** Published versions of a type, newest first (no content); `isCurrent` = in force now. */
    versions(params: TermsTypeParamDto): Promise<TermsVersionSummary[]>;
    /** One published version (same as `GET /terms/:type?version=`). */
    version(params: TermsVersionParamDto): Promise<TermsDetail>;
}
