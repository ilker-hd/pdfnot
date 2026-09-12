import { PDFDocument } from "pdf-lib";
import { getDocument } from "../db/documentsRepo";
import { listPages } from "../db/pagesRepo";
import { listStrokes } from "../db/strokesRepo";
import { listTextNotes } from "../db/textNotesRepo";
import { loadPdfFromBlob } from "./pdfLoader";
import { makeBlankViewport, type ViewportLike } from "./pageViewport";
import { renderStrokes } from "../ink/strokeRenderer";

const EXPORT_SCALE = 2; // ~144dpi raster for crisp exported pages

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Canvas -> PNG dönüşümü başarısız"));
      blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, "image/png");
  });
}

export async function exportDocumentAsPdf(documentId: string): Promise<Blob> {
  const doc = await getDocument(documentId);
  if (!doc) throw new Error("Belge bulunamadı");
  const pages = await listPages(documentId);

  const srcPdf = doc.type === "pdf" && doc.originalPdfBlob ? await loadPdfFromBlob(doc.originalPdfBlob) : null;
  const outPdf = await PDFDocument.create();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context alınamadı");

  for (const page of pages) {
    let viewport: ViewportLike;
    if (srcPdf) {
      const srcPage = await srcPdf.getPage(page.index + 1);
      const pdfViewport = srcPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation });
      canvas.width = Math.ceil(pdfViewport.width);
      canvas.height = Math.ceil(pdfViewport.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await srcPage.render({ canvasContext: ctx, viewport: pdfViewport, canvas }).promise;
      viewport = pdfViewport;
    } else {
      viewport = makeBlankViewport(page.pageSpaceWidth, page.pageSpaceHeight, EXPORT_SCALE);
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const strokes = await listStrokes(page.id);
    renderStrokes(ctx, strokes, viewport, EXPORT_SCALE);

    const textNotes = await listTextNotes(page.id);
    for (const note of textNotes) {
      const [vx, vy] = viewport.convertToViewportPoint(note.x, note.y);
      ctx.fillStyle = note.color;
      ctx.font = `${note.fontSize * EXPORT_SCALE}px ${note.fontFamily}`;
      ctx.textBaseline = "top";
      const lines = note.text.split("\n");
      const lineHeight = note.fontSize * EXPORT_SCALE * 1.3;
      lines.forEach((line, i) => ctx.fillText(line, vx, vy + i * lineHeight));
    }

    const pngBytes = await canvasToPngBytes(canvas);
    const pngImage = await outPdf.embedPng(pngBytes);
    const outPage = outPdf.addPage([page.pageSpaceWidth, page.pageSpaceHeight]);
    outPage.drawImage(pngImage, { x: 0, y: 0, width: page.pageSpaceWidth, height: page.pageSpaceHeight });
  }

  const bytes = await outPdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
