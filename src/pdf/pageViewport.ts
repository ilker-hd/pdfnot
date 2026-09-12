/**
 * Shared coordinate-transform contract used by both real PDF pages (pdf.js's
 * own PageViewport) and synthetic blank pages, so ink/text storage code never
 * needs to know which kind of page it's drawing on.
 */
export interface ViewportLike {
  width: number;
  height: number;
  convertToViewportPoint(x: number, y: number): number[];
  convertToPdfPoint(x: number, y: number): number[];
}

export const BLANK_PAGE_WIDTH = 612; // US Letter, PDF points, at scale 1
export const BLANK_PAGE_HEIGHT = 792;

/** Simple uniform-scale viewport for blank (non-PDF) pages: top-left origin, no rotation. */
export function makeBlankViewport(pageSpaceWidth: number, pageSpaceHeight: number, scale: number): ViewportLike {
  return {
    width: pageSpaceWidth * scale,
    height: pageSpaceHeight * scale,
    convertToViewportPoint(x: number, y: number): [number, number] {
      return [x * scale, y * scale];
    },
    convertToPdfPoint(x: number, y: number): [number, number] {
      return [x / scale, y / scale];
    },
  };
}
