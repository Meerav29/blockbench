"use client";

import Link from "next/link";
import { useState } from "react";
import { PageWithChildren } from "@/lib/types";

interface Props {
  page: PageWithChildren;
  activePageId: string;
  depth?: number;
}

export function PageTreeItem({ page, activePageId, depth = 0 }: Props) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children.length > 0;
  const isActive = page.id === activePageId;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 ${
          isActive ? "bg-gray-200 font-medium" : ""
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0"
        >
          {hasChildren ? (expanded ? "▾" : "▸") : ""}
        </button>
        <span className="shrink-0">{page.icon ?? "📄"}</span>
        <Link href={`/${page.id}`} className="flex-1 truncate">
          {page.title || "Untitled"}
        </Link>
      </div>
      {expanded && hasChildren && (
        <div>
          {page.children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              activePageId={activePageId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
