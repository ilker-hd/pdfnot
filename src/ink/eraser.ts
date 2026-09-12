import type { StrokeRecord } from "../models/types";
import { distToSegment, type Point } from "../utils/geometry";

/** Object eraser: returns ids of strokes whose path passes within `threshold` (page-space units) of `eraserPoint`. */
export function findStrokesToErase(strokes: StrokeRecord[], eraserPoint: Point, threshold: number): string[] {
  const hits: string[] = [];
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      if (Math.hypot(p.x - eraserPoint.x, p.y - eraserPoint.y) <= threshold) hits.push(stroke.id);
      continue;
    }
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const d = distToSegment(eraserPoint, stroke.points[i], stroke.points[i + 1]);
      if (d <= threshold) {
        hits.push(stroke.id);
        break;
      }
    }
  }
  return hits;
}
