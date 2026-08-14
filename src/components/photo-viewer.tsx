"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Download, Share2, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";

interface PhotoViewerProps {
  images: { url: string; title?: string }[];
  index: number | null;
  onClose: () => void;
  embedded?: boolean;
  siteDomain?: string;
  onExpand?: (index: number) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onOpenFullScreen?: (index: number) => void;
}

export function PhotoViewer({ images, index, onClose, embedded = false, siteDomain, onExpand, isExpanded = false, onToggleExpand, onOpenFullScreen }: PhotoViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [currentIndex, setCurrentIndex] = useState(index ?? 0);

  // Gesture state
  const touchState = useRef<{
    mode: "none" | "pan" | "pinch" | "swipe-down";
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startDist: number;
    startZoom: number;
    velocityX: number;
    velocityY: number;
    lastMoveTime: number;
    panOffsetStart: { x: number; y: number };
    doubleTapTimer: ReturnType<typeof setTimeout> | null;
    lastTapTime: number;
  }>({
    mode: "none",
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    startDist: 0, startZoom: 1,
    velocityX: 0, velocityY: 0, lastMoveTime: 0,
    panOffsetStart: { x: 0, y: 0 },
    doubleTapTimer: null,
    lastTapTime: 0,
  });

  // Momentum animation
  const momentumRef = useRef<{ raf: number | null; vx: number; vy: number }>({ raf: null, vx: 0, vy: 0 });

  const current = currentIndex !== null && currentIndex >= 0 && currentIndex < images.length ? images[currentIndex] : null;

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const next = useCallback(() => {
    setCurrentIndex(i => Math.min(images.length - 1, i + 1));
    resetZoom();
  }, [images.length, resetZoom]);

  const prev = useCallback(() => {
    setCurrentIndex(i => Math.max(0, i - 1));
    resetZoom();
  }, [resetZoom]);

  useEffect(() => {
    if (index !== null) {
      setCurrentIndex(index);
      // Auto-fit: reset zoom and pan when image changes
      resetZoom();
      if (!embedded) document.body.style.overflow = "hidden";
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowRight" && currentIndex < images.length - 1) next();
        if (e.key === "ArrowLeft" && currentIndex > 0) prev();
      };
      window.addEventListener("keydown", handler);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handler);
      };
    }
  }, [index, currentIndex, images.length, onClose, next, prev, embedded, resetZoom]);

  // Cleanup momentum on unmount
  useEffect(() => {
    return () => {
      if (momentumRef.current.raf) cancelAnimationFrame(momentumRef.current.raf);
      if (touchState.current.doubleTapTimer) clearTimeout(touchState.current.doubleTapTimer);
    };
  }, []);

  const stopMomentum = () => {
    if (momentumRef.current.raf) {
      cancelAnimationFrame(momentumRef.current.raf);
      momentumRef.current.raf = null;
    }
  };

  const startMomentum = (vx: number, vy: number) => {
    stopMomentum();
    momentumRef.current.vx = vx;
    momentumRef.current.vy = vy;
    const decay = 0.93;
    const tick = () => {
      momentumRef.current.vx *= decay;
      momentumRef.current.vy *= decay;
      const speed = Math.hypot(momentumRef.current.vx, momentumRef.current.vy);
      if (speed < 0.5) {
        stopMomentum();
        return;
      }
      setPan(prev => ({
        x: prev.x + momentumRef.current.vx * 0.016,
        y: prev.y + momentumRef.current.vy * 0.016,
      }));
      momentumRef.current.raf = requestAnimationFrame(tick);
    };
    momentumRef.current.raf = requestAnimationFrame(tick);
  };

  const getTouchDist = (t1: React.Touch, t2: React.Touch) => {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    stopMomentum();
    const touches = e.touches;

    if (touches.length === 1) {
      const t = touches[0];
      const now = Date.now();
      const ts = touchState.current;

      // Double-tap detection
      if (now - ts.lastTapTime < 300) {
        // Double tap: toggle zoom
        setZoom(z => {
          if (z > 1) {
            setPan({ x: 0, y: 0 });
            return 1;
          }
          return 2.5;
        });
        ts.lastTapTime = 0;
        ts.mode = "none";
        return;
      }

      ts.lastTapTime = now;
      ts.mode = "pan";
      ts.startX = t.clientX;
      ts.startY = t.clientY;
      ts.lastX = t.clientX;
      ts.lastY = t.clientY;
      ts.lastMoveTime = Date.now();
      ts.panOffsetStart = { ...pan };
      ts.velocityX = 0;
      ts.velocityY = 0;
    } else if (touches.length === 2) {
      const ts = touchState.current;
      ts.mode = "pinch";
      ts.startDist = getTouchDist(touches[0], touches[1]);
      ts.startZoom = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touches = e.touches;
    const ts = touchState.current;

    if (ts.mode === "pinch" && touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(touches[0], touches[1]);
      const scale = ts.startZoom * (dist / ts.startDist);
      setZoom(Math.max(1, Math.min(5, scale)));
    } else if (ts.mode === "pan" && touches.length === 1) {
      e.preventDefault();
      const t = touches[0];
      const dx = t.clientX - ts.startX;
      const dy = t.clientY - ts.startY;

      // Swipe-down-to-dismiss: only when not zoomed
      if (zoom <= 1 && dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        ts.mode = "swipe-down";
        return;
      }

      const now = Date.now();
      const dt = now - ts.lastMoveTime;
      if (dt > 0) {
        ts.velocityX = (t.clientX - ts.lastX) / dt * 16;
        ts.velocityY = (t.clientY - ts.lastY) / dt * 16;
      }
      ts.lastX = t.clientX;
      ts.lastY = t.clientY;
      ts.lastMoveTime = now;

      if (zoom > 1) {
        setPan({
          x: ts.panOffsetStart.x + dx / zoom,
          y: ts.panOffsetStart.y + dy / zoom,
        });
      }
    } else if (ts.mode === "swipe-down" && touches.length === 1) {
      e.preventDefault();
      // Track swipe distance for dismiss threshold
      const t = touches[0];
      const dy = t.clientY - ts.startY;
      if (dy > 150) {
        onClose();
        return;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const ts = touchState.current;

    if (ts.mode === "pan" && zoom > 1) {
      // Apply momentum
      const speed = Math.hypot(ts.velocityX, ts.velocityY);
      if (speed > 5) {
        startMomentum(ts.velocityX, ts.velocityY);
      }
    }

    if (ts.mode === "swipe-down") {
      const remaining = e.touches[0];
      if (remaining) {
        const dy = remaining.clientY - ts.startY;
        if (dy > 150) {
          onClose();
          return;
        }
      } else {
        // All fingers lifted — check if we crossed threshold
        // Already handled in touchmove, just reset
      }
    }

    ts.mode = "none";
  };

  // Wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(1, Math.min(5, z - e.deltaY * 0.002)));
    }
  };

  const handleShare = async () => {
    if (!current) return;
    const shareData = {
      title: current.title || "Image",
      text: current.title || "",
      url: (siteDomain || window.location.origin) + current.url,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      navigator.clipboard?.writeText(shareData.url);
    }
  };

  // Mouse drag for desktop panning
  const mouseState = useRef<{ dragging: boolean; startX: number; startY: number; panStart: { x: number; y: number } }>({ dragging: false, startX: 0, startY: 0, panStart: { x: 0, y: 0 } });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    stopMomentum();
    mouseState.current = { dragging: true, startX: e.clientX, startY: e.clientY, panStart: { ...pan } };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseState.current.dragging) return;
    const dx = e.clientX - mouseState.current.startX;
    const dy = e.clientY - mouseState.current.startY;
    setPan({
      x: mouseState.current.panStart.x + dx / zoom,
      y: mouseState.current.panStart.y + dy / zoom,
    });
  };

  const handleMouseUp = () => {
    mouseState.current.dragging = false;
  };

  // Auto-fit on container resize (e.g. modal opening, window resize)
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!embedded || !containerRef.current) return;
    const observer = new ResizeObserver(() => {
      // Auto-fit only if zoom is at 1 (don't disrupt user's zoom)
      if (zoom === 1) return; // already fitted, CSS handles it
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [embedded, zoom]);

  if (index === null || !current) return null;

  const containerClass = embedded
    ? "relative flex items-center justify-center overflow-hidden bg-transparent w-full h-full"
    : "fixed inset-0 z-[100] bg-black flex items-center justify-center touch-none";

  return (
    <div
      ref={containerRef}
      className={containerClass}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: zoom > 1 ? (mouseState.current.dragging ? "grabbing" : "grab") : "default" }}
    >
      {/* Image */}
      <div
        className={embedded
          ? "relative flex items-center justify-center w-full h-full min-h-0 overflow-hidden"
          : "relative max-w-[95vw] max-h-[92vh] flex items-center justify-center"
        }
      >
        <img
          src={current.url}
          alt={current.title || "Photo"}
          className={embedded ? "max-w-full max-h-full object-contain block" : "max-w-full max-h-[92vh] object-contain block"}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: touchState.current.mode === "none" && !mouseState.current.dragging ? "transform 0.2s ease-out" : "none",
            cursor: embedded && zoom === 1 && (onToggleExpand || onOpenFullScreen) ? "pointer" : undefined,
          }}
          draggable={false}
          onClick={embedded && zoom === 1 ? () => {
            // On mobile: open full-screen viewer (closes modal). On desktop: toggle expand.
            if (onOpenFullScreen && window.innerWidth < 768) {
              onOpenFullScreen(currentIndex);
            } else if (onToggleExpand) {
              onToggleExpand();
            }
          } : undefined}
        />
      </div>

      {/* Top gradient + Close button — hidden in embedded mode (title is in sidebar) */}
      {!embedded && (
        <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="text-white font-medium text-sm truncate max-w-[50%] pointer-events-auto">
            {current.title || `Photo ${currentIndex + 1} of ${images.length}`}
          </div>
          <button
            onClick={onClose}
            className="pointer-events-auto flex items-center justify-center h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white shrink-0"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Nav arrows — desktop only, hidden on mobile to avoid overlap */}
      {images.length > 1 && currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Bottom floating toolbar — full-screen mode only */}
      {!embedded && (
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)] pt-8 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 pb-4 px-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {/* Zoom out */}
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.25))}
              className="flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white shrink-0"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>

            {/* Zoom percentage */}
            <span className="text-white/80 text-xs font-medium w-12 text-center select-none shrink-0">
              {Math.round(zoom * 100)}%
            </span>

            {/* Zoom in */}
            <button
              onClick={() => setZoom(z => Math.min(5, z + 0.25))}
              className="flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white shrink-0"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>

            {/* Reset */}
            {zoom > 1 && (
              <button
                onClick={resetZoom}
                className="flex items-center justify-center h-11 px-3 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white text-xs font-medium shrink-0"
              >
                Reset
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-white/20 mx-0.5 shrink-0" />

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white shrink-0"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>

            {/* Download */}
            <a href={current.url} download className="shrink-0">
              <button
                className="flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
                aria-label="Download"
              >
                <Download className="h-5 w-5" />
              </button>
            </a>
          </div>
        </div>
      )}

      {/* Toolbar — embedded mode only (bottom-right) */}
      {embedded && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-1">
          {/* Zoom out */}
          <button
            onClick={() => setZoom(z => Math.max(1, z - 0.25))}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          {/* Zoom percentage */}
          <span className="text-white/70 text-[10px] font-medium w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          {/* Zoom in */}
          <button
            onClick={() => setZoom(z => Math.min(5, z + 0.25))}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-white/20 mx-0.5" />

          {/* Expand / Minimize — single toggle button (also resets zoom on shrink) */}
          {(onToggleExpand || onOpenFullScreen) && (
            <button
              onClick={() => {
                if (onOpenFullScreen && window.innerWidth < 768) {
                  onOpenFullScreen(currentIndex);
                } else if (onToggleExpand) {
                  // Reset zoom when shrinking back to normal
                  if (isExpanded) resetZoom();
                  onToggleExpand();
                }
              }}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white"
              aria-label={isExpanded ? "Shrink" : "Expand"}
              title={isExpanded ? "Shrink" : "Expand"}
            >
              {isExpanded ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
