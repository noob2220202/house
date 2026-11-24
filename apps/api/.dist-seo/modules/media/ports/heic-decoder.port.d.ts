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
export declare const HEIC_DECODER: unique symbol;
export declare class SharpHeicDecoder implements HeicDecoder {
    readonly supported: boolean;
    decode(data: Buffer): Promise<RawImage>;
}
