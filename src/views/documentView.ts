import type { DocRecord, PageRecord, StrokeRecord, Tool, PageBackground } from "../models/types";
import { PEN_COLORS, FONT_CHOICES, BLANK_PAGE_DEFAULTS } from "../models/types";
import { getDocument, putDocument, touchDocument } from "../db/documentsRepo";
import { listPages, putPage, deletePage } from "../db/pagesRepo";
import { listStrokes, putStroke, deleteStroke } from "../db/strokesRepo";
import { listTextNotes, putTextNote, deleteTextNote } from "../db/textNotesRepo";
import { loadPdfFromBlob, type PDFDocumentProxy } from "../pdf/pdfLoader";
import { makeBlankViewport, renderBlankBackground, BLANK_PAGE_WIDTH, BLANK_PAGE_HEIGHT, type ViewportLike } from "../pdf/pageViewport";
import { renderStrokes, renderStroke } from "../ink/strokeRenderer";
import { StrokeEngine } from "../ink/strokeEngine";
import { findStrokesToErase } from "../ink/eraser";
import { exportDocumentAsPdf } from "../pdf/pdfExport";
import { downloadBlob } from "../db/backupService";
import { uuid } from "../utils/uuid";
import { Toolbar } from "./toolbar";
import { TextNoteLayer } from "./textNoteLayer";
import { showPrompt, showConfirm, showAlert } from "./modal";

type UndoAction = { type: "add"; stroke: StrokeRecord } | { type: "erase"; strokes: StrokeRecord[] };

const ERASER_RADIUS_CSS_PX = 14;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

export async function openDocumentView(container: HTMLElement, documentId: string, navigateToLibrary: () => void): Promise<void> {
  const doc = await getDocument(documentId);
  if (!doc) {
    container.textContent = "Belge bulunamadı.";
    return;
  }
  const controller = new DocumentViewController(container, doc, navigateToLibrary);
  await controller.mount();
}

class DocumentViewController {
  private pages: PageRecord[] = [];
  private currentPageIndex = 0;
  private srcPdf: PDFDocumentProxy | null = null;

  private tool: Tool = "pen";
  private color = PEN_COLORS[0];
  private width = 3;
  private fontId = FONT_CHOICES[0].id;
  private pencilOnly = false;

  private strokes: StrokeRecord[] = [];
  private undoStack: UndoAction[] = [];
  private pendingErased: StrokeRecord[] = [];
  private activeStroke: StrokeRecord | null = null;

  private engine?: StrokeEngine;
  private textLayer?: TextNoteLayer;
  private viewport?: ViewportLike;
  private scale = 1;
  private zoomFactor = 1;
  private panOverlay?: HTMLElement;
  private panState: { startX: number; startY: number; scrollLeft: number; scrollTop: number } | null = null;

  private toolbar: Toolbar;
  private pageStage: HTMLElement;
  private pageIndicator: HTMLElement;
  private resizeHandler = () => this.loadPage(this.currentPageIndex);
  private resizeTimer: number | undefined;

  private doc: DocRecord;

  constructor(container: HTMLElement, doc: DocRecord, navigateToLibrary: () => void) {
    this.doc = doc;
    this.toolbar = new Toolbar(
      {
        onBack: () => navigateToLibrary(),
        onRename: () => this.renameDocument(),
        onToolChange: (tool) => this.setTool(tool),
        onColorChange: (color) => {
          this.color = color;
          if (this.tool === "text") this.textLayer?.setActiveNoteStyle(this.fontId, color);
        },
        onWidthChange: (width) => (this.width = width),
        onFontChange: (fontId) => {
          this.fontId = fontId;
          if (this.tool === "text") this.textLayer?.setActiveNoteStyle(fontId, this.color);
        },
        onPencilOnlyChange: (enabled) => {
          this.pencilOnly = enabled;
          this.engine?.setPencilOnly(enabled);
        },
        onUndo: () => this.undo(),
        onExportPdf: () => this.exportPdf(),
        onAddPage: () => this.addBlankPage(),
        onDeletePage: () => this.deleteCurrentPage(),
        onBackgroundChange: (bg) => this.setPageBackground(bg),
        onZoomIn: () => this.setZoom(this.zoomFactor + ZOOM_STEP),
        onZoomOut: () => this.setZoom(this.zoomFactor - ZOOM_STEP),
        onZoomReset: () => this.setZoom(1),
      },
      doc.title,
    );

    this.pageIndicator = document.createElement("div");
    this.pageIndicator.className = "page-indicator";

    const nav = document.createElement("div");
    nav.className = "page-nav";
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "‹ Önceki";
    prevBtn.addEventListener("click", () => this.loadPage(this.currentPageIndex - 1));
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Sonraki ›";
    nextBtn.addEventListener("click", () => this.loadPage(this.currentPageIndex + 1));
    nav.append(prevBtn, this.pageIndicator, nextBtn);

    this.pageStage = document.createElement("div");
    this.pageStage.className = "page-stage";

    container.innerHTML = "";
    container.className = "document-view";
    container.append(this.toolbar.el, nav, this.pageStage);
  }

