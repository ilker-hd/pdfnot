import type { StrokePoint } from "../models/types";
import type { ViewportLike } from "../pdf/pageViewport";

export interface InkHandlers {
  onStart(point: StrokePoint): void;
  onMove(points: StrokePoint[]): void;
  onEnd(): void;
  onCancel(): void;
}

/**
 * Captures Apple Pencil / touch / mouse input from a canvas via the Pointer
 * Events API and converts screen coordinates to page-space coordinates via
 * the current viewport, so callers (ink drawing, eraser) never deal with
 * pixels directly. Also implements simple palm rejection: while a pen stroke
 * is in progress, touch-originated pointer events on the same canvas are
 * ignored; an optional "pencil only" mode blocks all touch-originated
 * strokes regardless of pen state.
 */
export class StrokeEngine {
  private canvas: HTMLCanvasElement;
  private handlers: InkHandlers;
  private getViewport: () => ViewportLike;
  private activePenPointerId: number | null = null;
  private blockedPointerIds = new Set<number>();
  private pencilOnly = false;

  constructor(canvas: HTMLCanvasElement, handlers: InkHandlers, getViewport: () => ViewportLike) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.getViewport = getViewport;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  setPencilOnly(value: boolean): void {
    this.pencilOnly = value;
  }

  attach(): void {
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
  }

  detach(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
  }

  private toPagePoint(clientX: number, clientY: number, pressure: number): StrokePoint {
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const [x, y] = this.getViewport().convertToPdfPoint(localX, localY);
    return { x, y, pressure };
  }

  private shouldReject(evt: PointerEvent): boolean {
    if (evt.pointerType === "touch" && this.pencilOnly) return true;
    if (evt.pointerType === "touch" && this.activePenPointerId !== null) return true;
    return false;
  }

  private onPointerDown(evt: PointerEvent): void {
    if (this.shouldReject(evt)) {
      this.blockedPointerIds.add(evt.pointerId);
      evt.preventDefault();
      return;
    }
    if (evt.pointerType === "pen") this.activePenPointerId = evt.pointerId;
    this.canvas.setPointerCapture(evt.pointerId);
    const pressure = evt.pressure > 0 ? evt.pressure : 0.5;
    this.handlers.onStart(this.toPagePoint(evt.clientX, evt.clientY, pressure));
    evt.preventDefault();
  }

  private onPointerMove(evt: PointerEvent): void {
    if (this.blockedPointerIds.has(evt.pointerId)) {
      evt.preventDefault();
      return;
    }
    if (evt.pointerType === "touch" && this.activePenPointerId !== null && evt.pointerId !== this.activePenPointerId) {
      evt.preventDefault();
      return;
    }
    const source = typeof evt.getCoalescedEvents === "function" ? evt.getCoalescedEvents() : [evt];
    const events = source.length > 0 ? source : [evt];
    const points = events.map((e) => this.toPagePoint(e.clientX, e.clientY, e.pressure > 0 ? e.pressure : 0.5));
    this.handlers.onMove(points);
    evt.preventDefault();
  }

  private onPointerUp(evt: PointerEvent): void {
    if (this.blockedPointerIds.delete(evt.pointerId)) return;
    if (evt.pointerId === this.activePenPointerId) this.activePenPointerId = null;
    this.handlers.onEnd();
  }

  private onPointerCancel(evt: PointerEvent): void {
    if (this.blockedPointerIds.delete(evt.pointerId)) return;
    if (evt.pointerId === this.activePenPointerId) this.activePenPointerId = null;
    this.handlers.onCancel();
  }
}
