"use client";

import { useMemo } from "react";
import { KatexRenderer } from "./KatexRenderer";

interface MixedKatexProps {
  source: string;
  className?: string;
}

export function MixedKatex({ source, className = "" }: MixedKatexProps) {
  const parts = useMemo(() => {
    const tokens: { type: "text" | "math" | "display"; content: string }[] = [];
    const displayPattern = /\$\$([\s\S]+?)\$\$/g;
    const inlinePattern = /\$([^$\n]+?)\$/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // First extract display blocks
    const displays: { start: number; end: number; content: string }[] = [];
    while ((match = displayPattern.exec(source)) !== null) {
      displays.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    let cursor = 0;
    for (const d of displays) {
      const before = source.slice(cursor, d.start);
      tokens.push(...tokenizeInline(before));
      tokens.push({ type: "display", content: d.content });
      cursor = d.end;
    }
    if (cursor < source.length) {
      tokens.push(...tokenizeInline(source.slice(cursor)));
    }

    return tokens;
  }, [source]);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <span key={i}>{part.content}</span>;
        }
        if (part.type === "display") {
          return (
            <span key={i} className="block my-2 text-center">
              <KatexRenderer latex={part.content} display />
            </span>
          );
        }
        return <KatexRenderer key={i} latex={part.content} />;
      })}
    </span>
  );
}

function tokenizeInline(text: string) {
  const tokens: { type: "text" | "math"; content: string }[] = [];
  const inlinePattern = /\$([^$\n]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "math", content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }
  return tokens;
}
