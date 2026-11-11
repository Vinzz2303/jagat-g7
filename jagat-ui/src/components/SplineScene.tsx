"use client";

import { useEffect, useRef, useState } from "react";

interface SplineSceneProps {
  onLoad?: () => void;
}

/**
 * Loads and mounts the <spline-viewer> Web Component dynamically on the client side.
 * This prevents SSR hydration issues in Next.js and loads the raw .splinecode directly.
 */
export default function SplineScene({ onLoad }: SplineSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 1. Inject the Spline Viewer script if it doesn't exist
    const scriptId = "spline-viewer-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "module";
      script.src = "https://unpkg.com/@splinetool/viewer@1.12.95/build/spline-viewer.js";
      document.head.appendChild(script);
    }

    // 2. Create the custom element dynamically
    const viewer = document.createElement("spline-viewer");
    viewer.setAttribute("url", "https://prod.spline.design/69mxF7pk2sWhnHjp/scene.splinecode");
    viewer.style.width = "100%";
    viewer.style.height = "100%";

    const hideLogo = () => {
      try {
        const shadowRoot = viewer.shadowRoot;
        if (shadowRoot) {
          const style = document.createElement("style");
          style.innerHTML = `
            #logo {
              display: none !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `;
          shadowRoot.appendChild(style);
        }
      } catch (err) {
        console.warn("Failed to hide Spline logo inside shadow DOM:", err);
      }
    };

    // Handle when scene load is completed
    const handleLoad = () => {
      setLoaded(true);
      onLoad?.();
      hideLogo();
    };

    viewer.addEventListener("load-complete", handleLoad);

    // Fallback in case load-complete event doesn't bubble up correctly
    const fallbackTimeout = setTimeout(() => {
      setLoaded(true);
      onLoad?.();
      hideLogo();
    }, 4500);

    if (containerRef.current) {
      containerRef.current.appendChild(viewer);
    }

    return () => {
      viewer.removeEventListener("load-complete", handleLoad);
      clearTimeout(fallbackTimeout);
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [onLoad]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl bg-[#E3E3E3]"
      style={{ height: "clamp(550px, 72vh, 800px)" }}
    >
      {/* Loading skeleton — fades out when spline loads */}
      <div
        className={`absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl bg-[#E3E3E3] transition-opacity duration-700 ${
          loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="relative mb-4">
          <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full border-2 border-garuda-500/30" />
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-neutral-300 border-t-garuda-500" />
        </div>
        <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase text-neutral-500 animate-pulse">
          Initializing 3D Core...
        </span>
      </div>

      {/* Dynamic injection container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Bottom Gradient Overlay to mask cut-off feet */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#E3E3E3] to-transparent pointer-events-none z-10 rounded-b-3xl" />
    </div>
  );
}
