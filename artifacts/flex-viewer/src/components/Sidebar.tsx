import { useState } from 'react';
import {
  FolderOpen,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Home,
  Search,
  X,
  Sun,
  Moon,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { FlexBackup, FlexDocument, FolderNode } from '@/lib/flexcil-parser';
import { formatDate, getAllDocsInFolder } from '@/lib/flexcil-parser';
import { useTheme } from '@/lib/theme';

interface SidebarProps {
  backup: FlexBackup;
  selectedDoc: FlexDocument | null;
  onSelectDoc: (doc: FlexDocument, folderPath: string) => void;
  onReset: () => void;
  checkedDocs: Map<string, { doc: FlexDocument; folderName: string }>;
  onToggleCheck: (key: string, doc: FlexDocument, folderPath: string) => void;
  onToggleFolderCheck: (folder: FolderNode) => void;
}

function docKey(folderPath: string, docName: string) {
  return `${folderPath}/${docName}`;
}

function hasMatchingDocs(folder: FolderNode, query: string): boolean {
  if (folder.documents.some(
    (d) => d.name.toLowerCase().includes(query) || (d.info?.name ?? '').toLowerCase().includes(query)
  )) return true;
  return folder.subfolders.some((sf) => hasMatchingDocs(sf, query));
}

function folderCheckState(
  folder: FolderNode,
  checkedDocs: Map<string, { doc: FlexDocument; folderName: string }>
): 'all' | 'none' | 'partial' {
  const all = getAllDocsInFolder(folder);
  if (all.length === 0) return 'none';
  const checked = all.filter(({ doc, folderPath }) => checkedDocs.has(docKey(folderPath, doc.name))).length;
  if (checked === 0) return 'none';
  if (checked === all.length) return 'all';
  return 'partial';
}

function totalDocCount(folder: FolderNode): number {
  return folder.documents.length + folder.subfolders.reduce((s, sf) => s + totalDocCount(sf), 0);
}

interface FolderTreeItemProps {
  folder: FolderNode;
  depth: number;
  selectedDoc: FlexDocument | null;
  onSelectDoc: (doc: FlexDocument, folderPath: string) => void;
  checkedDocs: Map<string, { doc: FlexDocument; folderName: string }>;
  onToggleCheck: (key: string, doc: FlexDocument, folderPath: string) => void;
  onToggleFolderCheck: (folder: FolderNode) => void;
  expandedFolders: Record<string, boolean>;
  onToggleExpand: (path: string) => void;
  search: string;
}

function FolderTreeItem({
  folder,
  depth,
  selectedDoc,
  onSelectDoc,
  checkedDocs,
  onToggleCheck,
  onToggleFolderCheck,
  expandedFolders,
  onToggleExpand,
  search,
}: FolderTreeItemProps) {
  const query = search.toLowerCase();
  const filteredDocs = folder.documents.filter((doc) =>
    search
      ? doc.name.toLowerCase().includes(query) || (doc.info?.name ?? '').toLowerCase().includes(query)
      : true
  );
  const filteredSubfolders = search
    ? folder.subfolders.filter((sf) => hasMatchingDocs(sf, query))
    : folder.subfolders;

  if (search && filteredDocs.length === 0 && filteredSubfolders.length === 0) return null;

  const isExpanded = expandedFolders[folder.fullPath] ?? true;
  const cs = folderCheckState(folder, checkedDocs);
  const count = totalDocCount(folder);
  const indent = depth * 12;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: indent }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFolderCheck(folder); }}
          className="pl-3 pr-1 py-2 text-muted-foreground hover:text-primary transition-colors shrink-0"
          title={cs === 'all' ? 'Deselect folder' : 'Select all in folder'}
        >
          {cs === 'all' ? (
            <CheckSquare className="w-3.5 h-3.5 text-primary" />
          ) : cs === 'partial' ? (
            <CheckSquare className="w-3.5 h-3.5 text-primary/50" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={() => onToggleExpand(folder.fullPath)}
          className="flex-1 flex items-center gap-2 pr-3 py-2 hover:bg-sidebar-accent/50 transition-colors text-left"
        >
          <span className="text-muted-foreground">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-medium truncate text-sidebar-foreground flex-1">{folder.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div>
          {filteredSubfolders.map((sf) => (
            <FolderTreeItem
              key={sf.fullPath}
              folder={sf}
              depth={depth + 1}
              selectedDoc={selectedDoc}
              onSelectDoc={onSelectDoc}
              checkedDocs={checkedDocs}
              onToggleCheck={onToggleCheck}
              onToggleFolderCheck={onToggleFolderCheck}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              search={search}
            />
          ))}

          {filteredDocs.map((doc) => {
            const displayName = doc.info?.name ?? doc.name;
            const isSelected = selectedDoc === doc;
            const key = docKey(folder.fullPath, doc.name);
            const isChecked = checkedDocs.has(key);
            return (
              <div
                key={doc.name}
                className={`flex items-start gap-1 mx-1 my-0.5 rounded-md transition-colors
                  ${isSelected ? 'bg-primary/12' : 'hover:bg-sidebar-accent/30'}`}
                style={{ paddingLeft: indent + 4 }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleCheck(key, doc, folder.fullPath); }}
                  className="pl-7 pr-1 py-2 text-muted-foreground hover:text-primary transition-colors shrink-0"
                >
                  {isChecked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => onSelectDoc(doc, folder.fullPath)}
                  className="flex-1 flex items-start gap-2 pr-3 py-2 text-left min-w-0"
                >
                  <FileText className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium truncate leading-tight ${isSelected ? 'text-primary' : 'text-sidebar-foreground'}`}>
                      {displayName}
                    </p>
                    {doc.info?.modifiedDate && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {formatDate(doc.info.modifiedDate)}
                      </p>
                    )}
                    {doc.pdfData && (
                      <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded mt-0.5 inline-block">PDF</span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function collectAllPaths(folders: FolderNode[]): string[] {
  const paths: string[] = [];
  for (const f of folders) {
    paths.push(f.fullPath);
    paths.push(...collectAllPaths(f.subfolders));
  }
  return paths;
}

export function Sidebar({
  backup,
  selectedDoc,
  onSelectDoc,
  onReset,
  checkedDocs,
  onToggleCheck,
  onToggleFolderCheck,
}: SidebarProps) {
  const { theme, toggle: toggleTheme } = useTheme();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const all = collectAllPaths(backup.rootFolders);
    return Object.fromEntries(all.map((p) => [p, true]));
  });
  const [search, setSearch] = useState('');

  const toggleExpand = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const hasResults = backup.rootFolders.some((f) =>
    search ? hasMatchingDocs(f, search.toLowerCase()) : true
  );

  return (
    <aside className="w-72 min-w-[220px] max-w-xs flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
        <button
          onClick={onReset}
          className="p-1.5 rounded hover:bg-sidebar-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Open another file"
        >
          <Home className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-sidebar-foreground">
            {backup.info.appName || 'Flexcil Backup'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{backup.info.backupDate}</p>
        </div>
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-sidebar-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {checkedDocs.size > 0 && (
        <div className="px-3 py-1.5 bg-primary/10 border-b border-primary/20">
          <p className="text-xs text-primary font-medium">
            {checkedDocs.size} selected — use Export bar below
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {backup.rootFolders.map((folder) => (
          <FolderTreeItem
            key={folder.fullPath}
            folder={folder}
            depth={0}
            selectedDoc={selectedDoc}
            onSelectDoc={onSelectDoc}
            checkedDocs={checkedDocs}
            onToggleCheck={onToggleCheck}
            onToggleFolderCheck={onToggleFolderCheck}
            expandedFolders={expandedFolders}
            onToggleExpand={toggleExpand}
            search={search}
          />
        ))}

        {!hasResults && (
          <div className="text-center py-8 text-muted-foreground text-sm">No documents found</div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-sidebar-border bg-sidebar/80">
        <p className="text-[11px] text-muted-foreground">
          {backup.totalDocuments} documents · {backup.rootFolders.length} folders
        </p>
        <p className="text-[11px] text-muted-foreground">Flexcil v{backup.info.appVersion}</p>
      </div>
    </aside>
  );
}
