import type { ReportCreatedResponse } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { ReportCreateDto } from '../dto';
import { ReportsService } from '../services/reports.service';
/** 허위매물 신고 (login required; per-IP throttle + per-user daily cap). */
export declare class PublicReportsController {
    private readonly reports;
    constructor(reports: ReportsService);
    create(user: UserPrincipal, dto: ReportCreateDto): Promise<ReportCreatedResponse>;
}
