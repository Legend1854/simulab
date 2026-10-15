/** Starts a browser download for in-memory data. Uses an object URL, not HTML injection. */
export function downloadBlob(parts: BlobPart[], filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob(parts, { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv;charset=utf-8';

/** Adds a byte-order mark so Excel opens the CSV as UTF-8. */
export const downloadCsv = (csv: string, filename: string): void => downloadBlob(['﻿', csv], filename, CSV_MIME);

export const downloadWorkbook = (bytes: Uint8Array, filename: string): void => downloadBlob([bytes as BlobPart], filename, XLSX_MIME);

/** A filename-safe version of free text, with a fallback when nothing usable is left. */
export function safeFilename(name: string, fallback: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return cleaned.length > 0 ? cleaned : fallback;
}
