"use client";

import { useState } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function LazyImage({ src, alt, className, onClick }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${onClick ? "cursor-pointer" : ""} ${className || ""}`} onClick={onClick}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted/40 to-muted/20" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-500 ${loaded ? "blur-0 scale-100 opacity-100" : "blur-md scale-105 opacity-60"}`}
      />
    </div>
  );
}
