import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PDFDocumentProxy = pdfjsLib.PDFDocumentProxy;
export type PDFPageProxy = pdfjsLib.PDFPageProxy;

export async function loadPdfFromBlob(blob: Blob): Promise<PDFDocumentProxy> {
  const buf = await blob.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: buf });
  return task.promise;
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation: number,
): Promise<void> {
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale, rotation });
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context alınamadı");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
}
