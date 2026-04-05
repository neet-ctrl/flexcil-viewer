import { useState, useCallback } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { Sidebar } from '@/components/Sidebar';
import { DocumentViewer } from '@/components/DocumentViewer';
import { WelcomePane } from '@/components/WelcomePane';
import { ExportBar } from '@/components/ExportBar';
import { ThemeProvider } from '@/lib/theme';
import type { FlexBackup, FlexDocument, FolderNode } from '@/lib/flexcil-parser';
import { parseFlexFile, getAllDocsInFolder } from '@/lib/flexcil-parser';

function AppInner() {
  const [backup, setBackup] = useState<FlexBackup | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<FlexDocument | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Map<string, { doc: FlexDocument; folderName: string }>>(new Map());

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.flex') && !file.name.endsWith('.zip')) {
      setError('Please select a Flexcil backup file (.flex)');
      return;
    }
    setLoading(true);
    setError(null);
    setSelectedDoc(null);
    setSelectedFolder('');
    setCheckedDocs(new Map());

    try {
      const result = await parseFlexFile(file);
      setBackup(result);
    } catch (err) {
      setError(`Failed to parse file: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectDoc = useCallback((doc: FlexDocument, folderPath: string) => {
    setSelectedDoc(doc);
    setSelectedFolder(folderPath);
  }, []);

  const handleReset = useCallback(() => {
    setBackup(null);
    setSelectedDoc(null);
    setSelectedFolder('');
    setError(null);
    setCheckedDocs(new Map());
  }, []);

  const handleToggleCheck = useCallback((key: string, doc: FlexDocument, folderPath: string) => {
    setCheckedDocs((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { doc, folderName: folderPath });
      }
      return next;
    });
  }, []);

  const handleToggleFolderCheck = useCallback((folder: FolderNode) => {
    setCheckedDocs((prev) => {
      const next = new Map(prev);
      const allDocs = getAllDocsInFolder(folder);
      const allChecked = allDocs.every(({ doc, folderPath }) =>
        next.has(`${folderPath}/${doc.name}`)
      );
      if (allChecked) {
        allDocs.forEach(({ doc, folderPath }) => next.delete(`${folderPath}/${doc.name}`));
      } else {
        allDocs.forEach(({ doc, folderPath }) =>
          next.set(`${folderPath}/${doc.name}`, { doc, folderName: folderPath })
        );
      }
      return next;
    });
  }, []);

  if (!backup) {
    return <UploadZone onFile={handleFile} loading={loading} error={error} />;
  }

  const hasExportBar = checkedDocs.size > 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        backup={backup}
        selectedDoc={selectedDoc}
        onSelectDoc={handleSelectDoc}
        onReset={handleReset}
        checkedDocs={checkedDocs}
        onToggleCheck={handleToggleCheck}
        onToggleFolderCheck={handleToggleFolderCheck}
      />
      <main className={`flex-1 overflow-hidden ${hasExportBar ? 'pb-14' : ''}`}>
        {selectedDoc ? (
          <DocumentViewer doc={selectedDoc} folderName={selectedFolder} />
        ) : (
          <WelcomePane backup={backup} />
        )}
      </main>
      <ExportBar
        selected={checkedDocs}
        onClearSelection={() => setCheckedDocs(new Map())}
        backupName={backup.info.appName || 'flexcil'}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

export default App;
