"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Loader2 } from "lucide-react";

// Load pdfjs from CDN (same approach as pdf-viewer.tsx to avoid webpack bundling issues)
const PDFJS_VERSION = "4.10.38";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

type PdfjsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (url: string) => { promise: Promise<{ getPage: (n: number) => Promise<{ getViewport: (p: { scale: number }) => { width: number; height: number }; render: (p: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> } }> }> };
};

let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("pdfjs-script") as HTMLScriptElement | null;
    if (existing && (window as unknown as { __pdfjs?: PdfjsModule }).__pdfjs) {
      const mod = (window as unknown as { __pdfjs: PdfjsModule }).__pdfjs;
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      resolve(mod);
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
    setTimeout(() => {
      const mod = (window as unknown as { __pdfjs?: PdfjsModule }).__pdfjs;
      if (mod) { mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN; resolve(mod); }
      else reject(new Error("pdfjs load timeout"));
    }, 10000);
  });
  return pdfjsPromise;
}

interface PdfThumbnailProps {
  url: string;
  className?: string;
  onClick?: () => void;
}

export function PdfThumbnail({ url, className = "", onClick }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      try {
        setLoading(true);
        setError(false);

        const pdfjs = await loadPdfjs();
        if (cancelled) return;

        const pdf = await pdfjs.getDocument(url).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const targetWidth = 400;
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    renderThumbnail();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-rose-50 to-red-100 dark:from-rose-950/30 dark:to-red-950/15 ${className}`} onClick={onClick}>
        <div className="flex flex-col items-center gap-2 p-5">
          <div className="h-14 w-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md">
            <FileText className="h-7 w-7" />
          </div>
          <p className="text-xs text-muted-foreground">PDF Document</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-muted/20 ${className}`} onClick={onClick}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
            <p className="text-xs text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
      />
      {!loading && (
        <div className="absolute top-2 right-2 bg-rose-500 text-white rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-md flex items-center gap-1">
          <FileText className="h-3 w-3" /> PDF
        </div>
      )}
    </div>
  );
}
