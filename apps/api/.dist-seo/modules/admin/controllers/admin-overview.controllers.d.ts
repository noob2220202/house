import { type AdminDashboard, type AdminPermissionsResponse, type AuditLogView, type Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditLogQueryDto, IdParamDto } from '../dto';
import { AuditLogsService } from '../services/audit-logs.service';
import type { DashboardQueues } from '../schemas';
import { AdminNotificationsService } from '../services/admin-notifications.service';
import { DashboardQueuesService } from '../services/dashboard-queues.service';
import { DashboardService } from '../services/dashboard.service';
/** What the signed-in admin may do (drives the back-office menu). */
export declare class AdminPermissionsController {
    get(admin: AdminPrincipal): AdminPermissionsResponse;
}
export declare class AdminDashboardController {
    private readonly dashboard;
    private readonly queues;
    private readonly notifications;
    constructor(dashboard: DashboardService, queues: DashboardQueuesService, notifications: AdminNotificationsService);
    /** Counters (cached, shared) plus this admin's unread bell count (`notificationsUnread`). */
    get(admin: AdminPrincipal): Promise<AdminDashboard & {
        notificationsUnread: number;
    }>;
    /** Work queues previewed on the dashboard (pending agencies, deal requests, reports, ads). */
    getQueues(): Promise<DashboardQueues>;
}
export declare class AdminAuditLogsController {
    private readonly logs;
    constructor(logs: AuditLogsService);
    list(q: AuditLogQueryDto): Promise<Paginated<AuditLogView>>;
    detail(p: IdParamDto): Promise<AuditLogView>;
}
