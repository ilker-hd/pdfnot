import type { DocRecord, PageRecord } from "../models/types";
import { BLANK_PAGE_DEFAULTS } from "../models/types";
import { listDocuments, putDocument, deleteDocument } from "../db/documentsRepo";
import { putPage } from "../db/pagesRepo";
import { loadPdfFromBlob } from "../pdf/pdfLoader";
import { BLANK_PAGE_WIDTH, BLANK_PAGE_HEIGHT } from "../pdf/pageViewport";
import { exportLibrary, importLibrary, downloadBlob } from "../db/backupService";
import { uuid } from "../utils/uuid";
import { showPrompt, showConfirm, showAlert } from "./modal";

export async function renderLibraryView(container: HTMLElement, openDocument: (id: string) => void): Promise<void> {
  container.innerHTML = "";
  container.className = "library-view";

  const header = document.createElement("div");
  header.className = "library-header";
  const title = document.createElement("h1");
  title.textContent = "Melisa'nın Defterleri";
  header.appendChild(title);

  const actions = document.createElement("div");
  actions.className = "library-actions";

  const newNotebookBtn = document.createElement("button");
  newNotebookBtn.textContent = "+ Yeni Defter";
  newNotebookBtn.addEventListener("click", async () => {
    const name = await showPrompt("Defter adı:", "Yeni Defter");
    if (name === null) return;
    const id = await createBlankNotebook(name || "Yeni Defter");
    openDocument(id);
  });

  const pdfInput = document.createElement("input");
  pdfInput.type = "file";
  pdfInput.accept = "application/pdf";
  pdfInput.style.display = "none";
  pdfInput.addEventListener("change", async () => {
    const file = pdfInput.files?.[0];
    if (!file) return;
    const id = await importPdfDocument(file);
    pdfInput.value = "";
    openDocument(id);
  });
  const uploadBtn = document.createElement("button");
  uploadBtn.textContent = "⇧ PDF Yükle";
  uploadBtn.addEventListener("click", () => pdfInput.click());

  const backupBtn = document.createElement("button");
  backupBtn.textContent = "⇩ Yedekle";
  backupBtn.addEventListener("click", async () => {
    const blob = await exportLibrary();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `notability-yedek-${stamp}.zip`);
  });

  const restoreInput = document.createElement("input");
  restoreInput.type = "file";
  restoreInput.accept = ".zip,application/zip";
  restoreInput.style.display = "none";
  restoreInput.addEventListener("change", async () => {
    const file = restoreInput.files?.[0];
    if (!file) return;
    try {
      const result = await importLibrary(file);
      await showAlert(`Geri yükleme tamamlandı: ${result.documents} defter, ${result.strokes} çizim, ${result.textNotes} metin notu.`);
      await renderLibraryView(container, openDocument);
    } catch (err) {
      await showAlert("Geri yükleme başarısız: " + (err instanceof Error ? err.message : String(err)));
    }
    restoreInput.value = "";
  });
  const restoreBtn = document.createElement("button");
  restoreBtn.textContent = "⇧ Yedekten Geri Yükle";
  restoreBtn.addEventListener("click", () => restoreInput.click());

  actions.append(newNotebookBtn, uploadBtn, backupBtn, restoreBtn, pdfInput, restoreInput);
  header.appendChild(actions);
  container.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "library-grid";
  container.appendChild(grid);

  const docs = await listDocuments();
  if (docs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "library-empty";
    empty.textContent = "Henüz defter yok. Yukarıdan yeni bir defter oluştur ya da bir PDF yükle.";
    grid.appendChild(empty);
  }

  for (const doc of docs) {
    grid.appendChild(renderCard(doc, openDocument, () => renderLibraryView(container, openDocument)));
  }
}

function renderCard(doc: DocRecord, openDocument: (id: string) => void, refresh: () => void): HTMLElement {
  const card = document.createElement("div");
  card.className = "doc-card";

  const thumb = document.createElement("div");
  thumb.className = "doc-thumb";
  thumb.textContent = doc.type === "pdf" ? "📄" : "📝";
  card.appendChild(thumb);

  const info = document.createElement("div");
  info.className = "doc-info";
  const t = document.createElement("div");
  t.className = "doc-title";
  t.textContent = doc.title;
  const meta = document.createElement("div");
  meta.className = "doc-meta";
  meta.textContent = `${doc.pageCount} sayfa · ${new Date(doc.updatedAt).toLocaleDateString("tr-TR")}`;
  info.append(t, meta);
  card.appendChild(info);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "doc-delete";
  deleteBtn.textContent = "🗑";
  deleteBtn.title = "Sil";
  deleteBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (await showConfirm(`"${doc.title}" silinsin mi? Bu işlem geri alınamaz.`)) {
      await deleteDocument(doc.id);
      refresh();
    }
  });
  card.appendChild(deleteBtn);

  card.addEventListener("click", () => openDocument(doc.id));
  return card;
}

async function createBlankNotebook(title: string): Promise<string> {
  const id = uuid();
  const now = Date.now();
  const doc: DocRecord = { id, title, type: "blank", createdAt: now, updatedAt: now, pageCount: 1 };
  await putDocument(doc);
  const page: PageRecord = {
    id: uuid(),
    documentId: id,
    index: 0,
    pageSpaceWidth: BLANK_PAGE_WIDTH,
    pageSpaceHeight: BLANK_PAGE_HEIGHT,
    rotation: 0,
    background: BLANK_PAGE_DEFAULTS.background,
  };
  await putPage(page);
  return id;
}

async function importPdfDocument(file: File): Promise<string> {
  const pdf = await loadPdfFromBlob(file);
  const id = uuid();
  const now = Date.now();
  const title = file.name.replace(/\.pdf$/i, "");
  const doc: DocRecord = {
    id,
    title,
    type: "pdf",
    createdAt: now,
    updatedAt: now,
    pageCount: pdf.numPages,
    originalPdfBlob: file,
  };
  await putDocument(doc);
  for (let i = 0; i < pdf.numPages; i++) {
    const srcPage = await pdf.getPage(i + 1);
    const viewport = srcPage.getViewport({ scale: 1, rotation: srcPage.rotate });
    const page: PageRecord = {
      id: uuid(),
      documentId: id,
      index: i,
      pageSpaceWidth: viewport.width,
      pageSpaceHeight: viewport.height,
      rotation: srcPage.rotate,
    };
    await putPage(page);
  }
  return id;
}
