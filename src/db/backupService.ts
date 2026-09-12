import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { getDB } from "./db";
import type { DocRecord } from "../models/types";

interface ManifestDoc extends Omit<DocRecord, "originalPdfBlob" | "thumbnailBlob"> {
  originalPdfPath?: string;
  thumbnailPath?: string;
}

interface Manifest {
  version: 1;
  exportedAt: number;
  documents: ManifestDoc[];
  pages: unknown[];
  strokes: unknown[];
  textNotes: unknown[];
}

export async function exportLibrary(): Promise<Blob> {
  const db = await getDB();
  const [documents, pages, strokes, textNotes] = await Promise.all([
    db.getAll("documents"),
    db.getAll("pages"),
    db.getAll("strokes"),
    db.getAll("textNotes"),
  ]);

  const files: Record<string, Uint8Array> = {};
  const manifestDocs: ManifestDoc[] = [];

  for (const doc of documents) {
    const { originalPdfBlob, thumbnailBlob, ...rest } = doc;
    const entry: ManifestDoc = { ...rest };
    if (originalPdfBlob) {
      const path = `blobs/${doc.id}.pdf`;
      files[path] = new Uint8Array(await originalPdfBlob.arrayBuffer());
      entry.originalPdfPath = path;
    }
    if (thumbnailBlob) {
      const path = `blobs/${doc.id}-thumb.png`;
      files[path] = new Uint8Array(await thumbnailBlob.arrayBuffer());
      entry.thumbnailPath = path;
    }
    manifestDocs.push(entry);
  }

  const manifest: Manifest = {
    version: 1,
    exportedAt: Date.now(),
    documents: manifestDocs,
    pages,
    strokes,
    textNotes,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest));

  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

export async function importLibrary(file: File): Promise<{ documents: number; pages: number; strokes: number; textNotes: number }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const unzipped = unzipSync(buf);
  const manifestBytes = unzipped["manifest.json"];
  if (!manifestBytes) throw new Error("Geçersiz yedek dosyası: manifest.json bulunamadı");
  const manifest = JSON.parse(strFromU8(manifestBytes)) as Manifest;

  const db = await getDB();
  const tx = db.transaction(["documents", "pages", "strokes", "textNotes"], "readwrite");

  for (const entry of manifest.documents) {
    const { originalPdfPath, thumbnailPath, ...rest } = entry;
    const doc = rest as DocRecord;
    if (originalPdfPath && unzipped[originalPdfPath]) {
      doc.originalPdfBlob = new Blob([unzipped[originalPdfPath] as BlobPart], { type: "application/pdf" });
    }
    if (thumbnailPath && unzipped[thumbnailPath]) {
      doc.thumbnailBlob = new Blob([unzipped[thumbnailPath] as BlobPart], { type: "image/png" });
    }
    await tx.objectStore("documents").put(doc);
  }
  for (const p of manifest.pages) await tx.objectStore("pages").put(p as never);
  for (const s of manifest.strokes) await tx.objectStore("strokes").put(s as never);
  for (const n of manifest.textNotes) await tx.objectStore("textNotes").put(n as never);
  await tx.done;

  return {
    documents: manifest.documents.length,
    pages: manifest.pages.length,
    strokes: manifest.strokes.length,
    textNotes: manifest.textNotes.length,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
