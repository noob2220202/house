"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const queue_constants_1 = require("../../queue/queue.constants");
const admin_media_controller_1 = require("./admin-media.controller");
const image_processor_1 = require("./image-processor");
const media_processor_1 = require("./jobs/media.processor");
const media_cleanup_service_1 = require("./media-cleanup.service");
const media_files_1 = require("./media-files");
const media_library_service_1 = require("./media-library.service");
const media_processing_service_1 = require("./media-processing.service");
const media_storage_1 = require("./media-storage");
const media_upload_service_1 = require("./media-upload.service");
const media_controller_1 = require("./media.controller");
const media_mapper_1 = require("./media.mapper");
const media_service_1 = require("./media.service");
const heic_decoder_port_1 = require("./ports/heic-decoder.port");
const upload_interceptor_1 = require("./upload.interceptor");
/**
 * Media: uploads (sniffed, sanitized, webp variants), private documents, background processing,
 * orphan cleanup. Other modules import this module and use MediaService (see its doc comment).
 */
let MediaModule = class MediaModule {
};
exports.MediaModule = MediaModule;
exports.MediaModule = MediaModule = __decorate([
    (0, common_1.Module)({
        imports: [bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUES.MEDIA_PROCESSING })],
        controllers: [media_controller_1.MediaController, admin_media_controller_1.AdminMediaController],
        providers: [
            { provide: heic_decoder_port_1.HEIC_DECODER, useClass: heic_decoder_port_1.SharpHeicDecoder },
            media_storage_1.MediaStorage,
            media_files_1.MediaFiles,
            media_mapper_1.MediaMapper,
            image_processor_1.ImageProcessor,
            media_service_1.MediaService,
            media_upload_service_1.MediaUploadService,
            media_library_service_1.MediaLibraryService,
            media_processing_service_1.MediaProcessingService,
            media_cleanup_service_1.MediaCleanupService,
            upload_interceptor_1.MediaUploadInterceptor,
            media_processor_1.MediaProcessor,
        ],
        exports: [media_service_1.MediaService],
    })
], MediaModule);
//# sourceMappingURL=media.module.js.map