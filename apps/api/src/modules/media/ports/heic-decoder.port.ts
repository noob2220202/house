import { ErrorCode, MEDIA_MAX_INPUT_PIXELS } from '@house/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppException } from '../../../common/errors/app.exception';

export interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
}

/**
 * Decodes HEIC/HEIF (iPhone photos) to raw pixels, already oriented. Behind a port because the
 * prebuilt sharp/libvips binaries ship without the patent-encumbered HEVC decoder: the default
 * implementation works only where libvips was built with libde265 (a system libvips). Bind a
 * WASM/native decoder here to enable conversion everywhere (see module README).
 */
export interface HeicDecoder {
  /** Whether this decoder can decode HEVC-coded HEIF at all (checked before accepting an upload). */
  readonly supported: boolean;
  /** Throws MEDIA_HEIC_UNSUPPORTED when it cannot decode the file. */
  decode(data: Buffer): Promise<RawImage>;
}

export const HEIC_DECODER = Symbol('HEIC_DECODER');

@Injectable()
export class SharpHeicDecoder implements HeicDecoder {
  // libvips lists ".heic" as a heifload suffix only when built with an HEVC decoder.
  readonly supported = sharp.format.heif.input.fileSuffix?.includes('.heic') ?? false;

  async decode(data: Buffer): Promise<RawImage> {
    try {
      const { data: pixels, info } = await sharp(data, {
        limitInputPixels: MEDIA_MAX_INPUT_PIXELS,
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
    } catch (cause) {
      throw new AppException(ErrorCode.MEDIA_HEIC_UNSUPPORTED, {
        status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        cause,
      });
    }
  }
}
