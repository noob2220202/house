"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMediaListQueryDto = exports.MyMediaListQueryDto = exports.MediaUploadQueryDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class MediaUploadQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.mediaUploadQuerySchema) {
}
exports.MediaUploadQueryDto = MediaUploadQueryDto;
class MyMediaListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.myMediaListQuerySchema) {
}
exports.MyMediaListQueryDto = MyMediaListQueryDto;
class AdminMediaListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminMediaListQuerySchema) {
}
exports.AdminMediaListQueryDto = AdminMediaListQueryDto;
//# sourceMappingURL=dto.js.map