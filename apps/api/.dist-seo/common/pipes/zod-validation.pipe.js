"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodValidationPipe = void 0;
exports.createZodDto = createZodDto;
exports.parseOrThrow = parseOrThrow;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const app_exception_1 = require("../errors/app.exception");
const zod_issues_1 = require("../errors/zod-issues");
/**
 * Turns a zod schema (from @house/shared) into a class usable as a Nest parameter type:
 *   export class CreateBannerDto extends createZodDto(bannerInputSchema) {}
 *   create(@Body() dto: CreateBannerDto) { ... }
 * The global ZodValidationPipe validates and replaces the value with the parsed output.
 */
function createZodDto(schema) {
    class Dto {
        static { this.schema = schema; }
    }
    return Dto;
}
function isZodDto(metatype) {
    return (typeof metatype === 'function' &&
        'schema' in metatype &&
        metatype.schema instanceof zod_1.z.ZodType);
}
function parseOrThrow(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new app_exception_1.AppException(shared_1.ErrorCode.VALIDATION_FAILED, { details: (0, zod_issues_1.formatZodIssues)(result.error) });
    }
    return result.data;
}
/**
 * Global pipe: validates @Body/@Query/@Param whose type is a ZodDto.
 * Can also be used explicitly: @Query(new ZodValidationPipe(schema)) q: z.output<typeof schema>.
 */
let ZodValidationPipe = class ZodValidationPipe {
    constructor(schema) {
        this.schema = schema;
    }
    transform(value, metadata) {
        if (this.schema)
            return parseOrThrow(this.schema, value);
        if (metadata.type === 'custom')
            return value;
        if (isZodDto(metadata.metatype))
            return parseOrThrow(metadata.metatype.schema, value);
        return value;
    }
};
exports.ZodValidationPipe = ZodValidationPipe;
exports.ZodValidationPipe = ZodValidationPipe = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [zod_1.z.ZodType])
], ZodValidationPipe);
//# sourceMappingURL=zod-validation.pipe.js.map