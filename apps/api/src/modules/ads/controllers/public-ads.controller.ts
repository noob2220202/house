import type { PublicBannerView, PublicPopupView } from '@house/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Redirect,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../../common/decorators';
import { AD_TRACKING_THROTTLE } from '../constants';
import {
  BannerImpressionBatchDto,
  BannerServeQueryDto,
  IdParamDto,
  PopupServeQueryDto,
} from '../dto';
import { AdServeService } from '../services/ad-serve.service';
import { AdTrackingService, type AdVisitor } from '../services/ad-tracking.service';

const header = (req: Request, name: string, max: number): string | null => {
  const v = req.headers[name];
  return typeof v === 'string' ? v.slice(0, max) : null;
};

function visitorOf(req: Request): AdVisitor {
  return {
    sessionId: req.principal?.sessionId ?? null,
    ip: req.ip ?? null,
    userAgent: header(req, 'user-agent', 500),
    fetchDest: header(req, 'sec-fetch-dest', 32),
    fetchMode: header(req, 'sec-fetch-mode', 32),
  };
}

/**
 * Public ad serving + tracking. Beacons are POSTs: the frontend sends them with
 * `fetch(..., { method: 'POST', keepalive: true, credentials: 'include' })` plus the CSRF header
 * when logged in (sendBeacon cannot set headers).
 */
@ApiTags('ads')
@Controller()
@Public()
export class PublicAdsController {
  constructor(
    private readonly serve: AdServeService,
    private readonly tracking: AdTrackingService,
  ) {}

  @Get('banners')
  @Header('Cache-Control', 'public, max-age=30')
  async banners(@Query() q: BannerServeQueryDto): Promise<{ items: PublicBannerView[] }> {
    return { items: await this.serve.banners(q) };
  }

  @Get('popups')
  @Header('Cache-Control', 'public, max-age=30')
  async popups(@Query() q: PopupServeQueryDto): Promise<{ items: PublicPopupView[] }> {
    return { items: await this.serve.popups(q.page) };
  }

  @Post('banners/impressions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(AD_TRACKING_THROTTLE)
  async impressions(@Body() dto: BannerImpressionBatchDto, @Req() req: Request): Promise<void> {
    await this.tracking.recordImpressions(dto.ids, visitorOf(req));
  }

  @Post('banners/:id/impression')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(AD_TRACKING_THROTTLE)
  async impression(@Param() p: IdParamDto, @Req() req: Request): Promise<void> {
    await this.tracking.recordImpressions([p.id], visitorOf(req));
  }

  @Get('banners/:id/click')
  @Redirect()
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'strict-origin-when-cross-origin')
  @Throttle(AD_TRACKING_THROTTLE)
  async click(
    @Param() p: IdParamDto,
    @Req() req: Request,
  ): Promise<{ url: string; statusCode: number }> {
    return { url: await this.tracking.click(p.id, visitorOf(req)), statusCode: HttpStatus.FOUND };
  }
}
