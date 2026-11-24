/** Geometry + file-type policy of the document viewer (pure, unit tested). */

export type DocumentKind = 'image' | 'pdf' | 'other';

/** Raster types an application document may be shown as (ALLOWED_DOCUMENT_MIME + webp). */
const PREVIEW_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * How the viewer may show a private file, decided by an ALLOW-list of content types.
 * The file is turned into a same-origin `blob:` URL, so anything that can carry script (HTML,
 * XHTML, XML, SVG …) must never be rendered or opened in a tab: it would run with the admin
 * session. Such files are 'other' and get no preview at all. SVG is accepted only for the
 * generated stand-ins of mock mode (`allowSvg`), and even then only inside an <img>.
 */
export function documentKind(
  contentType: string,
  options: { allowSvg?: boolean } = {},
): DocumentKind {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (PREVIEW_IMAGE_TYPES.has(type)) return 'image';
  if (options.allowSvg && type === 'image/svg+xml') return 'image';
  if (type === 'application/pdf') return 'pdf';
  return 'other';
}

export interface Size {
  w: number;
  h: number;
}

/** Zoom steps of the viewer; 1 = "fit the page to the stage". */
export const VIEWER_ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3] as const;
export const VIEWER_DEFAULT_ZOOM_INDEX = 2;

/** Share of the stage a fitted page takes (leaves a small margin around it). */
const FIT_RATIO = 0.94;

export interface DocumentLayout {
  /** Box the (rotated) page occupies in the scroll area. */
  frame: Size;
  /** Rendered size of the unrotated image element. */
  image: Size;
}

/**
 * Sizes a scanned page so that it fits the stage at zoom 1 whatever its orientation, and scales
 * from there. A quarter-turn swaps the page's bounding box, so a rotated landscape scan still fits.
 */
export function layoutDocument(
  natural: Size,
  stage: Size,
  zoom: number,
  rotation: number,
): DocumentLayout | null {
  if (natural.w <= 0 || natural.h <= 0 || stage.w <= 0 || stage.h <= 0) return null;
  const quarter = Math.abs(rotation % 180) === 90;
  const boxW = quarter ? natural.h : natural.w;
  const boxH = quarter ? natural.w : natural.h;
  const fit = Math.min((stage.w * FIT_RATIO) / boxW, (stage.h * FIT_RATIO) / boxH);
  const scale = fit * zoom;
  const round = (n: number) => Math.max(1, Math.round(n));
  return {
    frame: { w: round(boxW * scale), h: round(boxH * scale) },
    image: { w: round(natural.w * scale), h: round(natural.h * scale) },
  };
}
