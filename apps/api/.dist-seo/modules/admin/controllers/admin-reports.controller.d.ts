import type { AdminReportView, Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { IdParamDto, ReportListQueryDto, ReportResolveDto, ReportReviewDto } from '../dto';
import { ReportsService } from '../services/reports.service';
/** 허위매물 신고 queue. Resolution is audited inside its transaction (ReportsService.resolve). */
export declare class AdminReportsController {
    private readonly reports;
    constructor(reports: ReportsService);
    list(q: ReportListQueryDto): Promise<Paginated<AdminReportView>>;
    detail(p: IdParamDto): Promise<AdminReportView>;
    review(p: IdParamDto, dto: ReportReviewDto, admin: AdminPrincipal): Promise<AdminReportView>;
    resolve(p: IdParamDto, dto: ReportResolveDto, admin: AdminPrincipal): Promise<AdminReportView>;
}
