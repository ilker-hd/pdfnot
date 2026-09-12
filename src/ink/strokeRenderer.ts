import type { StrokeRecord } from "../models/types";
import type { ViewportLike } from "../pdf/pageViewport";

/**
 * Draws stored strokes (page-space coordinates) onto a 2D context already
 * sized/transformed for CSS-pixel drawing (caller applies devicePixelRatio).
 * `scale` is the same scale value used to build `viewport`, needed to convert
 * a page-space line width into an on-screen width.
 */
export function renderStrokes(ctx: CanvasRenderingContext2D, strokes: StrokeRecord[], viewport: ViewportLike, scale: number): void {
  for (const stroke of strokes) {
    renderStroke(ctx, stroke, viewport, scale);
  }
}

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: StrokeRecord, viewport: ViewportLike, scale: number): void {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.strokeStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (pts.length === 1) {
    const [vx, vy] = viewport.convertToViewportPoint(pts[0].x, pts[0].y);
    const w = Math.max(0.75, stroke.baseWidth * scale * (0.4 + pts[0].pressure));
    ctx.beginPath();
    ctx.fillStyle = stroke.color;
    ctx.arc(vx, vy, w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const vpts = pts.map((p) => {
    const [vx, vy] = viewport.convertToViewportPoint(p.x, p.y);
    return { x: vx, y: vy, pressure: p.pressure };
  });

  // Each segment runs from the midpoint of (prev,a) to the midpoint of (a,b), curving
  // through control point a, EXCEPT the very first segment (starts exactly at the first
  // point) and the very last segment (ends exactly at the last point) so the drawn line
  // always reaches both stroke endpoints instead of stopping short at a midpoint.
  for (let i = 0; i < vpts.length - 1; i++) {
    const a = vpts[i];
    const b = vpts[i + 1];
    const isFirst = i === 0;
    const isLast = i === vpts.length - 2;
    const pressure = (a.pressure + b.pressure) / 2;
    const width = Math.max(0.75, stroke.baseWidth * scale * (0.4 + pressure));

    const startX = isFirst ? a.x : (vpts[i - 1].x + a.x) / 2;
    const startY = isFirst ? a.y : (vpts[i - 1].y + a.y) / 2;
    const endX = isLast ? b.x : (a.x + b.x) / 2;
    const endY = isLast ? b.y : (a.y + b.y) / 2;

    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(a.x, a.y, endX, endY);
    ctx.stroke();
  }
}
