import {
  adminMediaListQuerySchema,
  idParamSchema,
  mediaUploadQuerySchema,
  myMediaListQuerySchema,
} from '@house/shared';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class MediaUploadQueryDto extends createZodDto(mediaUploadQuerySchema) {}
export class MyMediaListQueryDto extends createZodDto(myMediaListQuerySchema) {}
export class AdminMediaListQueryDto extends createZodDto(adminMediaListQuerySchema) {}
