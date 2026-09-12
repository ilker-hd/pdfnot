import { getDB } from "./db";
import type { StrokeRecord } from "../models/types";

export async function listStrokes(pageId: string): Promise<StrokeRecord[]> {
  const db = await getDB();
  const strokes = await db.getAllFromIndex("strokes", "pageId", pageId);
  return strokes.sort((a, b) => a.order - b.order);
}

export async function putStroke(stroke: StrokeRecord): Promise<void> {
  const db = await getDB();
  await db.put("strokes", stroke);
}

export async function deleteStroke(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("strokes", id);
}

export async function deleteStrokes(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("strokes", "readwrite");
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
}
