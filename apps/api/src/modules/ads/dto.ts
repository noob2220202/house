import {
  adminBannerListQuerySchema,
  adminPopupListQuerySchema,
  bannerCreateSchema,
  bannerImpressionBatchSchema,
  bannerReorderSchema,
  bannerServeQuerySchema,
  bannerSlotParamSchema,
  bannerSlotUpdateSchema,
  bannerStatsQuerySchema,
  bannerUpdateSchema,
  idParamSchema,
  popupCreateSchema,
  popupReorderSchema,
  popupServeQuerySchema,
  popupUpdateSchema,
} from '@house/shared';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}

export class CreateBannerDto extends createZodDto(bannerCreateSchema) {}
export class UpdateBannerDto extends createZodDto(bannerUpdateSchema) {}
export class ReorderBannersDto extends createZodDto(bannerReorderSchema) {}
export class AdminBannerListQueryDto extends createZodDto(adminBannerListQuerySchema) {}
export class BannerStatsQueryDto extends createZodDto(bannerStatsQuerySchema) {}

export class BannerSlotParamDto extends createZodDto(bannerSlotParamSchema) {}
export class UpdateBannerSlotDto extends createZodDto(bannerSlotUpdateSchema) {}

export class CreatePopupDto extends createZodDto(popupCreateSchema) {}
export class UpdatePopupDto extends createZodDto(popupUpdateSchema) {}
export class ReorderPopupsDto extends createZodDto(popupReorderSchema) {}
export class AdminPopupListQueryDto extends createZodDto(adminPopupListQuerySchema) {}

export class BannerServeQueryDto extends createZodDto(bannerServeQuerySchema) {}
export class PopupServeQueryDto extends createZodDto(popupServeQuerySchema) {}
export class BannerImpressionBatchDto extends createZodDto(bannerImpressionBatchSchema) {}
