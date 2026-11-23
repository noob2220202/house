import type { UserRole } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { SessionService } from '../../auth';

/**
 * Keeps live Redis sessions in step with agency membership changes (role / acting agency), so the
 * user does not have to log in again after approval, joining or removal. Failures are logged and
 * never fail the request: the next login recomputes both from the database anyway.
 */
@Injectable()
export class AgencySessionSyncService {
  private readonly logger = new Logger(AgencySessionSyncService.name);

  constructor(private readonly sessions: SessionService) {}

  async apply(userId: string, patch: { role?: UserRole; agencyId?: string | null }): Promise<void> {
    try {
      await this.sessions.updateAllForSubject('USER', userId, patch);
    } catch (err) {
      this.logger.warn({ err, userId }, 'failed to update sessions after agency change');
    }
  }
}
