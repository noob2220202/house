"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharpHeicDecoder = exports.HEIC_DECODER = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const app_exception_1 = require("../../../common/errors/app.exception");
exports.HEIC_DECODER = Symbol('HEIC_DECODER');
let SharpHeicDecoder = class SharpHeicDecoder {
    constructor() {
        // libvips lists ".heic" as a heifload suffix only when built with an HEVC decoder.
        this.supported = sharp_1.default.format.heif.input.fileSuffix?.includes('.heic') ?? false;
    }
    async decode(data) {
        try {
            const { data: pixels, info } = await (0, sharp_1.default)(data, {
                limitInputPixels: shared_1.MEDIA_MAX_INPUT_PIXELS,
                failOn: 'error',
            })
                .rotate()
                .raw()
                .toBuffer({ resolveWithObject: true });
            return {
                data: pixels,
                width: info.width,
                height: info.height,
                channels: info.channels,
            };
        }
        catch (cause) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_HEIC_UNSUPPORTED, {
                status: common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                cause,
            });
        }
    }
};
exports.SharpHeicDecoder = SharpHeicDecoder;
exports.SharpHeicDecoder = SharpHeicDecoder = __decorate([
    (0, common_1.Injectable)()
], SharpHeicDecoder);
//# sourceMappingURL=heic-decoder.port.js.map