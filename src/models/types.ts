export type DocumentType = "pdf" | "blank";
export type PageBackground = "plain" | "ruled" | "grid";
export type Tool = "pen" | "eraser" | "text" | "select";

export interface DocRecord {
  id: string;
  title: string;
  type: DocumentType;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  originalPdfBlob?: Blob;
  thumbnailBlob?: Blob;
}

export interface PageRecord {
  id: string;
  documentId: string;
  index: number;
  pageSpaceWidth: number;
  pageSpaceHeight: number;
  rotation: number;
  background?: PageBackground;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface StrokeRecord {
  id: string;
  pageId: string;
  tool: "pen";
  color: string;
  baseWidth: number;
  points: StrokePoint[];
  order: number;
  createdAt: number;
}

export interface TextNoteRecord {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export const FONT_CHOICES: { id: string; label: string; family: string }[] = [
  { id: "system", label: "Sistem", family: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" },
  { id: "serif", label: "Klasik", family: "Georgia, 'Times New Roman', serif" },
  { id: "hand", label: "El Yazısı", family: "'Bradley Hand', 'Noteworthy', 'Comic Sans MS', cursive" },
  { id: "mono", label: "Mono", family: "Menlo, 'Courier New', monospace" },
];

export const PEN_COLORS: string[] = [
  "#1c1c1e",
  "#d92b2b",
  "#1f6fe0",
  "#1f9e52",
  "#e0921f",
  "#8a2be2",
];

export const TEXT_COLORS: string[] = ["#1c1c1e", "#d92b2b", "#1f6fe0", "#1f9e52", "#8a2be2"];

export const BLANK_PAGE_DEFAULTS: { background: PageBackground } = { background: "plain" };
