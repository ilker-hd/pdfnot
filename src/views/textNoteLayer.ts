import type { TextNoteRecord } from "../models/types";
import { FONT_CHOICES } from "../models/types";
import type { ViewportLike } from "../pdf/pageViewport";
import { uuid } from "../utils/uuid";

export interface TextNoteLayerCallbacks {
  onSave(note: TextNoteRecord): void;
  onDelete(id: string): void;
}

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 60;
const DEFAULT_FONT_SIZE = 16;

function fontFamilyFor(fontId: string): string {
  return FONT_CHOICES.find((f) => f.id === fontId)?.family ?? FONT_CHOICES[0].family;
}

export class TextNoteLayer {
  el: HTMLElement;
  private notes = new Map<string, { record: TextNoteRecord; el: HTMLElement; body: HTMLElement }>();
  private lastFocusedNoteId: string | null = null;
  private pageId: string;
  private viewport: ViewportLike;
  private scale: number;
  private callbacks: TextNoteLayerCallbacks;
  private getActiveFontId: () => string;
  private getActiveColor: () => string;

  constructor(
    pageId: string,
    viewport: ViewportLike,
    scale: number,
    callbacks: TextNoteLayerCallbacks,
    getActiveFontId: () => string,
    getActiveColor: () => string,
  ) {
    this.pageId = pageId;
    this.viewport = viewport;
    this.scale = scale;
    this.callbacks = callbacks;
    this.getActiveFontId = getActiveFontId;
    this.getActiveColor = getActiveColor;
    this.el = document.createElement("div");
    this.el.className = "text-layer";
    this.el.addEventListener("pointerdown", (e) => {
      if (e.target === this.el) {
        const rect = this.el.getBoundingClientRect();
        this.createNoteAt(e.clientX - rect.left, e.clientY - rect.top);
      }
    });
  }

  updateViewport(viewport: ViewportLike, scale: number): void {
    this.viewport = viewport;
    this.scale = scale;
    for (const entry of this.notes.values()) this.positionElement(entry.record, entry.el);
  }

  loadNotes(notes: TextNoteRecord[]): void {
    this.el.innerHTML = "";
    this.notes.clear();
    this.lastFocusedNoteId = null;
    for (const note of notes) this.mountNote(note);
  }

  private createNoteAt(localX: number, localY: number): void {
    const [x, y] = this.viewport.convertToPdfPoint(localX, localY);
    const record: TextNoteRecord = {
      id: uuid(),
      pageId: this.pageId,
      x,
      y,
      width: DEFAULT_WIDTH / this.scale,
      height: DEFAULT_HEIGHT / this.scale,
      text: "",
      fontFamily: this.getActiveFontId(),
      fontSize: DEFAULT_FONT_SIZE,
      color: this.getActiveColor(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.mountNote(record);
    this.callbacks.onSave(record);
    this.lastFocusedNoteId = record.id;
    const body = this.notes.get(record.id)?.body;
    body?.focus();
  }

  private mountNote(record: TextNoteRecord): void {
    const wrap = document.createElement("div");
    wrap.className = "text-note";

    const handle = document.createElement("div");
    handle.className = "text-note-handle";
    handle.textContent = "⠿";

    const closeBtn = document.createElement("button");
    closeBtn.className = "text-note-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    closeBtn.addEventListener("click", () => {
      wrap.remove();
      this.notes.delete(record.id);
      if (this.lastFocusedNoteId === record.id) this.lastFocusedNoteId = null;
      this.callbacks.onDelete(record.id);
    });

    const body = document.createElement("div");
    body.className = "text-note-body";
    body.contentEditable = "true";
    body.textContent = record.text;
    body.addEventListener("input", () => {
      record.text = body.textContent ?? "";
      record.updatedAt = Date.now();
      this.callbacks.onSave(record);
    });
    body.addEventListener("pointerdown", (e) => e.stopPropagation());
    body.addEventListener("focus", () => (this.lastFocusedNoteId = record.id));

    const resize = document.createElement("div");
    resize.className = "text-note-resize";

    handle.addEventListener("pointerdown", (e) => this.startDrag(e, record, wrap, "move"));
    resize.addEventListener("pointerdown", (e) => this.startDrag(e, record, wrap, "resize"));

    wrap.append(handle, closeBtn, body, resize);
    this.el.appendChild(wrap);
    this.notes.set(record.id, { record, el: wrap, body });
    this.applyFontStyle(record, body);
    this.positionElement(record, wrap);
  }

  private startDrag(e: PointerEvent, record: TextNoteRecord, wrap: HTMLElement, mode: "move" | "resize"): void {
    e.stopPropagation();
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startRecordX = record.x;
    const startRecordY = record.y;
    const startWidth = record.width;
    const startHeight = record.height;

    const onMove = (ev: PointerEvent) => {
      const dxPage = (ev.clientX - startX) / this.scale;
      const dyPage = (ev.clientY - startY) / this.scale;
      if (mode === "move") {
        record.x = startRecordX + dxPage;
        record.y = startRecordY + dyPage;
      } else {
        record.width = Math.max(40 / this.scale, startWidth + dxPage);
        record.height = Math.max(24 / this.scale, startHeight + dyPage);
      }
      this.positionElement(record, wrap);
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      record.updatedAt = Date.now();
      this.callbacks.onSave(record);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  private applyFontStyle(record: TextNoteRecord, body: HTMLElement): void {
    body.style.fontFamily = fontFamilyFor(record.fontFamily);
    body.style.color = record.color;
    body.style.fontSize = `${record.fontSize * this.scale}px`;
  }

  setActiveNoteStyle(fontId: string, color: string): void {
    // Applies to the most recently focused/created note, since clicking a
    // toolbar button shifts document.activeElement away before this runs.
    if (!this.lastFocusedNoteId) return;
    const entry = this.notes.get(this.lastFocusedNoteId);
    if (!entry) return;
    entry.record.fontFamily = fontId;
    entry.record.color = color;
    this.applyFontStyle(entry.record, entry.body);
    this.callbacks.onSave(entry.record);
  }

  private positionElement(record: TextNoteRecord, wrap: HTMLElement): void {
    const [vx, vy] = this.viewport.convertToViewportPoint(record.x, record.y);
    wrap.style.left = `${vx}px`;
    wrap.style.top = `${vy}px`;
    wrap.style.width = `${record.width * this.scale}px`;
    wrap.style.height = `${record.height * this.scale}px`;
    const body = this.notes.get(record.id)?.body;
    if (body) body.style.fontSize = `${record.fontSize * this.scale}px`;
  }
}
