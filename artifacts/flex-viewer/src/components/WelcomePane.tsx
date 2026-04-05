import { FileText, Folder, Info, Download, Package } from 'lucide-react';
import type { FlexBackup, FlexDocument, FolderNode } from '@/lib/flexcil-parser';
import { formatDate, formatFileSize, getAllDocuments } from '@/lib/flexcil-parser';
import { exportAsZip } from '@/lib/zip-export';
import { useState } from 'react';

interface WelcomePaneProps {
  backup: FlexBackup;
}

function countFolders(folders: FolderNode[]): number {
  return folders.reduce((s, f) => s + 1 + countFolders(f.subfolders), 0);
}

export function WelcomePane({ backup }: WelcomePaneProps) {
  const [exporting, setExporting] = useState(false);

  const allDocs = getAllDocuments(backup.rootFolders);

  const totalSize = allDocs.reduce((sum, { doc }) => sum + (doc.flxSize ?? 0), 0);
  const totalPdfs = allDocs.filter(({ doc }) => doc.pdfData).length;
  const totalFolders = countFolders(backup.rootFolders);

  const exportItems = allDocs.map(({ doc, folderPath }) => ({
    name: doc.info?.name ?? doc.name,
    pdfData: doc.pdfData,
    thumbnail: doc.thumbnail,
    folderName: folderPath,
  }));

  async function exportAllPdfs() {
    setExporting(true);
    try {
      await exportAsZip(exportItems, 'pdfs', backup.info.appName || 'flexcil_export');
    } catch (e) {
      alert('Export failed: ' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      await exportAsZip(exportItems, 'all', backup.info.appName || 'flexcil_export');
    } catch (e) {
      alert('Export failed: ' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-8">
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Backup Opened</h1>
          <p className="text-muted-foreground text-sm">
            Select a document from the sidebar to view it, or export documents below.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Folder className="w-5 h-5 text-primary" />} value={totalFolders} label="Folders" />
          <StatCard icon={<FileText className="w-5 h-5 text-green-600" />} value={backup.totalDocuments} label="Documents" />
          <StatCard icon={<FileText className="w-5 h-5 text-orange-500" />} value={totalPdfs} label="With PDF" />
          <StatCard icon={<Info className="w-5 h-5 text-purple-500" />} value={formatFileSize(totalSize)} label="Total Size" />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 mb-4">
          <h2 className="font-semibold mb-3 text-sm">Backup Info</h2>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="App" value={backup.info.appName} />
            <DetailRow label="Version" value={backup.info.appVersion} />
            <DetailRow label="Backup Date" value={backup.info.backupDate} />
            <DetailRow label="Format" value={`v${backup.info.version}`} />
          </div>
        </div>

        {totalPdfs > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 mb-6">
            <h2 className="font-semibold mb-3 text-sm">Quick Export</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Export all {totalPdfs} PDFs from this backup at once. Files are organized in folders matching your Flexcil structure.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={exportAllPdfs}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Packing...' : `Export All ${totalPdfs} PDFs`}
              </button>
              <button
                onClick={exportAll}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                <Package className="w-4 h-4" />
                {exporting ? 'Packing...' : 'Export PDFs + Previews'}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3 text-sm">Folder Contents</h2>
          <FolderTree folders={backup.rootFolders} depth={0} />
        </div>
      </div>
    </div>
  );
}

function FolderTree({ folders, depth }: { folders: FolderNode[]; depth: number }) {
  return (
    <div className="space-y-2">
      {folders.map((folder) => (
        <FolderSummary key={folder.fullPath} folder={folder} depth={depth} />
      ))}
    </div>
  );
}

function FolderSummary({ folder, depth }: { folder: FolderNode; depth: number }) {
  const pdfCount = folder.documents.filter((d) => d.pdfData).length;
  const indent = depth * 16;

  return (
    <div style={{ marginLeft: indent }}>
      <div className="p-3 rounded-lg bg-muted/40 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Folder className="w-4 h-4 text-primary shrink-0" />
          <span className="font-medium text-sm">{folder.name}</span>
          {folder.documents.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {pdfCount}/{folder.documents.length} PDFs
            </span>
          )}
        </div>

        {folder.documents.length > 0 && (
          <div className="space-y-1 mb-2">
            {folder.documents.slice(0, 5).map((doc: FlexDocument) => (
              <div key={doc.name} className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                <FileText className="w-3 h-3 shrink-0" />
                <span className="truncate flex-1">{doc.info?.name ?? doc.name}</span>
                {doc.pdfData && <span className="text-blue-500 shrink-0">PDF</span>}
                {doc.info?.modifiedDate && (
                  <span className="shrink-0 hidden sm:inline">{formatDate(doc.info.modifiedDate)}</span>
                )}
              </div>
            ))}
            {folder.documents.length > 5 && (
              <p className="text-xs text-muted-foreground pl-6">
                +{folder.documents.length - 5} more...
              </p>
            )}
          </div>
        )}

        {folder.subfolders.length > 0 && (
          <FolderTree folders={folder.subfolders} depth={depth + 1} />
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2 text-center">
      {icon}
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5 border-b border-border last:border-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  );
}
