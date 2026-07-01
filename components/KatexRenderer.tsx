"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

interface KatexRendererProps {
  latex: string;
  className?: string;
  display?: boolean;
}

export function KatexRenderer({
  latex,
  className = "",
  display = false,
}: KatexRendererProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      ref.current.innerHTML = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: display,
      });
    } catch {
      ref.current.textContent = latex;
    }
  }, [latex, display]);

  return <span className={className} ref={ref} />;
}
