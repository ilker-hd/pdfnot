import { getDB } from "./db";
import type { TextNoteRecord } from "../models/types";

export async function listTextNotes(pageId: string): Promise<TextNoteRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("textNotes", "pageId", pageId);
}

export async function putTextNote(note: TextNoteRecord): Promise<void> {
  const db = await getDB();
  await db.put("textNotes", note);
}

export async function deleteTextNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("textNotes", id);
}
