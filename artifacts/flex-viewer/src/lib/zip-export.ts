import { zip } from 'fflate';

export interface ExportItem {
  name: string;
  pdfData?: Uint8Array;
  thumbnail?: Uint8Array;
  folderName: string;
}

export type ExportFormat = 'pdfs' | 'thumbnails' | 'all';

function sanitize(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_');
}

/** True when running inside a Capacitor native wrapper (Android/iOS APK) */
function isCapacitor(): boolean {
  return !!(window as Record<string, unknown>)['Capacitor'];
}

/**
 * True only when the browser supports the File System Access API AND we are
 * not running inside a Capacitor WebView.  Capacitor's WebView exposes
 * showDirectoryPicker in some Chromium versions but it always fails at runtime
 * because the WebView sandbox blocks filesystem access.
 */
export function supportsFolderPicker(): boolean {
  if (isCapacitor()) return false;
  return typeof (window as Record<string, unknown>)['showDirectoryPicker'] === 'function';
}

// ─── Core download helper ─────────────────────────────────────────────────────
export async function downloadSingleFile(
  data: Uint8Array,
  filename: string,
  mimeType: string
): Promise<void> {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

// ─── Save files directly to a user-chosen folder ─────────────────────────────
//   Uses the File System Access API (showDirectoryPicker).
//   Only shown on desktop browsers — not available in Capacitor WebView.
//
export async function saveToChosenFolder(items: ExportItem[], format: ExportFormat): Promise<number> {
  if (isCapacitor()) {
    // Capacitor WebView cannot use showDirectoryPicker — fall back to ZIP
    await exportAsZip(items, format, 'flexcil_export');
    return items.filter((i) =>
      (format === 'pdfs' || format === 'all' ? i.pdfData : false) ||
      (format === 'thumbnails' || format === 'all' ? i.thumbnail : false)
    ).length;
  }

  const dirHandle = await (window as unknown as {
    showDirectoryPicker: (opts?: { mode: string }) => Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker({ mode: 'readwrite' });

  let saved = 0;
  for (const item of items) {
    const folder = sanitize(item.folderName);
    const docName = sanitize(item.name);

    const subDir = await dirHandle.getDirectoryHandle(folder, { create: true });

    if ((format === 'pdfs' || format === 'all') && item.pdfData) {
      const fileHandle = await subDir.getFileHandle(`${docName}.pdf`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(item.pdfData);
      await writable.close();
      saved++;
    }

    if ((format === 'thumbnails' || format === 'all') && item.thumbnail) {
      const fileHandle = await subDir.getFileHandle(`${docName}_preview.jpg`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(item.thumbnail);
      await writable.close();
      saved++;
    }
  }
  return saved;
}

// ─── Bundle and download as a ZIP file ───────────────────────────────────────
export async function exportAsZip(
  items: ExportItem[],
  format: ExportFormat = 'all',
  zipName: string = 'flexcil_export'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const files: Record<string, Uint8Array> = {};

    for (const item of items) {
      const folder = sanitize(item.folderName);
      const docName = sanitize(item.name);
      const includePdf = format === 'pdfs' || format === 'all';
      const includeThumb = format === 'thumbnails' || format === 'all';

      if (includePdf && item.pdfData) {
        files[`${folder}/${docName}.pdf`] = item.pdfData;
      }
      if (includeThumb && item.thumbnail) {
        files[`${folder}/${docName}_thumbnail.jpg`] = item.thumbnail;
      }
    }

    if (Object.keys(files).length === 0) {
      reject(new Error('No files to export in the selected format'));
      return;
    }

    zip(files, { level: 0 }, (err, data) => {
      if (err) { reject(err); return; }

      const blob = new Blob([data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitize(zipName)}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // In Capacitor: give the WebView's DownloadListener time to intercept
      const delay = isCapacitor() ? 2000 : 0;
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, delay);

      resolve();
    });
  });
}
