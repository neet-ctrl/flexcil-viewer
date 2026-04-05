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

/** True when the browser supports the File System Access API (folder picker) */
export function supportsFolderPicker(): boolean {
  return typeof (window as Record<string, unknown>)['showDirectoryPicker'] === 'function';
}

// ─── Core download helper — works in both browser and Capacitor WebView ───────
//
// In a standard browser:  creates a blob URL → clicks a hidden <a> → browser
//   downloads to the Downloads folder.
//
// In Capacitor WebView:   same path — Capacitor registers a DownloadListener on
//   the WebView that passes blob downloads to Android's DownloadManager, so the
//   file lands in the device's Downloads folder just like a browser download.
//
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
//   Supported in: Chrome 86+ desktop, Chrome 109+ Android, Capacitor WebView
//   on Android 10+ (uses Chromium engine).
//
export async function saveToChosenFolder(items: ExportItem[], format: ExportFormat): Promise<number> {
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
//   Works in both browser and Capacitor WebView via DownloadManager.
//
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

      if (isCapacitor()) {
        // In Capacitor WebView, trigger download via a temporary <a> element.
        // The WebView's DownloadListener intercepts blob: URLs and routes them
        // through Android's DownloadManager → saved to device Downloads folder.
        const blob = new Blob([data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitize(zipName)}.zip`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // Small delay before removing to let the WebView intercept
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
      } else {
        // Standard browser download
        const blob = new Blob([data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitize(zipName)}.zip`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      resolve();
    });
  });
}
