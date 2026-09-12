import { getDB } from "./db";
import type { DocRecord } from "../models/types";

export async function listDocuments(): Promise<DocRecord[]> {
  const db = await getDB();
  const all = await db.getAll("documents");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDocument(id: string): Promise<DocRecord | undefined> {
  const db = await getDB();
  return db.get("documents", id);
}

export async function putDocument(doc: DocRecord): Promise<void> {
  const db = await getDB();
  await db.put("documents", doc);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["documents", "pages", "strokes", "textNotes"], "readwrite");
  const pages = await tx.objectStore("pages").index("documentId").getAll(id);
  for (const page of pages) {
    const strokes = await tx.objectStore("strokes").index("pageId").getAllKeys(page.id);
    for (const key of strokes) await tx.objectStore("strokes").delete(key);
    const notes = await tx.objectStore("textNotes").index("pageId").getAllKeys(page.id);
    for (const key of notes) await tx.objectStore("textNotes").delete(key);
    await tx.objectStore("pages").delete(page.id);
  }
  await tx.objectStore("documents").delete(id);
  await tx.done;
}

export async function touchDocument(id: string): Promise<void> {
  const db = await getDB();
  const doc = await db.get("documents", id);
  if (doc) {
    doc.updatedAt = Date.now();
    await db.put("documents", doc);
  }
}
