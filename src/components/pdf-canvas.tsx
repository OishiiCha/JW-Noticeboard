"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronLeft, ChevronRight, Columns2, Columns, X, ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

// PDF rendering library is loaded from CDN via script tag injection.
// This bypasses webpack bundling entirely (the ESM build crashes webpack dev mode).
const PDFJS_VERSION = "4.10.38";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

type PdfjsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (params: { url: string }) => { promise: Promise<PdfDoc> };
};

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};

type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    // Load from CDN via script tag to bypass webpack bundling entirely
    const existing = document.getElementById("pdfjs-script") as HTMLScriptElement | null;
    if (existing && (window as unknown as { __pdfjs?: PdfjsModule }).__pdfjs) {
      resolve((window as unknown as { __pdfjs: PdfjsModule }).__pdfjs);
      return;
    }
    const script = document.createElement("script");
    script.id = "pdfjs-script";
    script.type = "module";
    script.textContent = `
      import * as pdfjs from "${PDFJS_CDN}";
      window.__pdfjs = pdfjs;
      window.dispatchEvent(new Event("pdfjs-loaded"));
    `;
    const onLoad = () => {
      const mod = (window as unknown as { __pdfjs?: PdfjsModule }).__pdfjs;
      if (mod) {
        mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        resolve(mod);
      } else {
        reject(new Error("pdfjs failed to load"));
      }
      window.removeEventListener("pdfjs-loaded", onLoad);
    };
    window.addEventListener("pdfjs-loaded", onLoad);
    document.head.appendChild(script);
    // Timeout fallback
    setTimeout(() => {
      const mod = (window as unknown as { __pdfjs?: PdfjsModule }).__pdfjs;
      if (mod) {
        mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
        resolve(mod);
      } else {
        reject(new Error("pdfjs load timeout"));
      }
    }, 10000);
  });
  return pdfjsPromise;
}

interface PdfViewerProps {
  url: string | null;
  title?: string;
  onClose: () => void;
  embedded?: boolean;
}

export function PdfViewer({ url, title, onClose, embedded = false }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [twoPageView, setTwoPageView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);
  const [zoom, setZoom] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pdfDocRef = useRef<PdfDoc | null>(null);

  useEffect(() => {
    if (url && window.innerWidth >= 768) {
      setTwoPageView(true);
    } else {
      setTwoPageView(false);
    }
    setZoom(1.0);
  }, [url]);

  useEffect(() => {
    if (url) {
      if (!embedded) document.body.style.overflow = "hidden";
      setLoading(true);
      setError(false);
      setNumPages(0);
      setCurrentPage(1);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [url, embedded]);

  // Load PDF document and render pages
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    async function loadAndRender() {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        const doc = await pdfjs.getDocument({ url: url! }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
        renderPages(doc);
      } catch (err) {
        console.error("PDF load error:", err);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadAndRender();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Re-render when page, zoom, or container size changes
  const renderPages = useCallback(async (doc?: PdfDoc) => {
    const theDoc = doc || pdfDocRef.current;
    if (!theDoc) return;
    const pagesToShow = twoPageView
      ? [currentPage, currentPage + 1].filter(p => p <= theDoc.numPages)
      : [currentPage];

    const SCROLLBAR_BUFFER = 24;
    const PAGE_RATIO = 0.68;
    let pageWidth: number;
    if (twoPageView) {
      const widthByHeight = (containerHeight - SCROLLBAR_BUFFER) * PAGE_RATIO;
      const widthByContainer = (containerWidth - SCROLLBAR_BUFFER) / 2;
      pageWidth = Math.min(widthByContainer, widthByHeight) * zoom;
    } else {
      const widthByHeight = (containerHeight - SCROLLBAR_BUFFER) * PAGE_RATIO;
      const widthByContainer = containerWidth - SCROLLBAR_BUFFER;
      pageWidth = Math.min(widthByContainer, widthByHeight) * zoom;
    }
    pageWidth = Math.max(pageWidth, 200);

    for (let i = 0; i < pagesToShow.length; i++) {
      const pageNum = pagesToShow[i];
      const canvas = canvasRefs.current[i];
      if (!canvas) continue;
      const page = await theDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = pageWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    }
  }, [currentPage, twoPageView, zoom, containerWidth, containerHeight]);

  useEffect(() => {
    if (pdfDocRef.current && !loading && !error) {
      renderPages();
    }
  }, [renderPages, loading, error]);

  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;
    const updateSize = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      setContainerWidth(prev => prev !== w ? w : prev);
      setContainerHeight(prev => prev !== h ? h : prev);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const goToPrevPage = useCallback(() => setCurrentPage(p => Math.max(1, p - (twoPageView ? 2 : 1))), [twoPageView]);
  const goToNextPage = useCallback(() => setCurrentPage(p => Math.min(numPages, p + (twoPageView ? 2 : 1))), [numPages, twoPageView]);

  useEffect(() => {
    if (!url) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goToPrevPage(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goToNextPage(); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [url, goToPrevPage, goToNextPage, onClose]);

  if (!url) return null;

  const pagesToShow = twoPageView
    ? [currentPage, currentPage + 1].filter(p => p <= numPages)
    : [currentPage];

  const body = (
    <>
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/40 flex items-center justify-between shrink-0 bg-card gap-2">
          {embedded ? (
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
              {numPages > 0 ? `${numPages} page${numPages === 1 ? "" : "s"}` : "PDF document"}
            </span>
          ) : (
            <h2 className="text-sm font-semibold truncate flex-1 min-w-0">
              {title || "PDF Viewer"}
            </h2>
          )}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {numPages > 0 && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <button onClick={() => setZoom(1.0)} className="text-xs text-muted-foreground hover:text-foreground px-1 min-w-[3rem] text-center hover:bg-accent rounded transition-colors" title="Reset to 100%">
                  {Math.round(zoom * 100)}%
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(3.0, z + 0.1))} title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
              </>
            )}
            {numPages > 0 && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevPage} disabled={currentPage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground whitespace-nowrap px-1 min-w-[5rem] text-center">
                  {twoPageView && currentPage + 1 <= numPages
                    ? `${currentPage}-${currentPage + 1} / ${numPages}`
                    : `${currentPage} / ${numPages}`}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextPage} disabled={currentPage >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {numPages > 1 && (
              <Button variant="ghost" size="sm" className="h-8 hidden sm:flex" onClick={() => setTwoPageView(!twoPageView)} title={twoPageView ? "Single page view" : "Two page view"}>
                {twoPageView ? <Columns className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
                <span className="hidden md:inline ml-1">{twoPageView ? "1 Page" : "2 Pages"}</span>
              </Button>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="h-8">
                <ExternalLink className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Open</span>
              </Button>
            </a>
            <a href={url} download>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-neutral-200 dark:bg-neutral-900 flex items-center justify-center p-4 min-h-0"
        >
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <p className="text-sm text-muted-foreground">Failed to load PDF</p>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Open in new tab</Button>
              </a>
            </div>
          )}
          {!loading && !error && (
            <div className={`flex ${twoPageView ? "flex-row gap-3" : "flex-col"} items-center`}>
              {pagesToShow.map((pageNum, idx) => (
                <div key={pageNum} className="shadow-lg rounded-lg overflow-hidden bg-white shrink-0">
                  <canvas
                    ref={(el) => { canvasRefs.current[idx] = el; }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
    </>
  );

  if (embedded) {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden bg-card min-h-0">
        {body}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-card border border-border/40 rounded-none md:rounded-2xl shadow-2xl w-full h-full md:w-[95vw] md:h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {body}
      </div>
    </div>
  );
}
