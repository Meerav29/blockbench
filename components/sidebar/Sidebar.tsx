"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageRow, PageWithChildren } from "@/lib/types";
import { PageTreeItem } from "./PageTreeItem";

function buildTree(pages: PageRow[]): PageWithChildren[] {
  const map = new Map<string, PageWithChildren>();
  const roots: PageWithChildren[] = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface Props {
  pages: PageRow[];
  activePageId: string;
}

export function Sidebar({ pages, activePageId }: Props) {
  const router = useRouter();
  const tree = buildTree(pages);

  async function createPage() {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    const page = await res.json();
    router.push(`/${page.id}`);
  }

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 flex flex-col h-screen">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Blockbench</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {tree.map((page) => (
          <PageTreeItem
            key={page.id}
            page={page}
            activePageId={activePageId}
          />
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-100">
        <button
          onClick={createPage}
          className="w-full text-left text-sm text-gray-400 hover:text-gray-600 flex items-center gap-2"
        >
          <span>+</span> New page
        </button>
      </div>
    </aside>
  );
}