  async mount(): Promise<void> {
    if (this.doc.type === "pdf" && this.doc.originalPdfBlob) {
      this.srcPdf = await loadPdfFromBlob(this.doc.originalPdfBlob);
    }
    this.pages = await listPages(this.doc.id);
    window.addEventListener("resize", () => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(this.resizeHandler, 200);
    });
    await this.loadPage(0);
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.updateToolMode();
  }

  private updateToolMode(): void {
    const inkCanvas = this.pageStage.querySelector<HTMLCanvasElement>(".ink-canvas");
    if (inkCanvas) inkCanvas.style.pointerEvents = this.tool === "pen" || this.tool === "eraser" ? "auto" : "none";
    if (this.textLayer) this.textLayer.el.style.pointerEvents = this.tool === "text" ? "auto" : "none";
    if (this.panOverlay) this.panOverlay.style.pointerEvents = this.tool === "select" ? "auto" : "none";
    this.pageStage.style.cursor =
      this.tool === "eraser" ? "cell" : this.tool === "text" ? "text" : this.tool === "select" ? "grab" : "crosshair";
  }

  private async renameDocument(): Promise<void> {
    const name = await showPrompt("Defter adı:", this.doc.title);
    if (name === null || !name.trim()) return;
    this.doc.title = name.trim();
    await putDocument(this.doc);
    this.toolbar.setTitle(this.doc.title);
  }

  private async setZoom(factor: number): Promise<void> {
    this.zoomFactor = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, factor));
    this.toolbar.setZoomLabel(this.zoomFactor * 100);
    await this.loadPage(this.currentPageIndex, { preserveScroll: true });
  }

  private computeFitScale(pageSpaceWidth: number): number {
    const available = Math.max(320, this.pageStage.clientWidth - 32);
    const scale = available / pageSpaceWidth;
    return Math.min(2.5, Math.max(0.3, scale));
  }

  async loadPage(index: number, opts: { preserveScroll?: boolean } = {}): Promise<void> {
    if (index < 0 || index >= this.pages.length) return;
    this.currentPageIndex = index;
    const page = this.pages[index];

    const stage = this.pageStage;
    let scrollRatio: { x: number; y: number } | null = null;
    if (opts.preserveScroll) {
      scrollRatio = {
        x: stage.scrollLeft / Math.max(1, stage.scrollWidth - stage.clientWidth),
        y: stage.scrollTop / Math.max(1, stage.scrollHeight - stage.clientHeight),
      };
    }

    this.pageStage.innerHTML = "";
    const surface = document.createElement("div");
    surface.className = "page-surface";

    const baseCanvas = document.createElement("canvas");
    baseCanvas.className = "base-canvas";
    const inkCanvas = document.createElement("canvas");
    inkCanvas.className = "ink-canvas";
    surface.append(baseCanvas, inkCanvas);
    this.pageStage.appendChild(surface);

    let viewport: ViewportLike;
    const dpr = window.devicePixelRatio || 1;

    const isOriginalPdfPage = this.doc.type === "pdf" && !!this.srcPdf && page.index < this.srcPdf.numPages;

    if (isOriginalPdfPage) {
      const srcPage = await this.srcPdf!.getPage(page.index + 1);
      const baseViewport = srcPage.getViewport({ scale: 1, rotation: page.rotation });
      this.scale = this.computeFitScale(baseViewport.width) * this.zoomFactor;
      const pdfViewport = srcPage.getViewport({ scale: this.scale, rotation: page.rotation });
      baseCanvas.width = Math.floor(pdfViewport.width * dpr);
      baseCanvas.height = Math.floor(pdfViewport.height * dpr);
      baseCanvas.style.width = `${pdfViewport.width}px`;
      baseCanvas.style.height = `${pdfViewport.height}px`;
      const bctx = baseCanvas.getContext("2d")!;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await srcPage.render({ canvasContext: bctx, viewport: pdfViewport, canvas: baseCanvas }).promise;
      viewport = pdfViewport;
    } else {
      this.scale = this.computeFitScale(page.pageSpaceWidth) * this.zoomFactor;
      viewport = makeBlankViewport(page.pageSpaceWidth, page.pageSpaceHeight, this.scale);
      baseCanvas.width = Math.floor(viewport.width * dpr);
      baseCanvas.height = Math.floor(viewport.height * dpr);
      baseCanvas.style.width = `${viewport.width}px`;
      baseCanvas.style.height = `${viewport.height}px`;
      const bctx = baseCanvas.getContext("2d")!;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderBlankBackground(bctx, viewport, page.pageSpaceWidth, page.pageSpaceHeight, page.background ?? "plain");
    }

    inkCanvas.width = Math.floor(viewport.width * dpr);
    inkCanvas.height = Math.floor(viewport.height * dpr);
    inkCanvas.style.width = `${viewport.width}px`;
    inkCanvas.style.height = `${viewport.height}px`;
    surface.style.width = `${viewport.width}px`;
    surface.style.height = `${viewport.height}px`;
    const inkCtx = inkCanvas.getContext("2d")!;
    inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.viewport = viewport;
    this.strokes = await listStrokes(page.id);
    renderStrokes(inkCtx, this.strokes, viewport, this.scale);

    this.engine?.detach();
    this.engine = new StrokeEngine(
      inkCanvas,
      {
        onStart: (point) => this.onPointerStart(point, inkCtx),
        onMove: (points) => this.onPointerMove(points, inkCtx),
        onEnd: () => this.onPointerEnd(),
        onCancel: () => this.onPointerEnd(),
      },
      () => this.viewport!,
    );
    this.engine.setPencilOnly(this.pencilOnly);
    this.engine.attach();

    const notes = await listTextNotes(page.id);
    this.textLayer = new TextNoteLayer(
      page.id,
      viewport,
      this.scale,
      {
        onSave: (note) => putTextNote(note).then(() => touchDocument(this.doc.id)),
        onDelete: (id) => deleteTextNote(id),
      },
      () => this.fontId,
      () => this.color,
    );
    this.textLayer.loadNotes(notes);
    surface.appendChild(this.textLayer.el);

    const panOverlay = document.createElement("div");
    panOverlay.className = "pan-overlay";
    panOverlay.addEventListener("pointerdown", (e) => {
      panOverlay.setPointerCapture(e.pointerId);
      panOverlay.classList.add("panning");
      this.panState = { startX: e.clientX, startY: e.clientY, scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop };
    });
    panOverlay.addEventListener("pointermove", (e) => {
      if (!this.panState) return;
      stage.scrollLeft = this.panState.scrollLeft - (e.clientX - this.panState.startX);
      stage.scrollTop = this.panState.scrollTop - (e.clientY - this.panState.startY);
    });
    const endPan = () => {
      this.panState = null;
      panOverlay.classList.remove("panning");
    };
    panOverlay.addEventListener("pointerup", endPan);
    panOverlay.addEventListener("pointercancel", endPan);
    surface.appendChild(panOverlay);
    this.panOverlay = panOverlay;

    this.undoStack = [];
    this.pendingErased = [];
    this.updateToolMode();
    this.toolbar.setBackgroundControlVisible(!isOriginalPdfPage);
    this.toolbar.setActiveBackground(page.background ?? "plain");
    this.pageIndicator.textContent = `Sayfa ${index + 1} / ${this.pages.length}`;

    if (scrollRatio) {
      requestAnimationFrame(() => {
        stage.scrollLeft = scrollRatio!.x * Math.max(1, stage.scrollWidth - stage.clientWidth);
        stage.scrollTop = scrollRatio!.y * Math.max(1, stage.scrollHeight - stage.clientHeight);
      });
    }
  }

  private onPointerStart(point: { x: number; y: number; pressure: number }, ctx: CanvasRenderingContext2D): void {
    if (this.tool === "pen") {
      this.activeStroke = {
        id: uuid(),
        pageId: this.pages[this.currentPageIndex].id,
        tool: "pen",
        color: this.color,
        baseWidth: this.width,
        points: [point],
        order: this.strokes.length + this.undoStack.length,
        createdAt: Date.now(),
      };
      renderStroke(ctx, this.activeStroke, this.viewport!, this.scale);
    } else if (this.tool === "eraser") {
      this.eraseAt(point, ctx);
    }
  }

  private onPointerMove(points: { x: number; y: number; pressure: number }[], ctx: CanvasRenderingContext2D): void {
    if (this.tool === "pen" && this.activeStroke) {
      this.activeStroke.points.push(...points);
      renderStroke(ctx, this.activeStroke, this.viewport!, this.scale);
    } else if (this.tool === "eraser") {
      for (const p of points) this.eraseAt(p, ctx);
    }
  }

  private onPointerEnd(): void {
    if (this.tool === "pen" && this.activeStroke) {
      const stroke = this.activeStroke;
      this.activeStroke = null;
      this.strokes.push(stroke);
      this.undoStack.push({ type: "add", stroke });
      putStroke(stroke).then(() => touchDocument(this.doc.id));
    } else if (this.tool === "eraser" && this.pendingErased.length > 0) {
      this.undoStack.push({ type: "erase", strokes: this.pendingErased });
      this.pendingErased = [];
    }
  }

  private eraseAt(point: { x: number; y: number }, ctx: CanvasRenderingContext2D): void {
    const threshold = ERASER_RADIUS_CSS_PX / this.scale;
    const hitIds = findStrokesToErase(this.strokes, point, threshold);
    if (hitIds.length === 0) return;
    const hitSet = new Set(hitIds);
    const removed = this.strokes.filter((s) => hitSet.has(s.id));
    this.strokes = this.strokes.filter((s) => !hitSet.has(s.id));
    for (const s of removed) {
      this.pendingErased.push(s);
      deleteStroke(s.id);
    }
    touchDocument(this.doc.id);
    this.redrawInk(ctx);
  }

  private redrawInk(ctx: CanvasRenderingContext2D): void {
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokes(ctx, this.strokes, this.viewport!, this.scale);
  }

  private undo(): void {
    const action = this.undoStack.pop();
    if (!action) return;
    const inkCanvas = this.pageStage.querySelector<HTMLCanvasElement>(".ink-canvas");
    if (!inkCanvas) return;
    const ctx = inkCanvas.getContext("2d")!;
    if (action.type === "add") {
      this.strokes = this.strokes.filter((s) => s.id !== action.stroke.id);
      deleteStroke(action.stroke.id);
    } else {
      this.strokes.push(...action.strokes);
      for (const s of action.strokes) putStroke(s);
    }
    this.redrawInk(ctx);
    touchDocument(this.doc.id);
  }

  private async setPageBackground(background: PageBackground): Promise<void> {
    const page = this.pages[this.currentPageIndex];
    page.background = background;
    await putPage(page);
    await touchDocument(this.doc.id);
    this.redrawBackground();
    this.toolbar.setActiveBackground(background);
  }

  private redrawBackground(): void {
    const baseCanvas = this.pageStage.querySelector<HTMLCanvasElement>(".base-canvas");
    if (!baseCanvas || !this.viewport) return;
    const page = this.pages[this.currentPageIndex];
    const ctx = baseCanvas.getContext("2d")!;
    renderBlankBackground(ctx, this.viewport, page.pageSpaceWidth, page.pageSpaceHeight, page.background ?? "plain");
  }

  private async addBlankPage(): Promise<void> {
    const nextIndex = this.pages.length > 0 ? Math.max(...this.pages.map((p) => p.index)) + 1 : 0;
    const page: PageRecord = {
      id: uuid(),
      documentId: this.doc.id,
      index: nextIndex,
      pageSpaceWidth: BLANK_PAGE_WIDTH,
      pageSpaceHeight: BLANK_PAGE_HEIGHT,
      rotation: 0,
      background: BLANK_PAGE_DEFAULTS.background,
    };
    await putPage(page);
    this.doc.pageCount += 1;
    this.doc.updatedAt = Date.now();
    await touchDocument(this.doc.id);
    this.pages.push(page);
    await this.loadPage(this.pages.length - 1);
  }

  private async deleteCurrentPage(): Promise<void> {
    if (this.pages.length <= 1) {
      await showAlert("Bir defterde en az bir sayfa olmalı — bu son sayfa silinemiyor.");
      return;
    }
    const confirmed = await showConfirm("Bu sayfa, üzerindeki tüm çizim ve notlarla birlikte silinsin mi? Bu işlem geri alınamaz.");
    if (!confirmed) return;
    const page = this.pages[this.currentPageIndex];
    await deletePage(page.id);
    this.pages.splice(this.currentPageIndex, 1);
    this.doc.pageCount = this.pages.length;
    await touchDocument(this.doc.id);
    const newIndex = Math.min(this.currentPageIndex, this.pages.length - 1);
    await this.loadPage(newIndex);
  }

  private async exportPdf(): Promise<void> {
    const blob = await exportDocumentAsPdf(this.doc.id);
    downloadBlob(blob, `${this.doc.title || "not"}.pdf`);
  }
}
