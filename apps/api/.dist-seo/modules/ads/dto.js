"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerImpressionBatchDto = exports.PopupServeQueryDto = exports.BannerServeQueryDto = exports.AdminPopupListQueryDto = exports.ReorderPopupsDto = exports.UpdatePopupDto = exports.CreatePopupDto = exports.UpdateBannerSlotDto = exports.BannerSlotParamDto = exports.BannerStatsQueryDto = exports.AdminBannerListQueryDto = exports.ReorderBannersDto = exports.UpdateBannerDto = exports.CreateBannerDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class CreateBannerDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerCreateSchema) {
}
exports.CreateBannerDto = CreateBannerDto;
class UpdateBannerDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerUpdateSchema) {
}
exports.UpdateBannerDto = UpdateBannerDto;
class ReorderBannersDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerReorderSchema) {
}
exports.ReorderBannersDto = ReorderBannersDto;
class AdminBannerListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminBannerListQuerySchema) {
}
exports.AdminBannerListQueryDto = AdminBannerListQueryDto;
class BannerStatsQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerStatsQuerySchema) {
}
exports.BannerStatsQueryDto = BannerStatsQueryDto;
class BannerSlotParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerSlotParamSchema) {
}
exports.BannerSlotParamDto = BannerSlotParamDto;
class UpdateBannerSlotDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerSlotUpdateSchema) {
}
exports.UpdateBannerSlotDto = UpdateBannerSlotDto;
class CreatePopupDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.popupCreateSchema) {
}
exports.CreatePopupDto = CreatePopupDto;
class UpdatePopupDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.popupUpdateSchema) {
}
exports.UpdatePopupDto = UpdatePopupDto;
class ReorderPopupsDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.popupReorderSchema) {
}
exports.ReorderPopupsDto = ReorderPopupsDto;
class AdminPopupListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminPopupListQuerySchema) {
}
exports.AdminPopupListQueryDto = AdminPopupListQueryDto;
class BannerServeQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerServeQuerySchema) {
}
exports.BannerServeQueryDto = BannerServeQueryDto;
class PopupServeQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.popupServeQuerySchema) {
}
exports.PopupServeQueryDto = PopupServeQueryDto;
class BannerImpressionBatchDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.bannerImpressionBatchSchema) {
}
exports.BannerImpressionBatchDto = BannerImpressionBatchDto;
//# sourceMappingURL=dto.js.map