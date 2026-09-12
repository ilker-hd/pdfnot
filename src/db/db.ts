import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DocRecord, PageRecord, StrokeRecord, TextNoteRecord, SettingRecord } from "../models/types";

interface AppDB extends DBSchema {
  documents: { key: string; value: DocRecord };
  pages: { key: string; value: PageRecord; indexes: { documentId: string } };
  strokes: { key: string; value: StrokeRecord; indexes: { pageId: string } };
  textNotes: { key: string; value: TextNoteRecord; indexes: { pageId: string } };
  settings: { key: string; value: SettingRecord };
}

const DB_NAME = "notabilityClone";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("documents")) {
          db.createObjectStore("documents", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pages")) {
          const store = db.createObjectStore("pages", { keyPath: "id" });
          store.createIndex("documentId", "documentId");
        }
        if (!db.objectStoreNames.contains("strokes")) {
          const store = db.createObjectStore("strokes", { keyPath: "id" });
          store.createIndex("pageId", "pageId");
        }
        if (!db.objectStoreNames.contains("textNotes")) {
          const store = db.createObjectStore("textNotes", { keyPath: "id" });
          store.createIndex("pageId", "pageId");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export type { AppDB };
