import { getDB } from "./db";
import type { PageRecord } from "../models/types";

export async function listPages(documentId: string): Promise<PageRecord[]> {
  const db = await getDB();
  const pages = await db.getAllFromIndex("pages", "documentId", documentId);
  return pages.sort((a, b) => a.index - b.index);
}

export async function getPage(id: string): Promise<PageRecord | undefined> {
  const db = await getDB();
  return db.get("pages", id);
}

export async function putPage(page: PageRecord): Promise<void> {
  const db = await getDB();
  await db.put("pages", page);
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["pages", "strokes", "textNotes"], "readwrite");
  const strokeKeys = await tx.objectStore("strokes").index("pageId").getAllKeys(id);
  for (const key of strokeKeys) await tx.objectStore("strokes").delete(key);
  const noteKeys = await tx.objectStore("textNotes").index("pageId").getAllKeys(id);
  for (const key of noteKeys) await tx.objectStore("textNotes").delete(key);
  await tx.objectStore("pages").delete(id);
  await tx.done;
}
