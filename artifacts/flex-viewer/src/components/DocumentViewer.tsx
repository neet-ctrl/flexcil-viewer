import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Image,
  Info,
  Download,
  Calendar,
  Clock,
  Layers,
  Copy,
  Check,
  Edit3,
  Package,
} from 'lucide-react';
import type { FlexDocument } from '@/lib/flexcil-parser';
import { formatDate, formatFileSize } from '@/lib/flexcil-parser';
import { PdfViewer } from './PdfViewer';
import { downloadSingleFile } from '@/lib/zip-export';

interface DocumentViewerProps {
  doc: FlexDocument;
  folderName: string;
}

type Tab = 'pdf' | 'thumbnail' | 'annotations' | 'info';

export function DocumentViewer({ doc, folderName }: DocumentViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('pdf');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const displayName = doc.info?.name ?? doc.name;

  useEffect(() => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    if (doc.thumbnail) {
      const blob = new Blob([doc.thumbnail], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setThumbnailUrl(url);
    } else {
      setThumbnailUrl(null);
    }
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, [doc.thumbnail]);

  useEffect(() => {
    if (doc.pdfData) setActiveTab('pdf');
    else if (doc.thumbnail) setActiveTab('thumbnail');
    else setActiveTab('info');
  }, [doc]);

  const copyName = () => {
    navigator.clipboard.writeText(displayName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const annotationCount = doc.drawingsData?.length ?? 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean; badge?: number }[] = [
    { id: 'pdf', label: 'PDF', icon: <FileText className="w-3.5 h-3.5" />, show: !!doc.pdfData },
    { id: 'thumbnail', label: 'Preview', icon: <Image className="w-3.5 h-3.5" />, show: !!doc.thumbnail },
    { id: 'annotations', label: 'Annotations', icon: <Edit3 className="w-3.5 h-3.5" />, show: annotationCount > 0, badge: annotationCount },
    { id: 'info', label: 'Details', icon: <Info className="w-3.5 h-3.5" />, show: true },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Layers className="w-3 h-3" />
              <span>{folderName}</span>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold truncate leading-tight">{displayName}</h2>
              <button
                onClick={copyName}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Copy document name"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {doc.info && (
              <div className="flex flex-wrap gap-3 mt-1.5">
                {doc.info.createDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>Created: {formatDate(doc.info.createDate)}</span>
                  </div>
                )}
                {doc.info.modifiedDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Modified: {formatDate(doc.info.modifiedDate)}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(doc.flxSize ?? 0)}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc.pdfData && (
              <button
                onClick={() => downloadSingleFile(doc.pdfData!, `${displayName}.pdf`, 'application/pdf')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            )}
            {doc.thumbnail && (
              <button
                onClick={() => downloadSingleFile(doc.thumbnail!, `${displayName}_preview.jpg`, 'image/jpeg')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Preview
              </button>
            )}
            {(doc.pdfData || doc.thumbnail) && (
              <button
                onClick={async () => {
                  const { exportAsZip } = await import('@/lib/zip-export');
                  await exportAsZip([{
                    name: displayName,
                    pdfData: doc.pdfData,
                    thumbnail: doc.thumbnail,
                    folderName,
                  }], 'all', displayName);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                title="Export this document as ZIP"
              >
                <Package className="w-3.5 h-3.5" />
                ZIP
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1 mt-4">
          {tabs.filter((t) => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors relative
                ${activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-white/20' : 'bg-primary/15 text-primary'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'pdf' && doc.pdfData && (
          <PdfViewer pdfData={doc.pdfData} docName={displayName} />
        )}

        {activeTab === 'thumbnail' && (
          <div className="h-full flex flex-col items-center justify-center p-8 gap-4 overflow-auto">
            {thumbnailUrl ? (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={thumbnailUrl}
                  alt={`Preview for ${displayName}`}
                  className="max-w-full max-h-[70vh] rounded-xl shadow-xl object-contain border border-border"
                />
                <p className="text-xs text-muted-foreground">Document cover preview generated by Flexcil</p>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">No preview available</div>
            )}
          </div>
        )}

        {activeTab === 'annotations' && (
          <AnnotationsTab doc={doc} />
        )}

        {activeTab === 'info' && (
          <InfoTab doc={doc} folderName={folderName} displayName={displayName} />
        )}
      </div>
    </div>
  );
}

function AnnotationsTab({ doc }: { doc: FlexDocument }) {
  const drawings = doc.drawingsData ?? [];

  type DrawingItem = {
    figures?: Array<{ type?: number; points?: number[]; color?: string; width?: number }>;
    type?: string;
  };

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="max-w-2xl">
        <h3 className="font-semibold mb-1">Handwriting & Annotations</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This document contains {drawings.length} annotation object{drawings.length !== 1 ? 's' : ''} (pen strokes, highlights, text marks).
        </p>

        <div className="space-y-3">
          {(drawings as DrawingItem[]).map((drawing, i) => {
            const figures = drawing.figures ?? [];
            const typeLabels: Record<number, string> = { 1: 'Pen', 2: 'Highlight', 3: 'Eraser', 4: 'Text', 5: 'Shape' };
            const types = [...new Set(figures.map((f) => typeLabels[f.type ?? 0] ?? 'Mark'))];
            return (
              <div key={i} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Annotation Layer {i + 1}</p>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {figures.length} stroke{figures.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {types.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t}</span>
                    ))}
                  </div>
                )}
                {figures.slice(0, 3).map((f, j) => (
                  f.color && (
                    <div key={j} className="flex items-center gap-2 mt-2">
                      <div
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: f.color }}
                      />
                      <span className="text-xs text-muted-foreground">{f.color} · width {f.width ?? '?'}</span>
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoTab({ doc, folderName, displayName }: { doc: FlexDocument; folderName: string; displayName: string }) {
  return (
    <div className="p-6 overflow-auto h-full">
      <div className="max-w-2xl space-y-6">
        <InfoSection title="Document Details">
          <InfoRow label="Name" value={displayName} />
          <InfoRow label="Folder" value={folderName} />
          {doc.info?.key && <InfoRow label="Document ID" value={doc.info.key} mono />}
          {doc.info?.type !== undefined && (
            <InfoRow label="Type" value={doc.info.type === 0 ? 'PDF Document' : `Type ${doc.info.type}`} />
          )}
          {doc.info?.createDate && <InfoRow label="Created" value={formatDate(doc.info.createDate)} />}
          {doc.info?.modifiedDate && <InfoRow label="Modified" value={formatDate(doc.info.modifiedDate)} />}
          <InfoRow label=".flx File Size" value={formatFileSize(doc.flxSize ?? 0)} />
          {doc.pdfData && <InfoRow label="PDF Size" value={formatFileSize(doc.pdfData.length)} />}
          {doc.thumbnail && <InfoRow label="Preview Size" value={formatFileSize(doc.thumbnail.length)} />}
        </InfoSection>

        {doc.pages && doc.pages.length > 0 && (
          <InfoSection title={`Pages (${doc.pages.length})`}>
            {doc.pages.map((page, i) => (
              <div key={page.key} className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-medium mb-2">Page {i + 1}</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Width: {Math.round(page.frame.width)} pt</span>
                  <span>Height: {Math.round(page.frame.height)} pt</span>
                  <span>Rotation: {page.rotate}°</span>
                  {page.attachmentPage && <span>PDF page: {page.attachmentPage.index + 1}</span>}
                </div>
              </div>
            ))}
          </InfoSection>
        )}

        <InfoSection title="Embedded Files">
          {doc.pdfData && <FileRow icon="📄" name="PDF Document" size={doc.pdfData.length} canDownload onDownload={() => downloadSingleFile(doc.pdfData!, `${displayName}.pdf`, 'application/pdf')} />}
          {doc.thumbnail && <FileRow icon="🖼️" name="Cover Preview (JPEG)" size={doc.thumbnail.length} canDownload onDownload={() => downloadSingleFile(doc.thumbnail!, `${displayName}_preview.jpg`, 'image/jpeg')} />}
          {doc.pages && <FileRow icon="📋" name="Page Index (JSON)" size={0} />}
          {doc.drawingsData && doc.drawingsData.length > 0 && <FileRow icon="✏️" name={`Annotation Data (${doc.drawingsData.length} layers)`} size={0} />}
        </InfoSection>
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-foreground break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function FileRow({ icon, name, size, canDownload, onDownload }: { icon: string; name: string; size: number; canDownload?: boolean; onDownload?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
      <span className="text-lg">{icon}</span>
      <span className="text-sm flex-1">{name}</span>
      {size > 0 && <span className="text-xs text-muted-foreground">{formatFileSize(size)}</span>}
      {canDownload && onDownload && (
        <button
          onClick={onDownload}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Download"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
