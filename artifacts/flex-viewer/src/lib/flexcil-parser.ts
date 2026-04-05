import { unzipSync, strFromU8 } from 'fflate';

export interface FlexBackupInfo {
  appName: string;
  backupDate: string;
  appVersion: string;
  version: string;
}

export interface FlxDocInfo {
  name: string;
  createDate: number;
  modifiedDate: number;
  type: number;
  key: string;
}

export interface FlxPageInfo {
  key: string;
  frame: { x: number; y: number; width: number; height: number };
  rotate: number;
  attachmentPage?: { file: string; index: number };
}

export interface FlexDocument {
  name: string;
  flxSize: number;
  info?: FlxDocInfo;
  thumbnail?: Uint8Array;
  pdfData?: Uint8Array;
  pages?: FlxPageInfo[];
  drawingsData?: Record<string, unknown>[];
  annotationsData?: unknown[];
}

export interface FolderNode {
  name: string;
  fullPath: string;
  subfolders: FolderNode[];
  documents: FlexDocument[];
}

export interface FlexBackup {
  info: FlexBackupInfo;
  rootFolders: FolderNode[];
  totalDocuments: number;
}

function ensureFolder(folders: FolderNode[], name: string, fullPath: string): FolderNode {
  let node = folders.find((f) => f.name === name);
  if (!node) {
    node = { name, fullPath, subfolders: [], documents: [] };
    folders.push(node);
  }
  return node;
}

function sortTree(folders: FolderNode[]): void {
  for (const folder of folders) {
    folder.documents.sort((a, b) => (b.info?.modifiedDate ?? 0) - (a.info?.modifiedDate ?? 0));
    folder.subfolders.sort((a, b) => a.name.localeCompare(b.name));
    sortTree(folder.subfolders);
  }
}

function countDocuments(folders: FolderNode[]): number {
  return folders.reduce((s, f) => s + f.documents.length + countDocuments(f.subfolders), 0);
}

export function getAllDocuments(folders: FolderNode[]): { doc: FlexDocument; folderPath: string }[] {
  const result: { doc: FlexDocument; folderPath: string }[] = [];
  for (const folder of folders) {
    for (const doc of folder.documents) result.push({ doc, folderPath: folder.fullPath });
    result.push(...getAllDocuments(folder.subfolders));
  }
  return result;
}

export function getAllDocsInFolder(folder: FolderNode): { doc: FlexDocument; folderPath: string }[] {
  return getAllDocuments([folder]);
}

/**
 * Parses a Flexcil .flex backup file.
 *
 * The .flex container is a ZIP file. We use unzipSync (which reads the
 * Central Directory at the end of the file, giving us correct entry sizes
 * even when data descriptors are used).  arrayBuffer() is awaited
 * asynchronously so the UI thread is not blocked during the file read.
 * The unzipSync step itself is fast (<1 s for typical backups).
 *
 * For very large files (>500 MB) we yield once before decompressing so the
 * browser can update the loading indicator.
 */
export async function parseFlexFile(file: File): Promise<FlexBackup> {
  // Async read — does not block the UI thread
  const arrayBuffer = await file.arrayBuffer();

  // Give the browser one frame to update the loading state before the
  // synchronous decompression pass.
  await new Promise((r) => setTimeout(r, 0));

  const uint8 = new Uint8Array(arrayBuffer);
  const outerZip = unzipSync(uint8);

  let backupInfo: FlexBackupInfo = { appName: 'Flexcil', backupDate: '', appVersion: '', version: '' };
  const rootFolders: FolderNode[] = [];

  for (const [path, data] of Object.entries(outerZip)) {
    // ── backup info ──────────────────────────────────────────────────────
    if (path === 'flexcilbackup/info') {
      try { backupInfo = JSON.parse(strFromU8(data)); } catch {}
      continue;
    }

    // ── only process .flx document entries ───────────────────────────────
    if (!path.endsWith('.flx')) continue;

    const parts = path.split('/');
    // Expected shape: flexcilbackup/Documents/<folder…>/<file>.flx
    if (parts.length < 4 || parts[0] !== 'flexcilbackup' || parts[1] !== 'Documents') continue;

    // Everything between "Documents/" and the filename is the folder path
    const folderParts = parts.slice(2, -1);
    const fileName = parts[parts.length - 1].replace(/\.flx$/, '');
    if (folderParts.length === 0) continue; // file directly under Documents — skip

    // Walk / create the nested folder tree
    let currentFolders = rootFolders;
    let fullPath = '';
    let leafFolder: FolderNode | null = null;
    for (const part of folderParts) {
      fullPath = fullPath ? `${fullPath}/${part}` : part;
      leafFolder = ensureFolder(currentFolders, part, fullPath);
      currentFolders = leafFolder.subfolders;
    }
    if (!leafFolder) continue;

    leafFolder.documents.push(parseFlxDoc(fileName, data));
  }

  sortTree(rootFolders);
  return { info: backupInfo, rootFolders, totalDocuments: countDocuments(rootFolders) };
}

function parseFlxDoc(name: string, data: Uint8Array): FlexDocument {
  const doc: FlexDocument = { name, flxSize: data.length };
  try {
    const inner = unzipSync(data);

    if (inner['info']) {
      try { doc.info = JSON.parse(strFromU8(inner['info'])); } catch {}
    }

    doc.thumbnail = inner['thumbnail'] ?? inner['thumbnail@2x'];

    const pdfKey = Object.keys(inner).find((k) => k.startsWith('attachment/PDF/'));
    if (pdfKey) doc.pdfData = inner[pdfKey];

    if (inner['pages.index']) {
      try { doc.pages = JSON.parse(strFromU8(inner['pages.index'])); } catch {}
    }

    const drawingKey = Object.keys(inner).find((k) => k.endsWith('.drawings'));
    if (drawingKey) {
      try { doc.drawingsData = JSON.parse(strFromU8(inner[drawingKey])); } catch {}
    }

    const annotKey = Object.keys(inner).find((k) => k.endsWith('.annotations'));
    if (annotKey) {
      try { doc.annotationsData = JSON.parse(strFromU8(inner[annotKey])); } catch {}
    }
  } catch {}
  return doc;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return 'Unknown';
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  return new Date(ms).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
