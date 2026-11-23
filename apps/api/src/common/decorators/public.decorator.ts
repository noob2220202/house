import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './metadata-keys';

/** Route needs no session. (Default is authenticated.) A session is still resolved if present. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
