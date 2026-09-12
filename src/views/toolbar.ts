import type { Tool } from "../models/types";
import { FONT_CHOICES, PEN_COLORS, TEXT_COLORS } from "../models/types";

export interface ToolbarCallbacks {
  onBack(): void;
  onRename(): void;
  onToolChange(tool: Tool): void;
  onColorChange(color: string): void;
  onWidthChange(width: number): void;
  onFontChange(fontId: string): void;
  onPencilOnlyChange(enabled: boolean): void;
  onUndo(): void;
  onExportPdf(): void;
  onAddPage(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
}

export class Toolbar {
  el: HTMLElement;
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private colorSwatches: HTMLButtonElement[] = [];
  private currentContext: "pen" | "text" | "none" = "pen";
  private penColorRow: HTMLElement;
  private textColorRow: HTMLElement;
  private fontRow: HTMLElement;
  private widthLabel: HTMLElement;
  private titleBtn: HTMLButtonElement;
  private zoomLabel: HTMLElement;

  constructor(callbacks: ToolbarCallbacks, initialTitle: string) {
    this.el = document.createElement("div");
    this.el.className = "toolbar";

    const backBtn = this.button("←", "Kütüphane", () => callbacks.onBack());
    backBtn.classList.add("toolbar-back");

    this.titleBtn = document.createElement("button");
    this.titleBtn.className = "toolbar-title";
    this.titleBtn.textContent = initialTitle;
    this.titleBtn.title = "Adını değiştirmek için dokunun";
    this.titleBtn.addEventListener("click", () => callbacks.onRename());

    const tools = document.createElement("div");
    tools.className = "toolbar-group toolbar-tools";
    (["pen", "eraser", "text", "select"] as Tool[]).forEach((tool) => {
      const label =
        tool === "pen" ? "✏️ Kalem" : tool === "eraser" ? "🧽 Silgi" : tool === "text" ? "🔤 Metin" : "🖐 Kaydır";
      const btn = this.button(label, undefined, () => {
        this.setActiveTool(tool);
        callbacks.onToolChange(tool);
      });
      this.toolButtons.set(tool, btn);
      tools.appendChild(btn);
    });

    const undoBtn = this.button("↶ Geri Al", undefined, () => callbacks.onUndo());

    const zoomGroup = document.createElement("div");
    zoomGroup.className = "toolbar-group toolbar-zoom";
    const zoomOutBtn = this.button("－", "Uzaklaştır", () => callbacks.onZoomOut());
    this.zoomLabel = document.createElement("span");
    this.zoomLabel.className = "zoom-label";
    this.zoomLabel.textContent = "100%";
    this.zoomLabel.title = "Sığdır (100%) için dokunun";
    this.zoomLabel.addEventListener("click", () => callbacks.onZoomReset());
    const zoomInBtn = this.button("＋", "Yakınlaştır", () => callbacks.onZoomIn());
    zoomGroup.append(zoomOutBtn, this.zoomLabel, zoomInBtn);

    this.penColorRow = document.createElement("div");
    this.penColorRow.className = "toolbar-group toolbar-colors";
    PEN_COLORS.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.className = "color-swatch";
      swatch.style.background = color;
      swatch.title = color;
      swatch.addEventListener("click", () => {
        this.selectSwatch(swatch, this.colorSwatches);
        callbacks.onColorChange(color);
      });
      this.colorSwatches.push(swatch);
      this.penColorRow.appendChild(swatch);
    });
    this.selectSwatch(this.colorSwatches[0], this.colorSwatches);

    this.widthLabel = document.createElement("label");
    this.widthLabel.className = "toolbar-width";
    this.widthLabel.textContent = "Kalınlık";
    const widthInput = document.createElement("input");
    widthInput.type = "range";
    widthInput.min = "1";
    widthInput.max = "12";
    widthInput.value = "3";
    widthInput.addEventListener("input", () => callbacks.onWidthChange(Number(widthInput.value)));
    this.widthLabel.appendChild(widthInput);

    this.textColorRow = document.createElement("div");
    this.textColorRow.className = "toolbar-group toolbar-colors";
    const textSwatches: HTMLButtonElement[] = [];
    TEXT_COLORS.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.className = "color-swatch";
      swatch.style.background = color;
      swatch.addEventListener("click", () => {
        this.selectSwatch(swatch, textSwatches);
        callbacks.onColorChange(color);
      });
      textSwatches.push(swatch);
      this.textColorRow.appendChild(swatch);
    });

    this.fontRow = document.createElement("div");
    this.fontRow.className = "toolbar-group toolbar-fonts";
    FONT_CHOICES.forEach((font, i) => {
      const btn = document.createElement("button");
      btn.textContent = font.label;
      btn.style.fontFamily = font.family;
      btn.className = "font-btn" + (i === 0 ? " active" : "");
      btn.addEventListener("click", () => {
        this.fontRow.querySelectorAll(".font-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        callbacks.onFontChange(font.id);
      });
      this.fontRow.appendChild(btn);
    });

    const pencilOnlyLabel = document.createElement("label");
    pencilOnlyLabel.className = "toolbar-toggle";
    const pencilOnlyCheckbox = document.createElement("input");
    pencilOnlyCheckbox.type = "checkbox";
    pencilOnlyCheckbox.addEventListener("change", () => callbacks.onPencilOnlyChange(pencilOnlyCheckbox.checked));
    pencilOnlyLabel.appendChild(pencilOnlyCheckbox);
    pencilOnlyLabel.appendChild(document.createTextNode("Sadece Apple Pencil"));

    const addPageBtn = this.button("+ Sayfa", undefined, () => callbacks.onAddPage());
    const exportBtn = this.button("⇩ PDF Aktar", undefined, () => callbacks.onExportPdf());

    const spacer = document.createElement("div");
    spacer.className = "toolbar-spacer";

    this.el.append(
      backBtn,
      this.titleBtn,
      tools,
      undoBtn,
      zoomGroup,
      this.penColorRow,
      this.widthLabel,
      this.textColorRow,
      this.fontRow,
      pencilOnlyLabel,
      spacer,
      addPageBtn,
      exportBtn,
    );

    this.setActiveTool("pen");
  }

  private button(text: string, title: string | undefined, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (title) btn.title = title;
    btn.addEventListener("click", onClick);
    return btn;
  }

  private selectSwatch(active: HTMLButtonElement, all: HTMLButtonElement[]): void {
    all.forEach((s) => s.classList.remove("active"));
    active.classList.add("active");
  }

  setActiveTool(tool: Tool): void {
    this.toolButtons.forEach((btn, t) => btn.classList.toggle("active", t === tool));
    this.currentContext = tool === "text" ? "text" : tool === "select" ? "none" : "pen";
    this.penColorRow.style.display = this.currentContext === "pen" ? "flex" : "none";
    this.widthLabel.style.display = this.currentContext === "pen" ? "inline-flex" : "none";
    this.textColorRow.style.display = this.currentContext === "text" ? "flex" : "none";
    this.fontRow.style.display = this.currentContext === "text" ? "flex" : "none";
  }

  setTitle(title: string): void {
    this.titleBtn.textContent = title;
  }

  setZoomLabel(percent: number): void {
    this.zoomLabel.textContent = `${Math.round(percent)}%`;
  }
}
