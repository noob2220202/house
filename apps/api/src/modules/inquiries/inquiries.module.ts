import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AgenciesModule } from '../agencies/agencies.module';
import { MediaModule } from '../media/media.module';
import { INQUIRIES_QUEUE } from './constants';
import { AgencyInquiriesController } from './controllers/agency-inquiries.controller';
import { InquiriesController } from './controllers/inquiries.controller';
import { MyInquiriesController } from './controllers/me-inquiries.controller';
import { InquiryMapper } from './inquiry.mapper';
import { InquiriesProcessor } from './jobs/inquiries.processor';
import { INQUIRY_DIRECTORY, PrismaInquiryDirectory } from './ports/inquiry-directory.port';
import { INQUIRY_NOTIFIER, PrismaInquiryNotifier } from './ports/inquiry-notifier.port';
import { AgencyInquiriesService } from './services/agency-inquiries.service';
import { InquiriesService } from './services/inquiries.service';
import { InquiryDashboardService } from './services/inquiry-dashboard.service';
import { InquiryRetentionService } from './services/inquiry-retention.service';
import { InquiryVisitorService } from './services/inquiry-visitor.service';
import { MyInquiriesService } from './services/my-inquiries.service';

/**
 * 문의 ("고객센터" style, docs/agency-sites/SPEC.md §3.5): written inquiries of members and guests
 * to an office, contact events (전화 / 문자 / 번호 복사), the console inbox with replies, MY > 문의
 * 내역 with follow-ups, and the PII retention job on its own queue.
 *
 * Depends on agencies (membership) and media (URLs) only. Exports InquiryDashboardService for the
 * console home (deal-requests → inquiries) and InquiryRetentionService for member withdrawal; it
 * therefore writes its notifications itself instead of importing the deal-requests module.
 */
@Module({
  imports: [AgenciesModule, MediaModule, BullModule.registerQueue({ name: INQUIRIES_QUEUE })],
  controllers: [InquiriesController, AgencyInquiriesController, MyInquiriesController],
  providers: [
    { provide: INQUIRY_DIRECTORY, useClass: PrismaInquiryDirectory },
    { provide: INQUIRY_NOTIFIER, useClass: PrismaInquiryNotifier },
    InquiryMapper,
    InquiryVisitorService,
    InquiriesService,
    AgencyInquiriesService,
    MyInquiriesService,
    InquiryDashboardService,
    InquiryRetentionService,
    InquiriesProcessor,
  ],
  exports: [InquiryDashboardService, InquiryRetentionService],
})
export class InquiriesModule {}
