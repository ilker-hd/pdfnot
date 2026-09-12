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

const RULED_LINE_SPACING = 28; // page-space units (pt)
const GRID_LINE_SPACING = 20;

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

/** Draws a blank page's white background plus an optional ruled/grid line pattern. */
export function renderBlankBackground(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportLike,
  pageSpaceWidth: number,
  pageSpaceHeight: number,
  background: "plain" | "ruled" | "grid",
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, viewport.width, viewport.height);
  if (background === "plain") return;

  const spacing = background === "grid" ? GRID_LINE_SPACING : RULED_LINE_SPACING;
  ctx.strokeStyle = "#cfdbea";
  ctx.lineWidth = 1;

  for (let y = spacing; y < pageSpaceHeight; y += spacing) {
    const [x1, vy] = viewport.convertToViewportPoint(0, y);
    const [x2] = viewport.convertToViewportPoint(pageSpaceWidth, y);
    ctx.beginPath();
    ctx.moveTo(x1, vy);
    ctx.lineTo(x2, vy);
    ctx.stroke();
  }

  if (background === "grid") {
    for (let x = spacing; x < pageSpaceWidth; x += spacing) {
      const [vx, y1] = viewport.convertToViewportPoint(x, 0);
      const [, y2] = viewport.convertToViewportPoint(x, pageSpaceHeight);
      ctx.beginPath();
      ctx.moveTo(vx, y1);
      ctx.lineTo(vx, y2);
      ctx.stroke();
    }
  }
}
